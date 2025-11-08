import axios from "axios";
import crypto from "crypto";
import User from "../../user/model/user.model.js";
// import { generateRapydSignature } from "../../../utils/rapydSignature.js";

// 🔐 Replace these with your Rapyd test keys
const RAPYD_ACCESS_KEY = process.env.RAPYD_ACCESS_KEY;
const RAPYD_SECRET_KEY = process.env.RAPYD_SECRET_KEY;
const RAPYD_BASE_URL = "https://sandboxapi.rapyd.net"; // For live: https://api.rapyd.net

function generateRapydSignature(method, path, body = "") {
  const salt = crypto.randomBytes(8).toString("hex");
  const timestamp = Math.floor(Date.now() / 1000);
  const bodyString = body ? JSON.stringify(body) : "";
  const toSign = method.toLowerCase() + path + salt + timestamp + RAPYD_ACCESS_KEY + RAPYD_SECRET_KEY + bodyString;
  const hmac = crypto.createHmac("sha256", RAPYD_SECRET_KEY);
  hmac.update(toSign);
  const signature = Buffer.from(hmac.digest("hex")).toString("base64");
  return { salt, timestamp, signature };
}

export const createRapydUserWalletAndAccount = async (req, res, next) => {
  try {
    const { id }= req.user;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }
   
    const countryCurrencyMapping = {
      US: "USD",
      GB: "GBP",
      NG: "USD",
      CA: "USD",
      EU: "EUR",
    };

    // ✅ Ensure country is supported — otherwise, fallback to US
    let userCountry = (user.country || "US").toUpperCase();
    if (!["US", "GB"].includes(userCountry)) {
      userCountry = "US";
    }
    // 1️⃣ Create Wallet
    const walletPath = "/v1/user";
    const walletBody = {
      first_name: user.fullName.split(" ")[0],
      last_name: user.fullName.split(" ")[1],
      email: user.email,
      // phone_number: user.phoneNumber,
      contact: {
        // phone_number: user.phoneNumber,
        country: userCountry,
      },
      ewallet_reference_id: "user_" + Date.now(),
      type: "person",
      metadata: { app: "VirtualWalletSystem" },
    };

    const walletSignature = generateRapydSignature("post", walletPath, walletBody);

    const walletResponse = await axios.post(`${RAPYD_BASE_URL}${walletPath}`, walletBody, {
      headers: {
        "Content-Type": "application/json",
        access_key: RAPYD_ACCESS_KEY,
        salt: walletSignature.salt,
        timestamp: walletSignature.timestamp,
        signature: walletSignature.signature,
      },
    });

    const wallet = walletResponse.data.data;

    // ✅ Determine currency from mapping
    const userCurrency = countryCurrencyMapping[userCountry] || "USD";

    // 2️⃣ Create Virtual Bank Account (USD)
    const accountPath = "/v1/issuing/bankaccounts";
    const accountBody = {
      currency: userCurrency,
      country: userCountry,
      requested_currency: userCurrency,
      description: `${user.fullName}'s Virtual Account`,
      ewallet: wallet.id,
    };

    const accountSignature = generateRapydSignature("post", accountPath, accountBody);

    const accountResponse = await axios.post(`${RAPYD_BASE_URL}${accountPath}`, accountBody, {
      headers: {
        "Content-Type": "application/json",
        access_key: RAPYD_ACCESS_KEY,
        salt: accountSignature.salt,
        idempotency: crypto.randomBytes(6).toString("hex"),
        timestamp: accountSignature.timestamp,
        signature: accountSignature.signature,
      },
    });

    const virtualAccount = accountResponse.data.data;

    await User.findByIdAndUpdate(id, 
      { 
        rapydWalletId: wallet.id, 
        rapydVirtualAccountId: virtualAccount.id,
        issueBankAccountId: virtualAccount.issued_bank_account,
        accountNumber: virtualAccount.bank_account.account_number,
        routingNumber: virtualAccount.bank_account.aba_routing_number,
        accountName: user.fullName,
        bankName: virtualAccount.bank_account.beneficiary_name,
      }, { new: true });

    return res.status(200).json({
      success: true,
      message: "Wallet account created successfully",
      virtualAccount: virtualAccount,
      bankdetails: {
        rapydWalletId: wallet.id, 
        rapydVirtualAccountId: virtualAccount.id,
        issueBankAccountId: virtualAccount.issued_bank_account,
        accountNumber: virtualAccount.bank_account.account_number,
        routingNumber: virtualAccount.bank_account.aba_routing_number,
        accountName: user.fullName,
        bankName: virtualAccount.bank_account.beneficiary_name,
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create wallet or virtual account",
      error: error.response?.data || error.message,
    });
  }
};


