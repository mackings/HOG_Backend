import mongoose from "mongoose";

const orderWorkflowSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    orderType: {
      type: String,
      enum: ["material", "listing", "customRequest", "review", "manual"],
      required: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    designerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    customerName: String,
    customerEmail: String,
    attireName: String,
    workflowTitle: String,
    productionNotes: String,
    currentStatus: {
      type: String,
      enum: ["quote_received", "accepted", "not_started", "in_production", "ready", "shipped", "delivered", "delayed", "cancelled"],
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
    reminderNotifications: {
      oneWeekSentAt: Date,
      threeDaysSentAt: Date,
    },
  },
  { timestamps: true }
);

orderWorkflowSchema.index({ orderId: 1, orderType: 1 }, { unique: true });

export default mongoose.model("OrderWorkflow", orderWorkflowSchema);
