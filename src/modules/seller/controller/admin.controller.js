import User from '../../user/model/user.model.js';
import Category from '../../category/model/category.model.js';
import Listing from '../model/seller.model.js';
import Transaction from '../../transaction/model/transaction.model.js'; 
import { sendApprovalEmail } from "../../../utils/emailService.utils";



export const getAllPendingSellerListings = async (req, res, next) => {
    try {
        const { id } = req.user;
        const user = await User.findById(id);   
        if(!user){
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }
        const listings = await Listing.find({ isApproved: false })
        .sort({ createdAt: -1 })
        .populate("userId", "fullName image address")
        .populate("categoryId", "name")
        .lean();
        if(listings.length === 0){
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


export const getSellerListingById = async (req, res, next) => {
    try {
        const { id } = req.user;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to approve this listing",
      });
    }

    const { listingId } = req.params;
    const listing = await Listing.findById(listingId);

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Seller listing not found",
      });
    }
    return res.status(200).json({
      success: true,
      message: "Seller listing fetched successfully",
      data: listing,
    });
  } catch (error) {
    next(error);
    }
}
        

export const approveSellerListing = async (req, res, next) => {
  try {
    const { id } = req.user;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to approve this listing",
      });
    }

    const { listingId } = req.params;
    const listing = await Listing.findById(listingId);

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Seller listing not found",
      });
    }

    listing.isApproved = true;
    await listing.save();

    const listingOwner = await User.findById(listing.userId);
    if (!listingOwner) {
      return res.status(404).json({
        success: false,
        message: "Listing owner not found",
      });
    }

    // Send approval email
    await sendApprovalEmail(
      listingOwner.email,
      listingOwner.fullName || "Seller",
      listing.title
    );

    return res.status(200).json({
      success: true,
      message: "Seller listing approved successfully",
      data: {
        listingId: listing._id,
        approvedBy: user.fullName,
        listingTitle: listing.title,
      },
    });
  } catch (error) {
    next(error);
  }
};

