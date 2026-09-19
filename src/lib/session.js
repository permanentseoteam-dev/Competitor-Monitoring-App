"use strict";

const { SignJWT, jwtVerify } = require("jose");
const { normalizeRole } = require("./roles");

const SESSION_COOKIE = "session";
const DEFAULT_SESSION_SECRET =
  "competitor-monitor-local-session-secret-key-32";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function getSecretKey() {
  const secret = process.env.SESSION_SECRET || DEFAULT_SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  return new TextEncoder().encode(secret);
}

function isAuthConfigured() {
  const secret = process.env.SESSION_SECRET || DEFAULT_SESSION_SECRET;
  return secret.length >= 32;
}

function cookieOptions(expiresAt) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  };
}

async function encrypt(payload) {
  const secretKey = getSecretKey();
  if (!secretKey) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters.");
  }
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey);
}

async function decrypt(session) {
  const secretKey = getSecretKey();
  if (!session || !secretKey) return null;
  try {
    const { payload } = await jwtVerify(session, secretKey, {
      algorithms: ["HS256"],
    });
    const userId = typeof payload.userId === "string" ? payload.userId : null;
    const expiresAt =
      typeof payload.expiresAt === "string" ? payload.expiresAt : null;
    if (!userId || !expiresAt) return null;
    if (new Date(expiresAt).getTime() <= Date.now()) return null;
    return {
      userId,
      username:
        typeof payload.username === "string" ? payload.username : "user",
      displayName:
        typeof payload.displayName === "string"
          ? payload.displayName
          : typeof payload.username === "string"
            ? payload.username
            : "User",
      role: normalizeRole(payload.role),
      expiresAt,
    };
  } catch {
    return null;
  }
}

async function createSession(res, user) {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const token = await encrypt({
    userId: user.id || user.userId || "user",
    username: user.username || "user",
    displayName: user.displayName || user.username || "User",
    role: normalizeRole(user.role),
    expiresAt: expiresAt.toISOString(),
  });
  res.cookie(SESSION_COOKIE, token, cookieOptions(expiresAt));
}

async function deleteSession(res) {
  res.cookie(SESSION_COOKIE, "", cookieOptions(new Date(0)));
}

async function getSession(req) {
  return decrypt(req.cookies?.[SESSION_COOKIE]);
}

module.exports = {
  SESSION_COOKIE,
  isAuthConfigured,
  createSession,
  deleteSession,
  getSession,
  encrypt,
  decrypt,
};
