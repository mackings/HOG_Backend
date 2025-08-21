import mongoose from "mongoose";



const trackingSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    materialId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Material',
        required: true,
    },
    trackingNumber: {
        type: Number
    },
    isDelivered: {
        type: Boolean,
        default: false
    }

},{
    timestamps: true
});


const Tracking = mongoose.model('Tracking', trackingSchema);

export default Tracking;