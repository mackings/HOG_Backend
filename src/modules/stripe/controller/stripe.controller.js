import User from '../../user/model/user.model.js';
import Material from '../../material/model/material.model.js';
import Vendor from '../../vendor/model/vendor.model.js';
import Category from '../../category/model/category.model.js';
import InitializedOrder from '../../material/model/InitializedOrder.model.js';
import Transactions from '../../transaction/model/transaction.model.js';
import { sendTransactionEmail, sendSubscriptionEmail, sendTransactionListingEmail, sendPayoutNotificationEmail, sendPaymentReceivedEmail } from '../../../utils/emailService.utils.js';
import { cargoCalculateCost, expressCalculateCost, regularCalculateCost } from "../../../utils/shipmentCalcu.distance.js";
import axios from "axios";
import crypto from "crypto"
import mongoose from "mongoose";
import Review from '../../review/model/review.model.js';
import Tracking from '../../tracking/model/tracking.model.js';
import Stripe from 'stripe';



// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" })
  : null;


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
        business_type: "individual",
        capabilities: {
          transfers: { requested: true },
        },
        settings: {
          payouts: {
            schedule: {
              interval: "daily",  // Automatic daily payouts
              delay_days: 2       // Standard 2-day delay (minimum for new accounts)
            }
          }
        },
        // individual: {
        //   email: user.email,
        //   first_name: user.fullName.split(" ")[0],
        //   last_name: user.fullName.split(" ")[1] || "",
        // },
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
      type: "account_onboarding" //,
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


