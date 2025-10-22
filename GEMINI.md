# Project Overview: CRM 2.0

This project is a comprehensive Customer Relationship Management (CRM) system designed for insurance agents. It facilitates the management of clients, insurance deals, policies, payments, documents, tasks, and notifications. The system is built with a microservices architecture, emphasizing modularity, scalability, and maintainability.

## Architecture Highlights

*   **Microservices:** Functional domains are separated into independent services with clear API contracts, orchestrated via a Gateway/BFF.
*   **Unified PostgreSQL Cluster:** Services share a single PostgreSQL cluster, achieving isolation through dedicated schemas, roles, and row-level security policies.
*   **Asynchronous Communication:** RabbitMQ is used for message queuing and publishing domain events, enabling asynchronous communication between services.
*   **Caching & Queues:** Redis serves as an in-memory cache for sessions, Celery/BullMQ queues, FSM, and rate limiting.
*   **Service Discovery:** Consul is deployed for service discovery within the microservices ecosystem.
*   **Observability:** Structured logging (Promtail/Loki), metrics (Prometheus/Grafana), and tracing (OpenTelemetry/Tempo) are implemented across services.

## Key Technologies

*   **Backend Services:**
    *   **Gateway/BFF, Documents, Notifications, Tasks:** NestJS (TypeScript, Node.js LTS)
    *   **Auth, Audit, Payments (legacy):** Spring Boot (Kotlin, JVM 17)
    *   **CRM/Deals, Reports, Telegram Bot, Backup:** FastAPI (Python 3.11)
*   **Frontend:** Next.js 15 (React 19, TypeScript)
*   **Infrastructure:** Docker Compose, Kubernetes, PostgreSQL, RabbitMQ, Redis, Consul.
*   **Build & Package Management:**
    *   Node.js services: pnpm (managed via Corepack)
    *   Kotlin services: Gradle
    *   Python services: Poetry

## Building and Running

The project provides a streamlined local development setup using Docker Compose and helper scripts.

### Quick Start (Recommended)

To set up the entire local environment, including infrastructure, migrations, and application services:

```bash
./scripts/bootstrap-local.sh
```

This script performs the following actions:
1.  Synchronizes `.env` files across services based on `env.example`.
2.  Starts infrastructure services (PostgreSQL, RabbitMQ, Redis, Consul) via Docker Compose.
3.  Configures RabbitMQ (vhosts, users).
4.  Applies database migrations for CRM, Auth, and Reports.
5.  Performs smoke checks for backup configuration.
6.  Starts backend application services (Gateway, Auth, CRM, Documents, Notifications, Tasks) via Docker Compose.
7.  Optionally starts backend services directly on the host (`--with-backend` flag).
8.  Starts the frontend application via Docker Compose.
9.  Loads seed data if `scripts/load-seeds.sh` exists.
10. Runs a comprehensive smoke check of the local infrastructure and backend API endpoints.

### Manual Setup (Fallback/Advanced)

For granular control or debugging, individual steps can be performed:

1.  **Prepare `.env` files:**
    ```bash
    ./scripts/sync-env.sh
    ```
    Review and update secrets (`*_PASSWORD`, `*_SECRET`, `*_TOKEN`, `*_API_KEY`) and connection parameters in the root `.env` and service-specific `.env` files.

2.  **Start Infrastructure:**
    ```bash
    cd infra
    docker compose up -d
    ```
    Verify status: `docker compose ps`.

3.  **Configure RabbitMQ:**
    ```bash
    bash infra/rabbitmq/bootstrap.sh .env
    ```

4.  **Load Seed Data (Optional):**
    ```bash
    ./scripts/load-seeds.sh
    ```

5.  **Run Migrations:**
    ```bash
    ./scripts/migrate-local.sh
    ```
    Or for specific services:
    *   **CRM:** `cd backend/crm && poetry run alembic upgrade head`
    *   **Auth:** `cd backend/auth && ./gradlew update`
    *   **Documents:** `cd backend/documents && pnpm typeorm migration:run -d typeorm.config.ts`
    *   **Tasks:** `cd backend/tasks && pnpm migration:run`

6.  **Start Individual Services (on host):**
    *   **Gateway:** `cd backend/gateway && pnpm install && pnpm start:dev`
    *   **Auth:** `cd backend/auth && ./gradlew bootRun`
    *   **CRM API:** `cd backend/crm && poetry install && poetry run crm-api`
    *   **CRM Worker:** `cd backend/crm && poetry run crm-worker worker -l info`
    *   **Frontend:** `cd frontend && pnpm install && pnpm dev`

### Cleaning Up

To remove all Docker containers, volumes, and local data:

```bash
cd infra
docker compose down -v
rm -rf pgdata redis_data minio_data postgres/data rabbitmq/data */data
```

## Development Conventions

*   **CI/CD:** GitHub Actions have been removed. Local or alternative CI/CD solutions are expected. Recommended local check order: `lint` → `unit-tests` → `contract-tests` → `build`.
*   **Environment Variables:** Critical for configuration. Use `scripts/sync-env.sh` to manage `.env` files. Secrets must not be committed to the repository.
*   **Testing:**
    *   **Frontend:** Vitest + React Testing Library (unit/component), Storybook Chromatic (visual snapshots), Playwright (E2E).
    *   **Spring Boot Services:** JUnit5 + Testcontainers.
    *   **FastAPI Services:** Pytest + async integrations.
*   **Code Style:** Not explicitly defined in the provided documents, but linters are expected to be part of the CI/CD process. Adherence to idiomatic practices for each language/framework is implied.
*   **Logging & Monitoring:** Logs are collected via Promtail to Loki. Metrics are gathered by Prometheus and visualized in Grafana. Tracing is implemented using OpenTelemetry and Tempo.
*   **Package Managers:** `pnpm` for Node.js projects, `Gradle` for Kotlin projects, `Poetry` for Python projects. Ensure `Corepack` is enabled for `pnpm`.

## Requirements

*   Docker Desktop/Engine with Compose V2.
*   Python 3 (interpreter `python3`).
*   Poetry (for Python services).
*   JDK 17+ (for Gradle wrapper in Auth service).
*   Node.js 20 LTS (for frontend and NestJS services).
    *   `corepack enable`
    *   `corepack prepare pnpm@9 --activate`
*   Optional CLI tools: `psql`, `redis-cli`, `curl`.
