import dotenv from "@dotenvx/dotenvx";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import app from "../app.js";
import connectDB from "../src/connection/database.js";
import User from "../src/modules/user/model/user.model.js";
import Vendor from "../src/modules/vendor/model/vendor.model.js";
import Material from "../src/modules/material/model/material.model.js";
import Category from "../src/modules/category/model/category.model.js";
import Listing from "../src/modules/seller/model/seller.model.js";
import Transaction from "../src/modules/transaction/model/transaction.model.js";
import Conversation from "../src/modules/messaging/model/conversation.model.js";
import Message from "../src/modules/messaging/model/message.model.js";
import MeasurementProfile from "../src/modules/measurement/model/measurementProfile.model.js";
import MeasurementRequest from "../src/modules/measurement/model/measurementRequest.model.js";
import CustomRequest from "../src/modules/customOrder/model/customRequest.model.js";
import OrderWorkflow from "../src/modules/customOrder/model/orderWorkflow.model.js";
import EscrowPayment from "../src/modules/customOrder/model/escrowPayment.model.js";
import Moodboard from "../src/modules/moodboard/model/moodboard.model.js";
import Dispute from "../src/modules/dispute/model/dispute.model.js";
import DesignerReview from "../src/modules/reputation/model/designerReview.model.js";
import Tracking from "../src/modules/tracking/model/tracking.model.js";

dotenv.config();

const TEST_TAG = `newest-full-${Date.now()}`;
const password = "Password123!";

const asId = (value) => String(value?._id || value);

const request = async ({ port, method = "GET", path, token, body }) => {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  return { status: response.status, json };
};

const assertStatus = (label, result, expected) => {
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (!allowed.includes(result.status)) {
    throw new Error(`${label} failed: expected ${allowed.join("/")}, got ${result.status}: ${JSON.stringify(result.json)}`);
  }
};

const cleanup = async () => {
  const users = await User.find({ email: { $regex: `^${TEST_TAG}` } }).select("_id").lean();
  const userIds = users.map((user) => user._id);
  const vendors = await Vendor.find({ userId: { $in: userIds } }).select("_id").lean();
  const vendorIds = vendors.map((vendor) => vendor._id);
  const materials = await Material.find({ userId: { $in: userIds } }).select("_id").lean();
  const materialIds = materials.map((material) => material._id);
  const listings = await Listing.find({ userId: { $in: userIds } }).select("_id").lean();
  const listingIds = listings.map((listing) => listing._id);
  const categories = await Category.find({ name: { $regex: `^${TEST_TAG}` } }).select("_id").lean();
  const categoryIds = categories.map((category) => category._id);
  const customRequests = await CustomRequest.find({
    $or: [{ customerId: { $in: userIds } }, { designerId: { $in: userIds } }],
  }).select("_id").lean();
  const customRequestIds = customRequests.map((requestItem) => requestItem._id);
  const conversations = await Conversation.find({
    $or: [{ customerId: { $in: userIds } }, { designerId: { $in: userIds } }],
  }).select("_id").lean();
  const conversationIds = conversations.map((conversation) => conversation._id);

  await Message.deleteMany({ conversationId: { $in: conversationIds } });
  await Conversation.deleteMany({ _id: { $in: conversationIds } });
  await MeasurementProfile.deleteMany({ userId: { $in: userIds } });
  await MeasurementRequest.deleteMany({ $or: [{ customerId: { $in: userIds } }, { requesterId: { $in: userIds } }] });
  await OrderWorkflow.deleteMany({ orderId: { $in: [...customRequestIds, ...materialIds, ...listingIds] } });
  await EscrowPayment.deleteMany({ orderId: { $in: customRequestIds } });
  await CustomRequest.deleteMany({ _id: { $in: customRequestIds } });
  await Moodboard.deleteMany({ userId: { $in: userIds } });
  await Dispute.deleteMany({ $or: [{ reporterId: { $in: userIds } }, { respondentId: { $in: userIds } }] });
  await DesignerReview.deleteMany({ $or: [{ customerId: { $in: userIds } }, { designerId: { $in: userIds } }] });
  await Tracking.deleteMany({ $or: [{ userId: { $in: userIds } }, { vendorId: { $in: userIds } }] });
  await Transaction.deleteMany({ $or: [{ userId: { $in: userIds } }, { vendorId: { $in: vendorIds } }] });
  await Listing.deleteMany({ _id: { $in: listingIds } });
  await Material.deleteMany({ _id: { $in: materialIds } });
  await Vendor.deleteMany({ _id: { $in: vendorIds } });
  await Category.deleteMany({ _id: { $in: categoryIds } });
  await User.deleteMany({ _id: { $in: userIds } });
};

