import User from '../../user/model/user.model.js';
import Material from '../../material/model/material.model.js';
import Vendor from '../../vendor/model/vendor.model.js';
import Category from '../../category/model/category.model.js';
import Transactions from '../../transaction/model/transaction.model.js';
import Review from '../../review/model/review.model.js';
import mongoose from "mongoose";
import Commission from '../../commission/model/commission.model.js';
import { sendReviewUpdateEmail } from "../../../utils/emailService.utils.js";



export const createReview = async (req, res, next) => {
  try {
    const { id } = req.user;
    const user = await User.findById(id);
    if (user.role !== "tailor") {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to create a review and quote of the material for the vendor",
      });
    }

    const { materialId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(materialId)) {
      return res.status(400).json({ success: false, message: "Invalid material ID" });
    }

    const material = await Material.findById(materialId);
    if (!material) {
      return res.status(404).json({ success: false, message: "Material not found" });
    }

    const vendor = await Vendor.findOne({ userId: user._id });
    if (!vendor) {
      return res.status(403).json({ success: false, message: "Your organization has not been set up yet" });
    }

    const { comment, materialTotalCost, workmanshipTotalCost, deliveryDate, reminderDate } = req.body;

    // Get buyer (material owner) to check their country
    const buyer = await User.findById(material.userId);
    if (!buyer) {
      return res.status(404).json({ success: false, message: "Material owner not found" });
    }

    const tailorCountry = user.country?.toUpperCase().trim() || '';
    const buyerCountry = buyer.country?.toUpperCase().trim() || '';
    const isInternationalTailor = ['UNITED STATES', 'US', 'USA', 'UNITED KINGDOM', 'UK', 'GB'].includes(tailorCountry);
    const isNigerianBuyer = ['NIGERIA', 'NG', 'NIGERIAN'].includes(buyerCountry);

    console.log(`\n💼 REVIEW CREATION:`);
    console.log(`   Tailor Country: ${tailorCountry} (${isInternationalTailor ? 'International' : 'Nigerian'})`);
    console.log(`   Buyer Country: ${buyerCountry} (${isNigerianBuyer ? 'Nigerian' : 'International'})`);

    let materialCost = Number(materialTotalCost) || 0;
    let workmanshipCost = Number(workmanshipTotalCost) || 0;
    let subTotalCost = materialCost + workmanshipCost;

    let materialCostUSD = 0;
    let workmanshipCostUSD = 0;
    let subTotalCostUSD = 0;
    let totalCostUSD = 0;
    let exchangeRate = 0;

    // If US/UK tailor quoting to Nigerian buyer, convert USD to NGN
    if (isInternationalTailor && isNigerianBuyer) {
      console.log(`   💱 Converting USD → NGN (International tailor → Nigerian buyer)`);
      console.log(`   Material Cost (USD): $${materialCost}`);
      console.log(`   Workmanship Cost (USD): $${workmanshipCost}`);

      // Store original USD amounts
      materialCostUSD = materialCost;
      workmanshipCostUSD = workmanshipCost;
      subTotalCostUSD = subTotalCost;

      try {
        // Get exchange rate USD to NGN
        const axios = (await import('axios')).default;
        const apiKey = process.env.EXCHANGE_RATE_API_KEY;
        const apiUrl = `https://v6.exchangerate-api.com/v6/${apiKey}/pair/USD/NGN`;
        const conversionResponse = await axios.get(apiUrl);

        if (conversionResponse?.data?.result === "success") {
          exchangeRate = conversionResponse.data.conversion_rate; // e.g., 1 USD = 1445 NGN
          console.log(`   ✅ Exchange Rate: 1 USD = ₦${exchangeRate} NGN`);
        } else {
          exchangeRate = 1445; // fallback rate
          console.log(`   ⚠️  Using fallback rate: 1 USD = ₦${exchangeRate} NGN`);
        }
      } catch (error) {
        exchangeRate = 1445; // fallback
        console.log(`   ⚠️  API error, using fallback rate: 1 USD = ₦${exchangeRate} NGN`);
      }

      // Convert to NGN for storage
      materialCost = Math.round(materialCostUSD * exchangeRate);
      workmanshipCost = Math.round(workmanshipCostUSD * exchangeRate);
      subTotalCost = materialCost + workmanshipCost;

      console.log(`   Material Cost (NGN): ₦${materialCost}`);
      console.log(`   Workmanship Cost (NGN): ₦${workmanshipCost}`);
      console.log(`   Subtotal (NGN): ₦${subTotalCost}`);
    }

    const tax = 20 / 100 * subTotalCost;

    const feeDoc = await Commission.findOne();
    const feePercentage = feeDoc ? Number(feeDoc.amount) : 0;

    const grossAmount = Number(subTotalCost).toFixed(0);
    const fee = ((feePercentage / 100) * grossAmount).toFixed(0);
    const totalCost = Number(grossAmount) + Number(tax) + Number(fee);

    // Calculate USD total if conversion happened
    if (isInternationalTailor && isNigerianBuyer && exchangeRate > 0) {
      const taxUSD = 20 / 100 * subTotalCostUSD;
      const grossAmountUSD = Number(subTotalCostUSD).toFixed(2);
      const feeUSD = ((feePercentage / 100) * grossAmountUSD).toFixed(2);
      totalCostUSD = Number(grossAmountUSD) + Number(taxUSD) + Number(feeUSD);
      totalCostUSD = Math.round(totalCostUSD * 100) / 100;
      console.log(`   Total Cost (USD): $${totalCostUSD}`);
      console.log(`   Total Cost (NGN): ₦${totalCost}`);
    }

    // check if review exists
    let review = await Review.findOne({
      userId: user._id,
      vendorId: vendor._id,
      materialId: material._id,
      status: "requesting",
    });

    const reviewData = {
      materialTotalCost: materialCost,
      workmanshipTotalCost: workmanshipCost,
      totalCost,
      tax,
      subTotalCost,
      commission: fee,
      deliveryDate,
      reminderDate,
      comment,
      status: "quote",
      materialTotalCostUSD,
      workmanshipTotalCostUSD,
      subTotalCostUSD,
      totalCostUSD,
      amountToPayUSD: totalCostUSD,
      exchangeRate,
      isInternationalVendor: isInternationalTailor,
    };

    if (review) {
      review = await Review.findByIdAndUpdate(
        review._id,
        { $set: reviewData },
        { new: true }
      );
    } else {
      review = await Review.create({
        userId: user._id,
        vendorId: vendor._id,
        materialId: material._id,
        country: user.country,
        ...reviewData
      });
    }

    if (!review) {
      return res.status(500).json({
        success: false,
        message: "Review and quote of the material from the vendor failed to be established",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Review and quote of the material from the vendor successfully established",
      review,
    });
  } catch (error) {
    next(error);
  }
};



