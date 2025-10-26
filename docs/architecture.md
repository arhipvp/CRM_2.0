# Архитектурный обзор

## 1. Общая структура сервисов

CRM состоит из набора специализированных сервисов, сгруппированных по доменам. Таблица ниже показывает основные функции и ключевые зависимости.

| Сервис | Основная ответственность | Ключевые зависимости |
| --- | --- | --- |
| Gateway / BFF | Единая точка входа для веб-клиента и Telegram-бота, прозрачное проксирование REST и ретрансляция SSE-потоков | Redis (heartbeats SSE), внутренние REST API сервисов, Consul |
| Auth | Управление пользователями, ролями, регистрацией и выдачей JWT-токенов | PostgreSQL (схема `auth`), Redis (refresh-токены), Gateway |
| CRM / Deals | Клиенты, сделки, расчёты, полисы, журналы, платежи и структура доходов/расходов; встроенные модули задач и уведомлений (SSE-канал `notifications`) | PostgreSQL (схема `crm`), RabbitMQ (доменные события), Documents API |
| Documents | Управление метаданными файлов и связью с серверным хранилищем документов | PostgreSQL (схема `documents`), файловая система или self-hosted S3, Auth |
| Telegram Bot | Канал обратной связи с пользователями, поддержка быстрых сценариев | Gateway (webhook), Auth (валидация пользователей), RabbitMQ |
| Backup | Резервное копирование баз, политик и конфигураций | PostgreSQL (репликации и дампы), объектное хранилище |

> **Важно.** Сервис CRM/Deals жёстко зависит от Documents: REST-маршруты `/policies/{policy_id}/documents` используют `PolicyService` и `PolicyDocumentRepository`, которые опираются на внешний ключ `fk_policy_documents_document_id` к таблице `documents.documents`. Удаление или отключение Documents без замены приведёт к сбою API, провалу миграций Alembic и интеграционных тестов, а также нарушит согласованность Docker Compose и конфигурации переменных окружения (`CRM_DOCUMENTS_BASE_URL`, `DOCUMENTS_*`).

Отдельного сервиса Payments больше нет: модуль платежей CRM работает внутри CRM/Deals, использует ту же схему `crm`, предоставляет REST API и публикует доменные события `deal.payment.*`. Базовые реквизиты операций лежат в `crm.payments`, детализация доходов и расходов — в таблицах `crm.payment_incomes` и `crm.payment_expenses`; события `deal.payment.updated`, `deal.payment.income.*` и `deal.payment.expense.*` обеспечивают синхронизацию данных для встроенных уведомлений и Reports. Каталог [`backend/payments`](../backend/payments/README.md) хранит только архивный код standalone-сервиса для анализа миграций.

## 2. Взаимодействия и потоки данных

### 2.1 Синхронные вызовы

1. Веб-клиент обращается к Gateway/BFF, который проксирует REST-запросы в сервисы Auth и CRM/Deals без дополнительной агрегации данных.
2. Telegram-бот получает обновления через webhook, который завершается в Gateway; шлюз нормализует payload и проксирует его в сервис `backend/telegram-bot` (FastAPI + aiogram 3). Сервис проверяет HMAC-подпись заголовка `X-Telegram-Signature`, хранит состояние FSM в Redis и уже внутри диспетчера вызывает сценарии создания сделок, подтверждения задач и платежей.
3. Gateway проксирует обращения к внутренним REST API (Auth для авторизации, CRM/Deals для операций с клиентами, сделками, задачами и платежами) и поддерживает SSE-потоки CRM: `deals` и `notifications` (детали см. [`docs/api/streams.md`](api/streams.md)). Для восстановления соединений шлюз хранит `Last-Event-ID` и heartbeat-метки в Redis по шаблону `${REDIS_HEARTBEAT_PREFIX}:{channel}`. Платёжные обновления (включая изменения структуры доходов/расходов) входят в поток `deals` и не требуют отдельного канала.【F:backend/gateway/src/sse/upstream-sse.service.ts†L31-L68】

### 2.2 Асинхронная шина RabbitMQ

RabbitMQ используется как единая шина событий и фоновых задач (форматы сообщений описаны в [`docs/integration-events.md`](integration-events.md)).

* **Доменные события CRM.** Модуль сделок публикует изменения в exchange `crm.events`, используя ключи `deal.journal.appended`, `deal.calculation.*` и `deal.payment.*`. Notifications при маршрутизации в SSE и Telegram пересылает исходный `event_key` (например, `deal.payment.updated`) без переименования пространств.
* **Задачи.** `TaskEventsPublisher` отправляет сообщения о задачах в отдельный exchange `tasks.events` с типами `tasks.task.*`, что позволяет изолировать подписчиков фоновых обработчиков.
* **Telegram Bot.** Бот получает команды из очереди `telegram.bot.notifications`, подписанной на `crm.events`, и публикует ответы (например, `deal.created`, `task.status.changed`) в exchange `crm.events` (переменная `CRM_EVENTS_EXCHANGE`). Routing key используется без префикса `crm.`, но CloudEvent type при этом остаётся `crm.deal.created` для сохранения совместимости с подписчиками.
* **Фоновые задачи.** CRM использует Celery и собственный планировщик задач для отложенных операций (пересчёт состояний полисов, напоминания по задачам). Очереди delays/reminders хранятся в Redis, а публикация итоговых событий выполняется через RabbitMQ.

