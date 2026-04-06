import mongoose from 'mongoose';
import User from '../../user/model/user.model.js';
import Listing from '../model/seller.model.js';
import Transaction from '../../transaction/model/transaction.model.js';
import Fee from "../model/fee.model.js";
import { sendApprovalEmail, sendRejectionEmail } from "../../../utils/emailService.utils.js";

const MODERATOR_ROLES = ["admin", "superAdmin"];

const isModerator = (user) => MODERATOR_ROLES.includes(user?.role);

const parseBoolean = (value) => String(value).toLowerCase() === "true";

const getCurrentApprovalStatus = (listing) => {
  if (listing?.approvalStatus) return listing.approvalStatus;
  return listing?.isApproved ? "approved" : "pending";
};

const normalizeReasons = (reasons) => {
  if (Array.isArray(reasons)) {
    return reasons
      .map((reason) => String(reason || "").trim())
      .filter(Boolean);
  }

  if (typeof reasons === "string") {
    return reasons
      .split(/\r?\n|,/)
      .map((reason) => reason.trim())
      .filter(Boolean);
  }

  return [];
};

const getStatusFilter = (status = "pending") => {
  switch (status) {
    case "approved":
      return {
        $or: [
          { approvalStatus: "approved" },
          { approvalStatus: { $exists: false }, isApproved: true },
        ],
      };
    case "rejected":
      return { approvalStatus: "rejected" };
    case "pending":
    default:
      return {
        $or: [
          { approvalStatus: "pending" },
          { approvalStatus: { $exists: false }, isApproved: false },
        ],
      };
  }
};

const formatListingModeration = (listing) => ({
  ...listing,
  approvalStatus: getCurrentApprovalStatus(listing),
  rejectionReasons: Array.isArray(listing?.rejectionReasons) ? listing.rejectionReasons : [],
  moderationHistory: Array.isArray(listing?.moderationHistory) ? listing.moderationHistory : [],
});

const buildModerationFilters = (user, query = {}, forcedStatus) => {
  const status = forcedStatus || query.status || "pending";
  const filters = { ...getStatusFilter(status) };

  if (query.categoryId) {
    filters.categoryId = query.categoryId;
  }

  if (query.userId) {
    filters.userId = query.userId;
  }

  if (status === "approved") {
    if (user.role === "admin" || parseBoolean(query.mine)) {
      filters.approvedBy = user._id;
    } else if (query.approvedBy) {
      filters.approvedBy = query.approvedBy;
    }
  }

  if (status === "rejected") {
    if (user.role === "admin" || parseBoolean(query.mine)) {
      filters.rejectedBy = user._id;
    } else if (query.rejectedBy) {
      filters.rejectedBy = query.rejectedBy;
    }
  }

  return { status, filters };
};

const getPagination = (query = {}) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

