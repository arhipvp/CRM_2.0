"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";

const primaryLinks = [
  { href: "/", label: "Главная" },
  { href: "/deals", label: "Сделки" },
  { href: "/clients", label: "Клиенты" },
  { href: "/tasks", label: "Задачи" },
  { href: "/payments", label: "Платежи" },
  { href: "/policies", label: "Полисы" },
  { href: "/notifications", label: "Уведомления" },
  { href: "/admin", label: "Администрирование" },
] as const;

const getLinkClasses = (isActive: boolean) =>
  [
    "rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
    isActive
      ? "bg-slate-900 text-white focus-visible:outline-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:focus-visible:outline-slate-100"
      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-slate-400 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white dark:focus-visible:outline-slate-500",
  ].join(" ");

const isActivePath = (pathname: string, href: string) => {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
};

export const MainNavigation = () => {
  const pathname = usePathname() ?? "/";
  const isAuthenticated = useAuthStore((state) => state.status === "authenticated" && Boolean(state.user));

  if (!isAuthenticated) {
    return null;
  }

  return (
    <nav aria-label="Основные разделы" className="flex flex-wrap gap-2">
      {primaryLinks.map((link) => {
        const isActive = isActivePath(pathname, link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? "page" : undefined}
            className={getLinkClasses(isActive)}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
};

