# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a microservices-based CRM system for insurance agents managing long-term insurance deals, clients, policies, payments, and related documents. The system is built with a polyglot microservices architecture using TypeScript (NestJS, Next.js), Kotlin (Spring Boot), and Python (FastAPI, aiogram).

**Key Architecture Principles:**
- Microservices with shared PostgreSQL cluster (separate schemas per service)
- Asynchronous communication via RabbitMQ event bus
- Gateway/BFF as single entry point for all external clients
- Server-side file storage (no cloud storage dependencies)
- RBAC-based access control managed by Auth service

## Development Commands

### Quick Start
```bash
# Bootstrap entire local environment (infrastructure + backend + frontend)
./scripts/bootstrap-local.sh

# Bootstrap with backend running on host (not in Docker)
./scripts/bootstrap-local.sh --with-backend

# Bootstrap infrastructure only (skip backend services)
./scripts/bootstrap-local.sh --skip-backend

# Bootstrap without frontend
./scripts/bootstrap-local.sh --skip-frontend

# Start specific backend services on host
./scripts/start-backend.sh --service gateway,crm-api

# Stop backend services running on host
./scripts/stop-backend.sh
```

### Environment Setup
```bash
# Synchronize .env files from env.example (interactive mode)
./scripts/sync-env.sh

# Non-interactive mode (skip existing files)
./scripts/sync-env.sh --non-interactive

# Force overwrite existing .env files
./scripts/sync-env.sh --non-interactive=overwrite
```

### Database Migrations
```bash
# Run all migrations (CRM, Auth, Audit, Reports)
./scripts/migrate-local.sh

# CRM migrations (Alembic)
cd backend/crm
poetry run alembic upgrade head

# Auth migrations (Liquibase)
cd backend/auth
./gradlew update

# Reports migrations (SQL)
cd backend/reports
psql $REPORTS_DATABASE_URL -f migrations/001_init.sql
```

### Service-Specific Commands

**Gateway (NestJS + pnpm):**
```bash
cd backend/gateway
pnpm install
pnpm test
pnpm build
pnpm start:dev
pnpm start:prod
```

**Auth (Spring Boot + Gradle):**
```bash
cd backend/auth
./gradlew build
./gradlew test
./gradlew bootRun
```

**CRM/Deals (FastAPI + Poetry + Celery):**
```bash
cd backend/crm
poetry install --sync --no-root
poetry run pytest
poetry run crm-api                    # Start API server
poetry run crm-worker worker -l info  # Start Celery worker
```

**Documents, Notifications, Tasks (NestJS + pnpm):**
```bash
cd backend/<service>
pnpm install
pnpm test
pnpm start:dev
pnpm start:workers  # For services with background workers
```

**Telegram Bot (Python + Poetry):**
```bash
cd backend/telegram-bot
poetry install
poetry run pytest
poetry run bot
```

**Reports (FastAPI + Poetry):**
```bash
cd backend/reports
poetry install
poetry run reports-api
poetry run reports-refresh-views
```

**Frontend (Next.js + pnpm):**
```bash
cd frontend
pnpm install
pnpm dev
pnpm build
pnpm start
pnpm test
```

### Infrastructure Checks
```bash
# Verify infrastructure health
./scripts/check-local-infra.sh

# Load seed data
./scripts/load-seeds.sh
```

## Architecture Highlights

### Service Responsibilities

1. **Gateway/BFF** (port 8080): Single entry point, session management, request orchestration, SSE stream proxying
2. **Auth** (port 8081): User/role management, OAuth/OIDC flows, JWT token issuance
3. **CRM/Deals** (port 8082): Clients, deals, quotes, policies, payments (incomes/expenses), deal journals
4. **Documents** (port 8084): File metadata management, server-side storage integration, POSIX ACL management
5. **Notifications** (port 8085): Event-driven notifications, SSE streams, Telegram integration
6. **Tasks** (port 8086): Task planning and execution, delayed reminders (SLA features planned for v1.1)
7. **Telegram Bot** (port 8089): User notifications, quick deal creation, task confirmations
8. **Reports** (port 8087): Materialized views, aggregated analytics from CRM/Audit
9. **Audit** (port 8088): Centralized action logging, event archival
10. **Backup**: Automated PostgreSQL/Redis/RabbitMQ/Consul backups to S3-compatible storage

### Payment Module Architecture

**IMPORTANT:** There is NO separate Payments service. Payment logic is embedded in CRM/Deals service.

