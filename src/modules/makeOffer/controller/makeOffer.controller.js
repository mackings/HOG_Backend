import User from "../../user/model/user.model"
import MakeOffer from "../model/makeOffer.model"
import Review from "../../review/model/review.model"
import Vendor from "../../vendor/model/vendor.model"
import mongoose from "mongoose";
import Material from "../../material/model/material.model"



export const createMakeOffer = async (req, res, next) => {
  try {
    const { id } = req.user;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const { reviewId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid review ID",
      });
    }

    // ✅ Check review existence
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    if (["approved", "rejected", "part payment", "full payment"].includes(review.status)) {
      return res.status(400).json({
        success: false,
        message: `This Quotation has already been ${review.status}.`,
      });
    }

    // ✅ Extract and validate inputs
    const { comment, materialTotalCost, workmanshipTotalCost } = req.body;
    const materialCost = Number(materialTotalCost);
    const workmanshipCost = Number(workmanshipTotalCost);

    if (isNaN(materialCost) || isNaN(workmanshipCost)) {
      return res.status(400).json({
        success: false,
        message: "Invalid cost values. Must be numeric.",
      });
    }

    const totalCost = materialCost + workmanshipCost;

    // ✅ Ensure vendor & material linkage
    const { vendorId, materialId } = review;
    if (!vendorId || !materialId) {
      return res.status(400).json({
        success: false,
        message:
          "Missing vendor or material information in the associated review.",
      });
    }

    // ✅ Check if offer already exists
    let offer = await MakeOffer.findOne({
      userId: user._id,
      vendorId,
      materialId,
      reviewId: review._id,
      status: "pending",
    });

    if (offer) {
      // 🔄 Update existing offer
      offer = await MakeOffer.findByIdAndUpdate(
        offer._id,
        {
          $set: {
            materialTotalCost: materialCost,
            workmanshipTotalCost: workmanshipCost,
            totalCost,
            comment: comment || offer.comment,
            status: "pending",
          },
          $push: {
            chats: {
              senderType: "customer",
              action: "pending",
              comment: comment || "Updated the offer terms",
              timestamp: new Date(),
            },
          },
        },
        { new: true }
      );
    } else {
      // 🆕 Create new offer
      offer = await MakeOffer.create({
        userId: user._id,
        vendorId,
        materialId,
        reviewId: review._id,
        materialTotalCost: materialCost,
        workmanshipTotalCost: workmanshipCost,
        totalCost,
        comment,
        status: "incoming",
        chats: [
          {
            senderType: "customer",
            action: "incoming",
            counterMaterialCost: materialCost,
            counterWorkmanshipCost: workmanshipCost,
            counterTotalCost: totalCost,
            comment: comment || "Sent a new offer",
            timestamp: new Date(),
          },
        ],
      });
    }

    if (!offer) {
      return res.status(500).json({
        success: false,
        message: "Error creating or updating offer",
      });
    }

    // ✅ Format response
    return res.status(201).json({
      success: true,
      message: offer.isNew
        ? "Offer created successfully"
        : "Offer updated successfully",
      data: offer,
    });
  } catch (error) {
    next(error);
  }
};



