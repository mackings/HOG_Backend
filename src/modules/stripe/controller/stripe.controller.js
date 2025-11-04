import Stripe from 'stripe';
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});


export const createUserAccount = async (req, res, next) => {
  try {
    const {
      email,
      first_name,
      last_name,
      phone,
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      country,
      day,
      month,
      year,
    } = req.body;

    // ✅ Create Connected Account
    const account = await stripe.accounts.create({
      type: "custom",
      country: country || "US",
      business_type: "individual",
      email,
      capabilities: {
        treasury: { requested: true },
        transfers: { requested: true },
        card_payments: { requested: true },
      },
      individual: {
        email,
        first_name,
        last_name,
        phone,
        address: {
          line1: address_line1 || "23 Baker Street",
          city,
          state,
          postal_code,
          country,
        },
        dob: {
          day: Number(day),
          month: Number(month),
          year: Number(year),
        },
      },
      tos_acceptance: {
        date: Math.floor(Date.now() / 1000),
        ip: req.ip || "127.0.0.1",
      },
    });

    // ✅ Create Treasury Financial Account
    const financialAccount = await stripe.treasury.financialAccounts.create(
      {
        supported_currencies: ["usd"],
        features: {
          deposit_insurance: { requested: true },
          inbound_transfers: { ach: { requested: true } },
          outbound_payments: { ach: { requested: true } },
          intra_stripe_flows: { requested: true },
        },
      },
      { stripeAccount: account.id }
    );

    // ✅ Retrieve the Financial Account to get the ABA/ACH address
    const retrievedAccount = await stripe.treasury.financialAccounts.retrieve(
      financialAccount.id,
      { stripeAccount: account.id }
    );

    // This contains the account number & routing info
    const addresses = retrievedAccount.financial_addresses;

    return res.status(200).json({
      success: true,
      // account,
      // financialAccount,
      retrievedAccount,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};



export const accountSetup = async (req, res, next) => {
  try {
    const account = await stripe.accounts.create({
      country: 'US',
      email: 'jenny.rosen@example.com',
      controller: {
        fees: {
          payer: 'application',
        },
        losses: {
          payments: 'application',
        },
        stripe_dashboard: {
          type: 'express',
        },
      },
  });
    return res.status(200).json({ success: true, account });
  } catch (error) {
    return next(error);
  }
};


// 1️⃣ Create a user “virtual wallet” using Stripe Connect
export const createVirtualWallet = async (req, res, next) => {
  try {
    const { email, first_name, last_name } = req.body;

    // Create a connected account (wallet holder)
    const account = await stripe.accounts.create({
      type: "express", // or "custom" if you manage onboarding
      country: "US",
      email,
      business_type: "individual",
      individual: {
        first_name,
        last_name,
        email,
      },
      capabilities: {
        transfers: { requested: true },
      },
    });

    // You can store account.id as the user’s "walletId"
    return res.status(200).json({
      success: true,
      message: "Virtual wallet created successfully",
      walletId: account.id,
    });
  } catch (error) {
    return next(error);
  }
};





export const createVirtualAccount = async (req, res, next) => {
  try {
    const { email, first_name, last_name } = req.body;

    // 1️⃣ Create a connected account (the wallet holder)
    const account = await stripe.accounts.create({
      type: 'custom',
      country: 'US',
      email,
      business_type: 'individual',
      individual: {
        first_name,
        last_name,
        email,
      },
      capabilities: {
        transfers: { requested: true },
        treasury: { requested: true }, // 👈 must be requested explicitly
        card_payments: { requested: true },
      },
      tos_acceptance: {
        date: Math.floor(Date.now() / 1000),
        ip:
          req.headers['x-forwarded-for'] ||
          req.connection.remoteAddress ||
          '127.0.0.1',
      },
    });

    console.log('Connected Account Created:', account.id);

    // 2️⃣ Create a Financial Account (virtual wallet)
    // const financialAccount = await stripe.treasury.financialAccounts.create(
    //   {
    //     supported_currencies: ['usd'],
    //     features: {
    //       // card_issuing: { requested: true },
    //       deposit_insurance: { requested: true },
    //       inbound_transfers: { ach: { requested: true } },
    //       outbound_payments: { ach: { requested: true } },
    //       intra_stripe_flows: { requested: true },
    //     },
    //     metadata: { user_email: email },
    //   },
    //   { stripeAccount: account.id } // 👈 This is how you link it to the connected account
    // );

    
    const accountSession = await stripe.accountSessions.create({
      account: account.id,
      components: {
        financial_account: {
          enabled: true,
          features: {
            send_money: true,
            transfer_balance: true,
            external_account_collection: true,
          },
        },
      },
    });

    console.log('Financial Account Created:', accountSession.id);

    // // 3️⃣ Create a virtual account number (for inbound transfers)
    // const virtualAccountNumber = await stripe.treasury.financialAccounts.retrieveFeatures(
    //   accountSession.id,
    //   { stripeAccount: account.id }
    // );

    return res.status(200).json({
      success: true,
      account,
      accountSession,
      // virtualAccountNumber,
    });
  } catch (error) {
    return next(error);
  }
};

