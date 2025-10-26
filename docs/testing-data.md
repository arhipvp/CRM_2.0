# Тестовые данные CRM 2.0

## Назначение

Набор тестовых данных помогает быстро воспроизводить ключевые бизнес-процессы (инициация сделки, расчёт полиса, фиксация платежей, напоминания по задачам) в локальной среде и на стендах QA. Файлы предназначены для ручной валидации пользовательских сценариев и smoke-проверок после обновлений схемы БД.

> ℹ️ Каталог `backups/postgres/seeds` содержит идемпотентные SQL-скрипты `seed_20240715_auth.sql` и `seed_20240715_crm.sql`. README с порядком запуска находится в `backups/postgres/seeds/README.md`.

## Состав стандартного набора (июль 2024)

| Домен | Файл | Содержимое | Примечания |
| --- | --- | --- | --- |
| Auth | `seed_20240715_auth.sql` | Роли `ROLE_SALES_AGENT`, `ROLE_EXECUTOR`, `ROLE_ROOT_ADMIN` и пять активных пользователей (email `*@example.com`). | Пароль всех аккаунтов — `Passw0rd!` (bcrypt, 12 раундов). Используются UUID, согласованные с CRM. |
| CRM / Deals & Policies | `seed_20240715_crm.sql` | Два клиента (юрлицо и физлицо), две сделки со статусами `in_progress` и `proposal_sent`, два полиса с действующими периодами и связанные записи задач/журналов. | Ссылки на пользователей Auth обеспечивают трассировку владельцев и авторов сущностей (`created_by_id`, `updated_by_id`). Значения премий отражают реальные суммы сценариев. |
| CRM / Tasks | `seed_20240715_crm.sql` | Две активные задачи, привязанные к сделкам и пользователям, со статусами `pending` и `in_progress`, сроками и комментариями для проверки напоминаний и загрузки канбана. | Значения `assignee_id`/`author_id` совпадают с пользователями из Auth, записи сразу создаются в схеме `tasks`, справочник `task_statuses` загружается миграциями CRM. |
| CRM / Payments | `seed_20240715_crm.sql` | Три финансовые записи на полисы (премия `5d8d0d68-…7777`, комиссия `3c3ab2c4-…8888`, расход `af5f1f29-…9999`) с агрегированными суммами в `crm.payments` и детализацией в `crm.payment_incomes`/`crm.payment_expenses`. | Для каждого платежа и позиции сохранены пользователи создания и последних правок; суммы сходятся с агрегатом платежа. |

Премия, комиссия и расход оформлены на одном корпоративном полисе `CR-2024-0001`, чтобы продемонстрировать полную связку `crm.payments` ↔ `crm.payment_incomes`/`crm.payment_expenses`. Значения `incomes_total`, `expenses_total` и `net_total` совпадают с суммами из позиций: для расхода (`af5f1f29-…9999`) чистый результат отрицательный, что помогает проверять отчётность и отчёты по маржинальности.

Отдельный файл `seed_20240715_payments.sql` больше не требуется: факт оплаты полиса входит в основной seed CRM и хранится в `crm.payments` с привязкой к позициям доходов и расходов.

Структура задач описана в Alembic-миграциях CRM (`backend/crm/migrations/versions/2025102601_add_tasks_module.py`, `backend/crm/migrations/versions/2025102604_migrate_crm_tasks_to_tasks_schema.py`): они управляют схемой `tasks`, в том числе справочником статусов и переносом легаси-записей в новые таблицы. После загрузки seed-файла smoke-тесты выполняйте по таблицам `tasks.tasks`, `tasks.task_statuses` и `tasks.task_reminders`. Напоминания обрабатываются Celery-задачей `crm.app.tasks.process_task_reminders`, которая использует очередь Redis `CRM_TASKS_REMINDERS_QUEUE_KEY` (по умолчанию `tasks:reminders`) и публикует события в `CRM_TASKS_EVENTS_EXCHANGE` (см. `backend/crm/crm/app/tasks.py`, `docs/api/tasks.md`).

Расширение набора (Documents, Notifications) запланировано после публикации соответствующих миграций. Новые файлы будут добавляться с префиксом даты и описанием домена.

## Процедура загрузки

1. Подготовьте окружение согласно [docs/local-setup.md](local-setup.md): создайте `.env`, поднимите инфраструктурные контейнеры, выполните миграции (`poetry run alembic upgrade head`, `./gradlew update` и т.д.).
2. Убедитесь, что `.env` синхронизирован с [env.example](../env.example) — он остаётся источником правды для параметров `POSTGRES_HOST`/`POSTGRES_HOST_INTERNAL`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`.
3. Запустите автоматизированный скрипт загрузки:
   ```bash
   ./scripts/load-seeds.sh
   ```
   Сценарий читает переменные подключения из `.env`, проверяет наличие `psql` или Docker, выполняет smoke-проверку обязательных таблиц (`auth.users`, `crm.policies`, `crm.payments` и др.) и автоматически подхватывает только актуальные seed-файлы в порядке Auth → CRM. Для частичной перезагрузки используйте фильтр по подстроке имени файла, например `./scripts/load-seeds.sh --only crm`.
4. При работе с пользовательскими расширениями создавайте отдельный файл `seed_<дата>_local.sql`, добавляйте его в `.gitignore` и применяйте вручную — основной набор остаётся неизменным.

## Проверка корректности

После загрузки выполните контрольные запросы:

```sql
SELECT email, enabled FROM auth.users WHERE email LIKE '%@example.com%' ORDER BY email;
SELECT title, status, next_review_at FROM crm.deals ORDER BY created_at DESC;
SELECT policy_id, incomes_total, expenses_total, net_total, actual_date, created_by_id, updated_by_id FROM crm.payments ORDER BY actual_date DESC;
SELECT payment_id, category, posted_at, amount FROM crm.payment_incomes ORDER BY payment_id;
SELECT payment_id, category, posted_at, amount FROM crm.payment_expenses ORDER BY payment_id;
```

> Финансовые показатели сделки валидируются через связанные таблицы `crm.calculations`, `crm.policies` и агрегаты в `crm.payments`; отдельное поле стоимости в `crm.deals` отсутствует.

Ожидаемые результаты: все пользователи включены (`enabled = true`), одна сделка находится в статусе `in_progress`, другая — `proposal_sent`, а в `crm.payments` есть минимум три записи с заполненными агрегатами (`incomes_total`, `expenses_total`, `net_total`) и связкой пользователей (`created_by_id`, `updated_by_id`). Для каждого платежа найдётся хотя бы одна строка в `crm.payment_incomes` или `crm.payment_expenses`; категории и даты (`category`, `posted_at`) отражают реальные сценарии, а суммы детализации сходятся с агрегатами платежа.

## Актуализация набора

* Изменения тестовых данных фиксируйте отдельным seed-файлом с новой датой и обновляйте таблицу составов в этом документе.
* После публикации миграций для новых доменов (Documents, Notifications) добавьте соответствующие строки в таблицу и расширьте README каталога `seeds`.
* Раз в релиз проверяйте, что переменные подключения в `env.example` соответствуют требованиям сервисов — это гарантирует воспроизводимость процедур загрузки.
