import { Router } from 'express';
import { getAllPendingSellerListings, getSellerListingById, approveSellerListing,
    createListingFee, getListingFee, rejectSellerListing, totalUsers, totalNumberOfFreeAndPaidListings,
    adminTotalEarnings, totalTransactions, totalListings,
 } from '../controller/admin.controller.js';
import { isAuth } from '../../../middlewares/auth.middleware.js';
import { userCheckRole } from '../../../middlewares/checkRole.middleware.js';


const router = Router();


router.use(isAuth);
router.use(userCheckRole(['admin', 'superAdmin']));
router.get("/getAllPendingSellerListings", getAllPendingSellerListings);
router.get("/getSellerListingById/:listingId", getSellerListingById);
router.put("/approveSellerListing/:listingId", approveSellerListing);
router.post("/createListingFee", createListingFee);
router.get("/getListingFee", getListingFee);
router.put("/rejectSellerListing/:listingId", rejectSellerListing);
router.get("/totalUsers", totalUsers);
router.get("/totalNumberOfFreeAndPaidListings", totalNumberOfFreeAndPaidListings);
router.get("/adminTotalEarnings", adminTotalEarnings);
router.get("/totalTransactions", totalTransactions);
router.get("/totalListings", totalListings);


export default router;
