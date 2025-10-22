import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth/constants";

const PUBLIC_PATHS = new Set(["/login", "/auth"]);

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.has(pathname);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname.startsWith("/api/") || pathname.startsWith("/static")) {
    return NextResponse.next();
  }

  if (pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  const hasToken = Boolean(request.cookies.get(ACCESS_TOKEN_COOKIE)?.value);

  // Allow all non-public paths without token - the client-side auth guard will handle redirects
  // This is necessary for AUTH_DISABLED mode to work properly
  if (!hasToken && !isPublicPath(pathname)) {
    // Don't redirect here - let the client-side AuthGuard handle it
    // This allows AUTH_DISABLED mode to work without requiring a token
    return NextResponse.next();
  }

  if (hasToken && (pathname === "/login" || pathname === "/auth")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