export const getAllMaterialOrders = async (req, res, next) => {
  try {
    const { id } = req.user;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.role !== "tailor") {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view material orders",
      });
    }

    // Ensure vendor exists
    const vendor = await Vendor.findOne({ userId: user._id });
    if (!vendor) {
      return res.status(403).json({
        success: false,
        message: "Your organization has not been set up yet",
      });
    }

    // Fetch vendor materials
    const materials = await Material.find({ isDelivered: false }).lean();

    if (materials.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No materials found",
        materials: [],
      });
    }

    return res.status(200).json({
      success: true,
      message: "Material orders successfully retrieved",
      materialsCount: materials.length,
      materials,
    });
  } catch (error) {
    next(error);
  }
};




export const getReviews = async (req, res, next) => {
  try {
    const { id } = req.user;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.role !== "tailor") {
        return res.status(403).json({
        success: false,
        message: "You are not authorized to create a review and quote of the material for the vendor",
      });
    }

    const vendor = await Vendor.findOne({ userId: user._id });
    const materials = await Material.find({ userId: user._id }).select("_id");
    const materialIds = materials.map((m) => m._id);

    // Build query conditions safely
    const query = { $or: [] };

    if (vendor) {
      query.$or.push({ vendorId: vendor._id });
    }
    if (materialIds.length > 0) {
      query.$or.push({ materialId: { $in: materialIds } });
    }

    // If no vendor & no materials, return empty set
    if (query.$or.length === 0) {
      return res.status(200).json({ success: true, count: 0, reviews: [] });
    }

    const reviews = await Review.find(query)
      .sort({ createdAt: -1 })
      .populate("userId", "fullName email image")
      .populate(
        "materialId",
        "userId attireType clothMaterial color brand measurement sampleImage settlement isDelivered specialInstructions"
      )
      .populate("vendorId", "userId businessName businessEmail businessPhone")
      .lean();

    return res.status(200).json({
      success: true,
      count: reviews.length,
      reviews,
    });
  } catch (error) {
    next(error);
  }
};


