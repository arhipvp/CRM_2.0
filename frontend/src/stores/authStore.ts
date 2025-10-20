"use client";

import { create } from "zustand";
import { apiClient } from "@/lib/api/client";
import type { AuthenticatedUser } from "@/types/auth";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/auth/constants";

type AuthStatus = "idle" | "loading" | "authenticated" | "error";

interface AuthStoreState {
  user: AuthenticatedUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  status: AuthStatus;
  error: string | null;
  initialized: boolean;
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  setUser: (user: AuthenticatedUser | null) => void;
}

interface SessionResponse {
  authenticated: boolean;
  user: AuthenticatedUser;
  accessToken: string;
  refreshToken: string | null;
}

interface LoginResponse {
  user: AuthenticatedUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const pattern = new RegExp(`(?:^|; )${name.replace(/([$?*|{}()[\]\\/+^])/g, "\\$1")}=([^;]*)`);
  const match = document.cookie.match(pattern);
  return match ? decodeURIComponent(match[1]) : null;
}

function clearClientCookies() {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${ACCESS_TOKEN_COOKIE}=; path=/; max-age=0`;
  document.cookie = `${REFRESH_TOKEN_COOKIE}=; path=/; max-age=0`;
}

export const useAuthStore = create<AuthStoreState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  status: "idle",
  error: null,
  initialized: false,

  setUser: (user) => {
    set({ user });
  },

  initialize: async () => {
    if (typeof window === "undefined") {
      return;
    }

    if (get().initialized) {
      return;
    }

    const accessToken = readCookie(ACCESS_TOKEN_COOKIE);
    const refreshToken = readCookie(REFRESH_TOKEN_COOKIE);

    if (!accessToken) {
      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        status: "idle",
        error: null,
        initialized: true,
      });
      apiClient.setAuthToken(null);
      return;
    }

    set({ status: "loading", error: null });

    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Session request failed with status ${response.status}`);
      }

      const data = (await response.json()) as SessionResponse;
      if (!data.authenticated) {
        throw new Error("Session is not authenticated");
      }

      apiClient.setAuthToken(data.accessToken ?? accessToken);
      set({
        user: data.user,
        accessToken: data.accessToken ?? accessToken,
        refreshToken: data.refreshToken ?? refreshToken,
        status: "authenticated",
        error: null,
        initialized: true,
      });
    } catch (error) {
      console.warn("[Auth] Failed to restore session", error);
      apiClient.setAuthToken(null);
      clearClientCookies();
      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        status: "idle",
        error: null,
        initialized: true,
      });
    }
  },

  login: async (email: string, password: string) => {
    set({ status: "loading", error: null });

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "login_failed" }));
        set({
          status: "error",
          error: typeof data?.error === "string" ? data.error : "login_failed",
        });
        apiClient.setAuthToken(null);
        return false;
      }

      const data = (await response.json()) as LoginResponse;
      apiClient.setAuthToken(data.accessToken);
      set({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        status: "authenticated",
        error: null,
        initialized: true,
      });

      return true;
    } catch (error) {
      console.error("[Auth] Login failed", error);
      set({
        status: "error",
        error: "login_failed",
      });
      apiClient.setAuthToken(null);
      return false;
    }
  },

  logout: async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (error) {
      console.warn("[Auth] Logout request failed", error);
    }

    apiClient.setAuthToken(null);
    clearClientCookies();
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      status: "idle",
      error: null,
      initialized: true,
    });
  },
}));
