export default function PoliciesPage() {
  const statusFilters = [
    { label: "Все", value: "all", isActive: true },
    { label: "Активные", value: "active" },
    { label: "Истекают", value: "expiring" },
    { label: "Архив", value: "archived" },
  ];

  const summaryCards = [
    { label: "Активных полисов", value: "—" },
    { label: "Истекает в 30 дней", value: "—" },
    { label: "Согласование", value: "—" },
    { label: "Архив", value: "—" },
  ];

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Полисы</h1>
        <p className="text-slate-500 dark:text-slate-300">
          Контролируйте жизненный цикл страховых полисов: от согласования и продления до архивации.
        </p>
      </header>

      <section className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {statusFilters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                className={[
                  "rounded-full px-4 py-2 text-sm font-medium transition",
                  filter.isActive
                    ? "bg-sky-600 text-white shadow-sm hover:bg-sky-500"
                    : "border border-slate-200 text-slate-600 hover:border-sky-200 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:border-sky-500",
                ].join(" ")}
                aria-pressed={filter.isActive}
                disabled={!filter.isActive}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-300">
              <span className="whitespace-nowrap">Поиск</span>
              <input
                type="search"
                placeholder="Номер полиса или клиент"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                disabled
              />
            </label>
            <label className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-300">
              <span className="whitespace-nowrap">Продукт</span>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                disabled
              >
                <option>Все продукты</option>
              </select>
            </label>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {summaryCards.map((card) => (
            <article
              key={card.label}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-800/70"
            >
              <p className="text-slate-500 dark:text-slate-300">{card.label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{card.value}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
        <header className="flex flex-col gap-2 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Реестр полисов</h2>
              <p className="text-sm text-slate-500 dark:text-slate-300">
                Таблица появится после подключения бекенда. Здесь будет сводная информация по номерам, продуктам и статусу.
              </p>
            </div>
            <button
              type="button"
              className="self-start rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500"
              disabled
            >
              Новый полис
            </button>
          </div>
        </header>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-300">
              <tr>
                <th scope="col" className="px-6 py-3">Номер</th>
                <th scope="col" className="px-6 py-3">Клиент</th>
                <th scope="col" className="px-6 py-3">Продукт</th>
                <th scope="col" className="px-6 py-3">Страховщик</th>
                <th scope="col" className="px-6 py-3">Премия</th>
                <th scope="col" className="px-6 py-3">Период действия</th>
                <th scope="col" className="px-6 py-3">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900/70">
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-500 dark:text-slate-300">
                  Данные загрузятся позже. На этом месте появятся строки с активными и архивными полисами.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <footer className="flex flex-col gap-3 border-t border-slate-200 px-6 py-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-300 sm:flex-row sm:items-center sm:justify-between">
          <span>Пагинация и экспорт станут доступны после интеграции с API.</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400 transition dark:border-slate-700 dark:text-slate-500"
              disabled
            >
              Назад
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400 transition dark:border-slate-700 dark:text-slate-500"
              disabled
            >
              Вперёд
            </button>
          </div>
        </footer>
      </section>
    </main>
  );
}
