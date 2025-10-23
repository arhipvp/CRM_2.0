# Claude Code субагенты - Архитектура

## 🏗️ Общая архитектура проекта

```
┌─────────────────────────────────────────────────────────────┐
│                    CRM Microservices System                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                       Client Layer                          │
├──────────────────────┬──────────────────────┬───────────────┤
│                      │                      │               │
│   Web Frontend       │  Desktop App         │  Telegram Bot │
│   (Next.js)          │  (Tkinter/Python)    │  (aiogram)    │
│   [:3000]            │  [local]             │  [:8089]      │
│                      │                      │               │
└──────────┬───────────┴──────────┬───────────┴───────┬───────┘
           │                      │                   │
           │                      │                   │
           │    ┌─────────────────┘                   │
           │    │                                     │
           └────┼─────────────────────────────────┬──┘
                │                                 │
┌───────────────┴─────────────────────────────────┴──────────┐
│                    API Gateway (BFF)                       │
│                    (NestJS, :8080)                         │
│  - Request routing                                         │
│  - Session management                                      │
│  - SSE stream proxying                                     │
│  - Webhook for Telegram                                   │
└──────────────┬────────────────────────────────────────────┘
               │
       ┌───────┴────────────────────────────────────────┐
       │                                                │
┌──────┴────────────┐                          ┌───────┴──────────┐
│  Authentication   │                          │  Business Logic  │
│  (Auth Service)   │                          │                  │
│  Spring Boot      │                          ├──────────────────┤
│  Kotlin, :8081    │                          │  CRM Service     │
│                   │                          │  (FastAPI)       │
│  - OAuth/OIDC     │                          │  Python, :8082   │
│  - JWT            │                          │                  │
│  - User/Role mgmt │                          │  - Clients       │
│  - RBAC           │                          │  - Deals         │
│                   │                          │  - Payments      │
│                   │                          │  - Policies      │
│                   │                          │  - Celery workers│
└───────────────────┘                          └──────────────────┘

       ┌────────────────────────────────────────────────────────┐
       │            Supporting Services Layer                   │
       ├────────────────────────────────────────────────────────┤
       │                                                        │
       │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐ │
       │  │ Documents   │  │Notifications │  │   Tasks        │ │
       │  │ (NestJS)    │  │  (NestJS)    │  │  (NestJS)      │ │
       │  │ :8084       │  │  :8085       │  │  :8086         │ │
       │  │             │  │              │  │                │ │
       │  │ - Files     │  │ - SSE        │  │ - Planning     │ │
       │  │ - Storage   │  │ - Telegram   │  │ - Reminders    │ │
       │  │ - ACL       │  │ - Events     │  │ - SLA          │ │
       │  └─────────────┘  └──────────────┘  └────────────────┘ │
       │                                                        │
       │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐ │
       │  │  Reports    │  │    Audit     │  │    Backup      │ │
       │  │ (FastAPI)   │  │  (NestJS)    │  │     (Bash)     │ │
       │  │ :8087       │  │  :8088       │  │   (Docker)     │ │
       │  │             │  │              │  │                │ │
       │  │ - Analytics │  │ - Logs       │  │ - PostgreSQL   │ │
       │  │ - Views     │  │ - Events     │  │ - Redis        │ │
       │  │ - Metrics   │  │ - Archive    │  │ - RabbitMQ     │ │
       │  └─────────────┘  └──────────────┘  └────────────────┘ │
       │                                                        │
       └────────────────────────────────────────────────────────┘

       ┌────────────────────────────────────────────────────────┐
       │              Data & Communication Layer                │
       ├────────────────────────────────────────────────────────┤
       │                                                        │
       │  ┌──────────────────────────────────────────────────┐  │
       │  │         PostgreSQL (Single Cluster)             │  │
       │  │      Separate schema per service                │  │
       │  └──────────────────────────────────────────────────┘  │
       │                                                        │
       │  ┌──────────────┐  ┌──────────────┐                    │
       │  │    Redis     │  │   RabbitMQ   │                    │
       │  │  (Caching)   │  │  (Event Bus) │                    │
       │  │  (FSM State) │  │              │                    │
       │  └──────────────┘  └──────────────┘                    │
       │                                                        │
       └────────────────────────────────────────────────────────┘
```

## 📋 Субагенты и их область

### Frontend & Desktop (User Interface)
```
┌─────────────────────────────────────────┐
│  FRONTEND Subagent                      │
│  - Next.js, React, TypeScript           │
│  - SSR, SSE streams                     │
│  - Tailwind CSS                         │
│  - React Query                          │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  DESKTOP-APP Subagent ✨ NEW            │
│  - Python, Tkinter                      │
│  - GUI components                       │
│  - API integration                      │
│  - State management                     │
└─────────────────────────────────────────┘
```

