# 🚀 CRM 2.0 - Quick Reference Guide

## ⚡ Most Common Commands

### Start Everything
```bash
cd infra
docker-compose --env-file ../.env --profile backend --profile app up -d
```

### Stop Everything
```bash
cd infra
docker-compose --env-file ../.env --profile backend --profile app down
```

### View Logs
```bash
# Frontend only
docker logs -f crm-frontend

# All services
cd infra && docker-compose --env-file ../.env logs -f

# Specific service
docker logs -f crm-gateway
```

### Rebuild Frontend
```bash
cd infra
docker-compose --env-file ../.env --profile backend --profile app up -d --build --force-recreate frontend
```

### Check Services Status
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

---

## 🌐 Access Points

| What | URL | Login |
|------|-----|-------|
| **Frontend** | http://localhost:3000 | any email / any password |
| **Dashboard** | http://localhost:3000/dashboard | ⬆️ same |
| **Deals** | http://localhost:3000/deals | ⬆️ same |
| **Clients** | http://localhost:3000/clients | ⬆️ same |
| **API Gateway** | http://localhost:8080/api/v1 | Bearer token in Authorization header |
| **RabbitMQ UI** | http://localhost:15672 | guest / guest |
| **PgAdmin** | http://localhost:5050 | pgadmin4@pgadmin.org / admin |
| **Consul** | http://localhost:8500 | (no auth) |

---

## 🔧 Development Workflow

### Option 1: Edit & Rebuild Docker (Recommended for Testing)
```bash
# 1. Make changes to frontend code
cd frontend
# ... edit files ...

# 2. Rebuild Docker image
cd ../infra
docker-compose --env-file ../.env --profile backend --profile app up -d --build frontend

# 3. Check logs
docker logs -f crm-frontend
```

### Option 2: Run Frontend Locally (For Hot Reload Development)
```bash
# 1. Stop Docker frontend
cd infra
docker-compose --env-file ../.env --profile backend --profile app stop frontend

# 2. Start on host machine
cd ../frontend
pnpm install
pnpm dev

# Frontend now at http://localhost:3000 with hot reload
```

### Option 3: Run Backend Services Locally
```bash
# 1. Keep Docker infrastructure (postgres, redis, rabbitmq)
cd infra
docker-compose --env-file ../.env --profile infra up -d

# 2. Start backend services on host
cd ../backend/gateway
pnpm start:dev

# In another terminal
cd backend/crm
poetry run crm-api
```

---

## 📝 Common Tasks

### View Frontend Errors
```bash
docker logs crm-frontend | tail -50
```

### Clear Docker Cache & Rebuild
```bash
cd infra
docker-compose --env-file ../.env --profile backend --profile app down
docker system prune -f
docker-compose --env-file ../.env --profile backend --profile app up -d --build
```

### Check If Port Is Already Used
```bash
# Windows
netstat -ano | findstr ":3000"

# Linux/Mac
lsof -i :3000
```

### Kill Process Using Port
```bash
# Windows
taskkill /PID <PID> /F

# Linux/Mac
kill -9 <PID>
```

### Access Database
```bash
# Using psql
psql postgresql://postgres:postgres@localhost:5432/crm

# Or use PgAdmin UI
http://localhost:5050
```

### Check RabbitMQ Queues
```bash
# Web UI
http://localhost:15672
# Username: guest
# Password: guest

# Or via curl
curl -u guest:guest http://localhost:15672/api/queues
```

### Sync Environment Variables
```bash
./scripts/sync-env.sh
```

---

## 🧪 Testing

### Frontend Unit Tests
```bash
cd frontend
pnpm test
```

### Frontend E2E Tests
```bash
cd frontend
pnpm test:e2e
```

### Gateway Tests
```bash
cd backend/gateway
pnpm test
```

### CRM Tests
```bash
cd backend/crm
poetry run pytest
```

---

## 📊 Service Ports Reference

| Service | Port | Purpose |
|---------|------|---------|
| Frontend | 3000 | Next.js application |
| Gateway | 8080 | API BFF |
| Auth | 8081 | Authentication service |
| CRM/Deals | 8082 | Core CRM API |
| Notifications | 8085 | Notification service |
| Tasks | 8086 | Task management |
| PostgreSQL | 5432 | Database |
| Redis | 6379 | Cache |
| RabbitMQ | 5672 | Message broker |
| RabbitMQ UI | 15672 | Management interface |
| Consul | 8500 | Service discovery |
| PgAdmin | 5050 | Database UI |

---

## 🔐 Credentials

### Mock Authentication (Frontend)
```
Any email + any password works
Examples:
- admin@crm.com / password123
- user@test.com / test
- demo@example.com / demo
```

### Database
```
Host: localhost
Port: 5432
Username: postgres
Password: postgres
Database: crm
```

### RabbitMQ
```
Host: localhost
Port: 5672
Username: guest
Password: guest
Management UI: http://localhost:15672
```

