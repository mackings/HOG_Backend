import mongoose from "mongoose";

const measurementFieldsSchema = new mongoose.Schema(
  {
    chest: Number,
    waist: Number,
    hip: Number,
    shoulder: Number,
    sleeveLength: Number,
    trouserLength: Number,
    neck: Number,
    inseam: Number,
    bicep: Number,
    wrist: Number,
    thigh: Number,
    ankle: Number,
    native: {
      agbadaLength: Number,
      bubaLength: Number,
      kaftanLength: Number,
      wrapperLength: Number,
      capSize: Number,
      filaSize: Number,
    },
  },
  { _id: false }
);

const measurementProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    profileName: {
      type: String,
      required: true,
    },
    fitType: {
      type: String,
      enum: ["casual", "fitted", "native", "custom"],
      default: "custom",
    },
    measurements: {
      type: measurementFieldsSchema,
      default: {},
    },
    guideReferences: {
      visualGuideUrls: { type: [String], default: [] },
      diagramUrls: { type: [String], default: [] },
      instructionVideoUrls: { type: [String], default: [] },
    },
    history: [
      {
        measurements: measurementFieldsSchema,
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        note: String,
        changedAt: { type: Date, default: Date.now },
      },
    ],
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

measurementProfileSchema.index({ userId: 1, fitType: 1 });

export default mongoose.model("MeasurementProfile", measurementProfileSchema);

