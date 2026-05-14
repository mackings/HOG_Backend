import DesignerReview from "../model/designerReview.model.js";
import Transaction from "../../transaction/model/transaction.model.js";
import Vendor from "../../vendor/model/vendor.model.js";

const hasVerifiedPurchase = async ({ customerId, designerId, orderId, orderType }) => {
  if (orderType === "listing") {
    const transaction = await Transaction.findOne({
      userId: customerId,
      $or: [{ listingId: orderId }, { materialId: orderId }],
      paymentStatus: { $in: ["success", "full payment", "paid", "completed"] },
    }).lean();
    return Boolean(transaction);
  }

  const transaction = await Transaction.findOne({
    userId: customerId,
    $or: [{ materialId: orderId }, { vendorId: designerId }],
    paymentStatus: { $in: ["success", "full payment", "paid", "completed"] },
  }).lean();
  return Boolean(transaction);
};

export const createDesignerReview = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { designerId, vendorId, orderId, orderType, rating, categories, comment } = req.body;

    if (!designerId || !orderId || !orderType || !rating || !comment) {
      return res.status(400).json({ success: false, message: "designerId, orderId, orderType, rating and comment are required" });
    }

    const verified = await hasVerifiedPurchase({ customerId: id, designerId, orderId, orderType });
    if (!verified) {
      return res.status(403).json({ success: false, message: "Only verified purchase reviews are allowed" });
    }

    const vendor = vendorId ? await Vendor.findById(vendorId) : await Vendor.findOne({ userId: designerId });
    const review = await DesignerReview.create({
      customerId: id,
      designerId,
      vendorId: vendor?._id,
      orderId,
      orderType,
      rating,
      categories,
      comment,
      isVerifiedPurchase: true,
    });

    if (vendor) {
      vendor.ratings.push({ userId: id, value: Number(rating) });
      vendor.totalRatings = (vendor.totalRatings || 0) + 1;
      vendor.ratingSum = (vendor.ratingSum || 0) + Number(rating);
      await vendor.save();
    }

    return res.status(201).json({ success: true, message: "Designer review created successfully", data: review });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "You already reviewed this order" });
    }
    next(error);
  }
};

export const respondToDesignerReview = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { reviewId } = req.params;
    const { response } = req.body;

    const review = await DesignerReview.findById(reviewId);
    if (!review) return res.status(404).json({ success: false, message: "Review not found" });
    if (String(review.designerId) !== String(id)) {
      return res.status(403).json({ success: false, message: "Only the reviewed designer can respond" });
    }

    review.designerResponse = { response, respondedAt: new Date() };
    await review.save();

    return res.status(200).json({ success: true, message: "Review response saved successfully", data: review });
  } catch (error) {
    next(error);
  }
};

export const getDesignerReviews = async (req, res, next) => {
  try {
    const { designerId } = req.params;
    const reviews = await DesignerReview.find({ designerId })
      .sort({ createdAt: -1 })
      .populate("customerId", "fullName image")
      .lean();

    return res.status(200).json({ success: true, message: "Designer reviews fetched successfully", data: reviews });
  } catch (error) {
    next(error);
  }
};

