import User from '../../user/model/user.model.js';
import Category from '../../category/model/category.model.js';
import Listing from '../model/seller.model.js';
import Transaction from '../../transaction/model/transaction.model.js';
import InitializedOrder from '../../material/model/InitializedOrder.model.js';
import { sendDeliveryEmail } from "../../../utils/emailService.utils";
import { cargoCalculateCost, expressCalculateCost, regularCalculateCost } from "../../../utils/shipmentCalcu.distance";
import axios from "axios";
import crypto from "crypto"
import Tracking from "../../tracking/model/tracking.model";
import Fee from "../model/fee.model";


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
    
        const geocodeReceiverResponse = await axios.get(`https://api.geoapify.com/v1/geocode/search`, {
            params: { text: deliveryAddress, apiKey: process.env.GEOAPIFY_API_KEY }
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
            params: { text: pickupAddress, apiKey: process.env.GEOAPIFY_API_KEY }
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
        const shipmentCosts = {
            Express: expressCalculateCost(deliveryLocation, senderLocation, numberOfPackages),
            Cargo: cargoCalculateCost(deliveryLocation, senderLocation, numberOfPackages),
            Regular: regularCalculateCost(deliveryLocation, senderLocation, numberOfPackages),
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
    
        // Paystack payment initialization
        const paystackResponse = await axios.post(
            "https://api.paystack.co/transaction/initialize",
            {
            email: user.email,
            amount: totalCost * 100, // Paystack accepts kobo
            currency: "NGN",
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
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const { listingIds } = req.body; // array of listing IDs
    const { address, shipmentMethod } = req.body;

    if (!Array.isArray(listingIds) || listingIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one listingId",
      });
    }

    // Fetch listings
    const listings = await Listing.find({ _id: { $in: listingIds } });
    if (listings.length !== listingIds.length) {
      return res.status(404).json({
        success: false,
        message: "Some listings not found",
      });
    }

    // Prevent buying own listings
    const ownsListing = listings.some(
      (listing) => listing.userId.toString() === user._id.toString()
    );
    if (ownsListing) {
      return res.status(400).json({
        success: false,
        message: "You cannot purchase your own listing",
      });
    }

    // Assume first listing owner = vendor (could extend to multi-vendor later)
    const listingOwner = await User.findById(listings[0].userId);
    const pickupAddress = listingOwner.address;
    const deliveryAddress = address || user.address;

    // Geocode receiver address
    const geocodeReceiverResponse = await axios.get(
      `https://api.geoapify.com/v1/geocode/search`,
      {
        params: { text: deliveryAddress, apiKey: process.env.GEOAPIFY_API_KEY },
      }
    );

    const Location = geocodeReceiverResponse.data.features;
    if (!Location.length) {
      return res.status(400).json({
        success: false,
        message: "Invalid deliveryAddress provided",
      });
    }

    const deliveryLocation = {
      latitude: Location[0].geometry.coordinates[1],
      longitude: Location[0].geometry.coordinates[0],
    };

    // Geocode sender address
    const geocodeSenderResponse = await axios.get(
      `https://api.geoapify.com/v1/geocode/search`,
      {
        params: { text: pickupAddress, apiKey: process.env.GEOAPIFY_API_KEY },
      }
    );

    const senderAddress = geocodeSenderResponse.data.features;
    if (!senderAddress.length) {
      return res.status(400).json({
        success: false,
        message: "Invalid pickupAddress provided",
      });
    }

    const senderLocation = {
      latitude: senderAddress[0].geometry.coordinates[1],
      longitude: senderAddress[0].geometry.coordinates[0],
    };

    // Shipment costs
    const numberOfPackages = listings.length;
    const shipmentCosts = {
      Express: expressCalculateCost(deliveryLocation, senderLocation, numberOfPackages),
      Cargo: cargoCalculateCost(deliveryLocation, senderLocation, numberOfPackages),
      Regular: regularCalculateCost(deliveryLocation, senderLocation, numberOfPackages),
    };

    const shipmentCost = shipmentCosts[shipmentMethod];
    if (!shipmentCost) {
      return res.status(400).json({
        success: false,
        message: "Invalid shipment method. Choose Express, Cargo, or Regular",
      });
    }

    // Calculate total cost
    const shipping = Math.round(shipmentCost);
    const itemsTotal = listings.reduce((sum, l) => sum + Number(l.price), 0);
    const totalCost = Math.round(shipping + itemsTotal);

    // Payment setup
    const paymentReference = crypto.randomBytes(5).toString("hex");

    const cartItems = listings.map((listing) => ({
      userId: listing.userId,
      title: listing.title,
      size: listing.size,
      description: listing.description,
      condition: listing.condition,
      amount: listing.price,
      images: listing.images,
    }));

    const order = await InitializedOrder.create({
      userId: user._id,
      cartItems,
      totalAmount: totalCost,
      paymentMethod: "Paystack",
      paymentReference,
      deliveryAddress,
      vendorId: listingOwner._id,
      amountPaid: totalCost,
      paymentStatus: "full payment",
    });

    // Paystack payment initialization
    const paystackResponse = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: user.email,
        amount: totalCost * 100, // Paystack accepts kobo
        currency: "NGN",
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

    if (paystackResponse.status === 200 && paystackResponse.data?.data) {
      let trackingNumber;
      let exists = true;
      while (exists) {
        trackingNumber = crypto.randomInt(100000, 999999).toString();
        exists = await Tracking.findOne({ trackingNumber });
      }

      await Tracking.create({
        userId: user._id,
        materialId: listings[0]._id,
        vendorId: listingOwner._id,
        trackingNumber,
        amount: totalCost,
        status: "pending",
        reference: paymentReference,
      });

      return res.status(201).json({
        success: true,
        message: "Payment initialized successfully",
        authorizationUrl: paystackResponse.data.data.authorization_url,
        payment: order,
      });
    }

    // Rollback if Paystack fails
    await InitializedOrder.findByIdAndDelete(order._id);
    return res.status(400).json({
      success: false,
      message: "Payment initialization failed",
    });
  } catch (error) {
    next(error);
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
      { isDelivered: true },
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


