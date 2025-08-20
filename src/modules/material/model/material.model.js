import mongoose from "mongoose";


const materialSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    attireType: {
        type: String,
        required: true,
    },
    clothMaterial: {
        type: String,
        required: true,
    },
    color: {
        type: String,
        required: true,
    },
    brand: {
        type: String,
    },
    measurement: {
        type: Array,
        required: true,
    },
    deliveryDate: {
        type: Date,
        required: true,
    },
    reminderDate: {
        type: Date,
        required: true,
    },
    sampleImage: {
        type: Array,
        required: true,
    },
    price: {
        type: Number,
    },
    vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
    },
    settlement: {
        type: Number,
        default: 0,
    },
    isDelivered: {
        type: Boolean,
        default: false,
    },
    specialInstructions: {
        type: String,
    },
},{
    timestamps: true,
});

const Material = mongoose.model('Material', materialSchema);

export default Material;




