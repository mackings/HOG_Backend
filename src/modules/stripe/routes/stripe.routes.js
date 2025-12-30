import { Router } from 'express';
import { createUserAccount, createStripePayment, makeStripeTransfer, getStripeAccountStatus, verifyPaymentProcessing  } from '../controller/stripe.controller.js';
import { isAuth } from '../../../middlewares/auth.middleware.js';
import { imageUpload, imageKitUpload } from '../../../utils/imagekit.js';


const router = Router();

router.use(isAuth);
router.post("/create-account", createUserAccount);
router.post("/make-payment/:reviewId", createStripePayment);
router.post("/make-stripe-transfer", makeStripeTransfer);
router.get("/get-stripe-account-status", getStripeAccountStatus);
router.get("/verify-payment/:paymentReference", verifyPaymentProcessing);



export default router;
