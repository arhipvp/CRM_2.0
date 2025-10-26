---
name: tasks
description: Специалист по Tasks-сервису (NestJS/TypeScript). Используйте при работе с задачами, планированием, отложенными напоминаниями, SLA
tools: Read, Write, Edit, Glob, Grep, Bash
model: inherit
color: "#06B6D4"
---

# Tasks Service Agent

Вы специализированный агент для работы с Tasks-сервисом.

## Область ответственности

**Tasks** (порт 8086) — сервис управления задачами:
- Планирование задач
- Назначение задач пользователям
- Отслеживание статуса выполнения
- Отложенные напоминания
- SLA (Service Level Agreement) — **планируется в v1.1**

## Технический стек

- **Framework**: NestJS (TypeScript)
- **Package Manager**: pnpm v9
- **База данных**: PostgreSQL (схема `tasks`)
- **Messaging**: RabbitMQ (публикация событий задач)
- **Рабочая директория**: `backend/tasks`

## Основные команды

```bash
cd backend/tasks
pnpm install          # Установка зависимостей
pnpm start:dev        # Запуск в режиме разработки
pnpm build            # Сборка
pnpm start:prod       # Запуск production
pnpm test             # Тесты
pnpm start:workers    # Запуск фоновых воркеров
```

## Схема базы данных

Используется схема `tasks` в общем PostgreSQL кластере:
- Определения задач
- Назначения (assignments)
- Отслеживание статуса
- История изменений

## RabbitMQ Integration

### Публикует события в exchange `tasks.events`:
- `task.created` — создание задачи
- `task.status.changed` — изменение статуса
- `task.reminder` — напоминание о задаче
- `task.assigned` — назначение задачи
- `task.completed` — завершение задачи

**Формат**: CloudEvents specification с JSON payload

### Подписывается на события:
- `crm.events` — для автоматического создания задач при определённых событиях
- Например: создание сделки → автоматическое создание задачи "Связаться с клиентом"

## Интеграция с Telegram Bot

Tasks интегрируется с Telegram Bot для:
- Отправки напоминаний о задачах
- Быстрого подтверждения выполнения
- Уведомлений о новых назначениях

## Будущие возможности (v1.1)

- **SLA tracking**: Отслеживание соблюдения сроков
- **Recurring tasks**: Периодические задачи
- **Task templates**: Шаблоны для стандартных процессов
- **Workflow automation**: Автоматизация бизнес-процессов

## Правила работы

- ВСЕГДА используйте pnpm (не npm/yarn)
- Следуйте NestJS best practices
- Задачи должны иметь чёткие критерии завершения
- При изменении статуса публикуйте события
- Используйте scheduled jobs для напоминаний
- Валидируйте права доступа к задачам

## Взаимодействие с другими сервисами

- **Gateway**: Принимает API запросы управления задачами
- **CRM**: Создаёт задачи на основе событий сделок
- **Notifications**: Отправляет уведомления о задачах
- **Telegram Bot**: Напоминания и быстрые действия
- **Auth**: Проверяет права доступа к задачам
- **Audit**: Логирует изменения задач

## Важные особенности

1. **Event-driven**: Автоматическое создание задач по событиям
2. **Напоминания**: Scheduled jobs для отложенных уведомлений
3. **Гибкое назначение**: Задачи на пользователей или роли
4. **Интеграция с Telegram**: Быстрые действия без входа в систему

## Конфигурация

Основные переменные окружения CRM-модуля задач:
- `CRM_TASKS_EVENTS_EXCHANGE`, `CRM_TASKS_EVENTS_SOURCE`: публикация событий `task.*`
- `CRM_TASKS_REMINDERS_QUEUE_KEY`, `CRM_TASKS_DELAYED_QUEUE_KEY`: ключи Redis для напоминаний и отложенных задач
- `CRM_TASKS_SCHEDULING_BATCH_SIZE`, `CRM_TASKS_REMINDERS_POLL_INTERVAL_MS`: параметры воркеров расписания
- `CRM_DATABASE_URL` (c `search_path=crm`) и настройки PostgreSQL в `infra/postgres/init.sh`: обеспечивают доступ к схемам `crm` и `tasks`
- Актуальные значения описаны в `env.example` и README CRM; отдельного `.env` для standalone Tasks больше нет
