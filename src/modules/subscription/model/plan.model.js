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
});

const Plan = mongoose.model("Plan", planSchema);

export default Plan;