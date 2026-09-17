import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "session";

export type SessionPayload = {
  userId: string;
  expiresAt: string;
};

function getSecretKey(): Uint8Array | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  return new TextEncoder().encode(secret);
}

export function isAuthConfigured(): boolean {
  return Boolean(
    process.env.AUTH_USERNAME &&
      process.env.AUTH_PASSWORD &&
      process.env.SESSION_SECRET &&
      process.env.SESSION_SECRET.length >= 32,
  );
}

export async function encrypt(payload: SessionPayload): Promise<string> {
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

export async function decrypt(
  session: string | undefined,
): Promise<SessionPayload | null> {
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
    return { userId, expiresAt };
  } catch {
    return null;
  }
}
