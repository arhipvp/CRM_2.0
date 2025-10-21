"use client";

import { create } from "zustand";
import { apiClient } from "@/lib/api/client";
import { isAuthDisabled } from "@/lib/config";
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

const AUTH_DISABLED = isAuthDisabled();

const DEBUG_USER: AuthenticatedUser = {
  id: "debug-user",
  email: "debug@local",
  enabled: true,
  roles: [
    {
      id: "debug-role",
      name: "Debug Access",
      description: "Temporary debug role with full access",
    },
  ],
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

function readCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const cookies = document.cookie ? document.cookie.split("; ") : [];
  for (const cookie of cookies) {
    const [encodedName, ...rest] = cookie.split("=");
    if (decodeURIComponent(encodedName) === name) {
      return decodeURIComponent(rest.join("="));
    }
  }

  return null;
}

function clearClientCookies() {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${ACCESS_TOKEN_COOKIE}=; path=/; max-age=0`;
  document.cookie = `${REFRESH_TOKEN_COOKIE}=; path=/; max-age=0`;
}

if (AUTH_DISABLED) {
  apiClient.setAuthToken(null);
}

export const useAuthStore = create<AuthStoreState>((set, get) => {
  const establishDebugSession = () => {
    apiClient.setAuthToken(null);
    set({
      user: DEBUG_USER,
      accessToken: null,
      refreshToken: null,
      status: "authenticated",
      error: null,
      initialized: true,
    });
  };

  const redirectToLogin = () => {
    if (typeof window === "undefined") {
      return;
    }

    const pathname = window.location.pathname ?? "/";
    const search = window.location.search ?? "";

    if (pathname === "/login") {
      return;
    }

    const redirectTarget = `${pathname}${search}`;
    const needsRedirect = redirectTarget !== "/" && redirectTarget !== "/login";
    const suffix = needsRedirect ? `?redirect=${encodeURIComponent(redirectTarget)}` : "";

    window.location.replace(`/login${suffix}`);
  };

  const setUnauthenticatedState = () => {
    if (AUTH_DISABLED) {
      establishDebugSession();
      return;
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
  };

  const handleUnauthorized = async () => {
    setUnauthenticatedState();
    if (!AUTH_DISABLED) {
      redirectToLogin();
    }
  };

  apiClient.setUnauthorizedHandler(handleUnauthorized);

  return {
    user: AUTH_DISABLED ? DEBUG_USER : null,
    accessToken: null,
    refreshToken: null,
    status: AUTH_DISABLED ? "authenticated" : "idle",
    error: null,
    initialized: AUTH_DISABLED,

    setUser: (user) => {
      set({ user });
    },

    initialize: async () => {
      if (typeof window === "undefined") {
        return;
      }

      if (AUTH_DISABLED) {
        if (!get().initialized) {
          establishDebugSession();
        }
        return;
      }

      if (get().initialized) {
        return;
      }

      const accessToken = readCookie(ACCESS_TOKEN_COOKIE);
      const refreshToken = readCookie(REFRESH_TOKEN_COOKIE);

      if (!accessToken) {
        setUnauthenticatedState();
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
        setUnauthenticatedState();
      }
    },

    login: async (email: string, password: string) => {
      if (AUTH_DISABLED) {
        establishDebugSession();
        return true;
      }

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
      if (AUTH_DISABLED) {
        establishDebugSession();
        return;
      }

      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch (error) {
        console.warn("[Auth] Logout request failed", error);
      }

      setUnauthenticatedState();
    },
  };
});
