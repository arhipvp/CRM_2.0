# Карта зависимостей

Документ агрегирует системные и инфраструктурные зависимости, которые уже задекларированы в README сервисов и шаблоне переменных окружения. Используйте его как справочник при подготовке окружения и проверке, что все внешние сервисы подняты перед запуском компонентов монорепозитория.

## Глобальные инструменты

- **Node.js 18 LTS + pnpm** — базовая платформа для Gateway/BFF и Documents (NestJS-сервисы).【F:backend/gateway/README.md†L6-L18】【F:backend/documents/README.md†L6-L24】
- **Python 3.11** — основной рантайм CRM/Deals (FastAPI, SQLAlchemy, Celery).【F:backend/crm/README.md†L6-L17】
- **JDK 17 + Gradle 8** — стек Spring Boot WebFlux для Auth, где используются Liquibase и Spring Cloud Stream.【F:backend/auth/README.md†L6-L17】

## Базовая инфраструктура

Общие сервисы запускаются единым docker-compose стеком и разделяются по схемам/очередям между сервисами.

- **PostgreSQL 14+** — единый кластер со схемами `auth`, `crm`, `documents`, `tasks`, `backup`, `reports`; параметры подключения перечислены в `env.example`. Историческая схема `audit` более не используется.【F:env.example†L7-L85】【F:infra/postgres/init.sh†L1-L74】
- **RabbitMQ** — базовый vhost `crm` и выделенные очереди/пользователи для доменных сервисов CRM (модули задач и уведомлений) и Backup. Отдельные пользователи под Audit не требуются после удаления сервиса.【F:env.example†L87-L196】
- **Redis** — пулы для сессий, кешей, Celery, BullMQ и rate limiting, как указано в шаблоне окружения.【F:env.example†L114-L177】
- **Consul** — используется Gateway для service discovery и распределённой конфигурации (будет расширяться по мере интеграции).【F:backend/gateway/README.md†L9-L34】【F:env.example†L120-L165】
- **Серверное файловое хранилище** — каталог `DOCUMENTS_STORAGE_ROOT`, системный пользователь `crm-docs`, утилиты `setfacl/getfacl`, механизм бэкапа (`rsync`/`restic`).【F:backend/documents/README.md†L6-L134】【F:env.example†L185-L264】
- **Локальное или self-hosted хранилище документов** — выделенный том/директория для бинарных файлов и политика резервного копирования (`DOCUMENTS_STORAGE_*`).【F:backend/documents/README.md†L6-L48】【F:env.example†L198-L232】
- **Telegram Bot API** — используется CRM для подтверждений уведомлений и Telegram-ботом; поддерживается mock-сервером для dev-среды.【F:docs/api/notifications.md†L1-L33】【F:env.example†L263-L297】

## Сервисные зависимости

| Сервис | Рантайм/фреймворк | БД и очереди | Дополнительно |
| --- | --- | --- | --- |
| **Gateway / BFF** | Node.js 18 LTS, NestJS | Redis, Consul | Настроить `GATEWAY_*` переменные, REST/SSE прокси к CRM/Auth.【F:backend/gateway/README.md†L6-L38】【F:env.example†L290-L336】 |
| **Auth** | Spring Boot WebFlux (JDK 17) | PostgreSQL `auth`, Redis | REST-контракт регистрации и JWT, Liquibase миграции.【F:backend/auth/README.md†L6-L28】【F:env.example†L38-L148】 |
| **CRM / Deals** | Python 3.11, FastAPI + Celery | PostgreSQL `crm`, `tasks`, Redis, RabbitMQ `crm.events` | Alembic миграции, Celery beat/worker, встроенные модули задач и уведомлений (`CRM_TASKS_*`, `CRM_EVENTS_EXCHANGE`).【F:backend/crm/README.md†L6-L66】【F:env.example†L162-L217】 |
| **Documents** | NestJS (Node.js 20) | PostgreSQL `documents`, Redis BullMQ | Локальное/self-hosted хранилище (`DOCUMENTS_STORAGE_*`), POSIX ACL, стратегия бэкапов и отдельный воркер BullMQ.【F:backend/documents/README.md†L16-L24】【F:backend/documents/README.md†L38-L43】【F:backend/documents/README.md†L101-L114】【F:env.example†L210-L247】 |
| **Reports** | Python 3.11, FastAPI + SQLAlchemy Async | PostgreSQL (`crm`, `reports` схемы) | Poetry-скрипты `reports-api`/`reports-refresh-views`, переменные `REPORTS_DATABASE_URL`, `REPORTS_CRM_SCHEMA`, `REPORTS_SOURCE_SCHEMAS`, `REPORTS_SCHEMA`.【F:backend/reports/README.md†L6-L57】【F:env.example†L70-L115】 |

## Как пользоваться

1. **Перед началом работы** проверьте, что глобальные инструменты установлены в нужных версиях (Node.js, Python, JDK, pnpm/Gradle). Это избавит от дрейфа версий между сервисами.
2. **Настраивайте инфраструктуру централизованно**: переменные из `env.example` уже описывают хосты, пользователей и очереди. При добавлении новых компонентов отражайте их и в этом документе, и в шаблоне окружения.
3. **Согласовывайте миграции и фоновые процессы** со стеком сервиса (Alembic, Flyway, Liquibase, BullMQ, Celery и т.д.), чтобы пайплайны CI/CD знали, какие инструменты запускать.

Документ обновляется вместе с README сервисов: если добавляете новый внешний ресурс или меняете версию рантайма, не забудьте синхронизировать сведения здесь и в `env.example`.