### API & Routing
```
┌─────────────────────────────────────────┐
│  GATEWAY Subagent                       │
│  - NestJS, TypeScript                   │
│  - Request routing                      │
│  - Session management                   │
│  - SSE proxying                         │
│  - Webhook handling                     │
└─────────────────────────────────────────┘
```

### Core Services
```
┌─────────────────────────────────────────┐
│  AUTH Subagent                          │
│  - Spring Boot, Kotlin                  │
│  - OAuth/OIDC                           │
│  - JWT tokens                           │
│  - User/Role management                 │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  CRM Subagent                           │
│  - FastAPI, Python                      │
│  - Clients, Deals, Payments             │
│  - Celery workers                       │
│  - Business logic                       │
└─────────────────────────────────────────┘
```

### Supporting Services
```
┌──────────────┬──────────────┬──────────────┐
│  DOCUMENTS   │NOTIFICATIONS │   TASKS      │
│  NestJS      │   NestJS     │  NestJS      │
│              │              │              │
│ - File mgmt  │ - SSE        │ - Planning   │
│ - Storage    │ - Telegram   │ - Reminders  │
│ - ACL        │ - Events     │ - SLA        │
└──────────────┴──────────────┴──────────────┘

┌──────────────┬──────────────┬──────────────┐
│   REPORTS    │    AUDIT     │   BACKUP     │
│  FastAPI     │   NestJS     │    Bash      │
│              │              │              │
│ - Analytics  │ - Logs       │ - DB backup  │
│ - Views      │ - Events     │ - S3 sync    │
│ - Metrics    │ - Archive    │ - Restore    │
└──────────────┴──────────────┴──────────────┘

┌─────────────────────────────────────────┐
│  TELEGRAM-BOT Subagent                  │
│  - Python, aiogram                      │
│  - HTTPS webhooks                       │
│  - FSM state management                 │
│  - Rate limiting                        │
└─────────────────────────────────────────┘
```

### Infrastructure
```
┌─────────────────────────────────────────┐
│  INFRASTRUCTURE Subagent                │
│  - Docker, docker-compose               │
│  - Bootstrap scripts                    │
│  - Migrations                           │
│  - Environment setup                    │
└─────────────────────────────────────────┘
```

## 🔄 Взаимодействие субагентов

### Типичный flow создания сделки

```
Frontend
   │
   ├─→ Gateway (маршрутизация)
   │    │
   │    ├─→ CRM Service (создание сделки)
   │    │    │
   │    │    ├─→ PostgreSQL (сохранение)
   │    │    ├─→ RabbitMQ (публикация события)
   │    │    └─→ Celery Worker (background jobs)
   │    │
   │    ├─→ Notifications (SSE уведомление)
   │    └─→ Audit Service (логирование события)
   │
   └─→ Frontend (получение результата через SSE)
```

### Интеграция с Telegram

```
Telegram Bot
   │
   ├─→ Gateway (HTTPS webhook)
   │    │
   │    └─→ CRM Service (создание задачи/сделки)
   │         │
   │         ├─→ RabbitMQ (события)
   │         └─→ PostgreSQL (сохранение)
   │
   └─→ Notifications (отправка ответа юзеру)
```

## 📁 Структура документации subagent'ов

```
.claude/
│
├── INDEX.md                    ← Вы начинаете отсюда
├── QUICK_START.md              ← 10 минут для новичков
├── AGENTS_SUMMARY.md           ← Полная справка
├── SETUP_REPORT.md             ← Что было создано
├── ARCHITECTURE.md             ← Этот файл
│
├── settings.local.json         ← Конфигурация разрешений
│
└── agents/                      ← Документация каждого subagent'а
    ├── README.md               ← Главная инструкция
    │
    ├── [Frontend & Desktop]
    ├── frontend.md             ← Web UI (Next.js)
    ├── desktop-app.md          ← Desktop GUI (Tkinter) ✨ NEW
    │
    ├── [API & Routing]
    ├── gateway.md              ← API Gateway (NestJS)
    │
    ├── [Authentication & Core]
    ├── auth.md                 ← Auth Service (Spring Boot)
    ├── crm.md                  ← CRM Service (FastAPI)
    │
    ├── [Supporting Services]
    ├── documents.md            ← Document Management (NestJS)
    ├── notifications.md        ← Notifications (NestJS)
    ├── tasks.md                ← Task Management (NestJS)
    ├── reports.md              ← Analytics (FastAPI)
    ├── audit.md                ← Audit Logging (NestJS)
    ├── telegram-bot.md         ← Telegram Integration (Python)
    ├── backup.md               ← Backup Service (Bash)
    │
    └── [Infrastructure]
        └── infrastructure.md   ← DevOps & Docker
```

## 🎯 Как выбрать правильный subagent

