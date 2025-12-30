import { Router } from 'express';
import { createMaterial, getAllMaterials, getMaterialById, updateMaterial, deleteMaterial, createPaymentOnline,
  createPartPaymentOnline, orderWebhook, searchMaterials, getMaterialCategory, getVendorDetails, deleteAllMaterial
  } from '../controller/material.controller.js';
import { isAuth } from '../../../middlewares/auth.middleware.js';
import { imageUpload, imageKitUpload } from '../../../utils/imagekit.js';
import { userCheckRole } from '../../../middlewares/checkRole.middleware.js';


const router = Router();

router.post("/orderWebhook", orderWebhook);
router.delete("/deleteAllMaterial", deleteAllMaterial);
router.use(isAuth);
router.use(userCheckRole(["user", "admin", "tailor"]));
// Support both with and without categoryId
router.post("/createMaterial/:categoryId", imageUpload, imageKitUpload, createMaterial);
router.post("/createMaterial", imageUpload, imageKitUpload, createMaterial);
router.get("/getAllMaterials", getAllMaterials);
router.get("/getMaterialById", getMaterialById);
router.put("/updateMaterial/:materialId", imageUpload, imageKitUpload, updateMaterial);
router.delete("/deleteMaterial", deleteMaterial);
router.post("/createPaymentOnline/:reviewId", createPaymentOnline);
router.post("/createPartPaymentOnline/:reviewId", createPartPaymentOnline);
router.get("/searchMaterials", searchMaterials);
router.get("/getMaterialCategory", getMaterialCategory);
router.get("/getVendorDetails", getVendorDetails);  

export default router;