import mongoose from "mongoose";

const supportConversationSchema = new mongoose.Schema(
  {
    requesterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    subject: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ["account", "order", "payment", "designer", "listing", "technical", "other"],
      default: "other",
    },
    status: {
      type: String,
      enum: ["open", "awaiting_admin", "awaiting_user", "flagged", "closed"],
      default: "open",
    },
    flaggedCount: {
      type: Number,
      default: 0,
    },
    restrictedUntil: Date,
    lastMessageAt: Date,
  },
  { timestamps: true }
);

supportConversationSchema.index({ requesterId: 1, updatedAt: -1 });
supportConversationSchema.index({ adminId: 1, updatedAt: -1 });
supportConversationSchema.index({ status: 1, updatedAt: -1 });

export default mongoose.model("SupportConversation", supportConversationSchema);
