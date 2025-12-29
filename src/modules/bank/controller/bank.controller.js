import Bank from '../model/bank.model.js';
import User from '../../user/model/user.model.js';
import Transaction from '../../transaction/model/transaction.model.js';
import axios from "axios";
import { sendBankTransferEmail } from "../../../utils/emailService.utils.js";
import crypto from "crypto";

import Stripe from 'stripe';
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" })
  : null;




export const createBankAccount = async (req, res, next) => {
    try {
      const { id } = req.user;

      const { bankName, accountNumber, accountName, bankCode } = req.body;
      if (!bankName || !accountNumber || !accountName || !bankCode) {
          return res.status(400).json({ message: "Bank name, account number, account name and bank code are required" });
      }


      const existingAccount = await Bank.findOne({ accountNumber, userId: id });
      if (existingAccount) {
          return res.status(400).json({ message: "Bank account already exists for this user" });
      }

      const newBankAccount = await Bank.create({
          bankName,
          accountNumber,
          bankCode,
          accountName,
          userId: id
      });

      return res.status(201).json({
          message: "Bank account created successfully",
          data: newBankAccount
      });
    } catch (error) {
        next(error);
    }
}

// export const getBankAccount = async (req, res, next) => {
//     try {
//         const { id } = req.user;
//         const existingAccount = await Bank.find({ userId: id });
//         if (!existingAccount) {
//             return res.status(400).json({ message: "Bank account not found for this user" });
//         }
//         return res.status(200).json({
//             data: existingAccount
//         });
//     } catch (error) {
//         next(error);
//     }
// }


export const getBankAccount = async (req, res, next) => {
  try {
    const { id } = req.user;

    const user = await User.findById(id).select("stripeId email");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const existingAccounts = await Bank.find({ userId: id });

    if (!user.stripeId || existingAccounts.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Bank account or Stripe account not found for this user",
      });
    }

    const account = await stripe.accounts.retrieve(user.stripeId);

    const bankAccounts = await stripe.accounts.listExternalAccounts(
      user.stripeId,
      { object: "bank_account" }
    );

    return res.status(200).json({
      success: true,
      message: "Stripe and bank account retrieved successfully",
      data: {
        // account: {
        //   id: account.id,
        //   email: account.email,
        //   country: account.country,
        //   charges_enabled: account.charges_enabled,
        //   payouts_enabled: account.payouts_enabled,
        //   requirements: {
        //     currently_due: account.requirements?.currently_due || [],
        //     eventually_due: account.requirements?.eventually_due || [],
        //     disabled_reason: account.requirements?.disabled_reason || null,
        //   },
        // },
        stripeBankAccounts: bankAccounts.data.map((bank) => ({
          id: bank.id,
          bank_name: bank.bank_name,
          last4: bank.last4,
          currency: bank.currency,
          country: bank.country,
          status: bank.status,
        })),
        localBankAccounts: existingAccounts,
      },
    });
  } catch (error) {
    next(error);
  }
};


export const updateBankAccount = async (req, res, next) => {
    try {
        const { id } = req.user;
        const { bankName, accountNumber, accountName, bankCode } = req.body;
        const { bankId }= req.params;

        const existingAccount = await Bank.findOne({ _id: bankId, userId: id });
        if (!existingAccount) {
            return res.status(400).json({ message: "Bank account not found for this user" });
        }
        const updateBankAccount = await Bank.findByIdAndUpdate(existingAccount._id, {
            bankName,
            accountNumber,
            accountName,
            bankCode
        }, { new: true });
        if (!updateBankAccount) {
            return res.status(400).json({ message: "Failed to update bank account" });
        }
        return res.status(200).json({
            message: "Bank account updated successfully",
            data: updateBankAccount
        });
    } catch (error) {
        next(error);
    }
}



export const transferToBankAccount = async (req, res, next ) => {
  try {
    const { id } = req.user;
    const user = await User.findById(id);
    if (user.isBlocked === true) {
      return res.status(400).json({ message: 'You are blocked from transferring, please contact admin' });
    }

    const bankAcct = await Bank.findById(req.params.bankId);
    if (!bankAcct) {
      return res.status(400).json({ message: 'Bank not found' });
    } 

    const { amount, reason } = req.body;
    const getBanks = await axios.get("https://api.paystack.co/bank", {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_MAIN_KEY}`,
        "Content-Type": "application/json",
      },
    });
    const bank = getBanks.data.data.find(bank => bank.code === bankAcct.bankCode);
    if (!bank) {
        return res.status(400).json({ message: 'Invalid Bank Name' });
       }
    if (user.wallet < amount) {
        return res.status(400).json({ message: 'Insufficient funds' });
    }

    // const confirmPin = await Pin.findOne({ userId: user._id, pin: req.body.pin });
    // if (!confirmPin) {
    //   return res.status(400).json({ message: 'Invalid Pin' });
    // }
    
    const paystackResponse = await axios.post(
      "https://api.paystack.co/transferrecipient",
      {
        type: "nuban",
        name: user.fullName,
        account_number: bankAcct.accountNumber,
        source: "balance",
        amount: amount * 100,
        bank_code: bank.code,
        description: reason,
        email: user.email,
        currency: "NGN",
        metadata: {
          custom_fields: {
            display_name: "Bank Name",
            variable_name: "bank_name",
            value: bank.name,
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_MAIN_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    
    const transferCode = paystackResponse.data.data.recipient_code;
    const accountName = paystackResponse.data.data.details.account_name
    const transferData = paystackResponse.data;
    
    const transaction = await Transaction.create({
      paymentReference: crypto.randomBytes(9).toString("hex"),
      totalAmount: amount,
      title: "Transfer to bank account",
      email: user.email,
      userId: user._id,
      transfer_code: transferCode,
      accountName: bankAcct.accountName,
      bankName: bank.name,
      accountNumber: bankAcct.accountNumber,
      reason: reason,
      status: "successFull",
      paymentCurrency: "NGN",
      destination: "bank",
      sessionId: transferData.data.id,
    });
    await User.findOneAndUpdate(
      { _id: user._id },
      { $inc: { wallet: -amount } }
    );
    await sendBankTransferEmail(transaction, user.email);      

    return res
      .status(201)
      .json({
        message: "Transfer initiated successfully",
        transaction,
        transferData,
      });
  } catch (error) {
    next(error);
  }
};

export const verifyingBankAccount = async (req, res) => {
  const { accountNumber, bankCode } = req.query;
  const apiKey = process.env.PAYSTACK_MAIN_KEY;

  if (!accountNumber || !bankCode) {
    return res.status(400).json({
      success: false,
      message: "Account number and bank code are required"
    });
  }

  if (!/^\d{10}$/.test(accountNumber)) {
    return res.status(400).json({
      success: false,
      message: "Account number should be a 10-digit numeric value"
    });
  }

  const url = `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`;

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });

    if (response.data.status) {
      return res.json({
        success: true,
        data: response.data.data
      });
    } else {
      return res.status(400).json({
        success: false,
        message: response.data.message || "Could not verify account name"
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        error.response?.data.message ||
        "An error occurred during the verification process"
    });
  }
};

