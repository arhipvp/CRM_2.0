# Claude Code Субагенты - Полная Справка

## Обзор

В этом проекте настроено **13 специализированных субагентов** для работы с различными компонентами CRM микросервисной архитектуры.

## Все субагенты

| Имя | Описание | Цвет | Технологии |
|-----|---------|------|-----------|
| **frontend** | Frontend Web App | 🔷 Cyan | Next.js, React, TypeScript, pnpm |
| **desktop-app** | Desktop App | 🟣 Purple | Python, Tkinter, pip |
| **gateway** | API Gateway/BFF | 🟨 Yellow | NestJS, TypeScript, pnpm |
| **auth** | Auth Service | 🟪 Indigo | Spring Boot, Kotlin, Gradle |
| **crm** | CRM/Deals Service | 🟦 Blue | FastAPI, Python, Poetry |
| **documents** | Documents Service | 🟩 Green | NestJS, TypeScript, pnpm |
| **notifications** | Notifications Service | 🟥 Red | NestJS, TypeScript, pnpm |
| **tasks** | Tasks Service | 🟧 Orange | NestJS, TypeScript, pnpm |
| **reports** | Reports Service | 🟨 Yellow | FastAPI, Python, Poetry |
| **audit** | Audit Service | 🟪 Indigo | NestJS, TypeScript, pnpm |
| **telegram-bot** | Telegram Bot | 🔵 Blue | Python, aiogram, Poetry |
| **backup** | Backup Service | 🟩 Green | Bash, Docker |
| **infrastructure** | DevOps & Infrastructure | 🟧 Orange | Docker, Bash, Scripts |

## Как найти субагента

### По технологии
- **TypeScript/NestJS**: gateway, documents, notifications, tasks, audit, frontend
- **Python/FastAPI**: crm, reports, telegram-bot
- **Python/Tkinter**: desktop-app
- **Kotlin/Spring Boot**: auth
- **Bash/Docker**: infrastructure, backup

### По области ответственности
- **User Interface**: frontend, desktop-app
- **API & Routing**: gateway
- **Authentication**: auth
- **Business Logic**: crm, reports, tasks
- **Infrastructure**: infrastructure, backup
- **Notifications**: notifications, telegram-bot
- **File Storage**: documents
- **Logging**: audit

## Применение субагентов

### Автоматическое срабатывание

Claude Code автоматически выбирает нужного субагента на основе:
1. **Пути к файлам** — если вы упоминаете `backend/crm/...`, используется субагент `crm`
2. **Имён сервисов** — если вы говорите о "Gateway", используется субагент `gateway`
3. **Технологий** — если упоминаете "Tkinter", используется субагент `desktop-app`

### Явное указание

Вы можете явно указать субагента:
```
Используя субагент desktop-app, добавь новую форму...
Субагент crm, помоги с логикой платежей...
```

## Структура файлов субагентов

Все субагенты находятся в `.claude/agents/`:

```
.claude/agents/
├── README.md                 # Основная документация по субагентам
├── AGENTS_SUMMARY.md         # Эта справка
├── frontend.md              # Frontend субагент
├── desktop-app.md           # Desktop приложение субагент
├── gateway.md               # API Gateway субагент
├── auth.md                  # Auth сервис субагент
├── crm.md                   # CRM сервис субагент
├── documents.md             # Documents сервис субагент
├── notifications.md         # Notifications сервис субагент
├── tasks.md                 # Tasks сервис субагент
├── reports.md               # Reports сервис субагент
├── audit.md                 # Audit сервис субагент
├── telegram-bot.md          # Telegram Bot субагент
├── backup.md                # Backup сервис субагент
└── infrastructure.md        # Infrastructure субагент
```

## Ключевые особенности каждого субагента

### Frontend (`frontend.md`)
- Next.js 15, React 18, TypeScript
- SSR, SSE стримы, React Query
- Tailwind CSS, Axios, Zod
- **Команды**: `pnpm dev`, `pnpm build`, `pnpm test`

### Desktop App (`desktop-app.md`) ← НОВЫЙ
- Python 3.8+, Tkinter GUI
- API интеграция с Gateway
- Threading для асинхронных операций
- Локальное хранилище (JSON/SQLite)
- **Команды**: `pip install -r requirements.txt`, `python main.py`

### Gateway (`gateway.md`)
- NestJS, TypeScript, pnpm
- Единая точка входа, SSE прокси
- Session management, JWT validation
- **Порт**: 8080

### Auth (`auth.md`)
- Spring Boot, Kotlin, Gradle wrapper
- OAuth/OIDC, JWT, RBAC
- User management, role mapping
- **Порт**: 8081

### CRM (`crm.md`)
- FastAPI, Python, Poetry
- Clients, Deals, Policies, Payments
- Celery workers, background jobs
- **Порт**: 8082
- **ВАЖНО**: Платежи в CRM, не отдельный сервис!

### Documents (`documents.md`)
- NestJS, TypeScript, pnpm
- File storage, POSIX ACL
- Metadata management
- **Порт**: 8084

### Notifications (`notifications.md`)
- NestJS, TypeScript, pnpm
- SSE стримы, event-driven
- Telegram integration
- **Порт**: 8085

### Tasks (`tasks.md`)
- NestJS, TypeScript, pnpm
- Task planning, SLA tracking
- Delayed reminders, scheduling
- **Порт**: 8086

### Reports (`reports.md`)
- FastAPI, Python, Poetry
- Materialized views, analytics
- Aggregated metrics from CRM/Audit
- **Порт**: 8087

### Audit (`audit.md`)
- NestJS, TypeScript, pnpm
- Centralized action logging
- Event archival, partitioned by month
- **Порт**: 8088

