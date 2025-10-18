import { Router } from 'express';
import { createMakeOffer, vendorReplyOffer, buyerReplyToOffer,
    getAllMakeOffers, getMakeOfferById, deleteAllMakeOffer
  } from '../controller/makeOffer.controller';
import { isAuth } from '../../../middlewares/auth.middleware';
import { userCheckRole } from '../../../middlewares/checkRole.middleware';


const router = Router();

router.use(isAuth);
router.use(userCheckRole(['user', 'tailor', 'admin']));

router.post('/createMakeOffer/:reviewId', createMakeOffer);
router.post('/vendorReplyOffer/:offerId', vendorReplyOffer);
router.post('/buyerReplyToOffer/:offerId', buyerReplyToOffer);
router.get('/getAllMakeOffers', getAllMakeOffers);
router.get('/getMakeOfferById/:offerId', getMakeOfferById);
router.delete('/deleteAllMakeOffer', deleteAllMakeOffer);

export default router;
