import { Router } from 'express';
import { createTailor, getTailor, updateTailor, deleteTailor, getAllAssignedMaterials, updateMaterialPrice
  } from '../controller/vendor.controller';
import { isAuth } from '../../../middlewares/auth.middleware';
import { userCheckRole } from '../../../middlewares/checkRole.middleware'
import { imageUpload, imageKitUpload } from '../../../utils/imagekit';


const router = Router();

router.use(isAuth);
router.use(userCheckRole(['tailor']));
router.post('/createTailor', imageUpload, imageKitUpload, createTailor);
router.get('/getTailor', getTailor);
router.put('/updateTailor/:tailorId', updateTailor);
router.delete('/deleteTailor/:tailorId', deleteTailor);
router.get('/getAllAssignedMaterials', getAllAssignedMaterials);
router.put('/updateMaterialPrice/:materialId', updateMaterialPrice);


export default router;