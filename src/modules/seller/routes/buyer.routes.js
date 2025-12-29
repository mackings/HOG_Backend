import { Router } from 'express';
import { getAlSellerListings, searchListings, getSellerListingById, purchaseListing, purchaseMultipleListings,
    getAllTracking, acceptOrder
 } from '../controller/buyer.controller.js';
import { isAuth } from '../../../middlewares/auth.middleware.js';
import { imageUpload, imageKitUpload } from '../../../utils/imagekit.js';
import { userCheckRole } from '../../../middlewares/checkRole.middleware.js';


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


