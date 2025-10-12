# Broker CRM (skeleton)

Минимальная «пустая» структура для старта:
- `backend/` — сервисы (gateway, auth, crm, tasks, documents, payments, notifications, reports, audit)
- `frontend/app/` — будущая SPA
- `infra/` — инфраструктура (docker-compose, env-примеры, rclone конфиг пример)
- `backups/` — скрипты бэкапа (позже добавим)
- `docs/` — документы проекта

Шаги:
1) `cd infra && docker compose up -d` (после заполнения `infra/.env`)
2) Разворачивай backend и frontend по модулям.
