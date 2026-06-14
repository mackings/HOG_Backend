export const MAX_PLAN_BENEFITS = 7;

export const normalizePlanBenefits = (benefits, { required = false } = {}) => {
  if (benefits === undefined) {
    if (required) throw new Error("Plan benefits are required");
    return undefined;
  }

  if (!Array.isArray(benefits)) {
    throw new Error("Plan benefits must be an array");
  }

  const normalized = benefits.map((benefit) => String(benefit || "").trim());
  if (normalized.some((benefit) => !benefit)) {
    throw new Error("Plan benefits cannot contain empty items");
  }
  if (normalized.length === 0 && required) {
    throw new Error("At least one plan benefit is required");
  }
  if (normalized.length > MAX_PLAN_BENEFITS) {
    throw new Error(`A plan can have at most ${MAX_PLAN_BENEFITS} benefits`);
  }
  if (normalized.some((benefit) => benefit.length > 160)) {
    throw new Error("Each plan benefit must be 160 characters or fewer");
  }

  const uniqueBenefits = new Set(normalized.map((benefit) => benefit.toLowerCase()));
  if (uniqueBenefits.size !== normalized.length) {
    throw new Error("Plan benefits cannot contain duplicates");
  }

  return normalized;
};

export const getSubscriptionProvider = (country) => {
  const value = String(country || "").trim().toLowerCase();
  return ["nigeria", "ng", "nigerian"].includes(value) ? "paystack" : "stripe";
};

export const formatPlanForUser = ({ plan, provider, exchangeRate }) => {
  const base = plan?.toObject ? plan.toObject() : plan;
  const benefits = Array.isArray(base?.benefits) ? base.benefits : [];

  if (provider === "paystack") {
    return {
      ...base,
      benefits,
      benefitCount: benefits.length,
      baseCurrency: "NGN",
      displayCurrency: "NGN",
      displayAmount: Number(base.amount),
      paymentProvider: "paystack",
    };
  }

  const displayAmount = Math.round((Number(base.amount) / exchangeRate) * 100) / 100;
  return {
    ...base,
    benefits,
    benefitCount: benefits.length,
    baseCurrency: "NGN",
    displayCurrency: "USD",
    displayAmount,
    exchangeRate,
    paymentProvider: "stripe",
  };
};
