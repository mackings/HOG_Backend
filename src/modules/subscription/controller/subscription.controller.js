import User from "../../user/model/user.model.js";
import InitializedOrder from "../../material/model/InitializedOrder.model.js";
import Listing from "../../seller/model/seller.model.js";
import Vendor from "../../vendor/model/vendor.model.js";
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
  isUKCountry,
  normalizePlanBenefits,
  PLAN_COMMISSION_RATES,
  TRIAL_DAYS,
  TRIAL_PLAN,
  getEffectivePlan,
  getListingLimit,
  getPreLoveLimit,
} from "../services/subscriptionPlan.service.js";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" })
  : null;

const PLAN_NAME_MAP = {
  starter: "Starter",
  standard: "Standard",
  premium: "Premium",
  elite: "Elite",
  enterprise: "Enterprise",
};

const ELITE_PLANS = new Set(["elite", "enterprise"]);

// Keeps isVerifiedDesigner in sync with the user's active plan tier
const syncVerifiedBadge = async (userId, planKey) => {
  const isElitePlus = ELITE_PLANS.has(planKey);
  await Vendor.findOneAndUpdate(
    { userId },
    isElitePlus
      ? { $set: { isVerifiedDesigner: true, verifiedAt: new Date() } }
      : { $set: { isVerifiedDesigner: false } }
  );
};
const PAID_PLANS = new Set(["Starter", "Standard", "Premium", "Elite", "Enterprise"]);
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
    const response = await axios.get(
      `https://v6.exchangerate-api.com/v6/${apiKey}/pair/USD/NGN`
    );
    if (response?.data?.result === "success" && Number(response?.data?.conversion_rate) > 0) {
      return Number(response.data.conversion_rate);
    }
    return fallbackRate;
  } catch {
    return fallbackRate;
  }
};

const fetchGbpNgnRate = async () => {
  const fallbackRate = Number(process.env.DEFAULT_GBP_NGN_RATE) || 2000;
  const apiKey = process.env.EXCHANGE_RATE_API_KEY;
  if (!apiKey) return fallbackRate;
  try {
    const response = await axios.get(
      `https://v6.exchangerate-api.com/v6/${apiKey}/pair/GBP/NGN`
    );
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
    if (!mongoose.Types.ObjectId.isValid(planId)) throw new Error("Invalid plan ID");
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
      "subscriptionPlan subscriptionStartDate subscriptionEndDate billTerm activeCommissionRate"
    );
    return { alreadyProcessed: true, transaction: existingTransaction, user };
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
    paymentCurrency: order.amountPaidUSD > 0 ? "USD" : (order.amountPaidGBP > 0 ? "GBP" : "NGN"),
    orderStatus: order.paymentStatus,
    amountPaid: order.amountPaidUSD > 0
      ? order.amountPaidUSD
      : order.amountPaidGBP > 0
        ? order.amountPaidGBP
        : order.amountPaid,
    vendorId: order.vendorId || null,
    materialId: order.materialId || null,
  });

  const planKey = String(order.plan || "").toLowerCase();
  const newCommissionRate = PLAN_COMMISSION_RATES[planKey] ?? 15;

  const updatedUser = await User.findByIdAndUpdate(
    order.userId,
    {
      $set: {
        subscriptionPlan: planKey,
        subscriptionStartDate: order.subscriptionStartDate,
        subscriptionEndDate: order.subscriptionEndDate,
        billTerm: order.billTerm,
        activeCommissionRate: newCommissionRate,
        isOnTrial: false,
        trialEndsAt: null,
        "scheduledDowngrade.plan": null,
        "scheduledDowngrade.effectiveDate": null,
      },
    },
    { new: true }
  );

  if (updatedUser) {
    await syncVerifiedBadge(updatedUser._id, planKey);
    await sendSubscriptionEmail(updatedUser, order.totalAmount);
  }

  await InitializedOrder.findByIdAndDelete(order._id);

  return { alreadyProcessed: false, transaction, user: updatedUser };
};

// ─── Payment ─────────────────────────────────────────────────────────────────

