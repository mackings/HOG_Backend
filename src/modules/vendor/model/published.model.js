import mongoose from "mongoose";


const PublishedSchema = new mongoose.Schema({
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
    clothPublished: {
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
    sampleImage: {
        type: Array,
        required: true,
    }
},{
    timestamps: true,
});

const Published = mongoose.model('Published', PublishedSchema);

export default Published;




