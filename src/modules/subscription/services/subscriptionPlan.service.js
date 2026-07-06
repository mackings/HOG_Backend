export const MAX_PLAN_BENEFITS = 20;
export const TRIAL_PLAN = "premium";
export const TRIAL_DAYS = 7;

// Numeric rank for plan tier comparison (higher = more features)
export const PLAN_ORDER = {
  starter: 0,
  free: 0,
  standard: 1,
  premium: 2,
  elite: 3,
  enterprise: 4,
};

// Commission rates per plan (percentage, e.g. 15 = 15%)
export const PLAN_COMMISSION_RATES = {
  starter: 15,
  free: 15,
  standard: 15,
  premium: 12,
  elite: 8,
  enterprise: 8,
};

// Max active regular listings per plan (null = unlimited)
export const PLAN_LISTING_LIMITS = {
  starter: 10,
  free: 10,
  standard: 10,
  premium: 50,
  elite: null,
  enterprise: null,
};

// Max active pre-loved listings per plan (null = unlimited)
export const PLAN_PRELOVE_LIMITS = {
  starter: 3,
  free: 3,
  standard: 3,
  premium: 20,
  elite: null,
  enterprise: null,
};

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
  if (normalized.some((benefit) => benefit.length > 200)) {
    throw new Error("Each plan benefit must be 200 characters or fewer");
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

export const isUKCountry = (country) => {
  const value = String(country || "").trim().toLowerCase();
  return ["united kingdom", "uk", "gb", "great britain", "england", "scotland", "wales", "northern ireland"].includes(value);
};

/** Returns the effective plan key for a user, accounting for active trial */
export const getEffectivePlan = (user) => {
  if (
    user?.isOnTrial &&
    user?.trialEndsAt &&
    new Date(user.trialEndsAt) > new Date()
  ) {
    return user.trialPlan || TRIAL_PLAN;
  }
  return user?.subscriptionPlan || "starter";
};

export const getCommissionRate = (user) => {
  const plan = getEffectivePlan(user);
  return plan in PLAN_COMMISSION_RATES ? PLAN_COMMISSION_RATES[plan] : 15;
};

export const getListingLimit = (user) => {
  const plan = getEffectivePlan(user);
  return plan in PLAN_LISTING_LIMITS ? PLAN_LISTING_LIMITS[plan] : 10;
};

export const getPreLoveLimit = (user) => {
  const plan = getEffectivePlan(user);
  return plan in PLAN_PRELOVE_LIMITS ? PLAN_PRELOVE_LIMITS[plan] : 3;
};

export const formatPlanForUser = ({ plan, provider, exchangeRate, userCountry }) => {
  const base = plan?.toObject ? plan.toObject() : plan;
  const benefits = Array.isArray(base?.benefits) ? base.benefits : [];

  const commonFields = {
    ...base,
    benefits,
    benefitCount: benefits.length,
    baseCurrency: "NGN",
    commissionRate: base.commissionRate ?? 15,
    listingLimit: base.listingLimit ?? null,
    preLoveListingLimit: base.preLoveListingLimit ?? null,
  };

  if (provider === "paystack") {
    return {
      ...commonFields,
      displayCurrency: "NGN",
      displayAmount: Number(base.amount),
      paymentProvider: "paystack",
    };
  }

  // UK users: show GBP if gbpAmount is set on the plan
  if (isUKCountry(userCountry) && base.gbpAmount != null && base.gbpAmount > 0) {
    return {
      ...commonFields,
      displayCurrency: "GBP",
      displayAmount: Number(base.gbpAmount),
      paymentProvider: "stripe",
    };
  }

  // All other international users: convert NGN → USD
  const displayAmount = exchangeRate
    ? Math.round((Number(base.amount) / exchangeRate) * 100) / 100
    : 0;

  return {
    ...commonFields,
    displayCurrency: "USD",
    displayAmount,
    exchangeRate,
    paymentProvider: "stripe",
  };
};
