import User from "../../user/model/user.model"
import MakeOffer from "../model/makeOffer.model"
import Review from "../../review/model/review.model"
import Vendor from "../../vendor/model/vendor.model"
import mongoose from "mongoose";
import Notification from "../model/notification.model"
import Material from "../../material/model/material.model"



export const createMakeOffer = async (req, res, next) => {
  try {
    const { id } = req.user;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const { reviewId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({ success: false, message: "Invalid review ID" });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    const { comment, materialTotalCost, workmanshipTotalCost } = req.body;

    // Validate costs
    const materialCost = Number(materialTotalCost) || 0;
    const workmanshipCost = Number(workmanshipTotalCost) || 0;
    const totalCost = materialCost + workmanshipCost;

    // Ensure vendorId and materialId are available
    const vendorId = review.vendorId;
    const materialId = review.materialId;

    if (!vendorId || !materialId) {
      return res.status(400).json({ success: false, message: "Missing vendor or material information in review" });
    }

    // Check if offer already exists for this review
    let existingOffer = await MakeOffer.findOne({
      userId: user._id,
      vendorId,
      materialId,
      reviewId: review._id,
      status: "makeOffered",
    });

    let offer;

    if (existingOffer) {
      // Update existing offer
      offer = await MakeOffer.findByIdAndUpdate(
        existingOffer._id,
        {
          $set: {
            materialTotalCost: materialCost,
            workmanshipTotalCost: workmanshipCost,
            totalCost,
            comment,
            status: "makeOffered",
          },
        },
        { new: true }
      );
    } else {
      // Create new offer
      offer = await MakeOffer.create({
        userId: user._id,
        vendorId,
        materialId,
        reviewId: review._id,
        materialTotalCost: materialCost,
        workmanshipTotalCost: workmanshipCost,
        totalCost,
        comment,
        status: "makeOffered",
      });
    }

    if (!offer) {
      return res.status(500).json({
        success: false,
        message: "Error making offer",
      });
    }

    return res.status(201).json({
      success: true,
      message: existingOffer ? "Offer updated successfully" : "Offer created successfully",
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

    const offer = await MakeOffer.findById(offerId);
    if (!offer) {
      return res.status(404).json({ success: false, message: "Offer not found" });
    }

    if(offer.status == "accepted"){
      return res.status(400).json({ success: false, message: "Offer already accepted" });
    }

    if(offer.status == "rejected"){
      return res.status(400).json({ success: false, message: "Offer already rejected" });
    }

    const materialOwner = await Vendor.findOne({ userId: vendor._id });

    // Ensure this vendor owns the offer
    if (String(offer.vendorId._id) !== String(materialOwner._id)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to reply to this offer, it's not your material",
      });
    }

    const { action, counterMaterialCost, counterWorkmanshipCost, comment } = req.body;

    // Ensure valid action type
    const validActions = ["accepted", "rejected", "countered"];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action. Must be accepted, rejected, or countered",
      });
    }

    let updatedData = { status: action };
    let notificationMessage = "";

    // Handle counter offer
    if (action === "countered") {
      const materialCost = Number(counterMaterialCost) || 0;
      const workmanshipCost = Number(counterWorkmanshipCost) || 0;
      const totalCost = materialCost + workmanshipCost;

      updatedData = {
        ...updatedData,
        counterMaterialCost: materialCost,
        counterWorkmanshipCost: workmanshipCost,
        counterTotalCost: totalCost,
        vendorComment: comment || "Vendor provided a counter offer.",
      };

      notificationMessage = `${vendor.fullName} has sent you a counter offer.`;
    } else if (action === "accepted") {
      notificationMessage = `${vendor.fullName} has accepted your offer.`;
    } else if (action === "rejected") {
      notificationMessage = `${vendor.fullName} has rejected your offer.`;
    }

    const updatedOffer = await MakeOffer.findByIdAndUpdate(
      offer._id,
      { $set: updatedData },
      { new: true }
    );

    if(action == "accepted"){
      await Review.findByIdAndUpdate(offer.reviewId, 
        { 
          $set: { 
          materialTotalCost: updatedOffer.materialTotalCost,
          workmanshipTotalCost: updatedOffer.workmanshipTotalCost,
          totalCost: updatedOffer.totalCost,
          status: "approved"
        } 
        });
    }

    return res.status(200).json({
      success: true,
      message:
        action === "accepted"
          ? "Offer accepted successfully"
          : action === "rejected"
          ? "Offer rejected successfully"
          : "Counter offer submitted successfully",
      data: updatedOffer,
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

    const offer = await MakeOffer.findById(offerId);
    if (!offer) {
      return res.status(404).json({ success: false, message: "Offer not found" });
    }

    if(offer.status == "accepted"){
      return res.status(400).json({ success: false, message: "Offer already accepted" });
    }

    if(offer.status == "rejected"){
      return res.status(400).json({ success: false, message: "Offer already rejected" });
    }

    // Ensure this buyer owns the offer
    if (String(offer.userId._id) !== String(buyer._id)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to reply to this offer, it's not your offer",
      });
    }

    const { action, counterMaterialCost, counterWorkmanshipCost, comment } = req.body;

    // Valid action types for buyer
    const validActions = ["accepted", "rejected", "countered"];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action. Must be accepted, rejected, or countered",
      });
    }

    let updatedData = { buyerResponse: action };
    let notificationMessage = "";

    if (action === "countered") {
      const materialCost = Number(counterMaterialCost) || 0;
      const workmanshipCost = Number(counterWorkmanshipCost) || 0;
      const totalCost = materialCost + workmanshipCost;

      updatedData = {
        ...updatedData,
        buyerCounterMaterialCost: materialCost,
        buyerCounterWorkmanshipCost: workmanshipCost,
        buyerCounterTotalCost: totalCost,
        buyerComment: comment || "Buyer sent a new counter offer.",
        status: "buyerCountered",
      };

      notificationMessage = `${buyer.fullName} has sent a counter offer in response to your proposal.`;
    } else if (action === "accepted") {
      updatedData.status = "buyerAccepted";
      notificationMessage = `${buyer.fullName} has accepted your offer.`;
    } else if (action === "rejected") {
      updatedData.status = "buyerRejected";
      notificationMessage = `${buyer.fullName} has rejected your offer.`;
    }

    const updatedOffer = await MakeOffer.findByIdAndUpdate(
      offer._id,
      { $set: updatedData },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message:
        action === "accepted"
          ? "You accepted the vendor's offer successfully"
          : action === "rejected"
          ? "You rejected the vendor's offer successfully"
          : "Counter offer submitted successfully",
      data: updatedOffer,
    });
  } catch (error) {
    next(error);
  }
};


