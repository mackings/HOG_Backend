import { Router } from "express";
import { isAuth } from "../../../middlewares/auth.middleware.js";
import { userCheckRole } from "../../../middlewares/checkRole.middleware.js";
import { featureListing, getDesignerAnalytics } from "../controller/designerTools.controller.js";

const router = Router();

router.use(isAuth);
router.use(userCheckRole(["tailor", "admin"]));
router.get("/analytics", getDesignerAnalytics);
router.put("/listings/:listingId/feature", featureListing);

export default router;

