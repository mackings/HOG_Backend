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
    // NGN amounts (primary storage - always in Naira)
    materialTotalCost: {
        type: Number,
        default: 0,
    },
    workmanshipTotalCost: {
        type: Number,
        default: 0,
    },
    subTotalCost: {
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
    // USD amounts (for international vendors only)
    materialTotalCostUSD: {
        type: Number,
        default: 0,
    },
    workmanshipTotalCostUSD: {
        type: Number,
        default: 0,
    },
    subTotalCostUSD: {
        type: Number,
        default: 0,
    },
    totalCostUSD: {
        type: Number,
        default: 0,
    },
    amountPaidUSD: {
        type: Number,
        default: 0,
    },
    amountToPayUSD: {
        type: Number,
        default: 0,
    },
    
    // 🔥 NEW: Final negotiated amounts (set when offer is accepted)
    // These represent the amounts BEFORE tax and commission are applied
    finalMaterialCost: {
        type: Number,
    },
    finalWorkmanshipCost: {
        type: Number,
    },
    finalTotalCost: {
        type: Number,
    },
    finalMaterialCostUSD: {
        type: Number,
    },
    finalWorkmanshipCostUSD: {
        type: Number,
    },
    finalTotalCostUSD: {
        type: Number,
    },
    // Preserve the tailor's submitted quote (base amounts before tax/commission)
    quotationMaterialCost: {
        type: Number,
    },
    quotationWorkmanshipCost: {
        type: Number,
    },
    quotationTotalCost: {
        type: Number,
    },
    quotationMaterialCostUSD: {
        type: Number,
    },
    quotationWorkmanshipCostUSD: {
        type: Number,
    },
    quotationTotalCostUSD: {
        type: Number,
    },
    // Payout amounts resolved at mutual consent:
    // payoutBaseAmount = min(quotationTotalCost, agreed offer total)
    // payoutCommissionAmount = payoutBaseAmount * vatRate
    // payoutNetAmount = payoutBaseAmount - payoutCommissionAmount
    payoutBaseAmount: {
        type: Number,
    },
    payoutCommissionAmount: {
        type: Number,
    },
    payoutNetAmount: {
        type: Number,
    },
    payoutBaseAmountUSD: {
        type: Number,
    },
    payoutCommissionAmountUSD: {
        type: Number,
    },
    payoutNetAmountUSD: {
        type: Number,
    },
    
    exchangeRate: {
        type: Number,
        default: 0,
    },
    isInternationalVendor: {
        type: Boolean,
        default: false,
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
    country: {
        type: String,
    },
    hasAcceptedOffer: {
        type: Boolean,
        default: false,
    },
    acceptedOfferId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MakeOffer",
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
