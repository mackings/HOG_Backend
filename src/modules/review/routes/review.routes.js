import { Router } from 'express';
import { createReview, getReviews, getReviewById, updateReview, deleteReview, updateReviewStatus,
  getAllMaterialsForReview, getReviewsForMaterialById, getAllMaterialOrders
  } from '../controller/review.controller.js';
import { isAuth } from '../../../middlewares/auth.middleware.js';
import { userCheckRole } from '../../../middlewares/checkRole.middleware.js'
import { imageUpload, imageKitUpload } from '../../../utils/imagekit.js';


const router = Router();

router.use(isAuth);
router.use(userCheckRole(["tailor", 'admin', 'user']));
router.post('/createReview/:materialId', createReview);
router.get('/getReviews', getReviews);
router.get('/getReviewById/:reviewId', getReviewById);
router.put('/updateReview/:reviewId', updateReview);
router.delete('/deleteReview/:reviewId', deleteReview)
router.put('/updateReviewStatus/:reviewId', updateReviewStatus);
router.get('/getAllMaterialsForReview', getAllMaterialsForReview);
router.get('/getReviewsForMaterialById/:materialId', getReviewsForMaterialById);
router.get('/getAllMaterialOrders', getAllMaterialOrders);




export default router;