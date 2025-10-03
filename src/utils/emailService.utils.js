import sgMail from '@sendgrid/mail';
import nodemailer from "nodemailer";
import Mailgun from "mailgun.js";
import formData from "form-data";
// const { SendMailClient } = require("zeptomail");
const { sendVerifyTokenEmailTemplate, sendResetPasswordEmailTemplate, sendBankTransferEmailTemplate, 
  sendTransactionEmailTemplate, sendSubscriptionEmailTemplate, sendReviewUpdateEmailTemplate, 
  sendTransactionListingEmailTemplate, sendApprovalEmailTemplate, sendRejectionEmailTemplate, sendDeliveryEmailTemplate
  
 } = require("../utils/emailTemplate");
// const url = "api.zeptomail.com/";
// const token = process.env.ZEPTO_TOKEN;
// const client = new SendMailClient({ url, token });

sgMail.setApiKey(process.env.SENDGRID_API_KEY);



// const sendEmail = async ({ to, subject, htmlContent }) => {
//     try {
//         const response = await client.sendMail({
//             from: {
//                 address: "reva@usecentry.com",
//                 name: "Reva Team"
//             },
//             to: [
//                 {
//                     email_address: {
//                         address: to,
//                         name: to.split('@')[0]
//                     }
//                 }
//             ],
//             subject,
//             htmlbody: htmlContent,
//         });
//         return response;
//     } catch (error) {
//         console.error('Zeptomail error:', error);
//         throw new Error('Failed to send email');
//     }
// };



// export const sendEmail = async ({ to, subject, htmlContent, attachments = [] }) => {
//   const mailgun = new Mailgun(formData);

//   const mg = mailgun.client({
//     username: "api",
//     key: process.env.MAILGUN_API_KEY,
//     // Uncomment if using EU domain:
//     // url: "https://api.eu.mailgun.net"
//   });

//   try {
//     const data = await mg.messages.create(process.env.MAILGUN_SANDBOX_DOMAIN, {
//       from: process.env.MAILGUN_FROM_EMAIL,
//       to: [to],
//       subject,
//       html: htmlContent, 
//       attachment: attachments, 
//     });

//     console.log("✅ Email sent:", data);
//     return data;
//   } catch (error) {
//     console.error("❌ Email failed:", error.message);
//     throw error;
//   }
// };


export const sendEmail = async ({
  to,
  from = "ebisco4ui@yopmail.com",
  subject,
  htmlContent,
  attachments = [],
}) => {
  const msg = {
    to,
    from,
    subject,
    html: htmlContent,
    attachments,
  };

  try {
    const [response] = await sgMail.send(msg);
    // console.log({
    //   success: true,
    //   statusCode: response.statusCode,
    // });
  } catch (error) {
    console.error("SendGrid Error:", error.message);
    throw error;
  }
};

// export const sendEmail = async ({ to, subject, htmlContent, attachments = [] }) => {
//   try {
//     if (!to) throw new Error("Recipient email address is required");
//     if (!subject) throw new Error("Email subject is required");
//     if (!htmlContent) throw new Error("Email content is required");

//     // Create transporter
//     const transporter = nodemailer.createTransport({
//       host: process.env.SMTP_HOST,
//       port: Number(process.env.SMTP_PORT),
//       secure: true, // Use TLS
//       auth: {
//         user: process.env.SMTP_EMAIL,
//         pass: process.env.SMTP_PASSWORD,
//       },
//       tls: {
//         rejectUnauthorized: false,
//       },
//     });

//     // Prepare message
//     const message = {
//       from: "no-reply@hog.com",  //process.env.FROM_EMAIL || process.env.SMTP_EMAIL,
//       to,
//       subject,
//     //   text: htmlContent.replace(/<[^>]+>/g, ""), // Strip HTML tags for text version
//       html: htmlContent,
//       attachments: Array.isArray(attachments) ? attachments : [],
//     };

//     // Send email
//     const info = await transporter.sendMail(message);

//     console.log(`✅ Email sent: ${info.messageId} to ${to}`);
//     return { success: true, messageId: info.messageId };
//   } catch (error) {
//     console.error("❌ Email sending failed:", error.message);
//     return { success: false, error: error.message };
//   }
// };


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