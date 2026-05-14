import Dispute from "../model/dispute.model.js";

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

