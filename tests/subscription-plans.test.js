import test from "node:test";
import assert from "node:assert/strict";

import {
  formatPlanForUser,
  getSubscriptionProvider,
  normalizePlanBenefits,
} from "../src/modules/subscription/services/subscriptionPlan.service.js";

test("plan benefits accept one to seven unique checklist items", () => {
  assert.deepEqual(
    normalizePlanBenefits([" Priority support ", "Advanced analytics"], { required: true }),
    ["Priority support", "Advanced analytics"]
  );

  assert.equal(
    normalizePlanBenefits(["One", "Two", "Three", "Four", "Five", "Six", "Seven"]).length,
    7
  );
});

test("plan benefits reject missing, duplicate, empty, and excessive items", () => {
  assert.throws(
    () => normalizePlanBenefits(undefined, { required: true }),
    /benefits are required/
  );
  assert.throws(
    () => normalizePlanBenefits(["Priority support", "priority support"]),
    /duplicates/
  );
  assert.throws(() => normalizePlanBenefits([""]), /empty items/);
  assert.throws(
    () => normalizePlanBenefits(["1", "2", "3", "4", "5", "6", "7", "8"]),
    /at most 7/
  );
});

test("subscription provider uses Paystack for Nigeria and Stripe elsewhere", () => {
  assert.equal(getSubscriptionProvider("Nigeria"), "paystack");
  assert.equal(getSubscriptionProvider("NG"), "paystack");
  assert.equal(getSubscriptionProvider("United States"), "stripe");
  assert.equal(getSubscriptionProvider("United Kingdom"), "stripe");
});

test("Nigerian plan presentation returns NGN, Paystack, and benefits", () => {
  const result = formatPlanForUser({
    plan: {
      _id: "plan-1",
      name: "Premium",
      amount: 15000,
      duration: "monthly",
      benefits: ["Priority support", "Analytics"],
    },
    provider: "paystack",
  });

  assert.equal(result.displayCurrency, "NGN");
  assert.equal(result.displayAmount, 15000);
  assert.equal(result.paymentProvider, "paystack");
  assert.equal(result.benefitCount, 2);
});

test("international plan presentation converts NGN to USD for Stripe", () => {
  const result = formatPlanForUser({
    plan: {
      _id: "plan-1",
      name: "Premium",
      amount: 15000,
      duration: "monthly",
      benefits: ["Priority support"],
    },
    provider: "stripe",
    exchangeRate: 1500,
  });

  assert.equal(result.baseCurrency, "NGN");
  assert.equal(result.displayCurrency, "USD");
  assert.equal(result.displayAmount, 10);
  assert.equal(result.exchangeRate, 1500);
  assert.equal(result.paymentProvider, "stripe");
});
