import Link from "next/link";

export function HomeQuickActions() {
  return (
    <article className="flex flex-col justify-between gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-sky-600">Быстрые действия</p>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Запускайте работу по сделкам</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Создавайте новые сделки, назначайте ответственных и переходите к детальной работе с клиентами всего в один клик.
        </p>
      </header>

      <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
        <li className="flex items-start gap-2">
          <span className="mt-1 h-2 w-2 rounded-full bg-sky-400" aria-hidden="true" />
          <span>Просмотрите ближайшие проверки и найдите сделки, которые требуют внимания.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
          <span>Добавляйте задачи и заметки напрямую из списка сделок.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1 h-2 w-2 rounded-full bg-amber-400" aria-hidden="true" />
          <span>Следите за обновлениями платежей и реагируйте на риски раньше остальных.</span>
        </li>
      </ul>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/deals/new"
          className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500"
        >
          Новая сделка
        </Link>
        <Link
          href="/deals"
          className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:text-slate-200"
        >
          Перейти к списку
        </Link>
      </div>
    </article>
  );
}
