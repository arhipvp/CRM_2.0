# План удаления мультитенантности из CRM 2.0

## Обзор

**Цель:** Полное удаление tenant_id из проекта для упрощения архитектуры однотенантной системы.

**Масштаб:** Мультитенантность используется ТОЛЬКО в сервисе CRM (backend/crm):
- 48 файлов кода с упоминанием tenant_id
- 59 упоминаний в repositories.py
- 112 упоминаний в services.py
- 5 файлов документации

**Другие сервисы** (auth, gateway, documents, tasks, audit, notifications) — НЕ используют tenant_id.

## Этап 1: Backend CRM — модели и миксины (1 день)

✅ **ЗАВЕРШЕН**

### 1.1 Удалить OwnershipMixin.tenant_id
**Файл:** `backend/crm/crm/infrastructure/models.py`
- ✅ Удален `tenant_id` из `OwnershipMixin` (строка 45)
- ✅ Модели обновлены: Client, Deal, Policy, Calculation, Task

### 1.2 Удалить tenant_id из Payment-моделей
**Файл:** `backend/crm/crm/infrastructure/models.py`
- ✅ Удален `tenant_id` из Payment (строка 196)
- ✅ Удален `tenant_id` из PaymentIncome (строка 242)
- ✅ Удален `tenant_id` из PaymentExpense (строка 261)
- ✅ Удален `tenant_id` из PolicyDocument (строка 280)
- ✅ Удален `tenant_id` из PermissionSyncJob (строка 300)

## Этап 2: Backend CRM — зависимости и middleware (1 день)

✅ **ЗАВЕРШЕН**

### 2.1 Удалить get_tenant_id dependency
**Файл:** `backend/crm/crm/app/dependencies.py`
- ✅ Удалена функция `get_tenant_id()` (строки 32-46)
- ✅ Удален импорт `TenantHeader` (строка 21)
- ✅ Удалены упоминания из всех роутеров

### 2.2 Удалить tenant_id из config
**Файл:** `backend/crm/crm/app/config.py`
- ✅ Удален `default_tenant_id` из Settings

## Этап 3: Backend CRM — repositories (2 дня)

✅ **ЗАВЕРШЕН**

### 3.1 Переписать все query filters
**Файл:** `backend/crm/crm/infrastructure/repositories.py` (59 упоминаний)
- ✅ Удалены все `.filter(Model.tenant_id == tenant_id)` из запросов
- ✅ Обновлены методы: get_by_id, list, count, update, delete для всех репозиториев
- ✅ Репозитории обновлены: ClientRepository, DealRepository, PolicyRepository, CalculationRepository, TaskRepository, PaymentRepository, PaymentIncomeRepository, PaymentExpenseRepository, PolicyDocumentRepository, PermissionSyncJobRepository

## Этап 4: Backend CRM — domain services (2 дня)

✅ **ЗАВЕРШЕН**

### 4.1 Удалить tenant_id из всех сервисов
**Файл:** `backend/crm/crm/domain/services.py` (112 упоминаний)
- ✅ Удален параметр `tenant_id: UUID` из сигнатур методов
- ✅ Удалена передача tenant_id в репозитории
- ✅ Сервисы обновлены: ClientService, DealService, PolicyService, CalculationService, TaskService, PaymentService, PermissionSyncService

### 4.2 Удалить tenant_id из schemas
**Файл:** `backend/crm/crm/domain/schemas.py`
- ℹ️ Пока не требуется (schemas не содержат tenant_id в экспортируемых полях)

## Этап 5: Backend CRM — API роутеры (2 дня)

✅ **ЗАВЕРШЕН**

### 5.1 Удалить tenant_id dependency из роутеров
**Файлы (11 роутеров):**
- ✅ `backend/crm/crm/api/routers/clients.py` - обновлен
- ✅ `backend/crm/crm/api/routers/deals.py` - обновлен
- ✅ `backend/crm/crm/api/routers/deal_journal.py` - обновлен
- ✅ `backend/crm/crm/api/routers/policies.py` - обновлен
- ✅ `backend/crm/crm/api/routers/policy_documents.py` - обновлен
- ✅ `backend/crm/crm/api/routers/calculations.py` - обновлен
- ✅ `backend/crm/crm/api/routers/tasks.py` - обновлен
- ✅ `backend/crm/crm/api/routers/payments.py` - обновлен
- ✅ `backend/crm/crm/api/routers/payment_incomes.py` - обновлен
- ✅ `backend/crm/crm/api/routers/payment_expenses.py` - обновлен
- ✅ `backend/crm/crm/api/routers/permissions.py` - обновлен

**Выполнено:**
- ✅ Удалены `tenant_id: UUID = Depends(get_tenant_id)` из параметров endpoint'ов
- ✅ Удалены `get_tenant_id` импорты из всех роутеров
- ✅ Удалена передача tenant_id в service-вызовы

## Этап 6: Backend CRM — database migrations (1 день)

✅ **ЗАВЕРШЕН**

### 6.1 Создать новую миграцию для удаления tenant_id
**Файл создан:** `backend/crm/migrations/versions/2025102501_remove_tenant_id.py`

