import Conversation from "../model/conversation.model.js";
import Message from "../model/message.model.js";
import Vendor from "../../vendor/model/vendor.model.js";
import User from "../../user/model/user.model.js";
import CustomRequest from "../../customOrder/model/customRequest.model.js";
import Review from "../../review/model/review.model.js";
import Material from "../../material/model/material.model.js";
import { blockRestrictedContact, validateMessageAttachments } from "../../../utils/contactMask.utils.js";
import { rejectPastedMediaUrls, uploadedMessageAttachments } from "../../../utils/deviceUpload.utils.js";
import { sendEmail } from "../../../utils/emailService.utils.js";

const getRecipientId = (conversation, senderId) => {
  const sender = String(senderId);
  if (String(conversation.customerId) === sender) return conversation.designerId;
  return conversation.customerId;
};

const ensureParticipant = (conversation, userId) => {
  const id = String(userId);
  return String(conversation.customerId) === id || String(conversation.designerId) === id;
};

const AGREED_CUSTOM_REQUEST_STATUSES = ["accepted", "converted_to_order"];
const AGREED_REVIEW_STATUSES = ["part payment", "full payment"];

const isEligibleReview = (review) =>
  Boolean(review?.hasAcceptedOffer) ||
  Number(review?.amountPaid || 0) > 0 ||
  AGREED_REVIEW_STATUSES.includes(review?.status);

const reviewCustomerId = (review) => review.materialId?.userId?._id || review.materialId?.userId;
const reviewDesignerId = (review) => review.vendorId?.userId?._id || review.vendorId?.userId || review.userId?._id || review.userId;

const mapCustomRequestThread = (request) => ({
  threadId: request._id,
  threadType: "customRequest",
  title: request.vendorId?.businessName || request.designerId?.fullName || "Custom order",
  subtitle: request.quote?.totalCost ? `Agreed quote: ${request.quote.currency || "NGN"} ${request.quote.totalCost}` : "Agreed quotation",
  participants: {
    customer: request.customerId,
    designer: request.designerId,
  },
  status: request.status,
});

const mapReviewThread = (review) => ({
  threadId: review._id,
  threadType: "review",
  title: review.vendorId?.businessName || review.userId?.fullName || "Quotation",
  subtitle: review.totalCost ? `Quotation: NGN ${review.totalCost}` : "Accepted quotation",
  participants: {
    customer: review.materialId?.userId,
    designer: review.vendorId?.userId || review.userId,
  },
  status: review.status,
  hasAcceptedOffer: Boolean(review.hasAcceptedOffer),
  amountPaid: review.amountPaid || 0,
});

const resolveConversationThread = async ({ orderType, orderId, userId }) => {
  if (!["customRequest", "review"].includes(orderType)) {
    return { error: "Messaging is only available for agreed custom order quotation threads" };
  }

  if (orderType === "review") {
    const review = await Review.findById(orderId)
      .populate("materialId", "userId attireType clothMaterial")
      .populate("vendorId", "userId businessName")
      .populate("userId", "fullName image")
      .lean();

    if (!review) return { error: "Agreed quotation thread not found" };
    if (!isEligibleReview(review)) {
      return { error: "Messaging opens only after both parties agree on the quotation or payment begins" };
    }

    const customerId = reviewCustomerId(review);
    const designerId = reviewDesignerId(review);
    if (![customerId, designerId].some((participantId) => String(participantId) === String(userId))) {
      return { error: "You are not part of this quotation thread" };
    }

    return {
      thread: review,
      customerId,
      designerId,
      vendorId: review.vendorId?._id || review.vendorId,
    };
  }

  const request = await CustomRequest.findById(orderId).populate("vendorId", "businessName").lean();
  if (!request) return { error: "Agreed quotation thread not found" };
  if (!AGREED_CUSTOM_REQUEST_STATUSES.includes(request.status)) {
    return { error: "Messaging opens only after both parties agree on the quotation" };
  }
  if (![request.customerId, request.designerId].some((participantId) => String(participantId) === String(userId))) {
    return { error: "You are not part of this quotation thread" };
  }

  return {
    thread: request,
    customerId: request.customerId,
    designerId: request.designerId,
    vendorId: request.vendorId?._id || request.vendorId,
  };
};

