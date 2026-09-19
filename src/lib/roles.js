"use strict";

/** Canonical roles for the dashboard. */
const ROLES = ["super-admin", "admin", "user"];

const PRIVILEGED_ROLES = new Set(["super-admin", "admin"]);
const SUPER_ADMIN_ROLES = new Set(["super-admin"]);

const ROLE_LABELS = {
  "super-admin": "Super Admin",
  admin: "Admin",
  user: "User",
  // legacy aliases (normalized away)
  owner: "Super Admin",
  "seo-analystic": "User",
  operator: "User",
};

/**
 * Normalize any stored / submitted role to a canonical value.
 * Legacy: owner → super-admin, seo-analystic/operator → user.
 */
function normalizeRole(role) {
  const value = String(role || "")
    .trim()
    .toLowerCase();
  if (value === "owner") return "super-admin";
  if (value === "operator" || value === "seo-analystic") return "user";
  if (ROLES.includes(value)) return value;
  return "user";
}

function roleLabel(role) {
  const normalized = normalizeRole(role);
  return ROLE_LABELS[normalized] || ROLE_LABELS.user;
}

function isPrivilegedRole(role) {
  return PRIVILEGED_ROLES.has(normalizeRole(role));
}

function isSuperAdminRole(role) {
  return SUPER_ADMIN_ROLES.has(normalizeRole(role));
}

function isPlanAdminRole(role) {
  return normalizeRole(role) === "admin" || isSuperAdminRole(role);
}

/** Roles a given actor is allowed to assign when creating/editing profiles. */
function assignableRolesFor(actorRole) {
  const actor = normalizeRole(actorRole);
  if (actor === "super-admin") return [...ROLES];
  if (actor === "admin") return ["user"];
  return [];
}

module.exports = {
  ROLES,
  PRIVILEGED_ROLES,
  SUPER_ADMIN_ROLES,
  ROLE_LABELS,
  normalizeRole,
  roleLabel,
  isPrivilegedRole,
  isSuperAdminRole,
  isPlanAdminRole,
  assignableRolesFor,
};
