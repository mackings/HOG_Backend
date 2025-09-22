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
        <p>© ${new Date().getFullYear()} House of GLAME. All rights reserved.</p>
      </div>
    </div>
  </body>
  </html>
  `;
};


export const sendTransactionEmailTemplate = (user, transaction, material) => {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <title>Transaction Successful</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        background-color: #f7f7f7;
        margin: 0;
        padding: 0;
      }
      .container {
        max-width: 600px;
        margin: 20px auto;
        background: #ffffff;
        border-radius: 8px;
        padding: 20px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.1);
      }
      h2 {
        color: #4CAF50;
        text-align: center;
      }
      .details {
        margin: 20px 0;
      }
      .details table {
        width: 100%;
        border-collapse: collapse;
      }
      .details th, .details td {
        text-align: left;
        padding: 8px;
        border-bottom: 1px solid #ddd;
      }
      .details th {
        background-color: #f2f2f2;
      }
      .footer {
        margin-top: 30px;
        text-align: center;
        font-size: 14px;
        color: #666;
      }
      .highlight {
        color: #333;
        font-weight: bold;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h2>✅ Payment Successful</h2>
      <p>Dear Customer,</p>
      <p>We’re happy to let you know that your payment was successful. Here are your order details:</p>

      <div class="details">
        <table>
          <tr>
            <th>Transaction Reference</th>
            <td class="highlight">${transaction.paymentReference}</td>
          </tr>
          <tr>
            <th>Amount Paid</th>
            <td class="highlight">₦${transaction.amountPaid.toLocaleString()}</td>
          </tr>
          <tr>
            <th>Payment Method</th>
            <td>${transaction.paymentMethod}</td>
          </tr>
          <tr>
            <th>Delivery Address</th>
            <td>${user.address}</td>
          </tr>
          <tr>
            <th>Order Status</th>
            <td>${transaction.orderStatus}</td>
          </tr>
        </table>
      </div>

      <h3>🛒 Material Ordered</h3>
      <div class="details">
        <table>
          <tr>
            <th>Name (Attire Type)</th>
            <td>${material?.attireType || "N/A"}</td>
          </tr>
          <tr>
            <th>cloth Material</th>
            <td>${material?.clothMaterial || "N/A"}</td>
          </tr>
          <tr>
            <th>Colour</th>
            <td>${material?.color || "N/A"}</td>
          </tr>
          <tr>
            <th>Brand Name</th>
            <td>${material?.brand || "N/A"}</td>
          </tr>
          <tr>
            <th>Measurement</th>
            <td>${material?.measurement?.join(", ") || "N/A"}</td>
          </tr>
          <tr>
            <th>Price</th>
            <td>₦${material?.price?.toLocaleString() || "N/A"}</td>
          </tr>
          <tr>
            <th>Sample Image</th>
            <td><img src="${material?.sampleImage[0]}" alt="Sample Image" style="max-width: 100%; height: auto;"></td>
          </tr> 
          <tr>
            <th>Total Amount Paid</th>
            <td>₦${transaction.totalAmount.toLocaleString()}</td>
          </tr>
          <tr>
            <th>Payment Status</th>
            <td>${transaction.paymentStatus}</td>
          </tr>
          <tr>
            <th>Date</th>
            <td>${new Date().toLocaleString()}</td>
          </tr>
        </table>
      </div>

      <p class="footer">Thank you for shopping with us! <br/> If you have any questions, please contact our support team.</p>
    </div>
  </body>
  </html>
  `;
};


