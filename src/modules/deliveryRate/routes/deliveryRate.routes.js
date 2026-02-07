import { Router } from 'express';
import { createDeliveryRate, getDeliveryRates, updateDeliveryRate, deleteDeliveryRate,
    deliveryCost, createPickupCountry, addPickupState, addPickupLocation, getPickupCountries,
    getPickupStatesByCountry, getPickupLocationsByState, getPickupHierarchy
 } from '../controller/deliveryRate.controller.js';
import { isAuth } from '../../../middlewares/auth.middleware.js';
import { userCheckRole } from '../../../middlewares/checkRole.middleware.js';


const router = Router();

// Public routes (all authenticated users can access)
router.use(isAuth);
router.get("/getDeliveryRates", getDeliveryRates);
router.post("/deliveryCost/:reviewId", deliveryCost);
router.get("/pickup/countries", getPickupCountries);
router.get("/pickup/countries/:countryId/states", getPickupStatesByCountry);
router.get("/pickup/countries/:countryId/states/:stateId/locations", getPickupLocationsByState);
router.get("/pickup/hierarchy", getPickupHierarchy);

// Admin-only routes
router.use(userCheckRole(["superAdmin", "admin"]));
router.post("/createDeliveryRate", createDeliveryRate);
router.put("/updateDeliveryRate/:id", updateDeliveryRate);
router.delete("/deleteDeliveryRate/:id", deleteDeliveryRate);
router.post("/pickup/countries", createPickupCountry);
router.post("/pickup/countries/:countryId/states", addPickupState);
router.post("/pickup/countries/:countryId/states/:stateId/locations", addPickupLocation);


export default router;
