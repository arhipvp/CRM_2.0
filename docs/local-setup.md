# Локальная подготовка окружения

Документ связывает общие инструкции по инфраструктуре с конкретными сервисами и их README. Используйте его как точку входа: сначала настраивайте базовые зависимости (PostgreSQL, Redis, RabbitMQ, Consul) по описанию в [`docs/tech-stack.md`](tech-stack.md), затем переходите к конкретному сервису.

## Быстрый старт

```bash
./scripts/bootstrap-local.sh
```

> ℹ️ Веб-интерфейс Next.js исключён из репозитория: для проверки пользовательских сценариев подключайтесь к Gateway (REST/SSE) либо используйте Telegram-бота из [`backend/telegram-bot`](../backend/telegram-bot/README.md).

> ℹ️ Файл `infra/docker-compose.yml` использует синтаксис Docker Compose V2, поэтому поле `version` опущено; убедитесь, что у вас установлена Compose V2. Bootstrap-скрипты корректно работают и с устаревшими инсталляциями Docker Compose без поддержки `docker compose ps --format json`, однако рекомендуется обновиться до Compose V2, чтобы сохранить совместимость с инфраструктурными сценариями и профилями.

Bootstrap-скрипт выполняет полный цикл подготовки инфраструктуры. Перед запуском Docker Compose он импортирует переменные из актуального `.env` без дополнительной обработки: шаблон `env.example` теперь содержит развёрнутые значения вместо ссылок вида `VAR=${OTHER_VAR}`. После изменения `.env` перезапустите `./scripts/bootstrap-local.sh`, чтобы обновлённые значения попали в контейнеры и дочерние процессы. При необходимости запустить прикладные сервисы на хосте добавьте флаг `--with-backend` или переменную `BOOTSTRAP_WITH_BACKEND=true` — после миграций helper `scripts/start-backend.sh` создаст фоновые процессы, сохранив PID/логи в `.local/run/backend` и проверив отсутствие дублирующих запусков. Чтобы стартовать только часть сервисов, укажите `--service NAME` (можно передавать несколько имён через запятую или повторять флаг).

Bootstrap также синхронизирует пароли PostgreSQL-ролей с текущими значениями переменных окружения при каждом запуске: если вы обновили секреты в `.env`, просто перезапустите скрипт, и роли получат новые пароли без ручных действий.

#### Журналы и отчёты bootstrap

По умолчанию `bootstrap-local.sh` сохраняет все логи и вспомогательные файлы в каталоге `.local/logs/bootstrap/run-<дата>-<время>/`. Для каждого шага создаётся файл `steps/<NN>_<название>.log`, а по завершении формируется сводка `summary.md` (таблица статусов) и `summary.json`. Временные артефакты и диагностические данные из `mktemp` перемещаются в подкаталог `tmp/`, поэтому после успешного выполнения никакие логи не удаляются. Скрипт выводит путь к каталогу с журналами в конце работы.

Чтобы изменить расположение артефактов, воспользуйтесь `--log-dir <путь>` или установите переменную окружения `BOOTSTRAP_LOG_DIR`. Если сохранение логов не нужно, добавьте `--discard-logs` (аналог — `BOOTSTRAP_SAVE_LOGS=false`), тогда по завершении запуска каталог будет удалён.

Профиль `backend` включает Gateway, Auth, CRM и Documents. Скрипт запускает его отдельной командой, ждёт успешных healthcheck-ов (`docker compose --profile backend wait` либо ручной опрос `/api/v1/health`, `/healthz`, `/health`) и позволяет выключить профиль флагом `--skip-backend` или переменной `BOOTSTRAP_SKIP_BACKEND=true`. Если необходимо перейти к ручной проверке без ожидания healthcheck, передайте `--skip-backend-wait` или `BOOTSTRAP_SKIP_BACKEND_WAIT=true` — шаг попадёт в отчёт как `SKIP`. Если параллельно включён флаг `--with-backend`, helper предупредит о возможном дублировании и предложит отключить compose-профиль. Для ручного управления используйте `docker compose --env-file .env --profile backend up -d` / `down` в каталоге `infra/`.

### Конфликты портов из `.env`

