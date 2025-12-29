import User from '../../user/model/user.model.js';
import Category from '../../category/model/category.model.js';
import Listing from '../model/seller.model.js';
import Transaction from '../../transaction/model/transaction.model.js';
import Tracking from "../../tracking/model/tracking.model.js";



export const sellerCreateListing = async (req, res, next) => {
  try {
    const { id } = req.user;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const { categoryId } = req.params;
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    let { title, size, description, condition, status, price, yards } = req.body;

    if (typeof yards === "string") {
      try {
        yards = JSON.parse(yards);
      } catch (err) {
        return res.status(400).json({ success: false, message: "Invalid yards format" });
      }
    }

    if ([title, size, description, condition, status, price].some(f => !f)) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    if (isNaN(price)) {
      return res.status(400).json({ success: false, message: "Price must be a number" });
    }

    const images = Array.isArray(req.imageUrls) ? req.imageUrls : [];
    if (images.length === 0) {
      return res.status(400).json({ success: false, message: "At least one image is required" });
    }

    const countryCurrencyMapping = {
      nigeria: "NGN",
      "united kingdom": "GBP",
      "united states": "USD",
    };

    const userCountry = user.country?.toLowerCase().trim();
    const userCurrency = countryCurrencyMapping[userCountry] || "USD";

    const listing = await Listing.create({
      userId: user._id,
      categoryId,
      title,
      size,
      description,
      condition,
      status,
      price: Number(price),
      images,
      yards: Array.isArray(yards) ? yards : [],
      currency: userCurrency,
    });

    return res.status(201).json({
      success: true,
      message: "Listing created successfully",
      data: listing,
    });
  } catch (error) {
    console.error(error);
    next(error);
  }
};



export const getSellerListings = async (req, res, next) => {
    try {
        const { id } = req.user;
        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const listings = await Listing.find({ userId: user._id });
        return res.status(200).json({
            success: true,
            message: "Seller listings fetched successfully",
            data: listings
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
        const listing = await Listing.findOne({ _id: listingId, userId: user._id });

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


export const updateSellerListing = async (req, res, next) => {
  try {
    const { id } = req.user;

    // ✅ Ensure user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const { listingId } = req.params;
    let { title, size, description, condition, status, deliveryMethod, price, yards } = req.body;

    if (typeof yards === "string") {
      try {
        yards = JSON.parse(yards);
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: "Invalid yards format",
        });
      }
    }

    const updateData = {};

    if (title !== undefined) updateData.title = title;
    if (size !== undefined) updateData.size = size;
    if (description !== undefined) updateData.description = description;
    if (condition !== undefined) updateData.condition = condition;
    if (status !== undefined) updateData.status = status;
    if (deliveryMethod !== undefined) updateData.deliveryMethod = deliveryMethod;
    if (price !== undefined) {
      if (isNaN(price)) {
        return res.status(400).json({
          success: false,
          message: "Price must be a number",
        });
      }
      updateData.price = Number(price);
    }
    if (yards !== undefined) {
      updateData.yards = Array.isArray(yards) ? yards : [];
    }

    // ✅ Handle images
    if (req.imageUrls && Array.isArray(req.imageUrls) && req.imageUrls.length > 0) {
      const listing = await Listing.findById(listingId);

      if (!listing) {
        return res.status(404).json({
          success: false,
          message: "Listing not found",
        });
      }

      const appendImages = req.query.append === "true"; 
      updateData.images = appendImages
        ? [...listing.images, ...req.imageUrls]
        : req.imageUrls;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided for update",
      });
    }

    const updatedListing = await Listing.findOneAndUpdate(
      { _id: listingId, userId: user._id },
      { $set: updateData },
      { new: true }
    );

    if (!updatedListing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found or you are not authorized to update it",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Seller listing updated successfully",
      data: updatedListing,
    });
  } catch (error) {
    console.error(error);
    next(error);
  }
};


export const deleteSellerListing = async (req, res, next) => {
  try {
    const { id } = req.user;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const { listingId } = req.params;
    if (!listingId) {
      return res.status(400).json({
        success: false,
        message: "Listing ID is required",
      });
    }

    // Find and delete in one step, ensuring the user owns it
    const listing = await Listing.findOneAndDelete({
      _id: listingId,
      userId: user._id,
    });

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found or you are not authorized to delete it",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Seller listing deleted successfully",
      data: listing,
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

    const tracks = await Tracking.find({ vendorId: user._id, status: "success" })
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