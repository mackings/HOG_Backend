import User from "../model/user.model.js";
import Token from "../model/token.model.js";
import Vendor from "../../vendor/model/vendor.model.js"
import { sendVerifyTokenEmail, sendResetPasswordEmail } from "../../../utils/emailService.utils.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto"
import axios from "axios";
import { TRIAL_DAYS, TRIAL_PLAN, PLAN_COMMISSION_RATES } from "../../subscription/services/subscriptionPlan.service.js";

export const normalizePublicUserRole = (role) => {
  const value = String(role || "").trim().toLowerCase();
  if (value === "user" || value === "buyer") return "user";
  if (value === "tailor" || value === "vendor") return "tailor";
  return null;
};

const logAuthResponse = (label, status, payload) => {
  try {
    console.log(`[AUTH] ${label} -> ${status}`, payload);
  } catch (error) {
    console.log(`[AUTH] ${label} -> ${status}`);
  }
};


export const register = async (req, res, next) => {
    try {
        const { fullName, email, password, phoneNumber, role, address, country } = req.body;
        if (!fullName || !email || !password || !phoneNumber || !role || !address || !country) {
            const payload = { message: "Your full name, email, password, phone number, role, address and country are required" };
            logAuthResponse("register", 400, payload);
            return res.status(400).json(payload);
        }
        const normalizedRole = normalizePublicUserRole(role);
        if (!normalizedRole) {
            const payload = {
              message: "Public registration only supports user or tailor roles",
            };
            logAuthResponse("register", 403, payload);
            return res.status(403).json(payload);
        }
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            const payload = { message: "User already exists, please login or use forgot password" };
            logAuthResponse("register", 409, payload);
            return res.status(409).json(payload);
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = crypto.randomInt(1000, 9999);
        const token = await Token.create({
           fullName, 
           email, 
           password: hashedPassword, 
           phoneNumber, 
           token: otp,
           role: normalizedRole,
           country,
           address,
           expiresAt: new Date(Date.now() + 15 * 60 * 1000)
          });

        await sendVerifyTokenEmail(token);
        const payload = { message: "Email Verification Token Sent" };
        logAuthResponse("register", 201, payload);
        return res.status(201).json(payload);
    } catch (error) {
        console.error("[AUTH] register error", error);
        next(error);
    }
};


