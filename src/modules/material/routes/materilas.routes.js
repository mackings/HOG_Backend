import { Router } from 'express';
import { createMaterial, getAllMaterials, getMaterialById, updateMaterial, deleteMaterial
  } from '../controller/material.controller';
import { isAuth } from '../../../middlewares/auth.middleware';
const { multipleImageUpload, multipleImageKitUpload} = require('../../../utils/imagekit');


const router = Router();

router.use(isAuth);
router.post("/createMaterial", multipleImageUpload, multipleImageKitUpload, createMaterial);
router.get("/getAllMaterials", getAllMaterials);
router.get("/getMaterialById", getMaterialById);
router.put("/updateMaterial/:materialId", multipleImageUpload, multipleImageKitUpload, updateMaterial);
router.delete("/deleteMaterial", deleteMaterial);




export default router;