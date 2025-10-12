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
2. Проверьте переменные окружения в [`env.example`](../env.example) — для каждого сервиса указан порт и URL запуска.
3. Настройте базы данных и очереди (см. [«Инфраструктура» в tech-stack](tech-stack.md#инфраструктура)) и запускайте сервис локально или в Docker согласно инструкции.
# Локальная инфраструктура: пошаговая инструкция

Эта инструкция покрывает подготовку переменных окружения, запуск Docker Compose и базовую проверку вспомогательных сервисов, необходимых для разработки CRM.

## 1. Подготовьте `.env`

1. Скопируйте шаблон: `cp env.example .env`.
2. Обновите в `.env` чувствительные значения:
   - Пароли PostgreSQL (общий `POSTGRES_PASSWORD` и пароли ролей `*_DB_PASSWORD`).
   - Учётные данные RabbitMQ (`RABBITMQ_DEFAULT_USER`, `RABBITMQ_DEFAULT_PASS`, при необходимости `RABBITMQ_DEFAULT_VHOST`). Docker Compose создаёт пользователя и виртуальный хост `crm`, а переменная `RABBITMQ_URL` сразу указывает на них.
   - Секреты JWT (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`).
   - Интеграционные токены (Google Drive, Telegram Bot и т.д.), если планируете проверки соответствующих сервисов.
   - При выделении отдельных прав для сервисов добавляйте собственные `*_RABBITMQ_URL` (см. примеры в `env.example`).
3. Убедитесь, что переменные портов (`POSTGRES_PORT`, `RABBITMQ_PORT`, `REDIS_PORT`, `CONSUL_*`, `PGADMIN_PORT`) не конфликтуют с уже занятыми на вашей машине.

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

По умолчанию Docker Compose создаёт пользователя и виртуальный хост `crm`, которых достаточно для базового запуска. Сервисы
`payments`, `notifications`, `tasks` и `audit` используют собственные учётные записи и vhost-ы — их нужно создать вручную до
первого запуска приложений. Имена и пароли совпадают с шаблоном в [`env.example`](../env.example), например `PAYMENTS_RABBITMQ_URL`.

Пример последовательности команд через `rabbitmqctl` (выполняйте внутри контейнера RabbitMQ):

```bash
docker compose exec rabbitmq bash -c '
  rabbitmqctl add_vhost payments &&
  rabbitmqctl add_user payments payments &&
  rabbitmqctl set_permissions -p payments payments ".*" ".*" ".*" &&
  rabbitmqctl add_vhost notifications &&
  rabbitmqctl add_user notifications notifications &&
  rabbitmqctl set_permissions -p notifications notifications ".*" ".*" ".*" &&
  rabbitmqctl add_vhost tasks &&
  rabbitmqctl add_user tasks tasks &&
  rabbitmqctl set_permissions -p tasks tasks ".*" ".*" ".*" &&
  rabbitmqctl add_vhost audit &&
  rabbitmqctl add_user audit audit &&
  rabbitmqctl set_permissions -p audit audit ".*" ".*" ".*"
'
```

> ℹ️ При желании можно использовать [`rabbitmqadmin`](https://www.rabbitmq.com/docs/rabbitmqadmin) и оформить команды в отдельный скрипт — положите его в `infra/` рядом с `docker-compose.yml` и привяжите к своим процессам автоматизации.

После выполнения команд убедитесь, что пользователи и vhost-ы появились: `docker compose exec rabbitmq rabbitmqctl list_users` и `docker compose exec rabbitmq rabbitmqctl list_vhosts`.

## 3. Проверьте создание схем и ролей PostgreSQL

Скрипт `infra/postgres/init.sh` автоматически создаёт схемы и роли, указанные в `.env`. Чтобы убедиться, что всё применилось:

```bash
docker compose exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\dn"
```

В выводе должны присутствовать схемы `auth`, `crm`, `payments`, `documents`, `tasks`, `notifications`, `audit`, `backup`.

## 4. Запуск миграций

После подготовки инфраструктуры примените миграции сервисов согласно их README. ⚠️ До публикации первых ревизий (schema baseline) этот шаг пропускается.

## 5. Проверка доступности сервисов

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
- Для фоновых заданий и уведомлений доступны очереди RabbitMQ и Redis.
- Для фоновых заданий и уведомлений используются очереди RabbitMQ и Redis.

## 7. Очистка состояния

Если нужно полностью пересоздать окружение (например, после изменений схем):

```bash
cd infra
docker compose down -v
rm -rf ../backups/postgres
```

После этого повторите шаги с запуска инфраструктуры.

> ⚠️ **Важно.** Локальные пароли и секреты в `.env` предназначены только для разработки. Никогда не коммитьте файл `.env` в репозиторий и не переиспользуйте эти значения в боевых средах.
