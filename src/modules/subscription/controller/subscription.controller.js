import User from '../../user/model/user.model.js';
import InitializedOrder from '../../material/model/InitializedOrder.model.js';
import axios from "axios";
import crypto from "crypto"

export const subscriptionPayments = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { plan, amount, billTerm } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Available subscription plans
    const subscriptionPlans = {
      Standard: ["monthly", "yearly", "quarterly"],
      Premium: ["monthly", "yearly", "quarterly"],
      Enterprise: ["monthly", "yearly", "quarterly"],
    };

    // Validate plan
    if (!subscriptionPlans[plan]) {
      return res.status(400).json({ message: "Invalid subscription plan" });
    }

    // Validate billing term
    if (!subscriptionPlans[plan].includes(billTerm)) {
      return res.status(400).json({ message: "Invalid billing term for selected plan" });
    }

    // Subscription duration based on billing term
    const startDate = new Date();
    let endDate = new Date(startDate);

    if (billTerm === "monthly") {
      endDate.setMonth(endDate.getMonth() + 1);
    } else if (billTerm === "quarterly") {
      endDate.setMonth(endDate.getMonth() + 3);
    } else if (billTerm === "yearly") {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    const reference = crypto.randomBytes(5).toString("hex");

    const initializedData = await InitializedOrder.create({
      userId: user._id,
      totalAmount: amount,
      paymentMethod: "Paystack",
      paymentReference: reference,
      subscriptionStartDate: startDate,
      subscriptionEndDate: endDate,
      billTerm,
      plan,
    });

    // Paystack payment initialization
    const paystackUrl = "https://api.paystack.co/transaction/initialize";
    const paystackResponse = await axios.post(
      paystackUrl,
      {
        email: user.email,
        amount: amount * 100, // Paystack requires kobo
        currency: "NGN",
        reference: reference,
        callback_url: `${process.env.FRONTEND_URL}/payment-success`,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_MAIN_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (paystackResponse.status === 200) {
      return res.status(201).json({
        success: true,
        message: "Subscription payment initialized successfully",
        authorizationUrl: paystackResponse.data.data.authorization_url,
        data: initializedData,
      });
    } else {
      await InitializedOrder.findByIdAndDelete(initializedData._id);
      return res.status(400).json({
        success: false,
        message: "Payment initialization failed",
        error: paystackResponse.data.message,
      });
    }
  } catch (error) {
    next(error);
  }
};

            


        



   