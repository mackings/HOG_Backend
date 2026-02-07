import { Router } from "express";
import {
  getPricingConfig,
  upsertPricingConfig,
} from "../controller/pricing.controller.js";
import { isAuth } from "../../../middlewares/auth.middleware.js";
import { userCheckRole } from "../../../middlewares/checkRole.middleware.js";

const router = Router();

router.use(isAuth);
router.get("/getPricingConfig", getPricingConfig);

router.use(userCheckRole(["admin", "superAdmin"]));
router.put("/updatePricingConfig", upsertPricingConfig);

export default router;

