import { Router } from 'express';
import { 
  rateVendor,
  getVendorRating,
  deleteVendorRating
} from '../controller/rate.controller';
import { isAuth } from '../../../middlewares/auth.middleware';
import { userCheckRole } from '../../../middlewares/checkRole.middleware';

const router = Router();

router.use(isAuth); 
router.use(userCheckRole(["user", "admin", "tailor"]));
router.post('/rate/:vendorId', rateVendor);
router.get('/rate', getVendorRating);
router.delete('/rate', deleteVendorRating);

export default router;