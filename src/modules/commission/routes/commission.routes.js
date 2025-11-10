import { Router } from 'express';
import { createFee, getFee } from '../controller/commission.controller';
import { isAuth } from '../../../middlewares/auth.middleware';
import { userCheckRole } from '../../../middlewares/checkRole.middleware';


const router = Router();

router.use(isAuth);
router.use(userCheckRole(["superAdmin", "admin",]));
router.post('/create', createFee);
router.get('/getCommission', getFee);

export default router;