"use strict";

const { createHmac, timingSafeEqual } = require("node:crypto");

const EXPECTED_USERNAME =
  process.env.AUTH_USERNAME || "Admin";
const EXPECTED_PASSWORD =
  process.env.AUTH_PASSWORD || "royalvapery";

function hmacCompare(left, right) {
  const key = process.env.SESSION_SECRET || "auth-compare";
  const leftDigest = createHmac("sha256", key).update(left).digest();
  const rightDigest = createHmac("sha256", key).update(right).digest();
  if (leftDigest.length !== rightDigest.length) return false;
  return timingSafeEqual(leftDigest, rightDigest);
}

function verifyCredentials(username, password) {
  const userOk = hmacCompare(
    String(username || "").trim().toLowerCase(),
    EXPECTED_USERNAME.toLowerCase(),
  );
  const passOk = hmacCompare(String(password || ""), EXPECTED_PASSWORD);
  return userOk && passOk;
}

module.exports = { verifyCredentials };
