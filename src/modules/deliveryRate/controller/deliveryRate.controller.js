import DeliveryRate from '../model/deliveryRate.model.js';
import User from '../../user/model/user.model.js';
import axios from 'axios';
import mongoose from 'mongoose';
import Review from '../../review/model/review.model.js';
import Material from '../../material/model/material.model.js';
import { expressCalculateCost, cargoCalculateCost, regularCalculateCost } from '../../../utils/shipmentCalcu.distance.js';



export const createDeliveryRate = async (req, res, next) => {
    try {
        const { amount, deliveryType } = req.body;

        if (!amount) {
            return res.status(400).json({ message: 'Amount is required' });
        }

        if (!deliveryType) {
            return res.status(400).json({ message: 'Delivery type is required' });
        }

        const existingRate = await DeliveryRate.findOne({ deliveryType });
        if (existingRate) {
            return res.status(400).json({
                success: false,
                message: `A delivery rate already exists for '${deliveryType}'. You can update it instead.`,
            });
        }

        const deliveryRate = await DeliveryRate.create({ amount, deliveryType });

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
        const { amount } = req.body;
        const deliveryRate = await DeliveryRate.findByIdAndUpdate(id, { amount }, { new: true });
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

    // Fetch the associated material
    const material = await Material.findById(review.materialId);
    if (!material) {
      return res
        .status(404)
        .json({ success: false, message: "Material not found" });
    }

    // Determine pickup and delivery addresses
    const pickupAddress = user.address;
    const deliveryAddress = address || material.userId.address;

    if (!pickupAddress || !deliveryAddress) {
      return res.status(400).json({
        success: false,
        message: "Both pickup and delivery addresses are required.",
      });
    }

    // Geocode delivery and pickup addresses using OpenStreetMap Nominatim (free)
    const [deliveryGeo, pickupGeo] = await Promise.all([
      axios.get(`https://nominatim.openstreetmap.org/search`, {
        params: {
          q: deliveryAddress,
          format: 'json',
          limit: 1
        },
        headers: {
          'User-Agent': 'HOG-Fashion-App/1.0'
        }
      }),
      axios.get(`https://nominatim.openstreetmap.org/search`, {
        params: {
          q: pickupAddress,
          format: 'json',
          limit: 1
        },
        headers: {
          'User-Agent': 'HOG-Fashion-App/1.0'
        }
      }),
    ]);

    const deliveryData = deliveryGeo.data;
    const pickupData = pickupGeo.data;

    if (!deliveryData.length || !pickupData.length) {
      return res.status(400).json({
        success: false,
        message: "Invalid pickup or delivery address provided.",
      });
    }

    const deliveryLocation = {
      latitude: parseFloat(deliveryData[0].lat),
      longitude: parseFloat(deliveryData[0].lon),
    };

    const senderLocation = {
      latitude: parseFloat(pickupData[0].lat),
      longitude: parseFloat(pickupData[0].lon),
    };

    // Shipment cost calculation
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

    const cost = Math.round(shipmentCost);
    return res.status(200).json({
      success: true,
      message: "Delivery cost calculated successfully",
      cost,
    });
  } catch (error) {
    next(error);
  }
};
