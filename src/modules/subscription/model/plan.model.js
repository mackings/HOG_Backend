import mongoose from "mongoose";



const planSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    enum: ["Standard", "Premium", "Enterprise"],
  },
  amount: {
    type: Number,
    required: true,
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
        maxlength: 160,
      },
    ],
    default: [],
    validate: {
      validator: (benefits) => Array.isArray(benefits) && benefits.length <= 7,
      message: "A plan can have at most 7 benefits",
    },
  },
}, { timestamps: true });

planSchema.index({ name: 1, duration: 1 }, { unique: true });

const Plan = mongoose.model("Plan", planSchema);

export default Plan;
