# Миграции схемы `crm`

## Порядок миграций

1. `2024031501` (`2024031501_baseline.py`) — базовая схема CRM со схемой `crm`, таблицами клиентов, контактов, сделок, полисов и вспомогательных справочников.
2. `2024052801` (`2024052801_add_next_review_at_to_deals.py`) — колонка `next_review_at` и индекс `ix_deals_next_review_at` в `crm.deals`.
3. `2024060101` (`2024060101_add_permission_sync_jobs.py`) — таблица `permission_sync_jobs` и индексы для поиска синхронизаций прав.
4. `2024061501_add_payments_module` (`2024061501_add_payments_module.py`) — модуль платежей (`payments`, `payment_incomes`, `payment_expenses`) и удаление `payment_sync_log`.
5. `2024062001_add_calculations` (`2024062001_add_calculations.py`) — таблица `calculations`, связь `policies.calculation_id` и индексы для расчётов.
6. `2024062001_add_deal_journal` (`2024062001_add_deal_journal.py`) — таблица `deal_journal` с индексами по сделке и времени создания.
7. `2024062401_add_policy_documents` (`2024062401_add_policy_documents.py`) — таблица `policy_documents`, уникальное ограничение и внешние ключи на полисы и документы.
8. `2024070101_add_payments_foreign_keys` (`2024070101_add_payments_foreign_keys.py`) — внешние ключи `payments` к `deals` и `policies`.
9. `2024071801` (`2024071801_remove_deal_value.py`) — удаление колонки `value` из `crm.deals`.
10. `2024072201` (`2024072201_allow_null_owner_in_deals.py`) — разрешение `NULL` в колонке `owner_id` таблицы `crm.deals`.

Исторические SQL-скрипты миграций удалены; baseline-ревизия покрывает создание всех основных таблиц схемы `crm`.

## Правила версионирования

* Файлы Alembic следуют формату `YYYYMMDD##_описание.py` (UTC). SQL-миграции из бэкапов сохраняют прежний нейминг `YYYYMMDDHHMMSS_описание.sql`.
* В одной миграции изменяется только одна логическая группа объектов.
* При удалении колонок сначала фиксируется миграция переноса данных, затем миграция удаления.
* Все внешние ключи должны сопровождаться индексами, описанными в `docs/data-model.md`.

## Актуальная ревизия

* Head Alembic: `2024072201_allow_null_owner_in_deals.py`.
