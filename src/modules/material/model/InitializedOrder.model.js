import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema({
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
    type: Array,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
}, { _id: false });

const initializedOrderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User",
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "Vendor",
  }, 
  materialId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "Material",
  },
  cartItems: {
    type: [cartItemSchema],
    required: true,
  },
  totalAmount: {
    type: Number,
    required: true,
  },
  orderStatus: {
    type: String,
    default: "Not Processed",
  },
  paymentMethod: {
    type: String,
  },
  paymentReference: {
    type: String,
  },
  deliveryAddress: {
    type: Object,
  },
  paymentStatus: {
    type: String,
    default: "pending",
  },
  amountPaid: {
    type: Number,
    default: 0,
  },
}, { timestamps: true });

export default mongoose.model("InitializedOrder", initializedOrderSchema);
