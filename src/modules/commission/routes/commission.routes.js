import { Router } from 'express';
import { createFee, getFee } from '../controller/commission.controller.js';
import { isAuth } from '../../../middlewares/auth.middleware.js';
import { userCheckRole } from '../../../middlewares/checkRole.middleware.js';


const router = Router();

router.use(isAuth);
router.use(userCheckRole(["superAdmin", "admin",]));
router.post('/create', createFee);
router.get('/getCommission', getFee);

export default router;