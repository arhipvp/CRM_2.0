# Seed-набор CRM 2.0 (июль 2024)

Набор файлов `seed_20240715_*.sql` формирует минимальные тестовые данные в PostgreSQL для Auth, CRM/Deals и Payments. Скрипты используются для smoke-проверок и воспроизведения сценариев «продавец оформляет корпоративный полис» и «индивидуальный клиент выбирает КАСКО».

## Состав

| Файл | Что создаёт | Зависимости |
| --- | --- | --- |
| `seed_20240715_auth.sql` | Роли (`ROLE_SALES_AGENT`, `ROLE_EXECUTOR`, `ROLE_FINANCE_MANAGER`, `ROLE_TEAM_LEAD`) и пять активных пользователей с паролем `Passw0rd!`. | Требуется схема `auth`, базовые роли `ROLE_USER`, `ROLE_ADMIN` из миграций. |
| `seed_20240715_crm.sql` | Два клиента, две сделки и два полиса, связанные с пользователями из `auth`. | Требуется успешное применение `seed_20240715_auth.sql` (используются UUID пользователей). |
| `seed_20240715_payments.sql` | Три платежа, история изменений и график выплат, связанные со сделками и полисами CRM. | Требуется применение `seed_20240715_auth.sql` и `seed_20240715_crm.sql`. |

Все UUID и даты согласованы между файлами, поэтому набор загружается полностью или выборочно без дополнительных правок.

## Порядок применения

### Рекомендуемый способ

1. Убедитесь, что выполнены миграции схем `auth`, `crm` и `payments`.
2. Синхронизируйте `.env` с [env.example](../../../env.example): значения `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` используются для подключения скриптом.
3. Запустите автоматизированный загрузчик:
   ```bash
   ./scripts/load-seeds.sh
   ```
   Скрипт применит SQL-файлы последовательно (Auth → CRM → Payments), проверит наличие `psql` или Docker и завершится при первой ошибке. Для частичной перезагрузки воспользуйтесь `./scripts/load-seeds.sh --only <auth|crm|payments>`.

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
   psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f backups/postgres/seeds/seed_20240715_payments.sql
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
SELECT status, amount FROM payments.payments ORDER BY planned_date;
```

Все пользователи включены (`enabled = true`), минимум одна сделка имеет статус `in_progress`, а в платежах присутствуют статусы `planned`, `expected` и `received`. Для расширенной проверки сценариев воспользуйтесь чек-листом из [docs/testing-data.md](../../../docs/testing-data.md).
