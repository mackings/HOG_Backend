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
    billImage: {
        type: String,
        default: null
    },
    phoneNumber: {
        type: String,
        default: null
    },
    role: {
        type: String,
        enum: ['user', 'admin', 'tailor'],
        default: 'user'
    }

},
    {
        timestamps: true
    }
);

export default mongoose.model('User', userSchema);