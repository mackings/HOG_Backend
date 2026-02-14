import { Router } from 'express';
import { subscriptionPayments, createSubscriptionPlan, getSubscriptionPlans, getSubscriptionPlan, 
    updateSubscriptionPlan, deleteSubscriptionPlan, verifySubscriptionPayment } from '../controller/subscription.controller.js';
import { isAuth } from '../../../middlewares/auth.middleware.js';
import { userCheckRole } from '../../../middlewares/checkRole.middleware.js';


const router = Router();

router.use(isAuth);

// Tailor subscription payment endpoints
router.use("/subscriptionPayments", userCheckRole(["tailor"]));
router.post("/subscriptionPayments", subscriptionPayments);

// Shared read endpoints
router.use(userCheckRole(["tailor", "admin", "superAdmin"]));
router.get("/getSubscriptionPlans", getSubscriptionPlans);
router.get("/getSubscriptionPlan/:id", getSubscriptionPlan);
router.get("/verifySubscriptionPayment/:paymentReference", verifySubscriptionPayment);

// Admin management endpoints
router.use(userCheckRole(["admin", "superAdmin"]));
router.post("/createSubscriptionPlan", createSubscriptionPlan);
router.put("/updateSubscriptionPlan/:id", updateSubscriptionPlan);
router.delete("/deleteSubscriptionPlan/:id", deleteSubscriptionPlan);


export default router;
