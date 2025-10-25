# Backup Service

Сервис резервного копирования инфраструктуры CRM. Реализован на FastAPI и APScheduler и отвечает за экспорт бэкапов PostgreSQL, Consul, RabbitMQ и Redis с отправкой артефактов в S3 и публикацией статусов в очередь `backup.notifications`.

## Возможности
- REST API для управления заданиями (`/jobs`), ручного запуска (`/jobs/{id}/run`) и просмотра истории.
- Health-check `/health` для Kubernetes и smoke-проверок.
- Планировщик APScheduler, который поднимает cron-задания из таблицы `backup_jobs`.
- Модули исполнителей, которые вызывают `pg_dump` / `pg_basebackup`, `consul snapshot save`, `rabbitmqadmin export` и выгружают RDB/AOF Redis с упаковкой в tar.gz.
- Отправка артефактов в S3 через `boto3` (при корректной конфигурации) или сохранение локально в `artifacts_dir`,
  и публикация статусов выполнения в RabbitMQ (`backup.notifications`).

## Конфигурация
Настройки считываются из переменных окружения с префиксом `BACKUP_`. Ключевые параметры:

| Переменная | Назначение |
|------------|------------|
| `BACKUP_DATABASE_URL` | PostgreSQL DSN для хранения заданий и истории |
| `BACKUP_INTERNAL_DATABASE_URL` | Внутренний DSN для docker compose; использует сетевое имя `postgres` |
| `BACKUP_POSTGRES_BACKUP_DSN` | DSN целевого кластера PostgreSQL для `pg_dump`/`pg_basebackup` |
| `BACKUP_INTERNAL_POSTGRES_BACKUP_DSN` | Внутренний DSN PostgreSQL для docker compose |
| `BACKUP_S3_ENDPOINT_URL` | HTTP(S) endpoint S3 без ведущих/замыкающих пробелов (опционально; пустая строка или отсутствие значения отключают кастомный endpoint) |
| `BACKUP_S3_REGION_NAME` | Регион S3; пустое значение автоматически заменяется на `us-east-1` |
| `BACKUP_S3_ACCESS_KEY` / `BACKUP_S3_SECRET_KEY` | креды доступа к бакету (оставьте пустыми или удалите, чтобы выключить `S3Storage`) |
| `BACKUP_S3_BUCKET` | имя бакета для артефактов (пустое значение отключает `S3Storage`) |
| `BACKUP_ARTIFACTS_DIR` | локальный каталог для временных артефактов и `DummyStorage` |
| `BACKUP_RABBITMQ_URL` | AMQP URL для публикации уведомлений (например, при локальном запуске на хосте — `localhost`) |
| `BACKUP_RABBITMQ_INTERNAL_URL` | AMQP URL для публикации внутри docker compose (использует сетевое имя контейнера `rabbitmq`) |
| `BACKUP_RABBITMQ_MANAGEMENT_URL` | HTTP-URL RabbitMQ для экспорта через `rabbitmqadmin` |
| `BACKUP_RABBITMQ_INTERNAL_MANAGEMENT_URL` | Внутренний HTTP-URL RabbitMQ для docker compose |
| `BACKUP_RABBITMQ_ADMIN_USER` / `BACKUP_RABBITMQ_ADMIN_PASSWORD` | креды `rabbitmqadmin` |
| `BACKUP_CONSUL_HTTP_ADDR` | адрес Consul API для `snapshot save` |
| `BACKUP_INTERNAL_CONSUL_HTTP_ADDR` | Внутренний адрес Consul для docker compose |
| `BACKUP_REDIS_HOST` / `BACKUP_REDIS_PORT` / `BACKUP_REDIS_DATA_DIR` | параметры Redis для получения RDB и копирования AOF |
| `BACKUP_INTERNAL_REDIS_HOST` | Внутреннее имя узла Redis для docker compose |

Полный список параметров смотрите в `backup/config.py` и `env.example`.