Асинхронное взаимодействие разгружает Gateway и позволяет временно деградировать сервисам без потери данных — сообщения сохраняются до восстановления потребителей.

### 2.3 Единый PostgreSQL-кластер

Все прикладные сервисы используют общий PostgreSQL-кластер, развёрнутый в конфигурации primary–standby с репликацией и бэкапами.

* Активные схемы: `auth`, `crm`, `documents`.
* Изоляция достигается за счёт ролей с ограниченными правами и политик row-level security, а общие справочники публикуются через представления только для чтения.

### 2.4 Роль Gateway/BFF

Gateway — единственная точка входа для внешних клиентов (веб-клиент, Telegram-бот, интеграции).

* Проксирует REST-запросы `v1/auth/*` и `v1/crm/*` во внутренние сервисы, сохраняя исходные методы, заголовки и параметры.
* Ретранслирует SSE-потоки CRM и Notifications, поддерживая heartbeat и восстановление подключений через Redis.
* Маршрутизирует webhook-и (например, из Telegram) к соответствующим внутренним сервисам, обрабатывая подтверждения и обратные вызовы.

### 2.5 Сквозной поток данных (пример создания сделки)

1. Клиент инициирует создание сделки; запрос поступает в Gateway.
2. Gateway проксирует запрос, Auth проверяет токен и CRM/Deals принимает команду.
3. CRM/Deals создаёт записи в своей схеме PostgreSQL и при последующих действиях публикует доменные события (`deal.journal.appended`, `deal.calculation.*`, `deal.payment.*`) в RabbitMQ; задачи (если требуются) планируются во встроенном модуле. Отдельное событие для самого факта создания сделки пока не публикуется.
4. Модуль уведомлений CRM принимает доменное событие, пересылает его с тем же `event_key` в `crm.events` и ретранслирует через SSE-канал `notifications` и очереди Telegram-бота.
5. Telegram-бот и внутренняя CRM доставляют сообщения пользователю; подтверждения через Gateway возвращаются в CRM/Deals, обновляя статус задачи.
6. При подтверждении оплаты продавец вызывает CRM API, который создаёт или обновляет запись `crm.payments`, пересчитывает связанные позиции доходов/расходов и публикует события `deal.payment.updated`, `deal.payment.income.*` и `deal.payment.expense.*`.

### 2.6 Выдача прав к локальному файловому хранилищу

1. CRM/Deals вызывает в Documents API маршрут `POST /api/v1/permissions/sync`, используя `PermissionSyncService`, когда нужно актуализировать доступы к каталогу сущности (клиент, сделка, полис). См. подробности в разделе [`docs/api/documents.md`](api/documents.md#post-apiv1permissionssync).
2. Documents сохраняет параметры запроса, ставит задание в очередь BullMQ `documents.permissions.sync` и возвращает идентификаторы задачи и записи синхронизации.
3. Воркер Documents обрабатывает задание: создаёт или обновляет системные группы/ACL и применяет права в файловой системе или self-hosted S3.
4. После выполнения задания статус фиксируется в репозитории задач Documents; CRM/Deals запрашивает результат через очередь или REST и обновляет аудит доступа.
5. Gateway при загрузке/скачивании файлов по-прежнему проверяет авторизацию пользователя через Auth и использует временные ссылки (pre-signed URL или одноразовые токены), но выдача файлов опирается на актуализированные Documents права.

## 3. Диаграмма взаимодействий

```mermaid
flowchart LR
    subgraph Client Channels
        FE[Web Client]
        TG[Telegram Bot]
    end

    FE -->|REST + SSE| GW[Gateway / BFF]
    TG -->|Webhook| GW

    GW -->|AuthN/AuthZ| AUTH[Auth]
    GW -->|Domain APIs| CRM[CRM / Deals]
    GW --> DOCS[Documents]

    subgraph RabbitMQ Bus
        CRM -->|domain events| EX
        EX --> CRM
        EX --> TG
    end

    subgraph PostgreSQL Cluster
        AUTH
        CRM
        DOCS
    end

    GW -->|Heartbeat Store| REDIS[(Redis)]
    DOCS -->|Metadata| CRM
    BACKUP[(Backup Service)] -->|Snapshots| PostgreSQL Cluster
```

Диаграмма подчёркивает, что все прикладные сервисы работают с единой базой данных (с изолированными схемами) и общаются через асинхронную шину RabbitMQ, а Gateway выступает координатором внешних и внутренних взаимодействий для пользовательских каналов (веб-клиента и Telegram-бота).

## 4. Связанные документы

* [README.md](../README.md) — бизнес-контекст и пользовательские сценарии.
* [docs/api/README.md](api/README.md) — спецификации REST API и SSE каналов.
* [docs/integration-events.md](integration-events.md) — форматы сообщений RabbitMQ.
* [docs/data-model.md](data-model.md) — физическая модель данных (ER-диаграммы, таблицы и ограничения).
* [docs/tech-stack.md](tech-stack.md) — технологический стек и инфраструктурные решения (дополняет разделы 2.2–2.4).
* [docs/security-and-access.md](security-and-access.md) — политика доступа, соответствующая ролям и границам сервисов, включая локальное хранение документов.
* [docs/processes.md](processes.md) — операционные процессы CRM и базовый сценарий работы со сделкой.