- Base payment records: `crm.payments` table (aggregate totals, dates, user confirmations)
- Income line items: `crm.payment_incomes` (premiums, commission receipts)
- Expense line items: `crm.payment_expenses` (client discounts, colleague payouts)
- Events published: `deal.payment.updated`, `deal.payment.income.*`, `deal.payment.expense.*`
- All accessed via CRM REST API (`/api/v1/deals/{id}/payments`)

### Database Schema Organization

All services share a single PostgreSQL cluster with separate schemas:
- `auth`: User accounts, roles, OAuth tokens
- `crm`: Clients, deals, quotes, policies, payments (base + incomes + expenses), journals
- `documents`: File metadata, folder structures, ACL mappings
- `tasks`: Task definitions, assignments, status tracking
- `notifications`: Notification events, delivery templates
- `reports`: Materialized views, aggregated metrics
- `audit`: Event logs (partitioned by month), user actions
- `bot`: Telegram user mappings, FSM state

**Connection String Pattern:**
- R2DBC (Kotlin services): `r2dbc:postgresql://user:pass@host:port/crm?schema=<schema_name>`
- asyncpg (Python services): `postgresql://user:pass@host:port/crm?search_path=<schema_name>`
- JDBC (if needed): `jdbc:postgresql://host:port/crm?currentSchema=<schema_name>`

### RabbitMQ Event Bus

**Key Exchanges:**
- `crm.events`: Domain events from CRM (`deal.created`, `deal.updated`, `deal.payment.*`)
- `tasks.events`: Task lifecycle events (`task.created`, `task.status.changed`, `task.reminder`)
- `notifications.events`: Notification delivery events
- `audit.events`: Critical system events for audit trail
- `backup.notifications`: Backup job status updates

**Event Format:** CloudEvents specification with JSON payload

### SSE Streams

Gateway proxies two SSE channels:
- `/api/v1/streams/deals`: Real-time deal updates from CRM
- `/api/v1/streams/notifications`: User notifications from Notifications service

Frontend opens both channels and uses React Query for state synchronization.

## Key Technical Details

### Package Managers
- **Node.js services**: pnpm v9 (enforced via Corepack)
- **Python services**: Poetry (never use pip directly)
- **Java services**: Gradle wrapper (included in repo)

### Port Conflicts
If `bootstrap-local.sh` fails with port conflicts, edit `.env` to change `POSTGRES_PORT`, `REDIS_PORT`, etc. The bootstrap script validates port availability before starting containers.

### Backend Execution Modes

**Option 1: Run in Docker (default)**
```bash
./scripts/bootstrap-local.sh
# Services run in containers via docker-compose
```

**Option 2: Run on host machine**
```bash
./scripts/bootstrap-local.sh --with-backend
# Infrastructure in Docker, backend services on host
# Useful for debugging, hot reloading, IDE integration
```

**Option 3: Selective services**
```bash
./scripts/start-backend.sh --service gateway,crm-api
# Start only specified services on host
```

### Logs and Artifacts

Bootstrap logs are saved to `.local/logs/bootstrap/run-<timestamp>/`:
- `steps/<NN>_<step-name>.log`: Individual step logs
- `summary.md`: Human-readable status table
- `summary.json`: Machine-readable status
- `tmp/`: Temporary artifacts

Backend service logs (when using `--with-backend`):
- PIDs: `.local/run/backend/pids/`
- Logs: `.local/run/backend/logs/`
- Startup log: `.local/run/backend/start-backend.log`

### Python Interpreter Detection

Bootstrap and infrastructure scripts auto-detect Python in this order:
`python3`, `python`, `python3.12`, `python3.11`, `python3.10`, `python3.9`, `python3.8`, `py -3`, `py -3.12`, `py -3.11`, `py -3.10`, `py -3.9`

Works in Git Bash (Windows), Linux, and macOS without modification.

### Documents Storage

Documents service uses **server-side file storage** (not Google Drive):
- Root path: `DOCUMENTS_STORAGE_ROOT` environment variable
- Structure: `Client/Deal/Policy/*.pdf`
- Access control: POSIX ACL via `setfacl`/`getfacl` commands
- Requires system utilities: `acl`, `attr`, `rsync`/`restic` (for backups)
- Metadata stored in PostgreSQL `documents` schema

### Frontend Configuration

Frontend requires `NEXT_PUBLIC_API_BASE_URL` pointing to Gateway:
- Local dev: `http://localhost:8080/api/v1`
- Stage/prod: Set via Kubernetes ConfigMap overlays
- **No mock mode**: Frontend always requires live backend

### Telegram Integration

