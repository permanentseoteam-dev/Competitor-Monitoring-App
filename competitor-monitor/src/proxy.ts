import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decrypt, SESSION_COOKIE } from "@/lib/session-token";

function isPublicPath(pathname: string): boolean {
  return pathname === "/login";
}

function isCronPath(pathname: string): boolean {
  return pathname === "/api/cron";
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isCronPath(pathname) || isPublicPath(pathname)) {
    if (isPublicPath(pathname)) {
      const session = await decrypt(request.cookies.get(SESSION_COOKIE)?.value);
      if (session) {
        return NextResponse.redirect(new URL("/", request.nextUrl));
      }
    }
    return NextResponse.next();
  }

  const session = await decrypt(request.cookies.get(SESSION_COOKIE)?.value);
  if (session) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.nextUrl);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
