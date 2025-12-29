import { Router } from 'express';
import { createTailor, getTailor, updateTailor, deleteTailor, getAllAssignedMaterials,
  } from '../controller/vendor.controller.js';
import { isAuth } from '../../../middlewares/auth.middleware.js';
import { userCheckRole } from '../../../middlewares/checkRole.middleware.js'
import { imageUpload, imageKitUpload } from '../../../utils/imagekit.js';


const router = Router();

router.use(isAuth);
router.use(userCheckRole(['tailor']));
router.post('/createTailor', imageUpload, imageKitUpload, createTailor);
router.get('/getTailor', getTailor);
router.put('/updateTailor/:tailorId', updateTailor);
router.delete('/deleteTailor/:tailorId', deleteTailor);
router.get('/getAllAssignedMaterials', getAllAssignedMaterials);


export default router;