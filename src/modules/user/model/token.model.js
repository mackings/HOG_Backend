const mongoose = require('mongoose');


const tokenSchema = new mongoose.Schema({
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
    phoneNumber: {
        type: String,
        default: null
    },
    token: {
        type: String,
        required: true
    },
    role: { 
        type: String
    },
    address: {
        type: String,
        required: true
    },
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: 0 },
        default: new Date(Date.now() + 15 * 60 * 1000)
    }
},
    {
        timestamps: true
    }
);

export default mongoose.model('Token', tokenSchema);