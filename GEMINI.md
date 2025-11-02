# Gemini Code Assistant Context

This document provides context for the Gemini Code Assistant to understand the project structure, technologies, and conventions.

## Project Overview

This is a CRM system for insurance agents, built with a microservices architecture. The system helps agents manage clients, deals, policies, payments, and documents.

### Architecture

The system is composed of the following services:

*   **Gateway/BFF:** A NestJS-based service that acts as a single entry point for all client applications.
*   **Auth:** A Spring Boot/Kotlin service responsible for user authentication and authorization.
*   **CRM/Deals:** A FastAPI/Python service that manages clients, deals, policies, and tasks.
*   **Documents:** A NestJS service for managing documents in a server-side file store.
*   **Telegram Bot:** A FastAPI/Python service that provides a Telegram bot interface for the CRM.
*   **Reports:** A FastAPI/Python service for generating reports.
*   **Backup:** A Python service for backing up databases and configurations.

### Technologies

*   **Backend:**
    *   **Gateway:** NestJS (TypeScript)
    *   **Auth:** Spring Boot, Kotlin, Gradle
    *   **CRM/Deals:** FastAPI, Python, Poetry, Celery
    *   **Documents:** NestJS (TypeScript), TypeORM, BullMQ
    *   **Telegram Bot:** FastAPI, Python, aiogram
    *   **Reports:** FastAPI, Python
    *   **Backup:** Python, APScheduler
*   **Desktop App:** Python, PySide6
*   **Database:** PostgreSQL
*   **Messaging:** RabbitMQ
*   **Cache:** Redis
*   **Service Discovery:** Consul
*   **Infrastructure:** Docker, Docker Compose

## Building and Running

The project uses Docker Compose for local development. The main script to get everything up and running is `scripts/bootstrap-local.sh`.

### Key Commands

*   **Start all services:**
    ```bash
    ./scripts/bootstrap-local.sh
    ```
*   **Start backend services on the host:**
    ```bash
    ./scripts/bootstrap-local.sh --with-backend --skip-backend
    ```
*   **Stop backend services on the host:**
    ```bash
    ./scripts/stop-backend.sh
    ```
*   **Run database migrations:**
    ```bash
    ./scripts/migrate-local.sh
    ```
*   **Load seed data:**
    ```bash
    ./scripts/load-seeds.sh
    ```
*   **Check the status of the local infrastructure:**
    ```bash
    ./scripts/check-local-infra.sh
    ```

## Development Conventions

### General

*   The project is a monorepo with each service in its own directory under `backend/`.
*   Configuration is managed through `.env` files. Use `scripts/sync-env.sh` to create and update them.
*   The `docs/` directory contains detailed documentation about the architecture, API, and other aspects of the project.

### Backend

*   **Gateway (NestJS):**
    *   Package manager: `pnpm`
    *   Build: `pnpm run build`
    *   Start: `pnpm run start`
*   **Auth (Spring Boot/Kotlin):**
    *   Build tool: Gradle
    *   Build: `./gradlew build`
    *   Database migrations: Liquibase
*   **CRM/Deals (FastAPI/Python):**
    *   Package manager: Poetry
    *   Run API server: `poetry run crm-api`
    *   Run Celery worker: `poetry run crm-worker`
    *   Database migrations: Alembic
*   **Documents (NestJS):**
    *   Package manager: `pnpm`
    *   Build: `pnpm run build`
    *   Start: `pnpm run start`
    *   Database migrations: TypeORM

### Desktop App

*   The desktop application is located in the `desktop_app/` directory.
*   It's a Python application using PySide6 for the UI.
*   Dependencies are listed in `desktop_app/requirements.txt`.
*   To run the application:
    ```bash
    python desktop_app/main.py
    ```
