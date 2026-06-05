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
    bio: {
        type: String,
    },
    portfolioGallery: [
      {
        imageUrl: String,
        caption: String,
        category: {
          type: String,
          enum: ["bridal", "native_wear", "corporate", "casual", "menswear", "womenswear", "other"],
          default: "other",
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        isVisible: {
          type: Boolean,
          default: true,
        },
      },
    ],
    categorizedWorkSections: {
      bridal: { type: [String], default: [] },
      nativeWear: { type: [String], default: [] },
      corporate: { type: [String], default: [] },
      casual: { type: [String], default: [] },
      menswear: { type: [String], default: [] },
      womenswear: { type: [String], default: [] },
    },
    specializationTags: {
      type: [String],
      default: [],
    },
    turnaroundTime: {
      type: String,
    },
    availabilityStatus: {
      type: String,
      enum: ["available", "busy", "away", "unavailable"],
      default: "available",
    },
    completedOrdersCount: {
      type: Number,
      default: 0,
    },
    reviewsCount: {
      type: Number,
      default: 0,
    },
    isVerifiedDesigner: {
      type: Boolean,
      default: false,
    },
    verifiedAt: {
      type: Date,
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