export const getReviewById = async (req, res, next) => {
  try {
    const { id } = req.user;
    const user = await User.findById(id);
    if (user.role !== "tailor") {
        return res.status(403).json({
        success: false,
        message: "You are not authorized to create a review and quote of the material for the vendor",
      });
    }
    const { reviewId } = req.params;

    // Validate reviewId upfront
    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({ success: false, message: "Invalid review ID" });
    }

    // Ensure user exists
    // const user = await User.findById(id);
    // if (!user) {
    //   return res.status(404).json({ success: false, message: "User not found" });
    // }

    // const vendor = await Vendor.findOne({ userId: user._id });

    // // Fetch materials owned by vendor
    // const materialIds = await Material.find({ userId: user._id }).distinct("_id");

    // Look up review by ID that belongs either to vendor or vendor’s materials
    const review = await Review.findOne({
      _id: reviewId,
      // $or: [{ vendorId: vendor._id }, { materialId: { $in: materialIds } }],
    })
      .populate("userId", "fullName email image")
      .populate(
        "materialId",
        "userId attireType clothMaterial color brand measurement sampleImage settlement isDelivered specialInstructions"
      )
      .populate("vendorId", "userId businessName businessEmail businessPhone")
      .lean();

    if (!review) {
      return res
        .status(200)
        .json({ success: true, review: null, message: "Review not found" });
    }

    return res.status(200).json({ success: true, review });
  } catch (error) {
    next(error);
  }
};


export const updateReview = async (req, res, next) => {
  try {
    const { id } = req.user;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.role !== "tailor") {
        return res.status(403).json({
        success: false,
        message: "You are not authorized to update a review and quote of the material for the vendor",
      });
    }

    const { reviewId } = req.params;

    const vendor = await Vendor.findOne({ userId: user._id });
    if (!vendor) {
      return res.status(403).json({
        success: false,
        message: "Your organization has not been set up yet",
      });
    }

    let review = await Review.findOne({ _id: reviewId, vendorId: vendor._id });
    if (!review) {
      return res.status(200).json({
        success: true,
        review: null,
        message: "Review not found",
      });
    }

    if (review.status === "approved") {
        return res.status(403).json({
          success: false,
          message: "You cannot update an approved review",
        });
    }

    const {
      comment,
      materialTotalCost,
      workmanshipTotalCost,
      deliveryDate,
      reminderDate,
    } = req.body;

    const subTotalCost = Number(materialTotalCost) + Number(workmanshipTotalCost);
    const tax = 20 / 100 * subTotalCost;

    const feeDoc = await Commission.findOne();
    const feePercentage = feeDoc ? Number(feeDoc.amount) : 0;

    const grossAmount = Number(subTotalCost).toFixed(0);
    const fee = ((feePercentage / 100) * grossAmount).toFixed(0);
    // const netAmount = (Number(grossAmount) - Number(fee)).toFixed(0)
    const totalCost = Number(grossAmount) + Number(tax) + Number(fee);

    // Update numeric fields safely
    if (materialTotalCost !== undefined) {
      review.materialTotalCost = Number(materialTotalCost) || 0;
    }
    if (workmanshipTotalCost !== undefined) {
      review.workmanshipTotalCost = Number(workmanshipTotalCost) || 0;
    }
    if(tax !== undefined) {
      review.tax = Number(tax) || 0;
    }
    if(subTotalCost !== undefined) {
      review.subTotalCost = Number(subTotalCost) || 0;
    }

    if(fee !== undefined) {
      review.fee = Number(fee) || 0;
    }
    if(totalCost !== undefined) {
      review.totalCost = Number(totalCost) || 0;
    }

    // Always recompute total
    // review.totalCost =
    //   (review.materialTotalCost || 0) + (review.workmanshipTotalCost || 0);

    if (comment !== undefined) review.comment = comment;
    if (deliveryDate !== undefined) review.deliveryDate = deliveryDate;
    if (reminderDate !== undefined) review.reminderDate = reminderDate;
    if (status !== undefined) review.status = "pending";


    await review.save();

    review = await Review.findById(review._id)
      .populate("userId", "fullName email image")
      .populate(
        "materialId",
        "userId attireType clothMaterial color brand measurement sampleImage settlement isDelivered specialInstructions"
      )
      .populate("vendorId", "userId businessName businessEmail businessPhone")
      .lean();

    return res.status(200).json({
      success: true,
      message: "Review updated successfully",
      review,
    });
  } catch (error) {
    next(error);
  }
};


