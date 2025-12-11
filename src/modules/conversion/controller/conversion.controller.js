import axios from "axios";




export const nairaExchangeRate = async (req, res, next) => {
  try {
    const {amount, currency} = req.query;

    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ message: "Invalid or missing amount" });
    }

    if (!currency || typeof currency !== "string" || currency.trim().length !== 3) {
      return res.status(400).json({ message: "Valid 3-letter currency code is required (e.g., NGN)" });
    }

    const response = await axios.get(`https://api.exchangerate-api.com/v4/latest/NGN`);
    const usdRate = response?.data?.rates?.[currency.toUpperCase()];

    if (!usdRate) {
      return res.status(400).json({ message: `Exchange rate for currency "${currency}" not found` });
    }

    // Convert and round to 2 decimal places
    const convertedAmount = Math.round(amount * usdRate * 100) / 100;

    return res.status(200).json({
      message: `Exchange rate retrieved successfully`,
      baseCurrency: "NGN",
      targetCurrency: currency.toUpperCase(),
      exchangeRate: usdRate,
      originalAmount: amount,
      convertedAmount
    });
  } catch (error) {
    next(error);
  }
};


export const convertCurrency = async (req, res, next) => {
  try {
    const { amount, fromCurrency, toCurrency } = req.body;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ message: "Invalid or missing amount" });
    }

    if (!fromCurrency || typeof fromCurrency !== "string" || fromCurrency.trim().length !== 3) {
      return res.status(400).json({ message: "Valid 3-letter fromCurrency code is required (e.g., USD)" });
    }
    if (!toCurrency || typeof toCurrency !== "string" || toCurrency.trim().length !== 3){
      return res.status(400).json({ message: "Valid 3-letter toCurrency code is required (e.g., NGN)" });
    }

    const apiKey = process.env.EXCHANGE_RATE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ message: "Exchange Rate API key is missing in environment variables" });
    }

    const apiUrl = `https://v6.exchangerate-api.com/v6/${apiKey}/pair/${fromCurrency.toUpperCase()}/${toCurrency.toUpperCase()}`;

    const response = await axios.get(apiUrl);

    if (response?.data?.result !== "success" || !response?.data?.conversion_rate) {
      return res.status(400).json({ message: "Failed to retrieve valid conversion rate" });
    }

    const conversionRate = response.data.conversion_rate;
    const convertedAmount = Math.round(parsedAmount * conversionRate * 100) / 100;

    return res.status(200).json({
      message: "Exchange rate retrieved successfully",
      fromCurrency: fromCurrency.toUpperCase(),
      toCurrency: toCurrency.toUpperCase(),
      exchangeRate: conversionRate,
      originalAmount: parsedAmount,
      convertedAmount
    });

  } catch (error) {
    next(error);
  }
};