import mongoose from 'mongoose';


const deliveryRateSchema = new mongoose.Schema({
    amount: { type: Number, required: true },
    deliveryType: { type: String, required: true },
    currency: { type: String, enum: ["NGN", "USD"], default: "NGN" },
}, { timestamps: true });


export default mongoose.model('DeliveryRate', deliveryRateSchema);