export const vendorReplyOffer = async (req, res, next) => {
  try {
    const { id } = req.user; // vendor ID
    const vendor = await User.findById(id);
    if (!vendor) {
      return res.status(404).json({ success: false, message: "Vendor not found" });
    }

    const { offerId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(offerId)) {
      return res.status(400).json({ success: false, message: "Invalid offer ID" });
    }

    const offer = await MakeOffer.findById(offerId)
      .populate({
        path: "vendorId",
        select: "businessName userId",
        populate: { path: "userId", select: "fullName email" },
      });

    if (!offer) {
      return res.status(404).json({ success: false, message: "Offer not found" });
    }

    if (["accepted", "rejected"].includes(offer.status)) {
      return res.status(400).json({
        success: false,
        message: `Offer has already been ${offer.status}.`,
      });
    }

    const materialOwner = await Vendor.findOne({ userId: vendor._id });
    if (!materialOwner || String(offer.vendorId?._id) !== String(materialOwner._id)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to reply to this offer.",
      });
    }

    const { action, counterMaterialCost, counterWorkmanshipCost, comment } = req.body;

    const validActions = ["accepted", "rejected", "countered"];
    if (!validActions.includes(action)) {
      return res.status(400).json({ success: false, message: "Invalid action type" });
    }

    const materialCost = Number(counterMaterialCost) || 0;
    const workmanshipCost = Number(counterWorkmanshipCost) || 0;
    const totalCost = materialCost + workmanshipCost;

    // Create chat entry
    const newChat = {
      senderType: "vendor",
      action,
      counterMaterialCost: materialCost,
      counterWorkmanshipCost: workmanshipCost,
      counterTotalCost: totalCost,
      comment: comment || "",
      timestamp: new Date(),
    };

    // Keep chat history
    offer.chats.push(newChat);

    // Update the current status for quick reference
    if (action === "countered") {
      offer.status = "pending";
    } else {
      offer.status = action;
    }
    // offer.status = action;
    await offer.save();

    // ✅ Sync with review if accepted
    if (action === "accepted" && offer.reviewId) {
      await Review.findByIdAndUpdate(
        offer.reviewId,
        {
          $set: {
            materialTotalCost: materialCost,
            workmanshipTotalCost: workmanshipCost,
            totalCost
          },
        },
        { new: true }
      );
    }

    return res.status(200).json({
      success: true,
      message:
        action === "accepted"
          ? "Offer accepted successfully"
          : action === "rejected"
          ? "Offer rejected successfully"
          : "Counter offer sent successfully",
      data: offer,
    });
  } catch (error) {
    next(error);
  }
};





export const buyerReplyToOffer = async (req, res, next) => {
  try {
    const { id } = req.user; // Buyer ID
    const buyer = await User.findById(id);

    if (!buyer) {
      return res.status(404).json({ success: false, message: "Buyer not found" });
    }

    const { offerId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(offerId)) {
      return res.status(400).json({ success: false, message: "Invalid offer ID" });
    }

    const offer = await MakeOffer.findById(offerId)
    .populate({
        path: "userId",
        select: "fullName email profileImage role",
      })
      // .populate({
      //   path: "vendorId",
      //   select: "businessName userId",
      //   populate: {
      //     path: "userId",
      //     select: "fullName email",
      //   },
      // })
    if (!offer) {
      return res.status(404).json({ success: false, message: "Offer not found" });
    }

    if (["accepted", "rejected"].includes(offer.status)) {
      return res.status(400).json({
        success: false,
        message: `Offer has already been ${offer.status}.`,
      });
    }

    // Ensure this buyer owns the offer
    if (String(offer.userId?._id) !== String(buyer._id)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to reply to this offer.",
      });
    }

    const { action, counterMaterialCost, counterWorkmanshipCost, comment } = req.body;

    const validActions = ["accepted", "rejected", "countered"];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action. Must be accepted, rejected, or countered.",
      });
    }

    const materialCost = Number(counterMaterialCost) || 0;
    const workmanshipCost = Number(counterWorkmanshipCost) || 0;
    const totalCost = materialCost + workmanshipCost;

    // Create new chat message instead of updating
    const newChat = {
      senderType: "customer",
      action,
      counterMaterialCost: materialCost,
      counterWorkmanshipCost: workmanshipCost,
      counterTotalCost: totalCost,
      comment: comment || "",
      timestamp: new Date(),
    };

    // Push chat message
    offer.chats.push(newChat);

    // Update latest status (for filtering)
    offer.status = action === "countered"
      ? "pending"
      : action === "accepted"
      ? "accepted"
      : "rejected";

    await offer.save();

    return res.status(200).json({
      success: true,
      message:
        action === "accepted"
          ? "You accepted the vendor's offer successfully"
          : action === "rejected"
          ? "You rejected the vendor's offer successfully"
          : "Counter offer sent successfully",
      data: offer,
    });
  } catch (error) {
    next(error);
  }
};



