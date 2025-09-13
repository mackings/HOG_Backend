import { Router } from 'express';
import { subscriptionPayments, createSubscriptionPlan, getSubscriptionPlans, getSubscriptionPlan, 
    updateSubscriptionPlan, deleteSubscriptionPlan } from '../controller/subscription.controller.js';
import { isAuth } from '../../../middlewares/auth.middleware';
import { userCheckRole } from '../../../middlewares/checkRole.middleware';


const router = Router();

router.use(isAuth);
router.use(userCheckRole(["tailor", "admin"]));
router.post("/subscriptionPayments", subscriptionPayments);
router.post("/createSubscriptionPlan", createSubscriptionPlan);
router.get("/getSubscriptionPlans", getSubscriptionPlans);
router.get("/getSubscriptionPlan/:id", getSubscriptionPlan);
router.put("/updateSubscriptionPlan/:id", updateSubscriptionPlan);
router.delete("/deleteSubscriptionPlan/:id", deleteSubscriptionPlan);


export default router;