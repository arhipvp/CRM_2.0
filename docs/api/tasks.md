# CRM Tasks API

## Общая информация
- **Базовый URL:** `https://crm.internal/api/v1`
- **Аутентификация:** JWT CRM (тот же, что используется для остальных модулей).
- **Назначение:** управление задачами и напоминаниями; SLA появятся на Этапе 1.1.
- **Ограничение первой поставки:** экспорт данных и WebCal-подписки не поддерживаются.

## Задачи

> ⚠️ Во всех эндпоинтах с параметром `task_id` ожидается UUID v4. При обращении, например, по пути `GET /api/tasks/invalid` API
> возвращает ошибку `400 validation_error` с описанием проблемы в идентификаторе.

> При обращении к несуществующей задаче модуль CRM возвращает `404 task_not_found` и тело ответа
> `{ "statusCode": 404, "code": "task_not_found", "message": "Task {task_id} not found" }`.

### GET `/tasks`
Список задач с фильтрами по исполнителю, статусу, дедлайнам и приоритету. Эндпоинт используется как источник для таблицы, канбана и календаря внутри приложения.

Фильтры `status` и `priority` поддерживают как одиночное значение (`?status=pending`), так и несколько повторяющихся параметров (`?status=pending&status=completed`). Аналогично можно передавать `priority=high` или перечислять несколько приоритетов.

**Параметры запроса**
| Имя | Тип | Описание |
| --- | --- | --- |
| assigneeId | UUID | Фильтр по исполнителю (используется колонка `assignee_id`; значение дополнительно дублируется в `payload.assigneeId`). |
| status | string \| array[string] | Коды статусов: `pending`, `scheduled`, `in_progress`, `completed`, `cancelled`. Одиночный параметр воспринимается как массив. |
| dueBefore | date | Задачи со сроком до указанной даты (не включительно). |
| dueAfter | date | Задачи со сроком после указанной даты (не включительно). |
| priority | string \| array[string] | Приоритет `low`, `normal`, `high`. Допускается одно или несколько значений. |
| limit | integer | Количество элементов на странице, по умолчанию `50`. |
| offset | integer | Смещение для пагинации. |

**Ответ 200** — список `TaskResponseDto`, отсортированный по `dueAt`, затем по `createdAt`.

**Схема `TaskResponseDto`**
| Поле | Тип | Описание |
| --- | --- | --- |
| id | UUID | Идентификатор задачи. |
| title | string | Название. |
| description | string \| null | Полное описание. |
| statusCode | string | Текущий статус: `pending`, `scheduled`, `in_progress`, `completed`, `cancelled`. |
| statusName | string \| null | Человекочитаемое название статуса. |
| dueAt | datetime \| null | Плановый дедлайн. |
| scheduledFor | datetime \| null | Время активации отложенной задачи. |
| completedAt | datetime \| null | Фактическое завершение. |
| cancelledReason | string \| null | Причина отмены. |
| createdAt | datetime | Время создания. |
| updatedAt | datetime | Время последнего обновления. |
| payload | object \| null | Исходный `payload`, сохранённый при создании задачи. Содержит зеркальные идентификаторы (`assigneeId`, `authorId`, `dealId` и т.д.) и произвольные поля. Для мигрированных записей из `crm.tasks` дополнительно присутствуют `legacyStatus`, `source = crm.tasks`, а также `tenantId`, если столбец был доступен в исходной таблице. |
| assigneeId | UUID \| null | Исполнитель из колонки `assignee_id`; для обратной совместимости также читается из `payload.assigneeId`/`payload.assignee_id`. |
| authorId | UUID \| null | Постановщик из колонки `author_id`; при отсутствии данных используется `payload.authorId`/`payload.author_id`. |
| priority | string \| null | Приоритет `low`/`normal`/`high` из `payload.priority`. |
| dealId | UUID \| null | Колонка `deal_id`; при отсутствии значения берётся из `payload.dealId`/`payload.deal_id`. |
| policyId | UUID \| null | Колонка `policy_id`; при отсутствии значения берётся из `payload.policyId`/`payload.policy_id`. |
| paymentId | UUID \| null | Колонка `payment_id`; при отсутствии значения берётся из `payload.paymentId`/`payload.payment_id`. |
| clientId | UUID \| null | Идентификатор клиента из `payload.clientId`/`payload.client_id`. |
| context | object \| null | Контекст задачи. Если указан, содержит все строковые поля из `payload.context` в camelCase-формате (`dealId`, `clientId`, `stageId` и т.д.). |