### Telegram Bot (`telegram-bot.md`)
- Python, aiogram, Poetry
- HTTPS webhook integration
- FSM, rate limiting, Redis
- **Порт**: 8089

### Backup (`backup.md`)
- Bash, Docker, scripts
- PostgreSQL, Redis, RabbitMQ backups
- S3-compatible storage
- No fixed port

### Infrastructure (`infrastructure.md`)
- Docker, docker-compose
- Bootstrap scripts, migrations
- Environment setup, port management
- No fixed port

## Примеры использования

### Сценарий 1: Добавить форму в десктопное приложение

```
Вы: "Добавь форму для управления сделками в десктоп приложение"

Claude:
1. Использует desktop-app - создаёт Tkinter форму с полями для сделок
2. Использует crm - смотрит API endpoints для сделок (/api/v1/crm/deals)
3. Использует gateway - проверяет доступность и маршруты
```

### Сценарий 2: Исправить ошибку на веб-фронтенде

```
Вы: "Клиенты не загружаются на странице /clients"

Claude:
1. Использует frontend - проверяет React компоненты, API запросы
2. Использует gateway - проверяет маршруты и доступность
3. Использует crm - проверяет endpoints для клиентов
```

### Сценарий 3: Добавить новое событие в систему

```
Вы: "Когда создается новая сделка, нужно отправлять уведомление в Telegram"

Claude:
1. Использует crm - модифицирует логику создания сделок для публикации события
2. Использует notifications - настраивает обработчик события
3. Использует telegram-bot - добавляет отправку сообщения
```

### Сценарий 4: Добавить новый микросервис

```
Вы: "Нужен новый сервис для работы с страховыми полисами"

Claude:
1. Создаст новый файл `.claude/agents/policies.md`
2. Обновит `.claude/agents/README.md` с информацией о новом сервисе
3. Будет использовать этого субагента при работе с `backend/policies/*`
```

## Как добавить нового субагента

1. **Создайте файл** `.claude/agents/<name>.md`
2. **Заполните frontmatter** (YAML header):
   ```yaml
   ---
   name: myservice
   description: Краткое описание
   tools: Read, Write, Edit, Glob, Grep, Bash
   model: inherit
   color: "#FF5733"
   ---
   ```
3. **Напишите документацию** со следующими секциями:
   - Область ответственности
   - Технический стек
   - Основные команды
   - Структура проекта
   - Ключевые особенности
   - Правила работы
   - Взаимодействие с другими сервисами
   - Environment переменные
   - Частые проблемы и решения
   - Testing
   - Debugging
   - Troubleshooting Checklist

4. **Обновите** `.claude/agents/README.md`:
   - Добавьте в нужную секцию "Доступные субагенты"
   - Добавьте примеры использования

5. **Обновите** этот файл (AGENTS_SUMMARY.md)

## Полезные команды Claude Code

```bash
# Просмотр всех субагентов
/agents

# Просмотр помощи
/help

# Просмотр текущего контекста
/context
```

## Правила работы с субагентами

1. **Доверяйте автоматическому выбору** — Claude обычно выбирает правильного субагента
2. **Будьте конкретны** — упоминайте пути к файлам, имена функций, названия сервисов
3. **Используйте явное указание** когда нужна уверенность — "Используя desktop-app,..."
4. **Проверяйте контекст** — иногда нужно несколько субагентов одновременно
5. **Читайте документацию субагента** — в каждом файле `.md` много полезной информации

## Порты и сервисы

| Сервис | Порт | Статус |
|--------|------|--------|
| Frontend | 3000 (dev), 80 (proxy) | Running |
| Gateway | 8080 | Running |
| Auth | 8081 | Running |
| CRM | 8082 | Running |
| Documents | 8084 | Running |
| Notifications | 8085 | Running |
| Tasks | 8086 | Running |
| Reports | 8087 | Running |
| Audit | 8088 | Running |
| Telegram Bot | 8089 | Running |
| PostgreSQL | 5432 | Running |
| Redis | 6379 | Running |
| RabbitMQ | 5672, 15672 | Running |

## Переменные окружения

Все переменные окружения находятся в `.env` (синхронизируются из `env.example`).

Главные переменные:
- `DATABASE_URL` — подключение к PostgreSQL (для миграций)
- `REDIS_HOST/PORT` — Redis для кэша и FSM
- `RABBITMQ_*` — RabbitMQ для event bus
- `AUTH_JWT_SECRET` — JWT secret ключ
- `DOCUMENTS_STORAGE_ROOT` — путь к хранилищу файлов
- `NEXT_PUBLIC_API_BASE_URL` — URL Gateway для фронтенда

## Troubleshooting

### Проблема: Субагент не используется автоматически

**Решение**: Явно укажите имя субагента в запросе
```
Используя desktop-app, добавь...
```

### Проблема: Субагент не знает о новом файле

**Решение**: Перезагрузите контекст или явно упомяните путь
```
В файле backend/desktop_app/main.py...
```

### Проблема: Конфликт между субагентами

**Решение**: Разделите задачу на части и вызывайте субагентов отдельно

## Дополнительные ресурсы

- [Claude Code Documentation](https://docs.claude.com/en/docs/claude-code)
- [Sub-Agents Guide](https://docs.claude.com/en/docs/claude-code/sub-agents.md)
- `CLAUDE.md` — основная документация проекта
- `.claude/agents/README.md` — детальная справка по субагентам

## История изменений

- **2024-10-23**: Добавлен новый субагент `desktop-app` для Python Tkinter приложения
- **Предыдущие версии**: 12 субагентов для микросервисной архитектуры
