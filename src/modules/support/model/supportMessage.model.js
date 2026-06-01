import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["image", "voice"],
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    mimeType: String,
    sizeBytes: Number,
    durationSeconds: Number,
  },
  { _id: false }
);

const supportMessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SupportConversation",
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    messageType: {
      type: String,
      enum: ["text", "image", "voice", "mixed"],
      default: "text",
    },
    content: {
      type: String,
      default: "",
    },
    originalContent: {
      type: String,
      select: false,
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
    isFlagged: {
      type: Boolean,
      default: false,
    },
    flagReason: String,
    detectedContactTypes: {
      type: [String],
      default: [],
    },
    deliveryStatus: {
      type: String,
      enum: ["sent", "blocked"],
      default: "sent",
    },
    readAt: Date,
  },
  { timestamps: true }
);

supportMessageSchema.index({ conversationId: 1, createdAt: 1 });

export default mongoose.model("SupportMessage", supportMessageSchema);