### POST `/tasks`
Создание задачи.

**Тело запроса**
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| subject | string | Да | Краткое название. |
| description | string | Да | Детали. |
| assignee_id | UUID | Да | Исполнитель. |
| author_id | UUID | Да | Постановщик. |
| due_date | date | Нет | Срок исполнения. |
| priority | string | Нет | `low`, `normal`, `high`. |
| context | object | Нет | `{ "deal_id": "uuid", "policy_id": "uuid" }`. |
| scheduled_for | datetime | Нет | Время отложенного запуска задачи. Можно передавать в формате `scheduled_for` или `scheduledFor`; при указании задача сразу попадёт в статус `scheduled` и будет активирована в указанное время. |
| payload | object | Нет | Дополнительные данные для произвольных интеграций. Полезно, если требуется сохранить нестандартные поля помимо `context`; объект хранится как есть и возвращается в `TaskResponseDto.payload`. |

> Поля `assignee_id` и `author_id` теперь хранятся в отдельных колонках таблицы `tasks.tasks`, а `payload` содержит их зеркальные
> значения (`assigneeId`/`assignee_id`, `authorId`/`author_id`) для обратной совместимости. Если передан `context`, сервис
> нормализует его ключи в camelCase и сохраняет весь объект (включая пользовательские поля) в `payload.context` и
> `TaskResponseDto.context`.

**Ответ 201** — созданная задача. Ответ соответствует `TaskResponseDto`.

**Пример запроса**
```json
{
  "subject": "Подготовить КП",
  "description": "Согласовать условия и отправить клиенту",
  "assignee_id": "uuid",
  "author_id": "uuid",
  "due_date": "2024-03-10",
  "priority": "high",
  "context": {"deal_id": "uuid"}
}
```

**Пример ответа**
```json
{
  "id": "uuid",
  "title": "Подготовить КП",
  "description": "Согласовать условия и отправить клиенту",
  "statusCode": "pending",
  "statusName": "Pending",
  "dueAt": "2024-03-10T00:00:00.000Z",
  "scheduledFor": null,
  "completedAt": null,
  "cancelledReason": null,
  "createdAt": "2024-03-05T11:00:00.000Z",
  "updatedAt": "2024-03-05T11:00:00.000Z",
  "payload": {
    "assigneeId": "uuid",
    "authorId": "uuid",
    "priority": "high",
    "dealId": "uuid",
    "clientId": "uuid",
    "context": {"dealId": "uuid"}
  },
  "assigneeId": "uuid",
  "priority": "high",
  "dealId": "uuid",
  "clientId": "uuid",
  "context": {"dealId": "uuid"}
}
```

> При отсутствии поля `description` или передаче пустого значения API вернёт `400 validation_error` с указанием обязательного поля.

**Ошибки:** `400 validation_error`, `404 context_not_found` (если указаны несуществующие сущности).

### PATCH `/tasks/{task_id}`
Обновление статуса, дедлайна и фактических отметок выполнения.

**Тело запроса**
| Поле | Тип | Описание |
| --- | --- | --- |
| status | string | Новый статус задачи. Допустимые значения: `pending`, `scheduled`, `in_progress`, `completed`, `cancelled`. |
| dueDate | datetime | Новая плановая дата завершения. `null` удаляет дедлайн. |
| completedAt | datetime | Фактическое время завершения. При переводе в `completed` без значения используется текущее время. |
| cancelledReason | string | Причина отмены. Обязательна при `status = cancelled`. |

**Правила переходов**
- Из финальных статусов (`completed`, `cancelled`) возврат невозможен.
- `scheduled` можно перевести в `pending`, `in_progress` или `cancelled`. Отложенная задача удаляется из очереди автоматически.
- `pending` переходит в `in_progress`, `completed` или `cancelled`.
- `in_progress` завершается (`completed`) или отменяется (`cancelled`).
- `cancelledReason` можно создавать или обновлять только при отмене задачи или если задача уже находится в статусе `cancelled`; при переходе в активные статусы изменение причины отклоняется с `409 conflict`.

