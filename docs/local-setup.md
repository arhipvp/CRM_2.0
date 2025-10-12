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
# Локальная инфраструктура: пошаговая инструкция

Эта инструкция покрывает подготовку переменных окружения, запуск Docker Compose и базовую проверку вспомогательных сервисов, необходимых для разработки CRM.

## 1. Подготовьте `.env`

1. Скопируйте шаблон: `cp env.example .env`.
2. Обновите в `.env` чувствительные значения:
   - Пароли PostgreSQL (общий `POSTGRES_PASSWORD` и пароли ролей `*_DB_PASSWORD`).
   - Учётные данные RabbitMQ (`RABBITMQ_DEFAULT_USER`, `RABBITMQ_DEFAULT_PASS`).
   - Секреты JWT (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`).
   - Интеграционные токены (Google Drive, Telegram Bot и т.д.), если планируете проверки соответствующих сервисов.
3. Убедитесь, что переменные портов (`POSTGRES_PORT`, `RABBITMQ_PORT`, `REDIS_PORT`, `CONSUL_*`, `PGADMIN_PORT`) не конфликтуют с уже занятыми на вашей машине.

## 2. Запустите инфраструктурные контейнеры

1. Перейдите в директорию `infra`: `cd infra`.
2. Поднимите сервисы: `docker compose up -d`.
3. Проверьте статус: `docker compose ps` — все контейнеры должны находиться в состоянии `Up` или `healthy`.
4. Для завершения работы выполните `docker compose down` (с флагом `-v`, если нужно очистить данные).

## 3. Проверьте создание схем и ролей PostgreSQL

Скрипт `infra/postgres/init.sh` автоматически создаёт схемы и роли, указанные в `.env`. Чтобы убедиться, что всё применилось:

```bash
docker compose exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\dn"
```

В выводе должны присутствовать схемы `auth`, `crm`, `payments`, `documents`, `tasks`, `notifications`, `audit`, `backup`.

## 4. Проверка доступности сервисов

| Сервис         | Проверка                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------ |
| PostgreSQL     | `psql postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:$POSTGRES_PORT/$POSTGRES_DB -c "SELECT 1"` |
| RabbitMQ       | Откройте [http://localhost:${RABBITMQ_MANAGEMENT_PORT}](http://localhost:${RABBITMQ_MANAGEMENT_PORT}) и авторизуйтесь указанными учётными данными. |
| Redis          | `redis-cli -u $REDIS_URL ping` (должен вернуть `PONG`).                                           |
| Consul         | Откройте веб-интерфейс [http://localhost:${CONSUL_HTTP_PORT}](http://localhost:${CONSUL_HTTP_PORT}). |
| pgAdmin        | Откройте [http://localhost:${PGADMIN_PORT}](http://localhost:${PGADMIN_PORT}), авторизуйтесь и добавьте подключение к `postgres`. |

> ℹ️ Отдельный сервис для отправки e-mail локально не используется: уведомления по почте в разработке отключены.

## 5. Подключение приложений

После запуска инфраструктуры сервисы и приложения могут использовать значения из `.env`. Примеры:

- Backend сервисы используют URI `*_DATABASE_URL`, `RABBITMQ_URL`, `REDIS_*`, `CONSUL_HTTP_ADDR`.
- Фронтенд считывает публичные переменные `NEXT_PUBLIC_*`.
- Для фоновых заданий и уведомлений доступны очереди RabbitMQ и Redis.
- Для фоновых заданий и уведомлений используются очереди RabbitMQ и Redis.

## 6. Очистка состояния

Если нужно полностью пересоздать окружение (например, после изменений схем):

```bash
cd infra
docker compose down -v
rm -rf ../backups/postgres
```

После этого повторите шаги с запуска инфраструктуры.

> ⚠️ **Важно.** Локальные пароли и секреты в `.env` предназначены только для разработки. Никогда не коммитьте файл `.env` в репозиторий и не переиспользуйте эти значения в боевых средах.