export const getEligibleMessageThreads = async (req, res, next) => {
  try {
    const { id } = req.user;
    const vendor = await Vendor.findOne({ userId: id }).select("_id").lean();
    const customerMaterials = await Material.find({ userId: id }).select("_id").lean();
    const materialIds = customerMaterials.map((material) => material._id);

    const reviewFilters = [];
    if (vendor?._id) reviewFilters.push({ vendorId: vendor._id });
    if (materialIds.length > 0) reviewFilters.push({ materialId: { $in: materialIds } });
    reviewFilters.push({ userId: id });

    const [requests, reviews] = await Promise.all([
      CustomRequest.find({
        status: { $in: AGREED_CUSTOM_REQUEST_STATUSES },
        $or: [{ customerId: id }, { designerId: id }],
      })
        .sort({ updatedAt: -1 })
        .populate("customerId", "fullName image")
        .populate("designerId", "fullName image")
        .populate("vendorId", "businessName")
        .lean(),
      Review.find({
        $and: [
          { $or: reviewFilters },
          {
            $or: [
              { hasAcceptedOffer: true },
              { amountPaid: { $gt: 0 } },
              { status: { $in: AGREED_REVIEW_STATUSES } },
            ],
          },
        ],
      })
        .sort({ updatedAt: -1 })
        .populate({
          path: "materialId",
          select: "userId attireType clothMaterial",
          populate: { path: "userId", select: "fullName image" },
        })
        .populate({
          path: "vendorId",
          select: "userId businessName",
          populate: { path: "userId", select: "fullName image" },
        })
        .populate("userId", "fullName image")
        .lean(),
    ]);

    const threads = [
      ...requests.map(mapCustomRequestThread),
      ...reviews.filter(isEligibleReview).map(mapReviewThread),
    ];

    return res.status(200).json({
      success: true,
      message: "Eligible message threads fetched successfully",
      data: threads,
    });
  } catch (error) {
    next(error);
  }
};

