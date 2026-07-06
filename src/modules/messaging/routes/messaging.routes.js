import { Router } from "express";
import { isAuth } from "../../../middlewares/auth.middleware.js";
import { userCheckRole } from "../../../middlewares/checkRole.middleware.js";
import { requirePlan } from "../../../middlewares/subscriptionAccess.middleware.js";
import {
  createConversation,
  getConversationMessages,
  getEligibleMessageThreads,
  getFlaggedConversations,
  getMyConversations,
  sendMessage,
} from "../controller/messaging.controller.js";
import { fileUpload, optionalImageKitUpload } from "../../../utils/imagekit.js";

const router = Router();

router.use(isAuth);
router.get("/eligible-threads", userCheckRole(["user", "tailor", "admin"]), getEligibleMessageThreads);
// Direct messaging is a Premium+ feature for designers; buyers are unrestricted (requirePlan bypasses role=user)
router.post("/conversations", userCheckRole(["user", "tailor", "admin"]), requirePlan("premium"), createConversation);
router.get("/conversations", userCheckRole(["user", "tailor", "admin"]), getMyConversations);
router.post("/conversations/:conversationId/messages", userCheckRole(["user", "tailor", "admin"]), requirePlan("premium"), fileUpload, optionalImageKitUpload, sendMessage);
router.get("/conversations/:conversationId/messages", userCheckRole(["user", "tailor", "admin"]), getConversationMessages);
router.get("/admin/flagged-conversations", userCheckRole(["admin", "superAdmin"]), getFlaggedConversations);

export default router;
