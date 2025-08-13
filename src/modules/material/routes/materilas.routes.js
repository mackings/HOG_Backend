import { Router } from 'express';
import { createMaterial, getAllMaterials, getMaterialById, updateMaterial, deleteMaterial
  } from '../controller/material.controller';
import { isAuth } from '../../../middlewares/auth.middleware';
const { imageUpload, imageKitUpload} = require('../../../utils/imagekit');


const router = Router();

router.use(isAuth);
router.post("/createMaterial", imageUpload, imageKitUpload, createMaterial);
router.get("/getAllMaterials", getAllMaterials);
router.get("/getMaterialById", getMaterialById);
router.put("/updateMaterial/:materialId", imageUpload, imageKitUpload, updateMaterial);
router.delete("/deleteMaterial", deleteMaterial);




export default router;