const createSeedData = async () => {
  const hashedPassword = await bcrypt.hash(password, 10);
  const [customer, designer, admin] = await User.create([
    {
      fullName: "Newest Full Customer",
      email: `${TEST_TAG}.customer@example.com`,
      password: hashedPassword,
      isVerified: true,
      phoneNumber: "08000000001",
      role: "user",
      address: "Lagos Nigeria",
      country: "Nigeria",
    },
    {
      fullName: "Newest Full Designer",
      email: `${TEST_TAG}.designer@example.com`,
      password: hashedPassword,
      isVerified: true,
      phoneNumber: "08000000002",
      role: "tailor",
      address: "Lekki Lagos Nigeria",
      country: "Nigeria",
      isVendorEnabled: true,
    },
    {
      fullName: "Newest Full Admin",
      email: `${TEST_TAG}.admin@example.com`,
      password: hashedPassword,
      isVerified: true,
      phoneNumber: "08000000003",
      role: "admin",
      address: "Victoria Island Lagos Nigeria",
      country: "Nigeria",
    },
  ]);

  const category = await Category.create({
    name: `${TEST_TAG} Native Wear`,
    description: "Dummy category for full feature API simulation",
    image: "https://cdn.example.com/category.jpg",
  });

  const vendor = await Vendor.create({
    userId: designer._id,
    businessName: "Newest Full Couture",
    businessEmail: `${TEST_TAG}.studio@example.com`,
    businessPhone: "08000000004",
    address: "Lekki Lagos Nigeria",
    nepaBill: "https://cdn.example.com/nepa.jpg",
    city: "Lagos",
    state: "Lagos",
    yearOfExperience: "7",
    description: "Dummy designer account for full API simulation",
  });

  const material = await Material.create({
    userId: customer._id,
    categoryId: category._id,
    attireType: "Agbada",
    clothMaterial: "Silk",
    color: "Navy",
    brand: "Dummy Loom",
    sampleImage: ["https://cdn.example.com/sample.jpg"],
    measurement: [],
  });

  const listing = await Listing.create({
    userId: designer._id,
    categoryId: category._id,
    title: "Newest Full Agbada",
    size: "M",
    description: "Approved dummy listing for discovery and moodboard testing",
    condition: "new",
    status: "available",
    isApproved: true,
    approvalStatus: "approved",
    price: 150000,
    currency: "NGN",
    gender: "male",
    occasion: "native",
    fabric: "silk",
    images: ["https://cdn.example.com/listing-front.jpg", "https://cdn.example.com/listing-back.jpg"],
    media: {
      fabricCloseups: ["https://cdn.example.com/fabric.jpg"],
      videoPreviews: ["https://cdn.example.com/listing-preview.mp4"],
      beforeAfterShowcases: ["https://cdn.example.com/before-after.jpg"],
      styledLookPreviews: ["https://cdn.example.com/styled.jpg"],
      zoomImages: ["https://cdn.example.com/zoom.jpg"],
    },
  });

  return { customer, designer, admin, category, vendor, material, listing };
};

const login = async (port, email) => {
  const result = await request({
    port,
    method: "POST",
    path: "/api/v1/user/login",
    body: { email, password },
  });
  assertStatus(`login ${email}`, result, 200);
  return result.json.token;
};

