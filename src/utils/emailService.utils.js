import { Resend } from "resend";
import {
  sendVerifyTokenEmailTemplate,
  sendResetPasswordEmailTemplate,
  sendBankTransferEmailTemplate,
  sendTransactionEmailTemplate,
  sendSubscriptionEmailTemplate,
  sendReviewUpdateEmailTemplate,
  sendTransactionListingEmailTemplate,
  sendApprovalEmailTemplate,
  sendRejectionEmailTemplate,
  sendDeliveryEmailTemplate,
  sendDeliveryStartedEmailTemplate,
  sendOfferDecisionEmailTemplate,
  sendOfferCreatedEmailTemplate,
  sendAdminInvitationEmailTemplate,
  sendPayoutNotificationEmailTemplate,
  sendPaymentReceivedEmailTemplate,
} from "../utils/emailTemplate.js";

if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY environment variable is not set");
const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_ADDRESS =
  process.env.RESEND_FROM_EMAIL || "House of GLAME <onboarding@resend.dev>";

const normalizeRecipients = (to) => {
  if (Array.isArray(to)) return to.filter(Boolean);
  if (typeof to === "string" && to.trim()) return [to.trim()];
  return [];
};

export const sendEmail = async ({ to, subject, htmlContent }) => {
  try {
    if (!to) throw new Error("Recipient email address is required");
    if (!subject) throw new Error("Email subject is required");
    if (!htmlContent) throw new Error("Email content is required");

    const recipients = normalizeRecipients(to);
    if (recipients.length === 0) throw new Error("No valid recipient email addresses");

    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: recipients,
      subject,
      html: htmlContent,
    });

    if (error) {
      console.error("❌ Resend error:", error.message || error);
      return { success: false, error: error.message || String(error) };
    }

    console.log(`✅ Email sent via Resend to ${recipients.join(", ")} — id: ${data?.id}`);
    return { success: true, messageId: data?.id };
  } catch (err) {
    console.error("❌ Email sending failed:", err.message);
    return { success: false, error: err.message };
  }
};

// ── Auth ─────────────────────────────────────────────────────────────────────

export const sendVerifyTokenEmail = (account) =>
  sendEmail({
    to: account.email,
    subject: "Welcome to HOG - Verify Your Email",
    htmlContent: sendVerifyTokenEmailTemplate(account),
  });

export const sendResetPasswordEmail = (account) =>
  sendEmail({
    to: account.email,
    subject: "Reset Your Password",
    htmlContent: sendResetPasswordEmailTemplate(account),
  });

// ── Admin invitation ──────────────────────────────────────────────────────────

const INVITE_ROLE_LABELS = {
  superAdmin: "Super Admin",
  admin: "Admin",
  finance: "Finance",
  customerService: "Customer Service",
  listingManager: "Listing Manager",
};

export const buildAdminInvitationEmailPayload = (invitation) => ({
  to: invitation.email,
  subject: `You have been invited as ${INVITE_ROLE_LABELS[invitation.role] || "Team Member"} on HOG`,
  htmlContent: sendAdminInvitationEmailTemplate(invitation),
});

export const sendAdminInvitationEmail = (invitation) =>
  sendEmail(buildAdminInvitationEmailPayload(invitation));

// ── Transactions ─────────────────────────────────────────────────────────────

export const sendBankTransferEmail = (transaction, email) =>
  sendEmail({
    to: email,
    subject: "Bank Transfer",
    htmlContent: sendBankTransferEmailTemplate(transaction),
  });

export const sendTransactionEmail = (user, vendor, transaction, material) =>
  sendEmail({
    to: [user.email, vendor],
    subject: "Transaction Successful",
    htmlContent: sendTransactionEmailTemplate(user, transaction, material),
  });

export const sendTransactionListingEmail = (vendor, email, transaction) =>
  sendEmail({
    to: [vendor?.email, email],
    subject: `Payment for ${transaction.cartItems?.[0]?.title}`,
    htmlContent: sendTransactionListingEmailTemplate(vendor, transaction),
  });

// ── Subscription ──────────────────────────────────────────────────────────────

