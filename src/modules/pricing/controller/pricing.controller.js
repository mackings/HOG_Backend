import PricingConfig from "../model/pricingConfig.model.js";
import {
  DEFAULT_QUOTATION_TAX_RATE,
  DEFAULT_VAT_RATE,
  normalizeRateInput,
  toPercent,
} from "../../../utils/pricingConfig.utils.js";

export const getPricingConfig = async (req, res, next) => {
  try {
    const config = await PricingConfig.findOne({ key: "default" }).lean();

    const quotationTaxRate = config?.quotationTaxRate ?? DEFAULT_QUOTATION_TAX_RATE;
    const vatRate = config?.vatRate ?? DEFAULT_VAT_RATE;

    return res.status(200).json({
      success: true,
      message: "Pricing configuration fetched successfully",
      data: {
        quotationTaxRate,
        vatRate,
        quotationTaxPercent: toPercent(quotationTaxRate),
        vatPercent: toPercent(vatRate),
        updatedAt: config?.updatedAt || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const upsertPricingConfig = async (req, res, next) => {
  try {
    const { quotationTaxRate, quotationTaxPercent, vatRate, vatPercent } = req.body;

    const normalizedQuotationTaxRate = normalizeRateInput(
      quotationTaxRate ?? quotationTaxPercent,
      DEFAULT_QUOTATION_TAX_RATE
    );
    const normalizedVatRate = normalizeRateInput(
      vatRate ?? vatPercent,
      DEFAULT_VAT_RATE
    );

    const config = await PricingConfig.findOneAndUpdate(
      { key: "default" },
      {
        quotationTaxRate: normalizedQuotationTaxRate,
        vatRate: normalizedVatRate,
        updatedBy: req.user?._id,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({
      success: true,
      message: "Pricing configuration updated successfully",
      data: {
        quotationTaxRate: config.quotationTaxRate,
        vatRate: config.vatRate,
        quotationTaxPercent: toPercent(config.quotationTaxRate),
        vatPercent: toPercent(config.vatRate),
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

