import { Router } from 'express';
import { createMaterial, getAllMaterials, getMaterialById, updateMaterial, deleteMaterial, createPaymentOnline,
  createPartPaymentOnline, orderWebhook 
  } from '../controller/material.controller';
import { isAuth } from '../../../middlewares/auth.middleware';
const { multipleImageUpload, multipleImageKitUpload} = require('../../../utils/imagekit');
import { userCheckRole } from '../../../middlewares/checkRole.middleware';


const router = Router();

router.post("/orderWebhook", orderWebhook);
router.use(isAuth);
router.use(userCheckRole(["user", "admin"]));
router.post("/createMaterial", multipleImageUpload, multipleImageKitUpload, createMaterial);
router.get("/getAllMaterials", getAllMaterials);
router.get("/getMaterialById", getMaterialById);
router.put("/updateMaterial/:materialId", multipleImageUpload, multipleImageKitUpload, updateMaterial);
router.delete("/deleteMaterial", deleteMaterial);
router.post("/createPaymentOnline/:materialId", createPaymentOnline);
router.post("/createPartPaymentOnline/:materialId", createPartPaymentOnline);





export default router;