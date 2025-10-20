"use client";

import { useEffect, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";

const PUBLIC_ROUTES = new Set<string>(["/login"]);

export function AuthGuard() {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();

  const { initialized, status, user } = useAuthStore((state) => ({
    initialized: state.initialized,
    status: state.status,
    user: state.user,
  }));

  const searchParamsString = useMemo(() => searchParams?.toString() ?? "", [searchParams]);

  const isLoginRoute = pathname === "/login";
  const isPublicRoute = PUBLIC_ROUTES.has(pathname);

  useEffect(() => {
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
  }, [initialized, isLoginRoute, isPublicRoute, pathname, router, searchParamsString, status, user]);

  return null;
}
