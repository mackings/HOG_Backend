import User from '../../user/model/user.model.js';
import Material from '../../material/model/material.model';
import Vendor from '../../vendor/model/vendor.model.js';
import Category from '../../category/model/category.model.js';
import InitializedOrder from '../../material/model/InitializedOrder.model.js';
import Transactions from '../../transaction/model/transaction.model.js';
import { sendTransactionEmail, sendSubscriptionEmail, sendTransactionListingEmail } from '../../../utils/emailService.utils.js';
import { cargoCalculateCost, expressCalculateCost, regularCalculateCost } from "../../../utils/shipmentCalcu.distance";
import axios from "axios";
import crypto from "crypto"
import mongoose from "mongoose";
import Review from '../../review/model/review.model.js';
import Tracking from '../../tracking/model/tracking.model.js';



export const createMaterial = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { categoryId } = req.params;
    let { clothMaterial, color, brand, measurement, yards, specialInstructions } = req.body;

    if (typeof measurement === "string") {
      try {
        measurement = JSON.parse(measurement);
      } catch (err) {
        return res.status(400).json({ message: "Invalid measurement format" });
      }
    }

    if (!clothMaterial || !color || !brand) {
      return res.status(400).json({
        message: "Cloth material, color, brand are required"
      });
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    // const vendor = await Vendor.findOne({ userId: id });
    // if (!vendor) {
    //   return res.status(404).json({ message: "Vendor not found" });
    // }

    const images = req.imageUrls || [];

    const material = await Material.create({
      userId: id,
      // vendorId: vendor._id,
      categoryId,
      attireType: category.name,
      clothMaterial,
      color,
      brand,
      measurement,
      yards,
      sampleImage: images,
      specialInstructions
    });

    return res.status(201).json({
      success: true,
      message: "Material created successfully",
      data: material
    });
  } catch (error) {
    next(error);
  }
};


export const getMaterialCategory = async (req, res, next) => {
  try {
    const { categoryId } = req.query;

    if (!categoryId) {
      return res.status(400).json({ message: "Category ID is required" });
    }

    const materials = await Material.find({ categoryId });

    if (!materials || materials.length === 0) {
      return res.status(404).json({ message: "Category Materials not found" });
    }

    return res.status(200).json({
      message: "Category materials fetched successfully",
      materials,
    });
  } catch (error) {
    next(error);
  }
};





export const getAllMaterials = async (req, res, next )=> {
    try {
        const { id } = req.user;
        const materials = await Material.find({ })
        // .populate('vendorId', 'businessName description ')
        .populate('userId', 'fullName email');
        if (materials.length === 0 || !materials ) {
            return res.status(404).json({ message: "Materials not found" });
        }
        return res.status(200).json({
            success: true,
            message: "Materials fetched successfully",
            data: materials
        });
    } catch (error) {
        next(error);
    }
};


export const getVendorDetails = async( req, res, next )=>{
  try {
    const { vendorId } = req.query;
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }
    const userProfile = await User.findById(vendor.userId).select('fullName email phoneNumber address image');
    return res.status(200).json({
      success: true,
      message: "Vendor fetched successfully",
      data: {
        vendor,
        userProfile
      }
    });
  } catch (error) {
    next(error);
  }
}


export const getMaterialById = async (req, res, next) => {
    try {
        const { id } = req.query;
        const material = await Material.findById(id);
        if (!material) {
            return res.status(404).json({ message: "Material not found" });
        }
        return res.status(200).json({
            success: true,
            message: "Material fetched successfully",
            data: material
        });
    } catch (error) {
        next(error);
    }
};


export const updateMaterial = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { materialId } = req.params;
    let { attireType, clothMaterial, color, brand, yards, measurement, price, deliveryDate, reminderDate, specialInstructions } = req.body;

    if (typeof measurement === "string") {
      try {
        measurement = JSON.parse(measurement);
      } catch (err) {
        return res.status(400).json({ message: "Invalid measurement format" });
      }
    }

    if (!attireType || !clothMaterial || !color || !brand ) {
      return res.status(400).json({
        message: "Attire type, cloth material, color, brand are required"
      });
    }

    let images = req.imageUrls;
    if (!images || images.length === 0) {
      const existing = await Material.findById(materialId);
      if (!existing) {
        return res.status(404).json({ message: "Material not found" });
      }
      images = existing.sampleImage;
    }

    const updatedMaterial = await Material.findByIdAndUpdate(
      materialId,
      {
        attireType,
        clothMaterial,
        color,
        brand,
        measurement,
        price,
        yards,
        deliveryDate,
        reminderDate,
        specialInstructions,
        sampleImage: images
      },
      { new: true }
    );

    if (!updatedMaterial) {
      return res.status(404).json({ message: "Material not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Material updated successfully",
      data: updatedMaterial
    });
  } catch (error) {
    next(error);
  }
};



