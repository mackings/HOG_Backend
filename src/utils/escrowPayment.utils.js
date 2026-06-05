import EscrowPayment from "../modules/customOrder/model/escrowPayment.model.js";

export const findEscrowByMilestoneReference = (reference) => {
  if (!reference) return null;
  return EscrowPayment.findOne({ "milestones.reference": reference });
};

export const markEscrowMilestonePaidByReference = async ({ reference, gatewayPayload = {} }) => {
  const escrow = await findEscrowByMilestoneReference(reference);
  if (!escrow) return null;

  const milestone = escrow.milestones.find((item) => item.reference === reference);
  if (!milestone) return null;

  const wasAlreadyPaid = milestone.status === "paid";
  if (!wasAlreadyPaid) {
    milestone.status = "paid";
    milestone.paidAt = new Date();
  }

  escrow.status = escrow.milestones.every((item) => item.status === "paid") ? "fully_held" : "deposit_held";
  await escrow.save();

  return {
    escrow,
    milestone,
    wasAlreadyPaid,
    gatewayReference: gatewayPayload.reference || reference,
    gatewayStatus: gatewayPayload.status,
  };
};

