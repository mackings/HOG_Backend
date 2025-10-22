import { Router } from 'express';
import { createDeliveryRate, getDeliveryRates, updateDeliveryRate, deleteDeliveryRate,
    deliveryCost
 } from '../controller/deliveryRate.controller';
import { isAuth } from '../../../middlewares/auth.middleware';
import { userCheckRole } from '../../../middlewares/checkRole.middleware';


const router = Router();

router.use(isAuth);
router.use(userCheckRole(["superAdmin", "admin",]));
router.post("/createDeliveryRate", createDeliveryRate);
router.get("/getDeliveryRates", getDeliveryRates);
router.put("/updateDeliveryRate/:id", updateDeliveryRate);
router.delete("/deleteDeliveryRate/:id", deleteDeliveryRate);
router.post("/deliveryCost/:reviewId", deliveryCost);


export default router;