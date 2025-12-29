import { Router } from 'express';
import { createBankAccount, getBankAccount, updateBankAccount, verifyingBankAccount,
    transferToBankAccount
 } from '../controller/bank.controller.js';
import { isAuth } from '../../../middlewares/auth.middleware.js';
import { userCheckRole } from '../../../middlewares/checkRole.middleware.js';


const router = Router();

router.use(isAuth);
router.use(userCheckRole(["tailor", "user", "admin", "superAdmin"]));
router.post('/create', createBankAccount);
router.get('/account', getBankAccount);
router.put('/account/:bankId', updateBankAccount);
router.post('/verify', verifyingBankAccount);
router.post('/transfer/:bankId', transferToBankAccount);


export default router;