export const verifyToken = async (req, res, next) => {
  try {
    const token = (req.body?.token ?? req.query?.token ?? "").toString().trim();

    if (!token) {
      const payload = { message: "Token is required" };
      logAuthResponse("verifyToken", 400, payload);
      return res.status(400).json(payload);
    }

    const existingToken = await Token.findOne({ token });
    if (!existingToken) {
      const payload = { message: "Invalid or expired token" };
      logAuthResponse("verifyToken", 400, payload);
      return res.status(400).json(payload);
    }

    const { fullName, email, password, phoneNumber, role, address, country } = existingToken;
    const normalizedRole = normalizePublicUserRole(role);
    if (!normalizedRole) {
      const payload = { message: "This role must be created through an administrator invitation" };
      logAuthResponse("verifyToken", 403, payload);
      return res.status(403).json(payload);
    }

    const alreadyExists = await User.findOne({ email });
    if (alreadyExists) {
      const payload = { message: "User with this email already exists" };
      logAuthResponse("verifyToken", 409, payload);
      return res.status(409).json(payload);
    }

    const isTailor = normalizedRole === "tailor";
    const trialEndsAt = isTailor
      ? new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
      : null;
    const trialCommissionRate = PLAN_COMMISSION_RATES[TRIAL_PLAN] ?? 12;

    const newUser = await User.create({
      fullName,
      email,
      password,
      isVerified: true,
      phoneNumber,
      role: normalizedRole,
      address,
      country,
      subscriptionPlan: "starter",
      activeCommissionRate: isTailor ? trialCommissionRate : 15,
      isOnTrial: isTailor,
      trialEndsAt,
      trialPlan: isTailor ? TRIAL_PLAN : null,
    });

    const nameParts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] || "User";
    const lastName = nameParts.slice(1).join(" ") || "User";

    const paystackCustomerParams = {
        email: email,
        first_name: firstName,
        last_name: lastName,
        phone: phoneNumber
      };
  
    const customerResponse = await axios.post('https://api.paystack.co/customer', paystackCustomerParams, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_MAIN_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    const customer = customerResponse.data.data;

    const paystackSecret = process.env.PAYSTACK_MAIN_KEY || "";
    const isTestKey = paystackSecret.startsWith("sk_test");
    const paystackWalletParams = {
      customer: customer.id,
      preferred_bank: isTestKey ? "test-bank" : "wema-bank",
    };
    const walletResponse = await axios.post('https://api.paystack.co/dedicated_account', paystackWalletParams, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_MAIN_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    const walletData = walletResponse.data.data;

    await User.findByIdAndUpdate(newUser._id, 
      { 
        accountNumber: walletData.account_number, 
        accountName: walletData.account_name,
        bankName: "Wema Bank"
      },
      {
        new: true
      }
    );

    await Token.deleteOne({ token });

    newUser.password = undefined;

    const payload = {
      message: "Email verified successfully",
      user: newUser,
    };
    logAuthResponse("verifyToken", 200, { message: payload.message, userId: newUser?._id });
    return res.status(200).json(payload);

  } catch (error) {
      console.error("[AUTH] verifyToken error", error);
      next(error)
  }
};



export const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            const payload = { message: "User not found" };
            logAuthResponse("login", 404, payload);
            return res.status(404).json(payload);
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            const payload = { message: "Invalid credentials" };
            logAuthResponse("login", 401, payload);
            return res.status(401).json(payload);
        }
        if (!user.isVerified) {
            const payload = { message: "Please verify your email" };
            logAuthResponse("login", 401, payload);
            return res.status(401).json(payload);
        }
        if (user.isBlocked) {
            const payload = { message: "Your have been blocked, kindly contact admin" };
            logAuthResponse("login", 401, payload);
            return res.status(401).json(payload);
        }
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "24h" });
        const userWithoutPassword = { ...user.toObject() };
        delete userWithoutPassword.password;
        const payload = { message: "Login successful", token, user: userWithoutPassword };
        if (user.mustChangePassword) {
          payload.passwordChangeRequired = true;
          payload.message = "Login successful. You must change your temporary password.";
        }
        logAuthResponse("login", 200, { message: payload.message, userId: user?._id });
        return res.status(200).json(payload);
    } catch (error) {
        console.error("[AUTH] login error", error);
        next(error);
    }
};



export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      const payload = { message: "User not found" };
      logAuthResponse("forgotPassword", 404, payload);
      return res.status(404).json(payload);
    }

    const token = crypto.randomInt(1000, 9999);;

    const newToken = await Token.create({
        fullName: user.fullName,
        password: user.password,
        email: user.email,
        token,
        address: user.address,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000)
    });

    await sendResetPasswordEmail(newToken);

    const payload = { message: "Password reset token sent to your email" };
    logAuthResponse("forgotPassword", 200, payload);
    return res.status(200).json(payload);
  } catch (error) {
    console.error("[AUTH] forgotPassword error", error);
    next(error);
  }
};


export const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    const resetToken = await Token.findOne({ token });
    if (!resetToken) {
      const payload = { message: "Invalid or expired token" };
      logAuthResponse("resetPassword", 400, payload);
      return res.status(400).json(payload);
    }
    const user = await User.findOne({ email: resetToken.email });
    if (!user) {
        const payload = { message: "User not found" };
        logAuthResponse("resetPassword", 404, payload);
        return res.status(404).json(payload);
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await User.findByIdAndUpdate(
      { _id: user._id },
      { password: hashedPassword, mustChangePassword: false }
    );
    const payload = { message: "Password reset successful" };
    logAuthResponse("resetPassword", 200, payload);
    return res.status(200).json(payload);
    } catch (error) {
    console.error("[AUTH] resetPassword error", error);
    next(error); 
  }
};

