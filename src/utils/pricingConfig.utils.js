import PricingConfig from "../modules/pricing/model/pricingConfig.model.js";

export const DEFAULT_QUOTATION_TAX_RATE = 0.1;
export const DEFAULT_VAT_RATE = 0.1;

export const normalizeRateInput = (value, fallbackRate) => {
  if (value === undefined || value === null || value === "") return fallbackRate;

  const numeric = Number(value);
  if (Number.isNaN(numeric) || numeric < 0) {
    throw new Error("Rate must be a non-negative number");
  }

  // Accept either decimal (0.1) or percentage (10)
  if (numeric <= 1) return numeric;
  if (numeric <= 100) return numeric / 100;
  throw new Error("Rate must be between 0-1 or 0-100");
};

export const toPercent = (rate) => Math.round((Number(rate) || 0) * 10000) / 100;

export const getPricingRates = async () => {
  const config = await PricingConfig.findOne({ key: "default" }).lean();
  const quotationTaxRate = config?.quotationTaxRate ?? DEFAULT_QUOTATION_TAX_RATE;
  const vatRate = config?.vatRate ?? DEFAULT_VAT_RATE;

  return {
    quotationTaxRate,
    vatRate,
    quotationTaxPercent: toPercent(quotationTaxRate),
    vatPercent: toPercent(vatRate),
  };
};

