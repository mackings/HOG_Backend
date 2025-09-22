import { Router } from 'express';
import { getAlSellerListings, searchListings, getSellerListingById, purchaseListing, purchaseMultipleListings,
    getAllTracking, acceptOrder
 } from '../controller/buyer.controller';
import { isAuth } from '../../../middlewares/auth.middleware';
const { imageUpload, imageKitUpload} = require('../../../utils/imagekit');
import { userCheckRole } from '../../../middlewares/checkRole.middleware';


const router = Router();


router.use(isAuth);
router.use(userCheckRole(['admin', 'tailor', 'user']));
router.get("/getAlSellerListings", getAlSellerListings);
router.get("/searchListings", searchListings);
router.get("/getSellerListingById/:listingId", getSellerListingById);
router.post("/purchaseListing/:listingId",  purchaseListing);
router.post("/purchaseMultipleListings", purchaseMultipleListings);
router.get("/getAllTracking", getAllTracking);
router.put("/acceptOrder", acceptOrder);    


export default router;


