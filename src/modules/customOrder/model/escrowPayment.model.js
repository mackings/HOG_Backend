import mongoose from "mongoose";

const escrowPaymentSchema = new mongoose.Schema(
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
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    depositAmount: {
      type: Number,
      default: 0,
    },
    balanceAmount: {
      type: Number,
      default: 0,
    },
    releasedAmount: {
      type: Number,
      default: 0,
    },
    refundedAmount: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: "NGN",
    },
    status: {
      type: String,
      enum: ["pending", "deposit_held", "fully_held", "released", "partially_refunded", "refunded", "disputed"],
      default: "pending",
    },
    milestones: [
      {
        name: String,
        amount: Number,
        status: {
          type: String,
          enum: ["pending", "paid", "released", "refunded"],
          default: "pending",
        },
        reference: String,
        paidAt: Date,
        releasedAt: Date,
      },
    ],
    deliveryConfirmedAt: Date,
    adminInterventionBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    adminNote: String,
  },
  { timestamps: true }
);

escrowPaymentSchema.index({ orderId: 1, orderType: 1 });

export default mongoose.model("EscrowPayment", escrowPaymentSchema);

