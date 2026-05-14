import { Router } from "express";
import { isAuth } from "../../../middlewares/auth.middleware.js";
import { userCheckRole } from "../../../middlewares/checkRole.middleware.js";
import {
  createMeasurementProfile,
  getMeasurementProfiles,
  getMeasurementRequests,
  requestAdditionalMeasurements,
  updateMeasurementProfile,
} from "../controller/measurement.controller.js";

const router = Router();

router.use(isAuth);
router.use(userCheckRole(["user", "tailor", "admin"]));
router.post("/profiles", createMeasurementProfile);
router.get("/profiles", getMeasurementProfiles);
router.put("/profiles/:profileId", updateMeasurementProfile);
router.post("/requests", requestAdditionalMeasurements);
router.get("/requests", getMeasurementRequests);

export default router;

