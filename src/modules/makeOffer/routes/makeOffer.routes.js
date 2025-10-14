import { Router } from 'express';
import { createMakeOffer, vendorReplyOffer, buyerReplyToOffer, getAllNotifications, getNotificationById,
    getAllMakeOffers, getMakeOfferById
  } from '../controller/makeOffer.controller';
import { isAuth } from '../../../middlewares/auth.middleware';
import { userCheckRole } from '../../../middlewares/checkRole.middleware';


const router = Router();

router.use(isAuth);
router.use(userCheckRole(['user', 'tailor', 'admin']));

router.post('/createMakeOffer/:reviewId', createMakeOffer);
router.patch('/vendorReplyOffer/:offerId', vendorReplyOffer);
router.patch('/buyerReplyToOffer/:offerId', buyerReplyToOffer);
router.get('/getAllMakeOffers', getAllMakeOffers);
router.get('/getMakeOfferById/:offerId', getMakeOfferById);
router.get('/getAllNotifications', getAllNotifications);
router.get('/getNotificationById/:notificationId', getNotificationById);

export default router;
