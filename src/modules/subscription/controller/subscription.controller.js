import User from "../../user/model/user.model.js";
import InitializedOrder from "../../material/model/InitializedOrder.model.js";
import axios from "axios";
import crypto from "crypto";
import mongoose from "mongoose";
import Stripe from "stripe";
import Plan from "../model/plan.model.js";
import Transactions from "../../transaction/model/transaction.model.js";
import { sendSubscriptionEmail } from "../../../utils/emailService.utils.js";
import {
  formatPlanForUser,
  getSubscriptionProvider,
  normalizePlanBenefits,
} from "../services/subscriptionPlan.service.js";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" })
  : null;

const PLAN_NAME_MAP = {
  standard: "Standard",
  premium: "Premium",
  enterprise: "Enterprise",
};
const ALLOWED_DURATIONS = new Set(["monthly", "quarterly", "yearly"]);
const normalizePlanName = (value) => {
  const key = String(value || "").trim().toLowerCase();
  return PLAN_NAME_MAP[key] || null;
};

const normalizeDuration = (value) => String(value || "").trim().toLowerCase();

const calculateSubscriptionDates = (duration) => {
  const startDate = new Date();
  const endDate = new Date(startDate);

  if (duration === "monthly") endDate.setMonth(endDate.getMonth() + 1);
  if (duration === "quarterly") endDate.setMonth(endDate.getMonth() + 3);
  if (duration === "yearly") endDate.setFullYear(endDate.getFullYear() + 1);

  return { startDate, endDate };
};

const fetchUsdNgnRate = async () => {
  const fallbackRate = Number(process.env.DEFAULT_USD_NGN_RATE) || 1500;
  const apiKey = process.env.EXCHANGE_RATE_API_KEY;

  if (!apiKey) return fallbackRate;

  try {
    const apiUrl = `https://v6.exchangerate-api.com/v6/${apiKey}/pair/USD/NGN`;
    const response = await axios.get(apiUrl);
    if (response?.data?.result === "success" && Number(response?.data?.conversion_rate) > 0) {
      return Number(response.data.conversion_rate);
    }
    return fallbackRate;
  } catch {
    return fallbackRate;
  }
};

const resolvePlanForPayment = async ({ planId, plan, billTerm }) => {
  if (planId) {
    if (!mongoose.Types.ObjectId.isValid(planId)) {
      throw new Error("Invalid plan ID");
    }

    const selectedPlan = await Plan.findById(planId);
    if (!selectedPlan) throw new Error("Subscription plan not found");

    if (billTerm && normalizeDuration(billTerm) !== selectedPlan.duration) {
      throw new Error("billing term does not match selected plan duration");
    }
    return selectedPlan;
  }

  const normalizedPlanName = normalizePlanName(plan);
  const normalizedBillTerm = normalizeDuration(billTerm);
  if (!normalizedPlanName || !ALLOWED_DURATIONS.has(normalizedBillTerm)) {
    throw new Error("Provide a valid plan and billing term, or use planId");
  }

  const selectedPlan = await Plan.findOne({
    name: normalizedPlanName,
    duration: normalizedBillTerm,
  });

  if (!selectedPlan) throw new Error("Subscription plan not found");
  return selectedPlan;
};

const finalizeSubscriptionOrder = async (order) => {
  const existingTransaction = await Transactions.findOne({
    paymentReference: order.paymentReference,
  });

  if (existingTransaction) {
    const user = await User.findById(existingTransaction.userId).select(
      "subscriptionPlan subscriptionStartDate subscriptionEndDate billTerm"
    );
    return {
      alreadyProcessed: true,
      transaction: existingTransaction,
      user,
    };
  }

  const transaction = await Transactions.create({
    userId: order.userId,
    cartItems: order.cartItems,
    totalAmount: order.totalAmount,
    paymentMethod: order.paymentMethod,
    paymentReference: order.paymentReference,
    deliveryAddress: order.deliveryAddress,
    paymentStatus: "success",
    subscriptionEndDate: order.subscriptionEndDate,
    subscriptionStartDate: order.subscriptionStartDate,
    plan: order.plan,
    planId: order.planId || null,
    planBenefits: order.planBenefits || [],
    billTerm: order.billTerm,
    paymentCurrency: order.amountPaidUSD > 0 ? "USD" : "NGN",
    orderStatus: order.paymentStatus,
    amountPaid: order.amountPaidUSD > 0 ? order.amountPaidUSD : order.amountPaid,
    vendorId: order.vendorId || null,
    materialId: order.materialId || null,
  });

  const updatedUser = await User.findByIdAndUpdate(
    order.userId,
    {
      $set: {
        subscriptionPlan: String(order.plan || "").toLowerCase(),
        subscriptionStartDate: order.subscriptionStartDate,
        subscriptionEndDate: order.subscriptionEndDate,
        billTerm: order.billTerm,
      },
    },
    { new: true }
  );

  if (updatedUser) {
    await sendSubscriptionEmail(updatedUser, order.totalAmount);
  }

  await InitializedOrder.findByIdAndDelete(order._id);

  return {
    alreadyProcessed: false,
    transaction,
    user: updatedUser,
  };
};

