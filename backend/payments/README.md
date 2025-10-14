# Payments Service

## Назначение
Payments учитывает финансовые операции (платежи, комиссии, возвраты), публикует события в RabbitMQ и опирается на внутренние справочники тарифов. Все расчёты выполняются в валюте RUB без дополнительных пересчётов или внешних конвертаций.【F:docs/architecture.md†L12-L17】【F:docs/tech-stack.md†L202-L236】

## Требования к окружению
- JDK 17 и Gradle 8+ (Spring Boot WebFlux + Spring Cloud Stream).【F:docs/tech-stack.md†L204-L230】
- PostgreSQL (схема `payments`) и RabbitMQ (exchange `payments.events`, очереди `payments.exports`/`payments.exports.status`).【F:docs/architecture.md†L12-L13】【F:docs/tech-stack.md†L214-L236】【F:docs/api/payments.md†L205-L239】
- Переменные окружения `PAYMENTS_SERVICE_PORT`, `PAYMENTS_DATABASE_URL`, `PAYMENTS_RABBITMQ_URL`, `PAYMENTS_CRM_WEBHOOK_SECRET`, `PAYMENTS_EXPORTS_QUEUE`, `PAYMENTS_EXPORTS_STATUS_QUEUE`, `PAYMENTS_EXPORTS_STORAGE_*` и связанные настройки (см. [`env.example`](../../env.example)).

## Локальный запуск

1. Убедитесь, что заданы переменные окружения из корневого [`env.example`](../../env.example) либо экспортируйте их вручную:
   ```bash
   export $(grep -v '^#' ../../env.example | xargs)
   ```
2. Запустите сервис со Spring-профилем `local` (по умолчанию — порт `8083`):
   ```bash
   gradle bootRun -PspringProfile=local
   ```
3. Для профиля `dev` передайте соответствующий параметр:
   ```bash
   gradle bootRun -PspringProfile=dev
   ```

Gradle-задача `test` запускает интеграционные тесты на базе Testcontainers (PostgreSQL + RabbitMQ):
```bash
gradle test
```

## API

> ⚠️ Все входящие запросы с валютой, отличной от `RUB`, отклоняются ошибкой 400 (`validation_error`).

`GET /api/v1/payments` возвращает поток платежей, отсортированных по `created_at` (новые записи в начале). Поддерживаются фильтры по сделке, полису, статусу, типу и диапазону дат, а также пагинация:

| Параметр | Тип | Описание |
| --- | --- | --- |
| `dealId` | `UUID` | Идентификатор сделки CRM. |
| `policyId` | `UUID` | Идентификатор полиса. |
| `status`/`statuses` | `array[enum]` | Допустимые значения: `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED`. |
| `type`/`types` | `array[enum]` | Допустимые значения: `INITIAL`, `INSTALLMENT`, `COMMISSION`, `REFUND`. |
| `fromDate` | `OffsetDateTime` | Нижняя граница по `created_at` (включительно). |
| `toDate` | `OffsetDateTime` | Верхняя граница по `created_at` (включительно). |
| `limit` | `integer` | Размер страницы (по умолчанию `50`, максимум `200`). |
| `offset` | `integer` | Смещение, начиная с `0`. |

Если заданы оба параметра дат, `fromDate` не может быть позже `toDate`. При превышении `limit` значения `200` используется верхняя граница.

Все ответы `PaymentResponse` содержат поле `history` — упорядоченный по `changedAt` список событий из `payment_history` (статус после изменения, сумма, комментарий и отметка времени). Это позволяет фронтенду и внешним системам отображать актуальный журнал операций без дополнительных запросов.

`PATCH /api/v1/payments/{paymentId}` позволяет частично обновлять платёж: сумму, валюту, даты (`dueDate`, `processedAt`), тип (`paymentType`) и описание. Любое изменение или переданный комментарий (`comment`) фиксируется в `payment_history`, а наружу отправляется событие `payment.updated` (RabbitMQ + SSE-поток). В теле достаточно передать только изменяемые поля.

