import mongoose from "mongoose";

const measurementRequestSchema = new mongoose.Schema(
  {
    requesterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    orderType: {
      type: String,
      enum: ["material", "review", "customRequest"],
      default: "material",
    },
    requestedFields: {
      type: [String],
      default: [],
    },
    note: String,
    status: {
      type: String,
      enum: ["pending", "provided", "cancelled"],
      default: "pending",
    },
  },
  { timestamps: true }
);

export default mongoose.model("MeasurementRequest", measurementRequestSchema);