export const subscriptionPayments = async (req, res, next) => {
  let initializedOrder = null;
  try {
    const { id } = req.user;
    const { planId, plan, billTerm } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const selectedPlan = await resolvePlanForPayment({ planId, plan, billTerm });
    const { startDate, endDate } = calculateSubscriptionDates(selectedPlan.duration);
    const reference = crypto.randomBytes(12).toString("hex");
    const baseAmountNGN = Number(selectedPlan.amount);
    const provider = getSubscriptionProvider(user.country);
    const planBenefits = Array.isArray(selectedPlan.benefits) ? selectedPlan.benefits : [];

    if (provider === "paystack") {
      initializedOrder = await InitializedOrder.create({
        userId: user._id,
        totalAmount: baseAmountNGN,
        amountPaid: baseAmountNGN,
        paymentMethod: "Paystack",
        paymentReference: reference,
        subscriptionStartDate: startDate,
        subscriptionEndDate: endDate,
        billTerm: selectedPlan.duration,
        plan: selectedPlan.name,
        planId: selectedPlan._id,
        planBenefits,
        paymentStatus: "subscription",
      });

      const paystackResponse = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        {
          email: user.email,
          amount: Math.round(baseAmountNGN * 100),
          currency: "NGN",
          reference,
          callback_url: `${process.env.FRONTEND_URL}/payment-success`,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_MAIN_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (paystackResponse.status !== 200 || !paystackResponse.data?.data?.authorization_url) {
        throw new Error(paystackResponse?.data?.message || "Paystack initialization failed");
      }

      return res.status(201).json({
        success: true,
        provider: "paystack",
        message: "Subscription payment initialized successfully",
        authorizationUrl: paystackResponse.data.data.authorization_url,
        data: initializedOrder,
        breakdown: {
          plan: selectedPlan.name,
          billTerm: selectedPlan.duration,
          benefits: planBenefits,
          amountNGN: baseAmountNGN,
          currency: "NGN",
        },
      });
    }

    if (!stripe) {
      return res.status(500).json({
        success: false,
        message: "Stripe is not configured for international subscriptions",
      });
    }

    const exchangeRate = await fetchUsdNgnRate();
    const amountUSD = Math.round((baseAmountNGN / exchangeRate) * 100) / 100;
    if (amountUSD <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid subscription amount after conversion",
      });
    }
    const amountInCents = Math.round(amountUSD * 100);
    if (amountInCents < 50) {
      return res.status(400).json({
        success: false,
        message: "International subscription amount must be at least USD 0.50",
      });
    }

    initializedOrder = await InitializedOrder.create({
      userId: user._id,
      totalAmount: baseAmountNGN,
      amountPaid: baseAmountNGN,
      amountPaidUSD: amountUSD,
      exchangeRate,
      paymentMethod: "Stripe",
      paymentReference: reference,
      subscriptionStartDate: startDate,
      subscriptionEndDate: endDate,
      billTerm: selectedPlan.duration,
      plan: selectedPlan.name,
      planId: selectedPlan._id,
      planBenefits,
      paymentStatus: "subscription",
    });

    const successUrl = `${process.env.FRONTEND_URL}/payment-success?reference=${reference}&provider=stripe`;
    const cancelUrl = `${process.env.FRONTEND_URL}/payment-cancelled?reference=${reference}&provider=stripe`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${selectedPlan.name} Plan (${selectedPlan.duration})`,
              description: [selectedPlan.description, ...planBenefits].join(" | ").slice(0, 500),
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        reference,
        paymentType: "subscription",
        plan: selectedPlan.name,
        billTerm: selectedPlan.duration,
        planId: String(selectedPlan._id),
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: user.email,
    });

    initializedOrder.sessionId = session.id;
    await initializedOrder.save();

    return res.status(201).json({
      success: true,
      provider: "stripe",
      message: "Subscription payment initialized successfully",
      checkoutUrl: session.url,
      sessionId: session.id,
      data: initializedOrder,
      breakdown: {
        plan: selectedPlan.name,
        billTerm: selectedPlan.duration,
        benefits: planBenefits,
        amountNGN: baseAmountNGN,
        amountUSD,
        exchangeRate,
        currency: "USD",
      },
    });
  } catch (error) {
    if (initializedOrder?._id) {
      await InitializedOrder.findByIdAndDelete(initializedOrder._id);
    }
    if (
      error.message === "Invalid plan ID" ||
      error.message === "Subscription plan not found" ||
      error.message?.includes("billing term does not match") ||
      error.message?.includes("Provide a valid plan")
    ) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

export const verifySubscriptionPayment = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { paymentReference } = req.params;

    if (!paymentReference) {
      return res.status(400).json({ success: false, message: "paymentReference is required" });
    }

    const order = await InitializedOrder.findOne({ paymentReference });
    if (!order) {
      const existingTransaction = await Transactions.findOne({ paymentReference });
      if (existingTransaction) {
        const requester = await User.findById(id).select("role");
        const isOwner = String(existingTransaction.userId) === String(id);
        const isAdmin = ["admin", "superAdmin"].includes(requester?.role);
        if (!isOwner && !isAdmin) {
          return res.status(403).json({
            success: false,
            message: "You are not authorized to view this subscription payment",
          });
        }
        return res.status(200).json({
          success: true,
          message: "Subscription already activated",
          alreadyProcessed: true,
          data: existingTransaction,
        });
      }
      return res.status(404).json({ success: false, message: "Subscription payment not found" });
    }

    const isOwner = String(order.userId) === String(id);
    const requester = await User.findById(id).select("role");
    const isAdmin = ["admin", "superAdmin"].includes(requester?.role);
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to verify this subscription payment",
      });
    }

    if (!["Standard", "Premium", "Enterprise"].includes(order.plan)) {
      return res.status(400).json({
        success: false,
        message: "This reference is not a subscription payment",
      });
    }

    if (order.paymentMethod === "Paystack") {
      const verifyResponse = await axios.get(
        `https://api.paystack.co/transaction/verify/${paymentReference}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_MAIN_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const paystackData = verifyResponse?.data?.data;
      const paymentSuccessful = verifyResponse?.data?.status && paystackData?.status === "success";

      if (!paymentSuccessful) {
        return res.status(400).json({
          success: false,
          message: "Payment has not been confirmed as successful",
          providerStatus: paystackData?.status || "unknown",
        });
      }

      const expectedAmount = Math.round(Number(order.amountPaid || order.totalAmount) * 100);
      if (
        paystackData?.reference !== paymentReference ||
        String(paystackData?.currency || "").toUpperCase() !== "NGN" ||
        Number(paystackData?.amount) !== expectedAmount
      ) {
        return res.status(400).json({
          success: false,
          message: "Paystack payment details do not match this subscription order",
        });
      }
    }

    if (order.paymentMethod === "Stripe") {
      if (!stripe || !order.sessionId) {
        return res.status(500).json({
          success: false,
          message: "Stripe verification is not available for this subscription",
        });
      }

      const session = await stripe.checkout.sessions.retrieve(order.sessionId);
      const expectedAmount = Math.round(Number(order.amountPaidUSD) * 100);
      if (
        session?.payment_status !== "paid" ||
        session?.id !== order.sessionId ||
        session?.metadata?.reference !== paymentReference ||
        String(session?.currency || "").toLowerCase() !== "usd" ||
        Number(session?.amount_total) !== expectedAmount
      ) {
        return res.status(400).json({
          success: false,
          message: "Stripe payment has not been confirmed for this subscription",
          providerStatus: session?.payment_status || "unknown",
        });
      }
    }

    const finalized = await finalizeSubscriptionOrder(order);
    return res.status(200).json({
      success: true,
      message: finalized.alreadyProcessed
        ? "Subscription already activated"
        : "Subscription activated successfully",
      alreadyProcessed: finalized.alreadyProcessed,
      data: finalized.transaction,
      planBenefits: finalized.transaction?.planBenefits || [],
      user: finalized.user
        ? {
            _id: finalized.user._id,
            subscriptionPlan: finalized.user.subscriptionPlan,
            subscriptionStartDate: finalized.user.subscriptionStartDate,
            subscriptionEndDate: finalized.user.subscriptionEndDate,
            billTerm: finalized.user.billTerm,
          }
        : null,
    });
  } catch (error) {
    next(error);
  }
};