export const subscriptionPayments = async (req, res, next) => {
  let initializedOrder = null;
  try {
    const { id } = req.user;
    const { planId, plan, billTerm } = req.body;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const selectedPlan = await resolvePlanForPayment({ planId, plan, billTerm });

    if (selectedPlan.isFree || Number(selectedPlan.amount) === 0) {
      return res.status(400).json({
        success: false,
        message: `The ${selectedPlan.name} plan is free and does not require payment`,
      });
    }

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
          commissionRate: selectedPlan.commissionRate,
          listingLimit: selectedPlan.listingLimit,
        },
      });
    }

    if (!stripe) {
      return res.status(500).json({
        success: false,
        message: "Stripe is not configured for international subscriptions",
      });
    }

    // UK users: charge in GBP if gbpAmount is set
    const ukUser = isUKCountry(user.country);
    if (ukUser && selectedPlan.gbpAmount > 0) {
      const amountInPence = Math.round(selectedPlan.gbpAmount * 100);

      initializedOrder = await InitializedOrder.create({
        userId: user._id,
        totalAmount: baseAmountNGN,
        amountPaid: baseAmountNGN,
        amountPaidGBP: selectedPlan.gbpAmount,
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
        line_items: [{
          price_data: {
            currency: "gbp",
            product_data: {
              name: `${selectedPlan.name} Plan (${selectedPlan.duration})`,
              description: [selectedPlan.description, ...planBenefits].join(" | ").slice(0, 500),
            },
            unit_amount: amountInPence,
          },
          quantity: 1,
        }],
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
          amountGBP: selectedPlan.gbpAmount,
          currency: "GBP",
          commissionRate: selectedPlan.commissionRate,
          listingLimit: selectedPlan.listingLimit,
        },
      });
    }

    // All other international users: convert NGN → USD
    const exchangeRate = await fetchUsdNgnRate();
    const amountUSD = Math.round((baseAmountNGN / exchangeRate) * 100) / 100;
    if (amountUSD <= 0) {
      return res.status(400).json({ success: false, message: "Invalid subscription amount after conversion" });
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
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: `${selectedPlan.name} Plan (${selectedPlan.duration})`,
            description: [selectedPlan.description, ...planBenefits].join(" | ").slice(0, 500),
          },
          unit_amount: amountInCents,
        },
        quantity: 1,
      }],
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
        commissionRate: selectedPlan.commissionRate,
        listingLimit: selectedPlan.listingLimit,
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