При запуске `bootstrap-local.sh` скрипт пытается зарезервировать порты, указанные в `.env` (в первую очередь `POSTGRES_PORT`). Если обнаружен конфликт, выполнение прерывается с сообщением вида «Порт 5432, заданный переменной POSTGRES_PORT в .env, уже используется». В этом случае выберите свободное значение порта в файле `.env` и перезапустите bootstrap. Значение `POSTGRES_PORT` влияет только на порт, пробрасываемый на хост; внутри сети Docker сервис `postgres` продолжает слушать `5432`, поэтому изменения нужно дублировать лишь в строках подключения на хосте. На хостах без IPv6 проверка пропускает попытку `bind` на `::`, чтобы не создавать ложных срабатываний.

Сценарий последовательно запускает:

1. `scripts/sync-env.sh --non-interactive` — синхронизацию `.env` во всех сервисах с шаблоном `env.example` без ожидания ввода при наличии локальных файлов (существующие файлы пропускаются).
2. `docker compose --env-file .env up -d` в каталоге `infra/` — запуск PostgreSQL, RabbitMQ, Redis и вспомогательных сервисов с подстановкой значений из актуального корневого `.env`.
3. Ожидание готовности инфраструктуры через healthcheck (`docker compose wait` либо резервный цикл при отсутствии команды).
4. `infra/rabbitmq/bootstrap.sh` — проверяет и при необходимости поднимает `rabbitmq`, дожидается его готовности по healthcheck и создаёт vhost-ы/пользователей на основе `*_RABBITMQ_URL`. Скрипт устойчив к предупреждениям Docker Compose (`WARNING: ...`) и корректно отрабатывает даже при появлении лишних строк в выводе `docker compose ps`.
5. `scripts/migrate-local.sh` — миграции CRM (Alembic), Auth (Liquibase/Gradle) и Reports (SQL через `psql`), пока backend-профиль ещё не запущен. Отдельный сервис Audit удалён из репозитория и больше не участвует в цикле миграций.
6. Smoke-проверку `BACKUP_*`: скрипт убеждается, что ключевые переменные (`BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY`, `BACKUP_S3_SECRET_KEY`) заполнены, и останавливает bootstrap при обнаружении пустых значений.
7. Дополнительную smoke-проверку, которая удостоверяется, что контейнер `backup` действительно запущен в режиме `DummyStorage`, когда `BACKUP_S3_*` пусты.
8. `docker compose --env-file .env --profile backend up -d gateway auth crm documents` — старт профильных API после применения миграций. Скрипт поддерживает флаг `--skip-backend` (или переменную `BOOTSTRAP_SKIP_BACKEND=true`), если требуется ограничиться инфраструктурой без прикладных сервисов.
9. `docker compose --profile backend wait gateway auth crm documents` (либо резервный опрос healthcheck) — ожидание готовности сервисов. Для пропуска передайте `--skip-backend-wait` или `BOOTSTRAP_SKIP_BACKEND_WAIT=true`.
10. `scripts/start-backend.sh` — запуск прикладных сервисов на хосте (Auth `./gradlew bootRun`, CRM API `poetry run crm-api`, CRM worker `poetry run crm-worker worker -l info`, Gateway `pnpm start:dev`). Шаг выполняется только при флаге `--with-backend` или переменной `BOOTSTRAP_WITH_BACKEND=true`; PID, журналы сервисов и файл запуска по умолчанию сохраняются в `.local/run/backend`, повторный запуск проверяет наличие активных процессов. Опция `--service NAME` позволяет стартовать только выбранные сервисы (можно перечислять имена через запятую или повторять опцию для добавления новых значений).
11. `scripts/load-seeds.sh` — загрузку seed-данных, если скрипт присутствует в репозитории.
12. `scripts/check-local-infra.sh` — smoke-проверку PostgreSQL, Redis, Consul, RabbitMQ Management UI и /health Reports (при запущенном сервисе).
13. Проверку REST/SSE API backend-профиля: Gateway (`/api/v1/health`, `/api/v1/streams/heartbeat`), Auth (`/actuator/health`), CRM (`/healthz`) и Documents (`/health`).

Для ручного выполнения шагов bootstrap (например, для отладки) используйте `./scripts/bootstrap-local.sh`. Для профиля backend используйте `docker compose --env-file .env --profile backend up -d` либо `down` для отключения. После ручного редактирования `.env` обязательно перезапустите bootstrap, чтобы переменные снова экспортировались и попали в Docker Compose.

