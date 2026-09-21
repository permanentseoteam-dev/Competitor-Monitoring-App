"use strict";

const { verifyPasswordHash } = require("./password");
const { ensureDefaultProfile, findProfileByUsername } = require("./db");

async function verifyCredentials(username, password) {
  await ensureDefaultProfile();
  const profile = await findProfileByUsername(username);
  if (!profile) return null;
  const ok = await verifyPasswordHash(password, profile.passwordHash);
  if (!ok) return null;
  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.displayName,
    role: profile.role,
  };
}

module.exports = { verifyCredentials };
