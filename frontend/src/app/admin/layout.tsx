import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Администрирование · CRM 2.0",
  description: "Панель главного админа для управления пользователями, справочниками и аудитом.",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-6 py-8">
        <div className="flex flex-col gap-3">
          <nav className="text-sm text-slate-500 dark:text-slate-400">
            <Link href="/" className="hover:text-slate-700 dark:hover:text-slate-200">
              Главная
            </Link>
            <span className="mx-2">/</span>
            <span className="font-medium text-slate-700 dark:text-slate-200">Администрирование</span>
          </nav>
          <div>
            <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Администрирование</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Управляйте доступом, системными справочниками и следите за историей изменений.
            </p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
