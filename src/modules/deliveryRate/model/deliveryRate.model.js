import mongoose from 'mongoose';


const deliveryRateSchema = new mongoose.Schema({
    amount: { type: Number, required: true },
    deliveryType: { type: String },
}, { timestamps: true });


export default mongoose.model('DeliveryRate', deliveryRateSchema);