import { Router } from "express";
import { isAuth } from "../../../middlewares/auth.middleware.js";
import { userCheckRole } from "../../../middlewares/checkRole.middleware.js";
import { createDesignerReview, getDesignerReviews, respondToDesignerReview } from "../controller/reputation.controller.js";

const router = Router();

router.use(isAuth);
router.post("/designer-reviews", userCheckRole(["user", "admin"]), createDesignerReview);
router.post("/designer-reviews/:reviewId/respond", userCheckRole(["tailor", "admin"]), respondToDesignerReview);
router.get("/designers/:designerId/reviews", userCheckRole(["user", "tailor", "admin"]), getDesignerReviews);

export default router;

