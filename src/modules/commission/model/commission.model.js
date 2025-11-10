import mongoose from "mongoose";


const commissionSchema = new mongoose.Schema({
    amount: {
        type: Number,
        required: true
    }    
})

const Fee = mongoose.model("Commission", commissionSchema);

export default Fee;