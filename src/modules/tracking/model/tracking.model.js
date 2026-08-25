import mongoose from "mongoose";



const trackingSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    materialId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Material',
        required: true,
    },
    trackingNumber: {
        type: Number
    },
    isDelivered: {
        type: Boolean,
        default: false
    },
    amount: {
        type: Number
    },
    status: {
        type: String
    },
    reference: {
        type: String
    },
    listingId: [{ type: mongoose.Schema.Types.ObjectId, ref: "Listing" }],

    // Carrier integration fields
    carrier: {
        type: String,
        enum: ["fedex", "dhl", "fez", "internal"],
        default: "internal",
    },
    carrierTrackingNumber: {
        type: String, // official carrier tracking number
    },
    serviceType: {
        type: String, // e.g. "FEDEX_EXPRESS_SAVER" or DHL product code "P"
    },
    labelBase64: {
        type: String, // base64-encoded shipping label
    },
    labelFormat: {
        type: String,
        enum: ["PDF", "PNG", "ZPLII", "pdf", "zpl"],
        default: "PDF",
    },
    shipmentCreatedAt: {
        type: Date,
    },

},{
    timestamps: true
});


const Tracking = mongoose.model('Tracking', trackingSchema);

export default Tracking;