const listSellerListingsByStatus = async (req, res, next, forcedStatus, message) => {
  try {
    const { id } = req.user;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!isModerator(user)) {
      return res.status(403).json({
        success: false,
        message: `You are not authorized to view seller listings as a ${user.role}`,
      });
    }

    const { status, filters } = buildModerationFilters(user, req.query, forcedStatus);
    const { page, limit, skip } = getPagination(req.query);

    const [listings, total] = await Promise.all([
      Listing.find(filters)
        .sort(status === "pending" ? { createdAt: -1 } : { updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("userId", "fullName image address email phoneNumber")
        .populate("categoryId", "name")
        .populate("approvedBy", "fullName email role")
        .populate("rejectedBy", "fullName email role")
        .lean(),
      Listing.countDocuments(filters),
    ]);

    return res.status(200).json({
      success: true,
      message,
      data: listings.map(formatListingModeration),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
      filters: {
        status,
        mine: parseBoolean(req.query.mine),
        approvedBy: req.query.approvedBy || null,
        rejectedBy: req.query.rejectedBy || null,
        categoryId: req.query.categoryId || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAllPendingSellerListings = async (req, res, next) =>
  listSellerListingsByStatus(req, res, next, "pending", "Pending seller listings fetched successfully");

export const getApprovedSellerListings = async (req, res, next) =>
  listSellerListingsByStatus(req, res, next, "approved", "Approved seller listings fetched successfully");

export const getRejectedSellerListings = async (req, res, next) =>
  listSellerListingsByStatus(req, res, next, "rejected", "Rejected seller listings fetched successfully");

export const getModeratedSellerListings = async (req, res, next) =>
  listSellerListingsByStatus(req, res, next, undefined, "Seller listings fetched successfully");

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

    if (!isModerator(user)) {
      return res.status(403).json({
        success: false,
        message: `You are not authorized to view this listing as a ${user.role}`,
      });
    }

    const { listingId } = req.params;
    const listing = await Listing.findById(listingId)
      .populate("userId", "fullName image address email phoneNumber subscriptionPlan wallet subscriptionStartDate subscriptionEndDate billTerm billImage")
      .populate("categoryId", "name")
      .populate("approvedBy", "fullName email role image")
      .populate("rejectedBy", "fullName email role image")
      .populate("moderationHistory.moderatorId", "fullName email role");

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Seller listing not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Seller listing fetched successfully",
      data: formatListingModeration(listing.toObject()),
    });
  } catch (error) {
    next(error);
  }
};

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

    if (!isModerator(user)) {
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

    const currentStatus = getCurrentApprovalStatus(listing);
    if (currentStatus === "approved") {
      return res.status(400).json({
        success: false,
        message: "Seller listing has already been approved",
      });
    }

    const listingOwner = await User.findById(listing.userId);
    if (!listingOwner) {
      return res.status(404).json({
        success: false,
        message: "Listing owner not found",
      });
    }

    const approvedAt = new Date();
    listing.isApproved = true;
    listing.approvalStatus = "approved";
    listing.approvedBy = user._id;
    listing.approvedAt = approvedAt;
    listing.rejectedBy = null;
    listing.rejectedAt = null;
    listing.rejectionReasons = [];
    listing.moderationHistory.push({
      action: "approved",
      moderatorId: user._id,
      moderatorName: user.fullName || user.email,
      moderatorRole: user.role,
      reason: null,
      createdAt: approvedAt,
    });
    await listing.save();

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
        listingTitle: listing.title,
        approvalStatus: listing.approvalStatus,
        approvedAt: listing.approvedAt,
        approvedBy: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
        },
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

    if (!isModerator(user)) {
      return res.status(403).json({
        success: false,
        message: `You are not authorized to reject this listing as a ${user.role}`,
      });
    }

    const { listingId } = req.params;
    const reasons = normalizeReasons(req.body?.reasons);

    if (reasons.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one rejection reason is required",
      });
    }

    const listing = await Listing.findById(listingId);

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Seller listing not found",
      });
    }

    if (getCurrentApprovalStatus(listing) === "rejected") {
      return res.status(400).json({
        success: false,
        message: "Seller listing has already been rejected",
      });
    }

    const listingOwner = await User.findById(listing.userId);
    if (!listingOwner) {
      return res.status(404).json({
        success: false,
        message: "Listing owner not found",
      });
    }

    const rejectedAt = new Date();
    listing.isApproved = false;
    listing.approvalStatus = "rejected";
    listing.rejectedBy = user._id;
    listing.rejectedAt = rejectedAt;
    listing.rejectionReasons = reasons;
    listing.moderationHistory.push({
      action: "rejected",
      moderatorId: user._id,
      moderatorName: user.fullName || user.email,
      moderatorRole: user.role,
      reason: reasons.join(", "),
      createdAt: rejectedAt,
    });
    await listing.save();

    await sendRejectionEmail(
      listingOwner.email,
      listingOwner.fullName || "Seller",
      listing.title,
      reasons.join(", ")
    );

    return res.status(200).json({
      success: true,
      message: "Seller listing rejected successfully",
      data: {
        listingId: listing._id,
        listingTitle: listing.title,
        approvalStatus: listing.approvalStatus,
        rejectedAt: listing.rejectedAt,
        rejectionReasons: listing.rejectionReasons,
        rejectedBy: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getListingModerationHistory = async (req, res, next) => {
  try {
    const { id } = req.user;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!isModerator(user)) {
      return res.status(403).json({
        success: false,
        message: `You are not authorized to view listing moderation history as a ${user.role}`,
      });
    }

    const { page, limit, skip } = getPagination(req.query);
    const match = {};

    if (req.query.action) {
      match["moderationHistory.action"] = req.query.action;
    }

    if (user.role === "admin") {
      match["moderationHistory.moderatorId"] = new mongoose.Types.ObjectId(user._id);
    } else if (req.query.moderatorId) {
      match["moderationHistory.moderatorId"] = new mongoose.Types.ObjectId(req.query.moderatorId);
    }

    const pipeline = [
      { $match: { moderationHistory: { $exists: true, $ne: [] } } },
      { $unwind: "$moderationHistory" },
      { $match: match },
      { $sort: { "moderationHistory.createdAt": -1 } },
      {
        $project: {
          _id: 0,
          listingId: "$_id",
          listingTitle: "$title",
          sellerId: "$userId",
          categoryId: "$categoryId",
          currentStatus: {
            $ifNull: ["$approvalStatus", { $cond: [{ $eq: ["$isApproved", true] }, "approved", "pending"] }],
          },
          action: "$moderationHistory.action",
          moderatorId: "$moderationHistory.moderatorId",
          moderatorName: "$moderationHistory.moderatorName",
          moderatorRole: "$moderationHistory.moderatorRole",
          reason: "$moderationHistory.reason",
          moderatedAt: "$moderationHistory.createdAt",
        },
      },
      { $skip: skip },
      { $limit: limit },
    ];

    const countPipeline = [
      { $match: { moderationHistory: { $exists: true, $ne: [] } } },
      { $unwind: "$moderationHistory" },
      { $match: match },
      { $count: "total" },
    ];

    const approvedScope = user.role === "admin"
      ? { ...getStatusFilter("approved"), approvedBy: user._id }
      : req.query.moderatorId
        ? { ...getStatusFilter("approved"), approvedBy: req.query.moderatorId }
        : getStatusFilter("approved");

    const rejectedScope = user.role === "admin"
      ? { ...getStatusFilter("rejected"), rejectedBy: user._id }
      : req.query.moderatorId
        ? { ...getStatusFilter("rejected"), rejectedBy: req.query.moderatorId }
        : getStatusFilter("rejected");

    const [history, countResult, pendingCount, approvedCount, rejectedCount] = await Promise.all([
      Listing.aggregate(pipeline),
      Listing.aggregate(countPipeline),
      Listing.countDocuments(getStatusFilter("pending")),
      Listing.countDocuments(approvedScope),
      Listing.countDocuments(rejectedScope),
    ]);

    const total = countResult[0]?.total || 0;

    return res.status(200).json({
      success: true,
      message: "Listing moderation history fetched successfully",
      data: history,
      summary: {
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
      filters: {
        action: req.query.action || null,
        moderatorId: user.role === "admin" ? String(user._id) : req.query.moderatorId || null,
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
