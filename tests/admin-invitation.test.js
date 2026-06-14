import test from "node:test";
import assert from "node:assert/strict";

import {
  canInviteAdminRole,
  generateTemporaryPassword,
  normalizeInvitationEmail,
  normalizeInvitationRole,
  normalizeResponsibilities,
} from "../src/modules/seller/services/adminInvitation.service.js";
import { buildAdminInvitationEmailPayload } from "../src/utils/emailService.utils.js";
import { normalizePublicUserRole } from "../src/modules/user/controller/user.controller.js";

test("admin invitation authorization enforces privileged role boundaries", () => {
  assert.equal(canInviteAdminRole("admin", "admin"), true);
  assert.equal(canInviteAdminRole("admin", "superAdmin"), false);
  assert.equal(canInviteAdminRole("superAdmin", "admin"), true);
  assert.equal(canInviteAdminRole("superAdmin", "superAdmin"), true);
  assert.equal(canInviteAdminRole("user", "admin"), false);
  assert.equal(canInviteAdminRole("superAdmin", "tailor"), false);
});

test("invitation values are normalized consistently", () => {
  assert.equal(normalizeInvitationEmail("  ADMIN@Example.COM "), "admin@example.com");
  assert.equal(normalizeInvitationRole("super_admin"), "superAdmin");
  assert.equal(normalizeInvitationRole("SUPERADMIN"), "superAdmin");
  assert.equal(normalizeInvitationRole("admin"), "admin");
});

test("public registration cannot assign privileged roles", () => {
  assert.equal(normalizePublicUserRole("user"), "user");
  assert.equal(normalizePublicUserRole("buyer"), "user");
  assert.equal(normalizePublicUserRole("tailor"), "tailor");
  assert.equal(normalizePublicUserRole("vendor"), "tailor");
  assert.equal(normalizePublicUserRole("admin"), null);
  assert.equal(normalizePublicUserRole("superAdmin"), null);
});

test("temporary password is strong and not reused between generations", () => {
  const first = generateTemporaryPassword();
  const second = generateTemporaryPassword();

  assert.equal(first.length, 16);
  assert.match(first, /[A-Z]/);
  assert.match(first, /[a-z]/);
  assert.match(first, /[0-9]/);
  assert.match(first, /[!@#$%&*?]/);
  assert.notEqual(first, second);
});

test("invitation responsibilities use custom values or role defaults", () => {
  assert.deepEqual(normalizeResponsibilities("admin", [" Review listings ", "", "Support users"]), [
    "Review listings",
    "Support users",
  ]);

  const defaults = normalizeResponsibilities("superAdmin");
  assert.equal(defaults.length > 0, true);
  assert.match(defaults.join(" "), /administrators/i);
});

test("admin invitation email contains credentials, role, and escaped responsibilities", () => {
  const payload = buildAdminInvitationEmailPayload({
    fullName: "Ada <Owner>",
    email: "ada@example.com",
    temporaryPassword: "TempPass9!",
    role: "superAdmin",
    inviterName: "Platform Owner",
    responsibilities: ["Manage <script>alert(1)</script> administrators"],
  });

  assert.equal(payload.to, "ada@example.com");
  assert.match(payload.subject, /Super Admin/);
  assert.match(payload.htmlContent, /ada@example\.com/);
  assert.match(payload.htmlContent, /TempPass9!/);
  assert.match(payload.htmlContent, /Super Admin/);
  assert.match(payload.htmlContent, /Ada &lt;Owner&gt;/);
  assert.doesNotMatch(payload.htmlContent, /<script>/);
});
