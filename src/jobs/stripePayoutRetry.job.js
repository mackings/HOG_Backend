import Stripe from "stripe";
import StripePayoutRetry from "../modules/stripe/model/stripePayoutRetry.model.js";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" })
  : null;

const MAX_ATTEMPTS = Number(process.env.STRIPE_PAYOUT_RETRY_MAX_ATTEMPTS || 10);
const BASE_DELAY_MINUTES = Number(process.env.STRIPE_PAYOUT_RETRY_BASE_MINUTES || 5);
const MAX_DELAY_MINUTES = Number(process.env.STRIPE_PAYOUT_RETRY_MAX_MINUTES || 60);

const computeNextAttempt = (attempts) => {
  const delay = Math.min(MAX_DELAY_MINUTES, BASE_DELAY_MINUTES * Math.pow(2, attempts));
  return new Date(Date.now() + delay * 60 * 1000);
};

const processPayout = async (payout) => {
  if (!stripe) {
    throw new Error("Stripe not configured");
  }

  const idempotencyKey = `payout_retry_${payout._id}`;
  const transfer = await stripe.transfers.create(
    {
      amount: Math.round(payout.amount * 100),
      currency: payout.currency,
      destination: payout.stripeAccountId,
      transfer_group: payout.paymentReference,
      description: `Retry payout for ${payout.paymentReference}`,
      metadata: {
        payoutId: payout._id.toString(),
        paymentReference: payout.paymentReference,
        reviewId: payout.reviewId.toString(),
        orderId: payout.orderId.toString(),
      },
    },
    { idempotencyKey }
  );

  await StripePayoutRetry.findByIdAndUpdate(payout._id, {
    $set: {
      status: "succeeded",
      stripeTransferId: transfer.id,
      lastError: "",
    },
  });
};

const processBatch = async () => {
  const now = new Date();
  const pending = await StripePayoutRetry.find({
    status: { $in: ["pending", "retry"] },
    nextAttemptAt: { $lte: now },
    attempts: { $lt: MAX_ATTEMPTS },
  })
    .sort({ nextAttemptAt: 1 })
    .limit(10);

  for (const payout of pending) {
    const locked = await StripePayoutRetry.findOneAndUpdate(
      { _id: payout._id, status: { $in: ["pending", "retry"] } },
      { $set: { status: "processing" } },
      { new: true }
    );
    if (!locked) continue;

    try {
      await processPayout(locked);
      console.log(`✅ Stripe payout retry succeeded: ${locked.paymentReference}`);
    } catch (error) {
      const attempts = (locked.attempts || 0) + 1;
      const nextAttemptAt = computeNextAttempt(attempts);
      await StripePayoutRetry.findByIdAndUpdate(locked._id, {
        $set: {
          status: attempts >= MAX_ATTEMPTS ? "failed" : "retry",
          nextAttemptAt,
          lastError: error.message || "Retry failed",
          attempts,
        },
      });
      console.log(`⚠️ Stripe payout retry failed: ${locked.paymentReference} (${attempts}/${MAX_ATTEMPTS})`);
    }
  }
};

export const startStripePayoutRetryJob = () => {
  const intervalMs = Number(process.env.STRIPE_PAYOUT_RETRY_INTERVAL_MS || 60_000);
  setInterval(() => {
    processBatch().catch((error) => {
      console.error("❌ Stripe payout retry job error:", error.message);
    });
  }, intervalMs);
};
