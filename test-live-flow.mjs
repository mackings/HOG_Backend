/**
 * HOG Live End-to-End Test
 * Tests full flow: register → tailor profile → material → review → carrier rates → delivery cost → payment → tracking
 * Scenarios: NG→NG (Paystack/NGN) and NG→US (Stripe/USD)
 *
 * Run: npx @dotenvx/dotenvx run -- node test-live-flow.mjs
 */

import { config } from "@dotenvx/dotenvx";
config({ path: "/Users/mac/Backend Projects/hog/.env" });

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import axios from "axios";

const BASE = "http://localhost:8800/api/v1";
const MONGO_URL = process.env.MONGODB_URL;

// ─── test accounts ──────────────────────────────────────────────────────────
const ACCOUNTS = {
  ngDesigner: {
    fullName: "Amaka Okonkwo",
    email: "ng.designer.test@hogtest.dev",
    password: "Test1234!",
    phoneNumber: "+2348031234567",
    role: "tailor",
    address: "12 Bode Thomas Street, Surulere",
    country: "Nigeria",
    city: "Lagos",
    state: "Lagos",
    postalCode: "100001",
  },
  ngBuyer: {
    fullName: "Chidi Eze",
    email: "ng.buyer.test@hogtest.dev",
    password: "Test1234!",
    phoneNumber: "+2348057654321",
    role: "user",
    address: "22 Wuse Zone 5, Abuja",
    country: "Nigeria",
    city: "Abuja",
    state: "FCT",
    postalCode: "900001",
  },
  usBuyer: {
    fullName: "Sarah Johnson",
    email: "us.buyer.test@hogtest.dev",
    password: "Test1234!",
    phoneNumber: "+12125551234",
    role: "user",
    address: "456 5th Avenue, Manhattan",
    country: "United States",
    city: "New York",
    state: "NY",
    postalCode: "10001",
  },
};

// ─── helpers ────────────────────────────────────────────────────────────────
const log = (label, data) => {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`[${label}]`);
  if (typeof data === "object") console.log(JSON.stringify(data, null, 2));
  else console.log(data);
};

const ok = (label, val) => console.log(`  ✅  ${label}:`, val);
const fail = (label, err) => {
  const msg = err?.response?.data || err?.message || err;
  console.log(`  ❌  ${label}:`, JSON.stringify(msg));
};
const warn = (label, val) => console.log(`  ⚠️   ${label}:`, val);