### PgAdmin
```
Email: pgadmin4@pgadmin.org
Password: admin
```

---

## 🚨 Troubleshooting

### Frontend shows "Cannot GET /"
```bash
# Rebuild frontend
docker-compose --env-file ../.env --profile backend --profile app up -d --build frontend
docker logs crm-frontend
```

### "Unauthorized" at login
```bash
# Check if NEXT_PUBLIC_AUTH_DISABLED is set
docker exec crm-frontend env | grep AUTH_DISABLED

# If not present, rebuild with args
docker-compose --env-file ../.env --profile backend --profile app up -d --build --force-recreate frontend
```

### API returns 502 Bad Gateway
```bash
# Check gateway service
docker ps | grep gateway
docker logs crm-gateway

# Restart gateway
cd infra && docker-compose --env-file ../.env --profile backend restart gateway
```

### Database connection refused
```bash
# Check postgres
docker ps | grep postgres
docker logs crm-postgres

# Restart postgres
cd infra && docker-compose --env-file ../.env restart postgres
```

### Port 3000 already in use
```bash
# Kill existing process
netstat -ano | findstr ":3000"
taskkill /PID <PID> /F

# Or change port in .env
FRONTEND_PORT=3001
```

### Cannot connect to Redis/RabbitMQ
```bash
# Check service health
docker ps | grep -E "redis|rabbitmq"
docker logs crm-redis
docker logs crm-rabbitmq

# Restart services
cd infra && docker-compose --env-file ../.env --profile infra restart redis rabbitmq
```

---

## 📁 Important Directories

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   └── (app)/
│   │       ├── deals/         # Deal management
│   │       ├── clients/       # Client management
│   │       ├── payments/      # Payment processing
│   │       ├── tasks/         # Task management
│   │       └── admin/         # Admin panel
│   ├── components/            # React components
│   ├── lib/                   # Utilities and API client
│   ├── stores/                # Zustand state stores
│   └── hooks/                 # Custom React hooks
├── Dockerfile                 # Production build config
└── next.config.ts            # Next.js configuration

backend/
├── gateway/                   # API Gateway (port 8080)
├── auth/                      # Auth service (port 8081)
├── crm/                       # CRM/Deals service (port 8082)
├── notifications/             # Notifications service (port 8085)
├── tasks/                     # Tasks service (port 8086)
└── ...

infra/
├── docker-compose.yml        # Service orchestration
└── rabbitmq/                 # RabbitMQ config
```

---

## 🎯 Typical Development Session

1. **Start the day**:
   ```bash
   cd infra
   docker-compose --env-file ../.env --profile backend --profile app up -d
   ```

2. **Open application**:
   ```
   http://localhost:3000 → login → dashboard
   ```

3. **Edit code**:
   ```bash
   cd frontend
   # Edit files in src/ directory
   ```

4. **Test changes**:
   ```bash
   # Rebuild Docker
   cd infra
   docker-compose --env-file ../.env --profile backend --profile app up -d --build frontend
   docker logs -f crm-frontend
   ```

5. **Run tests** (if applicable):
   ```bash
   cd frontend
   pnpm test
   pnpm test:e2e
   ```

6. **End of day**:
   ```bash
   cd infra
   docker-compose --env-file ../.env --profile backend --profile app down
   ```

---

## 📖 Documentation Files

| File | Purpose |
|------|---------|
| `SETUP_COMPLETE.md` | Full setup details and configuration |
| `READY_TO_USE.md` | Quick start and status overview |
| `LOGIN_INSTRUCTIONS.md` | How to login (mock auth explained) |
| `MOCK_AUTH_FIXED.md` | Technical details about mock authentication |
| `CLAUDE.md` | Project architecture and guidelines |
| `QUICK_REFERENCE.md` | This file - quick commands |

---

## 💡 Pro Tips

1. **Fast rebuilds**: Use `--build` flag alone for faster Docker builds:
   ```bash
   docker-compose --env-file ../.env --profile backend --profile app up -d --build frontend
   ```

2. **Follow logs in real-time**:
   ```bash
   docker logs -f crm-frontend | grep -E "error|Error|ERROR|Ready|started"
   ```

3. **Keep a second terminal open**:
   - Terminal 1: `docker logs -f crm-frontend`
   - Terminal 2: Run docker-compose commands

4. **Save common commands**:
   Create a `dev-commands.sh` script with your favorites

5. **Use PostgreSQL directly for debugging**:
   ```bash
   psql postgresql://postgres:postgres@localhost:5432/crm
   \dt auth.*
   SELECT * FROM auth.users;
   ```

6. **Inspect Docker image layers**:
   ```bash
   docker history crm-frontend
   ```

7. **Export logs to file**:
   ```bash
   docker logs crm-frontend > ~/frontend.log 2>&1
   ```

---

*Last Updated: 2025-10-22*
*Keep this file open while developing!*
