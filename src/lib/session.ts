import "server-only";
import { cookies } from "next/headers";
import {
  decrypt,
  encrypt,
  SESSION_COOKIE,
  type SessionPayload,
} from "@/lib/session-token";

export {
  decrypt,
  encrypt,
  isAuthConfigured,
  SESSION_COOKIE,
  type SessionPayload,
} from "@/lib/session-token";

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function cookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    sameSite: "lax" as const,
    path: "/",
  };
}

export async function createSession(userId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const session = await encrypt({ userId, expiresAt: expiresAt.toISOString() });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, session, cookieOptions(expiresAt));
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", cookieOptions(new Date(0)));
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  return decrypt(cookieStore.get(SESSION_COOKIE)?.value);
}