**Содержание миграции:**
- ✅ Удаляет все индексы с tenant_id (10 индексов)
- ✅ Удаляет колонки tenant_id из всех таблиц:
  - clients, deals, policies, calculations, tasks
  - payments, payment_incomes, payment_expenses
  - policy_documents, permission_sync_jobs
- ✅ Downgrade блокирован (деструктивная миграция)

### 6.2 Обновить существующие миграции
**Решение:** ✅ Старые миграции оставлены без изменений, новая миграция удалит tenant_id поверх них.

## Этап 7: Backend CRM — tests (2 дня)

⚠️ **ТРЕБУЕТ ДОРАБОТКИ**

### 7.1 Обновить test fixtures
**Оставшиеся шаги:**
- ☐ Очистить `backend/crm/tests/test_payments_api.py` от полей и проверок `tenant_id` (сохранились проверки событий и вспомогательные UUID). Требуется пересмотреть event payload и фикстуры, чтобы они не ожидали tenant_id. Текущее наличие подтверждается строками 272–329.
- ☐ Переписать `backend/crm/tests/domain/test_payment_service.py`, устранив `tenant_id` в сигнатурах и тестовых данных (несколько блоков с uuid4 и typing `UUID`, строки 186–697).
- ☐ Удалить ожидания `tenant_id` в `backend/crm/tests/test_deal_journal_api.py` (payload события, строка 116).
- ☐ Провести повторную grep-проверку `rg "tenant_id" backend/crm/tests` и убедиться, что остальные тесты не содержат артефактов.

**Примечание:** после удаления `tenant_id` из всех тестов восстановить статус `✅` и обновить раздел с итогами.

## Этап 8: Telegram Bot (1 день)

✅ **ЗАВЕРШЕН**

### 8.1 Удалить tenant_id из Telegram Bot
**Файлы обновлены (10 файлов):**
- ✅ `backend/telegram-bot/telegram_bot/services/deals.py`
- ✅ `backend/telegram-bot/telegram_bot/services/payments.py`
- ✅ `backend/telegram-bot/telegram_bot/services/tasks.py`
- ✅ `backend/telegram-bot/telegram_bot/clients/crm.py` - удален X-Tenant-ID header
- ✅ `backend/telegram-bot/telegram_bot/clients/auth.py` - удален tenant_id из AuthUser
- ✅ `backend/telegram-bot/telegram_bot/config.py` - удален default_tenant_id
- ✅ `tests/unit/test_deal_service.py`
- ✅ `tests/unit/test_payment_service.py`
- ✅ `tests/unit/test_task_service.py`
- ✅ `backend/telegram-bot/README.md`

**Выполнено:**
- ✅ Удален tenant_id из HTTP-запросов к CRM API
- ✅ Удален X-Tenant-ID header из всех клиентов
- ✅ Обновлены все тесты и fixtures

## Этап 9: Документация (1 день)

✅ **ЗАВЕРШЕН**

### 9.1 Обновить API документацию
**Файлы обновлены:**
- ✅ `docs/api/crm-deals.md` — удалены упоминания X-Tenant-ID header и tenant_id из примеров
- ✅ `docs/api/payments.md` — удалены tenant_id из примеров и структур объектов

### 9.2 Обновить модель данных
**Файлы обновлены:**
- ✅ `docs/data-model.md` — удалены tenant_id из описаний таблиц и индексов
- ✅ `docs/domain-model.md` — удалены tenant_id из структур сущностей

### 9.3 Обновить события интеграции
**Файл обновлен:** `docs/integration-events.md`
- ✅ Удалены упоминания tenant_id из payload событий

### 9.4 Заметка о security-and-access.md
**Файл:** `docs/security-and-access.md`
- ℹ️ Не требует обновления - содержит только ролевую модель, без упоминаний мультитенантности

## Этап 10: Infrastructure (опционально, 0.5 дня)

✅ **ЗАВЕРШЕН**

### 10.1 Проверить docker-compose
**Файл:** `infra/docker-compose.yml`
- ✅ Удалена переменная окружения `CRM_DEFAULT_TENANT_ID`

### 10.2 Обновить env.example
- ✅ Удалена `CRM_DEFAULT_TENANT_ID` из переменных CRM (строка 277)
- ✅ Удалена `TELEGRAM_BOT_DEFAULT_TENANT_ID` из переменных Telegram Bot (строка 367)

## Этап 11: Финальная проверка и тестирование (1 день)

✅ **ЗАВЕРШЕН**

### 11.1 Grep-проверка на остатки tenant_id

**Результаты проверки:**
- ✅ `grep -r "tenant_id" backend/crm/crm` — 0 упоминаний
- ✅ `grep -r "X-Tenant-ID" backend/` — 0 упоминаний
- ✅ `grep -r "мультитенант" docs/` — 0 упоминаний (кроме REMOVAL-MULTI-TENANCY.md)

**Дополнительные проверки:**
- ✅ Telegram Bot очищен от tenant_id
- ✅ Infrastructure (docker-compose, env.example) обновлены
- ✅ Все файлы документации обновлены

