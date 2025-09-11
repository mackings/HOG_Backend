import mongoose from "mongoose";



const reviewSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Vendor",
        required: true,
    },
    materialId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Material",
        required: true,
    },
    materialTotalCost: {
        type: Number,
        required: true,
    },
    workmanshipTotalCost: {
        type: Number,
        required: true,
    },
    totalCost: {
        type: Number,
        required: true,
    },
    deliveryDate: {
        type: Date,
        required: true,
    },
    reminderDate: {
        type: Date,
        required: true,
    },
    comment: {
        type: String,
    },
    status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
    }
},
    {
        timestamps: true,
    }
);


export default mongoose.model("Review", reviewSchema);