import { Router } from "express";
import { isAuth } from "../../../middlewares/auth.middleware.js";
import { userCheckRole } from "../../../middlewares/checkRole.middleware.js";
import {
  createConversation,
  getConversationMessages,
  getFlaggedConversations,
  getMyConversations,
  sendMessage,
} from "../controller/messaging.controller.js";

const router = Router();

router.use(isAuth);
router.post("/conversations", userCheckRole(["user", "tailor", "admin"]), createConversation);
router.get("/conversations", userCheckRole(["user", "tailor", "admin"]), getMyConversations);
router.post("/conversations/:conversationId/messages", userCheckRole(["user", "tailor", "admin"]), sendMessage);
router.get("/conversations/:conversationId/messages", userCheckRole(["user", "tailor", "admin"]), getConversationMessages);
router.get("/admin/flagged-conversations", userCheckRole(["admin", "superAdmin"]), getFlaggedConversations);

export default router;

