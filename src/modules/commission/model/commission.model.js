import mongoose from "mongoose";


const commissionSchema = new mongoose.Schema({
    amount: {
        type: Number,
        required: true
    }    
})

const Commission = mongoose.model("Commission", commissionSchema);

export default Commission;