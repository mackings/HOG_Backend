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
    approvalStatus: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
    },
    approvedAt: {
        type: Date,
        default: null,
    },
    rejectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
    },
    rejectedAt: {
        type: Date,
        default: null,
    },
    rejectionReasons: {
        type: [String],
        default: [],
    },
    moderationHistory: [
        {
            action: {
                type: String,
                enum: ["approved", "rejected"],
                required: true,
            },
            moderatorId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: true,
            },
            moderatorName: {
                type: String,
                required: true,
            },
            moderatorRole: {
                type: String,
                enum: ["admin", "superAdmin"],
                required: true,
            },
            reason: {
                type: String,
                default: null,
            },
            createdAt: {
                type: Date,
                default: Date.now,
            },
        },
    ],
    price: {
        type: Number,
    },
    currency: {
        type: String,
    },
    images: {
        type: Array,
        required: true,
    },
    yards: {
        type: Array,
    },

    },
{
    timestamps: true,
});

export default mongoose.model("Listing", listingSchema);
