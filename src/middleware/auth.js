"use strict";

const {
  createSession,
  deleteSession,
  getSession,
} = require("../lib/session");

async function requireAuth(req, res, next) {
  const session = await getSession(req);
  if (!session) {
    if (req.path.startsWith("/api/") || req.originalUrl.startsWith("/api/")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    return res.redirect("/login");
  }
  req.session = session;
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
