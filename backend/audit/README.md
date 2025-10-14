# Audit Service

## Назначение
Audit — централизованный журнал действий пользователей и системных событий. Сервис собирает сообщения из RabbitMQ, пишет их в собственную схему PostgreSQL и предоставляет внутренние REST endpoint'ы для аналитики и отчётности.【F:docs/architecture.md†L17-L18】【F:docs/tech-stack.md†L339-L360】

## Требования к окружению
- JDK 17 и локально установленный Gradle 8+ (wrapper не хранится в репозитории).【F:docs/tech-stack.md†L339-L347】
- PostgreSQL (схема `audit`), RabbitMQ (`audit.events`, `audit.core`, `audit.dlq`) и persistent volume для локального write-ahead журнала.【F:docs/tech-stack.md†L349-L359】
- Переменные `AUDIT_SERVICE_PORT`, `AUDIT_JDBC_URL`, `AUDIT_R2DBC_URL`, `AUDIT_RABBITMQ_*`, а также имена очередей и групп `AUDIT_EVENTS_QUEUE`, `AUDIT_CORE_QUEUE`, `AUDIT_DLQ_QUEUE`, `AUDIT_EVENTS_GROUP`, `AUDIT_CORE_GROUP`, `AUDIT_DLQ_GROUP` и параметр `AUDIT_RABBITMQ_PREFETCH` (см. [`env.example`](../../env.example)).

## Конфигурация профилей
- **`local`** — подключается к локальному PostgreSQL (`jdbc:postgresql://localhost:5432/crm?search_path=audit`) и RabbitMQ из Docker Compose. Основное назначение — разработка и интеграционные тесты. Параметр `spring.cloud.stream.bindings.*.consumer.prefetch` снижен до 50, чтобы не блокировать очередь при отладке.
- **`dev`** — ожидает готовые URL в переменных `AUDIT_JDBC_URL` и `AUDIT_R2DBC_URL`, использует продвинутые настройки RabbitMQ (prefetch=100) и расширенный набор метрик Actuator (`/actuator/env`).
- **`test`** — применяется в автотестах. Параллельно поднимаются контейнеры PostgreSQL и RabbitMQ через Testcontainers; ретраи в консюмерах отключены, чтобы быстрее видеть ошибки.

Переключение профиля выполняется через свойство Gradle `springProfile`: `gradle bootRun -PspringProfile=dev`.

## Локальный запуск
1. Скопируйте переменные окружения: `../../scripts/sync-env.sh backend/audit` и обновите значения `AUDIT_*`.
2. Поднимите инфраструктуру (`docker compose up -d` в `infra/`) и примените миграции: `gradle update`.
3. Запустите сервис: `gradle bootRun -PspringProfile=local`. Приложение слушает `http://localhost:${AUDIT_SERVICE_PORT:-8088}` и обрабатывает сообщения из очередей `AUDIT_EVENTS_QUEUE` и `AUDIT_CORE_QUEUE`; недоставленные сообщения автоматически попадают в `AUDIT_DLQ_QUEUE`.

## Миграции и вспомогательные задачи
- Changelog Liquibase находится в [`migrations/db/changelog`](migrations/db/changelog). Основной файл — `db.changelog-master.yaml`, который подключается как ресурс Gradle и Spring Boot.
- Применение миграций вручную: `gradle update` (использует `AUDIT_JDBC_URL` и `AUDIT_DB_*`).
- Автотесты: `gradle test` (поднимает Testcontainers PostgreSQL 16 и RabbitMQ 3.13, проверяя, что consumer обрабатывает событие).
- Сборка Docker-образа: `gradle bootBuildImage --imageName=crm-audit:local`.

## Обработка событий
События поступают через Spring Cloud Stream. Конфигурация `MessagingConfiguration` регистрирует три функции: `auditEventsConsumer` и `auditCoreConsumer` читают рабочие очереди `AUDIT_EVENTS_QUEUE` и `AUDIT_CORE_QUEUE`, а `auditDlqConsumer` контролирует `AUDIT_DLQ_QUEUE`. Все входящие сообщения преобразуются компонентом `AuditEventConsumer` и передаются в `AuditEventProcessor`, который сохраняет payload и метаданные в таблицу `audit.audit_events` посредством `AuditEventRepository`. Для обеспечения идемпотентности используется уникальный идентификатор события (`event_id`) либо комбинация типа, времени и источника (включая случаи, когда источник отсутствует); повторная доставка приводит только к логированию без повторной вставки. Сообщения из DLQ дополнительно логируются и повторно передаются в процессор, что помогает восстанавливать историю после временных сбоев.

## REST API
Сервис предоставляет пагинированный REST endpoint для аналитики и внутренних инструментов:

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/api/audit/events` | Возвращает страницу аудиторских событий в порядке убывания `occurredAt`/`receivedAt` |

Параметры запроса:

- `page` — номер страницы (по умолчанию `0`, неотрицательное значение);
- `size` — размер страницы (по умолчанию `20`, максимум `200`);
- `eventType` — опциональный фильтр по типу события (`event_type`);
- `occurredAfter`/`occurredBefore` — временные границы в формате ISO 8601 (`OffsetDateTime`).

Пример ответа:

```json
{
  "content": [
    {
      "id": "4a2d...",
      "eventId": "evt-123",
      "eventType": "crm.deal.created",
      "eventSource": "crm-service",
      "occurredAt": "2024-11-24T12:34:56Z",
      "payload": "{...}",
      "receivedAt": "2024-11-24T12:34:57Z"
    }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 1,
  "totalPages": 1
}
```
Дополнительные атрибуты события передаются в payload в узле `tags` (или `attributes` для обратной совместимости). При наличии такого узла пары ключ-значение сохраняются в таблицу `audit.audit_event_tags`, где ключ ограничен уникальностью в рамках события, а значения приводятся к строке (сложные структуры сериализуются как JSON). Это позволяет фильтровать события по тегам без парсинга всего поля `payload`.

## Запуск в Docker
1. Соберите образ:
   ```bash
   gradle bootBuildImage --imageName=crm-audit:local
   ```
2. Запустите контейнер:
   ```bash
   docker run --rm -p ${AUDIT_SERVICE_PORT:-8088}:8088 --env-file ../../env.example crm-audit:local
   ```

## Полезные ссылки
- Архитектурная роль Audit: [`docs/architecture.md`](../../docs/architecture.md#1-общая-структура-сервисов).【F:docs/architecture.md†L17-L18】
- Детальный стек и очереди: [`docs/tech-stack.md`](../../docs/tech-stack.md#audit).【F:docs/tech-stack.md†L339-L360】
