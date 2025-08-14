export const sendVerifyTokenEmailTemplate = ({ fullName, token }) => {
  const firstName = fullName?.split(" ")[0] || "there";

  return `
    <p>Hello ${firstName},</p>
    <p>Thank you for registering with us. Please verify your email address by entering the following token:</p>
    <p> Your OTP: <strong>${token}</strong></p>
    <p>This token is valid for <strong>15 minutes</strong> only.</p>
    <p>If you didn't request this verification, please ignore this email.</p><br><br>

    <p>Best regards,</p><br>
    <p>The HOG Team</p>
  `;
};


export const sendResetPasswordEmailTemplate = ({ fullName, token, email }) => {
    const firstName = fullName?.split(" ")[0] || "there";
    return `
    <p>Hello ${firstName},</p>
    <p>You have requested to reset your password. Please enter the following token to reset your password:</p>
    <p> Your OTP: <strong>${token}</strong></p>
    <p>This token is valid for <strong>15 minutes</strong> only.</p>
    <p>If you didn't request this password reset, please ignore this email.</p>
    <p> This message is sent from <strong>HOG</strong> is intended for <strong>${email}</strong></p>
    <br><br>


    <p>Best regards,</p><br>
    <p>The HOG Team</p>
  `;
  };


export const sendBankTransferEmailTemplate = (transaction, email) => {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <title>Bank Transfer Confirmation</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        background-color: #f7f7f7;
        margin: 0;
        padding: 0;
      }
      .container {
        max-width: 600px;
        background: #ffffff;
        margin: 40px auto;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }
      .header {
        background: #004aad;
        color: #ffffff;
        padding: 20px;
        text-align: center;
      }
      .content {
        padding: 20px;
        color: #333333;
        line-height: 1.5;
      }
      .details {
        margin-top: 20px;
        border-top: 1px solid #eeeeee;
        padding-top: 10px;
      }
      .details p {
        margin: 6px 0;
      }
      .footer {
        background: #f1f1f1;
        color: #555555;
        font-size: 13px;
        text-align: center;
        padding: 15px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h2>Bank Transfer Successful</h2>
      </div>
      <div class="content">
        <p>Hello ${transaction.accountName},</p>
        <p>We’re writing to let you know that your bank transfer request has been processed successfully.</p>
        
        <div class="details">
          <p><strong>Transaction Reference:</strong> ${transaction.reference}</p>
          <p><strong>Amount:</strong> ₦${Number(transaction.amount).toLocaleString()}</p>
          <p><strong>Bank Name:</strong> ${transaction.bankName}</p>
          <p><strong>Account Number:</strong> ${transaction.accountNumber}</p>
          <p><strong>Account Name:</strong> ${transaction.accountName}</p>
          <p><strong>Reason:</strong> ${transaction.reason || "Not provided"}</p>
          <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
        </div>

        <p>If you did not initiate this transfer, please contact our support team immediately.</p>
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} Your Company Name. All rights reserved.</p>
      </div>
    </div>
  </body>
  </html>
  `;
};
