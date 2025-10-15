# Backups
Здесь будут скрипты/логи бэкапа. Общие требования и технологический стек описаны в разделе [«Backup»](../docs/tech-stack.md#backup) основной документации.

> ℹ️ По умолчанию `docker compose` использует сервисные имена сети (`postgres`, `rabbitmq`, `consul`, `redis`) при заполнении `BACKUP_*`-переменных. При запуске без контейнеров сохраняйте значения с `localhost`, как описано в `.env` и сопутствующих инструкциях.

### Backup Service
- Исходники FastAPI-сервиса находятся в `../backend/backup`.
- Управляет расписаниями в таблицах `backup_jobs` и `backup_job_runs` и отдает REST API (`/health`, `/jobs/**`).
- При выполнении заданий использует системные утилиты (`pg_dump`, `pg_basebackup`, `consul snapshot save`, `rabbitmqadmin export`, `redis-cli`) и выгружает артефакты в S3, публикуя статусы в очередь `backup.notifications`.
- Тесты сервиса (`pytest`, `moto`, `testcontainers`) запускаются из каталога `backend/backup`.
- `scripts/` — cron-скрипты
- `postgres/` — структура и справочные SQL-файлы для seed-данных и проверок восстановления. Каталог `seeds/` содержит идемпотентные SQL-скрипты с базовыми пользователями, клиентами и платежами; порядок применения описан в `backups/postgres/seeds/README.md`.
- Локальные артефакты: `db/*.sql.gz`, `minio/snap-*` (после настройки)
