/**
 * Payment flow simulation
 * Tests: login → material → review → payment init → webhook → wallet credit
 * Accounts: Nigerian buyer + designer accounts
 */

import crypto from "crypto";
import Stripe from "stripe";

const BASE = "http://localhost:8800/api/v1";
const BUYER_EMAIL    = "newuser@daouse.com";
const DESIGNER_EMAIL = "newdesigner@daouse.com";
const PASSWORD       = "Kk76117018@";

import dotenv from "@dotenvx/dotenvx";
dotenv.config();

const PAYSTACK_SECRET       = process.env.PAYSTACK_MAIN_KEY?.trim();
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_SECRET_KEY     = process.env.STRIPE_SECRET_KEY;

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

// ── Helpers ─────────────────────────────────────────────────────────────────

const api = async (method, path, body, token) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : {} };
};

const ok = (label, res, expected = [200, 201]) => {
  const codes = Array.isArray(expected) ? expected : [expected];
  if (!codes.includes(res.status)) {
    console.error(`❌ ${label}: got ${res.status}`, JSON.stringify(res.data, null, 2));
    process.exit(1);
  }
  console.log(`✅ ${label} (${res.status})`);
  return res.data;
};

const sep = (title) => console.log(`\n${"─".repeat(60)}\n  ${title}\n${"─".repeat(60)}`);

// ── Step 1: Login both accounts ──────────────────────────────────────────────
sep("STEP 1 — Login");

const buyerLogin = await api("POST", "/user/login", { email: BUYER_EMAIL, password: PASSWORD });
const buyerData  = ok("Buyer login", buyerLogin);
const BUYER_TOKEN  = buyerData.token || buyerData.data?.token;
const buyerUser    = buyerData.user || buyerData.data?.user;
console.log(`   Buyer: ${buyerUser?.fullName} | Country: ${buyerUser?.country} | Wallet NGN: ₦${buyerUser?.wallet} | Wallet USD: $${buyerUser?.walletUSD ?? 0}`);

const designerLogin = await api("POST", "/user/login", { email: DESIGNER_EMAIL, password: PASSWORD });
const designerData  = ok("Designer login", designerLogin);
const DESIGNER_TOKEN = designerData.token || designerData.data?.token;
const designerUser   = designerData.user || designerData.data?.user;
console.log(`   Designer: ${designerUser?.fullName} | Country: ${designerUser?.country} | Wallet NGN: ₦${designerUser?.wallet} | Wallet USD: $${designerUser?.walletUSD ?? 0}`);

// ── Step 2: Use buyer's existing material ─────────────────────────────────────
sep("STEP 2 — Get buyer's existing material");
// Using buyer's own materials fetched from review endpoint (returns userId-filtered materials)
const matsRes = await api("GET", "/review/getAllMaterialsForReview", null, BUYER_TOKEN);
ok("Get buyer materials", matsRes);
const allMats = matsRes.data?.materials || matsRes.data?.data || matsRes.data || [];
const material = Array.isArray(allMats) ? allMats.find(m => !m.isDelivered) || allMats[0] : null;
if (!material) { console.error("No materials found for buyer"); process.exit(1); }
console.log(`   Material ID: ${material._id} | ${material.attireType} - ${material.clothMaterial}`);

// ── Step 4: Get vendor profile for designer ───────────────────────────────────
sep("STEP 4 — Get designer vendor profile");
const vendorRes = await api("GET", "/tailor/getTailor", null, DESIGNER_TOKEN);
ok("Get vendor profile", vendorRes);
const vendor = vendorRes.data?.vendor || vendorRes.data?.data || vendorRes.data?.tailor || vendorRes.data;
console.log(`   Vendor ID: ${vendor?._id} | Business: ${vendor?.businessName}`);

