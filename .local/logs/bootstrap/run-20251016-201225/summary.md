# Сводка bootstrap

* Старт: 2025-10-16T17:12:25Z
* Завершение: 2025-10-16T17:18:06Z
* Шагов: 16
* Итоговый статус: FAIL

| Шаг | Статус | Комментарий | Лог |
| --- | --- | --- | --- |
| Проверка зависимостей | OK | Лог: ./.local/logs/bootstrap/run-20251016-201225/steps/00__.log | ./.local/logs/bootstrap/run-20251016-201225/steps/00__.log |
| Синхронизация .env | OK | Лог: ./.local/logs/bootstrap/run-20251016-201225/steps/01__env.log | ./.local/logs/bootstrap/run-20251016-201225/steps/01__env.log |
| Проверка .env | OK | Файл найден | — |
| Проверка портов .env | FAIL | Код 1. Лог: ./.local/logs/bootstrap/run-20251016-201225/steps/03__env.log | ./.local/logs/bootstrap/run-20251016-201225/steps/03__env.log |
| docker compose up -d | FAIL | Код 1. Лог: ./.local/logs/bootstrap/run-20251016-201225/steps/04_docker_compose_up_-d.log | ./.local/logs/bootstrap/run-20251016-201225/steps/04_docker_compose_up_-d.log |
| Запуск backend-профиля | FAIL | Код 1. Лог: ./.local/logs/bootstrap/run-20251016-201225/steps/05__backend-_.log | ./.local/logs/bootstrap/run-20251016-201225/steps/05__backend-_.log |
| Smoke-проверка BACKUP_* | OK | Лог: ./.local/logs/bootstrap/run-20251016-201225/steps/06_Smoke-_BACKUP_.log | ./.local/logs/bootstrap/run-20251016-201225/steps/06_Smoke-_BACKUP_.log |
| Smoke-проверка backup без S3 | FAIL | Код 1. Лог: ./.local/logs/bootstrap/run-20251016-201225/steps/07_Smoke-_backup_S3.log | ./.local/logs/bootstrap/run-20251016-201225/steps/07_Smoke-_backup_S3.log |
| Ожидание готовности docker compose | FAIL | Код 1. Лог: ./.local/logs/bootstrap/run-20251016-201225/steps/08__docker_compose.log | ./.local/logs/bootstrap/run-20251016-201225/steps/08__docker_compose.log |
| Ожидание готовности backend-сервисов | OK | Лог: ./.local/logs/bootstrap/run-20251016-201225/steps/09__backend-_.log | ./.local/logs/bootstrap/run-20251016-201225/steps/09__backend-_.log |
| Bootstrap RabbitMQ | FAIL | Код 1. Лог: ./.local/logs/bootstrap/run-20251016-201225/steps/10_Bootstrap_RabbitMQ.log | ./.local/logs/bootstrap/run-20251016-201225/steps/10_Bootstrap_RabbitMQ.log |
| Миграции CRM/Auth | FAIL | Код 1. Лог: ./.local/logs/bootstrap/run-20251016-201225/steps/11__CRM_Auth.log | ./.local/logs/bootstrap/run-20251016-201225/steps/11__CRM_Auth.log |
| Запуск локальных backend-процессов | SKIP | флаг --with-backend не передан | — |
| Запуск фронтенда | OK | Лог: ./.local/logs/bootstrap/run-20251016-201225/steps/13__.log | ./.local/logs/bootstrap/run-20251016-201225/steps/13__.log |
| Загрузка seed-данных | FAIL | Код 1. Лог: ./.local/logs/bootstrap/run-20251016-201225/steps/14__seed-_.log | ./.local/logs/bootstrap/run-20251016-201225/steps/14__seed-_.log |
| Проверка локальной инфраструктуры | FAIL | Код 1. Лог: ./.local/logs/bootstrap/run-20251016-201225/steps/15__.log | ./.local/logs/bootstrap/run-20251016-201225/steps/15__.log |
