import User from "../model/user.model";
import Token from "../model/token.model";
import { sendVerifyTokenEmail, sendResetPasswordEmail } from "../../../utils/emailService.utils";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto"
import axios from "axios";


const QUIDAX_SECRET_KEY=process.env.QUIDAX_SECRET_KEY;
const QUIDAX_API_KEY = process.env.QUIDAX_API_KEY;
const BASE_URL = "https://app.quidax.io/api/v1/users"; 


export const register = async (req, res, next) => {
    try {
        const { fullName, email, password } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: "User already exists, please login or use forgot password" });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = crypto.randomInt(100000, 999999);
        const token = await Token.create({ fullName, email, password: hashedPassword, token: otp });

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

    const { fullName, email, password } = existingToken;

    const alreadyExists = await User.findOne({ email });
    if (alreadyExists) {
      return res.status(409).json({ message: "User with this email already exists" });
    }

    const response = await axios.post(
      `${BASE_URL}`,
      { 
        email: email, 
        first_name: fullName.split(" ")[0], 
        last_name: fullName.split(" ")[1]
      },
      {
        headers: {
          "Authorization": `Bearer ${QUIDAX_SECRET_KEY}`,
          "accept": "application/json",
          "Content-Type": "application/json",
        },
      }
    );
    const data = response.data.data;   

    const newUser = await User.create({
      fullName,
      email,
      password,
      isVerified: true,
      quidaxId: data.id,
    });


    await Token.deleteOne({ token });

    newUser.password = undefined;

    return res.status(200).json({
      message: "Email verified successfully",
      user: newUser,
    });

  } catch (error) {
    const errorMessage =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
      next({ message: errorMessage })
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
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
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

    const token = crypto.randomInt(100000, 999999);;

    const newToken = await Token.create({
        fullName: user.fullName,
        password: user.password,
        email: user.email,
        token
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
    const { fullName, password } = req.body;
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

    const nameParts = fullName.trim().split(" ");
    const first_name = nameParts[0];
    const last_name = nameParts.slice(1).join(" ") || "-"; // fallback if no last name

    // Sync with Quidax
    const response = await axios.put(
      `https://app.quidax.io/api/v1/users/${user.quidaxId}`,
      { first_name, last_name },
      {
        headers: {
          Authorization: `Bearer ${QUIDAX_SECRET_KEY}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );

    await user.save();

    const { password: _, ...userWithoutPassword } = user.toObject();

    return res.status(200).json({
      message: "Profile updated successfully",
      user: userWithoutPassword,
    });
  } catch (error) {
    const status = error.response?.status || 500;
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message;

    return res.status(status).json({ success: false, message });
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
        if (req.file) {
            user.image = req.imageUrl;
        }
        await user.save();
        return res.status(200).json({ message: "Profile image updated successfully" });
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
        if (req.file) {
            user.billImage = req.imageUrl;
        }
        await user.save();
        return res.status(200).json({ message: "Bill image updated successfully" });
    } catch (error) {
        next(error);
    }
}



export const uploadNINImage = async (req, res, next) => {
    try {
        const id = req.user;
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        if (req.file) {
            user.ninImage = req.imageUrl;
        }
        await user.save();
        return res.status(200).json({ message: "NIN image updated successfully" });
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


  export const moveDollarToNairaWallet = async (req, res, next) => {
  try {
    const { amount } = req.body;
    const { id } = req.user;

    // Validate amount
    if (!amount || typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.dollarWallet < amount) {
      return res.status(400).json({ message: "Insufficient funds in your dollar wallet" });
    }

    const response = await axios.get(`https://api.exchangerate-api.com/v4/latest/USD`);
    const usdRate = response?.data?.rates?.["NGN"];

    if (!usdRate) {
      return res.status(500).json({ message: "Unable to fetch exchange rate for NGN" });
    }

    // Convert amount with proper rounding
    const convertedAmount = Math.round(amount * usdRate * 100) / 100;

    // Update wallet in a single DB operation
    const updatedWallet = await User.findByIdAndUpdate(
      user._id,
      { 
        $inc: { 
          dollarWallet: -amount, 
          nairaWallet: convertedAmount 
        } 
      },
      { new: true }
    ).select("-password");

    if (!updatedWallet) {
      return res.status(400).json({ message: "Wallet update failed" });
    }

    return res.status(200).json({
      message: "Funds moved from dollar to naira wallet successfully",
      exchangeRate: usdRate,
      convertedAmount,
      wallet: updatedWallet
    });
  } catch (error) {
    next(error);
  }
};

    
