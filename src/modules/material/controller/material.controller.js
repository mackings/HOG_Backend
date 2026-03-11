import User from '../../user/model/user.model.js';
import Material from '../../material/model/material.model.js';
import Vendor from '../../vendor/model/vendor.model.js';
import Category from '../../category/model/category.model.js';
import InitializedOrder from '../../material/model/InitializedOrder.model.js';
import Transactions from '../../transaction/model/transaction.model.js';
import { sendTransactionEmail, sendSubscriptionEmail, sendTransactionListingEmail } from '../../../utils/emailService.utils.js';
import { cargoCalculateCost, expressCalculateCost, regularCalculateCost, resolveDeliveryCurrency } from "../../../utils/shipmentCalcu.distance.js";
import axios from "axios";
import crypto from "crypto"
import mongoose from "mongoose";
import Review from '../../review/model/review.model.js';
import Tracking from '../../tracking/model/tracking.model.js';
import { getPricingRates } from '../../../utils/pricingConfig.utils.js';


const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeAddressForGeocode = (rawAddress, country) => {
  let address = String(rawAddress || "").trim();
  address = address.replace(/[\r\n]+/g, ", ");
  address = address.replace(/\b(no\.?)\s+/gi, "Number ");
  // Add a comma after "state" when followed by more text.
  address = address.replace(/\bstate\b(?!\s*,|\s*$)/gi, "State,");
  address = address.replace(/\s*,\s*/g, ", ");
  address = address.replace(/\s+/g, " ");
  address = address.replace(/[.,]+$/g, "");

  const countryValue = String(country || "").trim();
  if (countryValue) {
    const countryRegex = new RegExp(`\\b${escapeRegex(countryValue)}\\b`, "i");
    if (!countryRegex.test(address)) {
      address = `${address}, ${countryValue}`;
    } else {
      // Ensure country is separated by a comma for better geocoding.
      const countryAtEnd = new RegExp(`\\s+${escapeRegex(countryValue)}\\s*$`, "i");
      address = address.replace(countryAtEnd, `, ${countryValue}`);
    }
  }

  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.join(", ");
};

const geocodeWithFallback = async (address) => {
  // OpenCage primary (requires OPENCAGE_KEY)
  const openCageKey = process.env.OPENCAGE_KEY;
  if (!openCageKey) return null;

  try {
    const openCageResponse = await axios.get(`https://api.opencagedata.com/geocode/v1/json`, {
      params: {
        key: openCageKey,
        q: address,
        limit: 1,
        no_annotations: 1,
      },
    });
    const result = openCageResponse.data?.results?.[0]?.geometry;
    if (result?.lat != null && result?.lng != null) {
      return {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lng),
      };
    }
  } catch (error) {
    return null;
  }

  return null;
};

const buildPayoutBreakdown = (review) => {
  if (!review) return null;
  const quotationBase = Number(review.quotationTotalCost ?? review.subTotalCost ?? 0);
  const agreedBase = Number(review.finalTotalCost ?? review.subTotalCost ?? 0);
  const payoutBaseUsed = Number(
    review.payoutBaseAmount ??
      Math.min(Math.max(0, quotationBase), Math.max(0, agreedBase))
  );
  const commissionDeducted = Number(
    review.payoutCommissionAmount ?? review.commission ?? 0
  );
  const designerNetCredit = Number(
    review.payoutNetAmount ?? Math.max(0, payoutBaseUsed - commissionDeducted)
  );

  return {
    quotationBase,
    agreedBase,
    payoutBaseUsed,
    commissionDeducted,
    designerNetCredit,
  };
};



