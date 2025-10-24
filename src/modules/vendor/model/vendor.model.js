import mongoose from "mongoose";


const vendorSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    businessName: {
        type: String,
        required: true,
    },
    businessRegistrationNumber: {
        type: String,
    },
    registeredIn: {
        type: String,
    },
    businessEmail: {
        type: String,
        required: true,
    },
    businessPhone: {
        type: String,
        required: true,
    },
    address: {
        type: String,
        required: true,
    },
    nepaBill: {
        type: String,
        required: true,
    },
    city: {
        type: String,
        required: true,
    },
    state: {
        type: String,
        required: true,
    },
    yearOfExperience: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    ratings: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        value: {
          type: Number,
          min: 1,
          max: 5,
        },
      },
    ],
    totalRatings: {
        type: Number,
        default: 0,
    },
    ratingSum: {
        type: Number,
        default: 0,
    },

},{
    timestamps: true,
});

const Vendor = mongoose.model('Vendor', vendorSchema);

export default Vendor;