export const sendSubscriptionEmail = (user, amount) =>
  sendEmail({
    to: user.email,
    subject: "Subscription Successful",
    htmlContent: sendSubscriptionEmailTemplate(user, amount),
  });

// ── Listings moderation ───────────────────────────────────────────────────────

export const sendApprovalEmail = (email, name, title) =>
  sendEmail({
    to: email,
    subject: "Your listing has been approved",
    htmlContent: sendApprovalEmailTemplate(name, title),
  });

export const sendRejectionEmail = (email, name, title, reasons) =>
  sendEmail({
    to: email,
    subject: "Your listing has been rejected",
    htmlContent: sendRejectionEmailTemplate(name, title, reasons),
  });

// ── Reviews ───────────────────────────────────────────────────────────────────

export const sendReviewUpdateEmail = (review) =>
  sendEmail({
    to: [review.userId.email, review.vendorId.businessEmail],
    subject: "Review Update",
    htmlContent: sendReviewUpdateEmailTemplate(review),
  });

// ── Delivery ──────────────────────────────────────────────────────────────────

export const sendDeliveryEmail = (listingOwner, fee, netAmount, trackingNumber) =>
  sendEmail({
    to: listingOwner.email,
    subject: "Your order has been delivered - Wallet Credited",
    htmlContent: sendDeliveryEmailTemplate(listingOwner, fee, netAmount, trackingNumber),
  });

export const buildDeliveryStartedEmailPayload = ({ user, vendorUser, vendorProfile, material, tracking }) => ({
  to: user?.email,
  subject: "Your attire is now in delivery",
  htmlContent: sendDeliveryStartedEmailTemplate({
    recipientName: user?.fullName,
    trackingNumber: tracking?.trackingNumber,
    material,
    vendorName: vendorUser?.fullName,
    vendorBusinessName: vendorProfile?.businessName,
    createdAt: tracking?.createdAt,
  }),
});

export const sendDeliveryStartedEmail = (payload) =>
  sendEmail(buildDeliveryStartedEmailPayload(payload));

// ── Offers ────────────────────────────────────────────────────────────────────

export const buildOfferDecisionEmailPayload = ({
  recipientEmail,
  recipientName,
  actorName,
  actorRoleLabel,
  action,
  material,
  amountNGN,
  amountUSD = 0,
  comment,
  mutualConsentAchieved = false,
}) => ({
  to: recipientEmail,
  subject: `Offer ${String(action || "").toLowerCase() === "accepted" ? "accepted" : "rejected"} for your attire order`,
  htmlContent: sendOfferDecisionEmailTemplate({
    recipientName,
    actorName,
    actorRoleLabel,
    action,
    material,
    amountNGN,
    amountUSD,
    comment,
    mutualConsentAchieved,
  }),
});

export const sendOfferDecisionEmail = (payload) =>
  sendEmail(buildOfferDecisionEmailPayload(payload));

export const buildOfferCreatedEmailPayload = ({
  recipientEmail,
  recipientName,
  buyerName,
  material,
  amountNGN,
  amountUSD = 0,
  comment,
}) => ({
  to: recipientEmail,
  subject: "You have a new offer to review",
  htmlContent: sendOfferCreatedEmailTemplate({
    recipientName,
    buyerName,
    material,
    amountNGN,
    amountUSD,
    comment,
  }),
});

export const sendOfferCreatedEmail = (payload) =>
  sendEmail(buildOfferCreatedEmailPayload(payload));

// ── Payouts ───────────────────────────────────────────────────────────────────

export const sendPayoutNotificationEmail = (vendor, vendorUser, amount, reference) =>
  sendEmail({
    to: vendorUser.email,
    subject: "💰 Payment Received - Wallet Credited",
    htmlContent: sendPayoutNotificationEmailTemplate(vendor, amount, reference),
  });

export const sendPaymentReceivedEmail = (user, amount, vendor, reference) =>
  sendEmail({
    to: user.email,
    subject: "✅ Payment Successful - Order Confirmed",
    htmlContent: sendPaymentReceivedEmailTemplate(user, amount, vendor, reference),
  });
