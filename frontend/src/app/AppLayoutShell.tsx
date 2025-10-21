"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { Providers } from "./providers";
import { AuthBootstrap } from "@/components/providers/AuthBootstrap";
import { AuthGuard } from "@/components/providers/AuthGuard";
import { NotificationCenter } from "@/components/common/NotificationCenter";
import { SSEBridge } from "@/components/providers/SSEBridge";
import { MainNavigation } from "@/components/common/MainNavigation";
import { UserMenu } from "@/components/common/UserMenu";

const PUBLIC_ONLY_ROUTES = new Set<string>(["/login", "/auth"]);

interface AppLayoutShellProps {
  children: React.ReactNode;
}

export function AppLayoutShell({ children }: AppLayoutShellProps) {
  const pathname = usePathname() ?? "/";
  const isPublicOnly = PUBLIC_ONLY_ROUTES.has(pathname);

  if (isPublicOnly) {
    return <>{children}</>;
  }

  return (
    <Providers>
      <AuthBootstrap />
      <Suspense fallback={null}>
        <AuthGuard />
      </Suspense>
      <SSEBridge />
      <NotificationCenter />
      <div className="app-shell flex min-h-screen flex-col">
        <header className="app-header">
          <div className="app-header__inner flex flex-wrap items-center justify-between gap-4">
            <MainNavigation />
            <UserMenu />
          </div>
        </header>
        <main className="app-main">{children}</main>
      </div>
    </Providers>
  );
}
