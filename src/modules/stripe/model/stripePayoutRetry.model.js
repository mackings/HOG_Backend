import mongoose from "mongoose";

const stripePayoutRetrySchema = new mongoose.Schema(
  {
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true },
    vendorUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "InitializedOrder", required: true },
    reviewId: { type: mongoose.Schema.Types.ObjectId, ref: "Review", required: true },
    paymentReference: { type: String, required: true, unique: true },
    stripeAccountId: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "usd" },
    status: { type: String, enum: ["pending", "processing", "retry", "succeeded", "failed"], default: "pending" },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now },
    lastError: { type: String, default: "" },
    stripeTransferId: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("StripePayoutRetry", stripePayoutRetrySchema);
