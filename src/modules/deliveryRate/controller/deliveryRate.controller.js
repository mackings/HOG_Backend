import DeliveryRate from '../model/deliveryRate.model.js';
import User from '../../user/model/user.model.js';
import axios from 'axios';
import mongoose from 'mongoose';
import Review from '../../review/model/review.model.js';
import Vendor from '../../vendor/model/vendor.model.js';
import { expressCalculateCost, cargoCalculateCost, regularCalculateCost, resolveDeliveryCurrency } from '../../../utils/shipmentCalcu.distance.js';

const normalizeAddressForGeocode = (rawAddress, country) => {
  let addr = String(rawAddress || "").trim();
  addr = addr.replace(/[\r\n]+/g, ", ");
  addr = addr.replace(/\s*,\s*/g, ", ");
  addr = addr.replace(/\s+/g, " ");
  addr = addr.replace(/[.,]+$/g, "");

  const countryValue = String(country || "").trim();
  if (countryValue && !addr.toLowerCase().includes(countryValue.toLowerCase())) {
    addr = `${addr}, ${countryValue}`;
  }
  return addr;
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



export const createDeliveryRate = async (req, res, next) => {
    try {
        const { amount, deliveryType, currency } = req.body;

        if (!amount) {
            return res.status(400).json({ message: 'Amount is required' });
        }

        if (!deliveryType) {
            return res.status(400).json({ message: 'Delivery type is required' });
        }

        const currencyValue = (currency || "NGN").toUpperCase();
        const existingRate = await DeliveryRate.findOne({ deliveryType, currency: currencyValue });
        if (existingRate) {
            return res.status(400).json({
                success: false,
                message: `A delivery rate already exists for '${deliveryType}' (${currencyValue}). You can update it instead.`,
            });
        }

        const deliveryRate = await DeliveryRate.create({ amount, deliveryType, currency: currencyValue });

        return res.status(201).json({
            success: true,
            message: 'Delivery rate created successfully',
            deliveryRate,
        });
    } catch (error) {
        next(error);
    }
};



export const getDeliveryRates = async (req, res, next) => {
    try {
        const deliveryRates = await DeliveryRate.find();
        return res.status(200).json({ success: true, message: 'Delivery rates retrieved successfully', deliveryRates });
    } catch (error) {
        next(error);
    }
}


export const updateDeliveryRate = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { amount, currency } = req.body;
        const updates = { amount };
        if (currency) updates.currency = currency.toUpperCase();
        const deliveryRate = await DeliveryRate.findByIdAndUpdate(id, updates, { new: true });
        if (!deliveryRate) {
            return res.status(404).json({ success: false, message: 'Delivery rate not found' });
        }
        return res.status(200).json({ success: true, message: 'Delivery rate updated successfully', deliveryRate });
    } catch (error) {
        next(error);
    }
}


export const deleteDeliveryRate = async (req, res, next) => {
    try {
        const { id } = req.params;
        const deliveryRate = await DeliveryRate.findByIdAndDelete(id);
        if (!deliveryRate) {
            return res.status(404).json({ message: 'Delivery rate not found' });
        }
        return res.status(200).json({ success: true, message: 'Delivery rate deleted successfully' });
    } catch (error) {
        next(error);
    }
}


export const deliveryCost = async (req, res, next) => {
  try {
    const { id } = req.user;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const { shipmentMethod, address } = req.body;
    const { reviewId } = req.params;

    if (!reviewId || !mongoose.Types.ObjectId.isValid(reviewId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid review ID" });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res
        .status(404)
        .json({ success: false, message: "Review not found" });
    }

    // Fetch vendor + buyer for addresses
    const vendor = await Vendor.findById(review.vendorId).populate("userId");
    if (!vendor) {
      return res.status(404).json({ success: false, message: "Vendor not found" });
    }
    const buyer = await User.findById(review.userId);
    if (!buyer) {
      return res.status(404).json({ success: false, message: "Buyer not found" });
    }

    // Determine pickup (vendor) and delivery (buyer) addresses
    const pickupAddress = vendor.address || vendor.userId?.address;
    const deliveryAddress = address || buyer.address;

    if (!pickupAddress || !deliveryAddress) {
      return res.status(400).json({
        success: false,
        message: "Both pickup and delivery addresses are required.",
      });
    }

    // Use buyer-provided delivery address as-is (no country append)
    const deliveryAddressNormalized = normalizeAddressForGeocode(deliveryAddress);
    const pickupAddressNormalized = normalizeAddressForGeocode(pickupAddress, vendor.userId?.country || vendor.country);
    const deliveryCurrency = resolveDeliveryCurrency(buyer.country, vendor.userId?.country || vendor.country);

    const [deliveryLocation, senderLocation] = await Promise.all([
      geocodeWithOpenCage(deliveryAddressNormalized),
      geocodeWithOpenCage(pickupAddressNormalized),
    ]);

    if (!deliveryLocation || !senderLocation) {
      return res.status(400).json({
        success: false,
        message: "Invalid pickup or delivery address provided.",
        error: {
          pickupAddress: pickupAddressNormalized,
          deliveryAddress: deliveryAddressNormalized,
        },
      });
    }

    // Shipment cost calculation
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

    const cost = Math.round(shipmentCost);
    return res.status(200).json({
      success: true,
      message: "Delivery cost calculated successfully",
      cost,
      currency: deliveryCurrency,
    });
  } catch (error) {
    next(error);
  }
};
