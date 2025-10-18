# Payments Service (архив)

> ⚠️ Каталог `backend/payments` сохранён только для истории. Отдельный сервис платежей больше не входит в целевую архитектуру и не разворачивается в окружениях.

## Статус
- исходный Spring Boot-проект не поддерживается и не обновляется;
- шаблон окружения снова содержит только `PAYMENTS_RABBITMQ_URL` и `PAYMENTS_RABBITMQ_INTERNAL_URL`, чтобы легаси-приложение могло подписываться на очереди; остальные `PAYMENTS_*` по-прежнему считаются устаревшими и не синхронизируются автоматически;
- миграции Flyway и конфигурация очередей описывают прежнюю схему `payments` и нужны только для анализа наследия.

## Где искать актуальную реализацию платежей
Модуль платежей перенесён в CRM/Deals и работает поверх таблиц `crm.payments`, `crm.payment_incomes`, `crm.payment_expenses`. Используйте документацию и REST API, описанные в [`backend/crm/README.md`](../crm/README.md) и [`docs/api/crm-deals.md`](../../docs/api/crm-deals.md).

## Что можно найти в архиве
- историческую документацию по API (`docs/api/payments.md`),
- старые конфигурации Spring Cloud Stream (`src/main/resources/application*.yml`),
- пример миграций Flyway для схемы `payments` (`migrations/`).
- примеры подключения к RabbitMQ с использованием переменных `PAYMENTS_RABBITMQ_URL` (localhost) и `PAYMENTS_RABBITMQ_INTERNAL_URL` (docker-сеть), синхронизированные с `env.example` и `infra/docker-compose.yml`.

Эти материалы помогают при анализе миграции данных или восстановлении контекста предыдущих интеграций.

## Docker Compose и переменные окружения

В `infra/docker-compose.yml` добавлен сервис `payments` под профилем `legacy`. Он использует общий образ Spring Boot (`infra/docker/spring-boot-service.Dockerfile`) и автоматически получает `PAYMENTS_RABBITMQ_URL` из `.env`. Остальные параметры (`PAYMENTS_DATABASE_URL`, `PAYMENTS_DB_USER` и т.д.) остаются опциональными и должны задаваться вручную при необходимости — шаблон окружения их не восстанавливает.
