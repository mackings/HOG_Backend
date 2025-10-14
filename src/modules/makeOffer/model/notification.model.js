import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", },
    materialId: { type: mongoose.Schema.Types.ObjectId, ref: "Material", required: true },
    title: String,
    message: String,
    relatedOffer: { type: mongoose.Schema.Types.ObjectId, ref: "MakeOffer" },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Notification", notificationSchema);
