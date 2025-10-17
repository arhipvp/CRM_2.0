# Сводка bootstrap

* Старт: 2025-10-17T19:51:00Z
* Завершение: 2025-10-17T20:21:57Z
* Шагов: 16
* Итоговый статус: FAIL

| Шаг | Статус | Комментарий | Лог |
| --- | --- | --- | --- |
| Проверка зависимостей | OK | Лог: ./.local/logs/bootstrap/run-20251017-225102/steps/00__.log | ./.local/logs/bootstrap/run-20251017-225102/steps/00__.log |
| Синхронизация .env | OK | Лог: ./.local/logs/bootstrap/run-20251017-225102/steps/01__env.log | ./.local/logs/bootstrap/run-20251017-225102/steps/01__env.log |
| Проверка .env | OK | Файл найден | — |
| Проверка портов .env | OK | Лог: ./.local/logs/bootstrap/run-20251017-225102/steps/03__env.log | ./.local/logs/bootstrap/run-20251017-225102/steps/03__env.log |
| docker compose up -d | FAIL | Код 1. Лог: ./.local/logs/bootstrap/run-20251017-225102/steps/04_docker_compose_up_-d.log | ./.local/logs/bootstrap/run-20251017-225102/steps/04_docker_compose_up_-d.log |
| Ожидание готовности docker compose | FAIL | Код 1. Лог: ./.local/logs/bootstrap/run-20251017-225102/steps/05__docker_compose.log | ./.local/logs/bootstrap/run-20251017-225102/steps/05__docker_compose.log |
| Bootstrap RabbitMQ | FAIL | Код 1. Лог: ./.local/logs/bootstrap/run-20251017-225102/steps/06_Bootstrap_RabbitMQ.log | ./.local/logs/bootstrap/run-20251017-225102/steps/06_Bootstrap_RabbitMQ.log |
| Миграции CRM/Auth | FAIL | Код 1. Лог: ./.local/logs/bootstrap/run-20251017-225102/steps/07__CRM_Auth.log | ./.local/logs/bootstrap/run-20251017-225102/steps/07__CRM_Auth.log |
| Smoke-проверка BACKUP_* | OK | Лог: ./.local/logs/bootstrap/run-20251017-225102/steps/08_Smoke-_BACKUP_.log | ./.local/logs/bootstrap/run-20251017-225102/steps/08_Smoke-_BACKUP_.log |
| Smoke-проверка backup без S3 | FAIL | Код 1. Лог: ./.local/logs/bootstrap/run-20251017-225102/steps/09_Smoke-_backup_S3.log | ./.local/logs/bootstrap/run-20251017-225102/steps/09_Smoke-_backup_S3.log |
| Запуск backend-профиля | FAIL | Код 1. Лог: ./.local/logs/bootstrap/run-20251017-225102/steps/10__backend-_.log | ./.local/logs/bootstrap/run-20251017-225102/steps/10__backend-_.log |
| Ожидание готовности backend-сервисов | OK | Лог: ./.local/logs/bootstrap/run-20251017-225102/steps/11__backend-_.log | ./.local/logs/bootstrap/run-20251017-225102/steps/11__backend-_.log |
| Запуск локальных backend-процессов | SKIP | флаг --with-backend не передан | — |
| Запуск фронтенда | OK | Лог: ./.local/logs/bootstrap/run-20251017-225102/steps/13__.log | ./.local/logs/bootstrap/run-20251017-225102/steps/13__.log |
| Загрузка seed-данных | FAIL | Код 1. Лог: ./.local/logs/bootstrap/run-20251017-225102/steps/14__seed-_.log | ./.local/logs/bootstrap/run-20251017-225102/steps/14__seed-_.log |
| Проверка локальной инфраструктуры | FAIL | Код 1. Лог: ./.local/logs/bootstrap/run-20251017-225102/steps/15__.log | ./.local/logs/bootstrap/run-20251017-225102/steps/15__.log |
