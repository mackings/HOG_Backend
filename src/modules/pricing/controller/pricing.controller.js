import PricingConfig from "../model/pricingConfig.model.js";
import {
  DEFAULT_QUOTATION_TAX_RATE,
  DEFAULT_COMMISSION_RATE,
  DEFAULT_VAT_RATE,
  normalizeRateInput,
  toPercent,
} from "../../../utils/pricingConfig.utils.js";

export const getPricingConfig = async (req, res, next) => {
  try {
    const config = await PricingConfig.findOne({ key: "default" }).lean();

    const quotationTaxRate = config?.quotationTaxRate ?? DEFAULT_QUOTATION_TAX_RATE;
    const commissionRate   = config?.commissionRate   ?? DEFAULT_COMMISSION_RATE;
    const vatRate          = config?.vatRate          ?? DEFAULT_VAT_RATE;

    return res.status(200).json({
      success: true,
      message: "Pricing configuration fetched successfully",
      data: {
        quotationTaxRate,
        commissionRate,
        vatRate,
        quotationTaxPercent: toPercent(quotationTaxRate),
        commissionPercent:   toPercent(commissionRate),
        vatPercent:          toPercent(vatRate),
        updatedAt: config?.updatedAt || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const upsertPricingConfig = async (req, res, next) => {
  try {
    const {
      quotationTaxRate, quotationTaxPercent,
      commissionRate,   commissionPercent,
      vatRate,          vatPercent,
    } = req.body;

    const normalizedTaxRate        = normalizeRateInput(quotationTaxRate ?? quotationTaxPercent, DEFAULT_QUOTATION_TAX_RATE);
    const normalizedCommissionRate = normalizeRateInput(commissionRate   ?? commissionPercent,   DEFAULT_COMMISSION_RATE);
    const normalizedVatRate        = normalizeRateInput(vatRate          ?? vatPercent,          DEFAULT_VAT_RATE);

    const config = await PricingConfig.findOneAndUpdate(
      { key: "default" },
      {
        quotationTaxRate: normalizedTaxRate,
        commissionRate:   normalizedCommissionRate,
        vatRate:          normalizedVatRate,
        updatedBy: req.user?._id,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({
      success: true,
      message: "Pricing configuration updated successfully",
      data: {
        quotationTaxRate: config.quotationTaxRate,
        commissionRate:   config.commissionRate,
        vatRate:          config.vatRate,
        quotationTaxPercent: toPercent(config.quotationTaxRate),
        commissionPercent:   toPercent(config.commissionRate),
        vatPercent:          toPercent(config.vatRate),
        updatedAt: config.updatedAt,
      },
    });
  } catch (error) {
    if (error.message?.includes("Rate must be")) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

