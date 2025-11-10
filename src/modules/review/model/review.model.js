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
        default: 0,
    },
    workmanshipTotalCost: {
        type: Number,
        default: 0,
    },
    totalCost: {
        type: Number,
        default: 0,
    },
    amountPaid: {
        type: Number,
        default: 0,
    },
    amountToPay: {
        type: Number,
        default: 0,
    },
    deliveryDate: {
        type: Date,
    },
    tax: {
        type: Number,
        default: 0,
    },
    commission: {
        type: Number,
    },
    reminderDate: {
        type: Date,
    },
    comment: {
        type: String,
    },
    status: {
        type: String,
        enum: ["pending", "approved", "rejected", "requesting", "quote", "part payment", "full payment"],
        default: "quote",
    }
},
    {
        timestamps: true,
    }
);


export default mongoose.model("Review", reviewSchema);