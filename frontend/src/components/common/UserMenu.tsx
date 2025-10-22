"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { shallow } from "zustand/shallow";

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

  return (
    <div className="flex items-center gap-4">
      <div className="text-sm text-slate-600 dark:text-slate-300">
        <span className="font-medium text-slate-900 dark:text-white">{user.email}</span>
      </div>
      <button
        type="button"
        onClick={handleLogout}
        disabled={isProcessing}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:outline-slate-500"
      >
        Выйти
      </button>
    </div>
  );
}
