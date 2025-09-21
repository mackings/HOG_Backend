import User from '../../user/model/user.model.js';
import Category from '../../category/model/category.model.js';
import Listing from '../model/seller.model.js';



export const sellerCreateListing = async (req, res, next) => {
  try {
    const { id } = req.user;

    // Check if user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Validate category
    const { categoryId } = req.params;
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const { title, size, description, condition, status, price } = req.body;

    // Ensure all required fields are provided
    if (
      [title, size, description, condition, status, price].some(
        (field) => field == null || field === ""
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // Handle images (ensure middleware sets req.imageUrls)
    const images = req.imageUrls && Array.isArray(req.imageUrls) ? req.imageUrls : [];
    if (images.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one image is required",
      });
    }

    // Create the listing
    const listing = await Listing.create({
      userId: user._id,
      categoryId,
      title,
      size,
      description,
      condition,
      status,
      price,
      images,
    });

    return res.status(201).json({
      success: true,
      message: "Listing created successfully",
      data: listing,
    });
  } catch (error) {
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
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const { listingId } = req.params;
    const { title, size, description, condition, status, deliveryMethod, price } = req.body;

    // Collect only the fields that are provided
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (size !== undefined) updateData.size = size;
    if (description !== undefined) updateData.description = description;
    if (condition !== undefined) updateData.condition = condition;
    if (status !== undefined) updateData.status = status;
    if (deliveryMethod !== undefined) updateData.deliveryMethod = deliveryMethod;
    if (price !== undefined) updateData.price = price;

    // Handle images (append instead of overwrite if needed)
    if (req.imageUrls && Array.isArray(req.imageUrls) && req.imageUrls.length > 0) {
      updateData.images = req.imageUrls;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided for update",
      });
    }

    const listing = await Listing.findOneAndUpdate(
      { _id: listingId, userId: user._id },
      { $set: updateData },
      { new: true }
    );

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found or you are not authorized to update it",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Seller listing updated successfully",
      data: listing,
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





        