export const deleteMaterial = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { materialId } = req.query;
    const material = await Material.findByIdAndDelete(materialId);

    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Material not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Material deleted successfully",
      data: material,
    });
  } catch (error) {
    next(error);
  }
};


export const searchMaterials = async (req, res, next) => {
  try {
    const { query } = req.query;
    const materials = await Material.find({
      $or: [
        { attireType: { $regex: query, $options: "i" } },
        { clothMaterial: { $regex: query, $options: "i" } },
        { color: { $regex: query, $options: "i" } },
        { brand: { $regex: query, $options: "i" } },
      ],
    });

    if (materials.length === 0) {
      return res.status(404).json({ message: "No materials found" });
    }

    return res.status(200).json({
      success: true,
      message: "Materials fetched successfully",
      data: materials,
    });
  } catch (error) {
    next(error);
  }
};



export const createPaymentOnline = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { amount, shipmentMethod, address } = req.body;
    const { reviewId } = req.params;

    if (!reviewId || !mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({ success: false, message: "Invalid review ID" });
    }
    // Validate user
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const review = await Review.findOne({ _id: reviewId });
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }
    // Validate material
    const material = await Material.findOne({ _id: review.materialId });
    if (!material) {
      return res.status(404).json({ success: false, message: "Material not found" });
    }

    // Validate vendor & material owner
    const [vendor, materialOwner] = await Promise.all([
      Vendor.findById(review.vendorId),
      User.findById(material.userId),
    ]);

    if (!vendor || !materialOwner) {
      return res.status(404).json({
        success: false,
        message: "Vendor or Material Owner has not updated material cost",
      });
    }

    const pickupAddress = vendor.address;
    const deliveryAddress = address || materialOwner.address;

    const geocodeReceiverResponse = await axios.get(`https://api.geoapify.com/v1/geocode/search`, {
        params: { text: deliveryAddress, apiKey: "14ea724d207e48ebabdcb893aa97217e" }
    });

    const Location = geocodeReceiverResponse.data.features;
    if (!Location.length) {
        return res.status(400).json({
            success: false,
            message: 'Invalid deliveryAddress provided',
            error: `Geocoding failed for deliveryAddress: ${deliveryAddress}`
        });
    }

    const deliveryLocation = {
        latitude: Location[0].geometry.coordinates[1],
        longitude: Location[0].geometry.coordinates[0]
    };

    // Geocode sender address
    const geocodeSenderResponse = await axios.get(`https://api.geoapify.com/v1/geocode/search`, {
        params: { text: pickupAddress, apiKey: "14ea724d207e48ebabdcb893aa97217e" }
    });

    const senderAddress = geocodeSenderResponse.data.features;
    if (!senderAddress.length) {
        return res.status(400).json({
            success: false,
            message: 'Invalid pickupAddress provided',
            error: `Geocoding failed for pickupAddress: ${pickupAddress}`
        });
    }

    const senderLocation = {
        latitude: senderAddress[0].geometry.coordinates[1],
        longitude: senderAddress[0].geometry.coordinates[0]
    };

    // Shipment costs
    const numberOfPackages = 1;
    const method = (shipmentMethod || "").trim().toLowerCase();
    if (!method) {
    return res.status(400).json({ success: false, message: "shipmentMethod is required" });
    }

    let shipmentCost;

    switch (method) {
    case "express":
        shipmentCost = await expressCalculateCost(deliveryLocation, senderLocation, numberOfPackages);
        break;
    case "cargo":
        shipmentCost = await cargoCalculateCost(deliveryLocation, senderLocation, numberOfPackages);
        break;
    case "regular":
        shipmentCost = await regularCalculateCost(deliveryLocation, senderLocation, numberOfPackages);
        break;
    default:
        return res.status(400).json({
        success: false,
        message: "Invalid shipment method. Choose Express, Cargo, or Regular.",
        });
    }
    const shipping = Math.round(shipmentCost);
    const cost = Number(amount)
    const totalCost = Math.round(shipping + cost);
    
    const paymentReference = crypto.randomBytes(5).toString("hex");

    const order = await InitializedOrder.create({
      userId: user._id,
      cartItems: [
        {
          vendorId: vendor._id,
          userId: user._id,
          attireType: material.attireType,
          clothMaterial: material.clothMaterial,
          color: material.color,
          brand: material.brand,
          measurement: material.measurement,
          sampleImage: material.sampleImage,
        },
      ],
      totalAmount: review.totalCost,
      paymentMethod: "Paystack",
      paymentReference,
      deliveryAddress,
      vendorId: vendor._id,
      materialId: material._id,
      reviewId,
      amountPaid: totalCost,
      paymentStatus: "full payment",
    });

    const countryCurrencyMapping = {
      nigeria: "NGN",
      "united kingdom": "GBP",
      "united states": "USD",
    };

    const userCountry = user.country?.toLowerCase().trim();

    const userCurrency = countryCurrencyMapping[userCountry] || "USD";
    // Paystack payment initialization
    const paystackResponse = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: user.email,
        amount: totalCost * 100, // Paystack accepts kobo
        currency: userCurrency,
        reference: paymentReference,
        callback_url: `${process.env.FRONTEND_URL}/payment-success`,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_MAIN_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Handle Paystack response
    if (paystackResponse.status === 200 && paystackResponse.data?.data) {
      return res.status(201).json({
        success: true,
        message: "Payment initialized successfully",
        authorizationUrl: paystackResponse.data.data.authorization_url,
        payment: order,
      });
    }

    // Rollback order if Paystack fails
    await InitializedOrder.findByIdAndDelete(order._id);
    return res.status(400).json({
      success: false,
      message: "Payment initialization failed",
      error: paystackResponse.data?.message || "Unknown error",
    });
  } catch (error) {
    next(error);
  }
};




