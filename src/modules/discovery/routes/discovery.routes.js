import { Router } from "express";
import { isAuth } from "../../../middlewares/auth.middleware.js";
import { userCheckRole } from "../../../middlewares/checkRole.middleware.js";
import {
  discoverDesigners,
  discoverListings,
  getPublicDesignerById,
  getPublicListingById,
} from "../controller/discovery.controller.js";

const router = Router();

// Guest exploration: no account required until purchase/payment or protected actions.
router.get("/public/listings", discoverListings);
router.get("/public/listings/:listingId", getPublicListingById);
router.get("/public/designers", discoverDesigners);
router.get("/public/designers/:designerId", getPublicDesignerById);

router.use(isAuth);
router.use(userCheckRole(["user", "tailor", "admin"]));
router.get("/listings", discoverListings);
router.get("/designers", discoverDesigners);

export default router;
