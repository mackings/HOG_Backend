import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    orderType: {
      type: String,
      enum: ["material", "listing", "review", "customRequest"],
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    designerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
    },
    status: {
      type: String,
      enum: ["active", "closed", "flagged"],
      default: "active",
    },
    topic: {
      type: String,
      enum: ["general", "measurement", "quote", "order", "support"],
      default: "general",
    },
    lastMessageAt: {
      type: Date,
    },
    flaggedCount: {
      type: Number,
      default: 0,
    },
    restrictedUntil: {
      type: Date,
    },
  },
  { timestamps: true }
);

conversationSchema.index({ orderType: 1, orderId: 1, customerId: 1, designerId: 1 });

export default mongoose.model("Conversation", conversationSchema);

