"use client";

import { HomeOverview } from "@/components/home/HomeOverview";
import { createDefaultDealFilters } from "@/lib/utils/dealFilters";

export default function HomePage() {
  const defaultFilters = createDefaultDealFilters();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Главная</h1>
        <p className="text-slate-500 dark:text-slate-300">
          Отслеживайте ключевые показатели воронки и настраивайте фильтры для анализа без перехода на другие страницы.
        </p>
      </header>

      <HomeOverview defaultFilters={defaultFilters} />
    </main>
  );
}
