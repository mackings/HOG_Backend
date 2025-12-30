import nodemailer from "nodemailer";
import { sendVerifyTokenEmailTemplate, sendResetPasswordEmailTemplate, sendBankTransferEmailTemplate,
  sendTransactionEmailTemplate, sendSubscriptionEmailTemplate, sendReviewUpdateEmailTemplate,
  sendTransactionListingEmailTemplate, sendApprovalEmailTemplate, sendRejectionEmailTemplate, sendDeliveryEmailTemplate,
  sendPayoutNotificationEmailTemplate, sendPaymentReceivedEmailTemplate
 } from "../utils/emailTemplate.js";

// Create Gmail transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false, // Use STARTTLS
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

export const sendEmail = async ({ to, subject, htmlContent, attachments = [] }) => {
  try {
    if (!to) throw new Error("Recipient email address is required");
    if (!subject) throw new Error("Email subject is required");
    if (!htmlContent) throw new Error("Email content is required");

    // Check if SMTP is configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn("⚠️ SMTP not configured. Email not sent:", { to, subject });
      return { success: false, error: "SMTP credentials not configured" };
    }

    const transporter = createTransporter();

    // Prepare message
    const message = {
      from: `"${process.env.SMTP_FROM || 'Hulex'}" <${process.env.SMTP_USER}>`,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      html: htmlContent,
      attachments: Array.isArray(attachments) ? attachments : [],
    };

    // Send email
    const info = await transporter.sendMail(message);

    console.log(`✅ Email sent: ${info.messageId} to ${to}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Email sending failed:", error.message);
    // Don't throw - just log and return error
    return { success: false, error: error.message };
  }
};


// Email templates

export const sendVerifyTokenEmail = async (account) => {
    return sendEmail({
        to: account.email,
        subject: "Welcome to HOG - Verify Your Email",
        htmlContent: sendVerifyTokenEmailTemplate(account)
    });
};


export const sendResetPasswordEmail = async (account) => {
    return sendEmail({
        to: account.email,
        subject: "Reset Your Password",
        htmlContent: sendResetPasswordEmailTemplate(account)
    });
};


export const sendBankTransferEmail = async (transaction, email) => {
    return sendEmail({
        to: email,
        subject: "Bank Transfer",
        htmlContent: sendBankTransferEmailTemplate(transaction)
    });
};


export const sendTransactionEmail = async (user, vendor, transaction, material) => {
  return sendEmail({
    to: [user.email, vendor],
    subject: "Transaction Successful",
    htmlContent: sendTransactionEmailTemplate(user, transaction, material),
  });
};


export const sendSubscriptionEmail = async(user, amount)=>{
  return sendEmail({
    to: user.email,
    subject: "Subscription Successful",
    htmlContent: sendSubscriptionEmailTemplate(user, amount),
  });

}


export const sendReviewUpdateEmail = async (review) => {
  return sendEmail({
    to: [ review.userId.email, review.vendorId.businessEmail ],
    subject: "Review Update",
    htmlContent: sendReviewUpdateEmailTemplate(review),
  });
};


export const sendTransactionListingEmail = async (vendor, email, transaction) => {
  return sendEmail({
    to: [ "vendor.email", email ],
    subject: `Payment for ${transaction.cartItems?.[0]?.title}`,
    htmlContent: sendTransactionListingEmailTemplate(vendor, transaction),
  });
};


export const sendApprovalEmail = async (email, name, title) => {
  return sendEmail({
    to: email,
    subject: "Your listing has been approved",
    htmlContent: sendApprovalEmailTemplate(name, title),
  });
};


export const sendRejectionEmail = async (email, name, title, reasons) => {
  return sendEmail({
    to: email,
    subject: "Your listing has been rejected",
    htmlContent: sendRejectionEmailTemplate(name, title, reasons),
  });
};


export const sendDeliveryEmail = async (listingOwner, fee, netAmount, trackingNumber) => {
  return sendEmail({
    to: listingOwner.email,
    subject: "Your order has been delivered-Wallet Credited",
    htmlContent: sendDeliveryEmailTemplate(listingOwner, fee, netAmount, trackingNumber),
  });
};


export const sendPayoutNotificationEmail = async (vendor, vendorUser, amount, reference) => {
  return sendEmail({
    to: vendorUser.email,
    subject: "💰 Payment Received - Wallet Credited",
    htmlContent: sendPayoutNotificationEmailTemplate(vendor, amount, reference),
  });
};


export const sendPaymentReceivedEmail = async (user, amount, vendor, reference) => {
  return sendEmail({
    to: user.email,
    subject: "✅ Payment Successful - Order Confirmed",
    htmlContent: sendPaymentReceivedEmailTemplate(user, amount, vendor, reference),
  });
};
