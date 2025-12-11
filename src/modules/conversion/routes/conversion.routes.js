import { Router } from 'express';
import { nairaExchangeRate, convertCurrency } from '../controller/conversion.controller';
import { isAuth } from '../../../middlewares/auth.middleware';
import { userCheckRole } from '../../../middlewares/checkRole.middleware';


const router = Router();

router.use(isAuth);
// router.use(userCheckRole(["superAdmin", "admin",]));
router.get('/naira-exchange-rate', nairaExchangeRate);
router.post('/convert-currency', convertCurrency);


export default router;