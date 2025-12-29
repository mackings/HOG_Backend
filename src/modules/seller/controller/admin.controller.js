import User from '../../user/model/user.model.js';
import Category from '../../category/model/category.model.js';
import Listing from '../model/seller.model.js';
import Transaction from '../../transaction/model/transaction.model.js'; 
import Fee from "../model/fee.model.js";
import { sendApprovalEmail, sendRejectionEmail } from "../../../utils/emailService.utils.js";



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
        message: `You are not authorized to view this listing as a ${user.role}`,
      });
    }

    const { listingId } = req.params;
    const listing = await Listing.findById(listingId)
    .populate("userId", "fullName image address email phoneNumber subscriptionPlan wallet subscriptionStartDate subscriptionEndDate billTerm billImage")
    .populate("categoryId", "name");

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
        message: `You are not authorized to approve this listing as a ${user.role}`,
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



export const rejectSellerListing = async (req, res, next) => {
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
        message: `You are not authorized to approve this listing as a ${user.role}`,
      });
    }

    const { listingId } = req.params;
    const { reasons } = req.body;

    const listing = await Listing.findById(listingId);

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Seller listing not found",
      });
    }

    const listingOwner = await User.findById(listing.userId);
    if (!listingOwner) {
      return res.status(404).json({
        success: false,
        message: "Listing owner not found",
      });
    }

    await Listing.findByIdAndDelete(listingId);
    // Send approval email
    await sendRejectionEmail(
      listingOwner.email,
      listingOwner.fullName || "Seller",
      listing.title,
      reasons
    );

    return res.status(200).json({
      success: true,
      message: "Seller listing rejected successfully",
      data: {
        listingId: listing._id,
        rejectedBy: user.fullName,
        listingTitle: listing.title,
      },
    });
  } catch (error) {
    next(error);
  }
};


export const createListingFee = async (req, res, next) => {
  try {
    const { amount } = req.body;
    if (!amount) {
      return res.status(400).json({ message: "Amount field is required" });
    }

    const existingFee = await Fee.findOne();

    let fee;
    if (existingFee) {
      fee = await Fee.findByIdAndUpdate(
        existingFee._id,
        { amount },
        { new: true }
      );
    } else {
      fee = await Fee.create({ amount });
    } 
    return res.status(201).json({
      success: true,
      message: existingFee
        ? "Fee updated successfully"
        : "Fee created successfully",
      data: fee,
    });
  } catch (error) {
    next(error);
  }
};

export const getListingFee = async( req, res, next )=>{
  try {
    const fees = await Fee.find();
    return res.status(200).json({
      success: true,
      message: "Fees fetched successfully",
      data: fees
    });
  } catch (error) {
    next(error);
  }
}



export const totalUsers = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();

    if (totalUsers === 0) {
      return res.status(404).json({
        success: false,
        message: "No registered users found",
        data: []
      });
    }

    return res.status(200).json({
      success: true,
      message: "Total users fetched successfully",
      data: totalUsers
    });
  } catch (error) {
    next(error);
  }
};




export const totalNumberOfFreeAndPaidListings = async(req, res, next)=>{
  try {
    const freeListingsCount = await Listing.countDocuments({ price: { $eq: 0 } });
    const paidListingsCount = await Listing.countDocuments({ price: { $gt: 0 } });
    return res.status(200).json({
      success: true,
      message: "Total free and paid listings fetched successfully",
      data: {
        freeListings: freeListingsCount,
        paidListings: paidListingsCount
      }
    });
  } catch (error) {
    next(error);
  }
};



export const totalTransactions = async(req, res, next)=>{
  try {
    const totalTransaction = await Transaction.countDocuments();
    return res.status(200).json({
      success: true,
      message: "Total transactions fetched successfully",
      data: {
        totalTransactions: totalTransaction
      }
    });
  } catch (error) {
    next(error);
  }
};



export const totalListings = async(req, res, next)=>{
  try {
    const totalListing = await Listing.countDocuments();
    return res.status(200).json({
      success: true,
      message: "Total listings fetched successfully",
      data: {
        totalListings: totalListing
      }
    });
  } catch (error) {
    next(error);
  }
};


export const adminTotalEarnings = async (req, res, next) => {
  try {
    // Find the admin
    const admin = await User.findOne({ role: 'admin' });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    // If admin exists, use wallet value or 0
    const totalEarnings = admin.wallet || 0;

    return res.status(200).json({
      success: true,
      message: "Total earnings fetched successfully",
      data: {
        totalEarnings
      }
    });
  } catch (error) {
    next(error);
  }
};
