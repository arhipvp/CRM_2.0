# Локальная подготовка окружения

Документ связывает общие инструкции по инфраструктуре с конкретными сервисами и их README. Используйте его как точку входа: сначала настраивайте базовые зависимости (PostgreSQL, Redis, RabbitMQ, Consul) по описанию в [`docs/tech-stack.md`](tech-stack.md), затем переходите к конкретному сервису.

## Быстрый старт

```bash
./scripts/bootstrap-local.sh
```

> ℹ️ Файл `infra/docker-compose.yml` использует синтаксис Docker Compose V2, поэтому поле `version` опущено; убедитесь, что у вас установлена Compose V2. Bootstrap-скрипты корректно работают и с устаревшими инсталляциями Docker Compose без поддержки `docker compose ps --format json`, однако рекомендуется обновиться до Compose V2, чтобы сохранить совместимость с инфраструктурными сценариями и профилями.

Bootstrap-скрипт выполняет полный цикл подготовки инфраструктуры и автоматически поднимает фронтенд. Перед запуском Docker Compose он импортирует переменные из актуального `.env`, поэтому вложенные ссылки (`VAR=${OTHER_VAR}`) подставляются автоматически. После изменения `.env` перезапустите `./scripts/bootstrap-local.sh`, чтобы обновлённые значения попали в контейнеры и дочерние процессы.

### Конфликты портов из `.env`

При запуске `bootstrap-local.sh` скрипт пытается зарезервировать порты, указанные в `.env` (в первую очередь `POSTGRES_PORT`). Если обнаружен конфликт, выполнение прерывается с сообщением вида «Порт 5432, заданный переменной POSTGRES_PORT в .env, уже используется». В этом случае выберите свободное значение порта в файле `.env` и перезапустите bootstrap. По необходимости обновите связанные переменные в шаблоне `env.example` и дочерних сервисах. На хостах без IPv6 проверка пропускает попытку `bind` на `::`, чтобы не создавать ложных срабатываний.

Сценарий последовательно запускает:

1. `scripts/sync-env.sh --non-interactive` — синхронизацию `.env` во всех сервисах с шаблоном `env.example` без ожидания ввода при наличии локальных файлов (существующие файлы пропускаются).
2. `docker compose --env-file .env up -d` в каталоге `infra/` — запуск PostgreSQL, RabbitMQ, Redis и вспомогательных сервисов с подстановкой значений из актуального корневого `.env`.
3. Smoke-проверку `BACKUP_*`: скрипт убеждается, что ключевые переменные (`BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY`, `BACKUP_S3_SECRET_KEY`) заполнены, и останавливает bootstrap при обнаружении пустых значений.
4. ожидание готовности контейнеров через healthcheck (используется `docker compose ps --format json`, а при отсутствии этой опции — табличный вывод старых версий Compose).
5. `infra/rabbitmq/bootstrap.sh` — проверяет и при необходимости поднимает `rabbitmq`, дожидается его готовности по healthcheck и создаёт vhost-ы/пользователей на основе `*_RABBITMQ_URL`. Скрипт устойчив к предупреждениям Docker Compose (`WARNING: ...`) и корректно отрабатывает даже при появлении лишних строк в выводе `docker compose ps`.
6. `scripts/migrate-local.sh` — миграции CRM (Alembic), Auth и Audit (Liquibase/Gradle) и Reports (SQL через `psql`).
7. `docker compose --env-file .env --profile app up -d frontend` в каталоге `infra/` — запуск контейнера Next.js с подключением к сети инфраструктуры (можно пропустить флагом `--skip-frontend` или переменной `BOOTSTRAP_SKIP_FRONTEND=true`).
8. `scripts/load-seeds.sh` — загрузку seed-данных, если скрипт присутствует в репозитории.
9. `scripts/check-local-infra.sh` — smoke-проверку PostgreSQL, Redis, Consul, RabbitMQ Management UI и /health Reports (при запущенном сервисе).

Для пользователей, которым нужны дополнительные опции (автооткрытие браузера, принудительный отказ от запуска фронтенда), остаётся `./scripts/dev-up.sh`. Он оборачивает `bootstrap-local.sh`, повторно синхронизирует `.env` фронтенда и позволяет управлять сценариями через флаги `--open-browser`, `--no-browser`, `--skip-frontend`. При запуске `./scripts/dev-up.sh --skip-frontend` флаг автоматически пробрасывается в bootstrap, поэтому контейнер фронтенда не стартует. При необходимости выполнить шаги вручную (например, для отладки) запустите `./scripts/bootstrap-local.sh`, затем `./scripts/sync-env.sh frontend` и `docker compose --env-file .env --profile app up -d frontend` в `infra/`. После ручного редактирования `.env` обязательно перезапустите bootstrap, чтобы переменные снова экспортировались и попали в Docker Compose.

> ℹ️ Все инфраструктурные скрипты и команды Docker Compose теперь вызываются с `--env-file .env`, поэтому важно поддерживать корневой `.env` в актуальном состоянии: новые переменные следует подтягивать через `scripts/sync-env.sh`, а значения секретов обновлять вручную.

### Режимы синхронизации `.env`

- **Интерактивный** (значение по умолчанию). При запуске `./scripts/sync-env.sh` без дополнительных флагов скрипт проверяет наличие существующего `.env` и предлагает на выбор: перезаписать файл, пропустить каталог или прервать операцию. Подходит для ручного обновления, когда нужно свериться с изменениями.
- **Автоматический** (`--non-interactive`). Скрипт не задаёт вопросов и работает детерминированно. Вариант по умолчанию `--non-interactive` пропускает уже созданные `.env`, а `--non-interactive=overwrite` перезаписывает их. Этот режим используется в bootstrap-скриптах и CI, где пользовательского ввода быть не должно.

### Требования

