# Claude Code конфигурация - Индекс

## Структура документации

```
.claude/
├── INDEX.md                    ← Вы здесь (навигация)
├── QUICK_START.md              ← Начните отсюда (10 минут)
├── AGENTS_SUMMARY.md           ← Полная справка по субагентам (30 минут)
├── SETUP_REPORT.md             ← Отчёт о конфигурации
├── settings.local.json         ← Конфигурация разрешений (JSON)
│
└── agents/                      ← Документация каждого субагента
    ├── README.md               ← Общая информация о субагентах
    ├── audit.md                ← Audit сервис
    ├── auth.md                 ← Auth сервис (Spring Boot/Kotlin)
    ├── backup.md               ← Backup сервис
    ├── crm.md                  ← CRM/Deals сервис (FastAPI/Python)
    ├── desktop-app.md          ← Desktop приложение ✨ НОВЫЙ
    ├── documents.md            ← Documents сервис (NestJS)
    ├── frontend.md             ← Frontend веб-приложение (Next.js)
    ├── gateway.md              ← API Gateway/BFF (NestJS)
    ├── infrastructure.md       ← DevOps и инфраструктура
    ├── notifications.md        ← Notifications сервис (NestJS)
    ├── reports.md              ← Reports сервис (FastAPI/Python)
    ├── tasks.md                ← Tasks сервис (NestJS)
    └── telegram-bot.md         ← Telegram Bot (Python/aiogram)
```

## Быстрая навигация

### 🎯 Новичкам - начните здесь

1. **[QUICK_START.md](./QUICK_START.md)** (10 мин)
   - Что такое субагенты
   - 5 самых полезных субагентов
   - Как заставить субагента помочь
   - Примеры запросов

2. **[agents/README.md](./agents/README.md)** (20 мин)
   - Полное описание каждого субагента
   - Примеры использования
   - Как добавить новый субагент

### 📖 Для полного понимания

1. **[AGENTS_SUMMARY.md](./AGENTS_SUMMARY.md)** (30 мин)
   - Обзор всех 14 субагентов
   - Таблица с технологиями
   - Примеры разных сценариев
   - Troubleshooting

2. **[SETUP_REPORT.md](./SETUP_REPORT.md)** (15 мин)
   - Что было создано
   - Статистика по файлам
   - Рекомендации на будущее

### 🛠️ Для работы с конкретным компонентом

| Компонент | Субагент | Файл |
|-----------|----------|------|
| Веб-интерфейс | frontend | [agents/frontend.md](./agents/frontend.md) |
| Десктопное приложение | desktop-app | [agents/desktop-app.md](./agents/desktop-app.md) ✨ |
| API Gateway | gateway | [agents/gateway.md](./agents/gateway.md) |
| Аутентификация | auth | [agents/auth.md](./agents/auth.md) |
| Бизнес-логика | crm | [agents/crm.md](./agents/crm.md) |
| Файлы | documents | [agents/documents.md](./agents/documents.md) |
| Уведомления | notifications | [agents/notifications.md](./agents/notifications.md) |
| Задачи | tasks | [agents/tasks.md](./agents/tasks.md) |
| Отчёты | reports | [agents/reports.md](./agents/reports.md) |
| Логирование | audit | [agents/audit.md](./agents/audit.md) |
| Telegram бот | telegram-bot | [agents/telegram-bot.md](./agents/telegram-bot.md) |
| Резервные копии | backup | [agents/backup.md](./agents/backup.md) |
| Инфраструктура | infrastructure | [agents/infrastructure.md](./agents/infrastructure.md) |

## Типичные задачи

### "Нужно добавить функцию в десктоп приложение"
1. Читай: [QUICK_START.md](./QUICK_START.md) → раздел "Desktop App"
2. Читай: [agents/desktop-app.md](./agents/desktop-app.md)
3. Скажи Claude: "Добавь форму для сделок в desktop_app/main.py"

