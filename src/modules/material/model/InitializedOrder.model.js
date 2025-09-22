import mongoose from "mongoose";
import { title } from "process";

const cartItemSchema = new mongoose.Schema({
  attireType: {
    type: String,
  },
  clothMaterial: {
    type: String,
  },
  title: {
    type: String,
  },
  size: {
    type: String,
  },
  description: {
    type: String,
  },
  condition: {
    type: String,
  },
  amount: {
    type: Number,
  },
  images: {
    type: Array,
  },
  color: {
    type: String,
  },
  brand: {
    type: String,
  },
  measurement: {
    type: Array,
  },
  sampleImage: {
    type: Array,
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
  reviewId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Review",
  },
  listingId: [{ type: mongoose.Schema.Types.ObjectId, ref: "Listing" }],
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
