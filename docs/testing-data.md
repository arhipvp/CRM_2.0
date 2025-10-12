# Тестовые данные CRM 2.0

## Назначение

Набор тестовых данных помогает быстро воспроизводить ключевые бизнес-процессы (инициация сделки, расчёт полиса, фиксация платежей, напоминания по задачам) в локальной среде и на стендах QA. Файлы предназначены для ручной валидации пользовательских сценариев и smoke-проверок после обновлений схемы БД.

> ℹ️ Каталог `backups/postgres/seeds` содержит идемпотентные SQL-скрипты `seed_20240715_*.sql`. README с порядком запуска находится в `backups/postgres/seeds/README.md`.

## Состав стандартного набора (июль 2024)

| Домен | Файл | Содержимое | Примечания |
| --- | --- | --- | --- |
| Auth | `seed_20240715_auth.sql` | Роли `ROLE_SALES_AGENT`, `ROLE_EXECUTOR`, `ROLE_FINANCE_MANAGER`, `ROLE_TEAM_LEAD` и пять активных пользователей (email `*@example.com`). | Пароль всех аккаунтов — `Passw0rd!` (bcrypt, 12 раундов). Используются UUID, согласованные с CRM/Payments. |
| CRM / Deals | `seed_20240715_crm.sql` | Два клиента (юрлицо и физлицо), две сделки со статусами `in_progress` и `proposal_sent`, два полиса с датами действия. | Ссылки на пользователей Auth обеспечивают трассировку владельцев. Значения премий отражают реальные суммы сценариев. |
| Payments | `seed_20240715_payments.sql` | Три платежа (`planned`, `expected`, `received`), история изменений и график выплат. | Payments опирается на сделки и полисы из CRM. Используются те же пользователи Finance/Team Lead для истории. |

Расширение набора (Documents, Tasks, Notifications) запланировано после публикации соответствующих миграций. Новые файлы будут добавляться с префиксом даты и описанием домена.

## Процедура загрузки

1. Подготовьте окружение согласно [docs/local-setup.md](local-setup.md): создайте `.env`, поднимите инфраструктурные контейнеры и примените миграции сервисов (`alembic upgrade head`, `liquibase update` и т.д.).
2. Проверьте, что в `.env` заполнены переменные подключения к PostgreSQL (`POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`). Шаблон значений хранится в [env.example](../env.example) и служит источником правды.
3. Выполните загрузку файлов в порядке Auth → CRM → Payments. Пример для Linux/macOS:
   ```bash
   export PGPASSWORD="$POSTGRES_PASSWORD"
   psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f backups/postgres/seeds/seed_20240715_auth.sql
   psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f backups/postgres/seeds/seed_20240715_crm.sql
   psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f backups/postgres/seeds/seed_20240715_payments.sql
   unset PGPASSWORD
   ```
   Для XML-файлов других доменов используйте CLI выбранного инструмента миграций (Liquibase/Flyway) и следуйте README сервиса.
4. Для локальных экспериментов создайте отдельный файл `seed_<дата>_local.sql`, добавьте его в `.gitignore` и применяйте вручную — так основной набор остаётся неизменным.

## Проверка корректности

После загрузки выполните контрольные запросы:

```sql
SELECT email, enabled FROM auth.users WHERE email LIKE '%@example.com%' ORDER BY email;
SELECT title, status, value FROM crm.deals ORDER BY created_at DESC;
SELECT payment_type, status, amount FROM payments.payments ORDER BY planned_date NULLS LAST;
```

Ожидаемые результаты: все пользователи включены (`enabled = true`), одна сделка находится в статусе `in_progress`, другая — `proposal_sent`, а в таблице `payments.payments` присутствуют статусы `planned`, `expected` и `received`.

## Актуализация набора

* Изменения тестовых данных фиксируйте отдельным seed-файлом с новой датой и обновляйте таблицу составов в этом документе.
* После публикации миграций для новых доменов (Documents, Tasks, Notifications) добавьте соответствующие строки в таблицу и расширьте README каталога `seeds`.
* Раз в релиз проверяйте, что переменные подключения в `env.example` соответствуют требованиям сервисов — это гарантирует воспроизводимость процедур загрузки.