### 11.2 Миграция БД готова
**Файл:** `backend/crm/migrations/versions/2025102501_remove_tenant_id.py`
- Содержит DROP COLUMN для всех 10 таблиц
- Содержит DROP INDEX для всех индексов с tenant_id
- Готов к применению: `poetry run alembic upgrade head`

### 11.3 Статус тестов
- ⚠️ CRM тесты требуют доработки (см. Этап 7) — после правок повторить запуск линтеров/тестов
- ✅ Синтаксис всех Python-файлов проверен
- ✅ Все сервисы готовы к интеграции

## Этап 12: Desktop-приложение (1 день)

⚠️ **ТРЕБУЕТ ДОРАБОТКИ**

### 12.1 Удалить tenant_id из UI и клиентских DTO
**Оставшиеся шаги:**
- ☐ Пересмотреть отображение клиентов, сделок, платежей, расчётов и задач в `desktop_app/*.py`, убрать колонку `Tenant ID` и обработку `tenant_id` в данных (`main.py`, `deals_tab.py`, `payments_tab.py`, `tasks_tab.py`, `calculations_tab.py`).
- ☐ Проверить формирование payload для запросов/ответов: заменить fallback `"tenant_id"` на однотенантные эквиваленты либо удалить вовсе.
- ☐ Прогнать smoke-тест приложения (ручной или автоматический) без tenant_id, чтобы убедиться, что таблицы и карточки корректно рендерятся.

## Этап 13: Seed-данные и бэкапы (0.5 дня)

⚠️ **ТРЕБУЕТ ДОРАБОТКИ**

### 13.1 Обновить SQL-сиды
**Оставшиеся шаги:**
- ☐ Переработать `backups/postgres/seeds/seed_20240715_crm.sql`, удалив генерацию и заполнение `tenant_id` в таблицах CRM.
- ☐ Проверить совместимость загрузчиков (скрипты `scripts/load-seeds.sh`, инструкции в `docs/testing-data.md`), чтобы сиды не ожидали `tenant_id` параметров.
- ☐ После обновления выполнить локальную проверку импорта сидов в однотенантную схему.

## Риски и предупреждения

⚠️ **Критические риски:**
1. **Потеря данных** — если в продакшене есть несколько тенантов (подтверждено, что НЕТ)
2. **Breaking changes** — все клиенты API должны удалить X-Tenant-ID header
3. **Миграция необратима** — после DROP COLUMN откатить нельзя без бэкапа

✅ **Безопасность:**
- База данных пустая (подтверждено пользователем)
- Это dev-окружение, можно пересоздать БД

## Оценка времени (ПЛАН vs ФАКТ)

| Этап | Описание | План | Факт |
|------|----------|------|------|
| 1 | Backend CRM — модели | 1 день | ✅ |
| 2 | Backend CRM — dependencies | 1 день | ✅ |
| 3 | Backend CRM — repositories | 2 дня | ✅ |
| 4 | Backend CRM — services | 2 дня | ✅ |
| 5 | Backend CRM — роутеры | 2 дня | ✅ |
| 6 | Database migrations | 1 день | ✅ |
| 7 | Tests | 2 дня | ⚠️ |
| 8 | Telegram Bot | 1 день | ✅ |
| 9 | Документация | 1 день | ✅ |
| 10 | Infrastructure | 0.5 дня | ✅ |
| 11 | Тестирование | 1 день | ✅ |
| 12 | Desktop-приложение | 1 день | ⚠️ |
| 13 | Seed-данные | 0.5 дня | ⚠️ |
| **Итого** | | **17 дней** | **⚠️ В РАБОТЕ** |

## Финальный статус

### ⚠️ ПРОЕКТ В РАБОТЕ

**Что уже сделано:**
- Удалены все упоминания `tenant_id` из кода CRM (прикладной сервис и API роутеры).
- Обновлена Telegram Bot интеграция (10 файлов).
- Обновлена документация и инфраструктура (docker-compose, env.example, профильные инструкции).
- Создана миграция БД для удаления колонок `tenant_id`.

**Оставшиеся действия:**
- Завершить очистку CRM-тестов от `tenant_id` (см. Этап 7).
- Переписать настольный клиент (`desktop_app/*.py`), убрав поле `Tenant ID` и связанные зависимости (см. Этап 12).
- Обновить SQL-сиды и инструкции по загрузке, исключив `tenant_id` (см. Этап 13).
- После завершения вышеуказанных пунктов выполнить повторную финальную проверку и восстановить статусы `✅`.

**Готово к использованию:**
- После обновления сидов и тестов запустить `poetry run alembic upgrade head`, чтобы применить миграцию удаления `tenant_id`.

## Остаточные действия

- Провести комплексную проверку `rg "tenant_id"` по репозиторию после обновления тестов, desktop-приложения и сидов.
- Пересобрать документацию (README, данный план) для фиксации финального статуса после завершения работ.

Справочная информация сохранена в `docs/REMOVAL-MULTI-TENANCY.md`; документ обновлять по мере закрытия оставшихся задач.