`scripts/start-backend.sh` проверяет наличие `pnpm`, `poetry` и `java`, импортирует `.env`, затем запускает Auth (`./gradlew bootRun`), CRM API (`poetry run crm-api`), CRM worker (`poetry run crm-worker worker -l info`) и Gateway (`pnpm start:dev`) в фоне. Перед стартом CRM-сервисов helper убеждается, что для каталога `backend/crm` уже создано Poetry-окружение, и при необходимости выполняет `poetry install --sync --no-root`, поэтому дополнительный ручной `poetry install` перед использованием флага `--with-backend` не требуется. PID-файлы, журналы сервисов и журнал запуска по умолчанию размещаются в `.local/run/backend/{pids,logs,start-backend.log}`; повторный запуск выявляет уже работающие процессы, не дублирует их и дописывает сообщения в общий лог. Опция `--service NAME` фильтрует список запускаемых сервисов (значения валидируются относительно известного набора и не допускают дублирования), путь можно переопределить через `--log-file PATH` или переменную `START_BACKEND_LOG_FILE`. Для завершения процессов используйте `./scripts/stop-backend.sh` — скрипт читает PID-файлы, отправляет `SIGTERM` (при необходимости `SIGKILL`) и очищает служебные файлы. Флаг `--service NAME` принимает одно имя или список через запятую (`--service gateway,crm-api`) и допускает повторение ключа для добавления сервисов по одному (`--service gateway --service crm-worker`). Это позволяет целенаправленно останавливать только часть процессов, не затрагивая остальные, что удобно при пошаговой отладке и ручном перезапуске отдельных сервисов. Опция `--log-file PATH` (или та же переменная `START_BACKEND_LOG_FILE`) позволяет явно указать журнал запуска при остановке. При флаге `--clean-logs` helper удаляет журналы сервисов и файл запуска (удаление возможно только для путей внутри каталога `.local/run/backend`); в остальных случаях логи остаются для отладки и пополняются при следующем запуске.

> ℹ️ Все инфраструктурные скрипты и команды Docker Compose теперь вызываются с `--env-file .env`, поэтому важно поддерживать корневой `.env` в актуальном состоянии: новые переменные следует подтягивать через `scripts/sync-env.sh`, а значения секретов обновлять вручную.

### Режимы синхронизации `.env`

- **Интерактивный** (значение по умолчанию). При запуске `./scripts/sync-env.sh` без дополнительных флагов скрипт проверяет наличие существующего `.env` и предлагает на выбор: перезаписать файл, пропустить каталог или прервать операцию. Подходит для ручного обновления, когда нужно свериться с изменениями.
- **Автоматический** (`--non-interactive`). Скрипт не задаёт вопросов и работает детерминированно. Вариант по умолчанию `--non-interactive` пропускает уже созданные `.env`, а `--non-interactive=overwrite` перезаписывает их. Этот режим используется в bootstrap-скриптах и CI, где пользовательского ввода быть не должно.

### Требования

- Docker Desktop/Engine с поддержкой Compose V2.
- Python 3 (интерпретатор `python3`) — обязательная зависимость bootstrap-скриптов и инфраструктурных утилит, используемых для парсинга JSON и проверок состояния сервисов. Сценарии автоматически ищут рабочую команду в порядке `python3`, `python`, `python3.12`, `python3.11`, `python3.10`, `python3.9`, `python3.8`, `py -3`, `py -3.12`, `py -3.11`, `py -3.10`, `py -3.9`, поэтому одинаково запускаются в Git Bash на Windows и на Linux/macOS — важно, чтобы хотя бы один вариант был доступен в `PATH`.
- Poetry (для CRM/Deals) и JDK 17+ для запуска Gradle wrapper Auth.
- Рекомендуемые CLI: `psql`, `redis-cli`, `curl`. При их отсутствии bootstrap выведет предупреждения; при необходимости используйте `docker compose exec` или альтернативные инструменты.
- CLI-инструменты `psql`, `redis-cli`, `curl` остаются опциональными: при запущенном Docker Compose `scripts/check-local-infra.sh` выполняет проверки внутри контейнеров, а `scripts/sync-env.sh` создаёт `.env` без дополнительных утилит.
- Доступ к интернету для скачивания зависимостей при первом запуске сервисов.

При ошибках скрипт продолжит выполнение остальных шагов, а итоговая таблица покажет, на каком этапе произошёл сбой. Логи всех шагов, временные файлы и сводные отчёты сохраняются в каталоге запуска (по умолчанию `.local/logs/bootstrap/...`), путь к которому выводится в конце работы. Отключить сохранение можно флагом `--discard-logs` или переменной `BOOTSTRAP_SAVE_LOGS=false`.

