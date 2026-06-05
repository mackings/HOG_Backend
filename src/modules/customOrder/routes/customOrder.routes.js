import { Router } from "express";
import { isAuth } from "../../../middlewares/auth.middleware.js";
import { userCheckRole } from "../../../middlewares/checkRole.middleware.js";
import {
  acceptCustomQuote,
  convertCustomRequestToOrder,
  createCustomRequest,
  createDesignerWorkflow,
  designerRespondToCustomRequest,
  getDesignerEscrowWallet,
  getDesignerWorkflows,
  getMyCustomRequests,
  payCustomRequestMilestone,
  refundEscrowPayment,
  recordEscrowPayment,
  releaseEscrowPayment,
  requestQuoteRevision,
  submitCustomQuote,
  updateDesignerWorkflowStatus,
  updateOrderWorkflow,
} from "../controller/customOrder.controller.js";
import { imageUpload, optionalImageKitUpload } from "../../../utils/imagekit.js";

const router = Router();

router.use(isAuth);
router.post("/requests", userCheckRole(["user", "admin"]), imageUpload, optionalImageKitUpload, createCustomRequest);
router.get("/requests", userCheckRole(["user", "tailor", "admin"]), getMyCustomRequests);
router.post("/requests/:requestId/designer-response", userCheckRole(["tailor", "admin"]), designerRespondToCustomRequest);
router.post("/requests/:requestId/quote", userCheckRole(["tailor", "admin"]), submitCustomQuote);
router.post("/requests/:requestId/revisions", userCheckRole(["user", "tailor", "admin"]), requestQuoteRevision);
router.post("/requests/:requestId/accept", userCheckRole(["user", "admin"]), acceptCustomQuote);
router.post("/requests/:requestId/convert", userCheckRole(["user", "tailor", "admin"]), convertCustomRequestToOrder);
router.post("/requests/:requestId/pay", userCheckRole(["user", "admin"]), payCustomRequestMilestone);
router.get("/workflows", userCheckRole(["tailor", "admin"]), getDesignerWorkflows);
router.post("/workflows", userCheckRole(["tailor", "admin"]), createDesignerWorkflow);
router.put("/workflows/:workflowId/status", userCheckRole(["tailor", "admin"]), updateDesignerWorkflowStatus);
router.put("/workflow", userCheckRole(["tailor", "admin", "superAdmin"]), updateOrderWorkflow);
router.get("/designer/escrow-wallet", userCheckRole(["tailor", "admin"]), getDesignerEscrowWallet);
router.post("/escrow/:escrowId/payments", userCheckRole(["user", "admin"]), recordEscrowPayment);
router.post("/escrow/:escrowId/release", userCheckRole(["admin", "superAdmin"]), releaseEscrowPayment);
router.post("/escrow/:escrowId/refund", userCheckRole(["admin", "superAdmin"]), refundEscrowPayment);

export default router;
