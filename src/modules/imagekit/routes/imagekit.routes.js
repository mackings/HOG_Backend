import { Router } from "express";
import { getImageKitAuth } from "../controller/imagekit.controller.js";
import { isAuth } from "../../../middlewares/auth.middleware.js";

const router = Router();

router.use(isAuth);
router.get("/auth", getImageKitAuth);

export default router;
