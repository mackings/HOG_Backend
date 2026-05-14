import mongoose from "mongoose";

const disputeSchema = new mongoose.Schema(
  {
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    respondentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    orderType: {
      type: String,
      enum: ["material", "listing", "customRequest", "review"],
      required: true,
    },
    category: {
      type: String,
      enum: ["fit_issue", "delivery_issue", "payment_issue", "material_quality", "communication", "other"],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    evidence: {
      type: [String],
      default: [],
    },
    requestedResolution: {
      type: String,
      enum: ["refund", "revision", "replacement", "admin_review", "other"],
      default: "admin_review",
    },
    status: {
      type: String,
      enum: ["open", "under_review", "awaiting_response", "resolved", "closed"],
      default: "open",
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    adminNotes: [
      {
        note: String,
        adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    resolution: {
      type: String,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Dispute", disputeSchema);