> `BACKUP_DATABASE_URL` по умолчанию использует libpq-опцию `options=-csearch_path=...`
> (в URI значение `=` кодируется как `%3D`, например `?options=-csearch_path%3Dbackup`).
> Если указать устаревший параметр `?search_path=...`, сервис преобразует его в libpq
> `options` до инициализации пула соединений, чтобы сохранить обратную совместимость.

> ℹ️ Переменные без суффикса `_INTERNAL` ориентированы на запуск сервиса напрямую на хосте и используют `localhost`.
> Для docker compose предусмотрены дубли с `_INTERNAL`, которые по умолчанию ссылаются на сетевые имена контейнеров
> (`postgres`, `redis`, `consul`). В `infra/docker-compose.yml` приоритет отдаётся `_INTERNAL`-значениям; при их отсутствии
> используются хостовые параметры и безопасный fallback на сервисные имена. Обновляйте оба набора значений в `.env`, если
> инфраструктура разворачивается вне Docker.

## Локальный запуск
```bash
cd backend/backup
poetry install
poetry run uvicorn backup.main:create_app --factory --reload --port 8094
```

Перед запуском убедитесь, что заданы переменные окружения `BACKUP_*` (можно воспользоваться `.env`).
Если параметры S3 (endpoint, bucket и ключи) отсутствуют или пустые, сервис автоматически переключится на
`DummyStorage` и будет складывать файлы в `BACKUP_ARTIFACTS_DIR`. Для отключения S3 достаточно удалить
переменные окружения или оставить их пустыми — валидатор настроек обрезает пробелы и преобразует пустые строки
в `None`. Аналогично, пустое или отсутствующее значение `BACKUP_S3_ENDPOINT_URL` приводит к использованию
SDK по умолчанию без кастомной точки доступа, а пустой `BACKUP_S3_REGION_NAME` автоматически заменяется на
`us-east-1`. При указании кастомного endpoint необходимо использовать URL, начинающийся с `http://` или
`https://` без ведущих/замыкающих пробелов. Если же переменные заданы, но `boto3` возвращает ошибку (например,
из-за недоступного endpoint или некорректных учетных данных), сервис зафиксирует предупреждение в логах и
переключится на `DummyStorage`, продолжая сохранять артефакты локально.

Для ручного запуска задания:
```bash
curl -X POST http://localhost:8094/jobs/1/run
```

## Структура проекта
```
backend/backup/
├── backup/
│   ├── api/           # FastAPI схемы и маршруты
│   ├── executors/     # Исполнители для PostgreSQL, Consul, RabbitMQ и Redis
│   ├── config.py      # Pydantic-настройки
│   ├── db.py          # Репозиторий заданий и запусков
│   ├── main.py        # Точка входа FastAPI
│   ├── notifications.py # Публикация статусов в RabbitMQ
│   ├── service.py     # Бизнес-логика и интеграция с APScheduler
│   └── storage.py     # Загрузка артефактов в S3 или локальное хранение через DummyStorage
├── pyproject.toml
├── README.md
└── tests/            # pytest + moto/testcontainers
```

## Тесты
```
cd backend/backup
poetry run pytest
```
Тесты используют moto для S3 и Testcontainers для PostgreSQL/RabbitMQ.

## DummyStorage и локальное хранение

Для локальной разработки не всегда требуется поднимать MinIO/S3. Если переменные `BACKUP_S3_ENDPOINT_URL`,
`BACKUP_S3_ACCESS_KEY`, `BACKUP_S3_SECRET_KEY` или `BACKUP_S3_BUCKET` не заданы (или заданы пустыми строками),
приложение использует `DummyStorage`. Переменные можно удалить из `.env` или оставить пустыми — приложение
воспримет это как сигнал отключить S3. Все артефакты будут копироваться в каталог `BACKUP_ARTIFACTS_DIR`
(по умолчанию `/tmp/backup-artifacts`). Логи FastAPI выдадут предупреждение о переключении на заглушку.

В production-среде рекомендуется явно указывать все параметры S3 — тогда будет использован `S3Storage`.
