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
    sampleImage: {
        type: String,
        required: true,
    },
    price: {
        type: String,
        required: true,
    },
},{
    timestamps: true,
});

const Material = mongoose.model('Material', materialSchema);

export default Material;




