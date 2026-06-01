import { Router } from "express";
import { isAuth } from "../../../middlewares/auth.middleware.js";
import { userCheckRole } from "../../../middlewares/checkRole.middleware.js";
import { fileUpload, optionalImageKitUpload } from "../../../utils/imagekit.js";
import {
  createSupportConversation,
  getSupportConversations,
  getSupportMessages,
  sendSupportMessage,
} from "../controller/support.controller.js";

const router = Router();

router.use(isAuth);
router.use(userCheckRole(["user", "tailor", "admin", "superAdmin"]));

router.post("/conversations", createSupportConversation);
router.get("/conversations", getSupportConversations);
router.post("/conversations/:conversationId/messages", fileUpload, optionalImageKitUpload, sendSupportMessage);
router.get("/conversations/:conversationId/messages", getSupportMessages);

export default router;