export const createConversation = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { orderType = "customRequest", orderId, threadId, topic } = req.body;

    const selectedOrderId = orderId || threadId;
    if (!selectedOrderId) {
      return res.status(400).json({
        success: false,
        message: "Select an agreed quotation thread before starting a conversation",
      });
    }

    const resolved = await resolveConversationThread({ orderType, orderId: selectedOrderId, userId: id });
    if (resolved.error) {
      return res.status(403).json({ success: false, message: resolved.error });
    }

    const conversation = await Conversation.findOneAndUpdate(
      {
        orderType,
        orderId: selectedOrderId,
        customerId: resolved.customerId,
        designerId: resolved.designerId,
      },
      { $setOnInsert: { vendorId: resolved.vendorId, topic: topic || "general" } },
      { new: true, upsert: true }
    );

    return res.status(201).json({
      success: true,
      message: "Conversation ready",
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
};

export const sendMessage = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { conversationId } = req.params;
    const { content = "", attachments = [], topic = "general" } = req.body;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }

    if (!ensureParticipant(conversation, id)) {
      return res.status(403).json({ success: false, message: "You are not a participant in this conversation" });
    }

    if (conversation.restrictedUntil && conversation.restrictedUntil > new Date()) {
      return res.status(403).json({
        success: false,
        message: "Messaging is temporarily restricted because of repeated contact sharing attempts",
      });
    }

    const bodyAttachmentValidation = validateMessageAttachments(attachments);
    if (!bodyAttachmentValidation.valid) {
      return res.status(400).json({ success: false, message: bodyAttachmentValidation.message });
    }
    if (rejectPastedMediaUrls(res, { attachments })) return;

    const uploadedAttachments = uploadedMessageAttachments(req);
    if (Array.isArray(attachments) && attachments.length > 0 && uploadedAttachments.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Upload message attachments from the device instead of submitting attachment URLs.",
      });
    }
    const attachmentValidation = validateMessageAttachments(uploadedAttachments);
    if (!attachmentValidation.valid) {
      return res.status(400).json({ success: false, message: attachmentValidation.message });
    }

    const restricted = blockRestrictedContact(content);
    const recipientId = getRecipientId(conversation, id);

    if (!restricted.allowed) {
      const update = {
        status: "flagged",
        topic,
        lastMessageAt: new Date(),
        $inc: { flaggedCount: 1 },
      };
      if ((conversation.flaggedCount || 0) + 1 >= 3) {
        update.restrictedUntil = new Date(Date.now() + 60 * 60 * 1000);
      }

      await Conversation.findByIdAndUpdate(conversationId, update);
      await Message.create({
        conversationId,
        senderId: id,
        recipientId,
        messageType: "text",
        content: "",
        originalContent: content,
        topic,
        isFlagged: true,
        flagReason: "restricted_contact_attempt",
        detectedContactTypes: restricted.detected.map((item) => item.type),
        deliveryStatus: "blocked",
      });

      return res.status(400).json({
        success: false,
        message: restricted.prompt,
        data: {
          blocked: true,
          detectedContactTypes: restricted.detected.map((item) => item.type),
        },
      });
    }

    const messageType =
      attachmentValidation.attachments.length > 0 && content ? "mixed" :
      attachmentValidation.attachments[0]?.type || "text";

    const message = await Message.create({
      conversationId,
      senderId: id,
      recipientId,
      messageType,
      content,
      attachments: attachmentValidation.attachments,
      topic,
    });

    const update = {
      lastMessageAt: new Date(),
      topic,
    };

    await Conversation.findByIdAndUpdate(conversationId, update);
    const recipient = await User.findById(recipientId).select("email fullName").lean();
    const emailNotification = recipient?.email
      ? await sendEmail({
          to: recipient.email,
          subject: "New message on House of GLAME",
          htmlContent: `<p>Hello ${recipient.fullName || "there"},</p><p>You have a new message in your House of GLAME conversation.</p><p>Please sign in to reply.</p>`,
        })
      : { success: false, error: "Recipient email not found" };

    return res.status(201).json({
      success: true,
      message: "Message sent",
      data: {
        message,
        emailNotification: {
          queued: true,
          recipientId: message.recipientId,
          success: Boolean(emailNotification?.success),
          messageId: emailNotification?.messageId,
          error: emailNotification?.error,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getConversationMessages = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { conversationId } = req.params;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }
    if (!ensureParticipant(conversation, id)) {
      return res.status(403).json({ success: false, message: "You are not a participant in this conversation" });
    }

    const messages = await Message.find({ conversationId }).sort({ createdAt: 1 }).lean();

    return res.status(200).json({
      success: true,
      message: "Messages fetched successfully",
      data: messages,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyConversations = async (req, res, next) => {
  try {
    const { id } = req.user;
    const conversations = await Conversation.find({
      $or: [{ customerId: id }, { designerId: id }],
    })
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .populate("customerId", "fullName image")
      .populate("designerId", "fullName image")
      .populate("vendorId", "businessName")
      .lean();

    return res.status(200).json({
      success: true,
      message: "Conversations fetched successfully",
      data: conversations.map((conversation) => ({
        conversationId: conversation._id,
        threadId: conversation.orderId,
        threadType: conversation.orderType,
        title: conversation.vendorId?.businessName || conversation.designerId?.fullName || conversation.customerId?.fullName || "Conversation",
        participants: {
          customer: conversation.customerId,
          designer: conversation.designerId,
        },
        lastMessageAt: conversation.lastMessageAt,
        status: conversation.status,
        topic: conversation.topic,
      })),
    });
  } catch (error) {
    next(error);
  }
};

export const getFlaggedConversations = async (req, res, next) => {
  try {
    const conversations = await Conversation.find({ status: "flagged" })
      .sort({ updatedAt: -1 })
      .populate("customerId", "fullName email")
      .populate("designerId", "fullName email")
      .lean();

    return res.status(200).json({
      success: true,
      message: "Flagged conversations fetched successfully",
      data: conversations,
    });
  } catch (error) {
    next(error);
  }
};