// ── Step 5: Designer creates quotation ───────────────────────────────────────
sep("STEP 5 — Designer creates quotation (review)");
const reviewRes = await api("POST", `/review/createReview/${material._id}`, {
  comment: "Simulation test quotation",
  materialTotalCost: 5000,
  workmanshipTotalCost: 10000,
  deliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  reminderDate: new Date(Date.now() + 7  * 24 * 60 * 60 * 1000).toISOString(),
}, DESIGNER_TOKEN);
const reviewData = ok("Create review/quotation", reviewRes);
const review = reviewData.review || reviewData.data?.review || reviewData.data;
console.log(`   Review ID: ${review?._id}`);
console.log(`   SubTotal: ₦${review?.subTotalCost}`);
console.log(`   Tax (10%): ₦${review?.tax}`);
console.log(`   Commission (${review?.commission / review?.subTotalCost * 100 || 0}%): ₦${review?.commission}`);
console.log(`   Buyer pays: ₦${review?.totalCost}`);

// ── Step 6: Determine payment method by country ───────────────────────────────
sep("STEP 6 — Determine payment route");
const buyerCountry   = (buyerUser?.country || "").toUpperCase().trim();
const designerCountry = (designerUser?.country || "").toUpperCase().trim();
const intlCountries  = ["UNITED STATES","US","USA","UNITED KINGDOM","UK","GB"];
const isIntlDesigner = intlCountries.includes(designerCountry);
const isIntlBuyer    = intlCountries.includes(buyerCountry);
const useStripe      = isIntlDesigner || isIntlBuyer;
console.log(`   Buyer country: ${buyerCountry} (${isIntlBuyer ? "International" : "Nigerian"})`);
console.log(`   Designer country: ${designerCountry} (${isIntlDesigner ? "International" : "Nigerian"})`);
console.log(`   Payment provider: ${useStripe ? "STRIPE (USD)" : "PAYSTACK (NGN)"}`);

// ── Step 7: Initiate payment ──────────────────────────────────────────────────
sep("STEP 7 — Initiate payment");

let paymentRef, sessionId, orderAmountPaidNGN, orderAmountPaidUSD, orderId, payData;

if (useStripe) {
  const payRes = await api("POST", `/stripe/make-payment/${review._id}`, {
    paymentStatus: "full payment",
    shipmentMethod: "regular",
    address: "123 Test Street, Lagos, Nigeria",
  }, BUYER_TOKEN);
  payData = ok("Create Stripe checkout", payRes, [200, 201]);
  const order   = payData.data?.order;
  paymentRef        = order?.paymentReference;
  sessionId         = order?.sessionId;   // now returned in response after save
  orderId           = order?._id;
  orderAmountPaidNGN = order?.amountPaid;
  orderAmountPaidUSD = order?.amountPaidUSD;
  console.log(`   Checkout URL: ${payData.data?.checkoutUrl}`);
  console.log(`   Payment reference: ${paymentRef}`);
  console.log(`   Stripe session ID: ${sessionId}`);
  console.log(`   Amount (NGN): ₦${orderAmountPaidNGN}`);
  console.log(`   Amount (USD): $${orderAmountPaidUSD}`);
  console.log(`   Breakdown:`, JSON.stringify(payData.data?.breakdown, null, 4));
} else {
  const payRes = await api("POST", `/material/createPaymentOnline/${review._id}`, {
    paymentStatus: "full payment",
    shipmentMethod: "regular",
    address: "123 Test Street, Lagos, Nigeria",
  }, BUYER_TOKEN);
  const payData = ok("Create Paystack payment", payRes, [200, 201]);
  const order   = payData.data?.order || payData.order;
  paymentRef        = order?.paymentReference;
  orderId           = order?._id;
  orderAmountPaidNGN = order?.amountPaid;
  console.log(`   Authorization URL: ${payData.data?.authorizationUrl || payData.authorizationUrl}`);
  console.log(`   Payment reference: ${paymentRef}`);
  console.log(`   Amount (NGN): ₦${orderAmountPaidNGN}`);
}

// ── Step 8: Snapshot balances before webhook ─────────────────────────────────
sep("STEP 8 — Wallet balances BEFORE webhook");

const beforeBuyer    = await api("GET", "/user/getProfile", null, BUYER_TOKEN);
const beforeDesigner = await api("GET", "/user/getProfile", null, DESIGNER_TOKEN);
const bBuyer    = beforeBuyer.data?.user || beforeBuyer.user || beforeBuyer.data;
const bDesigner = beforeDesigner.data?.user || beforeDesigner.user || beforeDesigner.data;

