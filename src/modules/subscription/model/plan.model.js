import mongoose from "mongoose";

const planSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    enum: ["Starter", "Standard", "Premium", "Elite", "Enterprise"],
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  gbpAmount: {
    type: Number,
    default: null,
    min: 0,
  },
  duration: {
    type: String,
    required: true,
    enum: ["monthly", "quarterly", "yearly"],
  },
  description: {
    type: String,
    required: true,
  },
  benefits: {
    type: [
      {
        type: String,
        trim: true,
        maxlength: 200,
      },
    ],
    default: [],
    validate: {
      validator: (benefits) => Array.isArray(benefits) && benefits.length <= 20,
      message: "A plan can have at most 20 benefits",
    },
  },
  commissionRate: {
    type: Number,
    default: 15,
    min: 0,
    max: 100,
  },
  listingLimit: {
    type: Number,
    default: null, // null = unlimited
  },
  preLoveListingLimit: {
    type: Number,
    default: null, // null = unlimited
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isFree: {
    type: Boolean,
    default: false,
  },
  trialDays: {
    type: Number,
    default: 0,
  },
  annualDiscountPercent: {
    type: Number,
    default: 10,
    min: 0,
    max: 100,
  },
}, { timestamps: true });

planSchema.index({ name: 1, duration: 1 }, { unique: true });

const Plan = mongoose.model("Plan", planSchema);

export default Plan;
