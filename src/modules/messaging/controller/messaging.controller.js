import Conversation from "../model/conversation.model.js";
import Message from "../model/message.model.js";
import Vendor from "../../vendor/model/vendor.model.js";
import User from "../../user/model/user.model.js";
import { blockRestrictedContact, validateMessageAttachments } from "../../../utils/contactMask.utils.js";
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

export const createConversation = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { orderType, orderId, customerId, designerId, vendorId, topic } = req.body;

    const customer = customerId || id;
    if (!orderType || !orderId || !designerId) {
      return res.status(400).json({
        success: false,
        message: "orderType, orderId and designerId are required",
      });
    }

    const vendor = vendorId || (await Vendor.findOne({ userId: designerId }).select("_id").lean())?._id;

    const conversation = await Conversation.findOneAndUpdate(
      { orderType, orderId, customerId: customer, designerId },
      { $setOnInsert: { vendorId: vendor, topic: topic || "general" } },
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

    const attachmentValidation = validateMessageAttachments(attachments);
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
      .lean();

    return res.status(200).json({
      success: true,
      message: "Conversations fetched successfully",
      data: conversations,
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