## Сводная таблица сервисов
| Сервис | Назначение | Порт по умолчанию | README |
| --- | --- | --- | --- |
| 1. Gateway / BFF | Оркестрация REST/SSE, единая точка входа для веб-клиента и Telegram-бота.【F:docs/architecture.md†L5-L97】 | `8080` | [`backend/gateway/README.md`](../backend/gateway/README.md) |
| 2. Auth | Управление пользователями, ролями и OAuth/OIDC-потоками.【F:docs/architecture.md†L5-L97】 | `8081` | [`backend/auth/README.md`](../backend/auth/README.md) |
| 3. CRM / Deals | Клиенты, сделки, расчёты, полисы, встроенные задачи и уведомления CRM.【F:docs/architecture.md†L5-L97】 | `8082` | [`backend/crm/README.md`](../backend/crm/README.md) |
| 4. Documents | Метаданные и локальное файловое хранилище документов.【F:docs/architecture.md†L9-L97】 | `8084` | [`backend/documents/README.md`](../backend/documents/README.md) |
| 5. Telegram Bot | Быстрые сценарии и уведомления в Telegram, webhook + RabbitMQ.【F:docs/architecture.md†L5-L97】 | `8089` | [`backend/telegram-bot/README.md`](../backend/telegram-bot/README.md) |
| 6. Reports | FastAPI-сервис агрегированных отчётов и витрин на основе CRM.【F:backend/reports/README.md†L1-L40】 | `8087` | [`backend/reports/README.md`](../backend/reports/README.md) |