export const deleteReview = async (req, res, next) => {
  try {
    const { id } = req.user;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.role !== "tailor") {
        return res.status(403).json({
        success: false,
        message: "You are not authorized to delete a review and quote of the material for the vendor",
      });
    }

    const { reviewId } = req.params;

    const vendor = await Vendor.findOne({ userId: user._id });
    if (!vendor) {
      return res.status(403).json({
        success: false,
        message: "Your organization has not been set up yet",
      });
    }

    // Check if review belongs to this vendor
    let review = await Review.findOne({ _id: reviewId, vendorId: vendor._id });
    if (!review) {
      return res.status(200).json({
        success: true,
        review: null,
        message: "Review not found",
      });
    }

    if (review.status === "approved") {
      return res.status(403).json({
        success: false,
        message: "You cannot delete an approved review",
      });
    }

    const deletedReview = await Review.findById(review._id)
      .populate("userId", "fullName email image")
      .populate(
        "materialId",
        "userId attireType clothMaterial color brand measurement sampleImage settlement isDelivered specialInstructions"
      )
      .populate("vendorId", "userId businessName businessEmail businessPhone")
      .lean();

    await review.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Review deleted successfully",
      review: deletedReview,
    });
  } catch (error) {
    next(error);
  }
};



export const getAllMaterialsForReview = async (req, res, next) => {
  try {
    const { id } = req.user;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.role !== "user") {
      return res.status(403).json({
        success: false,
        message: "You must be a user to view your materials",
      });
    }

    const materials = await Material.find({ userId: user._id });

    return res.status(200).json({
      success: true,
      count: materials.length,
      materials,
    });
  } catch (error) {
    next(error);
  }
};


export const getReviewsForMaterialById = async (req, res, next) => {
  try {
    const { id } = req.user;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.role !== "user") {
      return res.status(403).json({
        success: false,
        message: "You must be a user to view reviews",
      });
    }

    const { materialId } = req.params;

    // Validate materialId
    if (!materialId || !mongoose.Types.ObjectId.isValid(materialId)) {
      return res.status(400).json({ success: false, message: "Invalid material ID" });
    }

    const material = await Material.findById(materialId);
    if (!material) {
      return res.status(404).json({ success: false, message: "Material not found" });
    }

    // Optional: Ensure material belongs to this user
    if (!material.userId.equals(user._id)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view reviews for this material",
      });
    }

    const reviews = await Review.find({ materialId: material._id })
      .populate("userId", "fullName email image country phoneNumber address")
      .lean();

    return res.status(200).json({
      success: true,
      count: reviews.length,
      reviews,
    });
  } catch (error) {
    next(error);
  }
};



export const updateReviewStatus = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { reviewId } = req.params;
    const { status } = req.body;

    // Validate reviewId
    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({ success: false, message: "Invalid review ID" });
    }

    // Ensure user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Role check
    if (user.role !== "user") {
      return res.status(403).json({
        success: false,
        message: "Only users are allowed to update review status",
      });
    }

    const ALLOWED_STATUSES = ["pending", "approved", "rejected", "resolved"];
    // Ensure status is provided and valid
    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status is required and must be one of: ${ALLOWED_STATUSES.join(", ")}`,
      });
    }

    // Find the review and ensure the material belongs to this user
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    const material = await Material.findOne({ _id: review.materialId, userId: user._id });
    if (!material) {
      return res.status(403).json({
        success: false,
        message: "You do not own the material linked to this review and quote, so you cannot update its status",
      });
    }

    // Update review
    const updatedReview = await Review.findByIdAndUpdate(
      reviewId,
      { $set: { status } },
      { new: true }
    )
      .populate("userId", "fullName email image")
      .populate("materialId", "attireType clothMaterial brand")
      .populate("vendorId", "businessName businessEmail businessPhone")
      .lean();

    await sendReviewUpdateEmail(updatedReview);


    return res.status(200).json({
      success: true,
      message: "Review status updated successfully",
      review: updatedReview,
    });
  } catch (error) {
    next(error);
  }
};




