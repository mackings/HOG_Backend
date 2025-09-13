import User from '../../user/model/user.model.js';
import InitializedOrder from '../../material/model/InitializedOrder.model.js';
import axios from "axios";
import crypto from "crypto"
import Plan from '../model/plan.model.js';

export const subscriptionPayments = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { plan, amount, billTerm } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Available subscription plans
    const subscriptionPlans = {
      Standard: ["monthly", "yearly", "quarterly"],
      Premium: ["monthly", "yearly", "quarterly"],
      Enterprise: ["monthly", "yearly", "quarterly"],
    };

    // Validate plan
    if (!subscriptionPlans[plan]) {
      return res.status(400).json({ message: "Invalid subscription plan" });
    }

    // Validate billing term
    if (!subscriptionPlans[plan].includes(billTerm)) {
      return res.status(400).json({ message: "Invalid billing term for selected plan" });
    }

    // Subscription duration based on billing term
    const startDate = new Date();
    let endDate = new Date(startDate);

    if (billTerm === "monthly") {
      endDate.setMonth(endDate.getMonth() + 1);
    } else if (billTerm === "quarterly") {
      endDate.setMonth(endDate.getMonth() + 3);
    } else if (billTerm === "yearly") {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    const reference = crypto.randomBytes(5).toString("hex");

    const initializedData = await InitializedOrder.create({
      userId: user._id,
      totalAmount: amount,
      paymentMethod: "Paystack",
      paymentReference: reference,
      subscriptionStartDate: startDate,
      subscriptionEndDate: endDate,
      billTerm,
      plan,
    });

    // Paystack payment initialization
    const paystackUrl = "https://api.paystack.co/transaction/initialize";
    const paystackResponse = await axios.post(
      paystackUrl,
      {
        email: user.email,
        amount: amount * 100, // Paystack requires kobo
        currency: "NGN",
        reference: reference,
        callback_url: `${process.env.FRONTEND_URL}/payment-success`,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_MAIN_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (paystackResponse.status === 200) {
      return res.status(201).json({
        success: true,
        message: "Subscription payment initialized successfully",
        authorizationUrl: paystackResponse.data.data.authorization_url,
        data: initializedData,
      });
    } else {
      await InitializedOrder.findByIdAndDelete(initializedData._id);
      return res.status(400).json({
        success: false,
        message: "Payment initialization failed",
        error: paystackResponse.data.message,
      });
    }
  } catch (error) {
    next(error);
  }
};



export const createSubscriptionPlan = async (req, res, next) => {
  try {
    let { name, amount, duration, description } = req.body;

    if (!name || !amount || !duration || !description) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    name = name.trim();
    description = description.trim();

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }

    const allowedDurations = ["monthly", "quarterly", "yearly"];
    if (!allowedDurations.includes(duration.toLowerCase())) {
      return res.status(400).json({ success: false, message: "Invalid duration" });
    }

    const existingPlan = await Plan.findOne({ name: new RegExp(`^${name}$`, "i"), duration: duration.toLowerCase() });
    if (existingPlan) {
      return res.status(400).json({
        success: false,
        message: "A subscription plan with this name already exists. Please update it instead.",
      });
    }

    const plan = await Plan.create({
      name,
      amount: parsedAmount,
      duration: duration.toLowerCase(),
      description,
    });

    return res.status(201).json({
      success: true,
      message: "Subscription plan created successfully",
      data: plan,
    });
  } catch (error) {
    return next(error);
  }
};

export const getSubscriptionPlans = async (req, res, next) => {
  try {
    const plans = await Plan.find();
    return res.status(200).json({
      success: true,
      message: "Subscription plans retrieved successfully",
      data: plans,
    });
  } catch (error) {
    next(error);
  }
};

export const getSubscriptionPlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const plan = await Plan.findById(id);
    if (!plan) {
      return res.status(404).json({ message: "Subscription plan not found" });
    }
    return res.status(200).json({
      success: true,
      message: "Subscription plan retrieved successfully",
      data: plan,
    });
  } catch (error) {
    next(error);
  }
};



export const updateSubscriptionPlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, amount, duration, description } = req.body;

    // 1️⃣ Validate ID format
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: "Invalid plan ID" });
    }

    // 2️⃣ Build update object only with provided fields
    const updateFields= {};
    if (name) updateFields.name = name.trim();
    if (amount !== undefined) updateFields.amount = Number(amount);
    if (duration !== undefined) updateFields.duration = Number(duration);
    if (description) updateFields.description = description.trim();

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided for update",
      });
    }

    const plan = await Plan.findByIdAndUpdate(id, updateFields, {
      new: true,
      runValidators: true,
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Subscription plan not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Subscription plan updated successfully",
      data: plan,
    });
  } catch (error) {
    return next(error);
  }
};


export const deleteSubscriptionPlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const plan = await Plan.findByIdAndDelete(id);
    if (!plan) {
      return res.status(404).json({ message: "Subscription plan not found" });
    }
  }catch (error) {
    next(error);
  }
};