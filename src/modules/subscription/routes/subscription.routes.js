import { Router } from "express";
import {
  subscriptionPayments,
  verifySubscriptionPayment,
  activateTrial,
  cancelSubscription,
  scheduleDowngrade,
  getMySubscription,
  createSubscriptionPlan,
  getSubscriptionPlans,
  getSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  seedDefaultPlans,
  getSubscribers,
  adminSetUserPlan,
} from "../controller/subscription.controller.js";
import { isAuth } from "../../../middlewares/auth.middleware.js";
import { userCheckRole } from "../../../middlewares/checkRole.middleware.js";

const router = Router();

router.use(isAuth);

// ── Designer / User ──────────────────────────────────────────────────────────
router.post("/subscriptionPayments", userCheckRole(["user", "tailor"]), subscriptionPayments);
router.post("/activateTrial", userCheckRole(["tailor"]), activateTrial);
router.post("/cancelSubscription", userCheckRole(["user", "tailor"]), cancelSubscription);
router.post("/scheduleDowngrade", userCheckRole(["user", "tailor"]), scheduleDowngrade);

// ── Shared read ───────────────────────────────────────────────────────────────
router.use(userCheckRole(["user", "tailor", "admin", "superAdmin"]));
router.get("/getSubscriptionPlans", getSubscriptionPlans);
router.get("/getSubscriptionPlan/:id", getSubscriptionPlan);
router.get("/verifySubscriptionPayment/:paymentReference", verifySubscriptionPayment);
router.get("/mySubscription", getMySubscription);

// ── Admin ─────────────────────────────────────────────────────────────────────
router.use(userCheckRole(["admin", "superAdmin"]));
router.post("/createSubscriptionPlan", createSubscriptionPlan);
router.put("/updateSubscriptionPlan/:id", updateSubscriptionPlan);
router.delete("/deleteSubscriptionPlan/:id", deleteSubscriptionPlan);
router.post("/seedDefaultPlans", seedDefaultPlans);
router.get("/subscribers", getSubscribers);
router.put("/users/:userId/plan", adminSetUserPlan);

export default router;
