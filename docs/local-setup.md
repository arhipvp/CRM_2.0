# Локальная инфраструктура: пошаговая инструкция

Эта инструкция покрывает подготовку переменных окружения, запуск Docker Compose и базовую проверку вспомогательных сервисов, необходимых для разработки CRM.

## 1. Подготовьте `.env`

1. Скопируйте шаблон: `cp env.example .env`.
2. Обновите в `.env` чувствительные значения:
   - Пароли PostgreSQL (общий `POSTGRES_PASSWORD` и пароли ролей `*_DB_PASSWORD`).
   - Учётные данные RabbitMQ (`RABBITMQ_DEFAULT_USER`, `RABBITMQ_DEFAULT_PASS`).
   - Секреты JWT (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`).
   - SMTP-параметры для тестовой отправки почты (если не используете MailHog — укажите реальные значения).
   - Интеграционные токены (Google Drive, Telegram Bot и т.д.), если планируете проверки соответствующих сервисов.
3. Убедитесь, что переменные портов (`POSTGRES_PORT`, `RABBITMQ_PORT`, `REDIS_PORT`, `CONSUL_*`, `PGADMIN_PORT`, `MAILHOG_*`) не конфликтуют с уже занятыми на вашей машине.

## 2. Запустите инфраструктурные контейнеры

1. Перейдите в директорию `infra`: `cd infra`.
2. Поднимите сервисы: `docker compose up -d`.
3. Проверьте статус: `docker compose ps` — все контейнеры должны находиться в состоянии `Up` или `healthy`.
4. Для завершения работы выполните `docker compose down` (с флагом `-v`, если нужно очистить данные).

## 3. Проверьте создание схем и ролей PostgreSQL

Скрипт `infra/postgres/init.sh` автоматически создаёт схемы и роли, указанные в `.env`. Чтобы убедиться, что всё применилось:

```bash
docker compose exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\dn"
```

В выводе должны присутствовать схемы `auth`, `crm`, `payments`, `documents`, `tasks`, `notifications`, `audit`, `backup`.

## 4. Проверка доступности сервисов

| Сервис         | Проверка                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------ |
| PostgreSQL     | `psql postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:$POSTGRES_PORT/$POSTGRES_DB -c "SELECT 1"` |
| RabbitMQ       | Откройте [http://localhost:${RABBITMQ_MANAGEMENT_PORT}](http://localhost:${RABBITMQ_MANAGEMENT_PORT}) и авторизуйтесь указанными учётными данными. |
| Redis          | `redis-cli -u $REDIS_URL ping` (должен вернуть `PONG`).                                           |
| Consul         | Откройте веб-интерфейс [http://localhost:${CONSUL_HTTP_PORT}](http://localhost:${CONSUL_HTTP_PORT}). |
| pgAdmin        | Откройте [http://localhost:${PGADMIN_PORT}](http://localhost:${PGADMIN_PORT}), авторизуйтесь и добавьте подключение к `postgres`. |
| MailHog        | UI доступен по адресу [http://localhost:${MAILHOG_HTTP_PORT}](http://localhost:${MAILHOG_HTTP_PORT}), SMTP — `smtp://localhost:${MAILHOG_SMTP_PORT}`. |

## 5. Подключение приложений

После запуска инфраструктуры сервисы и приложения могут использовать значения из `.env`. Примеры:

- Backend сервисы используют URI `*_DATABASE_URL`, `RABBITMQ_URL`, `REDIS_*`, `CONSUL_HTTP_ADDR`.
- Фронтенд считывает публичные переменные `NEXT_PUBLIC_*`.
- Для фоновых заданий и уведомлений доступны очереди RabbitMQ, Redis и почтовый сервер MailHog.

## 6. Очистка состояния

Если нужно полностью пересоздать окружение (например, после изменений схем):

```bash
cd infra
docker compose down -v
rm -rf ../backups/postgres
```

После этого повторите шаги с запуска инфраструктуры.

> ⚠️ **Важно.** Локальные пароли и секреты в `.env` предназначены только для разработки. Никогда не коммитьте файл `.env` в репозиторий и не переиспользуйте эти значения в боевых средах.
