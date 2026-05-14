import CustomRequest from "../model/customRequest.model.js";
import OrderWorkflow from "../model/orderWorkflow.model.js";
import EscrowPayment from "../model/escrowPayment.model.js";
import Vendor from "../../vendor/model/vendor.model.js";

export const designerRespondToCustomRequest = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { requestId } = req.params;
    const { action, note } = req.body;

    if (!["accept", "decline"].includes(action)) {
      return res.status(400).json({ success: false, message: "action must be accept or decline" });
    }

    const request = await CustomRequest.findById(requestId);
    if (!request) return res.status(404).json({ success: false, message: "Custom request not found" });
    if (String(request.designerId) !== String(id)) {
      return res.status(403).json({ success: false, message: "Only the assigned designer can respond to this request" });
    }

    request.status = action === "accept" ? "designer_review" : "declined";
    if (note) {
      request.revisions.push({
        requestedBy: id,
        note,
        status: action === "accept" ? "resolved" : "open",
      });
    }
    await request.save();

    return res.status(200).json({
      success: true,
      message: action === "accept" ? "Custom request accepted for review" : "Custom request declined",
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

export const createCustomRequest = async (req, res, next) => {
  try {
    const { id } = req.user;
    const {
      designerId,
      vendorId,
      measurementProfileId,
      inspirationImages = [],
      styleNotes,
      fabricPreferences = [],
      deliveryTimelinePreference,
    } = req.body;

    if (!designerId && !vendorId) {
      return res.status(400).json({ success: false, message: "designerId or vendorId is required" });
    }

    const vendor = vendorId ? await Vendor.findById(vendorId).lean() : await Vendor.findOne({ userId: designerId }).lean();
    const request = await CustomRequest.create({
      customerId: id,
      designerId: designerId || vendor?.userId,
      vendorId: vendor?._id || vendorId,
      measurementProfileId,
      inspirationImages,
      styleNotes,
      fabricPreferences,
      deliveryTimelinePreference,
    });

    return res.status(201).json({
      success: true,
      message: "Custom order request submitted successfully",
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

export const submitCustomQuote = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { requestId } = req.params;
    const { materialCost, workmanshipCost, currency = "NGN", estimatedProductionDays, fabricRecommendations, note } = req.body;

    const request = await CustomRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: "Custom request not found" });
    }
    if (String(request.designerId) !== String(id)) {
      return res.status(403).json({ success: false, message: "Only the assigned designer can submit a quote" });
    }

    request.quote = {
      materialCost,
      workmanshipCost,
      totalCost: Number(materialCost || 0) + Number(workmanshipCost || 0),
      currency,
      estimatedProductionDays,
      fabricRecommendations,
      note,
      submittedAt: new Date(),
    };
    request.status = "quote_submitted";
    await request.save();

    await OrderWorkflow.findOneAndUpdate(
      { orderId: request._id, orderType: "customRequest" },
      {
        customerId: request.customerId,
        designerId: request.designerId,
        currentStatus: "quote_received",
        $push: { timeline: { status: "quote_received", note: "Designer submitted quote", updatedBy: id } },
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Custom quote submitted successfully",
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

export const requestQuoteRevision = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { requestId } = req.params;
    const { note } = req.body;

    const request = await CustomRequest.findById(requestId);
    if (!request) return res.status(404).json({ success: false, message: "Custom request not found" });
    if (String(request.customerId) !== String(id) && String(request.designerId) !== String(id)) {
      return res.status(403).json({ success: false, message: "You are not part of this custom request" });
    }

    request.revisions.push({ requestedBy: id, note });
    request.status = "revision_requested";
    await request.save();

    return res.status(200).json({
      success: true,
      message: "Quote revision requested successfully",
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

export const acceptCustomQuote = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { requestId } = req.params;

    const request = await CustomRequest.findById(requestId);
    if (!request) return res.status(404).json({ success: false, message: "Custom request not found" });
    if (String(request.customerId) !== String(id)) {
      return res.status(403).json({ success: false, message: "Only the customer can accept this quote" });
    }
    if (!request.quote?.totalCost) {
      return res.status(400).json({ success: false, message: "No quote has been submitted for this request" });
    }

    request.status = "accepted";
    await request.save();

    const workflow = await OrderWorkflow.findOneAndUpdate(
      { orderId: request._id, orderType: "customRequest" },
      {
        customerId: request.customerId,
        designerId: request.designerId,
        currentStatus: "accepted",
        $push: { timeline: { status: "accepted", note: "Customer accepted quote", updatedBy: id } },
      },
      { upsert: true, new: true }
    );

    const totalAmount = Number(request.quote.totalCost);
    const escrow = await EscrowPayment.create({
      orderId: request._id,
      orderType: "customRequest",
      customerId: request.customerId,
      designerId: request.designerId,
      totalAmount,
      depositAmount: Math.round(totalAmount * 0.5),
      balanceAmount: totalAmount - Math.round(totalAmount * 0.5),
      currency: request.quote.currency || "NGN",
      milestones: [
        { name: "deposit", amount: Math.round(totalAmount * 0.5) },
        { name: "balance", amount: totalAmount - Math.round(totalAmount * 0.5) },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Quote accepted and payment protection record created",
      data: { request, workflow, escrow },
    });
  } catch (error) {
    next(error);
  }
};

export const updateOrderWorkflow = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { orderType, orderId, status, note, estimatedCompletionDate, deliveryTrackingNumber, delayReason } = req.body;

    if (!orderType || !orderId || !status) {
      return res.status(400).json({ success: false, message: "orderType, orderId and status are required" });
    }

    const workflow = await OrderWorkflow.findOneAndUpdate(
      { orderType, orderId },
      {
        currentStatus: status,
        estimatedCompletionDate,
        deliveryTrackingNumber,
        delayReason,
        delayNotifiedAt: status === "delayed" ? new Date() : undefined,
        $push: { timeline: { status, note, updatedBy: id } },
      },
      { new: true, upsert: false }
    );

    if (!workflow) return res.status(404).json({ success: false, message: "Order workflow not found" });

    return res.status(200).json({
      success: true,
      message: "Order workflow updated successfully",
      data: workflow,
    });
  } catch (error) {
    next(error);
  }
};

export const recordEscrowPayment = async (req, res, next) => {
  try {
    const { escrowId } = req.params;
    const { milestoneName, reference } = req.body;

    const escrow = await EscrowPayment.findById(escrowId);
    if (!escrow) return res.status(404).json({ success: false, message: "Escrow record not found" });

    const milestone = escrow.milestones.find((item) => item.name === milestoneName);
    if (!milestone) return res.status(404).json({ success: false, message: "Milestone not found" });

    milestone.status = "paid";
    milestone.reference = reference;
    milestone.paidAt = new Date();
    escrow.status = escrow.milestones.every((item) => item.status === "paid") ? "fully_held" : "deposit_held";
    await escrow.save();

    return res.status(200).json({
      success: true,
      message: "Escrow milestone payment recorded successfully",
      data: escrow,
    });
  } catch (error) {
    next(error);
  }
};

export const releaseEscrowPayment = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { escrowId } = req.params;
    const { amount, adminNote } = req.body;

    const escrow = await EscrowPayment.findById(escrowId);
    if (!escrow) return res.status(404).json({ success: false, message: "Escrow record not found" });

    const remainingHeld = escrow.totalAmount - escrow.releasedAmount - escrow.refundedAmount;
    const releaseAmount = Number(amount || remainingHeld);
    if (releaseAmount <= 0) {
      return res.status(400).json({ success: false, message: "Release amount must be greater than zero" });
    }
    if (releaseAmount > remainingHeld) {
      return res.status(400).json({ success: false, message: "Release exceeds remaining held amount" });
    }

    escrow.releasedAmount += releaseAmount;
    escrow.status = escrow.releasedAmount + escrow.refundedAmount >= escrow.totalAmount ? "released" : escrow.status;
    escrow.deliveryConfirmedAt = escrow.deliveryConfirmedAt || new Date();
    escrow.adminInterventionBy = id;
    escrow.adminNote = adminNote;
    await escrow.save();

    return res.status(200).json({
      success: true,
      message: "Escrow payment release recorded successfully",
      data: escrow,
    });
  } catch (error) {
    next(error);
  }
};

export const refundEscrowPayment = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { escrowId } = req.params;
    const { amount, adminNote } = req.body;

    const escrow = await EscrowPayment.findById(escrowId);
    if (!escrow) return res.status(404).json({ success: false, message: "Escrow record not found" });

    const refundAmount = Number(amount || escrow.totalAmount - escrow.refundedAmount - escrow.releasedAmount);
    if (refundAmount <= 0) {
      return res.status(400).json({ success: false, message: "Refund amount must be greater than zero" });
    }
    if (refundAmount + escrow.refundedAmount + escrow.releasedAmount > escrow.totalAmount) {
      return res.status(400).json({ success: false, message: "Refund exceeds remaining held amount" });
    }

    escrow.refundedAmount += refundAmount;
    escrow.status = escrow.refundedAmount >= escrow.totalAmount ? "refunded" : "partially_refunded";
    escrow.adminInterventionBy = id;
    escrow.adminNote = adminNote;
    await escrow.save();

    return res.status(200).json({
      success: true,
      message: "Escrow refund recorded successfully",
      data: escrow,
    });
  } catch (error) {
    next(error);
  }
};

export const convertCustomRequestToOrder = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { requestId } = req.params;
    const { convertedOrderId, estimatedCompletionDate } = req.body;

    const request = await CustomRequest.findById(requestId);
    if (!request) return res.status(404).json({ success: false, message: "Custom request not found" });
    if (String(request.customerId) !== String(id) && String(request.designerId) !== String(id)) {
      return res.status(403).json({ success: false, message: "You are not part of this custom request" });
    }
    if (request.status !== "accepted") {
      return res.status(400).json({ success: false, message: "Only accepted custom requests can be converted to orders" });
    }

    request.status = "converted_to_order";
    request.convertedOrderId = convertedOrderId || request._id;
    await request.save();

    const workflow = await OrderWorkflow.findOneAndUpdate(
      { orderId: request._id, orderType: "customRequest" },
      {
        customerId: request.customerId,
        designerId: request.designerId,
        currentStatus: "accepted",
        estimatedCompletionDate,
        $push: { timeline: { status: "accepted", note: "Custom request converted to order", updatedBy: id } },
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Custom request converted to order successfully",
      data: { request, workflow },
    });
  } catch (error) {
    next(error);
  }
};
