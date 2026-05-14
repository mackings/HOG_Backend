import mongoose from "mongoose";

const customRequestSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    designerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
    },
    measurementProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MeasurementProfile",
    },
    inspirationImages: {
      type: [String],
      default: [],
    },
    styleNotes: String,
    fabricPreferences: {
      type: [String],
      default: [],
    },
    deliveryTimelinePreference: String,
    status: {
      type: String,
      enum: [
        "submitted",
        "designer_review",
        "quote_submitted",
        "revision_requested",
        "accepted",
        "declined",
        "converted_to_order",
      ],
      default: "submitted",
    },
    quote: {
      materialCost: Number,
      workmanshipCost: Number,
      totalCost: Number,
      currency: { type: String, default: "NGN" },
      estimatedProductionDays: Number,
      fabricRecommendations: { type: [String], default: [] },
      note: String,
      submittedAt: Date,
    },
    revisions: [
      {
        requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        note: String,
        status: {
          type: String,
          enum: ["open", "resolved"],
          default: "open",
        },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    convertedOrderId: {
      type: mongoose.Schema.Types.ObjectId,
    },
  },
  { timestamps: true }
);

export default mongoose.model("CustomRequest", customRequestSchema);
