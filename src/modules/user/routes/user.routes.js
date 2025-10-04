import { Router } from 'express';
import { register, verifyToken, login, forgotPassword, resetPassword, updateProfile, uploadImage, getProfile,
  uploadBillImage, getAllusers, getAllTailor, getUserCurrency
  } from '../controller/user.controller';
import { isAuth } from '../../../middlewares/auth.middleware';
import { imageUpload, imageKitUpload } from '../../../utils/imagekit';


const router = Router();

router.post('/register', register );
router.post('/verifyToken', verifyToken );
router.post('/login', login );
router.post('/forgotPassword', forgotPassword );
router.post('/resetPassword', resetPassword );
router.put('/updateProfile', isAuth, updateProfile );
router.put('/uploadImage', isAuth, imageUpload, imageKitUpload, uploadImage );
router.get('/getProfile', isAuth, getProfile );
router.put('/uploadBillImage', isAuth, imageUpload, imageKitUpload, uploadBillImage );
router.get('/getAllusers', getAllusers );
router.get('/getAllTailor', getAllTailor );
router.get('/getUserCurrency', isAuth, getUserCurrency );




export default router;