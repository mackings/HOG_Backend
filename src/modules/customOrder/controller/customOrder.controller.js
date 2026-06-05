import CustomRequest from "../model/customRequest.model.js";
import OrderWorkflow from "../model/orderWorkflow.model.js";
import EscrowPayment from "../model/escrowPayment.model.js";
import Vendor from "../../vendor/model/vendor.model.js";
import User from "../../user/model/user.model.js";
import mongoose from "mongoose";
import axios from "axios";
import crypto from "crypto";
import { rejectPastedMediaUrls, uploadedFileUrls } from "../../../utils/deviceUpload.utils.js";
import { markEscrowMilestonePaidByReference } from "../../../utils/escrowPayment.utils.js";

const buildRegex = (value) => new RegExp(String(value || "").trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
const WORKFLOW_STATUSES = ["quote_received", "accepted", "not_started", "in_production", "ready", "shipped", "delivered", "delayed", "cancelled"];

const resolveDesigner = async ({ designerId, vendorId, designerName, designerUsername, vendorName }) => {
  if (vendorId) {
    const vendor = await Vendor.findById(vendorId).lean();
    return { vendor, designerId: vendor?.userId };
  }
  if (designerId) {
    const vendor = await Vendor.findOne({ userId: designerId }).lean();
    return { vendor, designerId };
  }

  if (vendorName) {
    const vendor = await Vendor.findOne({ businessName: buildRegex(vendorName) }).lean();
    return { vendor, designerId: vendor?.userId };
  }

  if (designerName || designerUsername) {
    const query = designerUsername
      ? { username: String(designerUsername).trim().toLowerCase() }
      : { fullName: buildRegex(designerName) };
    const designer = await User.findOne({ ...query, role: "tailor" }).lean();
    const vendor = designer ? await Vendor.findOne({ userId: designer._id }).lean() : null;
    return { vendor, designerId: designer?._id };
  }

  return { vendor: null, designerId: null };
};

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
      designerName,
      designerUsername,
      vendorName,
      measurementProfileId,
      inspirationImages = [],
      styleNotes,
      fabricPreferences = [],
      deliveryTimelinePreference,
    } = req.body;

    if (rejectPastedMediaUrls(res, { inspirationImages })) return;

    const resolved = await resolveDesigner({ designerId, vendorId, designerName, designerUsername, vendorName });
    if (!resolved.designerId) {
      return res.status(400).json({
        success: false,
        message: "Select a designer from discovery/search before submitting a custom request",
      });
    }

    const request = await CustomRequest.create({
      customerId: id,
      designerId: resolved.designerId,
      vendorId: resolved.vendor?._id,
      measurementProfileId,
      inspirationImages: uploadedFileUrls(req),
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

export const getMyCustomRequests = async (req, res, next) => {
  try {
    const { id } = req.user;
    const requests = await CustomRequest.find({
      $or: [{ customerId: id }, { designerId: id }],
    })
      .sort({ updatedAt: -1 })
      .populate("customerId", "fullName image")
      .populate("designerId", "fullName image")
      .populate("vendorId", "businessName portfolioGallery availabilityStatus")
      .lean();

    return res.status(200).json({
      success: true,
      message: "Custom requests fetched successfully",
      data: requests.map((request) => ({
        threadId: request._id,
        title: request.vendorId?.businessName || request.designerId?.fullName || "Custom order",
        status: request.status,
        quote: request.quote,
        request,
      })),
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

export const getDesignerWorkflows = async (req, res, next) => {
  try {
    const { id } = req.user;
    const workflows = await OrderWorkflow.find({ designerId: id })
      .sort({ estimatedCompletionDate: 1, updatedAt: -1 })
      .populate("customerId", "fullName image email")
      .populate("designerId", "fullName image email")
      .lean();

    return res.status(200).json({
      success: true,
      message: "Designer workflows fetched successfully",
      data: workflows,
    });
  } catch (error) {
    next(error);
  }
};

export const createDesignerWorkflow = async (req, res, next) => {
  try {
    const { id } = req.user;
    const {
      customerId,
      customerName,
      customerEmail,
      attireName,
      workflowTitle,
      productionNotes,
      estimatedCompletionDate,
      status = "not_started",
      note,
    } = req.body;

    if (!customerName && !customerId) {
      return res.status(400).json({ success: false, message: "customerName or customerId is required" });
    }
    if (!attireName) {
      return res.status(400).json({ success: false, message: "attireName is required" });
    }
    if (!estimatedCompletionDate) {
      return res.status(400).json({ success: false, message: "estimatedCompletionDate is required" });
    }
    if (!WORKFLOW_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid workflow status" });
    }

    const completionDate = new Date(estimatedCompletionDate);
    if (Number.isNaN(completionDate.getTime())) {
      return res.status(400).json({ success: false, message: "estimatedCompletionDate must be a valid date" });
    }

    const workflow = await OrderWorkflow.create({
      orderId: new mongoose.Types.ObjectId(),
      orderType: "manual",
      customerId,
      designerId: id,
      customerName,
      customerEmail,
      attireName,
      workflowTitle: workflowTitle || attireName,
      productionNotes,
      currentStatus: status,
      estimatedCompletionDate: completionDate,
      timeline: [
        {
          status,
          note: note || "Designer created production workflow",
          updatedBy: id,
        },
      ],
    });

    return res.status(201).json({
      success: true,
      message: "Designer workflow created successfully",
      data: workflow,
    });
  } catch (error) {
    next(error);
  }
};

export const updateDesignerWorkflowStatus = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { workflowId } = req.params;
    const { status, note, estimatedCompletionDate, deliveryTrackingNumber, delayReason } = req.body;

    if (!WORKFLOW_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid workflow status" });
    }

    const updates = {
      currentStatus: status,
    };
    if (deliveryTrackingNumber !== undefined) updates.deliveryTrackingNumber = deliveryTrackingNumber;
    if (delayReason !== undefined) updates.delayReason = delayReason;
    if (status === "delayed") updates.delayNotifiedAt = new Date();

    if (estimatedCompletionDate !== undefined) {
      const completionDate = new Date(estimatedCompletionDate);
      if (Number.isNaN(completionDate.getTime())) {
        return res.status(400).json({ success: false, message: "estimatedCompletionDate must be a valid date" });
      }
      updates.estimatedCompletionDate = completionDate;
    }

    const workflow = await OrderWorkflow.findOneAndUpdate(
      { _id: workflowId, designerId: id },
      {
        $set: updates,
        $push: { timeline: { status, note, updatedBy: id } },
      },
      { new: true, runValidators: true }
    );

    if (!workflow) {
      return res.status(404).json({ success: false, message: "Workflow not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Workflow status updated successfully",
      data: workflow,
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
    const { milestoneName } = req.body;

    const escrow = await EscrowPayment.findById(escrowId);
    if (!escrow) return res.status(404).json({ success: false, message: "Escrow record not found" });

    const milestone = escrow.milestones.find((item) => item.name === milestoneName);
    if (!milestone) return res.status(404).json({ success: false, message: "Milestone not found" });

    milestone.status = "paid";
    milestone.reference = `HOG-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
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

export const payCustomRequestMilestone = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { requestId } = req.params;
    const { milestoneName, callbackUrl } = req.body;

    const [escrow, user] = await Promise.all([
      EscrowPayment.findOne({ orderId: requestId, orderType: "customRequest", customerId: id }),
      User.findById(id).lean(),
    ]);
    if (!escrow) return res.status(404).json({ success: false, message: "Payment protection record not found for this order" });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const milestone = escrow.milestones.find((item) => item.name === milestoneName);
    if (!milestone) return res.status(404).json({ success: false, message: "Payment milestone not found" });
    if (milestone.status === "paid") {
      return res.status(409).json({ success: false, message: "This milestone has already been paid" });
    }

    const paymentReference = `HOG-ESC-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
    milestone.reference = paymentReference;
    await escrow.save();

    const paystackResponse = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: user.email,
        amount: Math.round(Number(milestone.amount || 0) * 100),
        currency: escrow.currency || "NGN",
        reference: paymentReference,
        callback_url: callbackUrl || `${process.env.FRONTEND_URL}/payment-success`,
        metadata: {
          paymentType: "custom_order_escrow",
          escrowId: escrow._id.toString(),
          orderId: escrow.orderId.toString(),
          orderType: escrow.orderType,
          milestoneName: milestone.name,
          customerId: escrow.customerId.toString(),
          designerId: escrow.designerId.toString(),
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_MAIN_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (paystackResponse.status !== 200 || !paystackResponse.data?.data?.authorization_url) {
      milestone.reference = undefined;
      await escrow.save();
      return res.status(400).json({
        success: false,
        message: "Escrow payment initialization failed",
        error: paystackResponse.data?.message || "Unknown error",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Escrow payment initialized successfully",
      data: {
        authorizationUrl: paystackResponse.data.data.authorization_url,
        accessCode: paystackResponse.data.data.access_code,
        paymentReference,
        gateway: "Paystack",
        amount: milestone.amount,
        currency: escrow.currency || "NGN",
        milestone: {
          name: milestone.name,
          amount: milestone.amount,
          status: milestone.status,
          reference: milestone.reference,
        },
        escrow,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const verifyEscrowMilestonePayment = async (req, res, next) => {
  try {
    const { id, role } = req.user;
    const { paymentReference } = req.params;

    const escrow = await EscrowPayment.findOne({ "milestones.reference": paymentReference });
    if (!escrow) return res.status(404).json({ success: false, message: "Escrow payment reference not found" });
    if (
      String(escrow.customerId) !== String(id) &&
      String(escrow.designerId) !== String(id) &&
      !["admin", "superAdmin"].includes(role)
    ) {
      return res.status(403).json({ success: false, message: "You are not authorized to verify this escrow payment" });
    }

    const verifyResponse = await axios.get(
      `https://api.paystack.co/transaction/verify/${paymentReference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_MAIN_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const paystackData = verifyResponse.data?.data;
    if (!verifyResponse.data?.status || paystackData?.status !== "success") {
      return res.status(400).json({
        success: false,
        message: "Escrow payment has not been completed",
        data: paystackData,
      });
    }

    const result = await markEscrowMilestonePaidByReference({
      reference: paymentReference,
      gatewayPayload: paystackData,
    });

    return res.status(200).json({
      success: true,
      message: result.wasAlreadyPaid
        ? "Escrow payment was already confirmed"
        : "Escrow payment confirmed and held successfully",
      data: {
        escrow: result.escrow,
        milestone: result.milestone,
        gateway: {
          provider: "Paystack",
          status: paystackData.status,
          reference: paystackData.reference,
          amount: Number(paystackData.amount || 0) / 100,
          currency: paystackData.currency,
        },
      },
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

    await User.findByIdAndUpdate(
      escrow.designerId,
      { $inc: { wallet: releaseAmount } },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Escrow payment release recorded successfully",
      data: escrow,
    });
  } catch (error) {
    next(error);
  }
};

export const getDesignerEscrowWallet = async (req, res, next) => {
  try {
    const { id } = req.user;
    const escrows = await EscrowPayment.find({ designerId: id })
      .sort({ updatedAt: -1 })
      .populate("customerId", "fullName image")
      .lean();

    const summary = escrows.reduce(
      (acc, escrow) => {
        const paidHeld = escrow.milestones
          .filter((milestone) => milestone.status === "paid")
          .reduce((sum, milestone) => sum + Number(milestone.amount || 0), 0);
        const pending = Math.max(0, paidHeld - Number(escrow.releasedAmount || 0) - Number(escrow.refundedAmount || 0));
        acc.pendingEscrow += pending;
        acc.released += Number(escrow.releasedAmount || 0);
        acc.refunded += Number(escrow.refundedAmount || 0);
        return acc;
      },
      { pendingEscrow: 0, released: 0, refunded: 0 }
    );

    return res.status(200).json({
      success: true,
      message: "Designer escrow wallet fetched successfully",
      data: {
        summary,
        orders: escrows,
      },
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
