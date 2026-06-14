import crypto from "crypto";

export const INVITABLE_ADMIN_ROLES = ["admin", "superAdmin"];

export const DEFAULT_ROLE_RESPONSIBILITIES = {
  admin: [
    "Review and moderate marketplace listings",
    "Monitor users, transactions, listings, and platform analytics",
    "Support day-to-day platform administration",
  ],
  superAdmin: [
    "Manage platform administrators and privileged invitations",
    "Oversee users, transactions, listings, earnings, and moderation",
    "Perform all platform administration and governance duties",
  ],
};

export const normalizeInvitationEmail = (email) => String(email || "").trim().toLowerCase();

export const normalizeInvitationRole = (role) => {
  const value = String(role || "").trim().toLowerCase();
  if (value === "superadmin" || value === "super_admin") return "superAdmin";
  return value;
};

export const canInviteAdminRole = (inviterRole, targetRole) => {
  const inviter = normalizeInvitationRole(inviterRole);
  const target = normalizeInvitationRole(targetRole);

  if (target === "admin") return inviter === "admin" || inviter === "superAdmin";
  if (target === "superAdmin") return inviter === "superAdmin";
  return false;
};

export const normalizeResponsibilities = (role, responsibilities) => {
  if (Array.isArray(responsibilities)) {
    const normalized = responsibilities
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .slice(0, 10);
    if (normalized.length > 0) return normalized;
  }

  return DEFAULT_ROLE_RESPONSIBILITIES[normalizeInvitationRole(role)] || [];
};

export const generateTemporaryPassword = (length = 16) => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const required = [
    alphabet[crypto.randomInt(0, 24)],
    alphabet[crypto.randomInt(24, 49)],
    String(crypto.randomInt(2, 10)),
    "!@#$%&*?"[crypto.randomInt(0, 8)],
  ];

  while (required.length < Math.max(length, 12)) {
    required.push(alphabet[crypto.randomInt(0, alphabet.length)]);
  }

  for (let index = required.length - 1; index > 0; index -= 1) {
    const swapIndex = crypto.randomInt(0, index + 1);
    [required[index], required[swapIndex]] = [required[swapIndex], required[index]];
  }

  return required.join("");
};