- Docker Desktop/Engine с поддержкой Compose V2.
- Python 3 (интерпретатор `python3`) — обязательная зависимость bootstrap-скриптов и инфраструктурных утилит, используемых для парсинга JSON и проверок состояния сервисов.
- Poetry (для CRM/Deals) и JDK 17+ для запуска Gradle wrapper Auth.
- Node.js 20 LTS для фронтенда. Установите LTS-версию с сайта [nodejs.org](https://nodejs.org) или через менеджер версий, затем выполните подготовку менеджера пакетов:
  1. `corepack enable` — включает Corepack глобально.
  2. `corepack prepare pnpm@9 --activate` — активирует требуемую версию pnpm.
- Рекомендуемые CLI: `psql`, `redis-cli`, `curl`. При их отсутствии bootstrap выведет предупреждения; при необходимости используйте `docker compose exec` или альтернативные инструменты.
- CLI-инструменты `psql`, `redis-cli`, `curl` остаются опциональными: при запущенном Docker Compose `scripts/check-local-infra.sh` выполняет проверки внутри контейнеров, а `scripts/sync-env.sh` создаёт `.env` без дополнительных утилит.
- Доступ к интернету для скачивания зависимостей при первом запуске сервисов.

При ошибках скрипт продолжит выполнение остальных шагов, а итоговая таблица покажет, на каком этапе произошёл сбой. Логи неуспешных шагов сохраняются во временную директорию, путь к которой выводится в консоль.

## Сводная таблица сервисов
| Сервис | Назначение | Порт по умолчанию | README |
| --- | --- | --- | --- |
| 1. Gateway / BFF | Оркестрация REST/SSE, единая точка входа для веб-клиента и Telegram-бота.【F:docs/architecture.md†L9-L66】 | `8080` | [`backend/gateway/README.md`](../backend/gateway/README.md) |
| 2. Auth | Управление пользователями, ролями и OAuth/OIDC-потоками.【F:docs/architecture.md†L9-L18】 | `8081` | [`backend/auth/README.md`](../backend/auth/README.md) |
| 3. CRM / Deals | Клиенты, сделки, расчёты, полисы и доменные события CRM.【F:docs/architecture.md†L11-L66】 | `8082` | [`backend/crm/README.md`](../backend/crm/README.md) |
| 4. Documents | Метаданные и локальное файловое хранилище документов.【F:docs/architecture.md†L15-L18】 | `8084` | [`backend/documents/README.md`](../backend/documents/README.md) |
| 5. Notifications | Доставка уведомлений и SSE-каналов для клиентов и Telegram-бота.【F:docs/architecture.md†L13-L66】 | `8085` | [`backend/notifications/README.md`](../backend/notifications/README.md) |
| 6. Tasks | Планирование задач и напоминаний; SLA будут добавлены в следующих релизах.【F:docs/architecture.md†L13-L66】 | `8086` | [`backend/tasks/README.md`](../backend/tasks/README.md) |
| 7. Telegram Bot | Быстрые сценарии и уведомления в Telegram, webhook + RabbitMQ.【F:docs/architecture/bot.md†L1-L36】 | `8089` | [`backend/telegram-bot/README.md`](../backend/telegram-bot/README.md) |
| 8. Reports | FastAPI-сервис агрегированных отчётов и витрин на основе CRM/Audit.【F:backend/reports/README.md†L1-L40】 | `8087` | [`backend/reports/README.md`](../backend/reports/README.md) |
| 9. Audit | Централизованный журнал действий и метрик.【F:docs/architecture.md†L17-L66】 | `8088` | [`backend/audit/README.md`](../backend/audit/README.md) |
| 10. Frontend | Веб-интерфейс CRM на Next.js 15 и React 19; см. [требования](#требования) к Node.js 20 LTS и pnpm 9.【F:docs/tech-stack.md†L99-L118】 | `FRONTEND_SERVICE_PORT` (по умолчанию `3000`) | [`frontend/README.md`](../frontend/README.md) |

## Как использовать таблицу
1. Выберите сервис и перейдите по ссылке README.
2. Синхронизируйте переменные окружения через [`scripts/sync-env.sh`](../scripts/sync-env.sh), чтобы в каждом сервисе появился свежий `.env` из корневого [`env.example`](../env.example). По умолчанию скрипт работает в интерактивном режиме: при обнаружении существующего файла он спрашивает, перезаписывать ли его, или позволяет пропустить каталог. Для автоматического запуска (например, в CI или bootstrap) добавьте флаг `--non-interactive`, который по умолчанию пропускает существующие файлы или, с вариантом `--non-interactive=overwrite`, перезаписывает их без вопросов. После копирования обязательно обновите секреты и уникальные значения вручную.
3. Настройте базы данных и очереди (см. [«Инфраструктура» в tech-stack](tech-stack.md#инфраструктура)) и запускайте сервис локально или в Docker согласно инструкции.

### Gateway / BFF: быстрый старт

- Перейдите в `backend/gateway` и установите зависимости (`pnpm install`).
- Выполните `../../scripts/sync-env.sh backend/gateway` (или добавьте `--non-interactive` для неинтерактивного запуска), чтобы получить свежий `.env` из шаблона. При ручном режиме скрипт предупредит о перезаписи существующего файла — при необходимости выберите `skip` и обновите значения вручную. После синхронизации проверьте секреты (`JWT_*`, `SESSION_SECRET`) и параметры upstream (`GATEWAY_UPSTREAM_*`, `REDIS_*`, `CONSUL_*`).
- Запустите `pnpm start:dev` и проверьте доступность эндпоинта `GET http://localhost:${GATEWAY_SERVICE_PORT}/api/v1/health`.
- Для быстрой проверки SSE подключитесь к `http://localhost:${GATEWAY_SERVICE_PORT}/api/v1/streams/heartbeat` — поток должен присылать события каждые 15 секунд.【F:backend/gateway/src/sse/sse.controller.ts†L4-L18】

### CRM / Deals: быстрый старт

- Перейдите в `backend/crm` и установите зависимости `poetry install`.

- Выполните `../../scripts/sync-env.sh backend/crm` (при необходимости добавьте `--non-interactive`), чтобы скопировать шаблон `.env`. После синхронизации пересмотрите блок переменных `CRM_*` (PostgreSQL, Redis, RabbitMQ, очереди событий) и замените секреты на локальные значения.
- Примените миграции: `poetry run alembic upgrade head`.
- Запустите API: `poetry run crm-api` (или `poetry run uvicorn crm.app.main:app --reload`). Порт и хост берутся из `.env` (`CRM_SERVICE_PORT`, `CRM_SERVICE_HOST`), поэтому их легко переопределить на время отладки.
- Поднимите Celery-воркер: `poetry run crm-worker worker -l info`.
- Для smoke-проверки платежей выполните новую последовательность REST-запросов (через Gateway или напрямую в CRM):
  ```bash
  # Получить список платежей полиса
  curl -H "Authorization: Bearer <JWT>" \
    "http://localhost:${CRM_SERVICE_PORT:-8082}/api/v1/deals/${DEAL_ID}/policies/${POLICY_ID}/payments"

  # Создать плановый платёж
  curl -X POST -H "Authorization: Bearer <JWT>" -H "Content-Type: application/json" \
    -d '{"planned_amount":"150000.00","currency":"RUB","planned_date":"2024-03-01"}' \
    "http://localhost:${CRM_SERVICE_PORT:-8082}/api/v1/deals/${DEAL_ID}/policies/${POLICY_ID}/payments"

  # Добавить поступление и расход в созданный платёж
  curl -X POST -H "Authorization: Bearer <JWT>" -H "Content-Type: application/json" \
    -d '{"amount":"50000.00","currency":"RUB","category":"wire","posted_at":"2024-03-05"}' \
    "http://localhost:${CRM_SERVICE_PORT:-8082}/api/v1/deals/${DEAL_ID}/policies/${POLICY_ID}/payments/${PAYMENT_ID}/incomes"

  curl -X POST -H "Authorization: Bearer <JWT>" -H "Content-Type: application/json" \
    -d '{"amount":"2500.00","currency":"RUB","category":"agency_fee","posted_at":"2024-03-05","note":"Комиссия"}' \
    "http://localhost:${CRM_SERVICE_PORT:-8082}/api/v1/deals/${DEAL_ID}/policies/${POLICY_ID}/payments/${PAYMENT_ID}/expenses"
  ```
  После отправки запросов убедитесь, что `net_total` в ответе платежа равен сумме поступлений минус расходы.

### Notifications: быстрый старт

- Перейдите в `backend/notifications` и установите зависимости: `pnpm install` (понадобится Node.js 18+ и активированный Corepack).
- Синхронизируйте `.env`: `../../scripts/sync-env.sh backend/notifications`. Проверьте блок `NOTIFICATIONS_*`, задайте `NOTIFICATIONS_TELEGRAM_ENABLED`/`NOTIFICATIONS_TELEGRAM_MOCK`, заполните токен/чат для рассылок и секрет вебхука (`NOTIFICATIONS_TELEGRAM_WEBHOOK_SECRET`), если тестируете обратные вызовы Telegram.
- Запустите HTTP-приложение c SSE: `pnpm start:api:dev`. Проверьте `GET http://localhost:${NOTIFICATIONS_SERVICE_PORT}/api/notifications/stream` и `GET /api/notifications/health` — поток должен отдавать события при публикации в очередь, а health-эндпоинт помогает в docker-compose и probes.
- Для фоновых подписчиков RabbitMQ выполните `pnpm start:workers:dev`. Процесс использует те же конфигурации и автоматически обрабатывает очередь `notifications.events`, публикуя сообщения в SSE и (при включении) Telegram. Сборка и запуск без watch выполняются командами `pnpm run build:all`, `pnpm start:api` и `pnpm start:workers`.
- Миграции применяются через `pnpm run migrations:run`; bootstrap вызывает команду автоматически (см. [`scripts/migrate-local.sh`](../scripts/migrate-local.sh)).
### Tasks: быстрый старт

- Перейдите в `backend/tasks` и установите зависимости `pnpm install`.
- Выполните `../../scripts/sync-env.sh backend/tasks` (добавьте `--non-interactive` при запуске из bootstrap/CI). После синхронизации проверьте блок переменных `TASKS_*` (PostgreSQL, RabbitMQ, Redis, worker-настройки).
- Примените миграции и сиды: `pnpm migration:run` и `pnpm seed:statuses`. Команды используют `TASKS_DATABASE_URL` и `TASKS_REDIS_URL` из `.env`.
- Запустите API: `pnpm start:dev` (по умолчанию порт `TASKS_SERVICE_PORT`, маршрут `GET /api/health`).
- Для обработки отложенных задач поднимите отдельный процесс: `TASKS_WORKER_ENABLED=true pnpm start:workers`. Worker читает Redis-очередь `TASKS_DELAYED_QUEUE_KEY` и переводит задачи в статус `pending`.


### Reports: быстрый старт

- Перейдите в `backend/reports` и установите зависимости `poetry install`.
- Выполните `../../scripts/sync-env.sh backend/reports` (при необходимости добавьте `--non-interactive`). Проверьте значения `REPORTS_DATABASE_URL`, `REPORTS_SCHEMA`, `REPORTS_CRM_SCHEMA`, `REPORTS_AUDIT_SCHEMA` и `REPORTS_SERVICE_PORT`.
- Примените миграции: запустите `../../scripts/migrate-local.sh` (bootstrap делает это автоматически) или выполните `psql "$REPORTS_DATABASE_URL" -v reports_schema=${REPORTS_SCHEMA} -v crm_schema=${REPORTS_CRM_SCHEMA} -f migrations/001_create_deal_pipeline_summary.sql`.
- Запустите API: `poetry run reports-api`.
- Для обновления материализованных представлений запустите `poetry run reports-refresh-views`.
- Smoke-проверка: `curl http://localhost:${REPORTS_SERVICE_PORT:-8087}/health`.
## CI/CD: временно только локальные проверки

- GitHub Actions приостановлены: пайплайны сохранены как `.github/workflows/ci.yml.disabled` и `.github/workflows/frontend.yml.disabled`, поэтому при пуше и открытии PR задачи не запускаются. Чтобы восстановить автоматический пайплайн, верните расширение `.yml` у нужного файла и запушьте изменение в `main`.
- Для локальной проверки повторите шаги пайплайнов вручную: выполните линтеры, тесты и сборку контейнеров по инструкциям соответствующих сервисов. Рекомендуемый порядок: `lint` → `unit-tests` → `contract-tests` → `build`.
- Для резервного копирования добавлена smoke-проверка `scripts/check-local-infra.sh`, которая убеждается, что все переменные `BACKUP_*` внутри контейнера заполнены. При необходимости выполните ручную диагностику:
  ```bash
  cd infra/
  docker compose --env-file ../.env exec backup sh -c 'env | grep "^BACKUP_"'
  ```
  Пустые значения сигнализируют о необходимости обновить `.env` по шаблону `env.example` и повторно синхронизировать переменные.
  > ℹ️ В Docker Compose значения по умолчанию используют сервисные имена (`postgres`, `rabbitmq`, `consul`, `redis`). Если запускаете Backup Service напрямую на хосте, оставляйте `localhost` и соответствующие порты по инструкциям `.env`.
- При необходимости имитируйте поведение CI с помощью `make`-таргетов или локального runners — добавьте их описание в README выбранного сервиса. Переменные из `env.example` по-прежнему обязательны для сборок и должны быть заполнены в локальном `.env`. Флаг `CI_CD_DISABLED=true` (см. шаблон `env.example`) можно использовать в локальных скриптах, чтобы пропускать этапы, завязанные на GitHub Actions.

## Kubernetes-манифесты и Argo CD

- Базовый слой (`infra/k8s/base`) содержит Namespace, Deployment/Service/ConfigMap/Secret для Gateway и развёртывание Redis как минимальной зависимости.
- Оверлеи `infra/k8s/overlays/{dev,stage,prod}` задают namespace/prefix, image-tag, параметры ConfigMap и реплики для Gateway; патчи расширяются по мере добавления сервисов.
- Файл `infra/k8s/argocd/gateway-apps.yaml` описывает три Argo CD Application-ресурса, которые синхронизируют соответствующие оверлеи и автоматически создают namespace (`syncOptions: CreateNamespace=true`).

# Быстрый bootstrap окружения (рекомендуемый)

Используйте `./scripts/bootstrap-local.sh` (см. раздел «Быстрый старт» выше): он синхронизирует `.env`, поднимает `docker compose`, настраивает RabbitMQ, применяет миграции, загружает seed-данные (если доступны) и запускает `scripts/check-local-infra.sh`. Скрипт идемпотентен, отображает прогресс и собирает логи неудачных шагов. Ниже сохранена fallback-инструкция для ручного выполнения каждого этапа.

# Локальная инфраструктура: пошаговая инструкция (fallback)

Эта инструкция покрывает подготовку переменных окружения, запуск Docker Compose и базовую проверку вспомогательных сервисов, необходимых для разработки CRM.

## 1. Подготовьте `.env`

1. Запустите `./scripts/sync-env.sh` — скрипт автоматически скопирует `env.example` в корень репозитория и основные сервисы. При обнаружении существующего файла появится подсказка с выбором `y`, `N` или `skip`, чтобы не перезаписать локальные значения; для автоматического пропуска используйте флаг `--non-interactive` (или `--non-interactive=overwrite`, если нужно перезаписать файлы без вопросов).
2. После синхронизации проверьте секреты и уникальные параметры вручную:
   1. Откройте `.env` в корне и замените заглушки у всех `*_PASSWORD`, `*_SECRET`, `*_TOKEN`, `*_API_KEY` на значения из секретного хранилища.
   2. Сверьте `*_RABBITMQ_URL`, `*_REDIS_URL`, `POSTGRES_*` с локальными инстансами и обновите пароли, если они отличаются от шаблона.
   3. Проверьте блоки `AUTH_JWT_*`, `GATEWAY_UPSTREAM_*`, параметры webhook-ов и OAuth — убедитесь, что они соответствуют вашей среде разработки.
   4. Для Notifications заполните `NOTIFICATIONS_DB_*`, `NOTIFICATIONS_RABBITMQ_*`, `NOTIFICATIONS_REDIS_*` и параметры Telegram (`NOTIFICATIONS_TELEGRAM_*`, включая `NOTIFICATIONS_TELEGRAM_WEBHOOK_SECRET`), чтобы worker мог публиковать события в SSE и бот.
      > ⚠️ Значения, содержащие пробелы или плейсхолдеры в фигурных скобках (например, `Client {ownerId}`), заключайте в двойные кавычки: так `.env` можно безопасно импортировать через `set -a && source .env`.
   3. Повторите проверку для `.env` каждого сервиса, который был скопирован или перезаписан, чтобы не оставить дефолтные секреты.
      > ℹ️ Скрипт использует актуальный [`env.example`](../env.example). Запускайте его после любых изменений шаблона (например, обновления `RABBITMQ_URL` или перехода `AUTH_DATABASE_URL` на `r2dbc:`), чтобы подтянуть новые переменные. Локальные секреты обязательно перепроверьте после синхронизации.
      - График платежей и движения средств теперь управляются напрямую через REST-интерфейс CRM (`/payments`, `/incomes`, `/expenses`). Переменная `PAYMENTS_CRM_WEBHOOK_SECRET` и прежние настройки интеграции больше не требуются.
      - Каталог `backend/payments` сохранён только как архивная документация: отдельная схема `payments` и переменные `PAYMENTS_DB_*` больше не используются, а `.env` для этого сервиса не синхронизируется автоматически.
2. Обновите в `.env` чувствительные значения:
   - Пароли PostgreSQL (общий `POSTGRES_PASSWORD` и пароли ролей `*_DB_PASSWORD`).
   - Учётные данные RabbitMQ (`RABBITMQ_DEFAULT_USER`, `RABBITMQ_DEFAULT_PASS`, при необходимости `RABBITMQ_DEFAULT_VHOST`). Docker Compose создаёт пользователя и виртуальный хост `crm`, а переменная `RABBITMQ_URL` сразу указывает на них.
   - Секреты JWT и параметры токенов:
     - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `SESSION_SECRET` (Gateway).
     - `AUTH_JWT_SECRET`, `AUTH_JWT_ISSUER`, `AUTH_JWT_AUDIENCE`, `AUTH_ACCESS_TOKEN_TTL`, `AUTH_REFRESH_TOKEN_TTL` (Auth).
       Убедитесь, что `AUTH_JWT_ISSUER` совпадает с базовым URL сервиса авторизации (`AUTH_BASE_URL`) без дополнительного суффикса.
   - Интеграционные токены (Telegram Bot и т.д.) и параметры файлового хранилища (`DOCUMENTS_STORAGE_*`), если планируете проверки соответствующих сервисов.
   - При выделении отдельных прав для сервисов добавляйте собственные `*_RABBITMQ_URL` (см. примеры в `env.example`).
   - Проверьте, что `AUTH_DATABASE_URL` использует формат `r2dbc:postgresql://.../${POSTGRES_DB}?schema=auth` (или эквивалент с `search_path=auth`); если в локальном `.env` остался старый `postgresql://`, обновите значение по образцу из `env.example`, например `r2dbc:postgresql://auth:auth@localhost:5432/crm?schema=auth`.
3. Убедитесь, что переменные портов (`POSTGRES_PORT`, `RABBITMQ_PORT`, `REDIS_PORT`, `CONSUL_*`, `PGADMIN_PORT`) не конфликтуют с уже занятыми на вашей машине.
4. Перезапустите Auth после обновления `.env`, чтобы подтянуть новые значения: `set -a && set -u && source .env && set +u && set +a && cd backend/auth && ./gradlew bootRun`. Шаблон окружения не обращается к необъявленным переменным, поэтому импорт `source .env` под `set -u` безопасен. Spring Boot читает `AUTH_JWT_SECRET`, `AUTH_JWT_AUDIENCE`, `AUTH_ACCESS_TOKEN_TTL` и `AUTH_REFRESH_TOKEN_TTL` из окружения при старте.

> 📢 После обновления шаблона напомните команде пересобрать собственные `.env` и обновить секреты в корпоративном секретном менеджере до выкладки. Последнее изменение `AUTH_JWT_ISSUER` означает, что старые локальные файлы `.env` могут ссылаться на некорректный URL авторизации.

### Documents: быстрый старт

1. Перейдите в `backend/documents` и установите зависимости (`pnpm install`).
2. Подготовьте каталог хранения документов на хосте (по умолчанию `/var/lib/crm/documents`):
   ```bash
   sudo mkdir -p /var/lib/crm/documents
   sudo chown 1000:1000 /var/lib/crm/documents   # замените 1000:1000 на UID/GID пользователя внутри контейнера
   sudo chmod 770 /var/lib/crm/documents
   ```
   - Узнать UID/GID контейнера можно командой `docker compose run --rm documents id` или по спецификации k8s. Для нестандартных образов уточняйте пользователя в Dockerfile.
   - При включённом SELinux/AppArmor используйте соответствующие контексты (`:Z`/`:z` в Docker Compose, `securityContext` и `fsGroup` в Kubernetes) либо выполните `sudo chcon -Rt svirt_sandbox_file_t /var/lib/crm/documents`.
3. Синхронизируйте `.env`: `../../scripts/sync-env.sh backend/documents` (добавьте `--non-interactive` при необходимости). Проверьте значения `DOCUMENTS_STORAGE_DRIVER`, `DOCUMENTS_STORAGE_ROOT`, при необходимости задайте квоту `DOCUMENTS_STORAGE_QUOTA_MB` и публичный URL (`DOCUMENTS_STORAGE_PUBLIC_BASE_URL`).
4. Примените миграции TypeORM: `npx dotenv -e ../../.env pnpm typeorm migration:run -d typeorm.config.ts` или укажите путь к актуальному `.env`.
5. Запустите REST API: `pnpm start:dev` — сервис слушает порт `DOCUMENTS_SERVICE_PORT` (по умолчанию `8084`).
6. Запустите воркер очередей отдельно: `pnpm start:worker:dev`. Он использует Redis из `DOCUMENTS_REDIS_URL` и обрабатывает задания `documents.upload` и `documents.sync`.
7. Настройте регулярное резервное копирование каталога (`/var/lib/crm/documents`) вместе с базой `documents`, чтобы исключить рассинхронизацию метаданных и файлов (см. рекомендации ниже).


### Интеграции

#### Файловое хранилище документов

Documents хранит бинарные файлы локально или на self-hosted volume. Сервис читает конфигурацию из `DOCUMENTS_STORAGE_*`, а база данных содержит относительные пути. Такой подход рассчитан на VPS и on-premise окружения без внешнего облака.

**Подготовка каталога**

- Создайте директорию на хосте и назначьте владельца с UID/GID, совпадающим с пользователем процесса внутри контейнера (см. шаги в «Documents: быстрый старт»). При необходимости задайте `fsGroup` в Kubernetes, чтобы `kubelet` автоматически выставил группу тома.
- Для SELinux добавьте флаг `:Z`/`:z` к bind-монту или выполните `chcon`. AppArmor-профиль должен разрешать доступ к каталогу (проверьте `profile.d` или используйте `unconfined`).

**Docker Compose**

```yaml
services:
  documents:
    environment:
      DOCUMENTS_STORAGE_DRIVER: "local"
      DOCUMENTS_STORAGE_ROOT: "/var/lib/crm/documents"
      DOCUMENTS_STORAGE_QUOTA_MB: "20480"      # пример квоты 20 ГБ
    volumes:
      - type: bind
        source: /srv/crm/documents
        target: /var/lib/crm/documents
        bind:
          selinux: z
```

- Путь `source` (`/srv/crm/documents`) должен существовать на хосте и быть доступен для записи. Для режимов разработки можно указать относительный путь (`./var/documents`), но для VPS предпочтителен отдельный диск или LVM-раздел.
- При смене `DOCUMENTS_STORAGE_ROOT` внутри контейнера обновите `target` у volume и `.env` одновременно.

**Kubernetes**

- Создайте `PersistentVolume`/`PersistentVolumeClaim` или `hostPath`, в зависимости от окружения. Пример c PVC:
  ```yaml
  apiVersion: v1
  kind: PersistentVolumeClaim
  metadata:
    name: documents-storage
  spec:
    accessModes: [ReadWriteOnce]
    resources:
      requests:
        storage: 50Gi
  ---
  apiVersion: apps/v1
  kind: Deployment
  metadata:
    name: documents
  spec:
    template:
      spec:
        securityContext:
          fsGroup: 1000
        containers:
          - name: documents
            env:
              - name: DOCUMENTS_STORAGE_ROOT
                value: /var/lib/crm/documents
            volumeMounts:
              - name: documents-storage
                mountPath: /var/lib/crm/documents
        volumes:
          - name: documents-storage
            persistentVolumeClaim:
              claimName: documents-storage
  ```
- Убедитесь, что `fsGroup` совпадает с пользователем внутри контейнера. При использовании `hostPath` проверьте контексты SELinux (`seLinuxOptions`) и AppArmor-профили.

**Резервное копирование**

- Снимайте бэкапы каталога с файлами и базы данных `documents` синхронно (например, `rsync` + `pg_dump` в одном `systemd`-таймере), чтобы наборы данных оставались согласованными.
- Для горячих бэкапов используйте снапшоты файловой системы (LVM, ZFS) или привязанные к облаку snapshot-инструменты, затем копируйте содержимое на удалённый сервер/облако.
- Минимально тестируйте восстановление: разворачивайте резервную копию в отдельном окружении и проверяйте выборку документов по относительным путям.

#### Telegram Bot (токен Bot API)

1. **Кто отвечает.** Владельцем боевого бота является продукт-менеджер CRM (`pm-crm@company.local`). Он запрашивает выпуск токена у BotFather и следит за ротацией.
2. **Запрос токена.** Создайте задачу «Telegram Bot token» в Jira и согласуйте с безопасностью. После одобрения продукт-менеджер создаст или обновит бота через [BotFather](https://core.telegram.org/bots#botfather).
3. **Хранение.** Токен передаётся через секретное хранилище (1Password/HashiCorp Vault). Доступ к нему имеют DevOps и ответственные разработчики.
4. **Требуемые права.** На проде бот подключён к корпоративному аккаунту; включите двухфакторную аутентификацию Telegram и назначьте доверенных администраторов. Webhook URL должен быть доступен из интернета.
5. **Инициализация.** После получения токена пропишите его в `TELEGRAM_BOT_TOKEN`, публичный URL — в `TELEGRAM_WEBHOOK_URL`, при необходимости добавьте `TELEGRAM_WEBHOOK_SECRET`.

#### Локальные заглушки и тестовые значения

- **Документы.** Для разработки достаточно локального каталога в репозитории (`./var/documents`). Убедитесь, что он исключён из VCS (`.gitignore`) и доступен процессу `node`. Значения `DOCUMENTS_STORAGE_DRIVER=local` и `DOCUMENTS_STORAGE_ROOT=./var/documents` подходят для одиночного стенда.
- **Telegram.** Для интеграции Telegram включите mock, который идёт вместе с сервисом уведомлений: `TELEGRAM_MOCK_ENABLED=true`, `TELEGRAM_MOCK_SERVER_URL=http://localhost:8085/telegram`. Токен `TELEGRAM_BOT_TOKEN` допустимо временно заполнить значением `dev-mock-token`, пока нет боевого доступа. Webhook URL можно оставить пустым — mock читает локальные запросы напрямую.
- **Ротация.** После получения реальных ключей отключите заглушки (`TELEGRAM_MOCK_ENABLED=false`) и перенесите секреты в управляемый Vault. Для stage/prod использование mock-значений запрещено.

## 2. Запустите инфраструктурные контейнеры

1. Перейдите в директорию `infra`: `cd infra`.
2. Поднимите сервисы: `docker compose up -d`.
3. Проверьте статус: `docker compose ps` — все контейнеры должны находиться в состоянии `Up` или `healthy`.
4. Для завершения работы выполните `docker compose down` (с флагом `-v`, если нужно очистить данные).

### Создайте пользователей и vhost-ы RabbitMQ для сервисов

Автоматизация оформлена в скрипте [`infra/rabbitmq/bootstrap.sh`](../infra/rabbitmq/bootstrap.sh). Он читает указанный `.env`, находит все переменные `*_RABBITMQ_URL` (единый источник правды прописан в [`env.example`](../env.example)) и через `rabbitmqctl` создаёт отсутствующие vhost-ы и пользователей, обновляя права при повторном запуске. Перед первым вызовом `rabbitmqctl` скрипт проверяет статус контейнера через `docker compose ps rabbitmq`, при необходимости автоматически выполняет `docker compose up -d rabbitmq`, а затем дожидается готовности сервиса по healthcheck (`docker compose ps --format json`). Если поднять контейнер не удалось, bootstrap завершится с подсказкой по логам. Пустые или неполные URL (без пользователя/vhost) пропускаются с предупреждением, поэтому заготовленные переменные в `.env` не прервут bootstrap.

1. Убедитесь, что локальный `.env` соответствует актуальному шаблону (см. шаг 1 выше).
2. Если `rabbitmq` ещё не запущен, можно пропустить ручной `docker compose up -d rabbitmq`: скрипт проверит состояние контейнера и поднимет его самостоятельно, прежде чем запускать `rabbitmqctl`.
3. Выполните скрипт из корня репозитория:

   ```bash
   bash infra/rabbitmq/bootstrap.sh .env
   ```

4. Ожидаемый вывод (первый запуск создаёт объекты, последующие просто подтверждают их наличие):

   ```text
   ==> Обработка пользователя 'crm' и vhost 'crm'
     • vhost 'crm' уже существует
     • обновлён пароль пользователя 'crm'
     • подтверждены права 'crm' на vhost 'crm'
   ==> Обработка пользователя 'notifications' и vhost 'notifications'
     • создан vhost 'notifications'
     • создан пользователь 'notifications'
     • подтверждены права 'notifications' на vhost 'notifications'
   ...
   ==> Обработка пользователя 'audit' и vhost 'audit'
     • vhost 'audit' уже существует
     • обновлён пароль пользователя 'audit'
     • подтверждены права 'audit' на vhost 'audit'

   Готово: проверено 5 комбинаций пользователь/vhost.
   ```

Скрипт можно выполнять сколько угодно раз — он идемпотентен. Для ручной проверки воспользуйтесь `docker compose exec rabbitmq rabbitmqctl list_users` и `docker compose exec rabbitmq rabbitmqctl list_vhosts`.

### Загрузите seed-набор PostgreSQL

Набор `backups/postgres/seeds` автоматизирован скриптом [`./scripts/load-seeds.sh`](../scripts/load-seeds.sh). Он читает параметры подключения из актуального `.env`, поэтому перед запуском синхронизируйте файл с [env.example](../env.example) (см. шаг «Подготовьте `.env`») и убедитесь, что миграции Auth (`./gradlew update`) и CRM (`poetry run alembic upgrade head`) уже применены.

**Требования**

- Установленный `psql` **или** запущенный Docker с контейнером `crm-postgres` (`docker compose up -d` в каталоге `infra/`).
- Созданный `.env`, значения переменных подключения (`POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`) совпадают с шаблоном `env.example`, который остаётся источником правды.
- Выполненные миграции схем `auth`, `crm`.

**Запуск**

```bash
./scripts/load-seeds.sh
```

Скрипт применяет SQL-файлы в порядке Auth → CRM, выводит прогресс и завершает работу при первой ошибке. Если нужно загрузить только часть набора (например, повторно применить CRM), воспользуйтесь фильтром по подстроке имени файла:

```bash
./scripts/load-seeds.sh --only crm
```

В отсутствии локального `psql` сценарий автоматически выполнит `docker compose exec postgres psql`, перенаправив SQL внутрь контейнера. После успешного завершения появится сообщение `Готово.` — база содержит актуальные тестовые данные для smoke-проверок.

## 3. Проверьте создание схем и ролей PostgreSQL

Скрипт `infra/postgres/init.sh` автоматически создаёт схемы и роли, указанные в `.env`. Чтобы убедиться, что всё применилось:

```bash
docker compose exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\dn"
```

В выводе должны присутствовать схемы `auth`, `crm`, `documents`, `tasks`, `notifications`, `audit`, `backup`.

## 4. Запуск миграций

После подготовки инфраструктуры примените миграции сервисов согласно их README. Для CRM/Deals baseline (`2024031501_baseline.py`) уже опубликован, поэтому выполните `poetry run alembic upgrade head` в директории `backend/crm`. Остальные сервисы подключаются по мере появления ревизий.

#### Быстрый запуск миграций (CRM + Auth)

Чтобы не переключаться вручную между проектами, используйте скрипт из корня репозитория:

```bash
./scripts/migrate-local.sh
```

Сценарий:

1. Загружает переменные из `.env` (убедитесь, что он создан на основе `env.example` и содержит заполненные блоки `CRM_*`, `AUTH_*`, `POSTGRES_*`, `REDIS_*`, `RABBITMQ_*`).
2. Запускает `poetry run alembic upgrade head` в `backend/crm`.
3. Выполняет `./gradlew update` в `backend/auth`.

> Требования: установленный Poetry (для CRM) и JDK 17 + Gradle wrapper (для Auth). Перед запуском убедитесь, что PostgreSQL и Redis доступны, а схемы созданы по шагам выше.

## 5. Проверка доступности сервисов

### Основной сценарий: Docker Compose + smoke-check

После `docker compose up -d` (см. шаги bootstrap-скрипта) выполните `./scripts/check-local-infra.sh`, чтобы убедиться в готовности PostgreSQL, Redis, Consul и RabbitMQ Management UI.

- Скрипт ориентирован на тот же набор зависимостей, что и `./scripts/bootstrap-local.sh`: Docker Engine с Compose V2, `psql`, `redis-cli`, `curl` и актуальный `.env`, синхронизированный через [`scripts/sync-env.sh`](../scripts/sync-env.sh). Эти требования уже отражены в [`README.md`](../README.md) и проверяются в первом шаге bootstrap.
- При наличии Docker Compose проверки выполняются внутри контейнеров (`docker compose exec`) и завершаются ошибкой, если какие-то сервисы не запущены. Сообщение подскажет, какие контейнеры нужно поднять повторно.
- Результат выводится в виде таблицы. Статус `OK` подтверждает успешный `SELECT 1` в PostgreSQL, `PING → PONG` в Redis, наличие лидера Consul и доступность RabbitMQ UI.

Пример запуска:

```bash
./scripts/check-local-infra.sh
```

### Ручные проверки (fallback)
### Автоматизированный smoke-check

1. Убедитесь, что в корне репозитория лежит актуальный `.env` (обновлён через `./scripts/sync-env.sh`, при необходимости с флагом `--non-interactive`).
2. Проверьте установку утилит, которые использует скрипт:
   - `psql` (PostgreSQL client);
   - `redis-cli`;
   - `curl`.
   При отсутствии любой из утилит используйте `docker compose exec` и эквивалентные команды внутри контейнеров — bootstrap сообщит о таких пропусках предупреждением.
3. Выполните из корня репозитория:

   ```bash
   ./scripts/check-local-infra.sh
   ```

4. Ожидаемый вывод при успешном запуске (значения в колонке «Комментарий» могут отличаться, но статус должен быть `OK`):
### Fallback: локальные CLI без Docker

Если инфраструктура запущена через системные сервисы или Docker недоступен, скрипт автоматически переключается на локальные CLI. Убедитесь, что `psql`, `redis-cli` и `curl` находятся в `PATH` — эти же утилиты требуются и для fallback-ветки bootstrap.

При работе вне Docker проверьте, что `.env` содержит корректные значения `DATABASE_URL`, `REDIS_URL`, `CONSUL_HTTP_ADDR`, `RABBITMQ_MANAGEMENT_URL`, `RABBITMQ_DEFAULT_USER` и `RABBITMQ_DEFAULT_PASS`: они используются для прямых подключений.

### Ручные проверки (при необходимости)

| Сервис         | Проверка                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------ |
| PostgreSQL     | `psql postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:$POSTGRES_PORT/$POSTGRES_DB -c "SELECT 1"` |
| RabbitMQ       | Откройте [http://localhost:${RABBITMQ_MANAGEMENT_PORT}](http://localhost:${RABBITMQ_MANAGEMENT_PORT}) и авторизуйтесь указанными учётными данными. |
| Redis          | `redis-cli -u $REDIS_URL ping` (должен вернуть `PONG`).                                           |
| Consul         | Откройте веб-интерфейс [http://localhost:${CONSUL_HTTP_PORT}](http://localhost:${CONSUL_HTTP_PORT}). |
| pgAdmin        | Откройте [http://localhost:${PGADMIN_PORT}](http://localhost:${PGADMIN_PORT}), авторизуйтесь и добавьте подключение к `postgres`. |

> ℹ️ Отдельный сервис для отправки e-mail локально не используется: уведомления по почте в разработке отключены.

## 6. Подключение приложений

После запуска инфраструктуры сервисы и приложения могут использовать значения из `.env`. Примеры:

- Backend сервисы используют URI `*_DATABASE_URL`, `RABBITMQ_URL`, `REDIS_*`, `CONSUL_HTTP_ADDR`.
- Фронтенд считывает публичные переменные `NEXT_PUBLIC_*`.
  - По умолчанию шаблон ориентирован на Docker-сеть `infra`: `NEXT_PUBLIC_API_BASE_URL` и `NEXT_PUBLIC_*_SSE_URL` указывают на `http://gateway:8080`, чтобы фронтенд в контейнере обращался к сервису Gateway по имени.
  - Если вы запускаете фронтенд на хостовой машине, переопределите значения в `.env.local`, используя `http://localhost:${GATEWAY_SERVICE_PORT}` для API и всех SSE-каналов.
- Для фоновых заданий и уведомлений используйте очереди RabbitMQ и Redis из запущенного Docker Compose.
- Для проверки готовности можно запустить ключевые сервисы локально:
  - **Gateway / BFF:**

    ```bash
    cd backend/gateway
    pnpm install
    pnpm start:dev
    ```

    После старта убедитесь, что `GET http://localhost:${GATEWAY_SERVICE_PORT}/api/v1/health` возвращает `200 OK`.

  - **Auth:**

    ```bash
    cd backend/auth
    ./gradlew bootRun
    ```

    Перед запуском проверьте, что скопировали свежие значения `AUTH_*` из `env.example` в локальный `.env` (после изменений JWT-параметров вроде `AUTH_JWT_SECRET`, `AUTH_JWT_AUDIENCE`, `AUTH_ACCESS_TOKEN_TTL`, `AUTH_REFRESH_TOKEN_TTL` не забудьте пересоздать `.env`, чтобы подтянуть актуальные настройки). Для проверки доступности сервиса выполните `GET http://localhost:${AUTH_SERVICE_PORT}/actuator/health` — ответ должен быть `200 OK`.

  - **CRM / Deals:**

    ```bash
    cd backend/crm
    poetry install
    poetry run crm-api
    ```

    При необходимости поднимите Celery-воркер: `poetry run crm-worker worker -l info`.

  - **Frontend:**

    ```bash
    cd frontend
    pnpm install
    pnpm dev
    ```

    Приложение будет доступно на `http://localhost:${FRONTEND_SERVICE_PORT:-3000}`. Перед запуском можно задать `FRONTEND_SERVICE_PORT=3100` (или `PORT=3100`), чтобы запустить Next.js на другом порту; скрипты `pnpm dev` и `pnpm start` автоматически используют это значение.

## 7. Очистка состояния

Если нужно полностью пересоздать окружение (например, после изменений схем):

```bash
cd infra
docker compose down -v
# Удалите только локальные каталоги данных, созданные Docker (они перечислены в .gitignore):
rm -rf pgdata redis_data minio_data postgres/data rabbitmq/data */data
```

После этого повторите шаги с запуска инфраструктуры. Если по ошибке были изменены seed-файлы в `backups/postgres/seeds`, выполните `git checkout -- backups/postgres/seeds` для возврата к зафиксированной версии.

> ⚠️ **Важно.** Локальные пароли и секреты в `.env` предназначены только для разработки. Никогда не коммитьте файл `.env` в репозиторий и не переиспользуйте эти значения в боевых средах.
