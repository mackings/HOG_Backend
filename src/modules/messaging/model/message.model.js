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
    durationSeconds: Number,
    sizeBytes: Number,
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
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
      required: true,
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
    topic: {
      type: String,
      enum: ["general", "measurement", "quote", "order", "support"],
      default: "general",
    },
    isFlagged: {
      type: Boolean,
      default: false,
    },
    flagReason: {
      type: String,
    },
    detectedContactTypes: {
      type: [String],
      default: [],
    },
    readAt: Date,
    deliveryStatus: {
      type: String,
      enum: ["sent", "blocked"],
      default: "sent",
    },
  },
  { timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: -1 });

export default mongoose.model("Message", messageSchema);
