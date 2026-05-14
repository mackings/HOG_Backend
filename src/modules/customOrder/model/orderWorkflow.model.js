import mongoose from "mongoose";

const orderWorkflowSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    orderType: {
      type: String,
      enum: ["material", "listing", "customRequest", "review"],
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
    },
    currentStatus: {
      type: String,
      enum: ["quote_received", "accepted", "in_production", "ready", "shipped", "delivered", "delayed", "cancelled"],
      default: "quote_received",
    },
    timeline: [
      {
        status: String,
        note: String,
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    estimatedCompletionDate: Date,
    deliveryTrackingNumber: String,
    delayReason: String,
    delayNotifiedAt: Date,
  },
  { timestamps: true }
);

orderWorkflowSchema.index({ orderId: 1, orderType: 1 }, { unique: true });

export default mongoose.model("OrderWorkflow", orderWorkflowSchema);

