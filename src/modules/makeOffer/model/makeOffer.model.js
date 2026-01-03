import mongoose from "mongoose";


const makeOfferSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor" },
    materialId: { type: mongoose.Schema.Types.ObjectId, ref: "Material" },
    reviewId: { type: mongoose.Schema.Types.ObjectId, ref: "Review" },
    status: { type: String, enum: ["pending", "accepted", "rejected", "countered", "incoming"], default: "pending" },
    total: Number,

    // Mutual consent tracking - both parties must consent before payment
    buyerConsent: { type: Boolean, default: false },
    vendorConsent: { type: Boolean, default: false },
    mutualConsentAchieved: { type: Boolean, default: false },

    // Final agreed amounts (set when mutual consent achieved)
    finalMaterialCost: { type: Number, default: 0 },
    finalWorkmanshipCost: { type: Number, default: 0 },
    finalTotalCost: { type: Number, default: 0 },

    // Currency information (copied from review for easy display)
    isInternationalVendor: { type: Boolean, default: false },
    exchangeRate: { type: Number, default: 0 },
    buyerCountry: { type: String, default: "" },
    vendorCountry: { type: String, default: "" },

    // USD amounts for international vendors
    finalMaterialCostUSD: { type: Number, default: 0 },
    finalWorkmanshipCostUSD: { type: Number, default: 0 },
    finalTotalCostUSD: { type: Number, default: 0 },

    chats: [
        {
        senderType: { type: String, enum: ["customer", "vendor"], required: true },
        action: { type: String, enum: ["accepted", "rejected", "countered", "pending", "incoming"], required: true },
        // NGN amounts (always present)
        counterMaterialCost: Number,
        counterWorkmanshipCost: Number,
        counterTotalCost: Number,
        // USD amounts (for international vendors)
        counterMaterialCostUSD: { type: Number, default: 0 },
        counterWorkmanshipCostUSD: { type: Number, default: 0 },
        counterTotalCostUSD: { type: Number, default: 0 },
        comment: String,
        timestamp: { type: Date, default: Date.now },
        },
    ],
}, { timestamps: true });



export default mongoose.model("MakeOffer", makeOfferSchema);