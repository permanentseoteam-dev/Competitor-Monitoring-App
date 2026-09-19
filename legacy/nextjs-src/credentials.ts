import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Temporary fixed credentials for local use
const EXPECTED_USERNAME = "Admin";
const EXPECTED_PASSWORD = "royalvapery";

function hmacCompare(left: string, right: string): boolean {
  const key = process.env.SESSION_SECRET || "auth-compare";
  const leftDigest = createHmac("sha256", key).update(left).digest();
  const rightDigest = createHmac("sha256", key).update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

export function verifyCredentials(
  username: string,
  password: string,
): boolean {
  const userOk = hmacCompare(
    username.trim().toLowerCase(),
    EXPECTED_USERNAME.toLowerCase(),
  );
  const passOk = hmacCompare(password, EXPECTED_PASSWORD);
  return userOk && passOk;
}
