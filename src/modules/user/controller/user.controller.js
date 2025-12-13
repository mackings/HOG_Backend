import User from "../model/user.model";
import Token from "../model/token.model";
import Vendor from "../../vendor/model/vendor.model"
import { sendVerifyTokenEmail, sendResetPasswordEmail } from "../../../utils/emailService.utils";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto"
import axios from "axios";



export const register = async (req, res, next) => {
    try {
        const { fullName, email, password, phoneNumber, role, address, country } = req.body;
        if (!fullName || !email || !password || !phoneNumber || !role || !address || !country) {
            return res.status(400).json({ message: "Your full name, email, password, phone number, role, address and country are required" });
        }
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: "User already exists, please login or use forgot password" });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = crypto.randomInt(1000, 9999);
        const token = await Token.create({
           fullName, 
           email, 
           password: hashedPassword, 
           phoneNumber, 
           token: otp,
           role,
           country,
           address,
           expiresAt: new Date(Date.now() + 15 * 60 * 1000)
          });

        await sendVerifyTokenEmail(token);
        return res.status(201).json({ message: "Email Verification Token Sent" });
    } catch (error) {
        next(error);
    }
};


export const verifyToken = async (req, res, next) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ message: "Token is required" });
    }

    const existingToken = await Token.findOne({ token });
    if (!existingToken) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    const { fullName, email, password, phoneNumber, role, address, country } = existingToken;

    const alreadyExists = await User.findOne({ email });
    if (alreadyExists) {
      return res.status(409).json({ message: "User with this email already exists" });
    }

    const newUser = await User.create({
      fullName,
      email,
      password,
      isVerified: true,
      phoneNumber,
      role,
      address,
      country,
    });

    const paystackCustomerParams = {
        email: email,
        first_name: fullName.split(' ')[0],
        last_name: fullName.split(' ')[1] || '',
        phone: phoneNumber
      };
  
    const customerResponse = await axios.post('https://api.paystack.co/customer', paystackCustomerParams, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_MAIN_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    const customer = customerResponse.data.data;

    const paystackWalletParams = {
      customer: customer.id,
      preferred_bank: "wema-bank",
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

    return res.status(200).json({
      message: "Email verified successfully",
      user: newUser,
    });

  } catch (error) {
      next(error)
  }
};



export const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
        if (!user.isVerified) {
            return res.status(401).json({ message: "Please verify your email" });
        }
        if (user.isBlocked) {
            return res.status(401).json({ message: "Your have been blocked, kindly contact admin" });
        }
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "24h" });
        const userWithoutPassword = { ...user.toObject() };
        delete userWithoutPassword.password;
        return res.status(200).json({ message: "Login successful", token, user: userWithoutPassword });
    } catch (error) {
        next(error);
    }
};



export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
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

    return res.status(200).json({ message: "Password reset token sent to your email" });
  } catch (error) {
    next(error);
  }
};


export const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    const resetToken = await Token.findOne({ token });
    if (!resetToken) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }
    const user = await User.findOne({ email: resetToken.email });
    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await User.findByIdAndUpdate({ _id: user._id }, { password: hashedPassword });
    return res.status(200).json({ message: "Password reset successful" });
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