export const changeTemporaryPassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body || {};

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        message: "Current password, new password, and password confirmation are required",
      });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "New password and confirmation do not match" });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ message: "New password must be at least 8 characters" });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({
        message: "New password must be different from the temporary password",
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const currentPasswordIsValid = await bcrypt.compare(currentPassword, user.password);
    if (!currentPasswordIsValid) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.mustChangePassword = false;
    await user.save();

    return res.status(200).json({
      message: "Password changed successfully",
      passwordChangeRequired: false,
    });
  } catch (error) {
    next(error);
  }
};


export const updateProfile = async (req, res, next) => {
  try {
    const { fullName, password, phoneNumber, address, country } = req.body;
    const { id } = req.user;

    if (!fullName) {
      return res.status(400).json({ message: "Full name is required" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      user.password = hashedPassword;
    }
    user.fullName = fullName;
    user.phoneNumber = phoneNumber;
    user.address = address;
    user.country = country;

    const nameParts = fullName.trim().split(" ");
    const first_name = nameParts[0];
    const last_name = nameParts.slice(1).join(" ") || "-"; // fallback if no last name

    await user.save();

    const { password: _, ...userWithoutPassword } = user.toObject();

    return res.status(200).json({
      message: "Profile updated successfully",
      user: userWithoutPassword,
    });
  } catch (error) {
    next(error);
  }
};



export const getProfile = async (req, res, next) => {
    try {
        const id = req.user;
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const userWithoutPassword = { ...user.toObject() };
        delete userWithoutPassword.password;
        return res.status(200).json({ user: userWithoutPassword });
    } catch (error) {
        next(error);
    }
};


export const uploadImage = async (req, res, next) => {
    try {
        const id = req.user;
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
         const images = req.imageUrls[0];

         const uploadImage = await User.findByIdAndUpdate(
           id,
           { image: images },
           { new: true }
         );
        return res.status(200).json({ message: "Profile image updated successfully", image: uploadImage.image });
    } catch (error) {
        next(error);
    }
}


export const uploadBillImage = async (req, res, next) => {
    try {
        const id = req.user;
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
         const images = req.imageUrls[0];

         const uploadImage = await User.findByIdAndUpdate(
           id,
           { billImage: images },
           { new: true }
         );
        return res.status(200).json({ message: "Bill image updated successfully", billImage: uploadImage.billImage });
    } catch (error) {
        next(error);
    }
}



export const getAllusers = async (req, res, next) => {
    try {
        const users = await User.find();
        return res.status(200).json({ users });
    } catch (error) {
      next(error);
    }
}





export const getAllTailor = async (req, res, next) => {
  try {
    const tailor = await Vendor.find()
      .sort({ createdAt: -1 })
      .populate("userId", "fullName email image");

    if (!tailor || tailor.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "No tailor found" 
      });
    }    

    return res.status(200).json({ 
      success: true, 
      message: "Tailors found", 
      data: tailor 
    });
  } catch (error) {
    next(error);
  }
};


export const getUserCurrency = async (req, res, next) => {
  try {
    const { id } = req.user;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    
    const countryCurrencyMapping = {
      nigeria: "NGN",
      "united kingdom": "GBP",
      "united states": "USD",
    };

    const userCountry = user.country?.toLowerCase().trim();

    const userCurrency = countryCurrencyMapping[userCountry] || "NGN";
    
    return res.status(200).json({
      success: true,
      message: "User currency fetched successfully",
      data: userCurrency,
    });
  } catch (error) {
    next(error);
  }
};



export const getUserWalletBalance = async (req, res, next) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const user = await User.findById(userId).select("wallet");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User wallet balance fetched successfully",
      data: {
        wallet: user.wallet,
      },
    });
  } catch (error) {
    next(error);
  }
};
