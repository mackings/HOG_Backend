import { Router } from 'express';
import { createTailor, getTailor, updateTailor 
  } from '../controller/vendor.controller';
import { isAuth } from '../../../middlewares/auth.middleware';
const { imageUpload, imageKitUpload} = require('../../../utils/imagekit');


const router = Router();

router.use(isAuth);
router.post('/createTailor', createTailor);
router.get('/getTailor', getTailor);
router.put('/updateTailor/:tailorId', updateTailor);

export default router;