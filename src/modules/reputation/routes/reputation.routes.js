import { Router } from "express";
import { isAuth } from "../../../middlewares/auth.middleware.js";
import { userCheckRole } from "../../../middlewares/checkRole.middleware.js";
import {
  createDesignerReview,
  createDesignerReviewFromOrder,
  getDesignerReviews,
  getReviewableOrders,
  respondToDesignerReview,
} from "../controller/reputation.controller.js";

const router = Router();

router.use(isAuth);
router.get("/reviewable-orders", userCheckRole(["user", "admin"]), getReviewableOrders);
router.post("/designer-reviews", userCheckRole(["user", "admin"]), createDesignerReview);
router.post("/reviewable-orders/:reviewTargetId/review", userCheckRole(["user", "admin"]), createDesignerReviewFromOrder);
router.post("/designer-reviews/:reviewId/respond", userCheckRole(["tailor", "admin"]), respondToDesignerReview);
router.get("/designers/:designerId/reviews", userCheckRole(["user", "tailor", "admin"]), getDesignerReviews);

export default router;
