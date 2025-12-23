import User from '../../user/model/user.model.js';
import Material from '../../material/model/material.model';
import Vendor from '../../vendor/model/vendor.model.js';
import Category from '../../category/model/category.model.js';
import InitializedOrder from '../../material/model/InitializedOrder.model.js';
import Transactions from '../../transaction/model/transaction.model.js';
import { sendTransactionEmail, sendSubscriptionEmail, sendTransactionListingEmail } from '../../../utils/emailService.utils.js';
import { cargoCalculateCost, expressCalculateCost, regularCalculateCost } from "../../../utils/shipmentCalcu.distance";
import axios from "axios";
import crypto from "crypto"
import mongoose from "mongoose";
import Review from '../../review/model/review.model.js';
import Tracking from '../../tracking/model/tracking.model.js';



import Stripe from 'stripe';
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});


export const createUserAccount = async (req, res, next) => {
  try {
    const { id } = req.user;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // ✅ If already created, reuse it
    let stripeAccountId = user.stripeId;

    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "US",
        email: user.email,
        business_type: "individual",
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true },
        },
        individual: {
          email: user.email,
          first_name: user.fullName.split(" ")[0],
          last_name: user.fullName.split(" ")[1] || "",
        },
      });

      stripeAccountId = account.id;

      await User.findByIdAndUpdate(
        user._id,
        { stripeId: stripeAccountId },
        { new: true }
      );
    }

    // ✅ Create onboarding link (THIS is how bank is added)
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: "https://yourapp.com/stripe/reauth",
      return_url: "https://yourapp.com/stripe/success",
      type: "account_onboarding",
    });

    return res.status(200).json({
      success: true,
      message: "Stripe onboarding started",
      data: {
        stripeAccountId,
        onboardingUrl: accountLink.url,
      },
    });
  } catch (error) {
    next(error);
  }
};



export const makeStripeTransfer = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { amount } = req.body;

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid transfer amount",
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.stripeId) {
      return res.status(400).json({
        success: false,
        message: "User has no Stripe connected account",
      });
    }

    if (amount > user.wallet) {
      return res.status(403).json({
        success: false,
        message: "Insufficient wallet balance",
      });
    }

    // 🔍 Check Stripe account readiness
    const account = await stripe.accounts.retrieve(user.stripeId);

    if (!account.payouts_enabled) {
      return res.status(400).json({
        success: false,
        message: "Stripe onboarding not completed",
      });
    }

    const transferGroup = crypto.randomBytes(6).toString("hex");

    // 💸 Transfer funds
    const transfer = await stripe.transfers.create({
      amount: Math.round(amount * 100), // cents
      currency: "usd",
      destination: user.stripeId,
      transfer_group: transferGroup,
    });

    // 💰 Deduct wallet AFTER success
    await User.findByIdAndUpdate(
      user._id,
      { $inc: { wallet: -amount } },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Transfer successful",
      data: {
        transferId: transfer.id,
        amount,
      },
    });
  } catch (error) {
    next(error);
  }
};



