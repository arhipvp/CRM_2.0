# Карта зависимостей

Документ агрегирует системные и инфраструктурные зависимости, которые уже задекларированы в README сервисов и шаблоне переменных окружения. Используйте его как справочник при подготовке окружения и проверке, что все внешние сервисы подняты перед запуском компонентов монорепозитория.

## Глобальные инструменты

- **Node.js 18 LTS + pnpm** — базовая платформа для Gateway/BFF, Documents, Tasks и Notifications (NestJS-сервисы).【F:backend/gateway/README.md†L6-L16】【F:backend/documents/README.md†L6-L18】【F:backend/tasks/README.md†L6-L18】【F:backend/notifications/README.md†L8-L20】
- **Node.js 20 LTS + Corepack** — рекомендуемый рантайм для фронтенда на Next.js 15, включая Storybook и Playwright сценарии. После установки выполните `corepack enable` и `corepack prepare pnpm@9 --activate`, чтобы зафиксировать требуемую версию pnpm.【F:frontend/README.md†L6-L22】
- **Python 3.11** — основной рантайм CRM/Deals (FastAPI, SQLAlchemy, Celery).【F:backend/crm/README.md†L6-L17】
- **JDK 17 + Gradle 8** — стек Spring Boot WebFlux для Auth и Audit, где используются Liquibase и Spring Cloud Stream.【F:backend/auth/README.md†L6-L17】【F:backend/audit/README.md†L6-L17】

## Базовая инфраструктура

Общие сервисы запускаются единым docker-compose стеком и разделяются по схемам/очередям между сервисами.

- **PostgreSQL 14+** — единый кластер со схемами `auth`, `crm`, `documents`, `tasks`, `notifications`, `audit`, `backup`; параметры подключения перечислены в `env.example`.【F:env.example†L7-L63】
- **RabbitMQ** — базовый vhost `crm` и выделенные очереди/пользователи для доменных сервисов (`notifications`, `tasks`, `audit`).【F:env.example†L30-L138】
- **Redis** — пулы для сессий, кешей, Celery, BullMQ и rate limiting, как указано в шаблоне окружения.【F:env.example†L74-L131】
- **Consul** — используется Gateway для service discovery и распределённой конфигурации (будет расширяться по мере интеграции).【F:backend/gateway/README.md†L6-L9】【F:env.example†L42-L86】
- **Google Drive API** — сервисный аккаунт и общий диск для Documents-сервиса (или локальный эмулятор).【F:backend/documents/README.md†L6-L38】【F:env.example†L144-L156】
- **Telegram Bot API** — используется Notifications и ботом; поддерживается mock-сервером для dev-среды.【F:backend/notifications/README.md†L8-L44】【F:env.example†L148-L157】

## Сервисные зависимости

| Сервис | Рантайм/фреймворк | БД и очереди | Дополнительно |
| --- | --- | --- | --- |
| **Gateway / BFF** | Node.js 18 LTS, NestJS | Redis, Consul | Настроить `GATEWAY_*` переменные, SSE прокси.【F:backend/gateway/README.md†L6-L17】【F:env.example†L97-L110】 |
| **Auth** | Spring Boot WebFlux (JDK 17) | PostgreSQL `auth`, Redis | OAuth/OIDC конфигурация, Liquibase миграции.【F:backend/auth/README.md†L6-L28】【F:env.example†L55-L117】 |
| **CRM / Deals** | Python 3.11, FastAPI + Celery | PostgreSQL `crm`, Redis, RabbitMQ `crm.events` | Alembic миграции, Celery beat/worker.【F:backend/crm/README.md†L6-L29】【F:env.example†L55-L118】 |
| **Documents** | NestJS (Node.js 18) | PostgreSQL `documents`, Redis BullMQ | Ключи Google Drive, фоновые воркеры.【F:backend/documents/README.md†L6-L40】【F:env.example†L58-L123】【F:env.example†L144-L156】 |
| **Notifications** | NestJS (Node.js 18) | PostgreSQL `notifications`, RabbitMQ `notifications.events`, Redis (rate limit) | Telegram webhook/bot конфигурация.【F:backend/notifications/README.md†L8-L44】【F:env.example†L60-L157】 |
| **Tasks** | NestJS (Node.js 18) | PostgreSQL `tasks`, RabbitMQ `tasks.*`, Redis (отложенные задачи) | Планировщик SLA, BullMQ пула нет (использует Redis напрямую).【F:backend/tasks/README.md†L6-L31】【F:env.example†L59-L131】 |
| **Reports** | Планируется Python/TypeScript | PostgreSQL агрегаты (`crm`, `audit`), RabbitMQ события (позже) | Пока заглушка, но переменные зарезервированы.【F:backend/reports/README.md†L6-L23】【F:env.example†L61-L134】 |
| **Audit** | Spring Boot WebFlux (JDK 17) | PostgreSQL `audit`, RabbitMQ (`audit.events`, `audit.core`, `audit.dlq`) | Liquibase миграции, persistent volume для write-ahead журнала.【F:backend/audit/README.md†L6-L27】【F:env.example†L61-L138】 |
| **Frontend (Next.js)** | Node.js 20 LTS, Next.js 15 | — (получает данные через Gateway) | Требуются переменные `NEXT_PUBLIC_*`, Storybook/Playwright инструменты, pnpm 9 через Corepack.【F:frontend/README.md†L6-L22】【F:env.example†L97-L108】 |

## Как пользоваться

1. **Перед началом работы** проверьте, что глобальные инструменты установлены в нужных версиях (Node.js, Python, JDK, pnpm/Gradle). Это избавит от дрейфа версий между сервисами.
2. **Настраивайте инфраструктуру централизованно**: переменные из `env.example` уже описывают хосты, пользователей и очереди. При добавлении новых компонентов отражайте их и в этом документе, и в шаблоне окружения.
3. **Согласовывайте миграции и фоновые процессы** со стеком сервиса (Alembic, Flyway, Liquibase, BullMQ, Celery и т.д.), чтобы пайплайны CI/CD знали, какие инструменты запускать.

Документ обновляется вместе с README сервисов: если добавляете новый внешний ресурс или меняете версию рантайма, не забудьте синхронизировать сведения здесь и в `env.example`.