**Ответ 200** — `TaskResponseDto` с обновлёнными полями `statusCode`, `dueAt`, `completedAt`, `cancelledReason`.

**Пример запроса**
```json
{
  "status": "in_progress",
  "dueDate": "2024-03-12"
}
```

**Пример ответа**
```json
{
  "id": "uuid",
  "statusCode": "in_progress",
  "title": "Подготовить КП",
  "dueAt": "2024-03-12T00:00:00.000Z",
  "updatedAt": "2024-03-06T09:00:00Z"
}
```

**Пример ошибки 409**
```json
{
  "statusCode": 409,
  "code": "invalid_status_transition",
  "message": "Task in status completed cannot transition to pending",
  "details": {
    "current": "completed",
    "next": "pending"
  }
}
```

**Ошибки:** `400 validation_error`, `404 task_not_found`, `409 invalid_status_transition` (например, при попытке вернуть задачу из `completed` в `pending`).

### GET `/tasks/{task_id}`
Возвращает подробную информацию по задаче.

**Параметры пути**
| Имя | Тип | Описание |
| --- | --- | --- |
| task_id | UUID | Идентификатор задачи. |

**Ответ 200** — объект `TaskResponseDto`.

**Пример ответа**
```json
{
  "id": "0f7f0cfd-9f17-4f7f-b761-9a9f0b83f613",
  "title": "Позвонить клиенту",
  "description": "Уточнить детали продления полиса",
  "statusCode": "in_progress",
  "statusName": "In progress",
  "dueAt": "2024-03-12T12:00:00.000Z",
  "scheduledFor": null,
  "completedAt": null,
  "cancelledReason": null,
  "createdAt": "2024-03-05T08:30:00.000Z",
  "updatedAt": "2024-03-06T09:45:00.000Z",
  "payload": {
    "assigneeId": "8e6d3f5c-6c5b-4a2a-8b15-661fbf6ec5cb",
    "authorId": "09e11f9f-9b1c-44c3-8c2c-6c6b0d35cc7f",
    "priority": "high",
    "context": {"dealId": "91cf0743-5df0-4bd1-92c9-8c2c72739f16"}
  },
  "assigneeId": "8e6d3f5c-6c5b-4a2a-8b15-661fbf6ec5cb",
  "priority": "high",
  "dealId": "91cf0743-5df0-4bd1-92c9-8c2c72739f16",
  "clientId": null,
  "context": {"dealId": "91cf0743-5df0-4bd1-92c9-8c2c72739f16"}
}
```

**Ошибки:** `404 task_not_found`.

### POST `/tasks/{task_id}/schedule`
Переводит задачу в статус `scheduled` и планирует автоматический старт.

**Параметры пути**
| Имя | Тип | Описание |
| --- | --- | --- |
| task_id | UUID | Идентификатор задачи. |

**Тело запроса**
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| scheduled_for | datetime | Да | Момент времени (UTC), когда задача должна автоматически перейти в активное состояние. Поддерживаются ключи `scheduled_for` и `scheduledFor`. |

**Пример запроса**
```json
{
  "scheduledFor": "2024-03-10T09:00:00Z"
}
```

**Ответ 200** — `TaskResponseDto` с обновлёнными полями `statusCode` = `scheduled` и `scheduledFor`.

**Пример ответа**
```json
{
  "id": "0f7f0cfd-9f17-4f7f-b761-9a9f0b83f613",
  "statusCode": "scheduled",
  "scheduledFor": "2024-03-10T09:00:00.000Z",
  "updatedAt": "2024-03-06T07:15:00.000Z"
}
```

**Ошибки:** `400 validation_error`, `400 scheduled_for_required` (если не указан `scheduled_for`), `404 task_not_found`, `409 invalid_status_transition`.

### POST `/tasks/{task_id}/complete`
Завершает задачу и переводит её в статус `completed`.

**Параметры пути**
| Имя | Тип | Описание |
| --- | --- | --- |
| task_id | UUID | Идентификатор задачи. |

**Тело запроса**
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| completed_at | datetime | Нет | Пользовательская отметка времени завершения (UTC). Если не передано, используется текущее время сервиса. Принимает ключи `completed_at` или `completedAt`. |

