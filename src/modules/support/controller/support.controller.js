import SupportConversation from "../model/supportConversation.model.js";
import SupportMessage from "../model/supportMessage.model.js";
import User from "../../user/model/user.model.js";
import { blockRestrictedContact, validateMessageAttachments } from "../../../utils/contactMask.utils.js";
import { rejectPastedMediaUrls, uploadedMessageAttachments } from "../../../utils/deviceUpload.utils.js";
import { sendEmail } from "../../../utils/emailService.utils.js";

const ADMIN_ROLES = ["admin", "superAdmin"];
const REQUESTER_ROLES = ["user", "tailor"];

const rolesFor = (user) => (Array.isArray(user?.role) ? user.role : [user?.role].filter(Boolean));
const isAdminUser = (user) => rolesFor(user).some((role) => ADMIN_ROLES.includes(role));
const isRequesterUser = (user) => rolesFor(user).some((role) => REQUESTER_ROLES.includes(role));

const firstAdminId = async () => {
  const admin = await User.findOne({ role: { $in: ADMIN_ROLES } }).sort({ createdAt: 1 }).select("_id").lean();
  return admin?._id;
};

const canAccessConversation = (conversation, user) => {
  if (isAdminUser(user)) return true;
  return String(conversation.requesterId?._id || conversation.requesterId) === String(user._id);
};

const recipientFor = async (conversation, sender) => {
  if (isAdminUser(sender)) return conversation.requesterId?._id || conversation.requesterId;
  return conversation.adminId || await firstAdminId();
};

const sendSupportEmail = async ({ recipientId, senderName }) => {
  const recipient = recipientId ? await User.findById(recipientId).select("email fullName").lean() : null;
  if (!recipient?.email) return { success: false, error: "Recipient email not found" };

  return sendEmail({
    to: recipient.email,
    subject: "New support message on House of GLAME",
    htmlContent: `<p>Hello ${recipient.fullName || "there"},</p><p>${senderName || "Support"} sent a new support message on House of GLAME.</p><p>Please sign in to reply.</p>`,
  });
};

export const createSupportConversation = async (req, res, next) => {
  try {
    const { subject, category = "other", content = "" } = req.body;
    if (!isRequesterUser(req.user) && !isAdminUser(req.user)) {
      return res.status(403).json({ success: false, message: "Only users, designers, and admins can use support chat" });
    }
    if (!subject) {
      return res.status(400).json({ success: false, message: "subject is required" });
    }

    const adminId = isAdminUser(req.user) ? req.user._id : await firstAdminId();
    const conversation = await SupportConversation.create({
      requesterId: req.user._id,
      adminId,
      subject,
      category,
      status: isAdminUser(req.user) ? "awaiting_user" : "awaiting_admin",
      lastMessageAt: content ? new Date() : undefined,
    });

    if (content) {
      await SupportMessage.create({
        conversationId: conversation._id,
        senderId: req.user._id,
        recipientId: adminId,
        content,
        messageType: "text",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Support conversation created successfully",
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
};

export const getSupportConversations = async (req, res, next) => {
  try {
    const query = isAdminUser(req.user) ? {} : { requesterId: req.user._id };
    const conversations = await SupportConversation.find(query)
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .populate("requesterId", "fullName email role image")
      .populate("adminId", "fullName email role image")
      .lean();

    return res.status(200).json({
      success: true,
      message: "Support conversations fetched successfully",
      data: conversations,
    });
  } catch (error) {
    next(error);
  }
};

export const sendSupportMessage = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { content = "", attachments = [] } = req.body;

    const conversation = await SupportConversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Support conversation not found" });
    }
    if (!canAccessConversation(conversation, req.user)) {
      return res.status(403).json({ success: false, message: "You cannot access this support conversation" });
    }
    if (conversation.restrictedUntil && conversation.restrictedUntil > new Date()) {
      return res.status(403).json({
        success: false,
        message: "Support chat is temporarily restricted because of repeated contact sharing attempts",
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
        message: "Upload support attachments from the device instead of submitting attachment URLs.",
      });
    }
    const attachmentValidation = validateMessageAttachments(uploadedAttachments);
    if (!attachmentValidation.valid) {
      return res.status(400).json({ success: false, message: attachmentValidation.message });
    }

    const recipientId = await recipientFor(conversation, req.user);
    const restricted = blockRestrictedContact(content);
    if (!restricted.allowed) {
      const update = {
        status: "flagged",
        lastMessageAt: new Date(),
        $inc: { flaggedCount: 1 },
      };
      if ((conversation.flaggedCount || 0) + 1 >= 3) {
        update.restrictedUntil = new Date(Date.now() + 60 * 60 * 1000);
      }
      await SupportConversation.findByIdAndUpdate(conversationId, update);
      await SupportMessage.create({
        conversationId,
        senderId: req.user._id,
        recipientId,
        content: "",
        originalContent: content,
        messageType: "text",
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

    const message = await SupportMessage.create({
      conversationId,
      senderId: req.user._id,
      recipientId,
      messageType,
      content,
      attachments: attachmentValidation.attachments,
    });

    const status = isAdminUser(req.user) ? "awaiting_user" : "awaiting_admin";
    await SupportConversation.findByIdAndUpdate(conversationId, {
      adminId: isAdminUser(req.user) ? req.user._id : conversation.adminId || recipientId,
      status,
      lastMessageAt: new Date(),
    });

    const emailNotification = await sendSupportEmail({
      recipientId,
      senderName: req.user.fullName,
    });

    return res.status(201).json({
      success: true,
      message: "Support message sent",
      data: {
        message,
        emailNotification: {
          queued: true,
          recipientId,
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

export const getSupportMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const conversation = await SupportConversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Support conversation not found" });
    }
    if (!canAccessConversation(conversation, req.user)) {
      return res.status(403).json({ success: false, message: "You cannot access this support conversation" });
    }

    const messages = await SupportMessage.find({ conversationId })
      .sort({ createdAt: 1 })
      .populate("senderId", "fullName email role image")
      .populate("recipientId", "fullName email role image")
      .lean();

    return res.status(200).json({
      success: true,
      message: "Support messages fetched successfully",
      data: messages,
    });
  } catch (error) {
    next(error);
  }
};
