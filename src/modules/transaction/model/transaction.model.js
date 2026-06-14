import mongoose from "mongoose";


const transactionSchema = new mongoose.Schema({
    userId:{
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "User",
    },
    vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Vendor",
    },
      materialId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Material",
    },
    listingId: [{ type: mongoose.Schema.Types.ObjectId, ref: "Listing" }],
    cartItems: {
        type: Array,
    },
    totalAmount: {
        type: Number,
    },
    paymentMethod: {
        type: String,
    },
    paymentReference: {
        type: String,
    },
    deliveryAddress: {
        type: Object,
    },
    paymentStatus: {
        type: String,
    },
    paymentCurrency: {
        type: String,
        default: "NGN",
    },
    orderStatus: {
        type: String,
        default: "completed",
    },
    paymentStatus: {
        type: String,
    },
    amountPaid: {
        type: Number,
        default: 0,
    },
    title: {
        type: String,
    },
    accountName: {
        type: String,
    },
    bankName: {
        type: String,
    },
    accountNumber: {
        type: String,
    },
    billTerm: {
        type: String,
    },
    destination: {
        type: String,
    },
    sessionId: {
        type: String
    },
    status: {
        type: String,
    },
    reason: {
        type: String,
    },
    plan: {
        type: String,
    },
    planId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Plan",
    },
    planBenefits: {
        type: [String],
        default: [],
    },
    subscriptionStartDate: {
        type: Date,
    },
    subscriptionEndDate: {
        type: Date,
    },
    receiverAccountNumber: {
        type: String,
    },
    receiverBank: {
        type: String,
    },
    senderBank: {
        type: String,
    },
    senderBankAccountNumber: {
        type: String,
    },
    senderName: {
        type: String,
    },
    transactionType: {
        type: String,
    }
},
    {
        timestamps: true,
    }
);

transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ paymentStatus: 1, createdAt: -1 });
transactionSchema.index({ orderStatus: 1, createdAt: -1 });
transactionSchema.index({ status: 1, createdAt: -1 });
transactionSchema.index({ transactionType: 1, createdAt: -1 });
transactionSchema.index({ paymentCurrency: 1, createdAt: -1 });

export default mongoose.model("Transactions", transactionSchema);