## Как использовать таблицу
> ℹ️ Сервис Audit удалён из репозитория: инфраструктура больше не создаёт схему `audit`, переменные `AUDIT_*` отсутствуют в `env.example`, а прежние инструкции доступны только в исторических ветках.
1. Выберите сервис и перейдите по ссылке README.
2. Синхронизируйте переменные окружения через [`scripts/sync-env.sh`](../scripts/sync-env.sh), чтобы в каждом сервисе появился свежий `.env` из корневого [`env.example`](../env.example). По умолчанию скрипт работает в интерактивном режиме: при обнаружении существующего файла он спрашивает, перезаписывать ли его, или позволяет пропустить каталог. Для автоматического запуска (например, в CI или bootstrap) добавьте флаг `--non-interactive`, который по умолчанию пропускает существующие файлы или, с вариантом `--non-interactive=overwrite`, перезаписывает их без вопросов. После копирования обязательно обновите секреты и уникальные значения вручную.
3. Настройте базы данных и очереди (см. [«Инфраструктура» в tech-stack](tech-stack.md#инфраструктура)) и запускайте сервис локально или в Docker согласно инструкции.

### Gateway / BFF: быстрый старт

- Перейдите в `backend/gateway` и установите зависимости (`pnpm install`).
- Выполните `../../scripts/sync-env.sh backend/gateway` (или добавьте `--non-interactive` для неинтерактивного запуска), чтобы получить свежий `.env` из шаблона. При ручном режиме скрипт предупредит о перезаписи существующего файла — при необходимости выберите `skip` и обновите значения вручную. После синхронизации проверьте секреты (`JWT_*`, `SESSION_SECRET`) и параметры upstream (`GATEWAY_UPSTREAM_*`, `REDIS_*`, `CONSUL_*`).
- Запустите `pnpm start:dev` и проверьте доступность эндпоинта `GET http://localhost:${GATEWAY_SERVICE_PORT}/api/v1/health`.
- Для быстрой проверки SSE подключитесь к `http://localhost:${GATEWAY_SERVICE_PORT}/api/v1/streams/heartbeat` — поток должен присылать события каждые 15 секунд.【F:backend/gateway/src/sse/sse.controller.ts†L4-L18】

### CRM / Deals: быстрый старт

- Перейдите в `backend/crm` и, если запускаете сервис вручную, установите зависимости `poetry install --sync --no-root`. При запуске через `./scripts/bootstrap-local.sh --with-backend` helper `start-backend.sh` подтянет зависимости автоматически.
- Выполните `../../scripts/sync-env.sh backend/crm` (при необходимости добавьте `--non-interactive`), чтобы скопировать шаблон `.env`. После синхронизации пересмотрите блок переменных `CRM_*` (PostgreSQL, Redis, RabbitMQ, очереди событий) и замените секреты на локальные значения.
  > ℹ️ Сервис CRM больше не считывает административный `DATABASE_URL` автоматически — для подключения приложения используйте только `CRM_DATABASE_URL` (значение без префикса пригодится для ручных миграций и других админских сценариев).
  > 🎯 `CRM_DATABASE_URL` поддерживает параметр `search_path` в query-строке: при старте приложение переносит его в `server_settings` asyncpg, чтобы схема применялась одинаково в API и миграциях. Альтернативно можно передать `options=-csearch_path=...` — будет разобран тот же набор настроек.
- Примените миграции: `poetry run alembic upgrade head`.
- Запустите API: `poetry run crm-api` (или `poetry run uvicorn crm.app.main:app --reload`). Порт и хост берутся из `.env` (`CRM_SERVICE_PORT`, `CRM_SERVICE_HOST`), поэтому их легко переопределить на время отладки.
- Проверьте SSE-upstream CRM: `curl -H "Accept: text/event-stream" http://localhost:${CRM_SERVICE_PORT:-8082}/streams`. В ответе каждые ~30 секунд приходит `event: heartbeat` с пустым payload. При публикации события через `EventsPublisher` (`poetry run crm-api` уже держит подключение к RabbitMQ) появится соответствующий `event`.
  > CRM использует временную очередь, привязанную к exchange `${CRM_EVENTS_EXCHANGE}` (по умолчанию `crm.events`). Exchange должен существовать заранее: его создаёт `infra/rabbitmq/bootstrap.sh` или он объявляется при первой публикации события через `EventsPublisher`/worker.
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

  > ℹ️ Модули задач и уведомлений работают внутри CRM: события публикуются в `CRM_EVENTS_EXCHANGE`, а параметры очередей управляются переменными `CRM_TASKS_*`. SSE-канал `notifications` и Telegram-уведомления используют те же настройки RabbitMQ, поэтому отдельного сервиса Notifications не требуется.

### Reports: быстрый старт

- Перейдите в `backend/reports` и установите зависимости `poetry install`.
- Выполните `../../scripts/sync-env.sh backend/reports` (при необходимости добавьте `--non-interactive`). Проверьте значения `REPORTS_DATABASE_URL`, `REPORTS_SCHEMA`, `REPORTS_CRM_SCHEMA`, `REPORTS_SOURCE_SCHEMAS` и `REPORTS_SERVICE_PORT`.
- Примените миграции: запустите `../../scripts/migrate-local.sh` (bootstrap делает это автоматически) или выполните `psql "$REPORTS_DATABASE_URL" -v reports_schema=${REPORTS_SCHEMA} -v crm_schema=${REPORTS_CRM_SCHEMA} -f migrations/001_create_deal_pipeline_summary.sql`.
- Запустите API: `poetry run reports-api`.
- Для обновления материализованных представлений запустите `poetry run reports-refresh-views`.
- Smoke-проверка: `curl http://localhost:${REPORTS_SERVICE_PORT:-8087}/health`.
## CI/CD: только локальные или внешние проверки

- GitHub Actions удалены из репозитория, поэтому автоматические пайплайны недоступны. Выполняйте проверки локально или подключайте альтернативный CI (self-hosted runners, GitLab CI, Jenkins и т.п.) в собственном форке/окружении.
- Для локальной проверки повторите шаги прежних пайплайнов вручную: выполните линтеры, тесты и сборку контейнеров по инструкциям соответствующих сервисов. Рекомендуемый порядок: `lint` → `unit-tests` → `contract-tests` → `build`.
- Для резервного копирования добавлена smoke-проверка `scripts/check-local-infra.sh`, которая убеждается, что все переменные `BACKUP_*` внутри контейнера заполнены. При необходимости выполните ручную диагностику:
  ```bash
  cd infra/
  docker compose --env-file ../.env exec backup sh -c 'env | grep "^BACKUP_"'
  ```
  Пустые значения сигнализируют о необходимости обновить `.env` по шаблону `env.example` и повторно синхронизировать переменные.
  > ℹ️ В Docker Compose значения по умолчанию используют сервисные имена (`postgres`, `rabbitmq`, `redis`, `consul`). Для всех подключений добавлены переменные с суффиксом `_INTERNAL` (`DATABASE_URL_INTERNAL`, `AUTH_DATABASE_URL_INTERNAL`, `CRM_RABBITMQ_INTERNAL_URL`, `REDIS_URL_INTERNAL`, `CONSUL_HTTP_ADDR_INTERNAL` и др.), которые подставляются в контейнеры. Переменные без суффикса ориентированы на запуск сервисов на хосте (обычно `localhost`). Обновляйте `_INTERNAL` только если переименовываете сервисы в сети Docker или подключаете контейнеры к внешним инстансам.
- При необходимости имитируйте поведение CI с помощью `make`-таргетов или локального runners — добавьте их описание в README выбранного сервиса. Переменные из `env.example` по-прежнему обязательны для сборок и должны быть заполнены в локальном `.env`. При необходимости адаптируйте локальные скрипты самостоятельно, чтобы пропускать шаги, завязанные на внешнем CI.

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
   > ℹ️ Шаблон `env.example` содержит развёрнутые значения (`postgresql://postgres:postgres@localhost:5432/crm`, `amqp://crm:crm@localhost:5672/crm` и т.д.). Docker Compose больше не подставляет их из других переменных, поэтому любые правки (порты, пароли, URL) делайте вручную до запуска инфраструктурных скриптов. Пустые значения оставлены только для секретов, которые нужно заполнить самостоятельно.
2. После синхронизации проверьте секреты и уникальные параметры вручную:
   1. Откройте `.env` в корне и замените заглушки у всех `*_PASSWORD`, `*_SECRET`, `*_TOKEN`, `*_API_KEY` на значения из секретного хранилища.
   2. Сверьте `*_RABBITMQ_URL`, `*_REDIS_URL`, `POSTGRES_*` с локальными инстансами и обновите пароли, если они отличаются от шаблона.
   3. Проверьте блоки `AUTH_JWT_*`, `GATEWAY_UPSTREAM_*`, параметры webhook-ов и OAuth — убедитесь, что они соответствуют вашей среде разработки.
   4. Для модулей задач и уведомлений внутри CRM настройте блок `CRM_TASKS_*` (exchange, routing key, очереди напоминаний) и проверьте параметры `CRM_EVENTS_EXCHANGE`, `CRM_PERMISSIONS_*`, `CRM_CELERY_*`. SSE-канал `notifications` и Telegram-уведомления используют эти же значения, поэтому дополнительные `NOTIFICATIONS_*` переменные не требуются.
      > ⚠️ Значения, содержащие пробелы или плейсхолдеры в фигурных скобках (например, `Client {ownerId}`), заключайте в двойные кавычки: так `.env` можно безопасно импортировать через `set -a && source .env`.
   3. Повторите проверку для `.env` каждого сервиса, который был скопирован или перезаписан, чтобы не оставить дефолтные секреты.
      > ℹ️ Скрипт использует актуальный [`env.example`](../env.example). Запускайте его после любых изменений шаблона (например, обновления `RABBITMQ_URL` или перехода `AUTH_DATABASE_URL` на `r2dbc:`), чтобы подтянуть новые переменные. Локальные секреты обязательно перепроверьте после синхронизации.
      - Каталог `backend/payments` сохранён только как архивная документация: отдельная схема `payments` и переменные `PAYMENTS_DB_*` больше не используются, а `.env` для этого сервиса не синхронизируется автоматически. Docker Compose больше не содержит контейнер `payments`; архивный код можно запускать только вручную при необходимости.
2. Обновите в `.env` чувствительные значения:
   - Пароли PostgreSQL (общий `POSTGRES_PASSWORD` и пароли ролей `*_DB_PASSWORD`).
   - Учётные данные RabbitMQ (`RABBITMQ_DEFAULT_USER`, `RABBITMQ_DEFAULT_PASS`, при необходимости `RABBITMQ_DEFAULT_VHOST`). Docker Compose создаёт пользователя и виртуальный хост `crm`, а переменная `RABBITMQ_URL` сразу указывает на них.
   - Секреты JWT и параметры токенов:
     - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `SESSION_SECRET` (Gateway).
     - `AUTH_JWT_SECRET`, `AUTH_JWT_ISSUER`, `AUTH_JWT_AUDIENCE`, `AUTH_ACCESS_TOKEN_TTL`, `AUTH_REFRESH_TOKEN_TTL` (Auth).
       Убедитесь, что `AUTH_JWT_ISSUER` совпадает с базовым URL сервиса авторизации (`AUTH_BASE_URL`) без дополнительного суффикса.
   - Интеграционные токены (Telegram Bot и т.д.) и параметры файлового хранилища (`DOCUMENTS_STORAGE_*`), если планируете проверки соответствующих сервисов.
   - При выделении отдельных прав для сервисов добавляйте собственные `*_RABBITMQ_URL` (см. примеры в `env.example`).
   - Проверьте, что `AUTH_DATABASE_URL` использует формат `r2dbc:postgresql://.../${POSTGRES_DB}?schema=auth` (или эквивалент с `search_path=auth`); если в локальном `.env` остался старый `postgresql://`, обновите значение по образцу из `env.example`, например `r2dbc:postgresql://auth:auth@localhost:5432/crm?schema=auth`. При запуске Auth внутри Docker замените `localhost` на сетевое имя PostgreSQL (`postgres` по умолчанию) или на `host.docker.internal`, если база остаётся на хосте.
3. Убедитесь, что переменные портов (`POSTGRES_PORT`, `RABBITMQ_PORT`, `REDIS_PORT`, `CONSUL_*`, `PGADMIN_PORT`) не конфликтуют с уже занятыми на вашей машине. Внутренний `POSTGRES_CONTAINER_PORT` оставьте равным 5432 — его меняет только образ PostgreSQL.
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
5. **Инициализация.** После получения токена пропишите его в `CRM_NOTIFICATIONS_TELEGRAM_BOT_TOKEN` (CRM использует его для исходящих уведомлений) и `TELEGRAM_BOT_BOT_TOKEN` (если запускаете сервис [`backend/telegram-bot`](../backend/telegram-bot/README.md)). Webhook защищается значением `TELEGRAM_BOT_WEBHOOK_SECRET`, а публичный URL проксируйте через Gateway/BFF согласно инфраструктурным настройкам.

#### Локальные заглушки и тестовые значения

- **Документы.** Для разработки достаточно локального каталога в репозитории (`./var/documents`). Убедитесь, что он исключён из VCS (`.gitignore`) и доступен процессу `node`. Значения `DOCUMENTS_STORAGE_DRIVER=local` и `DOCUMENTS_STORAGE_ROOT=./var/documents` подходят для одиночного стенда.
- **Telegram.** Для интеграции Telegram используйте встроенный в CRM mock: оставьте `CRM_NOTIFICATIONS_TELEGRAM_ENABLED=false`, включите `CRM_NOTIFICATIONS_TELEGRAM_MOCK=true` и заполните тестовые переменные (`CRM_NOTIFICATIONS_TELEGRAM_BOT_TOKEN=dev-mock-token`, `CRM_NOTIFICATIONS_TELEGRAM_DEFAULT_CHAT_ID=`). Если запускаете сервис бота, продублируйте значения для `TELEGRAM_BOT_BOT_TOKEN` и `TELEGRAM_BOT_WEBHOOK_SECRET`, при необходимости укажите `TELEGRAM_BOT_BOT_API_BASE` для локального mock Bot API.
- **Ротация.** После получения реальных ключей отключите заглушку (`CRM_NOTIFICATIONS_TELEGRAM_MOCK=false`, при необходимости включите `CRM_NOTIFICATIONS_TELEGRAM_ENABLED=true`), перенесите секреты в управляемый Vault и обновите параметры `TELEGRAM_BOT_*`. Для stage/prod использование mock-значений запрещено.

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

   Готово: проверено N комбинаций пользователь/vhost (зависит от списка `*_RABBITMQ_URL` в `.env`).
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

> Скрипт `./scripts/load-seeds.sh` работает только с SQL-файлами `backups/postgres/seeds` и больше не обращается к легаси-сервису Tasks, поэтому дополнительный `pnpm` и переменная `TASKS_DATABASE_URL` не требуются.

## 3. Проверьте создание схем и ролей PostgreSQL

Скрипт `infra/postgres/init.sh` автоматически создаёт схемы и роли, указанные в `.env`. Чтобы убедиться, что всё применилось:

```bash
docker compose exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\dn"
```

В выводе должны присутствовать схемы `auth`, `crm`, `documents`, `tasks`, `notifications`, `backup`.

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
   скрипт печатает таблицу с сервисами и их статусами; любые строки со значением `FAIL` требуют повторного запуска соответствующих
   контейнеров или ручной диагностики.

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
- Веб-приложения и клиенты подключаются к Gateway по переменным `GATEWAY_HTTP_ADDR` и SSE-маршрутам `GATEWAY_UPSTREAM_*_SSE_URL`.
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