### "Фронтенд не работает"
1. Читай: [QUICK_START.md](./QUICK_START.md) → раздел "Frontend"
2. Читай: [agents/frontend.md](./agents/frontend.md)
3. Скажи Claude: "Помоги разобраться с ошибкой в frontend/src/..."

### "Нужен новый API endpoint"
1. Читай: [QUICK_START.md](./QUICK_START.md) → раздел "CRM"
2. Читай: [agents/gateway.md](./agents/gateway.md) или [agents/crm.md](./agents/crm.md)
3. Скажи Claude: "Добавь endpoint для... в CRM API"

### "Проблемы с docker-compose или миграциями"
1. Читай: [agents/infrastructure.md](./agents/infrastructure.md)
2. Скажи Claude: "Помоги с bootstrap, ошибка в миграциях"

## Команды Claude Code

```bash
# Список всех субагентов
/agents

# Получить справку
/help

# Увидеть текущий контекст
/context

# Очистить сессию
/clear
```

## Главные документы проекта

- **[../CLAUDE.md](../CLAUDE.md)** — основная документация проекта (обязательно читать!)
- **[../DEPLOYMENT_NOTES.md](../DEPLOYMENT_NOTES.md)** — информация о развёртывании
- **[../docs/](../docs/)** — дополнительная документация (API, архитектура, и т.д.)

## Полезные команды для разработки

```bash
# Запустить весь проект с infrastructure субагентом
./scripts/bootstrap-local.sh

# Запустить только фронтенд
cd frontend && pnpm dev

# Запустить десктопное приложение
cd desktop_app && python main.py

# Синхронизировать переменные окружения
./scripts/sync-env.sh

# Запустить миграции
./scripts/migrate-local.sh
```

## Структура субагентов (frontmatter)

Каждый субагент имеет YAML frontmatter:
```yaml
---
name: имя_субагента
description: Краткое описание
tools: Read, Write, Edit, Glob, Grep, Bash
model: inherit
color: "#HEX_COLOR"
---
```

## Как добавить новый субагент

1. Создайте файл `.claude/agents/my-service.md`
2. Скопируйте структуру из существующего субагента
3. Заполните все секции (см. [agents/desktop-app.md](./agents/desktop-app.md) как пример)
4. Обновите этот INDEX.md
5. Обновите [agents/README.md](./agents/README.md)
6. Обновите [AGENTS_SUMMARY.md](./AGENTS_SUMMARY.md)

## FAQ - Часто задаваемые вопросы

**В: Какой субагент мне нужен?**
О: Смотри таблицу выше или прочитай QUICK_START.md

**В: Как Claude выбирает субагента?**
О: Автоматически по имени файла/сервиса или явно по имени субагента

**В: Могу ли я работать с несколькими субагентами?**
О: Да! Claude автоматически координирует работу нескольких субагентов

**В: Где найти помощь?**
О: 1) Читай документацию выше, 2) `/help` в Claude Code, 3) Check CLAUDE.md

## Версия конфигурации

- **Версия**: 1.0
- **Дата обновления**: 2024-10-23
- **Субагентов**: 14 (13 микросервисов + 1 десктопное приложение)
- **Документация**: 100% покрыта

## Статус

✅ Все субагенты настроены и готовы к использованию
✅ Документация полная и актуальная
✅ Примеры и сценарии использования
✅ Troubleshooting и FAQ включены

**Статус**: ГОТОВО К ИСПОЛЬЗОВАНИЮ 🚀

## Быстрые ссылки

| Назначение | Документ | Время чтения |
|-----------|----------|-------------|
| Новичок | [QUICK_START.md](./QUICK_START.md) | 10 мин |
| Справка | [AGENTS_SUMMARY.md](./AGENTS_SUMMARY.md) | 30 мин |
| Полная инфо | [agents/README.md](./agents/README.md) | 20 мин |
| Специфика | [agents/*/md](./agents/) | 15 мин каждый |
| Отчёт | [SETUP_REPORT.md](./SETUP_REPORT.md) | 15 мин |

---

**Начните с** → [QUICK_START.md](./QUICK_START.md)
