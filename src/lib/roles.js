"use strict";

const ROLES = ["owner", "admin", "seo-analystic"];
const PRIVILEGED_ROLES = new Set(["owner", "admin"]);

const ROLE_LABELS = {
  owner: "Owner",
  admin: "Admin",
  "seo-analystic": "SEO Analytic",
  // legacy
  operator: "SEO Analytic",
};

function normalizeRole(role) {
  const value = String(role || "")
    .trim()
    .toLowerCase();
  if (value === "operator") return "seo-analystic";
  if (ROLES.includes(value)) return value;
  return "seo-analystic";
}

function roleLabel(role) {
  const normalized = normalizeRole(role);
  return ROLE_LABELS[normalized] || ROLE_LABELS["seo-analystic"];
}

function isPrivilegedRole(role) {
  return PRIVILEGED_ROLES.has(normalizeRole(role));
}

module.exports = {
  ROLES,
  PRIVILEGED_ROLES,
  ROLE_LABELS,
  normalizeRole,
  roleLabel,
  isPrivilegedRole,
};
