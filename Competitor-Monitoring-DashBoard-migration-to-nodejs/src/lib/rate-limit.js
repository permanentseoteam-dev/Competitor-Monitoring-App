"use strict";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const buckets = new Map();

function consumeLoginAttempt(key) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (current.count >= MAX_ATTEMPTS) return false;
  current.count += 1;
  return true;
}

async function delayFailedLogin() {
  await new Promise((resolve) => setTimeout(resolve, 250));
}

module.exports = { consumeLoginAttempt, delayFailedLogin };
