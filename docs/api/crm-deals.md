# CRM / Deals API

## Общая информация
- **Базовый URL:** `https://crm.internal/api/v1`
- **Аутентификация:** сервисный JWT от Gateway/Auth (`Authorization: Bearer <token>`)
- **Назначение:** CRUD-операции по клиентам, сделкам, полисам и задачам первого уровня.
- **Контекст арендатора:** все запросы требуют заголовок `X-Tenant-ID` (UUID). Значение используется для политик RLS в схеме `crm` и маршрутизации фоновых задач.

## Клиенты

### GET `/clients`
Возвращает список клиентов арендатора.

**Заголовки**
- `X-Tenant-ID` *(обязательно)* — UUID арендатора.

**Параметры ответа** — массив объектов `Client`:
```json
{
  "id": "5cb2f9ae-dc0c-4dd6-8abf-50d0fa3b9c2f",
  "name": "ООО Ромашка",
  "email": "info@example.com",
  "phone": "+7-900-123-45-67",
  "status": "active",
  "owner_id": "2f6f2803-5f69-4f9a-9cb0-f7e0c6f90958",
  "tenant_id": "1c54c7ba-ea78-44ec-9f40-5861ab6b0107",
  "created_at": "2024-03-15T12:00:00Z",
  "updated_at": "2024-03-15T12:00:00Z"
}
```

### POST `/clients`
Создаёт клиента.

**Тело запроса**
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| name | string | Да | Имя/название клиента. |
| email | string | Нет | Контактный e-mail. |
| phone | string | Нет | Контактный телефон. |
| status | string | Нет | `active`/`inactive`/`prospect`, по умолчанию `active`. |
| owner_id | UUID | Да | Ответственный пользователь (используется для RLS). |

**Ответ 201** — объект клиента.

### PATCH `/clients/{client_id}`
Частично обновляет клиента. Допустимы поля `name`, `email`, `phone`, `status`.

## Сделки

### GET `/deals`
Возвращает список сделок арендатора, отсортированных по `next_review_at` (самые ближайшие проверки первыми) с дополнительной сортировкой по `updated_at`.

### POST `/deals`
Создаёт сделку.

**Тело запроса**
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| client_id | UUID | Да | Идентификатор клиента. |
| title | string | Да | Название сделки. |
| description | string | Нет | Свободный комментарий. |
| status | string | Нет | Текущий статус (по умолчанию `draft`). |
| value | number | Нет | Планируемая сумма. |
| owner_id | UUID | Да | Ответственный менеджер. |
| next_review_at | date | Да | Дата следующего пересмотра сделки. |

**Ответ 201** — объект сделки.

### PATCH `/deals/{deal_id}`
Обновляет поля `title`, `description`, `status`, `value`, `next_review_at` (значение должно быть ненулевой датой).

## Полисы

### GET `/policies`
Список полисов по арендаторам.

### POST `/policies`
Создаёт полис.

| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| client_id | UUID | Да | Связанный клиент. |
| deal_id | UUID | Нет | Сделка, к которой относится полис. |
| policy_number | string | Да | Номер полиса (уникален). |
| status | string | Нет | `draft`/`active`/`closed`, по умолчанию `draft`. |
| premium | number | Нет | Сумма премии. |
| effective_from | date | Нет | Дата начала действия. |
| effective_to | date | Нет | Дата окончания действия. |
| owner_id | UUID | Да | Ответственный пользователь. |

### PATCH `/policies/{policy_id}`
Обновляет `status`, `premium`, `effective_from`, `effective_to`.

## Задачи первого уровня

### GET `/tasks`
Возвращает задачи, связанные со сделками или клиентами.

### POST `/tasks`
Создаёт задачу для менеджера.

| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| title | string | Да | Краткое описание задачи. |
| description | string | Нет | Детальное описание. |
| status | string | Нет | `open`/`in_progress`/`done`, по умолчанию `open`. |
| priority | string | Нет | `low`/`normal`/`high`, по умолчанию `normal`. |
| due_date | date | Нет | Плановая дата выполнения. |
| deal_id | UUID | Нет | Привязка к сделке. |
| client_id | UUID | Нет | Привязка к клиенту. |
| owner_id | UUID | Да | Исполнитель. |

### PATCH `/tasks/{task_id}`
Изменяет `title`, `description`, `status`, `priority`, `due_date`.

## Интеграция с платежами
- Сервис подписан на exchange `payments.events` (routing key `payments.*`).
- При успешной обработке событий публикуется `payments.synced` в `crm.events`.
- Повторные попытки выполняются через очередь `crm.payments-sync.retry` (TTL задаётся `CRM_PAYMENTS_RETRY_DELAY_MS`), невосстановимые сообщения сохраняются в `crm.payments-sync.dlx` для ручного анализа.【F:docs/tech-stack.md†L178-L204】