const main = async () => {
  if (!process.env.MONGODB_URL) throw new Error("MONGODB_URL is required");
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is required");

  process.env.MAILJET_API_KEY = "";
  process.env.MAILJET_API_SECRET = "";
  process.env.SMTP_USER = "";
  process.env.SMTP_PASS = "";

  await connectDB();
  await cleanup();

  const server = app.listen(0);
  const port = server.address().port;
  const report = {};

  try {
    const seed = await createSeedData();
    const customerToken = await login(port, seed.customer.email);
    const designerToken = await login(port, seed.designer.email);
    const adminToken = await login(port, seed.admin.email);
    report.auth = { customerLogin: 200, designerLogin: 200, adminLogin: 200 };

    const publicListings = await request({ port, path: "/api/v1/discovery/public/listings?sort=latest" });
    assertStatus("guest public listings", publicListings, 200);
    const publicDesigners = await request({ port, path: "/api/v1/discovery/public/designers?location=Lagos" });
    assertStatus("guest public designers", publicDesigners, 200);
    report.guestDiscovery = { publicListings: publicListings.status, publicDesigners: publicDesigners.status };

    const measurementProfile = await request({
      port,
      method: "POST",
      path: "/api/v1/measurements/profiles",
      token: customerToken,
      body: {
        profileName: "Native fit",
        fitType: "native",
        measurements: {
          chest: 40,
          waist: 34,
          hip: 39,
          shoulder: 18,
          sleeveLength: 25,
          trouserLength: 41,
          native: { agbadaLength: 56, capSize: 22 },
        },
        guideReferences: {
          visualGuideUrls: ["https://cdn.example.com/chest-guide.jpg"],
          diagramUrls: ["https://cdn.example.com/native-diagram.png"],
          instructionVideoUrls: ["https://cdn.example.com/measurement-guide.mp4"],
        },
      },
    });
    assertStatus("create measurement profile", measurementProfile, 201);
    const measurementProfileId = measurementProfile.json.data._id;

    const measurementUpdate = await request({
      port,
      method: "PUT",
      path: `/api/v1/measurements/profiles/${measurementProfileId}`,
      token: customerToken,
      body: { note: "Updated sleeve length", measurements: { sleeveLength: 26, chest: 40 } },
    });
    assertStatus("update measurement profile", measurementUpdate, 200);

    const measurementRequest = await request({
      port,
      method: "POST",
      path: "/api/v1/measurements/requests",
      token: designerToken,
      body: {
        customerId: seed.customer._id,
        orderId: seed.material._id,
        orderType: "material",
        requestedFields: ["neck", "inseam", "agbadaLength"],
        note: "Please add final native measurements.",
      },
    });
    assertStatus("measurement request", measurementRequest, 201);
    report.measurements = { create: 201, update: 200, request: 201 };

    const portfolio = await request({
      port,
      method: "PUT",
      path: "/api/v1/tailor/portfolio",
      token: designerToken,
      body: {
        portfolioGallery: [{ imageUrl: "https://cdn.example.com/bridal.jpg", caption: "Bridal look", category: "bridal" }],
        categorizedWorkSections: {
          bridal: ["https://cdn.example.com/bridal.jpg"],
          nativeWear: ["https://cdn.example.com/native.jpg"],
          corporate: [],
          casual: [],
          menswear: ["https://cdn.example.com/menswear.jpg"],
          womenswear: ["https://cdn.example.com/womenswear.jpg"],
        },
      },
    });
    assertStatus("portfolio", portfolio, 200);

    const designerProfile = await request({
      port,
      path: `/api/v1/discovery/public/designers/${seed.designer._id}`,
    });
    assertStatus("public designer profile", designerProfile, 200);
    report.designerProfile = { portfolio: 200, publicProfile: 200 };

    const listingMedia = await request({
      port,
      method: "PUT",
      path: `/api/v1/seller/updateSellerListingMedia/${seed.listing._id}`,
      token: designerToken,
      body: {
        gender: "male",
        occasion: "native",
        fabric: "silk",
        availability: "available",
        media: {
          fabricCloseups: ["https://cdn.example.com/fabric-close.jpg"],
          videoPreviews: ["https://cdn.example.com/listing-preview.mp4"],
          beforeAfterShowcases: ["https://cdn.example.com/before-after.jpg"],
          styledLookPreviews: ["https://cdn.example.com/styled-look.jpg"],
          zoomImages: ["https://cdn.example.com/zoom.jpg"],
        },
      },
    });
    assertStatus("listing media", listingMedia, 200);

    const customRequest = await request({
      port,
      method: "POST",
      path: "/api/v1/custom-orders/requests",
      token: customerToken,
      body: {
        designerId: seed.designer._id,
        vendorId: seed.vendor._id,
        measurementProfileId,
        inspirationImages: ["https://cdn.example.com/inspo.jpg"],
        styleNotes: "Native agbada with subtle embroidery.",
        fabricPreferences: ["silk", "aso oke"],
        deliveryTimelinePreference: "Before June 1",
      },
    });
    assertStatus("custom request", customRequest, 201);
    const customRequestId = customRequest.json.data._id;

    const designerResponse = await request({
      port,
      method: "POST",
      path: `/api/v1/custom-orders/requests/${customRequestId}/designer-response`,
      token: designerToken,
      body: { action: "accept", note: "I can prepare a quote." },
    });
    assertStatus("designer response", designerResponse, 200);

    const quote = await request({
      port,
      method: "POST",
      path: `/api/v1/custom-orders/requests/${customRequestId}/quote`,
      token: designerToken,
      body: {
        materialCost: 80000,
        workmanshipCost: 120000,
        currency: "NGN",
        estimatedProductionDays: 14,
        fabricRecommendations: ["premium silk", "aso oke trim"],
        note: "Can deliver in two weeks.",
      },
    });
    assertStatus("submit quote", quote, 200);

    const revision = await request({
      port,
      method: "POST",
      path: `/api/v1/custom-orders/requests/${customRequestId}/revisions`,
      token: customerToken,
      body: { note: "Please reduce embroidery slightly." },
    });
    assertStatus("revision", revision, 200);

    await request({
      port,
      method: "POST",
      path: `/api/v1/custom-orders/requests/${customRequestId}/quote`,
      token: designerToken,
      body: {
        materialCost: 75000,
        workmanshipCost: 115000,
        currency: "NGN",
        estimatedProductionDays: 12,
        fabricRecommendations: ["premium silk"],
        note: "Updated quote after revision.",
      },
    });

    const acceptQuote = await request({
      port,
      method: "POST",
      path: `/api/v1/custom-orders/requests/${customRequestId}/accept`,
      token: customerToken,
    });
    assertStatus("accept quote", acceptQuote, 200);
    const escrowId = acceptQuote.json.data.escrow._id;

    const deposit = await request({
      port,
      method: "POST",
      path: `/api/v1/custom-orders/escrow/${escrowId}/payments`,
      token: customerToken,
      body: { milestoneName: "deposit", reference: `${TEST_TAG}-deposit` },
    });
    assertStatus("deposit", deposit, 200);

    const balance = await request({
      port,
      method: "POST",
      path: `/api/v1/custom-orders/escrow/${escrowId}/payments`,
      token: customerToken,
      body: { milestoneName: "balance", reference: `${TEST_TAG}-balance` },
    });
    assertStatus("balance", balance, 200);

    const convert = await request({
      port,
      method: "POST",
      path: `/api/v1/custom-orders/requests/${customRequestId}/convert`,
      token: customerToken,
      body: { convertedOrderId: customRequestId, estimatedCompletionDate: "2026-06-01T00:00:00.000Z" },
    });
    assertStatus("convert order", convert, 200);

    const workflow = await request({
      port,
      method: "PUT",
      path: "/api/v1/custom-orders/workflow",
      token: designerToken,
      body: {
        orderType: "customRequest",
        orderId: customRequestId,
        status: "in_production",
        note: "Production started.",
        estimatedCompletionDate: "2026-06-01T00:00:00.000Z",
      },
    });
    assertStatus("workflow production", workflow, 200);

    const workflowDelay = await request({
      port,
      method: "PUT",
      path: "/api/v1/custom-orders/workflow",
      token: designerToken,
      body: {
        orderType: "customRequest",
        orderId: customRequestId,
        status: "delayed",
        delayReason: "Fabric supplier delay",
      },
    });
    assertStatus("workflow delay", workflowDelay, 200);

    const refund = await request({
      port,
      method: "POST",
      path: `/api/v1/custom-orders/escrow/${escrowId}/refund`,
      token: adminToken,
      body: { amount: 10000, adminNote: "Partial refund test." },
    });
    assertStatus("escrow refund", refund, 200);

    const release = await request({
      port,
      method: "POST",
      path: `/api/v1/custom-orders/escrow/${escrowId}/release`,
      token: adminToken,
      body: { amount: 180000, adminNote: "Release remaining held amount after delivery confirmation." },
    });
    assertStatus("escrow release", release, 200);
    report.customOrderEscrow = {
      request: 201,
      designerResponse: 200,
      quote: 200,
      revision: 200,
      accept: 200,
      deposit: 200,
      balance: 200,
      convert: 200,
      workflow: 200,
      delay: 200,
      refund: 200,
      release: 200,
    };

    const conversation = await request({
      port,
      method: "POST",
      path: "/api/v1/messaging/conversations",
      token: customerToken,
      body: {
        orderType: "customRequest",
        orderId: customRequestId,
        designerId: seed.designer._id,
        vendorId: seed.vendor._id,
        topic: "measurement",
      },
    });
    assertStatus("conversation", conversation, 201);
    const conversationId = conversation.json.data._id;

    const validMessage = await request({
      port,
      method: "POST",
      path: `/api/v1/messaging/conversations/${conversationId}/messages`,
      token: customerToken,
      body: {
        topic: "measurement",
        content: "Please confirm the updated sleeve length.",
        attachments: [{ type: "image", url: "https://cdn.example.com/sleeve.jpg", mimeType: "image/jpeg" }],
      },
    });
    assertStatus("valid message", validMessage, 201);

    const blockedContact = await request({
      port,
      method: "POST",
      path: `/api/v1/messaging/conversations/${conversationId}/messages`,
      token: customerToken,
      body: { content: "Call me on +234 801 234 5678 at 12 Allen Avenue" },
    });
    assertStatus("blocked contact message", blockedContact, 400);

    const blockedVideo = await request({
      port,
      method: "POST",
      path: `/api/v1/messaging/conversations/${conversationId}/messages`,
      token: customerToken,
      body: {
        content: "Video",
        attachments: [{ type: "video", url: "https://cdn.example.com/video.mp4", mimeType: "video/mp4" }],
      },
    });
    assertStatus("blocked video message", blockedVideo, 400);
    report.messaging = { conversation: 201, validMessage: 201, blockedContact: 400, blockedVideo: 400 };

    const moodboard = await request({
      port,
      method: "POST",
      path: "/api/v1/moodboards",
      token: customerToken,
      body: { name: "Wedding inspiration", description: "Looks for June event" },
    });
    assertStatus("moodboard", moodboard, 201);
    const moodboardId = moodboard.json.data._id;
    const moodboardItem = await request({
      port,
      method: "POST",
      path: `/api/v1/moodboards/${moodboardId}/items`,
      token: customerToken,
      body: {
        itemType: "listing",
        itemId: seed.listing._id,
        note: "Inspired by sleeve detail",
        inspiredBy: { itemType: "image", imageUrl: "https://cdn.example.com/inspo.jpg" },
      },
    });
    assertStatus("moodboard item", moodboardItem, 200);
    report.moodboards = { create: 201, addItem: 200 };

    const filterListings = await request({
      port,
      path: `/api/v1/discovery/listings?gender=male&fabric=silk&minPrice=100000&maxPrice=200000&sort=price_low`,
      token: customerToken,
    });
    assertStatus("auth discovery listings", filterListings, 200);
    const filterDesigners = await request({
      port,
      path: `/api/v1/discovery/designers?specialization=native&location=Lagos&sort=ratings`,
      token: customerToken,
    });
    assertStatus("auth discovery designers", filterDesigners, 200);
    report.discovery = { listings: 200, designers: 200, listingMedia: 200 };

    const tracking = await request({
      port,
      method: "POST",
      path: `/api/v1/tracking/createTracking?materialId=${seed.material._id}`,
      token: designerToken,
    });
    assertStatus("create tracking", tracking, 201);
    const trackingNumber = tracking.json.data.trackingNumber;
    const getTracking = await request({
      port,
      path: `/api/v1/tracking/getTracking?trackingId=${tracking.json.data._id}`,
      token: customerToken,
    });
    assertStatus("get tracking", getTracking, 200);
    const deliverTracking = await request({
      port,
      method: "PUT",
      path: `/api/v1/tracking/updateMaterialThroughTracking?trackingNumber=${trackingNumber}`,
      token: customerToken,
    });
    assertStatus("mark delivered", deliverTracking, 200);
    report.trackingDelivery = { create: 201, get: 200, delivered: 200 };

    await Transaction.create({
      userId: seed.customer._id,
      vendorId: seed.vendor._id,
      materialId: seed.material._id,
      totalAmount: 190000,
      paymentMethod: "EscrowSimulation",
      paymentReference: `${TEST_TAG}-paid-order`,
      paymentStatus: "full payment",
      amountPaid: 190000,
    });

    const designerReview = await request({
      port,
      method: "POST",
      path: "/api/v1/reputation/designer-reviews",
      token: customerToken,
      body: {
        designerId: seed.designer._id,
        vendorId: seed.vendor._id,
        orderId: seed.material._id,
        orderType: "material",
        rating: 5,
        categories: {
          fitAccuracy: 5,
          communication: 5,
          deliveryReliability: 4,
          materialQuality: 5,
          overallExperience: 5,
        },
        comment: "Great fit and communication.",
      },
    });
    assertStatus("designer review", designerReview, 201);
    const reviewResponse = await request({
      port,
      method: "POST",
      path: `/api/v1/reputation/designer-reviews/${designerReview.json.data._id}/respond`,
      token: designerToken,
      body: { response: "Thank you for the review." },
    });
    assertStatus("review response", reviewResponse, 200);
    report.reputation = { review: 201, response: 200 };

    const dispute = await request({
      port,
      method: "POST",
      path: "/api/v1/disputes",
      token: customerToken,
      body: {
        respondentId: seed.designer._id,
        orderId: customRequestId,
        orderType: "customRequest",
        category: "fit_issue",
        title: "Sleeve length concern",
        description: "The sleeve needs adjustment.",
        evidence: ["https://cdn.example.com/fit-issue.jpg"],
        requestedResolution: "revision",
      },
    });
    assertStatus("dispute", dispute, 201);
    const adminDisputes = await request({ port, path: "/api/v1/disputes/admin", token: adminToken });
    assertStatus("admin disputes", adminDisputes, 200);
    const disputeUpdate = await request({
      port,
      method: "PUT",
      path: `/api/v1/disputes/admin/${dispute.json.data._id}`,
      token: adminToken,
      body: { status: "resolved", resolution: "Revision approved", adminNote: "Dummy admin resolved this ticket." },
    });
    assertStatus("dispute update", disputeUpdate, 200);
    report.disputes = { create: 201, adminList: 200, update: 200 };

    const analytics = await request({ port, path: "/api/v1/designer-tools/analytics", token: designerToken });
    assertStatus("designer analytics", analytics, 200);
    const featureListing = await request({
      port,
      method: "PUT",
      path: `/api/v1/designer-tools/listings/${seed.listing._id}/feature`,
      token: designerToken,
      body: { isFeatured: true },
    });
    assertStatus("feature listing", featureListing, 200);
    report.designerTools = { analytics: 200, featureListing: 200 };

    console.log(JSON.stringify({
      success: true,
      dummyAccounts: {
        customer: { id: asId(seed.customer), email: seed.customer.email },
        designer: { id: asId(seed.designer), email: seed.designer.email },
        admin: { id: asId(seed.admin), email: seed.admin.email },
      },
      report,
    }, null, 2));
  } finally {
    server.close();
    await cleanup();
    await mongoose.disconnect();
  }
};

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
