import { NextRequest, NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/config";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  AUTH_COOKIE_PATH,
  DEFAULT_COOKIE_MAX_AGE,
} from "@/lib/auth/constants";
import type { AuthenticatedUser } from "@/types/auth";

interface TokenResponse {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresIn: number;
}

interface LoginPayload {
  email: string;
  password: string;
}

const isProduction = process.env.NODE_ENV === "production";

function normalizeError(status: number, message: string | undefined) {
  if (status === 401 || status === 403) {
    return { status: 401, body: { error: "invalid_credentials" } };
  }

  return {
    status: status >= 400 ? status : 500,
    body: { error: message || "auth_failed" },
  };
}

function buildCookieOptions(maxAge: number) {
  return {
    httpOnly: false,
    secure: isProduction,
    path: AUTH_COOKIE_PATH,
    sameSite: "lax" as const,
    maxAge: maxAge > 0 ? maxAge : DEFAULT_COOKIE_MAX_AGE,
  };
}

export async function POST(request: NextRequest) {
  let payload: LoginPayload;

  try {
    payload = (await request.json()) as LoginPayload;
  } catch {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  if (!payload.email || !payload.password) {
    return NextResponse.json({ error: "missing_credentials" }, { status: 400 });
  }

  const apiBaseUrl = getApiBaseUrl();

  const tokenResponse = await fetch(`${apiBaseUrl}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      email: payload.email,
      password: payload.password,
    }),
  });

  if (!tokenResponse.ok) {
    const text = await tokenResponse.text();
    const { status, body } = normalizeError(tokenResponse.status, text || tokenResponse.statusText);
    return NextResponse.json(body, { status });
  }

  const tokenData = (await tokenResponse.json()) as TokenResponse;
  const meResponse = await fetch(`${apiBaseUrl}/auth/me`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${tokenData.accessToken}`,
    },
  });

  if (!meResponse.ok) {
    const text = await meResponse.text();
    const { status, body } = normalizeError(meResponse.status, text || meResponse.statusText);
    return NextResponse.json(body, { status });
  }

  const user = (await meResponse.json()) as AuthenticatedUser;
  const response = NextResponse.json(
    {
      user,
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      expiresIn: tokenData.expiresIn,
      refreshExpiresIn: tokenData.refreshExpiresIn,
    },
    { status: 200 },
  );

  response.cookies.set(ACCESS_TOKEN_COOKIE, tokenData.accessToken, buildCookieOptions(tokenData.expiresIn));
  response.cookies.set(REFRESH_TOKEN_COOKIE, tokenData.refreshToken, buildCookieOptions(tokenData.refreshExpiresIn));

  return response;
}
