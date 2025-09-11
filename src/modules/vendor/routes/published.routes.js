import { Router } from 'express';
import { createPublished,
    getAllPublished,
    getPublishedById,
    updatePublished,
    deletePublished,
    userPatronizedPublished
  } from '../controller/published.controller';
import { isAuth } from '../../../middlewares/auth.middleware';
import { userCheckRole } from '../../../middlewares/checkRole.middleware'
import { imageUpload, imageKitUpload } from '../../../utils/imagekit';


const router = Router();

router.use(isAuth);
router.use(userCheckRole(['tailor', 'user']));
router.post('/createPublished/:categoryId', imageUpload, imageKitUpload, createPublished);
router.get('/getAllPublished', getAllPublished );
router.get('/getPublishedById/:publishedId', getPublishedById);
router.put('/updatePublished/:publishedId', imageUpload, imageKitUpload, updatePublished);
router.delete('/deletePublished/:publishedId', deletePublished);
router.post('/userPatronizedPublished/:publishedId', userPatronizedPublished);


export default router;