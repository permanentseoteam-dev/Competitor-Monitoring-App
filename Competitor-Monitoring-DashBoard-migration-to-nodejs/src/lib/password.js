"use strict";

const { promisify } = require("node:util");
const { randomBytes, scrypt, timingSafeEqual } = require("node:crypto");

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(String(password), salt, 64);
  return `${salt}:${Buffer.from(derived).toString("hex")}`;
}

async function verifyPasswordHash(password, stored) {
  if (!stored || typeof stored !== "string" || !stored.includes(":")) {
    return false;
  }
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  try {
    const derived = await scryptAsync(String(password), salt, 64);
    const left = Buffer.from(hash, "hex");
    const right = Buffer.from(derived);
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

module.exports = { hashPassword, verifyPasswordHash };
