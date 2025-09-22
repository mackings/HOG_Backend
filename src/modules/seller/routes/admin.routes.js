import { Router } from 'express';
import { getAllPendingSellerListings, getSellerListingById, approveSellerListing,
    createListingFee, getListingFee, rejectSellerListing 
 } from '../controller/admin.controller';
import { isAuth } from '../../../middlewares/auth.middleware';
import { userCheckRole } from '../../../middlewares/checkRole.middleware';


const router = Router();


router.use(isAuth);
router.use(userCheckRole(['admin', 'tailor', 'user']));
router.get("/getAllPendingSellerListings", getAllPendingSellerListings);
router.get("/getSellerListingById/:listingId", getSellerListingById);
router.put("/approveSellerListing/:listingId", approveSellerListing);
router.post("/createListingFee", createListingFee);
router.get("/getListingFee", getListingFee);
router.put("/rejectSellerListing/:listingId", rejectSellerListing);


export default router;
