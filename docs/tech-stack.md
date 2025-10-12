# Технологический стек

## Стек по сервисам

### Gateway/BFF
- **Язык**: TypeScript (Node.js LTS).
- **Фреймворк**: NestJS с модулем `@nestjs/axios` для агрегации.
- **Библиотеки БД/очередей**: `ioredis` для работы с Redis; прямой работы с PostgreSQL нет.
- **Формат API**: REST (JSON) для фронтенда, внутренние вызовы — REST/gRPC к доменным сервисам.

**Зависимости и общие компоненты**
- Redis: хранение сессий и кэша агрегаций.
- Service Discovery/Config: получает адреса сервисов из Consul.

**Тестирование и обновление**
- Контрактные тесты против заглушек сервисов; Smoke-тесты UI после деплоя.
- Обновление происходит с минимальными простоями через blue/green деплой.

### Auth
- **Язык**: Kotlin (JVM 17).
- **Фреймворк**: Spring Boot (WebFlux + Security).
- **Библиотеки БД/очередей**: Spring Data + R2DBC для PostgreSQL, `lettuce` для Redis.
- **Формат API**: REST (JSON) и OAuth2/OpenID Connect endpoints.

**Зависимости и общие компоненты**
- Общая PostgreSQL-схема `auth` в кластере Postgres.
- Redis как кеш токенов и одноразовых кодов.
- Использует общий SMTP-провайдер для писем подтверждения.

**Тестирование и обновление**
- Unit-тесты через JUnit5 и интеграционные тесты с Testcontainers.
- При обновлении требует миграции через Liquibase и ротации ключей JWT.

### CRM/Deals
- **Язык**: Python 3.11.
- **Фреймворк**: FastAPI.
- **Библиотеки БД/очередей**: SQLAlchemy 2.0 + Alembic для PostgreSQL, Celery + Redis для фоновых задач.
- **Формат API**: REST (JSON) + WebSocket уведомления по прогрессу операций.

**Зависимости и общие компоненты**
- Общая PostgreSQL-схема `crm`.
- Redis (очередь Celery) и общий S3-совместимый сторедж для временных файлов.
- Интеграция с сервисом Documents через внутренний REST.

**Тестирование и обновление**
- Покрытие pytest + async-интеграционные сценарии.
- Деплой сопровождается прогоном Alembic миграций и прогревом кэша.

### Payments
- **Язык**: Go 1.21.
- **Фреймворк**: Fiber (HTTP) + пакет `go-chi/render` для REST.
- **Библиотеки БД/очередей**: `pgx` для PostgreSQL, `sarama` для Kafka.
- **Формат API**: REST (JSON), события публикуются в Kafka.

**Зависимости и общие компоненты**
- PostgreSQL-схема `payments` в общем кластере.
- Kafka topic `payments.events` для уведомлений.
- Использует общий сервис валютных курсов (внешний API) через Gateway.

**Тестирование и обновление**
- Unit-тесты на Go + consumer-driven контрактные тесты.
- Rolling update через Kubernetes; требует синхронизации схемы с миграциями `golang-migrate`.

### Documents
- **Язык**: TypeScript (Node.js).
- **Фреймворк**: NestJS + `@googleapis/drive` SDK.
- **Библиотеки БД/очередей**: TypeORM для PostgreSQL, BullMQ для очередей (Redis).
- **Формат API**: REST (JSON) и Webhook для уведомлений о синхронизации.

**Зависимости и общие компоненты**
- PostgreSQL-схема `documents`.
- Redis кластер для очередей синхронизации.
- Общие сервисные аккаунты Google Drive.

**Тестирование и обновление**
- Интеграционные тесты против песочницы Google Drive.
- Деплой требует ручной проверки квот API и миграций TypeORM.

### Tasks/Notifications
- **Язык**: Rust 1.72.
- **Фреймворк**: Actix Web для API, `tokio` для асинхронных задач.
- **Библиотеки БД/очередей**: `sqlx` для PostgreSQL, `lapin` для RabbitMQ.
- **Формат API**: REST (JSON) + WebSocket поток уведомлений; публикация событий в RabbitMQ.

**Зависимости и общие компоненты**
- Общая PostgreSQL-схема `notifications`.
- RabbitMQ кластер для очередей заданий и доставок.
- Redis для хранения короткоживущих токенов напоминаний.

**Тестирование и обновление**
- Нагрузочные тесты на очередь и end-to-end сценарии через k6.
- Обновление через canary-релизы; миграции выполняются утилитой `sqlx migrate`.

### Telegram Bot
- **Язык**: Python 3.11.
- **Фреймворк**: aiogram 3.
- **Библиотеки БД/очередей**: `asyncpg` для PostgreSQL, `aio-pika` для RabbitMQ.
- **Формат API**: Вебхуки Telegram + внутренний REST Callback.

**Зависимости и общие компоненты**
- Общая PostgreSQL-схема `bot` (читает справочники из `auth` и `crm` через readonly-реплики).
- RabbitMQ очередь `notifications.telegram`.
- Redis для хранения состояния FSM и rate limiting.

**Тестирование и обновление**
- Автотесты на pytest-asyncio с моками Telegram API.
- Перед обновлением прогоняются end-to-end сценарии в staging-боте; деплой по стратегии blue/green.

