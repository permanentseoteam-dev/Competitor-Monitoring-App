"use strict";

const express = require("express");
const { z } = require("zod");
const { verifyCredentials } = require("../lib/credentials");
const { consumeLoginAttempt, delayFailedLogin } = require("../lib/rate-limit");
const {
  createSession,
  deleteSession,
  isAuthConfigured,
} = require("../lib/session");
const { acceptInvite, findInviteByToken } = require("../lib/db");
const { roleLabel, normalizeRole } = require("../lib/roles");

const router = express.Router();

const loginSchema = z.object({
  username: z.string().trim().min(1).max(120),
  password: z.string().min(1).max(200),
});

function clientKey(req) {
  return (
    req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
    req.ip ||
    "unknown"
  );
}

router.get("/login", async (req, res) => {
  const { getSession } = require("../lib/session");
  const session = await getSession(req);
  if (session) return res.redirect("/");
  return res.render("login", { error: null, title: "Sign in" });
});

router.post("/login", async (req, res) => {
  if (!isAuthConfigured()) {
    return res.status(500).render("login", {
      error:
        "Login is not configured. Set SESSION_SECRET (and optionally seed AUTH_USERNAME / AUTH_PASSWORD).",
      title: "Sign in",
    });
  }

  const parsed = loginSchema.safeParse({
    username: req.body.username,
    password: req.body.password,
  });
  if (!parsed.success) {
    return res.status(400).render("login", {
      error: "Enter a username and password.",
      title: "Sign in",
    });
  }

  if (!consumeLoginAttempt(clientKey(req))) {
    return res.status(429).render("login", {
      error: "Too many attempts. Try again in a few minutes.",
      title: "Sign in",
    });
  }

  const profile = await verifyCredentials(
    parsed.data.username,
    parsed.data.password,
  );
  if (!profile) {
    await delayFailedLogin();
    return res.status(401).render("login", {
      error: "Invalid username or password.",
      title: "Sign in",
    });
  }

  await createSession(res, profile);
  return res.redirect("/");
});

router.post("/logout", async (_req, res) => {
  await deleteSession(res);
  return res.redirect("/login");
});

router.get("/invite/:token", async (req, res) => {
  const token = String(req.params.token || "").trim();
  const invite = await findInviteByToken(token);
  if (!invite || invite.usedAt || Date.parse(invite.expiresAt) <= Date.now()) {
    return res.status(400).render("invite", {
      token,
      roleLabel: "User",
      note: "",
      error: null,
      invalid: "This invite link is invalid or has expired.",
    });
  }
  return res.render("invite", {
    token: invite.token,
    roleLabel: roleLabel(invite.role),
    note: invite.note || "",
    error: null,
    invalid: null,
  });
});

router.post("/invite/:token", async (req, res) => {
  const token = String(req.params.token || "").trim();
  const invite = await findInviteByToken(token);
  const role = invite ? normalizeRole(invite.role) : "user";

  if (!invite || invite.usedAt || Date.parse(invite.expiresAt) <= Date.now()) {
    return res.status(400).render("invite", {
      token,
      roleLabel: roleLabel(role),
      note: "",
      error: null,
      invalid: "This invite link is invalid or has expired.",
    });
  }

  try {
    const profile = await acceptInvite({
      token,
      username: req.body.username,
      password: req.body.password,
      displayName: req.body.displayName,
    });
    await createSession(res, profile);
    return res.redirect("/");
  } catch (error) {
    return res.status(400).render("invite", {
      token,
      roleLabel: roleLabel(role),
      note: invite.note || "",
      error: error.message || "Could not create account",
      invalid: null,
    });
  }
});

module.exports = router;
