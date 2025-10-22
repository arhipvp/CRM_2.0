import { NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  AUTH_COOKIE_PATH,
} from "@/lib/auth/constants";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(ACCESS_TOKEN_COOKIE, "", {
    path: AUTH_COOKIE_PATH,
    maxAge: 0,
  });
  response.cookies.set(REFRESH_TOKEN_COOKIE, "", {
    path: AUTH_COOKIE_PATH,
    maxAge: 0,
  });
  return response;
}
