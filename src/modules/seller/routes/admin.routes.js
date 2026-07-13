import { Router } from 'express';
import {
  getAllPendingSellerListings, getApprovedSellerListings, getRejectedSellerListings,
  getModeratedSellerListings, getSellerListingById, approveSellerListing, createListingFee,
  getListingFee, rejectSellerListing, totalUsers, totalNumberOfFreeAndPaidListings,
  adminTotalEarnings, totalTransactions, totalListings, getListingModerationHistory,
  getAdminAnalytics, getAdminAnalyticsUsers, getAdminAnalyticsListings,
  getAdminAnalyticsTransactions, getAdminSuccessfulTransactions, getAdminAnalyticsEarnings,
  inviteAdministrator,
} from '../controller/admin.controller.js';
import { isAuth } from '../../../middlewares/auth.middleware.js';
import { userCheckRole } from '../../../middlewares/checkRole.middleware.js';

// Role groups — used per-route to enforce strict access boundaries
const SENIOR       = ["admin", "superAdmin"];
const FINANCE      = ["finance", "admin", "superAdmin"];
const LISTING      = ["listingManager", "customerService", "admin", "superAdmin"];
const CS_AND_ABOVE = ["customerService", "admin", "superAdmin"];

const router = Router();

router.use(isAuth);

// ── Listing management (listingManager, customerService, admin, superAdmin) ──
router.get("/getAllPendingSellerListings",        userCheckRole(LISTING), getAllPendingSellerListings);
router.get("/getApprovedSellerListings",          userCheckRole(LISTING), getApprovedSellerListings);
router.get("/getRejectedSellerListings",          userCheckRole(LISTING), getRejectedSellerListings);
router.get("/getSellerListings",                  userCheckRole(LISTING), getModeratedSellerListings);
router.get("/getSellerListingById/:listingId",    userCheckRole(LISTING), getSellerListingById);
router.put("/approveSellerListing/:listingId",    userCheckRole(LISTING), approveSellerListing);
router.put("/rejectSellerListing/:listingId",     userCheckRole(LISTING), rejectSellerListing);
router.get("/getListingModerationHistory",        userCheckRole(LISTING), getListingModerationHistory);
router.get("/totalListings",                      userCheckRole(LISTING), totalListings);
router.get("/analytics/listings",                 userCheckRole(LISTING), getAdminAnalyticsListings);
router.get("/totalNumberOfFreeAndPaidListings",   userCheckRole(LISTING), totalNumberOfFreeAndPaidListings);

// ── Billing / fees (finance, admin, superAdmin) ──────────────────────────────
router.post("/createListingFee",                  userCheckRole(FINANCE), createListingFee);
router.get("/getListingFee",                      userCheckRole(FINANCE), getListingFee);
router.get("/analytics/transactions",             userCheckRole(FINANCE), getAdminAnalyticsTransactions);
router.get("/analytics/successful-transactions",  userCheckRole(FINANCE), getAdminSuccessfulTransactions);
router.get("/analytics/earnings",                 userCheckRole(FINANCE), getAdminAnalyticsEarnings);
router.get("/adminTotalEarnings",                 userCheckRole(FINANCE), adminTotalEarnings);
router.get("/totalTransactions",                  userCheckRole(FINANCE), totalTransactions);

// ── General platform analytics (customerService, admin, superAdmin) ──────────
router.get("/analytics",                          userCheckRole(CS_AND_ABOVE), getAdminAnalytics);
router.get("/analytics/users",                    userCheckRole(CS_AND_ABOVE), getAdminAnalyticsUsers);
router.get("/totalUsers",                         userCheckRole(CS_AND_ABOVE), totalUsers);

// ── Invitations (admin, superAdmin only) ─────────────────────────────────────
router.post("/invitations",                       userCheckRole(SENIOR), inviteAdministrator);

export default router;
