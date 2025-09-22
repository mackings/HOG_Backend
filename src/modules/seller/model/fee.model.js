import mongoose from "mongoose";



const feeSchema = new mongoose.Schema({
    amount: {
        type: Number,
        required: true,
    }
});

export default mongoose.model("Fee", feeSchema);