export const getStripeAccountStatus = async (req, res, next) => {
  try {
    const { id } = req.user;

    const user = await User.findById(id).select("stripeId email");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.stripeId) {
      return res.status(400).json({
        success: false,
        message: "Stripe account not created",
      });
    }

    const account = await stripe.accounts.retrieve(user.stripeId);

    const bankAccounts = await stripe.accounts.listExternalAccounts(
      user.stripeId,
      { object: "bank_account" }
    );

    return res.status(200).json({
      success: true,
      data: {
        account: {
          id: account.id,
          email: account.email,
          country: account.country,
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
          requirements: {
            currently_due: account.requirements?.currently_due || [],
            eventually_due: account.requirements?.eventually_due || [],
            disabled_reason: account.requirements?.disabled_reason || null,
          },
        },
        bankAccounts: bankAccounts.data.map((bank) => ({
          id: bank.id,
          bank_name: bank.bank_name,
          last4: bank.last4,
          currency: bank.currency,
          country: bank.country,
          status: bank.status,
        })),
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

    const review = await Review.findById(reviewId).populate('acceptedOfferId');
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    // Check if offer negotiation is required and completed
    if (review.hasAcceptedOffer === false && !review.acceptedOfferId) {
      return res.status(400).json({
        success: false,
        message: "Please negotiate and accept an offer before making payment",
        requiresOffer: true
      });
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

    const deliveryAddress = address || materialOwner.address;

    // Get flat delivery rate from database
    const method = (shipmentMethod || "").trim().toLowerCase();
    if (!method) {
      return res.status(400).json({ success: false, message: "shipmentMethod is required" });
    }

    let deliveryType;
    switch (method) {
      case "express":
        deliveryType = "Express";
        break;
      case "cargo":
        deliveryType = "Cargo";
        break;
      case "regular":
        deliveryType = "Regular";
        break;
      default:
        return res.status(400).json({ success: false, message: "Invalid shipment method. Choose Express, Cargo, or Regular" });
    }

    // Import DeliveryRate model
    const DeliveryRate = (await import('../../deliveryRate/model/deliveryRate.model.js')).default;

    const deliveryRate = await DeliveryRate.findOne({ deliveryType });
    if (!deliveryRate) {
      return res.status(400).json({
        success: false,
        message: `Delivery rate not found for ${deliveryType}. Please contact support.`
      });
    }

    // Simple flat rate calculation
    const productCost = parseFloat(amount);
    const deliveryFee = Number(deliveryRate.amount);
    const totalCost = productCost + deliveryFee;

    console.log("💰 PAYMENT CALCULATION:");
    console.log(`   Product Cost: $${productCost.toFixed(2)} USD`);
    console.log(`   Delivery Fee (${deliveryType}): $${deliveryFee.toFixed(2)} USD`);
    console.log(`   Total Cost: $${totalCost.toFixed(2)} USD`);
    console.log(`   Stripe Amount (cents): ${Math.round(totalCost * 100)}`);


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
    const amountInCents = Math.round(totalCost * 100);

    console.log(`   Final Stripe Charge: ${amountInCents} cents ($${(amountInCents / 100).toFixed(2)})\n`);

    const session = await stripe.checkout.sessions.create({
      // payment_method_types: ["card"],
      mode: "payment",
      line_items: [{
        price_data: {
          currency: userCurrency,
          product_data: { name: `OrderId-${paymentReference}` },
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
      message: "Stripe checkout created successfully.",
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
  console.log("\n🔔 ========== STRIPE WEBHOOK CALLED ==========");
  console.log("📅 Timestamp:", new Date().toISOString());

  const sig = req.headers["stripe-signature"];

  if (!sig) {
    console.error("❌ Missing Stripe signature header");
    return res.status(400).send("Missing Stripe signature header");
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    console.log("✅ Webhook signature verified successfully");
  } catch (error) {
    console.error("❌ Webhook verification failed:", error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  console.log(`\n📨 Event Type: ${event.type}`);
  console.log(`📋 Event ID: ${event.id}`);

  try {
    let reference;

    if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object;
      reference = intent.metadata?.reference;
      console.log("💳 Payment Intent Event - Reference:", reference);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      reference = session.metadata?.reference;
      console.log("🛒 Checkout Session Event - Reference:", reference);
      console.log("💰 Amount Total:", session.amount_total);
      console.log("💵 Currency:", session.currency);
    }

    if (!reference) {
      console.log("⚠️  No payment reference found in metadata. Skipping processing.");
      return res.status(200).json({ received: true });
    }

    console.log(`\n🔍 Searching for order with reference: ${reference}`);
    const order = await InitializedOrder.findOne({ paymentReference: reference });

    if (!order) {
      console.error(`❌ Order NOT FOUND for reference: ${reference}`);
      console.log("💡 This could mean:");
      console.log("   1. Order was never created");
      console.log("   2. Order was already deleted");
      console.log("   3. Payment reference mismatch");
      return res.status(200).json({ message: "Order not found" });
    }

    console.log(`✅ Order found: ${order._id}`);
    console.log(`   User ID: ${order.userId}`);
    console.log(`   Vendor ID: ${order.vendorId}`);
    console.log(`   Amount Paid: ${order.amountPaid}`);
    console.log(`   Material ID: ${order.materialId}`);

    console.log(`\n🔍 Checking for existing transaction...`);
    const existingTransaction = await Transactions.findOne({
      paymentReference: reference,
    });

    if (existingTransaction) {
      console.log("⚠️  Transaction already processed. Skipping.");
      return res.status(200).json({ message: "Already processed" });
    }

    console.log("✅ No duplicate found. Creating new transaction...");

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

    console.log(`✅ TRANSACTION CREATED SUCCESSFULLY!`);
    console.log(`   Transaction ID: ${transaction._id}`);
    console.log(`   Payment Reference: ${transaction.paymentReference}`);
    console.log(`   User ID: ${transaction.userId}`);
    console.log(`   Amount: ${transaction.amountPaid}`);

    // 🔹 SUBSCRIPTION
    if (["Standard", "Premium", "Enterprise"].includes(transaction.plan)) {
      console.log(`\n📦 Processing subscription: ${transaction.plan}`);
      await User.findByIdAndUpdate(order.userId, {
        subscriptionPlan: transaction.plan.toLowerCase(),
        subscriptionStartDate: transaction.subscriptionStartDate,
        subscriptionEndDate: transaction.subscriptionEndDate,
        billTerm: transaction.billTerm,
      });

      const user = await User.findById(order.userId);
      if (user) {
        await sendSubscriptionEmail(user, transaction.totalAmount);
        console.log(`✅ Subscription email sent to: ${user.email}`);
      }
    }

    // 🔹 MARKETPLACE PAYMENT - Auto-Payout to Vendor
    if (order.vendorId && order.materialId) {
      console.log(`\n💼 Processing marketplace payment...`);
      console.log(`   Vendor ID: ${order.vendorId}`);
      console.log(`   Material ID: ${order.materialId}`);
      console.log(`   Review ID: ${order.reviewId}`);

      const review = await Review.findById(order.reviewId);
      const vendor = await Vendor.findById(order.vendorId);
      const buyer = await User.findById(order.userId);

      console.log(`   Review found: ${review ? 'Yes' : 'No'}`);
      console.log(`   Vendor found: ${vendor ? 'Yes' : 'No'}`);
      console.log(`   Buyer found: ${buyer ? 'Yes' : 'No'}`);

      if (vendor?.userId && review) {
        console.log(`\n💰 Crediting vendor wallet...`);
        console.log(`   Vendor User ID: ${vendor.userId}`);
        console.log(`   Amount to credit: ${order.amountPaid}`);

        const vendorUser = await User.findById(vendor.userId);
        console.log(`   Vendor User found: ${vendorUser ? 'Yes' : 'No'}`);
        console.log(`   Vendor Email: ${vendorUser?.email}`);
        console.log(`   Current Wallet Balance: ${vendorUser?.wallet || 0}`);

        // 💰 Credit vendor's wallet in database
        const updatedVendor = await User.findByIdAndUpdate(vendor.userId, {
          $inc: { wallet: order.amountPaid },
        }, { new: true });

        console.log(`✅ VENDOR WALLET CREDITED!`);
        console.log(`   Previous Balance: ${vendorUser?.wallet || 0}`);
        console.log(`   Amount Added: ${order.amountPaid}`);
        console.log(`   New Balance: ${updatedVendor.wallet}`);

        // 💸 If vendor has Stripe connected account, transfer funds
        if (vendorUser.stripeId && stripe) {
          console.log(`\n💸 Initiating Stripe transfer to connected account...`);
          console.log(`   Stripe Account ID: ${vendorUser.stripeId}`);
          try {
            const transferGroup = crypto.randomBytes(6).toString("hex");

            await stripe.transfers.create({
              amount: Math.round(order.amountPaid * 100), // cents
              currency: "usd",
              destination: vendorUser.stripeId,
              transfer_group: transferGroup,
              description: `Payment for Order ${order.paymentReference}`,
              metadata: {
                vendorId: vendor._id.toString(),
                orderId: order._id.toString(),
                reference: order.paymentReference
              }
            });

            console.log(`✅ Stripe Transfer successful to vendor: ${vendor.businessName}`);
          } catch (stripeError) {
            console.error("❌ Stripe transfer failed:", stripeError.message);
            console.log("⚠️  Wallet credited but Stripe transfer failed - vendor can withdraw manually");
          }
        } else {
          console.log(`ℹ️  No Stripe connected account found - wallet credited only`);
        }

        // 📧 Send payout notification email to vendor
        try {
          await sendPayoutNotificationEmail(vendor, vendorUser, order.amountPaid, order.paymentReference);
          console.log(`✅ Payout notification sent to vendor: ${vendorUser.email}`);
        } catch (emailError) {
          console.error("❌ Vendor email failed:", emailError.message);
        }

        // 📧 Send payment confirmation email to buyer
        try {
          await sendPaymentReceivedEmail(buyer, order.amountPaid, vendor, order.paymentReference);
          console.log(`✅ Payment confirmation sent to buyer: ${buyer.email}`);
        } catch (emailError) {
          console.error("❌ Buyer email failed:", emailError.message);
        }

        // 📝 Update review status
        console.log(`\n📝 Updating review status...`);
        console.log(`   Review ID: ${review._id}`);
        console.log(`   Previous Amount Paid: ${review.amountPaid || 0}`);
        console.log(`   Adding: ${order.amountPaid}`);
        console.log(`   Total Cost: ${review.totalCost}`);

        // Calculate new total amount paid after this payment
        const newAmountPaid = (review.amountPaid || 0) + order.amountPaid;
        const newAmountToPay = order.paymentStatus === "full payment"
          ? 0
          : Math.max(0, review.totalCost - newAmountPaid);

        console.log(`   New Amount Paid: ${newAmountPaid}`);
        console.log(`   New Amount To Pay: ${newAmountToPay}`);
        console.log(`   Payment Status: ${order.paymentStatus}`);

        await Review.findByIdAndUpdate(review._id, {
          $inc: { amountPaid: order.amountPaid },
          $set: {
            amountToPay: newAmountToPay,
            status: order.paymentStatus,
          },
        });

        console.log(`✅ Review updated successfully`);

        // 💼 Credit platform commission (only on full payment)
        if (order.paymentStatus === "full payment") {
          console.log(`\n💼 Crediting platform commission...`);
          console.log(`   Commission: ${review.commission}`);
          console.log(`   Tax: ${review.tax}`);

          await User.updateMany(
            { role: { $in: ["admin", "superAdmin"] } },
            {
              $inc: {
                commission: review.commission,
                tax: review.tax,
              },
            }
          );

          console.log(`✅ Platform commission credited to admins`);
        }

        console.log(`\n✅ MARKETPLACE PAYMENT COMPLETE!`);
        console.log(`   Vendor: ${vendor.businessName}`);
        console.log(`   Amount: ${order.amountPaid}`);
      } else {
        console.log(`\n⚠️  Skipping vendor payment - missing vendor or review data`);
      }
    } else {
      console.log(`\nℹ️  Not a marketplace payment - skipping vendor payout`);
    }

    // 🔹 TRACKING
    console.log(`\n📍 Updating tracking status...`);
    await Tracking.findOneAndUpdate(
      { reference },
      { status: "success" },
      { new: true }
    );
    console.log(`✅ Tracking updated to 'success'`);

    console.log(`\n🗑️  Deleting initialized order...`);
    await InitializedOrder.findByIdAndDelete(order._id);
    console.log(`✅ Initialized order deleted`);

    console.log(`\n🎉 ========== WEBHOOK PROCESSING COMPLETE ==========\n`);

    return res.status(200).json({
      success: true,
      message: "Payment processed successfully",
      order: transaction,
    });
  } catch (error) {
    console.error("\n❌ ========== WEBHOOK PROCESSING ERROR ==========");
    console.error("Error Message:", error.message);
    console.error("Error Stack:", error.stack);
    console.error("================================================\n");
    return res.status(500).json({ error: "Webhook processing failed" });
  }
};


// 🔍 DEBUG: Manual webhook verification endpoint
export const verifyPaymentProcessing = async (req, res) => {
  try {
    const { paymentReference } = req.params;

    console.log(`\n🔍 ========== MANUAL VERIFICATION ==========`);
    console.log(`Payment Reference: ${paymentReference}`);

    // Check initialized order
    const order = await InitializedOrder.findOne({ paymentReference });
    console.log(`\n📦 Initialized Order:`);
    if (order) {
      console.log(`   ✅ Found: ${order._id}`);
      console.log(`   User ID: ${order.userId}`);
      console.log(`   Vendor ID: ${order.vendorId}`);
      console.log(`   Amount: ${order.amountPaid}`);
      console.log(`   Payment Status: ${order.paymentStatus}`);
    } else {
      console.log(`   ❌ Not found (may have been processed and deleted)`);
    }

    // Check transaction
    const transaction = await Transactions.findOne({ paymentReference });
    console.log(`\n💳 Transaction:`);
    if (transaction) {
      console.log(`   ✅ Found: ${transaction._id}`);
      console.log(`   User ID: ${transaction.userId}`);
      console.log(`   Vendor ID: ${transaction.vendorId}`);
      console.log(`   Amount: ${transaction.amountPaid}`);
      console.log(`   Payment Status: ${transaction.paymentStatus}`);
      console.log(`   Created At: ${transaction.createdAt}`);
    } else {
      console.log(`   ❌ Not found - Transaction was never created!`);
    }

    // Check tracking
    const tracking = await Tracking.findOne({ reference: paymentReference });
    console.log(`\n📍 Tracking:`);
    if (tracking) {
      console.log(`   ✅ Status: ${tracking.status}`);
    } else {
      console.log(`   ❌ Not found`);
    }

    console.log(`\n========================================\n`);

    return res.status(200).json({
      success: true,
      data: {
        initializedOrder: order ? {
          id: order._id,
          userId: order.userId,
          vendorId: order.vendorId,
          amountPaid: order.amountPaid,
          paymentStatus: order.paymentStatus,
        } : null,
        transaction: transaction ? {
          id: transaction._id,
          userId: transaction.userId,
          vendorId: transaction.vendorId,
          amountPaid: transaction.amountPaid,
          paymentStatus: transaction.paymentStatus,
          createdAt: transaction.createdAt,
        } : null,
        tracking: tracking ? {
          status: tracking.status,
        } : null,
      },
      message: transaction
        ? "✅ Payment was processed successfully"
        : "❌ Payment was NOT processed - webhook may not have been triggered",
    });
  } catch (error) {
    console.error("Verification error:", error);
    return res.status(500).json({ error: error.message });
  }
};
