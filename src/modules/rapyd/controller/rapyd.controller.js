import axios from "axios";
import crypto from "crypto";

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
    const { first_name, last_name, email, phone_number, country = "US" } = req.body;

    // 1️⃣ Create Wallet
    const walletPath = "/v1/ewallets";
    const walletBody = {
      first_name,
      last_name,
      email,
      phone_number,
      country,
      contact: {
        phone: {
          country_code: "1",
          number: "1234567890",
        },
        country
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

    // 2️⃣ Create Virtual Bank Account (USD)
    const accountPath = "/v1/issuing/bankaccounts"; // virtual_accounts
    const accountBody = {
      currency: "USD",
      country,
      description: `${first_name} ${last_name}'s Virtual Account`,
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

    return res.status(200).json({
      success: true,
      message: "Wallet and virtual account created successfully",
      wallet,
      virtualAccount,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create wallet or virtual account",
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
