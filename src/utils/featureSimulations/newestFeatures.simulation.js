import {
  blockRestrictedContact,
  maskRestrictedContact,
  validateMessageAttachments,
} from "../contactMask.utils.js";

export const createDummyFeatureActors = () => ({
  customer: {
    _id: "665000000000000000000001",
    fullName: "Ada Buyer",
    email: "ada.buyer@example.com",
    role: "user",
  },
  designer: {
    _id: "665000000000000000000002",
    fullName: "Tolu Designer",
    email: "tolu.designer@example.com",
    role: "tailor",
  },
  vendor: {
    _id: "665000000000000000000003",
    businessName: "Tolu Couture",
  },
  material: {
    _id: "665000000000000000000004",
    attireType: "Agbada",
  },
});

export const simulateMessageModeration = (content, attachments = []) => {
  const blocked = blockRestrictedContact(content);
  const masked = maskRestrictedContact(content);
  const attachmentValidation = validateMessageAttachments(attachments);

  return {
    accepted: attachmentValidation.valid && blocked.allowed,
    deliveredContent: attachmentValidation.valid && blocked.allowed ? content : null,
    isFlagged: !blocked.allowed,
    detectedTypes: blocked.detected.map((item) => item.type),
    prompt: blocked.prompt || attachmentValidation.message || null,
    maskedPreviewForAdmin: masked.sanitizedContent,
  };
};

export const simulateMeasurementProfile = (ownerId) => ({
  userId: ownerId,
  profileName: "Native fit",
  fitType: "native",
  measurements: {
    chest: 40,
    waist: 34,
    hip: 39,
    shoulder: 18,
    sleeveLength: 25,
    trouserLength: 41,
    native: {
      agbadaLength: 56,
      capSize: 22,
    },
  },
  historyCountAfterEdit: 1,
});

export const simulateWorkflow = ({ customer, designer, material }) => ({
  customRequest: {
    customerId: customer._id,
    designerId: designer._id,
    materialId: material._id,
    status: "quote_submitted",
    quote: {
      materialCost: 80000,
      workmanshipCost: 120000,
      estimatedProductionDays: 14,
    },
  },
  orderWorkflow: {
    currentStatus: "accepted",
    timeline: ["quote_received", "accepted"],
    estimatedCompletionDate: "2026-06-01T00:00:00.000Z",
  },
  escrow: {
    totalAmount: 200000,
    depositAmount: 100000,
    balanceAmount: 100000,
    status: "deposit_held",
    milestones: ["deposit_paid"],
  },
});
