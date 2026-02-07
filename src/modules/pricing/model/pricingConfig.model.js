import mongoose from "mongoose";

const pricingConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "default",
      unique: true,
      index: true,
    },
    quotationTaxRate: {
      type: Number,
      default: 0.1,
      min: 0,
      max: 1,
    },
    vatRate: {
      type: Number,
      default: 0.1,
      min: 0,
      max: 1,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

export default mongoose.model("PricingConfig", pricingConfigSchema);

