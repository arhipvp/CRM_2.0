# CRM System - Quick Run Guide

## Prerequisites
- Docker and Docker Compose installed
- Python 3.8+ installed
- Windows/Mac/Linux with Git

## Step 1: Start the Backend Services

```bash
cd C:\Dev\CRM_2.0
docker-compose -f infra/docker-compose.yml --profile backend up -d
```

Wait for all containers to show `Healthy`:
```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```

Expected output:
- crm-postgres: Healthy
- crm-redis: Healthy
- crm-rabbitmq: Healthy
- crm-consul: Healthy
- crm-auth: Healthy
- crm-crm: Healthy
- crm-documents: Healthy
- crm-notifications: Healthy
- crm-tasks: Healthy
- crm-gateway: Healthy

## Step 2: Start the Desktop Application

```bash
cd C:\Dev\CRM_2.0\desktop_app
python main.py
```

The application will launch with:
- Clients tab
- Deals tab
- Payments tab
- Policies tab
- Calculations tab
- Tasks tab (newly completed)

## Step 3: Available Operations

### Clients Management
- **View**: Double-click to see details
- **Add**: Click "Add Client" button
- **Edit**: Select client and click "Edit" button
- **Delete**: Select client and click "Delete" button
- **Search**: Use search bar to filter by name, email, or phone
- **Export**: Export to CSV or Excel

### Deals Management
- Full CRUD operations
- Filter by status and stage
- Search by deal name
- Export data to Excel/CSV

### Tasks Management (NEW)
- **Create**: Click "Add Task" to create new task
- **Edit**: Select task and click "Edit" button
- **Delete**: Select task and click "Delete" button
- **View Details**: Double-click on task row
- **Filter**: By status (open, in_progress, completed, closed) and priority
- **Search**: By task title
- **Export**: To CSV or Excel

### Payments Management
- Create, edit, delete payments
- Filter by status
- Search by payment reference
- Export functionality

### Policies Management
- Full policy management
- Filter and search capabilities
- Detailed view and editing

### Calculations Management
- Calculate insurance amounts
- Edit and delete calculations
- View detailed calculation information

## Available API Endpoints

**Gateway (Main Entry Point)**
- URL: http://localhost:8080
- API Base: http://localhost:8080/api/v1

**Services**
- CRM Service: http://localhost:8082/api/v1
- Auth Service: http://localhost:8081/api
- Notifications: http://localhost:8085/api
- Documents: http://localhost:8084/documents
- Tasks: http://localhost:8086/api

**Admin Interfaces**
- PgAdmin: http://localhost:5051
  - Email: admin@crm.local
  - Password: admin
- RabbitMQ: http://localhost:15672
  - Username: crm
  - Password: crm

## Common Issues

### Application doesn't start
1. Check Python version: `python --version` (should be 3.8+)
2. Install requirements: `pip install -r requirements.txt`
3. Check Docker containers are running

### API Connection errors
1. Verify containers are healthy: `docker ps`
2. Check API is responding: `curl http://localhost:8080/api/v1/health`
3. Restart gateway: `docker restart crm-gateway`

### Database issues
1. Check PostgreSQL is running: `docker ps | grep postgres`
2. Check logs: `docker logs crm-postgres`
3. Restart database: `docker restart crm-postgres && docker restart crm-crm`

## Stopping Services

```bash
# Stop all containers
docker-compose -f infra/docker-compose.yml --profile backend down

# Stop specific service
docker stop crm-gateway

# View logs
docker logs crm-crm -f
```

## File Locations

- Desktop App: `C:\Dev\CRM_2.0\desktop_app\`
- Main Script: `C:\Dev\CRM_2.0\desktop_app\main.py`
- Configuration: `C:\Dev\CRM_2.0\desktop_app\config.py`
- Documentation: `C:\Dev\CRM_2.0\desktop_app\*.md`
- Docker Config: `C:\Dev\CRM_2.0\infra\docker-compose.yml`

## Features

✅ Full CRUD operations for all entities
✅ Search and filtering capabilities
✅ CSV and Excel export
✅ Professional dialogs with validation
✅ Threading for responsive UI
✅ Error handling and logging
✅ API integration via Gateway
✅ Multi-service architecture

## Next Steps

1. Review the application features
2. Test CRUD operations for all tabs
3. Try search and filtering
4. Test export functionality
5. Review logs in `desktop_app/logs/` directory (if enabled)

## Support

For detailed documentation, see:
- `DESKTOP_APP_README.md` - Application overview
- `desktop_app/QUICK_START.md` - Quick start guide
- `desktop_app/TESTING_GUIDE.md` - Testing scenarios
- `COMPLETION_REPORT_2025-10-24.md` - Recent changes

---

**Last Updated:** 2025-10-24
**Status:** ✅ All systems operational
