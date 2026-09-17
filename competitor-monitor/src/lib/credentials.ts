import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

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
  const expectedUser = process.env.AUTH_USERNAME ?? "";
  const expectedPass = process.env.AUTH_PASSWORD ?? "";
  const userOk = hmacCompare(username, expectedUser);
  const passOk = hmacCompare(password, expectedPass);
  return Boolean(expectedUser && expectedPass && userOk && passOk);
}
