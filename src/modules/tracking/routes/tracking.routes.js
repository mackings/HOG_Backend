import { Router } from 'express';
import { createTracking, deleteTracking, getTracking, updateMaterialThroughTracking, getAllTracking
  } from '../controller/tracking.controller.js';
import { isAuth } from '../../../middlewares/auth.middleware.js';
import { userCheckRole} from '../../../middlewares/checkRole.middleware.js';


const router = Router();

router.use(isAuth);
router.use(userCheckRole(["tailor", "user"]));
router.post("/createTracking", createTracking );
router.delete("/deleteTracking", deleteTracking );
router.get("/getTracking", getTracking );
router.get("/getAllTracking", getAllTracking );
router.put("/updateMaterialThroughTracking", updateMaterialThroughTracking );



export default router;


