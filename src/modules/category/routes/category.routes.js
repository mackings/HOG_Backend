import { Router } from 'express';
import { createCategory, getAllCategories, getCategoryById, updateCategory, deleteCategory
  } from '../controller/category.controller';
import { isAuth } from '../../../middlewares/auth.middleware';
const { imageUpload, imageKitUpload} = require('../../../utils/imagekit');
import { userCheckRole } from '../../../middlewares/checkRole.middleware';


const router = Router();


router.use(isAuth);
router.use(userCheckRole(["admin", "tailor"]));
router.post("/createCategory", imageUpload, imageKitUpload, createCategory);
router.get("/getAllCategories", getAllCategories);
router.get("/getCategoryById", getCategoryById);
router.put("/updateCategory/:id", imageUpload, imageKitUpload, updateCategory);
router.delete("/deleteCategory", deleteCategory);



export default router;
