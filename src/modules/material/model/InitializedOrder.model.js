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
}, { _id: false });

const initializedOrderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Vendor",
  }, 
  materialId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Material",
  },
  cartItems: {
    type: [cartItemSchema],
  },
  totalAmount: {
    type: Number,
  },
  orderStatus: {
    type: String,
    default: "Not Processed",
  },
  billTerm: {
    type: String,
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
  title: {
      type: String,
  },
  accountName: {
      type: String,
  },
  bankName: {
      type: String,
  },
  accountNumber: {
      type: String,
  },
  destination: {
      type: String,
  },
  sessionId: {
      type: String
  },
  status: {
      type: String,
  },
  reason: {
      type: String,
  },
  plan: {
  type: String,
  },
  subscriptionStartDate: {
      type: Date,
  },
  subscriptionEndDate: {
      type: Date,
  },
}, { timestamps: true });

export default mongoose.model("InitializedOrder", initializedOrderSchema);
