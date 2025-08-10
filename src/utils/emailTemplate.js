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
  