export const walletBankTransfer = async (req, res) => {
  try {
    const { id }= req.params;
    // const { id }= req.user;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    const { amount, currency } = req.body;

    

    const path = "/v1/issuing/bankaccounts/bankaccounttransfertobankaccount";

    const body = {
      issued_bank_account: user.rapydVirtualAccountId,
      amount,
      currency,
      requested_currency: currency,
    };

    const { salt, timestamp, signature } = generateRapydSignature("post", path, body);

    const response = await axios.post(`${RAPYD_BASE_URL}${path}`, body, {
      headers: {
        "Content-Type": "application/json",
        access_key: RAPYD_ACCESS_KEY,
        salt,
        timestamp,
        signature,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Deposited successfully",
      data: response.data.data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to simulate deposit",
      error: error.response?.data || error.message,
    });
  }
};



// Helper: Get supported payout method type dynamically
async function getPayoutMethodType(country) {
  try {
    const path = `/v1/payout_methods/country?country=${country}`;
    const { salt, timestamp, signature } = generateRapydSignature("get", path);

    const response = await axios.get(`${RAPYD_BASE_URL}${path}`, {
      headers: {
        "Content-Type": "application/json",
        access_key: RAPYD_ACCESS_KEY,
        salt,
        timestamp,
        signature,
      },
    });

    // Return the first available payout method for that country
    if (response.data?.data?.length > 0) {
      return response.data.data[0].payout_method_type;
    }
    return null;
  } catch (error) {
    console.error(`⚠️ Failed to get payout methods for ${country}:`, error.response?.data || error.message);
    return null;
  }
}

export const externalBankTransfer = async (req, res) => {
  try {
    const { id } = req.user;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const { amount, currency, bankAccount, swiftCode, bankName, country } = req.body;

    const merchantReferenceId = `TXN-${Date.now()}`;
    const path = "/v1/payouts";

    const body = {
      beneficiary: {
        first_name: user.firstName || user.fullName?.split(" ")[0] || "John",
        last_name: user.lastName || user.fullName?.split(" ")[1] || "Doe",
        name: user.fullName || "John Doe",
        address: user.address || "123 Main Street",
        email: user.email,
        country: country,
        city: user.city || "Anytown",
        postcode: user.postalCode || "12345",
        account_number: bankAccount,
        bank_name: bankName || "test_bank",
        state: user.state || "NY",
        identification_type: "SSC",
        identification_value: "123456789",
        bic_swift: swiftCode,
        // ach_code: "123456789"
      },
      beneficiary_country: "SG", //  beneficiaryCountry,
      beneficiary_entity_type: "individual",
      description: "Bank transfer from user wallet",
      merchant_reference_id: merchantReferenceId,
      ewallet: user.rapydWalletId, // must be a valid Rapyd wallet ID (starts with 'ewallet_')
      payout_amount: amount,
      payout_currency: "SGD", // payoutCurrency,
      payout_method_type: "sg_ocbc_bank",  // payoutMethodType,
      sender: {
        name: user.fullName || "John Doe",
        address: user.address || "123 Main Street",
        city: user.city || "Anytown",
        state: user.state || "NY",
        date_of_birth: user.dob || "01/01/1990",
        postcode: user.postalCode || "12345",
        remitter_account_type: "Individual",
        source_of_income: "salary",
        identification_type: "Passport",
        identification_value: "A1234567",
        purpose_code: "personal_payment",
        account_number: "123456789",
        beneficiary_relationship: "self",
      },
      sender_country: "SG", // beneficiaryCountry,
      sender_currency: "SGD", // payoutCurrency,
      sender_entity_type: "individual",
      statement_descriptor: "Darimaids Transfer",
      metadata: {
        merchant_defined: true,
        userId: user._id,
      },
    };

    const { salt, timestamp, signature } = generateRapydSignature("post", path, body);

    const response = await axios.post(`${RAPYD_BASE_URL}${path}`, body, {
      headers: {
        "Content-Type": "application/json",
        access_key: RAPYD_ACCESS_KEY,
        salt,
        timestamp,
        signature,
      },
    });

    return res.status(200).json({
      success: true,
      message: "✅ Payout to external bank account initiated successfully",
      data: response.data.data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to send payout to bank account",
      error: error.response?.data || error.message,
    });
  }
};





export const enableRapydWallet = async (req, res, next) => {
  try {
    const accountPath = "/v1/user/enable";
    const accountBody = {
      // currency: "USD",
      // country,
      // description: `${first_name} ${last_name}'s Virtual Account`,
      ewallet: "ewallet_b4d3f6d3f164db068813519aecf1a52a",
    };

    const accountSignature = generateRapydSignature("put", accountPath, accountBody);

    const accountResponse = await axios.put(`${RAPYD_BASE_URL}${accountPath}`, accountBody, {
      headers: {
        "Content-Type": "application/json",
        access_key: RAPYD_ACCESS_KEY,
        salt: accountSignature.salt,
        idempotency: crypto.randomBytes(6).toString("hex"),
        timestamp: accountSignature.timestamp,
        signature: accountSignature.signature,
      },
    });

    const virtualAccount = accountResponse.data.data;
    return res.status(200).json({
      success: true,
      message: "Payment created successfully",
      payment: virtualAccount,
    })
  }catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create payment",
      error: error.response?.data || error.message,
    })
  }
}



