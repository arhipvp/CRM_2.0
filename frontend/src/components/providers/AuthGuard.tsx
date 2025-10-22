"use client";

import { useEffect, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { isAuthDisabled } from "@/lib/config";
import { useAuthStore } from "@/stores/authStore";
import { shallow } from "zustand/shallow";

const PUBLIC_ROUTES = new Set<string>(["/login", "/auth"]);
const AUTH_DISABLED = isAuthDisabled();

export function AuthGuard() {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();

  const { initialized, status, user } = useAuthStore(
    (state) => ({
      initialized: state.initialized,
      status: state.status,
      user: state.user,
    }),
    shallow,
  );

  const searchParamsString = useMemo(() => searchParams?.toString() ?? "", [searchParams]);

  const isLoginRoute = pathname === "/login";
  const isPublicRoute = PUBLIC_ROUTES.has(pathname);
  const authDisabled = AUTH_DISABLED;

  useEffect(() => {
    if (authDisabled) {
      if (isLoginRoute) {
        router.replace("/");
      }
      return;
    }

    if (!initialized) {
      return;
    }

    const isAuthenticated = status === "authenticated" && Boolean(user);

    if (isAuthenticated) {
      if (isLoginRoute) {
        router.replace("/");
      }
      return;
    }

    if (!isPublicRoute) {
      let redirectTarget = pathname;

      if (searchParamsString) {
        redirectTarget = `${redirectTarget}?${searchParamsString}`;
      }

      const redirectSuffix = redirectTarget !== "/" ? `?redirect=${encodeURIComponent(redirectTarget)}` : "";
      router.replace(`/login${redirectSuffix}`);
    }
  }, [authDisabled, initialized, isLoginRoute, isPublicRoute, pathname, router, searchParamsString, status, user]);

  return null;
}