```
Вы хотите работать с...
│
├─ Веб-интерфейсом (кнопки, формы, страницы)
│  └─→ FRONTEND subagent
│
├─ Десктопным приложением (Tkinter окна, диалоги)
│  └─→ DESKTOP-APP subagent ✨
│
├─ API endpoints, маршруты
│  ├─ Для маршрутизации, SSE, session
│  │  └─→ GATEWAY subagent
│  │
│  └─ Для бизнес-логики
│     ├─ Клиенты, сделки, платежи
│     │  └─→ CRM subagent
│     │
│     ├─ Файлы и хранилище
│     │  └─→ DOCUMENTS subagent
│     │
│     ├─ Уведомления, Telegram
│     │  └─→ NOTIFICATIONS subagent
│     │
│     ├─ Задачи и напоминания
│     │  └─→ TASKS subagent
│     │
│     ├─ Аналитика и отчёты
│     │  └─→ REPORTS subagent
│     │
│     └─ Логирование и аудит
│        └─→ AUDIT subagent
│
├─ Аутентификацией и пользователями
│  └─→ AUTH subagent
│
├─ Docker, миграциями, bootstrap
│  └─→ INFRASTRUCTURE subagent
│
├─ Telegram ботом
│  └─→ TELEGRAM-BOT subagent
│
└─ Резервными копиями
   └─→ BACKUP subagent
```

## 🔌 Интеграционные points

### RabbitMQ Event Bus
```
Events published:
- deal.created, deal.updated, deal.deleted
- deal.payment.updated, deal.payment.income.*, deal.payment.expense.*
- task.created, task.status.changed, task.reminder
- document.uploaded, document.deleted
- notification.sent
- user.created, user.updated

Consumers:
- CRM → publishes deal events
- Tasks → publishes task events
- Documents → publishes document events
- Notifications → subscribes to all
- Audit → subscribes to all
- Reports → subscribes to deal/task events
```

### SSE Streams
```
Frontend subscribes to:
- /api/v1/streams/deals      ← Real-time deal updates
- /api/v1/streams/notifications ← User notifications

Desktop App potential:
- Could subscribe to same streams in future
```

### Database Schemas
```
PostgreSQL single cluster, separate schemas:
- auth.users, auth.roles
- crm.clients, crm.deals, crm.payments
- documents.files, documents.acl
- tasks.tasks, tasks.assignments
- notifications.events
- reports.views
- audit.events
- bot.users
```

## 📊 Technology Matrix

| Язык | Субагенты | Framework | Port Manager |
|------|-----------|-----------|-------------|
| **TypeScript** | frontend, gateway, documents, notifications, tasks, audit | Next.js, NestJS | pnpm |
| **Python** | desktop-app, crm, reports, telegram-bot | Tkinter, FastAPI, aiogram | pip, Poetry |
| **Kotlin** | auth | Spring Boot | Gradle |
| **Bash/Docker** | infrastructure, backup | Docker, docker-compose | Bash scripts |

## 🚀 Typical Development Flow

### 1. Adding a new feature

```
Step 1: Define API endpoint
└─→ Use CRM/Gateway subagent

Step 2: Implement backend logic
├─→ CRM subagent (for business logic)
├─→ Database schema (Infrastructure subagent)
└─→ Event publishing (CRM subagent)

Step 3: Build frontend UI
├─→ Frontend subagent (for web)
└─→ Desktop-App subagent (for desktop)

Step 4: Add notifications
└─→ Notifications subagent

Step 5: Update tests
└─→ Specific subagent for service

Result: Feature complete across all clients
```

## 📝 Configuration Files

```
.claude/
├── INDEX.md                ← Navigation hub
├── QUICK_START.md          ← Getting started (10 min)
├── AGENTS_SUMMARY.md       ← Full reference (30 min)
├── SETUP_REPORT.md         ← What was created
├── ARCHITECTURE.md         ← This file
├── settings.local.json     ← Permissions config
│
└── agents/
    ├── README.md           ← Subagent documentation
    └── <name>.md           ← Individual subagent docs (14 total)
```

## ✨ Latest Changes

- **✨ NEW**: `desktop-app.md` subagent for Tkinter GUI development
- **Updated**: `README.md` with desktop-app references
- **Created**: `QUICK_START.md` for quick onboarding
- **Created**: `AGENTS_SUMMARY.md` for full reference
- **Created**: `INDEX.md` for navigation
- **Created**: `ARCHITECTURE.md` (this file)

## 🎯 Next Steps

1. **For Development**: Read [QUICK_START.md](./QUICK_START.md)
2. **For Reference**: Read [AGENTS_SUMMARY.md](./AGENTS_SUMMARY.md)
3. **For Specific Service**: Read agents/*.md file
4. **For Infrastructure**: Read [agents/infrastructure.md](./agents/infrastructure.md)

---

**Start here** → [INDEX.md](./INDEX.md) or [QUICK_START.md](./QUICK_START.md)
