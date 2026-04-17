import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDeliveryStartedEmailPayload,
  buildOfferDecisionEmailPayload,
} from "../src/utils/emailService.utils.js";

test("buildDeliveryStartedEmailPayload includes delivery tracking details for the user", () => {
  const payload = buildDeliveryStartedEmailPayload({
    user: {
      fullName: "Ada Buyer",
      email: "ada@example.com",
    },
    vendorUser: {
      fullName: "Tolu Designer",
    },
    vendorProfile: {
      businessName: "Tolu Couture",
    },
    material: {
      attireType: "Agbada",
      clothMaterial: "Silk",
      color: "Navy",
      brand: "Luxury Loom",
    },
    tracking: {
      trackingNumber: "483920",
      createdAt: "2026-04-17T10:00:00.000Z",
    },
  });

  assert.equal(payload.to, "ada@example.com");
  assert.equal(payload.subject, "Your attire is now in delivery");
  assert.match(payload.htmlContent, /Ada Buyer/);
  assert.match(payload.htmlContent, /483920/);
  assert.match(payload.htmlContent, /Tolu Couture/);
  assert.match(payload.htmlContent, /Agbada/);
  assert.match(payload.htmlContent, /Silk/);
});

test("buildOfferDecisionEmailPayload includes accepted offer values and next step", () => {
  const payload = buildOfferDecisionEmailPayload({
    recipientEmail: "buyer@example.com",
    recipientName: "Ada Buyer",
    actorName: "Tolu Couture",
    actorRoleLabel: "designer",
    action: "accepted",
    material: {
      attireType: "Agbada",
      clothMaterial: "Silk",
      color: "Navy",
    },
    amountNGN: 145000,
    amountUSD: 96.67,
    comment: "Ready to proceed",
    mutualConsentAchieved: true,
  });

  assert.equal(payload.to, "buyer@example.com");
  assert.equal(payload.subject, "Offer accepted for your attire order");
  assert.match(payload.htmlContent, /Ada Buyer/);
  assert.match(payload.htmlContent, /Tolu Couture/);
  assert.match(payload.htmlContent, /accepted/);
  assert.match(payload.htmlContent, /₦145,000/);
  assert.match(payload.htmlContent, /\$96\.67/);
  assert.match(payload.htmlContent, /Both parties have now agreed/);
  assert.match(payload.htmlContent, /Ready to proceed/);
});

test("buildOfferDecisionEmailPayload includes rejected state fallback comment", () => {
  const payload = buildOfferDecisionEmailPayload({
    recipientEmail: "designer@example.com",
    recipientName: "Tolu Designer",
    actorName: "Ada Buyer",
    actorRoleLabel: "buyer",
    action: "rejected",
    material: {
      clothMaterial: "Lace",
      color: "Gold",
    },
    amountNGN: 80000,
    comment: "",
    mutualConsentAchieved: false,
  });

  assert.equal(payload.to, "designer@example.com");
  assert.equal(payload.subject, "Offer rejected for your attire order");
  assert.match(payload.htmlContent, /Ada Buyer/);
  assert.match(payload.htmlContent, /rejected/);
  assert.match(payload.htmlContent, /₦80,000/);
  assert.match(payload.htmlContent, /No comment provided/);
  assert.match(payload.htmlContent, /This offer is now closed/);
});