export const getAllMakeOffers = async (req, res, next) => {
  try {
    const { id } = req.user;

    // Find the user
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Find vendor (if logged-in user is a vendor)
    const vendor = await Vendor.findOne({ userId: id });

    // Build filter dynamically
    const filter = [];
    if (user?._id) filter.push({ userId: user._id });
    if (vendor?._id) filter.push({ vendorId: vendor._id });

    // If neither user nor vendor found, return empty
    if (filter.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No make offers found",
        data: [],
      });
    }

    // Fetch all offers involving this user or vendor
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
      .sort({ createdAt: -1 });

    if (!makeOffers || makeOffers.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No make offers found",
        data: [],
      });
    }

    return res.status(200).json({
      success: true,
      message: "Make offers retrieved successfully",
      count: makeOffers.length,
      data: makeOffers,
    });
  } catch (error) {
    next(error);
  }
};


export const getMakeOfferById = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { offerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(offerId)) {
      return res.status(400).json({ success: false, message: "Invalid offer ID" });
    }

    // Find user and vendor
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const vendor = await Vendor.findOne({ userId: id });

    // Find the offer
    const offer = await MakeOffer.findById(offerId)
      .populate("userId vendorId materialId reviewId");

    if (!offer) {
      return res.status(404).json({ success: false, message: "Offer not found" });
    }

    // Ensure the requesting user is authorized to view it
    const isAuthorized =
      String(offer.userId?._id) === String(user._id) ||
      (vendor && String(offer.vendorId?._id) === String(vendor._id));

    if (!isAuthorized) {
      return res.status(403).json({ success: false, message: "You are not authorized to view this offer" });
    }

    if (req.query.markAsRead === "true") {
      await Notification.updateMany(
        { offerId: offer._id, isRead: false },
        { $set: { isRead: true } }
      );
    }

    return res.status(200).json({
      success: true,
      message: "Offer retrieved successfully",
      data: offer,
    });

  } catch (error) {
    next(error);
  }
};

