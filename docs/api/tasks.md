# Tasks API

## Общая информация
- **Базовый URL:** `https://tasks.internal/api/v1`
- **Аутентификация:** сервисный JWT, поддержка scope `tasks.manage`
- **Назначение:** управление задачами, SLA и напоминаниями.

## Задачи

### GET `/tasks`
Список задач с фильтрами по исполнителю и срокам.

**Параметры запроса**
| Имя | Тип | Описание |
| --- | --- | --- |
| assignee_id | UUID | Фильтр по исполнителю. |
| status | array[string] | `open`, `in_progress`, `waiting`, `done`, `cancelled`. |
| due_before | date | Задачи со сроком до указанной даты. |
| due_after | date | Задачи со сроком после указанной даты. |
| priority | array[string] | `low`, `normal`, `high`. |
| limit | integer | По умолчанию 50. |
| offset | integer | Смещение. |

**Ответ 200** — список задач с привязками к сущностям CRM.

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

**Ответ 201** — созданная задача.

**Ошибки:** `400 validation_error`, `404 context_not_found` (если указаны несущствующие сущности).

### PATCH `/tasks/{task_id}`
Обновление статуса и фактических дат.

**Тело запроса**
| Поле | Тип | Описание |
| --- | --- | --- |
| status | string | Новый статус. |
| completed_at | datetime | Заполняется при статусе `done`. |
| cancelled_reason | string | Причина отмены. |
| due_date | date | Перенос срока. |

**Ответ 200** — обновлённая задача.

**Ошибки:** `404 task_not_found`, `409 invalid_status_transition`.

### POST `/tasks/{task_id}/reminders`
Создаёт напоминание.

**Тело запроса**
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| remind_at | datetime | Да | Время напоминания (UTC). |
| channel | string | Нет | `sse`, `telegram`, `email`. По умолчанию `sse`. |

**Ответ 201** — напоминание.

**Ошибки:** `400 validation_error`, `404 task_not_found`.

## SLA и автоматические переходы

### POST `/sla/recalculate`
Запускает пересчёт SLA и дедлайнов для задач выбранного сегмента.

**Тело запроса**
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| scope | string | Нет | `all`, `overdue_only`, `deal` (требует `deal_id`). |
| deal_id | UUID | Нет | Требуется при `scope = deal`. |

**Ответ 202** — асинхронная задача.

**Ошибки:** `400 validation_error`, `404 deal_not_found`.

## Стандартные ошибки Tasks API

| Код | Сообщение | Описание |
| --- | --- | --- |
| 400 | `validation_error` | Ошибка валидации. |
| 401 | `unauthorized` | Неверный токен. |
| 403 | `forbidden` | Нет прав на операцию. |
| 404 | `not_found` | Ресурс не найден. |
| 409 | `conflict` | Конфликт статусов. |
| 429 | `rate_limited` | Ограничение по напоминаниям. |
| 500 | `internal_error` | Внутренняя ошибка сервиса. |
