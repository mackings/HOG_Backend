import mongoose from "mongoose";


const materialSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
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
    },
    yards: {
        type: Number,
    },
    sampleImage: {
        type: Array,
        required: true,
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




