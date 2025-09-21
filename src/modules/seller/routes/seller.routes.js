import { Router } from 'express';
import { sellerCreateListing, getSellerListings, getSellerListingById, updateSellerListing, deleteSellerListing } from '../controller/seller.controller';
import { isAuth } from '../../../middlewares/auth.middleware';
const { imageUpload, imageKitUpload} = require('../../../utils/imagekit');
import { userCheckRole } from '../../../middlewares/checkRole.middleware';


const router = Router();


router.use(isAuth);
router.use(userCheckRole(['admin', 'tailor', 'user']));
router.post("/sellerCreateListing/:categoryId", imageUpload, imageKitUpload, sellerCreateListing );
router.get("/getSellerListings", getSellerListings);
router.get("/getSellerListingById/:listingId", getSellerListingById);
router.put("/updateSellerListing/:listingId", imageUpload, imageKitUpload, updateSellerListing);
router.delete("/deleteSellerListing/:listingId", deleteSellerListing);


export default router;