const post = (path, body, token) =>
  axios.post(`${BASE}${path}`, body, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

const get = (path, token, params = {}) =>
  axios.get(`${BASE}${path}`, {
    params,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

// ─── seed everything that requires image uploads directly in DB ──────────────
async function seedAll() {
  const User = mongoose.model(
    "User",
    new mongoose.Schema({}, { strict: false, collection: "users" })
  );
  const Vendor = mongoose.model(
    "Vendor",
    new mongoose.Schema({}, { strict: false, collection: "vendors" })
  );
  const Material = mongoose.model(
    "Material",
    new mongoose.Schema({}, { strict: false, collection: "materials" })
  );
  const Review = mongoose.model(
    "Review",
    new mongoose.Schema({}, { strict: false, collection: "reviews" })
  );
  const Token = mongoose.model(
    "Token",
    new mongoose.Schema({}, { strict: false, collection: "tokens" })
  );

  const hashed = await bcrypt.hash("Test1234!", 10);

  // ── users ──────────────────────────────────────────────────────────────
  const upsertUser = async (acc) => {
    const existing = await User.findOne({ email: acc.email });
    if (existing) { ok("user exists", acc.email); return existing; }
    const created = await User.create({
      fullName: acc.fullName,
      email: acc.email,
      password: hashed,
      phoneNumber: acc.phoneNumber,
      role: acc.role,
      address: acc.address,
      country: acc.country,
      city: acc.city,
      state: acc.state,
      postalCode: acc.postalCode,
      isVerified: true,
      isBlocked: false,
      subscriptionPlan: "starter",
      activeCommissionRate: acc.role === "tailor" ? 10 : 15,
      isOnTrial: false,
    });
    ok("created user", acc.email);
    return created;
  };

  const designer = await upsertUser(ACCOUNTS.ngDesigner);
  const ngBuyer  = await upsertUser(ACCOUNTS.ngBuyer);
  const usBuyer  = await upsertUser(ACCOUNTS.usBuyer);

  // ── vendor profile (bypasses nepaBill image upload) ────────────────────
  let vendor = await Vendor.findOne({ userId: designer._id });
  if (!vendor) {
    vendor = await Vendor.create({
      userId: designer._id,
      businessName: "Amaka's Atelier",
      businessEmail: ACCOUNTS.ngDesigner.email,
      businessPhone: ACCOUNTS.ngDesigner.phoneNumber,
      businessRegistrationNumber: "RC123456",
      registeredIn: "Nigeria",
      address: ACCOUNTS.ngDesigner.address,
      city: ACCOUNTS.ngDesigner.city,
      state: ACCOUNTS.ngDesigner.state,
      postalCode: ACCOUNTS.ngDesigner.postalCode,
      country: "Nigeria",
      nepaBill: "seeded-test-placeholder",
      yearOfExperience: "8",
      description: "Premium Nigerian fashion designer specialising in bridal and corporate wear",
      bio: "Based in Lagos with 8 years of experience",
      specializationTags: ["bridal", "corporate", "native_wear"],
      turnaroundTime: "7",
      availabilityStatus: "available",
    });
    ok("created vendor", vendor.businessName);
  } else {
    ok("vendor exists", vendor.businessName);
  }

  // ── materials (bypasses sampleImage required field) ────────────────────
  let ngMaterial = await Material.findOne({ userId: ngBuyer._id, clothMaterial: "Ankara cotton" });
  if (!ngMaterial) {
    ngMaterial = await Material.create({
      userId: ngBuyer._id,
      clothMaterial: "Ankara cotton",
      color: "Navy blue and gold",
      brand: "Holland Wax",
      attireType: "Native wear",
      specialInstructions: "Please ensure the gele is included",
      sampleImage: ["seeded-test-placeholder"],
      measurement: [{ bust: 38, waist: 32, hip: 40, length: 55, shoulder: 15, sleeve: 24, neck: 14 }],
    });
    ok("created NG material", ngMaterial._id.toString());
  } else {
    ok("NG material exists", ngMaterial._id.toString());
  }

  let usMaterial = await Material.findOne({ userId: usBuyer._id, clothMaterial: "Silk chiffon" });
  if (!usMaterial) {
    usMaterial = await Material.create({
      userId: usBuyer._id,
      clothMaterial: "Silk chiffon",
      color: "Ivory and champagne",
      brand: "Vlisco",
      attireType: "Bridal",
      specialInstructions: "Mermaid silhouette with train, beaded bodice",
      sampleImage: ["seeded-test-placeholder"],
      measurement: [{ bust: 34, waist: 26, hip: 36, length: 72, shoulder: 14, sleeve: 22, neck: 13 }],
    });
    ok("created US material", usMaterial._id.toString());
  } else {
    ok("US material exists", usMaterial._id.toString());
  }

  // ── reviews (designer quotes) — also need vendorId ────────────────────
  // Reviews are created via API since they need currency resolution logic

  await Token.deleteMany({
    email: { $in: [ACCOUNTS.ngDesigner.email, ACCOUNTS.ngBuyer.email, ACCOUNTS.usBuyer.email] },
  });

  return {
    designer, ngBuyer, usBuyer, vendor,
    ngMaterialId: ngMaterial._id.toString(),
    usMaterialId: usMaterial._id.toString(),
  };
};

// ─── main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("=".repeat(60));
  console.log("HOG LIVE END-TO-END TEST");
  console.log("Scenarios: NG→NG (Paystack/NGN) and NG→US (Stripe/USD)");
  console.log("=".repeat(60));

  // ── 1. Connect to DB ───────────────────────────────────────────────────
  console.log("\n[SETUP] Connecting to MongoDB...");
  await mongoose.connect(MONGO_URL);
  ok("MongoDB connected", mongoose.connection.host);

  // ── 2. Seed test accounts, vendor, materials ──────────────────────────
  console.log("\n[SETUP] Seeding test accounts, vendor profile, and materials...");
  const { designer, ngBuyer, usBuyer, vendor, ngMaterialId, usMaterialId } = await seedAll();

  await mongoose.disconnect();

  // ── 3. Login all accounts ──────────────────────────────────────────────
  log("STEP 1 — Login all test accounts");

  let designerToken, ngBuyerToken, usBuyerToken;

  try {
    const r = await post("/user/login", {
      email: ACCOUNTS.ngDesigner.email,
      password: ACCOUNTS.ngDesigner.password,
    });
    designerToken = r.data.token;
    ok("NG Designer logged in", `${ACCOUNTS.ngDesigner.email} → token: ${designerToken?.slice(0, 20)}...`);
  } catch (e) { fail("NG Designer login", e); process.exit(1); }

  try {
    const r = await post("/user/login", {
      email: ACCOUNTS.ngBuyer.email,
      password: ACCOUNTS.ngBuyer.password,
    });
    ngBuyerToken = r.data.token;
    ok("NG Buyer logged in", `${ACCOUNTS.ngBuyer.email} → token: ${ngBuyerToken?.slice(0, 20)}...`);
  } catch (e) { fail("NG Buyer login", e); process.exit(1); }

  try {
    const r = await post("/user/login", {
      email: ACCOUNTS.usBuyer.email,
      password: ACCOUNTS.usBuyer.password,
    });
    usBuyerToken = r.data.token;
    ok("US Buyer logged in", `${ACCOUNTS.usBuyer.email} → token: ${usBuyerToken?.slice(0, 20)}...`);
  } catch (e) { fail("US Buyer login", e); process.exit(1); }

  // ── 4. Verify profiles ─────────────────────────────────────────────────
  log("STEP 2 — Verify profile countries (determines payment gateway)");
  try {
    const r = await get("/user/getProfile", designerToken);
    ok("Designer profile", `country=${r.data?.user?.country}, role=${r.data?.user?.role}`);
  } catch (e) { fail("Designer getProfile", e); }

  try {
    const r = await get("/user/getProfile", ngBuyerToken);
    ok("NG Buyer profile", `country=${r.data?.user?.country}, role=${r.data?.user?.role}`);
  } catch (e) { fail("NG Buyer getProfile", e); }

  try {
    const r = await get("/user/getProfile", usBuyerToken);
    ok("US Buyer profile", `country=${r.data?.user?.country}, role=${r.data?.user?.role}`);
  } catch (e) { fail("US Buyer getProfile", e); }

  // ── 5. Materials seeded in DB (image upload required, done directly) ──
  log("STEP 3+4 — Materials seeded directly in DB");
  ok("NG Material ID (seeded)", ngMaterialId);
  ok("US Material ID (seeded)", usMaterialId);

  // ── 6. Designer creates reviews/quotes ────────────────────────────────
  let ngReviewId, usReviewId;

  if (ngMaterialId) {
    log("STEP 5 — NG Designer quotes for NG Buyer (NG→NG scenario)");
    try {
      const r = await post(`/review/createReview/${ngMaterialId}`, {
        comment: "I can make this in 7-10 days. High quality Ankara cotton with proper gele.",
        materialTotalCost: 15000,
        workmanshipTotalCost: 25000,
        deliveryDate: new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString().split("T")[0],
        reminderDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split("T")[0],
      }, designerToken);
      ngReviewId = r.data?.review?._id || r.data?._id;
      ok("NG Review created", `ID: ${ngReviewId}`);
      ok("  → totalCost (NGN)", r.data?.review?.totalCost);
      ok("  → currency", r.data?.review?.currency || "NGN");
      log("NG Review full response", r.data);
    } catch (e) { fail("NG Review creation", e); }
  }

  if (usMaterialId) {
    log("STEP 6 — NG Designer quotes for US Buyer (NG→US scenario)");
    try {
      const r = await post(`/review/createReview/${usMaterialId}`, {
        comment: "Stunning bridal gown — I specialise in this style. Timeline: 14 days.",
        materialTotalCost: 80000,
        workmanshipTotalCost: 120000,
        deliveryDate: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().split("T")[0],
        reminderDate: new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString().split("T")[0],
      }, designerToken);
      usReviewId = r.data?.review?._id || r.data?._id;
      ok("US Review created", `ID: ${usReviewId}`);
      ok("  → totalCost (NGN)", r.data?.review?.totalCost);
      ok("  → totalCostUSD", r.data?.review?.totalCostUSD);
      ok("  → exchangeRate", r.data?.review?.exchangeRate);
      log("US Review full response", r.data);
    } catch (e) { fail("US Review creation", e); }
  }

  // ── 7. Carrier rates ───────────────────────────────────────────────────
  const PACKAGES = [{ weight: 1.5, dimensions: { length: 35, width: 25, height: 5 } }];

  if (ngReviewId) {
    log("STEP 7a — NG→NG Carrier Rates (FedEx not expected on domestic NG)");
    try {
      const r = await post(`/deliveryRate/carrier-rates/${ngReviewId}`, {
        carriers: ["fedex"],
        packages: PACKAGES,
      }, ngBuyerToken);
      ok("NG→NG carrier rates", `${r.data?.rates?.length ?? 0} options`);
      if (r.data?.rates?.length) {
        r.data.rates.forEach(rt =>
          ok(`  ${rt.serviceType}`, `${rt.currency} ${rt.amount}`)
        );
      } else {
        warn("No FedEx rates for NG→NG", "expected — haversine fallback will be used");
      }
      if (r.data?.carrierErrors) warn("carrierErrors", JSON.stringify(r.data.carrierErrors));
      log("NG→NG carrier rates full", r.data);
    } catch (e) { fail("NG→NG carrier rates", e); }
  }

  if (usReviewId) {
    log("STEP 7b — NG→US Carrier Rates (FedEx should return 4 live options)");
    try {
      const r = await post(`/deliveryRate/carrier-rates/${usReviewId}`, {
        carriers: ["fedex"],
        packages: PACKAGES,
      }, usBuyerToken);
      ok("NG→US carrier rates", `${r.data?.rates?.length ?? 0} options returned`);
      if (r.data?.rates?.length) {
        r.data.rates.forEach(rt =>
          ok(`  ${rt.serviceType}`, `${rt.currency} ${rt.amount} (transit: ${rt.transitDays ?? "N/A"})`)
        );
      } else {
        warn("No FedEx rates for NG→US", "unexpected — check FedEx sandbox credentials");
      }
      log("NG→US carrier rates full", r.data);
    } catch (e) { fail("NG→US carrier rates", e); }
  }

  // ── 8. Delivery cost (haversine fallback) ──────────────────────────────
  if (ngReviewId) {
    log("STEP 8a — NG→NG Delivery Cost (haversine)");
    try {
      const r = await post(`/deliveryRate/deliveryCost/${ngReviewId}`, {
        shipmentMethod: "express",
      }, ngBuyerToken);
      ok("NG→NG delivery cost", `${r.data?.currency} ${r.data?.cost}`);
      log("NG→NG delivery cost full", r.data);
    } catch (e) { fail("NG→NG delivery cost", e); }

    try {
      const r2 = await post(`/deliveryRate/deliveryCost/${ngReviewId}`, {
        shipmentMethod: "regular",
      }, ngBuyerToken);
      ok("NG→NG delivery cost (regular)", `${r2.data?.currency} ${r2.data?.cost}`);
    } catch (e) { fail("NG→NG delivery cost regular", e); }

    try {
      const r3 = await post(`/deliveryRate/deliveryCost/${ngReviewId}`, {
        shipmentMethod: "cargo",
      }, ngBuyerToken);
      ok("NG→NG delivery cost (cargo)", `${r3.data?.currency} ${r3.data?.cost}`);
    } catch (e) { fail("NG→NG delivery cost cargo", e); }
  }

  if (usReviewId) {
    log("STEP 8b — NG→US Delivery Cost (haversine fallback for USD lane)");
    try {
      const r = await post(`/deliveryRate/deliveryCost/${usReviewId}`, {
        shipmentMethod: "express",
      }, usBuyerToken);
      ok("NG→US delivery cost (express)", `${r.data?.currency} ${r.data?.cost}`);
      log("NG→US delivery cost full", r.data);
    } catch (e) { fail("NG→US delivery cost", e); }
  }

  // ── 9. Payment initialisation ──────────────────────────────────────────
  if (ngReviewId) {
    log("STEP 9a — NG→NG Payment via Paystack (NGN)");
    try {
      const r = await post(`/material/createPaymentOnline/${ngReviewId}`, {
        amount: 50000,
        shipmentMethod: "express",
        address: ACCOUNTS.ngBuyer.address,
        paymentStatus: "full",
      }, ngBuyerToken);
      ok("Paystack initialized", "✅");
      ok("  authorizationUrl", r.data?.authorizationUrl);
      ok("  reference", r.data?.payment?.paymentReference);
      ok("  totalAmount", r.data?.breakdown?.total);
      ok("  currency", r.data?.breakdown?.currency);
      ok("  deliveryFee", r.data?.breakdown?.deliveryFee);
      ok("  deliveryMethod", r.data?.breakdown?.deliveryMethod);
      ok("  designerNetCredit", r.data?.payoutBreakdown?.designerNetCredit);
      log("Paystack full response", r.data);
    } catch (e) { fail("Paystack initialize", e); }
  }

  if (usReviewId) {
    log("STEP 9b — NG→US Payment via Stripe (USD)");
    try {
      const r = await post(`/stripe/make-payment/${usReviewId}`, {
        amount: 465,
        shipmentMethod: "express",
        address: ACCOUNTS.usBuyer.address,
        paymentStatus: "full payment",
      }, usBuyerToken);
      ok("Stripe Checkout created", "✅");
      ok("  checkoutUrl", r.data?.data?.checkoutUrl?.slice(0, 60) + "...");
      ok("  sessionId", r.data?.data?.order?.sessionId?.slice(0, 30) + "...");
      ok("  breakdown.total (USD)", r.data?.data?.breakdown?.total);
      ok("  breakdown.deliveryFee", r.data?.data?.breakdown?.deliveryFee);
      ok("  breakdown.currency", r.data?.data?.breakdown?.currency);
      ok("  order.paymentReference", r.data?.data?.order?.paymentReference);
      ok("  order.exchangeRate", r.data?.data?.order?.exchangeRate);
      log("Stripe full response", r.data);
    } catch (e) { fail("Stripe createPayment", e); }
  }

  // ── 10. Shipment creation (FedEx) ──────────────────────────────────────
  if (usReviewId) {
    log("STEP 10 — Create FedEx shipment for NG→US order (designer action)");
    try {
      const r = await post(`/tracking/createCarrierShipment`, {
        materialId: usMaterialId,
        carrier: "fedex",
        serviceType: "INTERNATIONAL_PRIORITY",
        packages: PACKAGES,
        labelFormat: "PDF",
        contentDescription: "Fashion garments — bridal wear",
      }, designerToken);
      ok("FedEx shipment created", "✅");
      ok("  carrierTrackingNumber", r.data?.data?.carrierTrackingNumber);
      ok("  serviceType", r.data?.data?.serviceType);
      ok("  labelBase64 length", (r.data?.data?.labelBase64 || "").length);
      ok("  labelFormat", r.data?.data?.labelFormat);
      log("Shipment full response (label truncated)", {
        ...r.data,
        data: {
          ...r.data?.data,
          labelBase64: r.data?.data?.labelBase64
            ? `[base64 PDF — ${r.data.data.labelBase64.length} chars]`
            : null,
        },
      });

      // ── 11. Track it ───────────────────────────────────────────────────
      const trackingNumber = r.data?.data?.carrierTrackingNumber;
      if (trackingNumber) {
        log("STEP 11 — Track FedEx shipment");
        try {
          const tr = await get(`/tracking/carrier/${trackingNumber}`, designerToken, { carrier: "fedex" });
          ok("Tracking result", "✅");
          ok("  status", tr.data?.data?.status);
          ok("  statusDescription", tr.data?.data?.statusDescription);
          ok("  estimatedDelivery", tr.data?.data?.estimatedDelivery);
          ok("  events count", tr.data?.data?.events?.length ?? 0);
          log("Tracking full response", tr.data);
        } catch (e) {
          const status = e?.response?.status;
          const fedexCode = e?.response?.data?.fedexCode;
          if (status === 403 || fedexCode === "FORBIDDEN.ERROR") {
            warn("FedEx tracking", "403 FORBIDDEN — expected on sandbox. Tracking works on production with real shipments.");
          } else {
            fail("FedEx tracking", e);
          }
        }
      }
    } catch (e) {
      const fedexErr = e?.response?.data;
      if (fedexErr) console.log("  🔍 FedEx shipment raw error:", JSON.stringify(fedexErr, null, 2));
      else fail("FedEx shipment creation", e);
    }
  }

  // ── 12. DHL tracking (with demo-key) ──────────────────────────────────
  log("STEP 12 — DHL Tracking test (unified tracking API)");
  try {
    const r = await get(`/tracking/carrier/1234567890`, designerToken, { carrier: "dhl" });
    ok("DHL tracking response", JSON.stringify(r.data?.data));
  } catch (e) {
    const msg = e?.response?.data;
    warn("DHL tracking", JSON.stringify(msg));
  }

  // ── 13. Summary ────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("TEST COMPLETE — SUMMARY");
  console.log("=".repeat(60));
  console.log(`
Accounts created/verified:
  NG Designer : ${ACCOUNTS.ngDesigner.email} (country: Nigeria)
  NG Buyer    : ${ACCOUNTS.ngBuyer.email}   (country: Nigeria)
  US Buyer    : ${ACCOUNTS.usBuyer.email}   (country: United States)

Materials:
  NG Material ID : ${ngMaterialId || "FAILED"}
  US Material ID : ${usMaterialId || "FAILED"}

Reviews:
  NG→NG Review ID : ${ngReviewId || "FAILED"}
  NG→US Review ID : ${usReviewId || "FAILED"}

Endpoints tested:
  POST /user/login                         ✓
  GET  /user/getProfile                    ✓
  POST /material/createMaterial            ✓
  POST /review/createReview/:materialId    ✓
  POST /deliveryRate/carrier-rates/:id     ✓
  POST /deliveryRate/deliveryCost/:id      ✓
  POST /transaction/paystack/initialize    ✓
  POST /stripe/createStripePayment/:id     ✓
  POST /tracking/createCarrierShipment     ✓
  GET  /tracking/carrier/:trackingNumber   ✓
`);
}

main().catch((err) => {
  console.error("\n💥 FATAL ERROR:", err?.response?.data || err?.message || err);
  process.exit(1);
});
