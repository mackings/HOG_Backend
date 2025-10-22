import mongoose from "mongoose";


const makeOfferSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User" 
    },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor" },
    materialId: { type: mongoose.Schema.Types.ObjectId, ref: "Material" },
    reviewId: { type: mongoose.Schema.Types.ObjectId, ref: "Review" },
    status: { type: String, enum: ["pending", "accepted", "rejected", "countered", "buyerCountered", "buyerRejected"], default: "pending" },
    total: Number,
    chats: [
        {
        senderType: { type: String, enum: ["customer", "vendor"], required: true },
        action: { type: String, enum: ["accepted", "rejected", "countered", "pending", "buyerCountered", "buyerRejected"], required: true },
        counterMaterialCost: Number,
        counterWorkmanshipCost: Number,
        counterTotalCost: Number,
        comment: String,
        timestamp: { type: Date, default: Date.now },
        },
    ],
}, { timestamps: true });



export default mongoose.model("MakeOffer", makeOfferSchema);