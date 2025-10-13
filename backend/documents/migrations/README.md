# Миграции схемы `documents`

Миграции описываются на TypeScript через TypeORM. Конфигурация подключения лежит в [`../typeorm.config.ts`](../typeorm.config.ts)
и использует переменные `DOCUMENTS_DATABASE_URL` и `DOCUMENTS_DATABASE_SCHEMA`.

## Начальные миграции

| Файл | Описание |
| --- | --- |
| `1737043200000-init-documents-table.ts` | Создаёт схему `documents`, перечисление статусов и таблицу `documents`. |
| `1738886400000-add-deleted-at-to-documents.ts` | Добавляет колонку `deleted_at` и индекс для мягкого удаления документов. |
| `1739126400000-add-uploaded-status.ts` | Добавляет статус `uploaded` в перечисление состояний документов. |

## Запуск
```bash
# Применить все миграции
npx dotenv -e ../../.env pnpm typeorm migration:run -d typeorm.config.ts

# Откатить последнюю миграцию
npx dotenv -e ../../.env pnpm typeorm migration:revert -d typeorm.config.ts
```

> Убедитесь, что переменные окружения загружены (через `dotenv` или `source .env`), иначе TypeORM не увидит подключение к PostgreSQL.
