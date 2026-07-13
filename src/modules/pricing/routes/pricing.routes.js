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

// Finance role can also set billing rates alongside admin/superAdmin
router.use(userCheckRole(["admin", "superAdmin", "finance"]));
router.put("/updatePricingConfig", upsertPricingConfig);

export default router;

