# CRM / Deals Service

## Назначение
CRM/Deals управляет клиентами, сделками, расчётами, полисами, журналами и связанными задачами, а также публикует доменные события и подписывается на финансовые события из Payments.【F:docs/architecture.md†L11-L17】【F:docs/tech-stack.md†L172-L204】

## Требования к окружению
- Python 3.11 с поддержкой FastAPI, SQLAlchemy 2.0 и Celery (см. `pyproject.toml` по мере реализации).【F:docs/tech-stack.md†L172-L199】
- Подключение к PostgreSQL (схема `crm`), Redis (очередь Celery) и RabbitMQ (exchange `payments.events`, `crm.events`).【F:docs/tech-stack.md†L178-L194】
- Файл переменных окружения на основе [`env.example`](../../env.example) с секцией CRM.

## Локальный запуск
1. Создайте виртуальное окружение и установите зависимости: `python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt` (или используйте Poetry/uv по стандартам команды).
2. Экспортируйте переменные `CRM_SERVICE_PORT`, `CRM_DATABASE_URL`, `CRM_REDIS_URL`, `CRM_RABBITMQ_URL` и `CRM_RABBITMQ_EVENTS_EXCHANGE`.
3. Запустите приложение:
   ```bash
   uvicorn crm.main:app --host 0.0.0.0 --port "${CRM_SERVICE_PORT:-8082}"
   ```
4. Для воркеров Celery используйте отдельный процесс:
   ```bash
   celery -A crm.worker.app worker -l info
   ```

## Миграции и фоновые скрипты
- В каталоге [`migrations`](migrations/) размещаются скрипты Alembic для схемы `crm`. Запуск: `alembic upgrade head` (передайте `--sql` для dry-run).【F:docs/tech-stack.md†L198-L200】
- Планировщик Celery/beat можно поднять командой `celery -A crm.worker.app beat -l info` для SLA-задач.

## Запуск в Docker
1. Соберите образ (пример многоэтапной сборки):
   ```bash
   docker build -t crm-deals:local -f docker/Dockerfile.crm .
   ```
   Рекомендуемый Dockerfile — Python 3.11 slim + poetry/pip install, запуск `uvicorn`.
2. Запустите контейнер:
   ```bash
   docker run --rm -p ${CRM_SERVICE_PORT:-8082}:8082 --env-file ../../env.example crm-deals:local
   ```
   Для воркеров Celery используйте отдельный контейнер с командой `celery`.

## Полезные ссылки
- Архитектура и взаимодействия CRM: [`docs/architecture.md`](../../docs/architecture.md#2-взаимодействия-и-потоки-данных).【F:docs/architecture.md†L61-L66】
- Технологический стек CRM/Deals: [`docs/tech-stack.md`](../../docs/tech-stack.md#crm--deals).【F:docs/tech-stack.md†L172-L200】
