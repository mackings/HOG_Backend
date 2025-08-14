import mongoose from "mongoose"; 


const transactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
    },
    reference: {
        type: String,
        required: true
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
        required: true 
    },
    reason: {
        type: String,
    }
    }, 
    {
    timestamps: true
});

export default mongoose.model('Transaction', transactionSchema);