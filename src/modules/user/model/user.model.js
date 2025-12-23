import mongoose from "mongoose";
import { type } from "os";

const userSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        validate: {
            validator: function (v) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
            },
            message: props => `${props.value} is not a valid email address!`
        }
    },
    password: {
        type: String,
        required: true,
        validate: {
            validator: function (v) {
                return v.length >= 8;
            },
            message: props => `${props.value} is not a valid password!`
        }
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    image: {
        type: String,
    },
    wallet: {
        type: Number,
        default: 0
    },
    commission: {
        type: Number,
    },
    tax: {
        type: Number,
    },
    billImage: {
        type: String,
        default: null
    },
    address: {
        type: String,
        required: true
    },
    subscriptionPlan: {
        type: String,
        enum: ['free', 'premium', 'standard', 'enterprise'],
        default: 'free'
    },  
    subscriptionStartDate: {
        type: Date,
    },
    subscriptionEndDate: {
        type: Date,
    },
    billTerm: {
        type: String,
    },
    phoneNumber: {
        type: String,
    },
    rapydWalletId: {
        type: String,
    },
    rapydVirtualAccountId: {
        type: String,
    },
    issueBankAccountId: { 
        type: String,
    },
    accountName: {
        type: String,
    },
    routingNumber: {
        type: String,
    },
    accountNumber: {
        type: String,
    },
    stripeId: {
        type: String
    },
    bankName: {
        type: String,
    },
    role: {
        type: String,
        enum: ['user', 'admin', 'tailor'],
        default: 'user'
    },
    isVendorEnabled: {
        type: Boolean,
        default: false
    },
    country: {
        type: String,
        default: 'Nigeria'
    }

},
    {
        timestamps: true
    }
);

export default mongoose.model('User', userSchema);