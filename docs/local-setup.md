# Локальная подготовка окружения

Документ связывает общие инструкции по инфраструктуре с конкретными сервисами и их README. Используйте его как точку входа: сначала настраивайте базовые зависимости (PostgreSQL, Redis, RabbitMQ, Consul) по описанию в [`docs/tech-stack.md`](tech-stack.md), затем переходите к конкретному сервису.

## Сводная таблица сервисов
| Сервис | Назначение | Порт по умолчанию | README |
| --- | --- | --- | --- |
| Gateway / BFF | Оркестрация REST/SSE, единая точка входа для веб-клиента и Telegram-бота.【F:docs/architecture.md†L9-L66】 | `8080` | [`backend/gateway/README.md`](../backend/gateway/README.md) |
| Auth | Управление пользователями, ролями и OAuth/OIDC-потоками.【F:docs/architecture.md†L9-L18】 | `8081` | [`backend/auth/README.md`](../backend/auth/README.md) |
| CRM / Deals | Клиенты, сделки, расчёты, полисы и доменные события CRM.【F:docs/architecture.md†L11-L66】 | `8082` | [`backend/crm/README.md`](../backend/crm/README.md) |
| Payments | Учёт платежей и публикация финансовых событий.【F:docs/architecture.md†L12-L66】 | `8083` | [`backend/payments/README.md`](../backend/payments/README.md) |
| Documents | Метаданные и интеграция с Google Drive.【F:docs/architecture.md†L15-L18】 | `8084` | [`backend/documents/README.md`](../backend/documents/README.md) |
| Notifications | Доставка уведомлений и SSE-каналов для клиентов и Telegram-бота.【F:docs/architecture.md†L13-L66】 | `8085` | [`backend/notifications/README.md`](../backend/notifications/README.md) |
| Tasks | Планирование задач, SLA и напоминания.【F:docs/architecture.md†L13-L66】 | `8086` | [`backend/tasks/README.md`](../backend/tasks/README.md) |
| Reports | Аналитика и отчёты (заглушка на текущем этапе).【F:README.md†L53-L74】 | `8087` | [`backend/reports/README.md`](../backend/reports/README.md) |
| Audit | Централизованный журнал действий и метрик.【F:docs/architecture.md†L17-L66】 | `8088` | [`backend/audit/README.md`](../backend/audit/README.md) |
| Frontend | Веб-интерфейс CRM на Next.js 14.【F:docs/tech-stack.md†L99-L118】 | `3000` | [`frontend/README.md`](../frontend/README.md) |

## Как использовать таблицу
1. Выберите сервис и перейдите по ссылке README.
2. Проверьте переменные окружения в [`env.example`](../env.example) — для каждого сервиса указан порт и URL запуска.
3. Настройте базы данных и очереди (см. [«Инфраструктура» в tech-stack](tech-stack.md#инфраструктура)) и запускайте сервис локально или в Docker согласно инструкции.
