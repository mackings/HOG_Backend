import { Router } from 'express';
import {
  rateVendor,
  getVendorRating,
  deleteVendorRating
} from '../controller/rate.controller.js';
import { isAuth } from '../../../middlewares/auth.middleware.js';
import { userCheckRole } from '../../../middlewares/checkRole.middleware.js';

const router = Router();

router.use(isAuth); 
router.use(userCheckRole(["user", "admin", "tailor"]));
router.post('/rate/:vendorId', rateVendor);
router.get('/rate', getVendorRating);
router.delete('/rate', deleteVendorRating);

export default router;