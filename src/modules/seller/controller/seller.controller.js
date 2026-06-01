import User from '../../user/model/user.model.js';
import Category from '../../category/model/category.model.js';
import Listing from '../model/seller.model.js';
import Transaction from '../../transaction/model/transaction.model.js';
import Tracking from "../../tracking/model/tracking.model.js";
import { rejectPastedMediaUrls } from "../../../utils/deviceUpload.utils.js";

const formatListingModeration = (listing) => ({
  ...listing,
  approvalStatus: listing?.approvalStatus || (listing?.isApproved ? "approved" : "pending"),
  rejectionReasons: Array.isArray(listing?.rejectionReasons) ? listing.rejectionReasons : [],
});

const parseJsonField = (value, fallback) => {
  if (value === undefined) return fallback;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    return value;
  }
};

const normalizeUrlArray = (value) => {
  const parsed = parseJsonField(value, []);
  if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
  if (typeof parsed === "string" && parsed.trim()) return [parsed.trim()];
  return [];
};

const normalizeMediaInput = (mediaInput = {}) => {
  const media = parseJsonField(mediaInput, {}) || {};
  return {
    fabricCloseups: normalizeUrlArray(media.fabricCloseups),
    videoPreviews: normalizeUrlArray(media.videoPreviews),
    beforeAfterShowcases: normalizeUrlArray(media.beforeAfterShowcases),
    styledLookPreviews: normalizeUrlArray(media.styledLookPreviews),
    zoomImages: normalizeUrlArray(media.zoomImages),
  };
};

const uploadedMediaInput = (req) => {
  const slots = normalizeUrlArray(req.body.mediaSlots);
  const base = normalizeMediaInput({});
  const files = Array.isArray(req.uploadedFiles) ? req.uploadedFiles : [];

  files.forEach((file, index) => {
    const slot = slots[index] || (String(file.mimeType || "").startsWith("video/") ? "videoPreviews" : "zoomImages");
    if (base[slot]) base[slot].push(file.url);
  });

  return base;
};

const validateVideoPreviewUrls = (urls = []) => {
  const invalid = urls.filter((url) => {
    const value = String(url || "").trim().toLowerCase();
    return !value.startsWith("https://") || !(/\.(mp4|m3u8)(\?|#|$)/.test(value));
  });

  if (invalid.length > 0) {
    return "media.videoPreviews must contain public HTTPS .mp4 or HLS .m3u8 URLs";
  }

  return null;
};



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

    let { title, size, description, condition, status, price, yards, gender, occasion, fabric, availability, media } = req.body;

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

    if (rejectPastedMediaUrls(res, { media })) return;
    const normalizedMedia = normalizeMediaInput(media);
    const videoValidationError = validateVideoPreviewUrls(normalizedMedia.videoPreviews);
    if (videoValidationError) {
      return res.status(400).json({ success: false, message: videoValidationError });
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
      gender,
      occasion,
      fabric,
      availability,
      media: normalizedMedia,
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

        const listings = await Listing.find({ userId: user._id })
          .populate("approvedBy", "fullName email role")
          .populate("rejectedBy", "fullName email role")
          .lean();
        return res.status(200).json({
            success: true,
            message: "Seller listings fetched successfully",
            data: listings.map(formatListingModeration)
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
        const listing = await Listing.findOne({ _id: listingId, userId: user._id })
          .populate("approvedBy", "fullName email role")
          .populate("rejectedBy", "fullName email role")
          .lean();

        if (!listing) {
            return res.status(404).json({
                success: false,
                message: "Seller listing not found"
            });
        }
        return res.status(200).json({
            success: true,
            message: "Seller listing fetched successfully",
            data: formatListingModeration(listing)
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
    let { title, size, description, condition, status, deliveryMethod, price, yards, gender, occasion, fabric, availability, media } = req.body;

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
    if (gender !== undefined) updateData.gender = gender;
    if (occasion !== undefined) updateData.occasion = occasion;
    if (fabric !== undefined) updateData.fabric = fabric;
    if (availability !== undefined) updateData.availability = availability;
    if (media !== undefined) {
      if (rejectPastedMediaUrls(res, { media })) return;
      const normalizedMedia = normalizeMediaInput(media);
      const videoValidationError = validateVideoPreviewUrls(normalizedMedia.videoPreviews);
      if (videoValidationError) {
        return res.status(400).json({ success: false, message: videoValidationError });
      }
      updateData.media = normalizedMedia;
    }
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
    )
      .populate("approvedBy", "fullName email role")
      .populate("rejectedBy", "fullName email role")
      .lean();

    if (!updatedListing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found or you are not authorized to update it",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Seller listing updated successfully",
      data: formatListingModeration(updatedListing),
    });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const updateSellerListingMedia = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { listingId } = req.params;
    const { media, gender, occasion, fabric, availability } = req.body;

    if (rejectPastedMediaUrls(res, { media, fabricCloseups: req.body.fabricCloseups, videoPreviews: req.body.videoPreviews, beforeAfterShowcases: req.body.beforeAfterShowcases, styledLookPreviews: req.body.styledLookPreviews, zoomImages: req.body.zoomImages })) return;
    const normalizedMedia = Array.isArray(req.uploadedFiles) && req.uploadedFiles.length > 0
      ? uploadedMediaInput(req)
      : normalizeMediaInput(media || req.body);
    const videoValidationError = validateVideoPreviewUrls(normalizedMedia.videoPreviews);
    if (videoValidationError) {
      return res.status(400).json({ success: false, message: videoValidationError });
    }

    const updateData = {
      media: normalizedMedia,
    };
    if (gender !== undefined) updateData.gender = gender;
    if (occasion !== undefined) updateData.occasion = occasion;
    if (fabric !== undefined) updateData.fabric = fabric;
    if (availability !== undefined) updateData.availability = availability;

    const updatedListing = await Listing.findOneAndUpdate(
      { _id: listingId, userId: id },
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .populate("approvedBy", "fullName email role")
      .populate("rejectedBy", "fullName email role")
      .lean();

    if (!updatedListing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found or you are not authorized to update it",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Listing media updated successfully",
      data: formatListingModeration(updatedListing),
    });
  } catch (error) {
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
