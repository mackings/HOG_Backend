import mongoose from "mongoose";

const moodboardSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: String,
    visibility: {
      type: String,
      enum: ["private", "shared"],
      default: "private",
    },
    items: [
      {
        itemType: {
          type: String,
          enum: ["listing", "image", "designer", "customRequest"],
          required: true,
        },
        itemId: mongoose.Schema.Types.ObjectId,
        imageUrl: String,
        note: String,
        inspiredBy: {
          itemType: String,
          itemId: mongoose.Schema.Types.ObjectId,
          imageUrl: String,
        },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("Moodboard", moodboardSchema);