export const createStripePayment = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { amount, shipmentMethod, address, paymentStatus } = req.body;
    const { reviewId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({ success: false, message: "Invalid review ID" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    const material = await Material.findById(review.materialId);
    if (!material) {
      return res.status(404).json({ success: false, message: "Material not found" });
    }

    const [vendor, materialOwner] = await Promise.all([
      Vendor.findById(review.vendorId),
      User.findById(material.userId),
    ]);

    if (!vendor || !materialOwner) {
      return res.status(404).json({
        success: false,
        message: "Vendor or material owner not found",
      });
    }

    const pickupAddress = vendor.address;
    const deliveryAddress = address || materialOwner.address;

     const geocodeReceiverResponse = await axios.get(`https://api.geoapify.com/v1/geocode/search`, {
        params: { text: deliveryAddress, apiKey: "14ea724d207e48ebabdcb893aa97217e" }
    });

    const Location = geocodeReceiverResponse.data.features;
    if (!Location.length) {
        return res.status(400).json({
            success: false,
            message: 'Invalid deliveryAddress provided',
            error: `Geocoding failed for deliveryAddress: ${deliveryAddress}`
        });
    }

    const deliveryLocation = {
        latitude: Location[0].geometry.coordinates[1],
        longitude: Location[0].geometry.coordinates[0]
    };

    // Geocode sender address
    const geocodeSenderResponse = await axios.get(`https://api.geoapify.com/v1/geocode/search`, {
        params: { text: pickupAddress, apiKey: "14ea724d207e48ebabdcb893aa97217e" }
    });

    const senderAddress = geocodeSenderResponse.data.features;
    if (!senderAddress.length) {
        return res.status(400).json({
            success: false,
            message: 'Invalid pickupAddress provided',
            error: `Geocoding failed for pickupAddress: ${pickupAddress}`
        });
    }

    const senderLocation = {
        latitude: senderAddress[0].geometry.coordinates[1],
        longitude: senderAddress[0].geometry.coordinates[0]
    };

    // Shipment costs
    const numberOfPackages = 1;
    const method = (shipmentMethod || "").trim().toLowerCase();
    if (!method) {
    return res.status(400).json({ success: false, message: "shipmentMethod is required" });
    }

    // Shipment cost calculation
    let shipmentCost;
    // const method = shipmentMethod.toLowerCase();

    switch (method) {
      case "express":
        shipmentCost = await expressCalculateCost(deliveryLocation, senderLocation, numberOfPackages);
        break;
      case "cargo":
        shipmentCost = await cargoCalculateCost(deliveryLocation, senderLocation, numberOfPackages);
        break;
      case "regular":
        shipmentCost = await regularCalculateCost(deliveryLocation, senderLocation, numberOfPackages);
        break;
      default:
        return res.status(400).json({ success: false, message: "Invalid shipment method" });
    }

    const shipping = Math.round(shipmentCost);
    const productCost = Number(amount);
    const totalCost = shipping + productCost;


    const paymentReference = crypto.randomBytes(8).toString("hex");

    const order = await InitializedOrder.create({
      userId: user._id,
      cartItems: [{
        vendorId: vendor._id,
        userId: user._id,
        attireType: material.attireType,
        clothMaterial: material.clothMaterial,
        color: material.color,
        brand: material.brand,
        measurement: material.measurement,
        sampleImage: material.sampleImage,
      }],
      totalAmount: totalCost,
      amountPaid: totalCost,
      paymentMethod: "Stripe",
      paymentReference,
      deliveryAddress,
      vendorId: vendor._id,
      materialId: material._id,
      reviewId,
      paymentStatus,
    });

    const userCurrency = "USD";
    const amountInCents = totalCost * 100;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [{
        price_data: {
          currency: userCurrency,
          product_data: { name: `Order ${paymentReference}` },
          unit_amount: amountInCents,
        },
        quantity: 1,
      }],
      success_url: `https://hog-fashion.vercel.app/Success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://hog-fashion.vercel.app/cancel`,
      metadata: { reference: paymentReference },
    });

    return res.status(201).json({
      success: true,
      message: "Stripe checkout created successfully",
      data: {
        order,
        checkoutUrl: session.url,
      },
    });

  } catch (error) {
    next(error);
  }
};




export const webhookPaymentSuccess = async (req, res) => {
  const sig = req.headers["stripe-signature"];

  if (!sig) {
    return res.status(400).send("Missing Stripe signature header");
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.error("Webhook verification failed:", error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  console.log(`✅ Webhook received: ${event.type}`);

  try {
    let reference;

    if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object;
      reference = intent.metadata?.reference;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      reference = session.metadata?.reference;
    }

    if (!reference) {
      return res.status(200).json({ received: true });
    }

    const order = await InitializedOrder.findOne({ paymentReference: reference });
    if (!order) {
      return res.status(200).json({ message: "Order not found" });
    }

    const existingTransaction = await Transactions.findOne({
      paymentReference: reference,
    });

    if (existingTransaction) {
      return res.status(200).json({ message: "Already processed" });
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
      billTerm: order.billTerm,
      paymentCurrency: "NGN",
      orderStatus: order.paymentStatus,
      amountPaid: order.amountPaid,
      vendorId: order.vendorId || null,
      materialId: order.materialId || null,
    });

    // 🔹 SUBSCRIPTION
    if (["Standard", "Premium", "Enterprise"].includes(transaction.plan)) {
      await User.findByIdAndUpdate(order.userId, {
        subscriptionPlan: transaction.plan.toLowerCase(),
        subscriptionStartDate: transaction.subscriptionStartDate,
        subscriptionEndDate: transaction.subscriptionEndDate,
        billTerm: transaction.billTerm,
      });

      const user = await User.findById(order.userId);
      if (user) {
        await sendSubscriptionEmail(user, transaction.totalAmount);
      }
    }

    // 🔹 MARKETPLACE PAYMENT
    if (order.vendorId && order.materialId) {
      const review = await Review.findById(order.reviewId);
      const vendor = await Vendor.findById(order.vendorId);

      if (vendor?.userId && review) {
        await User.findByIdAndUpdate(vendor.userId, {
          $inc: { wallet: order.amountPaid },
        });

        await Review.findByIdAndUpdate(review._id, {
          $inc: { amountPaid: order.amountPaid },
          $set: {
            amountToPay:
              order.paymentStatus === "full payment"
                ? 0
                : order.totalAmount - order.amountPaid,
            status: order.paymentStatus,
          },
        });

        if (order.paymentStatus === "full payment") {
          await User.updateMany(
            { role: { $in: ["admin", "superAdmin"] } },
            {
              $inc: {
                commission: review.commission,
                tax: review.tax,
              },
            }
          );
        }
      }
    }

    // 🔹 TRACKING
    await Tracking.findOneAndUpdate(
      { reference },
      { status: "success" },
      { new: true }
    );

    await InitializedOrder.findByIdAndDelete(order._id);

    return res.status(200).json({
      success: true,
      message: "Payment processed successfully",
      order: transaction,
    });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
};
