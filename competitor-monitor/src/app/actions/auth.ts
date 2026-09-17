"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { verifyCredentials } from "@/lib/credentials";
import { consumeLoginAttempt, delayFailedLogin } from "@/lib/rate-limit";
import {
  createSession,
  deleteSession,
  isAuthConfigured,
} from "@/lib/session";

const loginSchema = z.object({
  username: z.string().trim().min(1).max(120),
  password: z.string().min(1).max(200),
});

export type LoginState = {
  error?: string;
};

function clientKey(headerList: Headers): string {
  return (
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerList.get("x-real-ip") ||
    "unknown"
  );
}

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  if (!isAuthConfigured()) {
    return {
      error:
        "Login is not configured. Set AUTH_USERNAME, AUTH_PASSWORD, and SESSION_SECRET.",
    };
  }

  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Enter a username and password." };
  }

  const headerList = await headers();
  if (!consumeLoginAttempt(clientKey(headerList))) {
    return { error: "Too many attempts. Try again in a few minutes." };
  }

  const ok = verifyCredentials(parsed.data.username, parsed.data.password);
  if (!ok) {
    await delayFailedLogin();
    return { error: "Invalid username or password." };
  }

  await createSession("operator");
  redirect("/");
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect("/login");
}
