import { Router } from 'express';
import { createDeliveryRate, getDeliveryRates, updateDeliveryRate, deleteDeliveryRate,
    deliveryCost
 } from '../controller/deliveryRate.controller.js';
import { isAuth } from '../../../middlewares/auth.middleware.js';
import { userCheckRole } from '../../../middlewares/checkRole.middleware.js';


const router = Router();

// Public routes (all authenticated users can access)
router.use(isAuth);
router.get("/getDeliveryRates", getDeliveryRates);
router.post("/deliveryCost/:reviewId", deliveryCost);

// Admin-only routes
router.use(userCheckRole(["superAdmin", "admin"]));
router.post("/createDeliveryRate", createDeliveryRate);
router.put("/updateDeliveryRate/:id", updateDeliveryRate);
router.delete("/deleteDeliveryRate/:id", deleteDeliveryRate);


export default router;