"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";

interface NavLink {
  href: string;
  label: string;
  icon: React.ReactNode;
  ariaLabel: string;
}

// Simple inline SVG icons
const HomeIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-3m0 0l7-4 7 4M5 9v10a1 1 0 001 1h3m10-11l2 3m-2-3v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const DealsIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ClientsIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.856-1.487M15 10a3 3 0 11-6 0 3 3 0 016 0zM15 20H9m6 0h6m-13-4a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const TasksIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
);

const PaymentsIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h4m4 0h4M7 20h10a2 2 0 002-2V6a2 2 0 00-2-2H7a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const PoliciesIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </svg>
);

const NotificationsIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

const AdminIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const primaryLinks: NavLink[] = [
  { href: "/", label: "Главная", icon: <HomeIcon />, ariaLabel: "Перейти на главную" },
  { href: "/deals", label: "Сделки", icon: <DealsIcon />, ariaLabel: "Перейти на страницу сделок" },
  { href: "/clients", label: "Клиенты", icon: <ClientsIcon />, ariaLabel: "Перейти на страницу клиентов" },
  { href: "/tasks", label: "Задачи", icon: <TasksIcon />, ariaLabel: "Перейти на страницу задач" },
  { href: "/payments", label: "Платежи", icon: <PaymentsIcon />, ariaLabel: "Перейти на страницу платежей" },
  { href: "/policies", label: "Полисы", icon: <PoliciesIcon />, ariaLabel: "Перейти на страницу полисов" },
  { href: "/notifications", label: "Уведомления", icon: <NotificationsIcon />, ariaLabel: "Перейти на страницу уведомлений" },
  { href: "/admin", label: "Администрирование", icon: <AdminIcon />, ariaLabel: "Перейти на страницу администрирования" },
];

const getLinkClasses = (isActive: boolean) =>
  [
    "relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 whitespace-nowrap",
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

interface MainNavigationProps {
  showIcons?: boolean;
  showLabels?: boolean;
}

export const MainNavigation = ({ showIcons = true, showLabels = true }: MainNavigationProps) => {
  const pathname = usePathname() ?? "/";
  const isAuthenticated = useAuthStore((state) => state.status === "authenticated" && Boolean(state.user));
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="flex items-center gap-2 lg:hidden">
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 dark:text-slate-300 dark:hover:bg-slate-800 dark:focus-visible:outline-slate-500"
          aria-label="Меню навигации"
          aria-expanded={isMobileMenuOpen}
          aria-controls="main-nav-menu"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d={isMobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
            />
          </svg>
        </button>
      </div>

      {/* Desktop Navigation */}
      <nav id="main-nav-menu" aria-label="Основные разделы" className="hidden flex-wrap gap-1 lg:flex">
        {primaryLinks.map((link) => {
          const isActive = isActivePath(pathname, link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive ? "page" : undefined}
              title={link.ariaLabel}
              className={getLinkClasses(isActive)}
            >
              {showIcons && link.icon}
              {showLabels && <span>{link.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Mobile Navigation Menu (Collapsible) */}
      {isMobileMenuOpen && (
        <nav
          id="main-nav-menu"
          aria-label="Основные разделы (мобильное меню)"
          className="absolute left-0 right-0 top-full z-50 flex flex-col gap-1 border-t border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900 lg:hidden"
        >
          {primaryLinks.map((link) => {
            const isActive = isActivePath(pathname, link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={getLinkClasses(isActive)}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.icon}
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
};
