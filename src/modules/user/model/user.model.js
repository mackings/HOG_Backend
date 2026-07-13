import mongoose from "mongoose";

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
    username: {
        type: String,
        lowercase: true,
        trim: true,
        unique: true,
        sparse: true,
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
    mustChangePassword: {
        type: Boolean,
        default: false
    },
    invitedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    invitedAt: {
        type: Date,
        default: null
    },
    image: {
        type: String,
    },
    wallet: {
        type: Number,
        default: 0
    },
    walletUSD: {
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
        enum: ['starter', 'free', 'standard', 'premium', 'elite', 'enterprise'],
        default: 'starter',
    },
    activeCommissionRate: {
        type: Number,
        default: 15,
    },
    isOnTrial: {
        type: Boolean,
        default: false,
    },
    trialEndsAt: {
        type: Date,
        default: null,
    },
    trialPlan: {
        type: String,
        default: null,
    },
    scheduledDowngrade: {
        plan: { type: String, default: null },
        effectiveDate: { type: Date, default: null },
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
        enum: ['user', 'admin', 'superAdmin', 'tailor', 'finance', 'customerService', 'listingManager'],
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

userSchema.index({ createdAt: -1 });
userSchema.index({ role: 1, createdAt: -1 });
userSchema.index({ subscriptionPlan: 1, createdAt: -1 });
userSchema.index({ isVerified: 1, createdAt: -1 });
userSchema.index({ isBlocked: 1, createdAt: -1 });
userSchema.index({ invitedBy: 1, invitedAt: -1 });

export default mongoose.model('User', userSchema);