export const getRapydWalletWithVirtualAccounts = async (req, res) => {
  try {
    const { id }= req.user;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    const walletPath = `/v1/user/${user.rapydWalletId}`;
    const walletSig = generateRapydSignature("get", walletPath);

    const walletResponse = await axios.get(`${RAPYD_BASE_URL}${walletPath}`, {
      headers: {
        "Content-Type": "application/json",
        access_key: RAPYD_ACCESS_KEY,
        salt: walletSig.salt,
        timestamp: walletSig.timestamp,
        signature: walletSig.signature,
      },
    });

    const walletData = walletResponse.data.data;

    // 2️⃣ Get Virtual Accounts Linked to Wallet
    const vaPath = `/v1/ewallets/${user.rapydWalletId}/virtual_accounts`;
    const vaSig = generateRapydSignature("get", vaPath);

    const virtualAccountResponse = await axios.get(`${RAPYD_BASE_URL}${vaPath}`, {
      headers: {
        "Content-Type": "application/json",
        access_key: RAPYD_ACCESS_KEY,
        salt: vaSig.salt,
        timestamp: vaSig.timestamp,
        signature: vaSig.signature,
      },
    });

    const virtualAccounts = virtualAccountResponse.data.data;

    // ✅ Response
    return res.status(200).json({
      success: true,
      message: "Wallet and virtual accounts retrieved successfully",
      wallet: walletData,
      virtualAccounts,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve wallet or virtual accounts",
      error: error.response?.data || error.message,
    });
  }
};







// ✅ Utility function to verify Rapyd HMAC signature
function verifyRapydSignature(req, secretKey) {
  const salt = req.headers["salt"];
  const timestamp = req.headers["timestamp"];
  const signature = req.headers["signature"];
  const accessKey = process.env.RAPYD_ACCESS_KEY;

  const body = JSON.stringify(req.body);
  const toSign = accessKey + salt + timestamp + body;
  const hmac = crypto.createHmac("sha256", secretKey);
  hmac.update(toSign);
  const hash = hmac.digest("hex");
  const computedSignature = Buffer.from(hash).toString("base64");

  return signature === computedSignature;
}

// ✅ Webhook endpoint
export const rapydWebhook = async (req, res, next) => {
  try {
    const isVerified = verifyRapydSignature(req, process.env.RAPYD_SECRET_KEY);
    if (!isVerified) {
      return res.status(401).json({ success: false, message: "Invalid signature" });
    }

    const event = req.body;

    console.log("📩 Rapyd Webhook Event Received:", event.type);

    switch (event.type) {
      case "wallet.transaction.created":
        console.log("💸 Wallet Transaction Created:", event.data);
        // Handle wallet debit/credit event
        break;

      case "payment.completed":
        console.log("✅ Payment Completed:", event.data);
        // Update your database to mark the payment as successful
        break;

      case "issuing.bankaccounts.created":
        console.log("🏦 Virtual Bank Account Created:", event.data);
        // Store the new virtual account info in your DB
        break;

      case "issuing.bankaccounts.updated":
        console.log("🔄 Virtual Account Updated:", event.data);
        break;

      case "payout.completed":
        console.log("💰 Payout Completed:", event.data);
        // Update user balance after payout
        break;

      default:
        console.log("📦 Unhandled Event:", event.type);
        break;
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("⚠️ Webhook Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
