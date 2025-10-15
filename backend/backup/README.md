# Backup Service

Сервис резервного копирования инфраструктуры CRM. Реализован на FastAPI и APScheduler и отвечает за экспорт бэкапов PostgreSQL, Consul, RabbitMQ и Redis с отправкой артефактов в S3 и публикацией статусов в очередь `backup.notifications`.

## Возможности
- REST API для управления заданиями (`/jobs`), ручного запуска (`/jobs/{id}/run`) и просмотра истории.
- Health-check `/health` для Kubernetes и smoke-проверок.
- Планировщик APScheduler, который поднимает cron-задания из таблицы `backup_jobs`.
- Модули исполнителей, которые вызывают `pg_dump` / `pg_basebackup`, `consul snapshot save`, `rabbitmqadmin export` и выгружают RDB/AOF Redis с упаковкой в tar.gz.
- Отправка артефактов в S3 через `boto3` и публикация статусов выполнения в RabbitMQ (`backup.notifications`).

## Конфигурация
Настройки считываются из переменных окружения с префиксом `BACKUP_`. Ключевые параметры:

| Переменная | Назначение |
|------------|------------|
| `BACKUP_DATABASE_URL` | PostgreSQL DSN для хранения заданий и истории |
| `BACKUP_POSTGRES_BACKUP_DSN` | DSN целевого кластера PostgreSQL для `pg_dump`/`pg_basebackup` |
| `BACKUP_S3_ENDPOINT_URL` | (опционально) кастомный endpoint S3 |
| `BACKUP_S3_ACCESS_KEY` / `BACKUP_S3_SECRET_KEY` | креды доступа к бакету |
| `BACKUP_S3_BUCKET` | имя бакета для артефактов |
| `BACKUP_RABBITMQ_URL` | AMQP URL для публикации уведомлений |
| `BACKUP_RABBITMQ_MANAGEMENT_URL` | HTTP-URL RabbitMQ для экспорта через `rabbitmqadmin` |
| `BACKUP_RABBITMQ_ADMIN_USER` / `BACKUP_RABBITMQ_ADMIN_PASSWORD` | креды `rabbitmqadmin` |
| `BACKUP_CONSUL_HTTP_ADDR` | адрес Consul API для `snapshot save` |
| `BACKUP_REDIS_HOST` / `BACKUP_REDIS_PORT` / `BACKUP_REDIS_DATA_DIR` | параметры Redis для получения RDB и копирования AOF |

Полный список параметров смотрите в `backup/config.py` и `env.example`.

## Локальный запуск
```bash
cd backend/backup
poetry install
poetry run uvicorn backup.main:create_app --factory --reload --port 8094
```

Перед запуском убедитесь, что заданы переменные окружения `BACKUP_*` (можно воспользоваться `.env`).

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
│   └── storage.py     # Загрузка артефактов в S3
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
