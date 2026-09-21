"use strict";

const {
  createSession,
  deleteSession,
  getSession,
} = require("../lib/session");
const { findProfileById } = require("../lib/db");
const { normalizeRole } = require("../lib/roles");

async function requireAuth(req, res, next) {
  const session = await getSession(req);
  if (!session) {
    if (req.path.startsWith("/api/") || req.originalUrl.startsWith("/api/")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    return res.redirect("/login");
  }
  req.session = session;
  try {
    if (session.userId) {
      const profile = await findProfileById(session.userId);
      if (profile) {
        req.session.role = normalizeRole(profile.role);
        req.session.displayName = profile.displayName || session.displayName;
        req.session.username = profile.username || session.username;
      }
    }
  } catch {
    /* keep JWT session role if profile lookup fails */
  }
  return next();
}

async function optionalAuth(req, _res, next) {
  req.session = await getSession(req);
  return next();
}

module.exports = {
  requireAuth,
  optionalAuth,
  createSession,
  deleteSession,
  getSession,
};