export const createPartPaymentOnline = async (req, res, next) => {
  try {
    const { id } = req.user;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const { amount } = req.body;
    const { reviewId } = req.params;
    

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    const material = await Material.findOne({ _id: review.materialId });
    if (!material) {
      return res.status(404).json({ success: false, message: "Material not found" });
    }


    const vendor = await Vendor.findById(review.vendorId);
    const materialOwner = await User.findById(material.userId);
    if (!vendor || !materialOwner) {
      return res.status(404).json({ success: false, message: "Vendor or Material Owner has not yet update material cost" });
    }

    const paymentMethod = "Paystack";
    // const orderPercent = amount * 0.1;
    // const totalCost = Math.round(shipmentCost + amount + orderPercent);
    const paymentReference = crypto.randomBytes(5).toString("hex");

    const order = await InitializedOrder.create({
      userId: user._id,
      cartItems: [{
        attireType: material.attireType,
        clothMaterial: material.clothMaterial,
        color: material.color,
        brand: material.brand,
        measurement: material.measurement,   
        sampleImage: material.sampleImage, 
      }],
      totalAmount: review.totalCost,
      paymentMethod,
      paymentReference,
      vendorId: vendor._id,
      materialId: material._id,
      reviewId,
      amountPaid: amount,
      paymentStatus: "part payment" 
    });

    const countryCurrencyMapping = {
      nigeria: "NGN",
      "united kingdom": "GBP",
      "united states": "USD",
    };

    const userCountry = user.country?.toLowerCase().trim();

    const userCurrency = countryCurrencyMapping[userCountry] || "USD";

    const paystackUrl = "https://api.paystack.co/transaction/initialize";
    const paystackResponse = await axios.post(
        paystackUrl,
        {
            email: user.email,
            amount: order.amountPaid * 100,
            currency: userCurrency,
            reference: order.paymentReference,
            callback_url: `${process.env.FRONTEND_URL}/payment-success`,
        },
        {
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_MAIN_KEY}`,
                "Content-Type": "application/json",
            },
        }
    );
    
    if (paystackResponse.status === 200) {
      return res.status(201).json({
        success: true,
        message: "Payment initialized successfully",
        authorizationUrl: paystackResponse.data.data.authorization_url,
        payment: order
      });  
    }else {
      await InitializedOrder.findByIdAndDelete(order._id);  
      return res.status(400).json({ success: false, message: "Payment initialization failed", error: paystackResponse.data.message });
    }      
    } catch (error) {
    next(error);
  }
};



export const orderWebhook = async (req, res, next) => {
  try {
    const { data, event } = req.body;

    if (event !== "charge.success") {
      return res.status(200).json({ message: "Unhandled event" });
    }

    const { reference } = data;

    const order = await InitializedOrder.findOne({ paymentReference: reference });
    if (!order) {
      return res.status(200).json({
        success: false,
        message: "Order not found",
      });
    }

      const existingTransaction = await Transactions.findOne({ paymentReference: reference });
      if (existingTransaction) {
        return res.status(200).json({
          success: true,
          message: "Transaction already processed",
        });
      }

    const transaction = await Transactions.create({
      userId: order.userId,
      cartItems: order.cartItems,
      totalAmount: order.totalAmount,
      paymentMethod: order.paymentMethod,
      paymentReference: order.paymentReference,
      deliveryAddress: order.deliveryAddress,
      paymentStatus: "success",
      subscriptionEndDate: order.subscriptionEndDate,
      subscriptionStartDate: order.subscriptionStartDate,
      plan: order.plan,
      billTerm: order.billTerm,
      paymentCurrency: "NGN",
      orderStatus: order.paymentStatus,
      amountPaid: order.amountPaid,
      vendorId: order.vendorId || null,
      materialId: order.materialId || null,
    });

    if (["Standard", "Premium", "Enterprise"].includes(transaction.plan)) {
      const user = await User.findById(transaction.userId);

      if (user) {
        await User.findByIdAndUpdate(
          transaction.userId,
          {
            $set: {
              subscriptionEndDate: transaction.subscriptionEndDate,
              subscriptionStartDate: transaction.subscriptionStartDate,
              subscriptionPlan: transaction.plan.toLowerCase(),
              billTerm: transaction.billTerm,
            },
          },
          { new: true }
        );

        await sendSubscriptionEmail(user, transaction.totalAmount);
      }

      await InitializedOrder.findByIdAndDelete(order._id);

      return res.status(200).json({
        success: true,
        message: "Subscription payment successful",
        order: transaction,
      });
    }

    // ✅ If it's a vendor/material purchase
    if (order.vendorId && order.materialId) {
      const [user, vendor, material, review] = await Promise.all([
        User.findById(order.userId),
        Vendor.findById(order.vendorId),
        Material.findById(order.materialId),
        Review.findById(order.reviewId),
      ]);

      if (vendor?.userId) {
        if (order.paymentStatus === "part payment") {
          const deltaPaid = order.amountPaid;
          const remaining = order.totalAmount - order.amountPaid;

          await User.findByIdAndUpdate(
            vendor.userId,
            { $inc: { wallet: deltaPaid } },
            { new: true }
          );

          await Review.findByIdAndUpdate(
            review._id,
            { 
              $set: { status: order.paymentStatus },
              $inc: { amountPaid: deltaPaid, amountToPay: remaining }
            },
            { new: true }
          );
        }

        if (order.paymentStatus === "full payment") {
          const balance = order.amountPaid;

          await User.findByIdAndUpdate(
            vendor.userId,
            { $inc: { wallet: balance } },
            { new: true }
          );

          await Review.findByIdAndUpdate(
            review._id,
            { 
              $set: { status: order.paymentStatus, amountToPay: 0 }, 
              $inc: { amountPaid: balance }
            },
            { new: true }
          );
        }
      }

    if (user && vendor && material && (order.paymentStatus === "part payment" || order.paymentStatus === "full payment")) {
      await sendTransactionEmail(user, vendor.businessEmail, transaction, material);
    }

    }

    if (Array.isArray(order.listingId) && order.listingId.length > 0) {
      const track = await Tracking.findOneAndUpdate(
        { reference: order.paymentReference },
        { $set: { status: "success" } },
        { new: true }
      );

      const user = await User.findById(order.userId);
      const owner = await User.findById(order.vendorId);

      await sendTransactionListingEmail(owner, user.email, transaction);
    } else {
      const track = await Tracking.findOneAndUpdate(
        { reference: order.paymentReference },
        { $set: { status: "success" } },
        { new: true }
      );

      const user = await User.findById(track.userId);
      const owner = await User.findById(track.vendorId);

      await sendTransactionListingEmail(owner, user.email, transaction);
    }


    await InitializedOrder.findByIdAndDelete(order._id);

    return res.status(200).json({
      success: true,
      message: "Payment successful",
      order: transaction,
    });
  } catch (error) {
    next(error);
  }
};


export const deleteAllMaterial = async (req, res, next) => {
  try {
    const result = await Material.deleteMany();

    return res.status(200).json({
      success: true,
      message: result.deletedCount > 0 
        ? `${result.deletedCount} materials deleted successfully` 
        : "No materials found to delete",
    });
  } catch (error) {
    next(error);
  }
};
