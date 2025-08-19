import { Router } from 'express';
import { subscriptionPayments } from '../controller/subscription.controller.js';
import { isAuth } from '../../../middlewares/auth.middleware';
import { userCheckRole } from '../../../middlewares/checkRole.middleware';


const router = Router();

router.use(isAuth);
router.use(userCheckRole(["tailor"]));
router.post("/subscriptionPayments", subscriptionPayments);


export default router;