export const sendSubscriptionEmailTemplate = (user, amount) => {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <title>Subscription Successful</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        background-color: #f7f7f7;
        margin: 0;
        padding: 0;
      }
      .container {
        max-width: 600px;
        margin: 30px auto;
        background: #ffffff;
        border-radius: 10px;
        box-shadow: 0 4px 10px rgba(0,0,0,0.1);
        overflow: hidden;
      }
      .header {
        background: #4CAF50;
        color: #ffffff;
        padding: 20px;
        text-align: center;
      }
      .content {
        padding: 20px;
        color: #333333;
        line-height: 1.6;
      }
      .details {
        background: #f1f1f1;
        padding: 15px;
        border-radius: 8px;
        margin: 20px 0;
      }
      .details p {
        margin: 5px 0;
      }
      .footer {
        text-align: center;
        padding: 15px;
        background: #f9f9f9;
        color: #666666;
        font-size: 12px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h2>Subscription Successful 🎉</h2>
      </div>
      <div class="content">
        <p>Hi <strong>${user.fullName || "User"}</strong>,</p>
        <p>Thank you for subscribing to our <strong>${user.subscriptionPlan}</strong> plan. Your subscription has been successfully activated.</p>
        
        <div class="details">
          <p><strong>Plan:</strong> ${user.subscriptionPlan}</p>
          <p><strong>Billing Term:</strong> ${user.billTerm}</p>
          <p><strong>Amount Paid:</strong> ₦${amount.toLocaleString()}</p>
          <p><strong>Start Date:</strong> ${(user.subscriptionStartDate).toDateString()}</p>
          <p><strong>End Date:</strong> ${(user.subscriptionEndDate).toDateString()}</p>
        </div>

        <p>You now have full access to all features included in your plan. We’re excited to have you onboard 🚀.</p>
        <p>If you have any questions, feel free to reach out to our support team anytime.</p>
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} Houese Of Glame. All rights reserved.</p>
      </div>
    </div>
  </body>
  </html>
  `;
};

export const sendReviewUpdateEmailTemplate = (review) => {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <title>Review Update</title>
    <style>
      body {
        font-family: Arial, Helvetica, sans-serif;
        background-color: #f7f7f7;
        margin: 0;
        padding: 0;
      }
      .container {
        max-width: 600px;
        margin: 30px auto;
        background: #ffffff;
        border-radius: 10px;
        box-shadow: 0 4px 10px rgba(0,0,0,0.1);
        overflow: hidden;
      }
      .header {
        background: #004aad;
        color: #ffffff;
        padding: 20px;
        text-align: center;
        font-size: 20px;
      }
      .content {
        padding: 20px;
        color: #333333;
        line-height: 1.6;
        font-size: 15px;
      }
      .details {
        background: #f1f1f1;
        padding: 15px;
        border-radius: 8px;
        margin: 20px 0;
      }
      .details p {
        margin: 5px 0;
      }
      .footer {
        text-align: center;
        padding: 15px;
        font-size: 12px;
        color: #777;
        border-top: 1px solid #ddd;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        Review Update Notification
      </div>
      <div class="content">
        <p>Hello ${review?.userId?.fullName || "User"},</p>
        <p>Your review has been updated. Here are the details:</p>
        
        <div class="details">
          <p><strong>Status:</strong> ${review?.status || "N/A"}</p>
          <p><strong>Material:</strong> ${review?.materialId?.attireType || "N/A"}</p>
          <p><strong>Vendor:</strong> ${review?.vendorId?.businessName || "N/A"}</p>
          <p><strong>Material Total Cost:</strong> ${review?.materialTotalCost || "N/A"}</p>
          <p><strong>Workmanship Total Cost:</strong> ${review?.workmanshipTotalCost || "N/A"}</p>
          <p><strong>Total Cost:</strong> ${review?.totalCost || "N/A"}</p>
          <p><strong>Status:</strong> ${review?.status || "N/A"}</p>
          <p><strong>Delivery Date:</strong> ${review?.deliveryDate || "N/A"}</p>
          <p><strong>Comment:</strong> ${review?.comment || "N/A"}</p>
          <p><strong>Updated At:</strong> ${new Date(review?.updatedAt).toLocaleString()}</p>
        </div>
        
        <p>If you did not request this change, please contact our support team immediately.</p>
      </div>
      <div class="footer">
        &copy; ${new Date().getFullYear()} House of Glame. All rights reserved.
      </div>
    </div>
  </body>
  </html>
  `;
};



