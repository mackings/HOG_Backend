import { Router } from "express";
import { isAuth } from "../../../middlewares/auth.middleware.js";
import { userCheckRole } from "../../../middlewares/checkRole.middleware.js";
import { requirePlan } from "../../../middlewares/subscriptionAccess.middleware.js";
import { featureListing, getDesignerAnalytics } from "../controller/designerTools.controller.js";

const router = Router();

router.use(isAuth);
router.use(userCheckRole(["tailor", "admin"]));
// Analytics and listing promotion are Premium+ features
router.get("/analytics", requirePlan("premium"), getDesignerAnalytics);
router.put("/listings/:listingId/feature", requirePlan("premium"), featureListing);

export default router;

