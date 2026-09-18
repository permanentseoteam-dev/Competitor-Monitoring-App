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
        "Login is not configured. Set AUTH_USERNAME, AUTH_PASSWORD, and SESSION_SECRET.",
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

  const ok = verifyCredentials(parsed.data.username, parsed.data.password);
  if (!ok) {
    await delayFailedLogin();
    return res.status(401).render("login", {
      error: "Invalid username or password.",
      title: "Sign in",
    });
  }

  await createSession(res, "operator");
  return res.redirect("/");
});

router.post("/logout", async (_req, res) => {
  await deleteSession(res);
  return res.redirect("/login");
});

module.exports = router;