export const sendTransactionListingEmailTemplate = (user, email, transaction) => {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <title>Transaction Successful</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        background-color: #f7f7f7;
        margin: 0;
        padding: 0;
      }
      .container {
        max-width: 600px;
        margin: 20px auto;
        background: #ffffff;
        border-radius: 8px;
        padding: 20px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.1);
      }
      h2 {
        color: #4CAF50;
        text-align: center;
      }
      .details {
        margin: 20px 0;
      }
      .details table {
        width: 100%;
        border-collapse: collapse;
      }
      .details th, .details td {
        text-align: left;
        padding: 8px;
        border-bottom: 1px solid #ddd;
      }
      .details th {
        background-color: #f2f2f2;
      }
      .footer {
        margin-top: 30px;
        text-align: center;
        font-size: 14px;
        color: #666;
      }
      .highlight {
        color: #333;
        font-weight: bold;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h2>✅ Payment Successful</h2>
      <p>Dear Customer,</p>
      <p>We’re happy to let you know that your payment was successful. Here are your order details:</p>

      <div class="details">
        <table>
          <tr>
            <th>Transaction Reference</th>
            <td class="highlight">${transaction.paymentReference}</td>
          </tr>
          <tr>
            <th>Amount Paid</th>
            <td class="highlight">₦${transaction.amountPaid.toLocaleString()}</td>
          </tr>
          <tr>
            <th>Payment Method</th>
            <td>${transaction.paymentMethod}</td>
          </tr>
          <tr>
            <th>Delivery Address</th>
            <td>${user.address}</td>
          </tr>
          <tr>
            <th>Order Status</th>
            <td>${transaction.orderStatus}</td>
          </tr>
        </table>
      </div>

      <h3>🛒 Material Ordered</h3>
      <div class="details">
        <table>  
          <tr>
            <th>Name (Attire Type)</th>
            <td>${transaction?.cartItems?.title || "N/A"}</td>
          </tr>
          <tr>
            <th>cloth Size</th>
            <td>${transaction?.cartItems?.size || "N/A"}</td>
          </tr>
          <tr>
            <th>Condition</th>
            <td>${transaction?.cartItems?.condition || "N/A"}</td>
          </tr>
          <tr>
            <th>Description</th>
            <td>${transaction?.cartItems?.description || "N/A"}</td>
          </tr>
          // <tr>
          //   <th>Measurement</th>
          //   <td>${material?.measurement?.join(", ") || "N/A"}</td>
          // </tr>
          <tr>
            <th>Price</th>
            <td>₦${transaction?.cartItems?.amount?.toLocaleString() || "N/A"}</td>
          </tr>
          <tr>
            <th>Sample Image</th>
            <td><img src="${transaction?.cartItems?.images[0]}" alt="Sample Image" style="max-width: 100%; height: auto;"></td>
          </tr> 
          <tr>
            <th>Total Amount Paid</th>
            <td>₦${transaction.totalAmount.toLocaleString()}</td>
          </tr>
          <tr>
            <th>Payment Status</th>
            <td>${transaction.paymentStatus}</td>
          </tr>
          <tr>
            <th>Date</th>
            <td>${new Date().toLocaleString()}</td>
          </tr>
        </table>
      </div>

      <p class="footer">Thank you for shopping with us! <br/> If you have any questions, please contact our support team.</p>
    </div>
  </body>
  </html>
  `;
};


export const sendApprovalEmailTemplate = (name, title) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          background-color: #f4f4f4;
          padding: 20px;
          color: #333;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: #fff;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.1);
        }
        .header {
          background: #4CAF50;
          color: white;
          text-align: center;
          padding: 12px;
          border-radius: 8px 8px 0 0;
        }
        .content {
          padding: 20px;
          font-size: 16px;
        }
        .button {
          display: inline-block;
          background: #4CAF50;
          color: white;
          padding: 10px 18px;
          text-decoration: none;
          border-radius: 6px;
          margin-top: 15px;
        }
        .footer {
          text-align: center;
          font-size: 13px;
          color: #777;
          margin-top: 25px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>Approval Notification</h2>
        </div>
        <div class="content">
          <p>Hi <b>${name}</b>,</p>
          <p>We’re excited to inform you that your <b>${title}</b> has been approved 🎉</p>
          <p>You can now log in to your account to access more details.</p>
          <a href="${process.env.FRONTEND_URL}/login" class="button">Go to Dashboard</a>
        </div>
        <div class="footer">
          <p>If you did not request this, please ignore this email.</p>
          <p>&copy; ${new Date().getFullYear()} House of Glame. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};


export const sendRejectionEmailTemplate = (name, title, reasons) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          background-color: #f4f4f4;
          padding: 20px;
          color: #333;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: #fff;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.1);
        }
        .header {
          background: #4CAF50;
          color: white;
          text-align: center;
          padding: 12px;
          border-radius: 8px 8px 0 0;
        }
        .content {
          padding: 20px;
          font-size: 16px;
        }
        .button {
          display: inline-block;
          background: #4CAF50;
          color: white;
          padding: 10px 18px;
          text-decoration: none;
          border-radius: 6px;
          margin-top: 15px;
        }
        .footer {
          text-align: center;
          font-size: 13px;
          color: #777;
          margin-top: 25px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>Listing Rejection Notification</h2>
        </div>
        <div class="content">
          <p>Hi <b>${name}</b>,</p>
          <p>We’re very sorry to inform you that your <b>${title}</b> has been rejected 🎉</p>
          <p>Reason: ${reasons}</p>
          <p>You can now log in to your account to access more details.</p>
          <a href="${process.env.FRONTEND_URL}/login" class="button">Go to Dashboard</a>
        </div>
        <div class="footer">
          <p>If you did not request this, please ignore this email.</p>
          <p>&copy; ${new Date().getFullYear()} House of Glame. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};



export const sendDeliveryEmailTemplate = (vendorName, fee, netAmount, trackingNumber) => {
  return `
    <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
      <h2 style="color: #4CAF50;">Delivery Confirmation</h2>
      <p>Dear <strong>${vendorName.fullName}</strong>,</p>
      <p>We are pleased to inform you that your order has been successfully delivered.</p>

      <h3>Transaction Summary</h3>
      <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">Tracking Number:</td>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>${trackingNumber}</strong></td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">Platform Fee:</td>
          <td style="padding: 8px; border: 1px solid #ddd;">$${fee.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">Amount Credited to Wallet:</td>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>$${netAmount.toFixed(2)}</strong></td>
        </tr>
      </table>

      <p>The credited amount has been successfully added to your wallet.</p>

      <p>If you have any questions, feel free to contact our support team.</p>

      <p style="margin-top: 20px;">Best regards,<br/>
      <strong>HOG Team</strong></p>
    </div>
  `;
};

