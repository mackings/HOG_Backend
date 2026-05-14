import test from "node:test";
import assert from "node:assert/strict";

import {
  createDummyFeatureActors,
  simulateMeasurementProfile,
  simulateMessageModeration,
  simulateWorkflow,
} from "../src/utils/featureSimulations/newestFeatures.simulation.js";

test("message moderation blocks contact details before delivery", () => {
  const result = simulateMessageModeration("Call me on +234 801 234 5678 or mail ada@example.com");

  assert.equal(result.accepted, false);
  assert.equal(result.isFlagged, true);
  assert.equal(result.deliveredContent, null);
  assert.equal(result.detectedTypes.includes("email"), true);
  assert.equal(result.detectedTypes.includes("phone"), true);
  assert.match(result.prompt, /keep all communication within House of GLAME/);
  assert.match(result.maskedPreviewForAdmin, /\*{3,}/);
});

test("message moderation blocks address-style content", () => {
  const result = simulateMessageModeration("Meet me at 12 Allen Avenue tomorrow");

  assert.equal(result.accepted, false);
  assert.equal(result.deliveredContent, null);
  assert.deepEqual(result.detectedTypes, ["address"]);
});

test("message moderation rejects video attachments", () => {
  const result = simulateMessageModeration("Here is the preview", [
    { type: "video", url: "https://cdn.example.com/demo.mp4", mimeType: "video/mp4" },
  ]);

  assert.equal(result.accepted, false);
  assert.equal(result.deliveredContent, null);
  assert.match(result.prompt, /Video sharing is not supported/);
});

test("measurement profile simulation supports native fit measurements and history", () => {
  const { customer } = createDummyFeatureActors();
  const profile = simulateMeasurementProfile(customer._id);

  assert.equal(profile.userId, customer._id);
  assert.equal(profile.fitType, "native");
  assert.equal(profile.measurements.chest, 40);
  assert.equal(profile.measurements.native.agbadaLength, 56);
  assert.equal(profile.historyCountAfterEdit, 1);
});

test("custom workflow simulation covers quote, status timeline and escrow protection", () => {
  const actors = createDummyFeatureActors();
  const workflow = simulateWorkflow(actors);

  assert.equal(workflow.customRequest.status, "quote_submitted");
  assert.equal(workflow.orderWorkflow.currentStatus, "accepted");
  assert.deepEqual(workflow.orderWorkflow.timeline, ["quote_received", "accepted"]);
  assert.equal(workflow.escrow.status, "deposit_held");
  assert.equal(workflow.escrow.depositAmount, 100000);
});
