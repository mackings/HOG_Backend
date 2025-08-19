
import nodemailer from "nodemailer";
// const { SendMailClient } = require("zeptomail");
const { sendVerifyTokenEmailTemplate, sendResetPasswordEmailTemplate, sendBankTransferEmailTemplate, sendTransactionEmailTemplate
  
 } = require("../utils/emailTemplate");
// const url = "api.zeptomail.com/";
// const token = process.env.ZEPTO_TOKEN;
// const client = new SendMailClient({ url, token });

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



export const sendEmail = async ({ to, subject, htmlContent, attachments = [] }) => {
  try {
    if (!to) throw new Error("Recipient email address is required");
    if (!subject) throw new Error("Email subject is required");
    if (!htmlContent) throw new Error("Email content is required");

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: true, // Use TLS
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    // Prepare message
    const message = {
      from: "no-reply@hog.com",  //process.env.FROM_EMAIL || process.env.SMTP_EMAIL,
      to,
      subject,
    //   text: htmlContent.replace(/<[^>]+>/g, ""), // Strip HTML tags for text version
      html: htmlContent,
      attachments: Array.isArray(attachments) ? attachments : [],
    };

    // Send email
    const info = await transporter.sendMail(message);

    console.log(`✅ Email sent: ${info.messageId} to ${to}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Email sending failed:", error.message);
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

        
