import mongoose from "mongoose";

const pickupLocationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { _id: true }
);

const pickupStateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
    locations: [pickupLocationSchema],
  },
  { _id: true }
);

const pickupCountrySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    isActive: { type: Boolean, default: true },
    states: [pickupStateSchema],
  },
  { timestamps: true }
);

export default mongoose.model("PickupCountry", pickupCountrySchema);