**Пример запроса**
```json
{
  "completedAt": "2024-03-10T11:25:00Z"
}
```

**Ответ 200** — `TaskResponseDto` со статусом `completed`.

**Пример ответа**
```json
{
  "id": "0f7f0cfd-9f17-4f7f-b761-9a9f0b83f613",
  "statusCode": "completed",
  "completedAt": "2024-03-10T11:25:00.000Z",
  "updatedAt": "2024-03-10T11:25:00.000Z"
}
```

**Ошибки:** `400 validation_error`, `404 task_not_found`, `409 invalid_status_transition` (если задача уже в финальном статусе). 

### POST `/tasks/{task_id}/reminders`
Создаёт напоминание.

> Напоминания выполняются асинхронно Celery-задачей `crm.app.tasks.process_task_reminders`. Она использует `TaskReminderProcessor`, который каждые `CRM_TASKS_REMINDERS_POLL_INTERVAL_MS` миллисекунд опрашивает Redis-очередь `tasks_reminders_queue_key` (значение переменной `CRM_TASKS_REMINDERS_QUEUE_KEY`), публикует событие `task.reminder` в обменник `CRM_TASKS_EVENTS_EXCHANGE` с ключом `CRM_TASKS_EVENTS_ROUTING_KEYS__TASK_REMINDER` (источник задаётся `CRM_TASKS_EVENTS_SOURCE`) и удаляет успешно обработанные элементы. Параметры выборки управляются `CRM_TASKS_SCHEDULING_BATCH_SIZE`, а повторные попытки выполняются автоматически с задержкой.

**Тело запроса**
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| remind_at | datetime | Да | Время напоминания (UTC). |
| channel | string | Нет | `sse`, `telegram`. По умолчанию `sse` (внутренний канал SSE). Telegram доступен при наличии `telegram_id`. |

**Пример запроса**

```http
POST /tasks/0f7f0cfd-9f17-4f7f-b761-9a9f0b83f613/reminders
Content-Type: application/json

{
  "remind_at": "2024-03-10T09:00:00Z",
  "channel": "telegram"
}
```

**Ответ 201** — напоминание.

```json
{
  "id": "5f4f93f2-1965-4240-9a3d-6fdc54bb693c",
  "taskId": "0f7f0cfd-9f17-4f7f-b761-9a9f0b83f613",
  "remindAt": "2024-03-10T09:00:00.000Z",
  "channel": "telegram",
  "createdAt": "2024-03-09T12:00:00.000Z"
}
```

**Ошибки:** `400 validation_error`, `404 task_not_found`, `409 conflict` (если для задачи уже есть напоминание с теми же `remind_at` и `channel`).

## SLA и автоматические переходы (Этап 1.1)

> ⚠️ Функциональность SLA исключена из первой поставки модуля задач CRM. Контракты ниже
> остаются в роадмапе и будут реализованы на [Этапе 1.1](../delivery-plan.md#2-приоритизация-последующих-этаов).
> До выхода обновления эндпоинты недоступны.

## Экспорт и календарные подписки (Этап 1.1)

> ⚠️ Эндпоинты для экспорта задач и публикации WebCal-фидов отсутствуют в текущем релизе.
> Функциональность включена в дорожную карту [Этапа 1.1](../delivery-plan.md#2-приоритизация-последующих-этаов)
> вместе с расширенным календарём задач.

### POST `/sla/recalculate`
Запускает пересчёт SLA и дедлайнов для задач выбранного сегмента.

**Тело запроса**
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| scope | string | Нет | `all`, `overdue_only`, `deal` (требует `deal_id`). |
| deal_id | UUID | Нет | Требуется при `scope = deal`. |

**Ответ 202** — асинхронная задача.

**Ошибки:** `400 validation_error`, `404 deal_not_found`.

## Стандартные ошибки CRM Tasks API

| Код | Сообщение | Описание |
| --- | --- | --- |
| 400 | `validation_error` | Ошибка валидации. |
| 401 | `unauthorized` | Неверный токен. |
| 403 | `forbidden` | Нет прав на операцию. |
| 404 | `not_found` | Ресурс не найден. |
| 409 | `conflict` | Конфликт статусов. |
| 429 | `rate_limited` | Ограничение по напоминаниям. |
| 500 | `internal_error` | Внутренняя ошибка сервиса. |
