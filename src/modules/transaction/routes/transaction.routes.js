import { Router } from 'express';
import { getAllTransactions, getSingleTransaction, deleteTransaction } from '../controller/transaction.controller.js';
import { isAuth } from '../../../middlewares/auth.middleware.js';
import { userCheckRole } from '../../../middlewares/checkRole.middleware.js';


const router = Router();

router.use(isAuth);
router.use(userCheckRole(["user", "tailor"]));
router.get('/transactions', getAllTransactions);
router.get('/single', getSingleTransaction);
router.delete('/delete', deleteTransaction);


export default router;