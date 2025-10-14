# Миграции схемы `audit`

## Структура

- `db/changelog/db.changelog-master.yaml` — точка входа Liquibase, подключается как ресурс Gradle/Spring Boot.
- `db/changelog/0001-initial-schema.yaml` — включает `pgcrypto`, создаёт схему `audit` и таблицу `audit_events` с индексами и уникальным ограничением для дедупликации.
- `db/changelog/0006-add-message-id.yaml` — добавляет колонку `message_id` и частичный уникальный индекс для идемпотентности на уровне RabbitMQ message id.

## Порядок применения

```bash
cd backend/audit
gradle update
```

Команда читает переменные `AUDIT_JDBC_URL`, `AUDIT_DB_USER`, `AUDIT_DB_PASSWORD` (см. `env.example`). При отсутствии явных значений используется локальный профиль (`jdbc:postgresql://localhost:5432/crm?currentSchema=audit`).

## Правила версионирования

- ID changeSet'ов ведём последовательно (`0001`, `0002`, ...), имя файла отражает ключевое изменение.
- Перед добавлением партиций обновляйте документацию и автоматизацию ротации в `infra/`.
- Все изменения схемы отражайте в `docs/security-and-access.md` — аудит влияет на требования комплаенса.