export const getAllMakeOffers = async (req, res, next) => {
  try {
    const { id } = req.user;

    // 🧩 Find logged-in user
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // 🧩 Check if the user is a vendor
    const vendor = await Vendor.findOne({ userId: id });

    // 🧩 Build dynamic query filter
    const filter = [];
    if (user?._id) filter.push({ userId: user._id });
    if (vendor?._id) filter.push({ vendorId: vendor._id });

    if (filter.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No make offers found",
        data: [],
      });
    }

    // 🧩 Fetch all offers involving the user or vendor
    const makeOffers = await MakeOffer.find({ $or: filter })
      .populate({
        path: "userId",
        select: "fullName email profileImage role",
      })
      .populate({
        path: "vendorId",
        select: "businessName userId",
        populate: {
          path: "userId",
          select: "fullName email",
        },
      })
      .populate("materialId reviewId")
      .sort({ createdAt: -1 })
      .lean(); // Use lean for better performance if you don’t need Mongoose documents

    if (!makeOffers || makeOffers.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No make offers found",
        data: [],
      });
    }

    // 🧩 Include chat summary (optional)
    const offersWithChatSummary = makeOffers.map((offer) => {
      const chats = offer.chats || [];
      const latestChat = chats.length > 0 ? chats[chats.length - 1] : null;

      return {
        ...offer,
        chatSummary: {
          totalMessages: chats.length,
          latestMessage: latestChat,
        },
      };
    });

    return res.status(200).json({
      success: true,
      message: "Make offers retrieved successfully",
      count: offersWithChatSummary.length,
      data: offersWithChatSummary,
    });
  } catch (error) {
    next(error);
  }
};


export const deleteAllMakeOffer = async (req, res, next) => {
  try {
    const deleteAllMakeOffer = await MakeOffer.deleteMany();
    if (!deleteAllMakeOffer) {
      return res.status(400).json({ success: false, message: "No make offer found" });
    }
    return res.status(200).json({ success: true, message: "All make offers deleted successfully" });
    }catch (error) {
    next(error);
    }

}


export const getMakeOfferById = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { offerId } = req.params;

    // 🧩 Validate offer ID
    if (!mongoose.Types.ObjectId.isValid(offerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid offer ID format",
      });
    }

    // 🧩 Check if user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // 🧩 Check if user is a vendor
    const vendor = await Vendor.findOne({ userId: id });

    // 🧩 Fetch offer and populate references
    const offer = await MakeOffer.findById(offerId)
      .populate({
        path: "userId",
        select: "fullName email profileImage role",
      })
      .populate({
        path: "vendorId",
        select: "businessName userId",
        populate: {
          path: "userId",
          select: "fullName email",
        },
      })
      .populate("materialId reviewId")
      .lean(); // Convert to plain JS object for efficiency

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: "Offer not found",
      });
    }

    // 🧩 Authorization: only user or vendor involved can access
    const isAuthorized =
      String(offer.userId?._id) === String(user._id) ||
      (vendor && String(offer.vendorId?._id) === String(vendor._id));

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this offer",
      });
    }

    // 🧩 Sort chats by timestamp (for consistent order)
    if (offer.chats && Array.isArray(offer.chats)) {
      offer.chats = offer.chats.sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      );
    }

    // 🧩 Optional chat summary
    const latestChat =
      offer.chats && offer.chats.length > 0
        ? offer.chats[offer.chats.length - 1]
        : null;

    return res.status(200).json({
      success: true,
      message: "Offer retrieved successfully",
      data: {
        ...offer,
        chatSummary: {
          totalMessages: offer.chats?.length || 0,
          latestMessage: latestChat,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