// ─── Verify Payment ───────────────────────────────────────────────────────────

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

    if (!PAID_PLANS.has(order.plan)) {
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
      const isGBP = order.amountPaidGBP > 0;
      const isUSD = order.amountPaidUSD > 0;
      const expectedAmount = isGBP
        ? Math.round(Number(order.amountPaidGBP) * 100)
        : Math.round(Number(order.amountPaidUSD) * 100);
      const expectedCurrency = isGBP ? "gbp" : "usd";

      if (
        session?.payment_status !== "paid" ||
        session?.id !== order.sessionId ||
        session?.metadata?.reference !== paymentReference ||
        String(session?.currency || "").toLowerCase() !== expectedCurrency ||
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
      message: finalized.alreadyProcessed ? "Subscription already activated" : "Subscription activated successfully",
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
            activeCommissionRate: finalized.user.activeCommissionRate,
          }
        : null,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Trial ────────────────────────────────────────────────────────────────────

export const activateTrial = async (req, res, next) => {
  try {
    const { id } = req.user;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (user.role !== "tailor") {
      return res.status(403).json({
        success: false,
        message: "Only designers can activate a trial",
      });
    }

    if (user.isOnTrial) {
      const trialEnd = user.trialEndsAt ? new Date(user.trialEndsAt) : null;
      if (trialEnd && trialEnd > new Date()) {
        return res.status(409).json({
          success: false,
          message: "You already have an active trial",
          trialEndsAt: user.trialEndsAt,
        });
      }
    }

    if (user.subscriptionPlan && !["starter", "free"].includes(user.subscriptionPlan)) {
      return res.status(409).json({
        success: false,
        message: "Trial is only available before subscribing to a paid plan",
      });
    }

    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    const trialCommissionRate = PLAN_COMMISSION_RATES[TRIAL_PLAN] ?? 12;

    const updated = await User.findByIdAndUpdate(
      id,
      {
        $set: {
          isOnTrial: true,
          trialEndsAt,
          trialPlan: TRIAL_PLAN,
          activeCommissionRate: trialCommissionRate,
        },
      },
      { new: true, select: "isOnTrial trialEndsAt trialPlan activeCommissionRate subscriptionPlan" }
    );

    return res.status(200).json({
      success: true,
      message: `Your ${TRIAL_DAYS}-day Premium trial has been activated`,
      data: {
        trialPlan: TRIAL_PLAN,
        trialEndsAt: updated.trialEndsAt,
        commissionRate: trialCommissionRate,
        trialDays: TRIAL_DAYS,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Cancel Subscription ──────────────────────────────────────────────────────

export const cancelSubscription = async (req, res, next) => {
  try {
    const { id } = req.user;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const activePlans = ["premium", "elite", "enterprise", "standard"];
    if (!activePlans.includes(user.subscriptionPlan) && !user.isOnTrial) {
      return res.status(400).json({
        success: false,
        message: "You do not have an active paid subscription to cancel",
      });
    }

    const updated = await User.findByIdAndUpdate(
      id,
      {
        $set: {
          subscriptionPlan: "starter",
          subscriptionStartDate: null,
          subscriptionEndDate: null,
          billTerm: null,
          activeCommissionRate: 15,
          isOnTrial: false,
          trialEndsAt: null,
          trialPlan: null,
          "scheduledDowngrade.plan": null,
          "scheduledDowngrade.effectiveDate": null,
        },
      },
      { new: true, select: "subscriptionPlan activeCommissionRate isOnTrial" }
    );

    await syncVerifiedBadge(id, "starter");

    return res.status(200).json({
      success: true,
      message: "Subscription cancelled. You have been moved to the Starter plan.",
      data: { subscriptionPlan: updated.subscriptionPlan },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Schedule Downgrade ───────────────────────────────────────────────────────

export const scheduleDowngrade = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { targetPlan } = req.body;

    const normalizedTarget = String(targetPlan || "").trim().toLowerCase();
    if (!normalizedTarget) {
      return res.status(400).json({ success: false, message: "targetPlan is required" });
    }

    const validDowngrades = ["starter", "premium", "elite"];
    if (!validDowngrades.includes(normalizedTarget)) {
      return res.status(400).json({
        success: false,
        message: "Invalid target plan. Valid options: starter, premium, elite",
      });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const planOrder = { starter: 0, free: 0, standard: 1, premium: 2, elite: 3, enterprise: 4 };
    const currentRank = planOrder[user.subscriptionPlan] ?? 0;
    const targetRank = planOrder[normalizedTarget] ?? 0;

    if (targetRank >= currentRank) {
      return res.status(400).json({
        success: false,
        message: "Target plan must be lower than your current plan. Use the upgrade flow to move up.",
      });
    }

    if (!user.subscriptionEndDate) {
      return res.status(400).json({
        success: false,
        message: "No active subscription end date found to schedule downgrade against",
      });
    }

    const updated = await User.findByIdAndUpdate(
      id,
      {
        $set: {
          "scheduledDowngrade.plan": normalizedTarget,
          "scheduledDowngrade.effectiveDate": user.subscriptionEndDate,
        },
      },
      { new: true, select: "scheduledDowngrade subscriptionEndDate subscriptionPlan" }
    );

    return res.status(200).json({
      success: true,
      message: `Downgrade to ${normalizedTarget} scheduled for ${user.subscriptionEndDate.toDateString()}. Your current plan remains active until then.`,
      data: {
        currentPlan: user.subscriptionPlan,
        scheduledDowngrade: updated.scheduledDowngrade,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Apply Pending Downgrade (called after subscription expiry) ───────────────

export const applyScheduledDowngrade = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return;

  const { plan, effectiveDate } = user.scheduledDowngrade || {};
  if (!plan || !effectiveDate) return;
  if (new Date(effectiveDate) > new Date()) return;

  const planOrder = { starter: 0, free: 0, standard: 1, premium: 2, elite: 3, enterprise: 4 };
  const targetRank = planOrder[plan] ?? 0;

  // Enforce listing limit: mark excess active listings inactive
  const targetListingLimit = { starter: 10, free: 10, standard: 10, premium: 50, elite: null, enterprise: null }[plan];
  if (targetListingLimit !== null) {
    const activeLists = await Listing.find({ userId, approvalStatus: "approved" })
      .sort({ createdAt: 1 })
      .select("_id");

    if (activeLists.length > targetListingLimit) {
      const excessIds = activeLists.slice(targetListingLimit).map((l) => l._id);
      await Listing.updateMany({ _id: { $in: excessIds } }, { $set: { approvalStatus: "pending", isApproved: false } });
    }
  }

  await User.findByIdAndUpdate(userId, {
    $set: {
      subscriptionPlan: plan,
      activeCommissionRate: PLAN_COMMISSION_RATES[plan] ?? 15,
      subscriptionStartDate: null,
      subscriptionEndDate: null,
      billTerm: null,
      "scheduledDowngrade.plan": null,
      "scheduledDowngrade.effectiveDate": null,
    },
  });

  await syncVerifiedBadge(userId, plan);
};

// ─── Designer Dashboard ───────────────────────────────────────────────────────

export const getMySubscription = async (req, res, next) => {
  try {
    const { id } = req.user;
    const user = await User.findById(id).select(
      "subscriptionPlan subscriptionStartDate subscriptionEndDate billTerm activeCommissionRate isOnTrial trialEndsAt trialPlan scheduledDowngrade"
    );
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const effectivePlan = getEffectivePlan(user);
    const listingLimit = getListingLimit(user);

    // Count active listings and pre-loved listings
    const [activeListings, preLoveListings] = await Promise.all([
      Listing.countDocuments({ userId: id, approvalStatus: { $ne: "rejected" } }),
      Listing.countDocuments({
        userId: id,
        approvalStatus: { $ne: "rejected" },
        condition: { $regex: /pre.?loved|used/i },
      }),
    ]);

    const trialActive =
      user.isOnTrial && user.trialEndsAt && new Date(user.trialEndsAt) > new Date();

    const planDetails = await Plan.findOne({ name: PLAN_NAME_MAP[effectivePlan] || effectivePlan })
      .sort({ createdAt: -1 })
      .select("benefits commissionRate listingLimit preLoveListingLimit description");

    return res.status(200).json({
      success: true,
      message: "Subscription details retrieved",
      data: {
        currentPlan: effectivePlan,
        displayPlan: PLAN_NAME_MAP[effectivePlan] || effectivePlan,
        subscriptionStartDate: user.subscriptionStartDate,
        subscriptionEndDate: user.subscriptionEndDate,
        billTerm: user.billTerm,
        commissionRate: user.activeCommissionRate ?? PLAN_COMMISSION_RATES[effectivePlan] ?? 15,
        trial: trialActive
          ? { active: true, endsAt: user.trialEndsAt, plan: user.trialPlan }
          : { active: false },
        listingUsage: {
          used: activeListings,
          limit: listingLimit,
          label: listingLimit === null ? `${activeListings} / Unlimited` : `${activeListings} / ${listingLimit}`,
        },
        preLoveUsage: (() => {
          const preLoveLimit = planDetails != null
            ? planDetails.preLoveListingLimit
            : getPreLoveLimit(user);
          return {
            used: preLoveListings,
            limit: preLoveLimit,
            label: preLoveLimit === null
              ? `${preLoveListings} / Unlimited`
              : `${preLoveListings} / ${preLoveLimit}`,
          };
        })(),
        scheduledDowngrade: user.scheduledDowngrade?.plan
          ? {
              plan: user.scheduledDowngrade.plan,
              effectiveDate: user.scheduledDowngrade.effectiveDate,
            }
          : null,
        planBenefits: planDetails?.benefits || [],
        description: planDetails?.description || "",
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Plan CRUD ────────────────────────────────────────────────────────────────

export const createSubscriptionPlan = async (req, res, next) => {
  try {
    let {
      name, amount, gbpAmount, duration, description, benefits,
      commissionRate, listingLimit, preLoveListingLimit,
      isActive, isFree, trialDays, annualDiscountPercent,
    } = req.body;

    if (!name || amount === undefined || !duration || !description) {
      return res.status(400).json({ success: false, message: "name, amount, duration, and description are required" });
    }

    const normalizedPlanName = normalizePlanName(name);
    const normalizedDuration = normalizeDuration(duration);
    description = String(description).trim();

    if (!normalizedPlanName) {
      return res.status(400).json({ success: false, message: "Invalid plan name. Valid: Starter, Premium, Elite, Enterprise" });
    }
    if (!ALLOWED_DURATIONS.has(normalizedDuration)) {
      return res.status(400).json({ success: false, message: "Invalid duration. Valid: monthly, quarterly, yearly" });
    }

    const parsedAmount = Number(amount);
    if (Number.isNaN(parsedAmount) || parsedAmount < 0) {
      return res.status(400).json({ success: false, message: "amount must be a non-negative number" });
    }

    let normalizedBenefits;
    try {
      normalizedBenefits = normalizePlanBenefits(benefits, { required: false }) || [];
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    const existing = await Plan.findOne({ name: normalizedPlanName, duration: normalizedDuration });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "A plan with this name and duration already exists. Use the update endpoint instead.",
      });
    }

    const planData = {
      name: normalizedPlanName,
      amount: parsedAmount,
      duration: normalizedDuration,
      description,
      benefits: normalizedBenefits,
    };

    if (gbpAmount !== undefined) planData.gbpAmount = Number(gbpAmount) || null;
    if (commissionRate !== undefined) planData.commissionRate = Number(commissionRate);
    if (listingLimit !== undefined) planData.listingLimit = listingLimit === null ? null : Number(listingLimit);
    if (preLoveListingLimit !== undefined) planData.preLoveListingLimit = preLoveListingLimit === null ? null : Number(preLoveListingLimit);
    if (isActive !== undefined) planData.isActive = Boolean(isActive);
    if (isFree !== undefined) planData.isFree = Boolean(isFree);
    if (trialDays !== undefined) planData.trialDays = Number(trialDays);
    if (annualDiscountPercent !== undefined) planData.annualDiscountPercent = Number(annualDiscountPercent);

    const created = await Plan.create(planData);

    return res.status(201).json({ success: true, message: "Subscription plan created successfully", data: created });
  } catch (error) {
    next(error);
  }
};

export const getSubscriptionPlans = async (req, res, next) => {
  try {
    const plans = await Plan.find({ isActive: true }).sort({ name: 1, duration: 1 });
    const provider = getSubscriptionProvider(req.user?.country);
    const exchangeRate = provider === "stripe" ? await fetchUsdNgnRate() : null;
    const data = plans.map((plan) =>
      formatPlanForUser({ plan, provider, exchangeRate, userCountry: req.user?.country })
    );

    return res.status(200).json({ success: true, message: "Subscription plans retrieved successfully", data });
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
    if (!plan) return res.status(404).json({ success: false, message: "Subscription plan not found" });

    const provider = getSubscriptionProvider(req.user?.country);
    const exchangeRate = provider === "stripe" ? await fetchUsdNgnRate() : null;
    const data = formatPlanForUser({ plan, provider, exchangeRate, userCountry: req.user?.country });

    return res.status(200).json({ success: true, message: "Subscription plan retrieved successfully", data });
  } catch (error) {
    next(error);
  }
};

export const updateSubscriptionPlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name, amount, gbpAmount, duration, description, benefits,
      commissionRate, listingLimit, preLoveListingLimit,
      isActive, isFree, trialDays, annualDiscountPercent,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid plan ID" });
    }

    const currentPlan = await Plan.findById(id);
    if (!currentPlan) return res.status(404).json({ success: false, message: "Subscription plan not found" });

    const updateFields = {};

    if (name !== undefined) {
      const normalized = normalizePlanName(name);
      if (!normalized) return res.status(400).json({ success: false, message: "Invalid plan name" });
      updateFields.name = normalized;
    }
    if (amount !== undefined) {
      const parsed = Number(amount);
      if (Number.isNaN(parsed) || parsed < 0) return res.status(400).json({ success: false, message: "Invalid amount" });
      updateFields.amount = parsed;
    }
    if (gbpAmount !== undefined) updateFields.gbpAmount = gbpAmount === null ? null : Number(gbpAmount);
    if (duration !== undefined) {
      const norm = normalizeDuration(duration);
      if (!ALLOWED_DURATIONS.has(norm)) return res.status(400).json({ success: false, message: "Invalid duration" });
      updateFields.duration = norm;
    }
    if (description !== undefined) {
      const desc = String(description).trim();
      if (!desc) return res.status(400).json({ success: false, message: "Description cannot be empty" });
      updateFields.description = desc;
    }
    if (benefits !== undefined) {
      try {
        updateFields.benefits = normalizePlanBenefits(benefits, { required: true });
      } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
    }
    if (commissionRate !== undefined) updateFields.commissionRate = Number(commissionRate);
    if (listingLimit !== undefined) updateFields.listingLimit = listingLimit === null ? null : Number(listingLimit);
    if (preLoveListingLimit !== undefined) updateFields.preLoveListingLimit = preLoveListingLimit === null ? null : Number(preLoveListingLimit);
    if (isActive !== undefined) updateFields.isActive = Boolean(isActive);
    if (isFree !== undefined) updateFields.isFree = Boolean(isFree);
    if (trialDays !== undefined) updateFields.trialDays = Number(trialDays);
    if (annualDiscountPercent !== undefined) updateFields.annualDiscountPercent = Number(annualDiscountPercent);

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ success: false, message: "No valid fields provided for update" });
    }

    const candidateName = updateFields.name || currentPlan.name;
    const candidateDuration = updateFields.duration || currentPlan.duration;
    const duplicate = await Plan.findOne({ _id: { $ne: id }, name: candidateName, duration: candidateDuration });
    if (duplicate) {
      return res.status(409).json({ success: false, message: "Another plan with the same name and duration already exists" });
    }

    const updated = await Plan.findByIdAndUpdate(id, updateFields, { new: true, runValidators: true });

    return res.status(200).json({ success: true, message: "Subscription plan updated successfully", data: updated });
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

    const deleted = await Plan.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ success: false, message: "Subscription plan not found" });

    return res.status(200).json({ success: true, message: "Subscription plan deleted successfully", data: { id } });
  } catch (error) {
    next(error);
  }
};

// ─── Admin: Seed Default Plans ────────────────────────────────────────────────

export const seedDefaultPlans = async (req, res, next) => {
  try {
    const plans = [
      // ── STARTER (Free) ──────────────────────────────
      {
        name: "Starter",
        amount: 0,
        gbpAmount: 0,
        duration: "monthly",
        description: "Free entry-level plan for new and emerging designers.",
        isFree: true,
        commissionRate: 15,
        listingLimit: 10,
        preLoveListingLimit: 3,
        trialDays: 0,
        annualDiscountPercent: 0,
        benefits: [
          "Create and manage designer profile",
          "Upload portfolio and profile images",
          "List up to 10 active products",
          "Receive customer enquiries",
          "Receive and submit quotations",
          "Manage customer orders",
          "Access customer ratings and reviews",
          "Access designer wallet",
          "List up to 3 pre-loved items",
          "Standard support",
        ],
      },

      // ── PREMIUM ─────────────────────────────────────
      {
        name: "Premium",
        amount: 10000,
        gbpAmount: 9.99,
        duration: "monthly",
        description: "For growing designers and small fashion businesses.",
        isFree: false,
        commissionRate: 12,
        listingLimit: 50,
        preLoveListingLimit: 20,
        trialDays: 7,
        annualDiscountPercent: 10,
        benefits: [
          "Everything in Starter",
          "Up to 50 active product listings",
          "Direct messaging with customers",
          "Priority search ranking",
          "Featured placement in category pages",
          "Access to Pre-Loved Marketplace",
          "Up to 20 pre-loved listings",
          "Customer insights dashboard",
          "Designer performance analytics",
          "Custom store banner",
          "Social media promotion opportunities",
          "Faster payouts",
          "Priority support",
        ],
      },
      {
        name: "Premium",
        amount: 27000,
        gbpAmount: null,
        duration: "quarterly",
        description: "For growing designers and small fashion businesses.",
        isFree: false,
        commissionRate: 12,
        listingLimit: 50,
        preLoveListingLimit: 20,
        trialDays: 0,
        annualDiscountPercent: 10,
        benefits: [
          "Everything in Starter",
          "Up to 50 active product listings",
          "Direct messaging with customers",
          "Priority search ranking",
          "Featured placement in category pages",
          "Access to Pre-Loved Marketplace",
          "Up to 20 pre-loved listings",
          "Customer insights dashboard",
          "Designer performance analytics",
          "Custom store banner",
          "Social media promotion opportunities",
          "Faster payouts",
          "Priority support",
        ],
      },
      {
        name: "Premium",
        amount: 108000,
        gbpAmount: null,
        duration: "yearly",
        description: "For growing designers and small fashion businesses.",
        isFree: false,
        commissionRate: 12,
        listingLimit: 50,
        preLoveListingLimit: 20,
        trialDays: 0,
        annualDiscountPercent: 10,
        benefits: [
          "Everything in Starter",
          "Up to 50 active product listings",
          "Direct messaging with customers",
          "Priority search ranking",
          "Featured placement in category pages",
          "Access to Pre-Loved Marketplace",
          "Up to 20 pre-loved listings",
          "Customer insights dashboard",
          "Designer performance analytics",
          "Custom store banner",
          "Social media promotion opportunities",
          "Faster payouts",
          "Priority support",
        ],
      },

      // ── ELITE ────────────────────────────────────────
      {
        name: "Elite",
        amount: 25000,
        gbpAmount: 24.99,
        duration: "monthly",
        description: "For established designers, boutiques, and professional fashion brands.",
        isFree: false,
        commissionRate: 8,
        listingLimit: null,
        preLoveListingLimit: null,
        trialDays: 0,
        annualDiscountPercent: 10,
        benefits: [
          "Everything in Premium",
          "Unlimited active product listings",
          "Unlimited pre-loved listings",
          "Verified Designer Badge",
          "Homepage featured placement",
          "Dedicated account manager",
          "Premium visibility in Pre-Loved Marketplace",
          "Advanced analytics dashboard",
          "Sales campaign tools",
          "Discount and coupon creation",
          "Event and fashion showcase promotion",
          "Custom storefront URL",
          "Early access to new platform features",
          "Premium support",
        ],
      },
      {
        name: "Elite",
        amount: 67500,
        gbpAmount: null,
        duration: "quarterly",
        description: "For established designers, boutiques, and professional fashion brands.",
        isFree: false,
        commissionRate: 8,
        listingLimit: null,
        preLoveListingLimit: null,
        trialDays: 0,
        annualDiscountPercent: 10,
        benefits: [
          "Everything in Premium",
          "Unlimited active product listings",
          "Unlimited pre-loved listings",
          "Verified Designer Badge",
          "Homepage featured placement",
          "Dedicated account manager",
          "Premium visibility in Pre-Loved Marketplace",
          "Advanced analytics dashboard",
          "Sales campaign tools",
          "Discount and coupon creation",
          "Event and fashion showcase promotion",
          "Custom storefront URL",
          "Early access to new platform features",
          "Premium support",
        ],
      },
      {
        name: "Elite",
        amount: 270000,
        gbpAmount: null,
        duration: "yearly",
        description: "For established designers, boutiques, and professional fashion brands.",
        isFree: false,
        commissionRate: 8,
        listingLimit: null,
        preLoveListingLimit: null,
        trialDays: 0,
        annualDiscountPercent: 10,
        benefits: [
          "Everything in Premium",
          "Unlimited active product listings",
          "Unlimited pre-loved listings",
          "Verified Designer Badge",
          "Homepage featured placement",
          "Dedicated account manager",
          "Premium visibility in Pre-Loved Marketplace",
          "Advanced analytics dashboard",
          "Sales campaign tools",
          "Discount and coupon creation",
          "Event and fashion showcase promotion",
          "Custom storefront URL",
          "Early access to new platform features",
          "Premium support",
        ],
      },

      // ── ENTERPRISE ───────────────────────────────────
      {
        name: "Enterprise",
        amount: 0,
        gbpAmount: null,
        duration: "monthly",
        description: "For large fashion houses, brands, and institutional partners. Custom pricing applies.",
        isFree: false,
        commissionRate: 8,
        listingLimit: null,
        preLoveListingLimit: null,
        trialDays: 0,
        annualDiscountPercent: 0,
        benefits: [
          "Multiple staff accounts",
          "Team management",
          "Bulk product uploads",
          "API integrations",
          "Dedicated onboarding support",
          "Featured campaign inclusion",
          "Priority dispute handling",
          "Dedicated account success manager",
          "Custom pricing and commission structure",
        ],
      },
    ];

    const results = [];
    for (const planData of plans) {
      const existing = await Plan.findOne({ name: planData.name, duration: planData.duration });
      if (existing) {
        const updated = await Plan.findByIdAndUpdate(existing._id, planData, { new: true, runValidators: true });
        results.push({ action: "updated", plan: updated.name, duration: updated.duration });
      } else {
        const created = await Plan.create(planData);
        results.push({ action: "created", plan: created.name, duration: created.duration });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Default subscription plans seeded successfully",
      data: results,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Admin: List All Subscribers ──────────────────────────────────────────────

export const getSubscribers = async (req, res, next) => {
  try {
    const { plan, status, page = 1, limit = 20 } = req.query;
    const skip = (Math.max(Number(page), 1) - 1) * Math.min(Number(limit), 100);

    const filter = {};
    if (plan) filter.subscriptionPlan = String(plan).toLowerCase();
    if (status === "active") filter.subscriptionEndDate = { $gt: new Date() };
    if (status === "expired") filter.subscriptionEndDate = { $lte: new Date() };
    if (status === "trial") filter.isOnTrial = true;

    const [users, total] = await Promise.all([
      User.find(filter)
        .skip(skip)
        .limit(Math.min(Number(limit), 100))
        .select("fullName email subscriptionPlan subscriptionEndDate billTerm isOnTrial trialEndsAt activeCommissionRate")
        .sort({ subscriptionEndDate: -1 }),
      User.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Subscribers retrieved",
      data: users,
      pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) || 1 },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Admin: Manually Set User Plan ───────────────────────────────────────────

export const adminSetUserPlan = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { plan, commissionRate, subscriptionEndDate } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    const normalizedPlan = String(plan || "").trim().toLowerCase();
    const validPlans = ["starter", "premium", "elite", "enterprise", "standard", "free"];
    if (!validPlans.includes(normalizedPlan)) {
      return res.status(400).json({ success: false, message: "Invalid plan" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const effectiveCommissionRate =
      commissionRate !== undefined
        ? Number(commissionRate)
        : PLAN_COMMISSION_RATES[normalizedPlan] ?? 15;

    const updateData = {
      subscriptionPlan: normalizedPlan,
      activeCommissionRate: effectiveCommissionRate,
      isOnTrial: false,
      trialEndsAt: null,
    };
    if (subscriptionEndDate) updateData.subscriptionEndDate = new Date(subscriptionEndDate);

    const updated = await User.findByIdAndUpdate(userId, { $set: updateData }, {
      new: true,
      select: "fullName email subscriptionPlan activeCommissionRate subscriptionEndDate",
    });

    await syncVerifiedBadge(userId, normalizedPlan);

    return res.status(200).json({
      success: true,
      message: "User subscription updated",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};
