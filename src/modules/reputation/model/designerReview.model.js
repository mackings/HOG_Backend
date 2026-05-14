import mongoose from "mongoose";

const designerReviewSchema = new mongoose.Schema(
  {
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
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    orderType: {
      type: String,
      enum: ["material", "listing", "customRequest", "review"],
      required: true,
    },
    isVerifiedPurchase: {
      type: Boolean,
      default: false,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    categories: {
      fitAccuracy: { type: Number, min: 1, max: 5 },
      communication: { type: Number, min: 1, max: 5 },
      deliveryReliability: { type: Number, min: 1, max: 5 },
      materialQuality: { type: Number, min: 1, max: 5 },
      overallExperience: { type: Number, min: 1, max: 5 },
    },
    comment: {
      type: String,
      required: true,
    },
    designerResponse: {
      response: String,
      respondedAt: Date,
    },
  },
  { timestamps: true }
);

designerReviewSchema.index({ customerId: 1, orderId: 1, orderType: 1 }, { unique: true });

export default mongoose.model("DesignerReview", designerReviewSchema);

