import mongoose from "mongoose";



const makeOfferSchema = new mongoose.Schema({
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
    reviewId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Review",
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
    comment: {
        type: String,
    },
    status: {
        type: String,
        default: "makeOffered",
    }
},
    {
        timestamps: true,
    }
);


export default mongoose.model("MakeOffer", makeOfferSchema);