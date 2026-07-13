import crypto from "crypto";

export const INVITABLE_ADMIN_ROLES = [
  "admin",
  "superAdmin",
  "finance",
  "customerService",
  "listingManager",
];

export const ADMIN_ROLE_LABELS = {
  admin: "Admin",
  superAdmin: "Super Admin",
  finance: "Finance",
  customerService: "Customer Service",
  listingManager: "Listing Manager",
};

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
  finance: [
    "Access and query all transaction records and payment history",
    "Configure platform billing rates (tax, commission, VAT)",
    "Manage and update subscription plans and pricing",
    "Monitor platform earnings and financial analytics",
  ],
  customerService: [
    "Handle customer and designer support enquiries and disputes",
    "Review and moderate marketplace listings",
    "Monitor platform activity, users, and analytics (excluding transactions)",
    "Manage listing approvals and rejections",
  ],
  listingManager: [
    "Review, approve, and reject designer listings",
    "Monitor pending and moderated listing queues",
    "Access listing moderation history and analytics",
  ],
};

// Roles that admin (non-super) is allowed to invite
const ADMIN_INVITABLE = new Set(["finance", "customerService", "listingManager"]);
// Roles that superAdmin is allowed to invite
const SUPER_ADMIN_INVITABLE = new Set([
  "admin",
  "superAdmin",
  "finance",
  "customerService",
  "listingManager",
]);

export const normalizeInvitationEmail = (email) => String(email || "").trim().toLowerCase();

export const normalizeInvitationRole = (role) => {
  const value = String(role || "").trim().toLowerCase();
  if (value === "superadmin" || value === "super_admin") return "superAdmin";
  if (value === "customerservice" || value === "customer_service" || value === "cs") return "customerService";
  if (value === "listingmanager" || value === "listing_manager") return "listingManager";
  return value;
};

export const canInviteAdminRole = (inviterRole, targetRole) => {
  const inviter = normalizeInvitationRole(inviterRole);
  const target = normalizeInvitationRole(targetRole);

  if (inviter === "superAdmin") return SUPER_ADMIN_INVITABLE.has(target);
  if (inviter === "admin") return ADMIN_INVITABLE.has(target);
  return false;
};

export const getRoleLabel = (role) =>
  ADMIN_ROLE_LABELS[normalizeInvitationRole(role)] || "Team Member";

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
