import User from '../../user/model/user.model.js';
import Category from '../../category/model/category.model.js';
import Listing from '../model/seller.model.js';
import Transaction from '../../transaction/model/transaction.model.js';
import InitializedOrder from '../../material/model/InitializedOrder.model.js';
import { sendDeliveryEmail } from "../../../utils/emailService.utils.js";
import { cargoCalculateCost, expressCalculateCost, regularCalculateCost, resolveDeliveryCurrency } from "../../../utils/shipmentCalcu.distance.js";
import axios from "axios";
import crypto from "crypto"
import Tracking from "../../tracking/model/tracking.model.js";
import Fee from "../model/fee.model.js";

const normalizeAddressForGeocode = (rawAddress, country) => {
  let address = String(rawAddress || "").trim();
  address = address.replace(/[\r\n]+/g, ", ");
  address = address.replace(/\s*,\s*/g, ", ");
  address = address.replace(/\s+/g, " ");
  address = address.replace(/[.,]+$/g, "");

  const countryValue = String(country || "").trim();
  if (countryValue && !address.toLowerCase().includes(countryValue.toLowerCase())) {
    address = `${address}, ${countryValue}`;
  }

  return address;
};

const geocodeWithOpenCage = async (address) => {
  const openCageKey = process.env.OPENCAGE_KEY;
  if (!openCageKey) {
    throw new Error("OPENCAGE_KEY is not set");
  }

  const response = await axios.get(`https://api.opencagedata.com/geocode/v1/json`, {
    params: {
      key: openCageKey,
      q: address,
      limit: 1,
      no_annotations: 1,
    },
  });

  const geometry = response.data?.results?.[0]?.geometry;
  if (!geometry || geometry.lat == null || geometry.lng == null) {
    return null;
  }

  return {
    latitude: parseFloat(geometry.lat),
    longitude: parseFloat(geometry.lng),
  };
};


export const getAlSellerListings = async (req, res, next) => {
    try {
        const { id } = req.user;
        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }
        const listings = await Listing.find({ isApproved: true })
        .sort({ createdAt: -1 })        
        .populate("userId", "fullName image address")
        .populate("categoryId", "name")
        .lean();
        if (listings.length === 0){
            return res.status(404).json({
                success: false,
                message: "No listings found"
            });
        }
        return res.status(200).json({
            success: true,
            message: "Seller listings fetched successfully",
            data: listings
        });
    } catch (error) {
        next(error);
    }
};


export const searchListings = async (req, res, next) => { 
  try {
    const { query } = req.query;

    const searchConditions = [] = [
      { title: { $regex: query, $options: "i" } },
      { size: { $regex: query, $options: "i" } },
      { description: { $regex: query, $options: "i" } },
      { condition: { $regex: query, $options: "i" } },
    ];

    if (!isNaN(Number(query))) {
      searchConditions.push({ price: Number(query) });
    }

    const materials = await Listing.find({
      $or: searchConditions, isApproved: true
    })
      .populate("userId", "fullName image address")
      .populate("categoryId", "name");

    if (materials.length === 0) {
      return res.status(404).json({ message: "No listing materials found" });
    }

    return res.status(200).json({
      success: true,
      message: "Listing Materials fetched successfully",
      data: materials,
    });
  } catch (error) {
    next(error);
  }
};