Bot receives updates via HTTPS webhook terminated at Gateway:
- Gateway validates HMAC signature (`X-Telegram-Signature` header)
- Proxies to `backend/telegram-bot` service
- Bot uses Redis for FSM state and rate limiting
- Publishes events to `crm.events` and `tasks.events` exchanges

## Common Workflows

### Adding a New Service

1. Create service directory in `backend/<service-name>`
2. Add database user/password to `env.example`
3. Add schema name and connection URL to `env.example`
4. Create migrations in `backend/<service-name>/migrations/`
5. Update `scripts/migrate-local.sh` to include new migrations
6. Add service to `infra/docker-compose.yml` (backend profile)
7. Update `scripts/start-backend.sh` if service should run on host
8. Document in `backend/<service-name>/README.md`

### Modifying Payment Logic

**Remember:** Payments are part of CRM service, not a separate service.

1. Modify tables in `backend/crm/migrations/` (Alembic):
   - `crm.payments`: Base payment records
   - `crm.payment_incomes`: Income line items
   - `crm.payment_expenses`: Expense line items
2. Update SQLAlchemy models in `backend/crm/app/models/`
3. Update business logic in `backend/crm/app/services/payments/`
4. Ensure events are published: `deal.payment.updated`, `deal.payment.income.*`, `deal.payment.expense.*`
5. Update CRM API endpoints in `backend/crm/app/api/`
6. Update frontend components consuming payment data

### Adding a New Event Type

1. Define event schema in `docs/integration-events.md`
2. Publish event in originating service (CRM, Tasks, etc.)
3. Update consumers (Notifications, Audit, Reports) to handle new event
4. Add routing keys to RabbitMQ bootstrap script if needed
5. Update `docs/api/streams.md` if event flows to SSE streams

### Running Tests

**Gateway:**
```bash
cd backend/gateway
pnpm test           # Unit tests
pnpm test:e2e       # E2E tests
pnpm test:cov       # Coverage report
```

**Auth:**
```bash
cd backend/auth
./gradlew test
./gradlew integrationTest  # With Testcontainers
```

**CRM:**
```bash
cd backend/crm
poetry run pytest
poetry run pytest --cov=app tests/  # With coverage
```

**Frontend:**
```bash
cd frontend
pnpm test           # Vitest unit tests
pnpm test:e2e       # Playwright E2E tests
```

## Critical Configuration

### Environment Variables

Always sync `.env` files after pulling changes:
```bash
./scripts/sync-env.sh
```

Core variables (see `env.example` for full list):
- `DATABASE_URL`: Admin connection for migrations
- `<SERVICE>_DATABASE_URL`: Per-service connection strings
- `RABBITMQ_DEFAULT_USER`, `RABBITMQ_DEFAULT_PASS`: RabbitMQ credentials
- `REDIS_HOST`, `REDIS_PORT`: Redis connection
- `AUTH_JWT_SECRET`: JWT signing key (rotate in production)
- `DOCUMENTS_STORAGE_ROOT`: File storage root directory
- `BACKUP_S3_*`: S3-compatible backup storage (optional for local dev)

### Password Synchronization

`bootstrap-local.sh` automatically syncs PostgreSQL role passwords from `.env` on every run. After updating passwords in `.env`, just re-run bootstrap.

### RabbitMQ Setup

RabbitMQ users/vhosts are auto-created by `infra/rabbitmq/bootstrap.sh` based on `*_RABBITMQ_URL` environment variables. Add new services by defining their AMQP URL in `env.example`.

## Documentation Structure

- `docs/architecture.md`: Service interactions, data flows, mermaid diagrams
- `docs/tech-stack.md`: Technology choices, infrastructure details
- `docs/api/`: REST API specifications, SSE stream formats
- `docs/integration-events.md`: RabbitMQ event schemas (CloudEvents)
- `docs/data-model.md`: Database ER diagrams, table definitions
- `docs/delivery-plan.md`: Release planning, feature prioritization
- `docs/local-setup.md`: Detailed setup instructions, port mappings
- `docs/testing-data.md`: Seed data procedures, test fixtures
- `docs/security-and-access.md`: RBAC model, access control policies
- `backend/<service>/README.md`: Service-specific setup and commands
- `backups/README.md`: Backup procedures and artifacts

## Known Limitations

- GitHub Actions removed: No automated CI/CD pipelines in repo
- Manual testing required before deployment
- Audit service: Basic structure present, full implementation pending
- Tasks service: SLA and recurring tasks planned for v1.1
- Reports service: Materialized view refresh is manual via CLI