export const createMaterial = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { categoryId } = req.params;
    let { clothMaterial, color, brand, measurement, specialInstructions, attireType } = req.body;

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

    let finalCategoryId = null;
    let finalAttireType = null;

    // If categoryId is provided, validate and use it
    if (categoryId && categoryId !== 'null' && categoryId !== 'undefined') {
      const category = await Category.findById(categoryId);
      if (!category) {
        return res.status(404).json({
          message: "Category not found. Please provide a valid category ID.",
          hint: "Call GET /api/v1/category/getAllCategories to get available categories"
        });
      }
      finalCategoryId = categoryId;
      finalAttireType = category.name;
    } else {
      // If no categoryId, attireType must be provided in body
      if (!attireType) {
        return res.status(400).json({
          message: "Either categoryId or attireType must be provided",
          hint: "You can either select a category or provide attireType in the request body"
        });
      }
      finalAttireType = attireType;
    }

    // const vendor = await Vendor.findOne({ userId: id });
    // if (!vendor) {
    //   return res.status(404).json({ message: "Vendor not found" });
    // }

    const images = req.imageUrls || [];

    const materialData = {
      userId: id,
      // vendorId: vendor._id,
      clothMaterial,
      color,
      brand,
      measurement,
      sampleImage: images,
      specialInstructions,
      attireType: finalAttireType
    };

    // Only add categoryId if it exists
    if (finalCategoryId) {
      materialData.categoryId = finalCategoryId;
    }

    const material = await Material.create(materialData);

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
    let { attireType, clothMaterial, color, brand, measurement, price, deliveryDate, reminderDate, specialInstructions } = req.body;

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
    const { amount, shipmentMethod, address, paymentStatus } = req.body;
    const { reviewId } = req.params;

    if (!address || typeof address !== "string" || !address.trim()) {
      return res.status(400).json({
        success: false,
        message: "Delivery address is required for payment.",
      });
    }

    if (!reviewId || !mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({ success: false, message: "Invalid review ID" });
    }
    // Validate user
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const review = await Review.findOne({ _id: reviewId }).populate('acceptedOfferId');
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    // Check if negotiation requires mutual consent
    if (review.hasAcceptedOffer && review.acceptedOfferId) {
      const MakeOffer = (await import('../../makeOffer/model/makeOffer.model.js')).default;
      const offer = await MakeOffer.findById(review.acceptedOfferId);

      if (offer && !offer.mutualConsentAchieved) {
        return res.status(400).json({
          success: false,
          message: "Payment cannot proceed. Both buyer and vendor must consent to the negotiated offer before payment.",
          requiresMutualConsent: true,
          buyerConsent: offer.buyerConsent,
          vendorConsent: offer.vendorConsent,
          offerId: offer._id
        });
      }
    }

    // Negotiation is optional - users can pay without negotiating
    // If they negotiated and achieved mutual consent, use those amounts
    // Otherwise, use the original quote amounts
    const payoutBreakdown = buildPayoutBreakdown(review);

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

    const vendorUser = await User.findById(vendor.userId);
    const pickupAddress = normalizeAddressForGeocode(vendor.address, vendorUser?.country || user.country);
    const deliveryAddress = normalizeAddressForGeocode(address, user.country);
    const deliveryCurrency = resolveDeliveryCurrency(user.country, vendorUser?.country || vendor.country);

    const deliveryLocation = await geocodeWithFallback(deliveryAddress);
    if (!deliveryLocation) {
      return res.status(400).json({
        success: false,
        message: "Invalid deliveryAddress provided",
        error: `Geocoding failed for deliveryAddress: ${deliveryAddress}`,
      });
    }

    const senderLocation = await geocodeWithFallback(pickupAddress);
    if (!senderLocation) {
      return res.status(400).json({
        success: false,
        message: "Invalid pickupAddress provided",
        error: `Geocoding failed for pickupAddress: ${pickupAddress}`,
      });
    }

    // Shipment costs
    const numberOfPackages = 1;
    const method = (shipmentMethod || "").trim().toLowerCase();
    if (!method) {
    return res.status(400).json({ success: false, message: "shipmentMethod is required" });
    }

    let shipmentCost;

    switch (method) {
    case "express":
        shipmentCost = await expressCalculateCost(deliveryLocation, senderLocation, numberOfPackages, deliveryCurrency);
        break;
    case "cargo":
        shipmentCost = await cargoCalculateCost(deliveryLocation, senderLocation, numberOfPackages, deliveryCurrency);
        break;
    case "regular":
        shipmentCost = await regularCalculateCost(deliveryLocation, senderLocation, numberOfPackages, deliveryCurrency);
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
      paymentStatus: paymentStatus || "full payment", // Support both part and full payment
    });

    const countryCurrencyMapping = {
      nigeria: "NGN",
      // "united kingdom": "GBP",
      // "united states": "USD",
    };

    const userCountry = user.country?.toLowerCase().trim();

    const userCurrency = countryCurrencyMapping[userCountry] || "NGN";
    // Paystack payment initialization
    const paystackResponse = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: user.email,
        amount: totalCost * 100, // Paystack accepts kobo
        currency: userCurrency,
        reference: paymentReference,
        callback_url: `${process.env.FRONTEND_URL}/payment-success`,
        metadata: {
          custom_fields: [
            { display_name: "Product Amount", variable_name: "product_amount", value: cost },
            { display_name: `Delivery Fee (${method})`, variable_name: "delivery_fee", value: shipping },
            { display_name: "Total", variable_name: "total_amount", value: totalCost },
          ],
        },
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
        breakdown: {
          currency: userCurrency,
          productCost: cost,
          deliveryFee: shipping,
          total: totalCost,
          deliveryMethod: method,
        },
        payoutBreakdown,
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

    const { amount, address } = req.body;
    const { reviewId } = req.params;
    
    if (!address || typeof address !== "string" || !address.trim()) {
      return res.status(400).json({
        success: false,
        message: "Delivery address is required for payment.",
      });
    }

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
      deliveryAddress: address.trim(),
      vendorId: vendor._id,
      materialId: material._id,
      reviewId,
      amountPaid: amount,
      paymentStatus: "part payment" 
    });

    const countryCurrencyMapping = {
      nigeria: "NGN",
      // "united kingdom": "GBP",
      // "united states": "USD",
    };

    const userCountry = user.country?.toLowerCase().trim();

    const userCurrency = countryCurrencyMapping[userCountry] || "NGN";

    const paystackUrl = "https://api.paystack.co/transaction/initialize";
    const paystackResponse = await axios.post(
        paystackUrl,
        {
            email: user.email,
            amount: order.amountPaid * 100,
            currency: userCurrency,
            reference: order.paymentReference,
            callback_url: `${process.env.FRONTEND_URL}/payment-success`,
            metadata: {
              custom_fields: [
                { display_name: "Part Payment Amount", variable_name: "part_payment_amount", value: order.amountPaid },
                { display_name: "Delivery Fee", variable_name: "delivery_fee", value: 0 },
              ],
            },
        },
        {
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_MAIN_KEY}`,
                "Content-Type": "application/json",
            },
        }
    );
    
    if (paystackResponse.status === 200) {
      const payoutBreakdown = buildPayoutBreakdown(review);
      return res.status(201).json({
        success: true,
        message: "Payment initialized successfully",
        authorizationUrl: paystackResponse.data.data.authorization_url,
        payment: order,
        breakdown: {
          currency: userCurrency,
          productCost: order.amountPaid,
          deliveryFee: 0,
          total: order.amountPaid,
          deliveryMethod: "part payment",
        },
        payoutBreakdown,
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
    const receiverAccountNumber = data.metadata?.receiver_account_number;

  if(receiverAccountNumber) {

     const user = await User.findOne({ accountNumber: receiverAccountNumber });

    if (!user) {
      console.error("User not found for account number:", receiverAccountNumber);
      return res.status(200).json({ success: true });
    }

    const amount = data.amount / 100;

    await User.findByIdAndUpdate(user._id, {
      $inc: { wallet: amount },
    });

    await Transactions.create({
      userId: user._id,
      totalAmount: amount,
      status: data.status,
      transactionType: "credit",
      paymentReference: reference || null,
      receiverAccountNumber,
      paymentCurrency: data.currency,
      receiverBank: "HoG",
      senderBank: data.authorization?.sender_bank || "",
      senderBankAccountNumber: data.authorization?.sender_bank_account_number || "",
      senderName: data.authorization?.sender_name || "",
      reason: data.authorization?.narration || "",
      sessionId: data.authorization?.session_id || reference,
    });
  }

  if(reference){
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

    let payoutBreakdown = null;
    // ✅ If it's a vendor/material purchase
    if (order.vendorId && order.materialId) {
      const [user, vendor, material, review] = await Promise.all([
        User.findById(order.userId),
        Vendor.findById(order.vendorId),
        Material.findById(order.materialId),
        Review.findById(order.reviewId),
      ]);

      if (vendor?.userId) {
        // Calculate new amounts after this payment
        const deltaPaid = order.amountPaid;
        const newAmountPaid = (review.amountPaid || 0) + deltaPaid;
        const newAmountToPay = order.paymentStatus === "full payment"
          ? 0
          : Math.max(0, review.totalCost - newAmountPaid);
        const isAcceptedOfferFlow = Boolean(review?.hasAcceptedOffer && review?.acceptedOfferId);
        let platformFee = (review.tax || 0) + (review.commission || 0);
        let vendorCredit = order.paymentStatus === "full payment"
          ? Math.max(0, deltaPaid - platformFee)
          : deltaPaid;

        // For mutually-consented offers, pay vendor based on:
        // the lower of the submitted quote and agreed offer amount, minus company commission
        if (order.paymentStatus === "full payment" && isAcceptedOfferFlow) {
          const { vatRate } = await getPricingRates();
          const quotationBase = Number(review.quotationTotalCost ?? review.subTotalCost ?? 0);
          const agreedBase = Number(review.finalTotalCost ?? review.subTotalCost ?? 0);
          const payoutBase = Number.isFinite(Number(review.payoutBaseAmount))
            ? Number(review.payoutBaseAmount)
            : Math.min(Math.max(0, quotationBase), Math.max(0, agreedBase));
          const payoutCommission = Number.isFinite(Number(review.payoutCommissionAmount))
            ? Number(review.payoutCommissionAmount)
            : payoutBase * vatRate;
          const payoutNet = Number.isFinite(Number(review.payoutNetAmount))
            ? Number(review.payoutNetAmount)
            : Math.max(0, payoutBase - payoutCommission);

          platformFee = Math.max(0, payoutCommission);
          vendorCredit = Math.max(0, payoutNet);
        }
        payoutBreakdown = {
          quotationBase: Number(review.quotationTotalCost ?? review.subTotalCost ?? 0),
          agreedBase: Number(review.finalTotalCost ?? review.subTotalCost ?? 0),
          payoutBaseUsed: isAcceptedOfferFlow
            ? Number(
              review.payoutBaseAmount ??
              Math.min(
                Math.max(0, Number(review.quotationTotalCost ?? review.subTotalCost ?? 0)),
                Math.max(0, Number(review.finalTotalCost ?? review.subTotalCost ?? 0))
              )
            )
            : Number(review.subTotalCost ?? 0),
          commissionDeducted: Number(platformFee || 0),
          designerNetCredit: Number(vendorCredit || 0),
        };

        // Credit vendor wallet (net on full payment)
        await User.findByIdAndUpdate(
          vendor.userId,
          { $inc: { wallet: vendorCredit } },
          { new: true }
        );

        // Update review with correct amounts
        await Review.findByIdAndUpdate(
          review._id,
          {
            $set: {
              status: order.paymentStatus,
              amountToPay: newAmountToPay
            },
            $inc: { amountPaid: deltaPaid }
          },
          { new: true }
        );

        // Credit platform commission (only on full payment)
        if (order.paymentStatus === "full payment") {
          const adminTax = isAcceptedOfferFlow ? 0 : (review.tax || 0);
          const adminCommission = isAcceptedOfferFlow ? platformFee : (review.commission || 0);
          await User.updateMany(
            { role: { $in: ["admin", "superAdmin"] } },
            {
              $inc: {
                wallet: platformFee,
                commission: adminCommission,
                tax: adminTax
              }
            }
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
      payoutBreakdown,
    });
  }
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
