import { Router } from 'express';
import { getAllTransactions, getSingleTransaction, deleteTransaction } from '../controller/transaction.controller';
import { isAuth } from '../../../middlewares/auth.middleware';
import { userCheckRole } from '../../../middlewares/checkRole.middleware';


const router = Router();

router.use(isAuth);
router.use(userCheckRole(["user", "tailor"]));
router.get('/transactions', getAllTransactions);
router.get('/single', getSingleTransaction);
router.delete('/delete', deleteTransaction);


export default router;