console.log(`   Buyer    wallet NGN: ₦${bBuyer?.wallet}   USD: $${bBuyer?.walletUSD ?? 0}`);
console.log(`   Designer wallet NGN: ₦${bDesigner?.wallet}   USD: $${bDesigner?.walletUSD ?? 0}`);

// ── Step 9: Fire webhook ──────────────────────────────────────────────────────
sep("STEP 9 — Fire payment webhook");

if (useStripe) {
  // Build a real Stripe checkout.session.completed event payload
  // totalCostUSD = product + delivery — must match what Stripe actually charged
  const totalUSD    = Number(payData.data?.breakdown?.total || orderAmountPaidUSD || 0);
  const amountCents = Math.round(totalUSD * 100);

  const eventPayload = {
    id: `evt_sim_${Date.now()}`,
    type: "checkout.session.completed",
    data: {
      object: {
        id: sessionId,
        object: "checkout.session",
        payment_status: "paid",
        currency: "usd",
        amount_total: amountCents,
        metadata: {
          reference: paymentRef,
          productCostUSD: String(orderAmountPaidUSD || 0),
          deliveryFeeUSD: "0",
          totalCostUSD: String(totalUSD),
          deliveryType: "Regular",
        },
      },
    },
    created: Math.floor(Date.now() / 1000),
  };

  const rawBody  = JSON.stringify(eventPayload);
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${rawBody}`;
  const sig = crypto.createHmac("sha256", STRIPE_WEBHOOK_SECRET).update(signedPayload).digest("hex");
  const stripeSignature = `t=${timestamp},v1=${sig}`;

  const whRes = await fetch(`${BASE.replace("/api/v1", "")}/api/v1/stripe/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": stripeSignature,
    },
    body: rawBody,
  });
  const whText = await whRes.text();
  console.log(`   Stripe webhook status: ${whRes.status}`);
  console.log(`   Response: ${whText}`);
} else {
  // Build Paystack charge.success event and sign it
  const eventPayload = {
    event: "charge.success",
    data: {
      reference: paymentRef,
      amount: Math.round((orderAmountPaidNGN || 0) * 100),
      status: "success",
      currency: "NGN",
      metadata: {},
      authorization: {},
    },
  };

  const rawBody = JSON.stringify(eventPayload);
  const sig     = crypto.createHmac("sha512", PAYSTACK_SECRET.trim()).update(rawBody).digest("hex");

  const whRes = await fetch(`${BASE}/material/orderWebhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-paystack-signature": sig,
    },
    body: rawBody,
  });
  const whText = await whRes.text();
  console.log(`   Paystack webhook status: ${whRes.status}`);
  console.log(`   Response: ${whText}`);
}

// ── Step 10: Snapshot balances after webhook ──────────────────────────────────
sep("STEP 10 — Wallet balances AFTER webhook");
await new Promise(r => setTimeout(r, 1500));

const afterBuyer    = await api("GET", "/user/profile", null, BUYER_TOKEN);
const afterDesigner = await api("GET", "/user/profile", null, DESIGNER_TOKEN);
const aBuyer    = afterBuyer.data?.user || afterBuyer.user || afterBuyer.data;
const aDesigner = afterDesigner.data?.user || afterDesigner.user || afterDesigner.data;

console.log(`   Buyer    wallet NGN: ₦${aBuyer?.wallet}   USD: $${aBuyer?.walletUSD ?? 0}`);
console.log(`   Designer wallet NGN: ₦${aDesigner?.wallet}   USD: $${aDesigner?.walletUSD ?? 0}`);

console.log(`\n${"═".repeat(60)}`);
console.log("  SIMULATION COMPLETE");
console.log(`${"═".repeat(60)}`);
console.log(`  Review subTotal:   ₦${review?.subTotalCost}`);
console.log(`  Platform fee (tax+comm): ₦${(review?.tax || 0) + (review?.commission || 0)}`);
console.log(`  Designer NGN credit delta: ₦${(aDesigner?.wallet || 0) - (bDesigner?.wallet || 0)}`);
console.log(`  Designer USD credit delta: $${((aDesigner?.walletUSD || 0) - (bDesigner?.walletUSD || 0)).toFixed(4)}`);
console.log(`${"═".repeat(60)}\n`);
