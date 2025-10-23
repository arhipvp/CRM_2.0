"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { shallow } from "zustand/shallow";

const UserAvatarIcon = ({ initials }: { initials: string }) => (
  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
    {initials}
  </div>
);

export function UserMenu() {
  const router = useRouter();
  const { user, status, logout } = useAuthStore(
    (state) => ({
      user: state.user,
      status: state.status,
      logout: state.logout,
    }),
    shallow,
  );
  const [isProcessing, setProcessing] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  if (status === "idle" || status === "loading") {
    return null;
  }

  if (!user) {
    return null;
  }

  const handleLogout = async () => {
    if (isProcessing) {
      return;
    }

    setProcessing(true);
    await logout();
    setProcessing(false);
    router.push("/login");
  };

  // Extract initials from email
  const getInitials = (email: string) => {
    const parts = email.split("@");
    if (parts.length > 0 && parts[0].length > 0) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return "U";
  };

  const initials = getInitials(user.email);

  return (
    <div className="relative flex items-center gap-3">
      {/* User Profile Button */}
      <button
        type="button"
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 dark:hover:bg-slate-800 dark:focus-visible:outline-slate-500"
        aria-label="Меню пользователя"
        aria-expanded={isMenuOpen}
        aria-haspopup="menu"
      >
        <UserAvatarIcon initials={initials} />
        <div className="hidden flex-col items-start text-xs sm:flex">
          <span className="font-medium text-slate-900 dark:text-white">{user.email}</span>
          {user.roles && user.roles.length > 0 && (
            <span className="text-slate-600 dark:text-slate-400">{user.roles[0].name}</span>
          )}
        </div>
        <svg
          className={`h-4 w-4 transition-transform ${isMenuOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isMenuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-48 rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          {/* User Info Section */}
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <UserAvatarIcon initials={initials} />
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{user.email}</p>
                {user.roles && user.roles.length > 0 && (
                  <p className="truncate text-xs text-slate-600 dark:text-slate-400">{user.roles[0].name}</p>
                )}
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 dark:text-slate-300 dark:hover:bg-slate-800 dark:focus-visible:outline-slate-500"
              role="menuitem"
            >
              Профиль
            </button>
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 dark:text-slate-300 dark:hover:bg-slate-800 dark:focus-visible:outline-slate-500"
              role="menuitem"
            >
              Настройки
            </button>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-200 dark:border-slate-700" />

          {/* Logout */}
          <div className="py-1">
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                handleLogout();
              }}
              disabled={isProcessing}
              className="w-full px-4 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-400 dark:hover:bg-slate-800 dark:focus-visible:outline-red-500"
              role="menuitem"
            >
              {isProcessing ? "Выход..." : "Выйти"}
            </button>
          </div>
        </div>
      )}

      {/* Fallback: Simple Logout Button for Mobile */}
      {!isMenuOpen && (
        <button
          type="button"
          onClick={handleLogout}
          disabled={isProcessing}
          className="sm:hidden rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:outline-slate-500"
          aria-label="Выйти"
        >
          {isProcessing ? "..." : "Выход"}
        </button>
      )}
    </div>
  );
}
