import Vendor from "../../vendor/model/vendor.model";
import User from "../../user/model/user.model";
import Material from "../../material/model/material.model"



export const rateVendor = async (req, res, next) => {
  try {
    const { id } = req.user; // assuming auth middleware sets this
    const { rating } = req.body;
    const { vendorId } = req.params;

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    if (!Array.isArray(vendor.ratings)) {
      vendor.ratings = [];
    }

    const existingRating = vendor.ratings.find(
      (r) => r.userId?.toString() === id.toString()
    );

    if (existingRating) {
      vendor.ratingSum = vendor.ratingSum - existingRating.value + rating;
      existingRating.value = rating;
    } else {
      vendor.ratings.push({ userId: id, value: rating });
      vendor.ratingSum += rating;
      vendor.totalRatings += 1;
    }

    await vendor.save();

    return res.status(200).json({
      message: "Vendor rated successfully",
      averageRating: vendor.ratingSum / vendor.totalRatings,
      vendor,
    });
  } catch (error) {
    next(error);
  }
};




export const getVendorRating = async (req, res, next) => {
  try {
    const { id } = req.user;

    const vendor = await Vendor.findOne({ userId: id });
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    const totalRatings = vendor.totalRatings || 0;
    const ratingSum = vendor.ratingSum || 0;
    const averageRating = totalRatings > 0 ? ratingSum / totalRatings : 0;

    return res.status(200).json({
      message: "Vendor rating retrieved successfully",
      vendor: {
        averageRating,
        totalRatings,
        // ratings: vendor.ratings,
      },
    });
  } catch (error) {
    next(error);
  }
};




export const deleteVendorRating = async (req, res, next) => {
  try {
    const { id } = req.user; 
    const { vendorId } = req.query;

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    const ratingToRemove = vendor.ratings.find(
      (r) => r.userId && r.userId.toString() === id.toString()
    );

    if (!ratingToRemove) {
      return res
        .status(404)
        .json({ message: "You haven't rated this vendor yet" });
    }

    // Update sums
    vendor.ratingSum -= ratingToRemove.value || 0;
    vendor.totalRatings = Math.max(0, vendor.totalRatings - 1);

    // Remove rating object
    vendor.ratings = vendor.ratings.filter(
      (r) => !(r.userId && r.userId.toString() === id.toString())
    );

    await vendor.save();

    return res.status(200).json({
      message: "Your rating was deleted successfully",
      averageRating:
        vendor.totalRatings > 0
          ? vendor.ratingSum / vendor.totalRatings
          : 0,
      vendor,
    });
  } catch (error) {
    next(error);
  }
};

