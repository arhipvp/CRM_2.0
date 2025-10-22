import { NextRequest, NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/config";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/auth/constants";
import type { AuthenticatedUser } from "@/types/auth";

const isProduction = process.env.NODE_ENV === "production";

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value ?? null;

  if (!accessToken) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const apiBaseUrl = getApiBaseUrl();
  const meResponse = await fetch(`${apiBaseUrl}/auth/me`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!meResponse.ok) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const user = (await meResponse.json()) as AuthenticatedUser;

  return NextResponse.json({
    authenticated: true,
    user,
    accessToken,
    refreshToken,
    secure: isProduction,
  });
}
