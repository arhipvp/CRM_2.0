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
| Tasks | Планирование задач и напоминаний; SLA будут добавлены в следующих релизах.【F:docs/architecture.md†L13-L66】 | `8086` | [`backend/tasks/README.md`](../backend/tasks/README.md) |
| Reports | Аналитика и отчёты (заглушка на текущем этапе).【F:README.md†L53-L74】 | `8087` | [`backend/reports/README.md`](../backend/reports/README.md) |
| Audit | Централизованный журнал действий и метрик.【F:docs/architecture.md†L17-L66】 | `8088` | [`backend/audit/README.md`](../backend/audit/README.md) |
| Frontend | Веб-интерфейс CRM на Next.js 14.【F:docs/tech-stack.md†L99-L118】 | `3000` | [`frontend/README.md`](../frontend/README.md) |

## Как использовать таблицу
1. Выберите сервис и перейдите по ссылке README.
2. Синхронизируйте переменные окружения через [`scripts/sync-env.sh`](../scripts/sync-env.sh), чтобы в каждом сервисе появился свежий `.env` из корневого [`env.example`](../env.example). Скрипт предупреждает о перезаписи и позволяет пропустить каталог — после копирования обязательно обновите секреты и уникальные значения вручную.
3. Настройте базы данных и очереди (см. [«Инфраструктура» в tech-stack](tech-stack.md#инфраструктура)) и запускайте сервис локально или в Docker согласно инструкции.

### Gateway / BFF: быстрый старт

- Перейдите в `backend/gateway` и установите зависимости (`pnpm install`).
- Выполните `../../scripts/sync-env.sh backend/gateway`, чтобы получить свежий `.env` из шаблона. Скрипт предупредит о перезаписи существующего файла — при необходимости выберите `skip` и обновите значения вручную. После синхронизации проверьте секреты (`JWT_*`, `SESSION_SECRET`) и параметры upstream (`GATEWAY_UPSTREAM_*`, `REDIS_*`, `CONSUL_*`).
- Запустите `pnpm start:dev` и проверьте доступность эндпоинта `GET http://localhost:${GATEWAY_SERVICE_PORT}/api/v1/health`.
- Для быстрой проверки SSE подключитесь к `http://localhost:${GATEWAY_SERVICE_PORT}/api/v1/streams/heartbeat` — поток должен присылать события каждые 15 секунд.【F:backend/gateway/src/sse/sse.controller.ts†L4-L18】

### CRM / Deals: быстрый старт

- Перейдите в `backend/crm` и установите зависимости `poetry install`.
- Выполните `../../scripts/sync-env.sh backend/crm`, чтобы скопировать шаблон `.env`. После синхронизации пересмотрите блок переменных `CRM_*` (PostgreSQL, Redis, RabbitMQ, очереди событий) и замените секреты на локальные значения.
- Примените миграции: `poetry run alembic upgrade head`.
- Запустите API: `poetry run crm-api` (или `poetry run uvicorn crm.app.main:app --reload`). Порт и хост берутся из `.env` (`CRM_SERVICE_PORT`, `CRM_SERVICE_HOST`), поэтому их легко переопределить на время отладки.
- Поднимите Celery-воркер: `poetry run crm-worker worker -l info`.
- Для локальной обработки платежных событий убедитесь, что RabbitMQ запущен и в `.env` включено `CRM_ENABLE_PAYMENTS_CONSUMER=true`; тестовую публикацию можно выполнить через `backend/crm/tests/test_payments_events.py`.
## CI/CD: временно только локальные проверки

- GitHub Actions приостановлены: пайплайны сохранены как `.github/workflows/ci.yml.disabled` и `.github/workflows/frontend.yml.disabled`, поэтому при пуше и открытии PR задачи не запускаются. Чтобы восстановить автоматический пайплайн, верните расширение `.yml` у нужного файла и запушьте изменение в `main`.
- Для локальной проверки повторите шаги пайплайнов вручную: выполните линтеры, тесты и сборку контейнеров по инструкциям соответствующих сервисов. Рекомендуемый порядок: `lint` → `unit-tests` → `contract-tests` → `build`.
- При необходимости имитируйте поведение CI с помощью `make`-таргетов или локального runners — добавьте их описание в README выбранного сервиса. Переменные из `env.example` по-прежнему обязательны для сборок и должны быть заполнены в локальном `.env`. Флаг `CI_CD_DISABLED=true` (см. шаблон `env.example`) можно использовать в локальных скриптах, чтобы пропускать этапы, завязанные на GitHub Actions.

## Kubernetes-манифесты и Argo CD

- Базовый слой (`infra/k8s/base`) содержит Namespace, Deployment/Service/ConfigMap/Secret для Gateway и развёртывание Redis как минимальной зависимости.
- Оверлеи `infra/k8s/overlays/{dev,stage,prod}` задают namespace/prefix, image-tag, параметры ConfigMap и реплики для Gateway; патчи расширяются по мере добавления сервисов.
- Файл `infra/k8s/argocd/gateway-apps.yaml` описывает три Argo CD Application-ресурса, которые синхронизируют соответствующие оверлеи и автоматически создают namespace (`syncOptions: CreateNamespace=true`).

# Быстрый bootstrap окружения (рекомендуемый)

Автоматизируйте подготовку инфраструктуры и миграций через скрипт `./scripts/bootstrap-local.sh`. Он закрывает ключевые шаги из инструкции ниже и подходит для повторяемого запуска окружения.

### Требования

- Docker Desktop/Engine с поддержкой `docker compose` (Compose V2).
- Python 3 (для вспомогательного скрипта `infra/rabbitmq/bootstrap.sh`).
- Poetry (CRM/Deals) и JDK 17 + Gradle Wrapper (Auth). При отсутствии зависимостей скрипт завершится с подсказкой.
- Актуальный `.env` в корне репозитория (`cp env.example .env` или `./scripts/sync-env.sh`).

### Сценарий запуска

1. Убедитесь, что `.env` создан и заполнен локальными паролями/секретами.
2. Выполните из корня репозитория:

   ```bash
   ./scripts/bootstrap-local.sh
   ```

3. Скрипт:
   - проверяет наличие `.env` и необходимых CLI-инструментов;
   - запускает `docker compose up -d` в `infra/` и ждёт статуса `healthy` у PostgreSQL, RabbitMQ и Redis;
   - вызывает `infra/rabbitmq/bootstrap.sh` для создания пользователей/vhost-ов по `*_RABBITMQ_URL` из `.env`;
   - применяет миграции CRM (`poetry run alembic upgrade head`) и Auth (`./gradlew update`).

Все сообщения выводятся с префиксом `[bootstrap-local]` и содержат текущий шаг. Скрипт идемпотентен: повторный запуск обновит пароли RabbitMQ и подтвердит права, а миграции пропустят уже применённые ревизии. При ошибке сообщение укажет, на каком этапе она произошла — устраните причину и перезапустите сценарий.

➡️ Подробные ручные шаги остаются доступны ниже в качестве fallback-инструкции.

# Локальная инфраструктура: пошаговая инструкция (fallback)

Эта инструкция покрывает подготовку переменных окружения, запуск Docker Compose и базовую проверку вспомогательных сервисов, необходимых для разработки CRM.

## 1. Подготовьте `.env`

1. Синхронизируйте переменные: `./scripts/sync-env.sh` создаст или обновит `.env` в корне и основных сервисах. Если для какого-то каталога уже есть файл, скрипт спросит о перезаписи — при необходимости выберите `skip`. После выполнения обновите секреты и уникальные значения (пароли, токены, ключи) во всех скопированных файлах.
   > ℹ️ Скрипт использует актуальный [`env.example`](../env.example). Запускайте его после любых изменений шаблона (например, обновления `RABBITMQ_URL` или перехода `AUTH_DATABASE_URL` на `r2dbc:`), чтобы подтянуть новые переменные. Локальные секреты обязательно перепроверьте после синхронизации.
2. Обновите в `.env` чувствительные значения:
   - Пароли PostgreSQL (общий `POSTGRES_PASSWORD` и пароли ролей `*_DB_PASSWORD`).
   - Учётные данные RabbitMQ (`RABBITMQ_DEFAULT_USER`, `RABBITMQ_DEFAULT_PASS`, при необходимости `RABBITMQ_DEFAULT_VHOST`). Docker Compose создаёт пользователя и виртуальный хост `crm`, а переменная `RABBITMQ_URL` сразу указывает на них.
   - Секреты JWT и параметры токенов:
     - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `SESSION_SECRET` (Gateway).
     - `AUTH_JWT_SECRET`, `AUTH_JWT_ISSUER`, `AUTH_JWT_AUDIENCE`, `AUTH_ACCESS_TOKEN_TTL`, `AUTH_REFRESH_TOKEN_TTL` (Auth).
       Убедитесь, что `AUTH_JWT_ISSUER` совпадает с базовым URL сервиса авторизации (`AUTH_BASE_URL`) без дополнительного суффикса.
   - Интеграционные токены (Google Drive, Telegram Bot и т.д.), если планируете проверки соответствующих сервисов.
   - При выделении отдельных прав для сервисов добавляйте собственные `*_RABBITMQ_URL` (см. примеры в `env.example`).
   - Проверьте, что `AUTH_DATABASE_URL` использует формат `r2dbc:postgresql://.../${POSTGRES_DB}?schema=auth` (или эквивалент с `search_path=auth`); если в локальном `.env` остался старый `postgresql://`, обновите значение по образцу из `env.example`, например `r2dbc:postgresql://auth:auth@localhost:5432/crm?schema=auth`.
3. Убедитесь, что переменные портов (`POSTGRES_PORT`, `RABBITMQ_PORT`, `REDIS_PORT`, `CONSUL_*`, `PGADMIN_PORT`) не конфликтуют с уже занятыми на вашей машине.
4. Перезапустите Auth после обновления `.env`, чтобы подтянуть новые значения: `set -a && source .env && set +a && cd backend/auth && ./gradlew bootRun`. Spring Boot читает `AUTH_JWT_SECRET`, `AUTH_JWT_AUDIENCE`, `AUTH_ACCESS_TOKEN_TTL` и `AUTH_REFRESH_TOKEN_TTL` из окружения при старте.

> 📢 После обновления шаблона напомните команде пересобрать собственные `.env` и обновить секреты в корпоративном секретном менеджере до выкладки. Последнее изменение `AUTH_JWT_ISSUER` означает, что старые локальные файлы `.env` могут ссылаться на некорректный URL авторизации.

### Интеграции

#### Google Drive (сервисный аккаунт)

1. **Кто создаёт.** Обратитесь в команду инфраструктуры (`infra@company.local`) — они владеют Google Workspace и создают сервисные аккаунты.
2. **Запрос доступа.** Заполните заявку в Jira по шаблону «Google Drive Service Account» и укажите перечень необходимых папок/Shared Drive. К заявке приложите согласование от тимлида продукта.
3. **Создание ключа.** Инфраструктура генерирует JSON-ключ согласно официальной [инструкции Google](https://developers.google.com/drive/api/guides/service-accounts) и публикует его в секретном хранилище (1Password/HashiCorp Vault).
4. **Требуемые права.** У сервисного аккаунта должен быть доступ `Content manager` к Shared Drive с документами клиентов. Права на уровне Workspace выдаёт администратор Google (группа `workspace-admins`).
5. **Получение ключа.** Заберите JSON через выделенный секретный канал и поместите его содержимое в переменную `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON`. ID общего диска добавьте в `GOOGLE_DRIVE_SHARED_DRIVE_ID`.

#### Telegram Bot (токен Bot API)

1. **Кто отвечает.** Владельцем боевого бота является продукт-менеджер CRM (`pm-crm@company.local`). Он запрашивает выпуск токена у BotFather и следит за ротацией.
2. **Запрос токена.** Создайте задачу «Telegram Bot token» в Jira и согласуйте с безопасностью. После одобрения продукт-менеджер создаст или обновит бота через [BotFather](https://core.telegram.org/bots#botfather).
3. **Хранение.** Токен передаётся через секретное хранилище (1Password/HashiCorp Vault). Доступ к нему имеют DevOps и ответственные разработчики.
4. **Требуемые права.** На проде бот подключён к корпоративному аккаунту; включите двухфакторную аутентификацию Telegram и назначьте доверенных администраторов. Webhook URL должен быть доступен из интернета.
5. **Инициализация.** После получения токена пропишите его в `TELEGRAM_BOT_TOKEN`, публичный URL — в `TELEGRAM_WEBHOOK_URL`, при необходимости добавьте `TELEGRAM_WEBHOOK_SECRET`.

#### Локальные заглушки и тестовые значения

- **Документы.** Вместо реального Google Drive в разработке используйте MinIO или LocalStack. Укажите `GOOGLE_DRIVE_EMULATOR_URL=http://localhost:9000` и путь к локальному каталогу в `GOOGLE_DRIVE_EMULATOR_ROOT`. Поля `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON` и `GOOGLE_DRIVE_SHARED_DRIVE_ID` можно оставить пустыми до получения боевых ключей.
- **Telegram.** Для интеграции Telegram включите mock, который идёт вместе с сервисом уведомлений: `TELEGRAM_MOCK_ENABLED=true`, `TELEGRAM_MOCK_SERVER_URL=http://localhost:8085/telegram`. Токен `TELEGRAM_BOT_TOKEN` допустимо временно заполнить значением `dev-mock-token`, пока нет боевого доступа. Webhook URL можно оставить пустым — mock читает локальные запросы напрямую.
- **Ротация.** После получения реальных ключей отключите заглушки (`TELEGRAM_MOCK_ENABLED=false`, очистите переменные эмулятора) и перенесите секреты в управляемый Vault. Для stage/prod использование mock-значений запрещено.

## 2. Запустите инфраструктурные контейнеры

1. Перейдите в директорию `infra`: `cd infra`.
2. Поднимите сервисы: `docker compose up -d`.
3. Проверьте статус: `docker compose ps` — все контейнеры должны находиться в состоянии `Up` или `healthy`.
4. Для завершения работы выполните `docker compose down` (с флагом `-v`, если нужно очистить данные).

### Создайте пользователей и vhost-ы RabbitMQ для сервисов

Автоматизация оформлена в скрипте [`infra/rabbitmq/bootstrap.sh`](../infra/rabbitmq/bootstrap.sh). Он читает указанный `.env`, находит все переменные `*_RABBITMQ_URL` (единый источник правды прописан в [`env.example`](../env.example)) и через `rabbitmqctl` создаёт отсутствующие vhost-ы и пользователей, обновляя права при повторном запуске.

1. Убедитесь, что локальный `.env` соответствует актуальному шаблону (см. шаг 1 выше).
2. Выполните скрипт из корня репозитория:

   ```bash
   bash infra/rabbitmq/bootstrap.sh .env
   ```

3. Ожидаемый вывод (первый запуск создаёт объекты, последующие просто подтверждают их наличие):

   ```text
   ==> Обработка пользователя 'crm' и vhost 'crm'
     • vhost 'crm' уже существует
     • обновлён пароль пользователя 'crm'
     • подтверждены права 'crm' на vhost 'crm'
   ==> Обработка пользователя 'payments' и vhost 'payments'
     • создан vhost 'payments'
     • создан пользователь 'payments'
     • подтверждены права 'payments' на vhost 'payments'
   ...
   ==> Обработка пользователя 'audit' и vhost 'audit'
     • vhost 'audit' уже существует
     • обновлён пароль пользователя 'audit'
     • подтверждены права 'audit' на vhost 'audit'

   Готово: проверено 5 комбинаций пользователь/vhost.
   ```

Скрипт можно выполнять сколько угодно раз — он идемпотентен. Для ручной проверки воспользуйтесь `docker compose exec rabbitmq rabbitmqctl list_users` и `docker compose exec rabbitmq rabbitmqctl list_vhosts`.

## 3. Проверьте создание схем и ролей PostgreSQL

Скрипт `infra/postgres/init.sh` автоматически создаёт схемы и роли, указанные в `.env`. Чтобы убедиться, что всё применилось:

```bash
docker compose exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\dn"
```

В выводе должны присутствовать схемы `auth`, `crm`, `payments`, `documents`, `tasks`, `notifications`, `audit`, `backup`.

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

### Автоматизированный smoke-check

1. Убедитесь, что в корне репозитория лежит актуальный `.env` (обновлён через `./scripts/sync-env.sh`).
2. Проверьте установку утилит, которые использует скрипт:
   - `psql` (PostgreSQL client);
   - `redis-cli`;
   - `curl`.
3. Выполните из корня репозитория:

   ```bash
   ./scripts/check-local-infra.sh
   ```

4. Ожидаемый вывод при успешном запуске (значения в колонке «Комментарий» могут отличаться, но статус должен быть `OK`):

   ```text
   Проверка           | Статус | Комментарий
   ------------------+--------+--------------------------------
   PostgreSQL        | OK     | SELECT 1 выполнен
   Redis             | OK     | PING → PONG
   Consul            | OK     | Лидер: "127.0.0.1:8300"
   RabbitMQ UI       | OK     | UI доступен
   ```

Скрипт читает параметры подключения из `.env` (`DATABASE_URL`, `REDIS_URL`, `CONSUL_HTTP_ADDR`, `RABBITMQ_MANAGEMENT_URL`, `RABBITMQ_DEFAULT_USER`, `RABBITMQ_DEFAULT_PASS`) и завершается с ненулевым кодом, если какой-либо сервис недоступен. Используйте это поведение в автоматизированных сценариях или CI на будущее.

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
  - Для локального запуска все `NEXT_PUBLIC_*_SSE_URL` и `NEXT_PUBLIC_API_BASE_URL` уже указывают на `http://localhost:${GATEWAY_SERVICE_PORT}`;
    дополнительных DNS-записей или кастомных доменов не требуется.
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

    Приложение будет доступно на `http://localhost:${FRONTEND_SERVICE_PORT:-3000}`.

## 7. Очистка состояния

Если нужно полностью пересоздать окружение (например, после изменений схем):

```bash
cd infra
docker compose down -v
rm -rf ../backups/postgres
```

После этого повторите шаги с запуска инфраструктуры.

> ⚠️ **Важно.** Локальные пароли и секреты в `.env` предназначены только для разработки. Никогда не коммитьте файл `.env` в репозиторий и не переиспользуйте эти значения в боевых средах.
