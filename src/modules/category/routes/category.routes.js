import { Router } from 'express';
import { createCategory, getAllCategories, getCategoryById, updateCategory, deleteCategory
  } from '../controller/category.controller.js';
import { isAuth } from '../../../middlewares/auth.middleware.js';
import { imageUpload, imageKitUpload } from '../../../utils/imagekit.js';
import { userCheckRole } from '../../../middlewares/checkRole.middleware.js';


const router = Router();


router.use(isAuth);
router.use(userCheckRole(["admin", "tailor", "user"]));
router.post("/createCategory", imageUpload, imageKitUpload, createCategory);
router.get("/getAllCategories", getAllCategories);
router.get("/getCategoryById", getCategoryById);
router.put("/updateCategory/:id", imageUpload, imageKitUpload, updateCategory);
router.delete("/deleteCategory", deleteCategory);



export default router;
