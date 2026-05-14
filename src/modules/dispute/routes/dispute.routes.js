import { Router } from "express";
import { isAuth } from "../../../middlewares/auth.middleware.js";
import { userCheckRole } from "../../../middlewares/checkRole.middleware.js";
import { createDispute, getAllDisputes, getMyDisputes, updateDispute } from "../controller/dispute.controller.js";

const router = Router();

router.use(isAuth);
router.post("/", userCheckRole(["user", "tailor", "admin"]), createDispute);
router.get("/mine", userCheckRole(["user", "tailor", "admin"]), getMyDisputes);
router.get("/admin", userCheckRole(["admin", "superAdmin"]), getAllDisputes);
router.put("/admin/:disputeId", userCheckRole(["admin", "superAdmin"]), updateDispute);

export default router;