export const createSubscriptionPlan = async (req, res, next) => {
  try {
    let { name, amount, duration, description, benefits } = req.body;

    if (!name || !amount || !duration || !description) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const normalizedPlanName = normalizePlanName(name);
    const normalizedDuration = normalizeDuration(duration);
    description = String(description).trim();

    if (!normalizedPlanName) {
      return res.status(400).json({ success: false, message: "Invalid plan name" });
    }
    if (!ALLOWED_DURATIONS.has(normalizedDuration)) {
      return res.status(400).json({ success: false, message: "Invalid duration" });
    }

    const parsedAmount = Number(amount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }

    let normalizedBenefits;
    try {
      normalizedBenefits = normalizePlanBenefits(benefits, { required: true });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    const existingPlan = await Plan.findOne({
      name: normalizedPlanName,
      duration: normalizedDuration,
    });
    if (existingPlan) {
      return res.status(400).json({
        success: false,
        message: "A subscription plan with this name and duration already exists. Please update it instead.",
      });
    }

    const createdPlan = await Plan.create({
      name: normalizedPlanName,
      amount: parsedAmount,
      duration: normalizedDuration,
      description,
      benefits: normalizedBenefits,
    });

    return res.status(201).json({
      success: true,
      message: "Subscription plan created successfully",
      data: createdPlan,
    });
  } catch (error) {
    next(error);
  }
};

export const getSubscriptionPlans = async (req, res, next) => {
  try {
    const plans = await Plan.find().sort({ name: 1, duration: 1 });
    const provider = getSubscriptionProvider(req.user?.country);
    const exchangeRate = provider === "stripe" ? await fetchUsdNgnRate() : null;
    const data = plans.map((plan) => formatPlanForUser({ plan, provider, exchangeRate }));

    return res.status(200).json({
      success: true,
      message: "Subscription plans retrieved successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getSubscriptionPlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid plan ID" });
    }

    const plan = await Plan.findById(id);
    if (!plan) {
      return res.status(404).json({ success: false, message: "Subscription plan not found" });
    }

    const base = plan.toObject ? plan.toObject() : plan;
    const provider = getSubscriptionProvider(req.user?.country);
    const exchangeRate = provider === "stripe" ? await fetchUsdNgnRate() : null;
    const data = formatPlanForUser({ plan: base, provider, exchangeRate });

    return res.status(200).json({
      success: true,
      message: "Subscription plan retrieved successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const updateSubscriptionPlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, amount, duration, description, benefits } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid plan ID" });
    }

    const currentPlan = await Plan.findById(id);
    if (!currentPlan) {
      return res.status(404).json({
        success: false,
        message: "Subscription plan not found",
      });
    }

    const updateFields = {};
    if (name !== undefined) {
      const normalizedPlanName = normalizePlanName(name);
      if (!normalizedPlanName) {
        return res.status(400).json({ success: false, message: "Invalid plan name" });
      }
      updateFields.name = normalizedPlanName;
    }
    if (amount !== undefined) {
      const parsedAmount = Number(amount);
      if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ success: false, message: "Invalid amount" });
      }
      updateFields.amount = parsedAmount;
    }
    if (duration !== undefined) {
      const normalizedDuration = normalizeDuration(duration);
      if (!ALLOWED_DURATIONS.has(normalizedDuration)) {
        return res.status(400).json({ success: false, message: "Invalid duration" });
      }
      updateFields.duration = normalizedDuration;
    }
    if (description !== undefined) {
      const normalizedDescription = String(description).trim();
      if (!normalizedDescription) {
        return res.status(400).json({ success: false, message: "Description cannot be empty" });
      }
      updateFields.description = normalizedDescription;
    }
    if (benefits !== undefined) {
      try {
        updateFields.benefits = normalizePlanBenefits(benefits, { required: true });
      } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
      }
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided for update",
      });
    }

    const candidateName = updateFields.name || currentPlan.name;
    const candidateDuration = updateFields.duration || currentPlan.duration;
    const duplicate = await Plan.findOne({
      _id: { $ne: id },
      name: candidateName,
      duration: candidateDuration,
    });
    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: "Another subscription plan with the same name and duration already exists",
      });
    }

    const updatedPlan = await Plan.findByIdAndUpdate(id, updateFields, {
      new: true,
      runValidators: true,
    });

    return res.status(200).json({
      success: true,
      message: "Subscription plan updated successfully",
      data: updatedPlan,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteSubscriptionPlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid plan ID" });
    }

    const deletedPlan = await Plan.findByIdAndDelete(id);
    if (!deletedPlan) {
      return res.status(404).json({ success: false, message: "Subscription plan not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Subscription plan deleted successfully",
      data: { id },
    });
  } catch (error) {
    next(error);
  }
};
