import Dispute from "../model/dispute.model.js";
import CustomRequest from "../../customOrder/model/customRequest.model.js";

export const createDispute = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { respondentId, orderId, orderType, category, title, description, evidence, requestedResolution } = req.body;

    if (!orderId || !orderType || !category || !title || !description) {
      return res.status(400).json({ success: false, message: "orderId, orderType, category, title and description are required" });
    }

    const dispute = await Dispute.create({
      reporterId: id,
      respondentId,
      orderId,
      orderType,
      category,
      title,
      description,
      evidence,
      requestedResolution,
    });

    return res.status(201).json({ success: true, message: "Dispute ticket created successfully", data: dispute });
  } catch (error) {
    next(error);
  }
};

export const getSupportOrders = async (req, res, next) => {
  try {
    const { id } = req.user;
    const requests = await CustomRequest.find({
      status: { $in: ["accepted", "converted_to_order"] },
      $or: [{ customerId: id }, { designerId: id }],
    })
      .sort({ updatedAt: -1 })
      .populate("customerId", "fullName image")
      .populate("designerId", "fullName image")
      .populate("vendorId", "businessName")
      .lean();

    return res.status(200).json({
      success: true,
      message: "Support-eligible orders fetched successfully",
      data: requests.map((request) => ({
        supportTargetId: request._id,
        title: request.vendorId?.businessName || "Custom order",
        customer: request.customerId,
        designer: request.designerId,
        vendor: request.vendorId,
        status: request.status,
        quote: request.quote,
      })),
    });
  } catch (error) {
    next(error);
  }
};

export const createDisputeFromOrder = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { supportTargetId } = req.params;
    const { category, title, description, evidence, requestedResolution } = req.body;

    const request = await CustomRequest.findOne({
      _id: supportTargetId,
      $or: [{ customerId: id }, { designerId: id }],
    });
    if (!request) return res.status(404).json({ success: false, message: "Support order not found" });

    const respondentId = String(request.customerId) === String(id) ? request.designerId : request.customerId;

    const dispute = await Dispute.create({
      reporterId: id,
      respondentId,
      orderId: request._id,
      orderType: "customRequest",
      category,
      title,
      description,
      evidence,
      requestedResolution,
    });

    return res.status(201).json({
      success: true,
      message: "Dispute ticket created successfully",
      data: dispute,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyDisputes = async (req, res, next) => {
  try {
    const { id } = req.user;
    const disputes = await Dispute.find({ $or: [{ reporterId: id }, { respondentId: id }] }).sort({ createdAt: -1 }).lean();
    return res.status(200).json({ success: true, message: "Disputes fetched successfully", data: disputes });
  } catch (error) {
    next(error);
  }
};

export const getAllDisputes = async (req, res, next) => {
  try {
    const disputes = await Dispute.find().sort({ createdAt: -1 }).populate("reporterId respondentId", "fullName email").lean();
    return res.status(200).json({ success: true, message: "All disputes fetched successfully", data: disputes });
  } catch (error) {
    next(error);
  }
};

export const updateDispute = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { disputeId } = req.params;
    const { status, resolution, adminNote } = req.body;

    const update = { status, resolution, adminId: id };
    if (adminNote) update.$push = { adminNotes: { note: adminNote, adminId: id } };

    const dispute = await Dispute.findByIdAndUpdate(disputeId, update, { new: true });
    if (!dispute) return res.status(404).json({ success: false, message: "Dispute not found" });

    return res.status(200).json({ success: true, message: "Dispute updated successfully", data: dispute });
  } catch (error) {
    next(error);
  }
};
