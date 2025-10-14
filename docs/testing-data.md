# Тестовые данные CRM 2.0

## Назначение

Набор тестовых данных помогает быстро воспроизводить ключевые бизнес-процессы (инициация сделки, расчёт полиса, фиксация платежей, напоминания по задачам) в локальной среде и на стендах QA. Файлы предназначены для ручной валидации пользовательских сценариев и smoke-проверок после обновлений схемы БД.

> ℹ️ Каталог `backups/postgres/seeds` содержит идемпотентные SQL-скрипты `seed_20240715_auth.sql` и `seed_20240715_crm.sql`. README с порядком запуска находится в `backups/postgres/seeds/README.md`.

## Состав стандартного набора (июль 2024)

| Домен | Файл | Содержимое | Примечания |
| --- | --- | --- | --- |
| Auth | `seed_20240715_auth.sql` | Роли `ROLE_SALES_AGENT`, `ROLE_EXECUTOR`, `ROLE_ROOT_ADMIN` и пять активных пользователей (email `*@example.com`). | Пароль всех аккаунтов — `Passw0rd!` (bcrypt, 12 раундов). Используются UUID, согласованные с CRM. TODO: выделить отдельного пользователя для проверки прав главного админа. |
| CRM / Deals & Policies | `seed_20240715_crm.sql` | Два клиента (юрлицо и физлицо), две сделки со статусами `in_progress` и `proposal_sent`, два полиса с действующими периодами и график из двух платежей (аванс и финальный платёж) с операциями поступлений. | Ссылки на пользователей Auth обеспечивают трассировку владельцев, авторов платежей и операций (`created_by_id`, `recorded_by_id`). Значения премий отражают реальные суммы сценариев. |
| CRM / Deals | `seed_20240715_crm.sql` | Два клиента, две сделки, два полиса и связанные записи в `crm.policy_payments` и `crm.payment_transactions`. В примере показаны как частично оплаченное, так и закрытое обязательство. | Ссылки на пользователей Auth обеспечивают трассировку авторов платежей и операций. |

Отдельный файл `seed_20240715_payments.sql` больше не требуется: факт оплаты полиса входит в основной seed CRM и хранится в `crm.policy_payments` и `crm.payment_transactions`.
| CRM / Deals & Policies | `seed_20240715_crm.sql` | Два клиента (юрлицо и физлицо), две сделки со статусами `in_progress` и `proposal_sent`, два полиса с действующими периодами и три финансовые записи на полисы (премия, комиссия, расход). | Ссылки на пользователей Auth обеспечивают трассировку владельцев и автора платежа (`recorded_by_id`). Финансовые данные распределены между `crm.policy_payments`, `crm.policy_payment_incomes` и `crm.policy_payment_expenses`. |

Отдельный файл `seed_20240715_payments.sql` больше не требуется: факт оплаты полиса входит в основной seed CRM и хранится в `crm.policy_payments` с множественными записями на полис и привязкой к позициям доходов/расходов.

Расширение набора (Documents, Tasks, Notifications) запланировано после публикации соответствующих миграций. Новые файлы будут добавляться с префиксом даты и описанием домена.

## Процедура загрузки

1. Подготовьте окружение согласно [docs/local-setup.md](local-setup.md): создайте `.env`, поднимите инфраструктурные контейнеры, выполните миграции (`poetry run alembic upgrade head`, `./gradlew update` и т.д.).
2. Убедитесь, что `.env` синхронизирован с [env.example](../env.example) — он остаётся источником правды для параметров `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`.
3. Запустите автоматизированный скрипт загрузки:
   ```bash
   ./scripts/load-seeds.sh
   ```
   Сценарий читает переменные подключения из `.env`, проверяет наличие `psql` или Docker и автоматически подхватывает только актуальные seed-файлы в порядке Auth → CRM. Для частичной перезагрузки используйте фильтр по подстроке имени файла, например `./scripts/load-seeds.sh --only crm`.
4. При работе с пользовательскими расширениями создавайте отдельный файл `seed_<дата>_local.sql`, добавляйте его в `.gitignore` и применяйте вручную — основной набор остаётся неизменным.

## Проверка корректности

После загрузки выполните контрольные запросы:

```sql
SELECT email, enabled FROM auth.users WHERE email LIKE '%@example.com%' ORDER BY email;
SELECT title, status, value FROM crm.deals ORDER BY created_at DESC;
SELECT policy_id, planned_amount, status, actual_date FROM crm.policy_payments ORDER BY sequence;
SELECT payment_id, type, amount, posted_at FROM crm.payment_transactions ORDER BY posted_at DESC;
```

Ожидаемые результаты: все пользователи включены (`enabled = true`), одна сделка находится в статусе `in_progress`, другая — `proposal_sent`, в `crm.policy_payments` есть как частично оплаченный, так и закрытый платёж, а `crm.payment_transactions` содержит операции типов `income` и `expense` с корректными датами.
SELECT policy_id, amount, direction, purpose, actual_date, recorded_by_id FROM crm.policy_payments ORDER BY actual_date DESC;
SELECT payment_id, income_type, amount FROM crm.policy_payment_incomes ORDER BY payment_id;
SELECT payment_id, expense_type, amount FROM crm.policy_payment_expenses ORDER BY payment_id;
```

Ожидаемые результаты: все пользователи включены (`enabled = true`), одна сделка находится в статусе `in_progress`, другая — `proposal_sent`, а в `crm.policy_payments` есть минимум три записи с корректными направлениями (`incoming`/`outgoing`) и ссылкой на автора (`recorded_by_id`). Для каждого платежа найдётся хотя бы одна строка в `crm.policy_payment_incomes` или `crm.policy_payment_expenses`, суммарно совпадающая с базовой суммой (учитывая знак).

## Актуализация набора

* Изменения тестовых данных фиксируйте отдельным seed-файлом с новой датой и обновляйте таблицу составов в этом документе.
* После публикации миграций для новых доменов (Documents, Tasks, Notifications) добавьте соответствующие строки в таблицу и расширьте README каталога `seeds`.
* Раз в релиз проверяйте, что переменные подключения в `env.example` соответствуют требованиям сервисов — это гарантирует воспроизводимость процедур загрузки.