export const getSellerListingById = async (req, res, next) => {
    try {
        const { id } = req.user;
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const { listingId } = req.params;
        const listing = await Listing.findOne({ _id: listingId })
        .populate("userId", "fullName image address")
        .populate("categoryId", "name");
        if (!listing) {
            return res.status(404).json({
                success: false,
                message: "Seller listing not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Seller listing fetched successfully",
            data: listing
        });
    } catch (error) {
        next(error);
    }
};


export const purchaseListing = async (req, res, next) => {
    try {
        const { id } = req.user;
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }
        const { listingId } = req.params;
        const {address, shipmentMethod } = req.body;
        const listing = await Listing.findById(listingId);
        if (!listing) {
            return res.status(404).json({
                success: false,
                message: "Listing not found"
            });
        }
        if (listing.userId.toString() === user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: "You cannot purchase your own listing"
            });
        }

        const listingOwner = await User.findById(listing.userId);

        
        const pickupAddress = listingOwner.address;
        const deliveryAddress = user.address || address;

        const deliveryAddressNormalized = normalizeAddressForGeocode(deliveryAddress, user.country);
        const pickupAddressNormalized = normalizeAddressForGeocode(pickupAddress, listingOwner.country);

        const [deliveryLocation, senderLocation] = await Promise.all([
            geocodeWithOpenCage(deliveryAddressNormalized),
            geocodeWithOpenCage(pickupAddressNormalized),
        ]);

        if (!deliveryLocation || !senderLocation) {
            return res.status(400).json({
                success: false,
                message: 'Invalid pickup or delivery address provided',
                error: {
                  pickupAddress: pickupAddressNormalized,
                  deliveryAddress: deliveryAddressNormalized,
                },
            });
        }
    
        // Shipment costs
        const numberOfPackages = 1;
        const deliveryCurrency = resolveDeliveryCurrency(user.country, listingOwner.country);
        const shipmentCosts = {
            Express: expressCalculateCost(deliveryLocation, senderLocation, numberOfPackages, deliveryCurrency),
            Cargo: cargoCalculateCost(deliveryLocation, senderLocation, numberOfPackages, deliveryCurrency),
            Regular: regularCalculateCost(deliveryLocation, senderLocation, numberOfPackages, deliveryCurrency),
        };
    
        const shipmentCost = shipmentCosts[shipmentMethod];
        if (!shipmentCost) {
            return res.status(400).json({
            success: false,
            message: "Invalid shipment method. Choose Express, Cargo, or Regular",
            });
        }
    
        // Payment setup
        const shipping = Math.round(shipmentCost);
        const cost = Number(listing.price)
        const totalCost = Math.round(shipping + cost);
        const paymentReference = crypto.randomBytes(5).toString("hex");
    
        const order = await InitializedOrder.create({
            userId: user._id,
            cartItems: [
            {
                userId: listing.userId,
                title: listing.title,
                size: listing.size,
                description: listing.description,
                condition: listing.condition,
                amount: listing.price,
                images: listing.images,
            },
            ],
            totalAmount: totalCost,
            paymentMethod: "Paystack",
            paymentReference,
            deliveryAddress,
            vendorId: listing.userId,
            materialId: listing._id,
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

export const purchaseMultipleListings = async (req, res, next) => {
  try {
    const { id } = req.user;
    const user = await User.findById(id);
    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    const { listingIds, address, shipmentMethod } = req.body;
    if (!Array.isArray(listingIds) || listingIds.length === 0)
      return res.status(400).json({ success: false, message: "Provide at least one listingId" });

    // Fetch listings
    const listings = await Listing.find({ _id: { $in: listingIds } });
    if (listings.length !== listingIds.length)
      return res.status(404).json({ success: false, message: "Some listings not found" });

    // Prevent self-purchase
    if (listings.some(l => l.userId.toString() === user._id.toString()))
      return res.status(400).json({ success: false, message: "You cannot purchase your own listing" });

    const listingOwner = await User.findById(listings[0].userId);
    const pickupAddress = listingOwner.address;
    const deliveryAddress = address || user.address;

    const deliveryAddressNormalized = normalizeAddressForGeocode(deliveryAddress, user.country);
    const pickupAddressNormalized = normalizeAddressForGeocode(pickupAddress, listingOwner.country);

    const [deliveryLocation, senderLocation] = await Promise.all([
      geocodeWithOpenCage(deliveryAddressNormalized),
      geocodeWithOpenCage(pickupAddressNormalized),
    ]);

    if (!deliveryLocation || !senderLocation) {
      return res.status(400).json({
        success: false,
        message: "Invalid pickup or delivery address provided",
        error: {
          pickupAddress: pickupAddressNormalized,
          deliveryAddress: deliveryAddressNormalized,
        },
      });
    }

    // 🚚 Shipment cost
    const numPackages = listings.length;
    const method = shipmentMethod?.trim().toLowerCase();
    if (!method)
      return res.status(400).json({ success: false, message: "shipmentMethod is required" });

    const deliveryCurrency = resolveDeliveryCurrency(user.country, listingOwner.country);
    let shipmentCost;
    switch (method) {
      case "express":
        shipmentCost = await expressCalculateCost(deliveryLocation, senderLocation, numPackages, deliveryCurrency);
        break;
      case "cargo":
        shipmentCost = await cargoCalculateCost(deliveryLocation, senderLocation, numPackages, deliveryCurrency);
        break;
      case "regular":
        shipmentCost = await regularCalculateCost(deliveryLocation, senderLocation, numPackages, deliveryCurrency);
        break;
      default:
        return res.status(400).json({ success: false, message: "Invalid shipment method" });
    }

    const shipping = Math.round(shipmentCost);
    const itemsTotal = listings.reduce((sum, l) => sum + Number(l.price), 0);
    const totalCost = Math.round(shipping + itemsTotal);
    const paymentReference = crypto.randomBytes(5).toString("hex");

    const cartItems = listings.map(l => ({
      userId: l.userId,
      title: l.title,
      size: l.size,
      description: l.description,
      condition: l.condition,
      amount: l.price,
      images: l.images,
    }));

    const order = await InitializedOrder.create({
      userId: user._id,
      cartItems,
      totalAmount: totalCost,
      paymentMethod: "Paystack",
      paymentReference,
      deliveryAddress,
      amountPaid: totalCost,
      listingId: listings.map(l => l._id),
    });

    const countryCurrency = {
      nigeria: "NGN",
      "united kingdom": "GBP",
      "united states": "USD",
    };
    const userCurrency = countryCurrency[user.country?.toLowerCase()?.trim()] || "USD";

    // 💳 Initialize Paystack
    const paystackResponse = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: user.email,
        amount: totalCost * 100,
        currency: userCurrency,
        reference: paymentReference,
        callback_url: `${process.env.FRONTEND_URL}/payment-success`,
      },
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_MAIN_KEY}` } }
    );

    if (paystackResponse.status === 200 && paystackResponse.data?.data) {
      // 🔢 Generate tracking
      let trackingNumber;
      do {
        trackingNumber = crypto.randomInt(100000, 999999).toString();
      } while (await Tracking.findOne({ trackingNumber }));

      await Tracking.create({
        userId: user._id,
        materialId: listings[0]._id,
        vendorId: listingOwner._id,
        trackingNumber,
        amount: totalCost,
        status: "pending",
        reference: paymentReference,
        listingId: listings.map(l => l._id),
      });

      return res.status(201).json({
        success: true,
        message: "Payment initialized successfully",
        authorizationUrl: paystackResponse.data.data.authorization_url,
        payment: order,
      });
    }

    await InitializedOrder.findByIdAndDelete(order._id);
    return res.status(400).json({ success: false, message: "Payment initialization failed" });
  } catch (error) {
    if (error.response?.data) console.error("Response:", error.response.data);
    next(error.message);
  }
};



export const getAllTracking = async (req, res, next)=>{
  try {
    const { id } = req.user;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const tracks = await Tracking.find({ userId: user._id, status: "success" })
    .sort({ createdAt: -1 })
    .populate("userId", "fullName image address")
    .populate("vendorId", "fullName image address")
    .lean();

    if (tracks.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No tracking records found",
      });
    }
    return res.status(200).json({
      success: true,
      message: "Tracking records fetched successfully",
      data: tracks,
    });
  } catch (error) {
    next(error);
  }
}


export const acceptOrder = async (req, res, next) => {
  try {
    const { id } = req.user;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const { trackingNumber } = req.query;
    if (!trackingNumber) {
      return res.status(400).json({
        success: false,
        message: "Tracking number is required",
      });
    }

    const track = await Tracking.findOne({ trackingNumber });
    if (!track) {
      return res.status(404).json({
        success: false,
        message: "Tracking record not found",
      });
    }

    if(track.isDelivered == true){
      return res.status(404).json({
        success: false,
        message: `This order has been accepted and collected already by you, ${user.fullName}.`,
      });
    }

    // Fetch fee percentage
    const feeDoc = await Fee.findOne();
    const feePercentage = feeDoc ? Number(feeDoc.amount) : 0;

    const grossAmount = Number(track.amount);
    const fee = (feePercentage / 100) * grossAmount;
    const netAmount = grossAmount - fee;

    if (netAmount <= 0) {
      return res
        .status(400)
        .json({ message: "Invalid net amount after fee deduction" });
    }

    // Credit admin wallet with fee
    const admin = await User.findOne({ role: "admin" });
    if (admin) {
      await User.findByIdAndUpdate(
        admin._id,
        { $inc: { wallet: fee } },
        { new: true }
      );
    }

    // Credit vendor wallet with netAmount
    const listingOwner = await User.findById(track.vendorId);
    if (listingOwner) {
      await User.findByIdAndUpdate(
        listingOwner._id,
        { $inc: { wallet: netAmount } },
        { new: true }
      );

      await sendDeliveryEmail(
        listingOwner,
        fee,
        netAmount,
        track.trackingNumber
      );
    }

    // Mark order delivered
    await Tracking.findByIdAndUpdate(
      track._id,
      { isDelivered: true, status: "delivered" },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Order accepted and processed successfully",
      data: {
        trackingNumber: track.trackingNumber,
        grossAmount,
      },
    });
  } catch (error) {
    next(error);
  }
};
