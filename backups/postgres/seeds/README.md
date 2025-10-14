# Seed-набор CRM 2.0 (июль 2024)

Набор файлов `seed_20240715_*.sql` формирует минимальные тестовые данные в PostgreSQL для Auth и CRM/Deals. Скрипты используются для smoke-проверок и воспроизведения сценариев «продавец оформляет корпоративный полис» и «индивидуальный клиент выбирает КАСКО».

## Состав

| Файл | Что создаёт | Зависимости |
| --- | --- | --- |
| `seed_20240715_auth.sql` | Базовые роли (`ROLE_SALES_AGENT`, `ROLE_EXECUTOR`, `ROLE_ROOT_ADMIN`) и пять активных пользователей с паролем `Passw0rd!`. | Требуется схема `auth`. |
| `seed_20240715_crm.sql` | Два клиента, две сделки, два полиса и три финансовые записи в `crm.payments` (премия `5d8d0d68-…7777`, комиссия `3c3ab2c4-…8888`, расход `af5f1f29-…9999`) с позициями `crm.payment_incomes`/`crm.payment_expenses`. | Требуется успешное применение `seed_20240715_auth.sql` (используются UUID пользователей). |

Все UUID и даты согласованы между файлами, поэтому набор загружается полностью или выборочно без дополнительных правок. Отдельный seed Payments больше не публикуется: факт оплаты полиса входит в CRM и хранится в `crm.payments` с привязкой к позициям `crm.payment_incomes` и `crm.payment_expenses`.

## Порядок применения

### Рекомендуемый способ

1. Убедитесь, что выполнены миграции схем `auth` и `crm`.
2. Синхронизируйте `.env` с [env.example](../../../env.example): значения `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` используются для подключения скриптом.
3. Запустите автоматизированный загрузчик:
   ```bash
   ./scripts/load-seeds.sh
   ```
   Скрипт проверит наличие `psql` или Docker, убедится в существовании обязательных таблиц (`auth.users`, `crm.payments` и др.) и применит SQL-файлы последовательно (Auth → CRM). Для частичной перезагрузки воспользуйтесь `./scripts/load-seeds.sh --only <auth|crm>`.

### Ручной fallback

Если требуется выполнить команды вручную (например, в ограниченной среде CI), используйте следующую последовательность:

1. Экспортируйте пароль из текущего `.env`:
   ```bash
   export PGPASSWORD="$POSTGRES_PASSWORD"
   ```
2. Запустите скрипты по порядку:
   ```bash
   psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f backups/postgres/seeds/seed_20240715_auth.sql
   psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f backups/postgres/seeds/seed_20240715_crm.sql
   ```
3. Очистите переменную окружения:
   ```bash
   unset PGPASSWORD
   ```

> Если нужны локальные отклонения (например, дополнительные клиенты), создавайте отдельный файл `seed_<дата>_local.sql` и не добавляйте его в git.

## Проверка

После загрузки выполните запросы контроля:

```sql
SELECT email, enabled FROM auth.users WHERE email LIKE '%@example.com';
SELECT deal_id, status, value FROM crm.deals ORDER BY created_at DESC;
SELECT policy_id, incomes_total, expenses_total, net_total, actual_date, created_by_id, updated_by_id FROM crm.payments ORDER BY actual_date DESC;
SELECT payment_id, category, posted_at, amount FROM crm.payment_incomes ORDER BY payment_id;
SELECT payment_id, category, posted_at, amount FROM crm.payment_expenses ORDER BY payment_id;
```

Все пользователи включены (`enabled = true`), минимум одна сделка имеет статус `in_progress`, а в `crm.payments` отображаются агрегаты (`incomes_total`, `expenses_total`, `net_total`) с заполненной `actual_date` и связкой пользователей (`created_by_id`, `updated_by_id`). Каждая запись имеет хотя бы одну связанную строку в таблицах доходов или расходов: категории и даты (`category`, `posted_at`) иллюстрируют реальные сценарии и сходятся по суммам с агрегатами платежа. Для расширенной проверки сценариев воспользуйтесь чек-листом из [docs/testing-data.md](../../../docs/testing-data.md).
