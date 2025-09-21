import mongoose from "mongoose";



const listingSchema = new mongoose.Schema({
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    title: {
        type: String,
        required: true,
    },
    size: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    condition: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        required: true,
    },
    isApproved: {
        type: Boolean,
        default: false,
    },
    price: {
        type: Number,
        required: true,
    },
    images: {
        type: Array,
        required: true,
    },


    },
{
    timestamps: true,
});

export default mongoose.model("Listing", listingSchema);