`POST /api/v1/payments/{paymentId}/status` переводит платёж в новый статус. Допустимы переходы `PENDING → PROCESSING/CANCELLED`, `PROCESSING → COMPLETED/FAILED/CANCELLED`, `FAILED → PROCESSING/CANCELLED`, `COMPLETED → CANCELLED`; возврат из `CANCELLED` запрещён. Для `COMPLETED` требуется `actual_date`, для `CANCELLED` — комментарий с причиной. При успешной смене статуса обновляется `processed_at`, при необходимости сохраняется `confirmation_reference`, создаётся запись в истории и публикуется событие `payment.status_changed` (RabbitMQ + SSE).

### Экспорт платежей

`GET /api/v1/payments/export` ставит задачу генерации выгрузки (CSV/XLSX) в очередь `PAYMENTS_EXPORTS_QUEUE` и возвращает `job_id` c начальным статусом `processing`. Настройки хранилища (`PAYMENTS_EXPORTS_STORAGE_*`) проксируются воркеру экспорта; статус обновляется через сообщения из `PAYMENTS_EXPORTS_STATUS_QUEUE` (`processing` → `done`/`failed`). Запрос принимает те же фильтры, что и `/api/v1/payments`, причём параметры можно передавать как в единственном (`status`, `type`), так и во множественном числе (`statuses`, `types`) — значения автоматически нормализуются в списки. `GET /api/v1/payments/export/{job_id}` отдаёт актуальный статус и ссылку на скачивание после завершения.【F:docs/api/payments.md†L205-L239】

> ℹ️ Публикация задач выполняется асинхронно на пуле `Schedulers.boundedElastic()`, что позволяет безопасно вызывать RabbitMQ из реактивного кода без блокировки потоков ввода-вывода.

### Вебхуки CRM

События `payment.created` и `payment.updated` приходят через `/api/v1/webhooks/crm`. Для обновлений CRM обязана передавать идентификатор платежа и версию (`updatedAt` в ISO 8601 или числовой `revision` — миллисекунды Unix-эпохи). Если версия устарела относительно `payments.updated_at`, сервис отвечает `409 stale_update` и не изменяет данные. Это предотвращает перезапись актуальной информации более ранним состоянием.

### Справочник типов платежей

`paymentType` обязателен при создании платежа и принимает одно из следующих значений:

| Код | Описание |
| --- | --- |
| `INITIAL` | Первоначальный взнос по сделке. |
| `INSTALLMENT` | Регулярный платёж в рамках графика/рассрочки. |
| `COMMISSION` | Комиссия CRM или партнёра. |
| `REFUND` | Возврат клиенту. |

## Миграции и скрипты
- Миграции Flyway хранятся в каталоге [`migrations`](migrations/) и запускаются автоматически при старте приложения либо вручную через `gradle flywayMigrate`.【F:docs/tech-stack.md†L226-L230】
- Обмен `payments.events` и связанные сущности описаны в конфигурации Spring AMQP (`com.crm.payments.config`).
- Пилотный набор миграций создаёт схему `payments`, базовые справочники и таблицу `payment_exports` для очереди выгрузок (при необходимости расширяйте список).【F:backend/payments/migrations/db/migration/V20241005090000__create_payment_exports.sql†L1-L11】

## Запуск в Docker
1. Соберите образ через Spring Boot buildpacks:
   ```bash
   gradle bootBuildImage --imageName=crm-payments:local
   ```
2. Запустите контейнер:
   ```bash
   docker run --rm -p ${PAYMENTS_SERVICE_PORT:-8083}:8083 --env-file ../../env.example crm-payments:local
   ```

## Полезные ссылки
- Архитектурные взаимодействия Payments: [`docs/architecture.md`](../../docs/architecture.md#2-взаимодействия-и-потоки-данных).【F:docs/architecture.md†L61-L66】
- Технологический стек и интеграции: [`docs/tech-stack.md`](../../docs/tech-stack.md#payments).【F:docs/tech-stack.md†L202-L230】
