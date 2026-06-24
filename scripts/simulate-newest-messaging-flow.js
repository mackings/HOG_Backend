import dotenv from "@dotenvx/dotenvx";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import app from "../app.js";
import connectDB from "../src/connection/database.js";
import User from "../src/modules/user/model/user.model.js";
import Vendor from "../src/modules/vendor/model/vendor.model.js";
import Material from "../src/modules/material/model/material.model.js";
import Conversation from "../src/modules/messaging/model/conversation.model.js";
import Message from "../src/modules/messaging/model/message.model.js";

dotenv.config();

const TEST_TAG = `newest-${Date.now()}`;
const password = "Password123!";

const request = async ({ port, method, path, token, body }) => {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await response.json();
  return { status: response.status, json };
};

const createDummyAccounts = async () => {
  const hashedPassword = await bcrypt.hash(password, 10);

  const customer = await User.create({
    fullName: "Newest Dummy Customer",
    email: `${TEST_TAG}.customer@example.com`,
    password: hashedPassword,
    isVerified: true,
    phoneNumber: "08000000001",
    role: "user",
    address: "Lagos Nigeria",
    country: "Nigeria",
  });

  const designer = await User.create({
    fullName: "Newest Dummy Designer",
    email: `${TEST_TAG}.designer@example.com`,
    password: hashedPassword,
    isVerified: true,
    phoneNumber: "08000000002",
    role: "tailor",
    address: "Lekki Lagos Nigeria",
    country: "Nigeria",
    isVendorEnabled: true,
  });

  const vendor = await Vendor.create({
    userId: designer._id,
    businessName: "Newest Dummy Couture",
    businessEmail: `${TEST_TAG}.studio@example.com`,
    businessPhone: "08000000003",
    address: "Lekki Lagos Nigeria",
    nepaBill: "https://cdn.example.com/nepa.jpg",
    city: "Lagos",
    state: "Lagos",
    yearOfExperience: "5",
    description: "Dummy designer account for API simulation",
  });

  const material = await Material.create({
    userId: customer._id,
    attireType: "Agbada",
    clothMaterial: "Silk",
    color: "Navy",
    brand: "Dummy Loom",
    sampleImage: ["https://cdn.example.com/sample.jpg"],
    measurement: [],
  });

  return { customer, designer, vendor, material };
};

const cleanup = async () => {
  const users = await User.find({ email: { $regex: `^${TEST_TAG}` } }).select("_id").lean();
  const userIds = users.map((user) => user._id);
  const vendors = await Vendor.find({ userId: { $in: userIds } }).select("_id").lean();
  const vendorIds = vendors.map((vendor) => vendor._id);
  const materials = await Material.find({ userId: { $in: userIds } }).select("_id").lean();
  const materialIds = materials.map((material) => material._id);
  const conversations = await Conversation.find({
    $or: [{ customerId: { $in: userIds } }, { designerId: { $in: userIds } }],
  }).select("_id").lean();
  const conversationIds = conversations.map((conversation) => conversation._id);

  await Message.deleteMany({ conversationId: { $in: conversationIds } });
  await Conversation.deleteMany({ _id: { $in: conversationIds } });
  await Material.deleteMany({ _id: { $in: materialIds } });
  await Vendor.deleteMany({ _id: { $in: vendorIds } });
  await User.deleteMany({ _id: { $in: userIds } });
};

const main = async () => {
  if (!process.env.MONGODB_URL) {
    throw new Error("MONGODB_URL is required to run dummy account API simulation");
  }
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required to run dummy account API simulation");
  }

  process.env.RESEND_API_KEY = "";

  await connectDB();
  await cleanup();

  const server = app.listen(0);
  const port = server.address().port;

  try {
    const { customer, designer, vendor, material } = await createDummyAccounts();
    const customerToken = jwt.sign({ id: customer._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

    const conversationResponse = await request({
      port,
      method: "POST",
      path: "/api/v1/messaging/conversations",
      token: customerToken,
      body: {
        orderType: "material",
        orderId: material._id,
        designerId: designer._id,
        vendorId: vendor._id,
        topic: "measurement",
      },
    });

    if (conversationResponse.status !== 201) {
      throw new Error(`Conversation API failed: ${JSON.stringify(conversationResponse)}`);
    }

    const conversationId = conversationResponse.json.data._id;

    const validMessageResponse = await request({
      port,
      method: "POST",
      path: `/api/v1/messaging/conversations/${conversationId}/messages`,
      token: customerToken,
      body: {
        topic: "measurement",
        content: "Please confirm if the sleeve length works for a fitted style.",
        attachments: [
          {
            type: "image",
            url: "https://cdn.example.com/sleeve-reference.jpg",
            mimeType: "image/jpeg",
          },
        ],
      },
    });

    if (validMessageResponse.status !== 201) {
      throw new Error(`Valid message API failed: ${JSON.stringify(validMessageResponse)}`);
    }

    const blockedContactResponse = await request({
      port,
      method: "POST",
      path: `/api/v1/messaging/conversations/${conversationId}/messages`,
      token: customerToken,
      body: {
        topic: "general",
        content: "Reach me on +234 801 234 5678 or at 12 Allen Avenue",
      },
    });

    if (blockedContactResponse.status !== 400 || !blockedContactResponse.json.data?.blocked) {
      throw new Error(`Blocked contact API failed: ${JSON.stringify(blockedContactResponse)}`);
    }

    const blockedVideoResponse = await request({
      port,
      method: "POST",
      path: `/api/v1/messaging/conversations/${conversationId}/messages`,
      token: customerToken,
      body: {
        content: "Video preview",
        attachments: [
          {
            type: "video",
            url: "https://cdn.example.com/preview.mp4",
            mimeType: "video/mp4",
          },
        ],
      },
    });

    if (blockedVideoResponse.status !== 400) {
      throw new Error(`Video block API failed: ${JSON.stringify(blockedVideoResponse)}`);
    }

    const messagesResponse = await request({
      port,
      method: "GET",
      path: `/api/v1/messaging/conversations/${conversationId}/messages`,
      token: customerToken,
    });

    if (messagesResponse.status !== 200) {
      throw new Error(`Fetch messages API failed: ${JSON.stringify(messagesResponse)}`);
    }

    const sentMessages = messagesResponse.json.data.filter((message) => message.deliveryStatus === "sent");
    const blockedMessages = await Message.find({ conversationId, deliveryStatus: "blocked" }).lean();

    console.log(JSON.stringify({
      success: true,
      dummyAccounts: {
        customer: { id: customer._id, email: customer.email },
        designer: { id: designer._id, email: designer.email },
        vendor: { id: vendor._id, businessName: vendor.businessName },
      },
      apiResults: {
        createConversationStatus: conversationResponse.status,
        validMessageStatus: validMessageResponse.status,
        emailNotification: validMessageResponse.json.data.emailNotification,
        blockedContactStatus: blockedContactResponse.status,
        blockedContactTypes: blockedContactResponse.json.data.detectedContactTypes,
        blockedVideoStatus: blockedVideoResponse.status,
        fetchedSentMessages: sentMessages.length,
        blockedAttemptsRecordedForAdmin: blockedMessages.length,
      },
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

