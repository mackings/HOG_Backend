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
    amount: {
        type: Number,
    },
    currency: {
        type: String,
    },
    reference: {
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
    }

},
    {
        timestamps: true,
    }
);

export default mongoose.model("Transactions", transactionSchema);
