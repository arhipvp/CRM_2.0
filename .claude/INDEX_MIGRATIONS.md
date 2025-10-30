# Индекс документов по миграциям CRM 2.0

## Созданные документы

### 1. MIGRATIONS_STRUCTURE.md (1.9 KB)
**Краткая сводка по структуре всех миграций**

Содержит:
- По одному разделу на каждый сервис
- Расположение директорий миграций
- Количество миграций
- Основные команды запуска

Используй этот файл для: быстрого понимания структуры

---

### 2. MIGRATIONS_SUMMARY.md (4.6 KB)
**Полный справочник с примерами команд**

Содержит:
- Раздел "Быстрый справочник" с командами для каждого сервиса
- Статистическую таблицу миграций
- Ключевые файлы миграций
- Переменные окружения для каждого сервиса
- Таблицы версионирования
- Порядок выполнения в bootstrap скрипте
- Инструкции по созданию новых миграций

Используй этот файл для: поиска конкретных команд и инструкций

---

### 3. MIGRATIONS_DETAILED.md (4.2 KB)
**Детальный анализ с подробным описанием**

Содержит:
- Полные структуры директорий каждого сервиса
- Описание каждой миграции CRM (18 штук)
- Конфигурационные файлы (env.py, build.gradle, typeorm.config.ts)
- Все доступные команды для каждого инструмента
- Таблица сравнения по основным параметрам
- Примеры для разработки

Используй этот файл для: понимания внутренних деталей и конфигурации

---

## Структура миграций по сервисам

### CRM (Python/Alembic)
```
backend/crm/migrations/
├── 18 миграций в versions/
├── env.py - конфигурация Alembic
├── script.py.mako - шаблон
└── README.md - документация
```
Команда: `poetry run alembic upgrade head`

### Auth (Spring Boot/Liquibase)
```
backend/auth/migrations/
├── 1 changeset (0001-init-auth-tables.yaml)
├── db/changelog/db.changelog-master.yaml
└── build.gradle - конфигурация
```
Команда: `./gradlew update`

### Documents (Node.js/TypeORM)
```
backend/documents/
├── 6 миграций в migrations/
├── typeorm.config.ts - конфигурация
└── package.json - скрипты
```
Команда: `npx typeorm migration:run -d typeorm.config.ts`

### Reports (Python/SQL)
```
backend/reports/migrations/
├── 1 SQL миграция (001_create_deal_pipeline_summary.sql)
└── Параметризованные запросы
```
Команда: `psql ... -f 001_create_deal_pipeline_summary.sql`

---

## Главный bootstrap скрипт

**Файл**: `scripts/migrate-local.sh`

**Порядок выполнения**:
1. Auth (обязательно)
2. CRM (с повторами 10x)
3. Reports (graceful skip)

**Требует**: Файл `.env` с переменными DATABASE_URL

---

## Ключевые числа

| Параметр | Значение |
|----------|----------|
| Total миграций | 26 (18+1+6+1) |
| Сервисов | 4 |
| Инструментов | 4 (Alembic, Liquibase, TypeORM, SQL) |
| Таблиц версий | 3 (Reports не имеет) |
| Последняя миграция | 2025102604_migrate_crm_tasks_to_tasks_schema.py |
| Дата последней | 30.10.2025 |

---

## Быстрые команды

```bash
# Применить все миграции
./scripts/migrate-local.sh

# Проверить статус CRM
cd backend/crm && poetry run alembic current

# Отследить все миграции
cd backend/crm && poetry run alembic history --verbose
```

---

## Требуемые переменные .env

```bash
CRM_DATABASE_URL=postgresql://crm:password@localhost:5432/crm
AUTH_DATABASE_URL=r2dbc:postgresql://auth:password@localhost:5432/crm?schema=auth
REPORTS_DATABASE_URL=postgresql://reports:password@localhost:5432/crm
REPORTS_SCHEMA=reports
REPORTS_CRM_SCHEMA=crm
```

---

## Дополнительная информация

- **Основной README**: `backend/crm/README.md`, `backend/auth/README.md`, и т.д.
- **Bootstrap скрипт**: `scripts/migrate-local.sh` (95 строк, с хорошей документацией)
- **Версия проекта**: Дата анализа 30.10.2025

---

**Создано**: 30.10.2025
**Анализ проведён**: Полный анализ всех сервисов CRM 2.0
