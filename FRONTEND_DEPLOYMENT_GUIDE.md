# Frontend Deployment Guide

## Overview

The CRM frontend is a production-ready **Next.js 15** application built with React 19, TypeScript 5, and Tailwind CSS 4. The application is fully containerized and ready for deployment.

## Application Details

- **Framework**: Next.js 15.5.4 with React 19.1.0
- **Build Type**: Standalone (optimized Docker builds)
- **Image Size**: ~212MB (multi-stage Docker build)
- **Default Port**: 3000
- **Node Version**: 18 (Alpine base)

## Building the Frontend

### Prerequisites

- Docker & Docker Compose
- Environment variables configured (see Configuration section)

### Build Docker Image

```bash
cd C:\Dev\CRM_2.0

# Build frontend image
docker build \
  -f frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_BASE_URL=http://gateway:8080/api/v1 \
  --build-arg NEXT_PUBLIC_AUTH_DISABLED=true \
  -t crm-frontend:latest \
  frontend
```

### Verify Build

```bash
# Check image
docker images crm-frontend:latest

# Expected output:
# REPOSITORY     SIZE      IMAGE ID
# crm-frontend   212MB     <hash>
```

## Deployment

### Option 1: Docker Compose (Recommended)

The frontend is configured in the main docker-compose.yml with the "app" profile.

```bash
# Start all services with frontend
docker-compose -f infra/docker-compose.yml \
  --profile app \
  up -d

# Check frontend status
docker compose -f infra/docker-compose.yml ps frontend

# Expected output:
# NAME            STATUS             PORTS
# crm-frontend    Up (healthy)       0.0.0.0:3000->3000/tcp
```

### Option 2: Standalone Docker Container

```bash
docker run -d \
  --name crm-frontend \
  --restart unless-stopped \
  -e NODE_ENV=production \
  -e NEXT_PUBLIC_API_BASE_URL=http://gateway:8080/api/v1 \
  -e NEXT_PUBLIC_AUTH_DISABLED=true \
  -p 3000:3000 \
  --network infra \
  crm-frontend:latest
```

### Option 3: Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: crm-frontend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: crm-frontend
  template:
    metadata:
      labels:
        app: crm-frontend
    spec:
      containers:
      - name: frontend
        image: crm-frontend:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: NEXT_PUBLIC_API_BASE_URL
          value: "http://gateway:8080/api/v1"
        - name: NEXT_PUBLIC_AUTH_DISABLED
          value: "true"
        livenessProbe:
          httpGet:
            path: /
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: crm-frontend
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 3000
  selector:
    app: crm-frontend
```

## Configuration

### Environment Variables

Set these in your `.env` file or pass as build args:

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | `http://gateway:8080/api/v1` | Backend Gateway API endpoint |
| `NEXT_PUBLIC_AUTH_DISABLED` | `true` | Disable authentication (local dev) |
| `NEXT_PUBLIC_CRM_SSE_URL` | `http://gateway:8080/api/v1/streams/deals` | CRM SSE stream endpoint |
| `NEXT_PUBLIC_NOTIFICATIONS_SSE_URL` | `http://gateway:8080/api/v1/streams/notifications` | Notifications SSE stream endpoint |
| `FRONTEND_PROXY_TIMEOUT` | `15000` | Request timeout (ms) |
| `FRONTEND_SERVER_TIMEOUT_MS` | `7500` | Server-side timeout (ms) |
| `PORT` | `3000` | Container port |

### Production Configuration

For production, update `.env`:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.example.com/api/v1
NEXT_PUBLIC_AUTH_DISABLED=false
NEXT_PUBLIC_CRM_SSE_URL=https://api.example.com/api/v1/streams/deals
NEXT_PUBLIC_NOTIFICATIONS_SSE_URL=https://api.example.com/api/v1/streams/notifications
FRONTEND_PROXY_TIMEOUT=30000
FRONTEND_SERVER_TIMEOUT_MS=15000
```

Then rebuild the image:

```bash
./scripts/sync-env.sh
docker build -f frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_BASE_URL=$(grep NEXT_PUBLIC_API_BASE_URL .env | cut -d= -f2) \
  --build-arg NEXT_PUBLIC_AUTH_DISABLED=$(grep NEXT_PUBLIC_AUTH_DISABLED .env | cut -d= -f2) \
  -t crm-frontend:prod \
  frontend
```

## Verification

### Health Check

The container includes an HTTP health check:

```bash
# Manual health check
curl -f http://localhost:3000 || exit 1

# Docker health status
docker inspect crm-frontend --format='{{.State.Health.Status}}'

# Expected output: healthy
```

### Application Testing

```bash
# Test root route (should redirect to /login)
curl -I http://localhost:3000

# Expected: HTTP 307 Location: /login
```

### Logs

```bash
# View logs from docker-compose
docker-compose -f infra/docker-compose.yml logs frontend

# View logs from standalone container
docker logs crm-frontend -f

# View logs with timestamps
docker logs crm-frontend --timestamps
```

## Troubleshooting

### Container fails to start

Check logs:
```bash
docker logs crm-frontend
```

Common issues:
- **Port 3000 already in use**: Change `FRONTEND_SERVICE_PORT` in `.env`
- **Gateway not ready**: Ensure gateway service is running and healthy
- **API URL misconfiguration**: Verify `NEXT_PUBLIC_API_BASE_URL`

### Slow performance

```bash
# Check container resource usage
docker stats crm-frontend

# Increase memory limit
docker update --memory 1g crm-frontend

# Restart container
docker restart crm-frontend
```

### Static assets not loading

Check if the frontend can access `/public` directory:
```bash
curl http://localhost:3000/file.svg -v
```

If 404, verify the Dockerfile COPY instructions are correct.

## Maintenance

### Update image

```bash
# Pull latest code
git pull origin main

# Rebuild image
docker build -f frontend/Dockerfile \
  -t crm-frontend:latest \
  frontend

# Restart container
docker-compose -f infra/docker-compose.yml restart frontend
```

### Monitor logs

```bash
# Real-time logs
docker logs -f crm-frontend

# Last 100 lines
docker logs --tail 100 crm-frontend

# Logs from last 30 minutes
docker logs --since 30m crm-frontend
```

### Resource limits

```bash
# Set memory and CPU limits in docker-compose.yml
services:
  frontend:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

## Performance Optimization

### Build Optimization

The frontend Dockerfile uses multi-stage builds:

```dockerfile
# Stage 1: Build with pnpm
FROM node:18-alpine AS builder
...

# Stage 2: Runtime (minimal)
FROM node:18-alpine AS runner
...
```

This results in:
- Smaller final image (~212MB vs 1.2GB)
- Faster deploy time
- Reduced attack surface

### Caching Strategy

Production build includes:
- **Standalone mode**: Pre-optimized for single-server deployment
- **Static HTML**: Pre-rendered pages (some routes)
- **Image optimization**: Automatic WebP conversion and resizing

### SSE Streams

The frontend connects to two SSE streams:
- `/api/v1/streams/deals`: Real-time deal updates
- `/api/v1/streams/notifications`: User notifications

Ensure Gateway is configured to proxy these streams correctly.

## Security

### Headers

The Next.js middleware includes security headers:
```typescript
// middleware.ts
const response = NextResponse.next();
response.headers.set('X-Frame-Options', 'DENY');
response.headers.set('X-Content-Type-Options', 'nosniff');
response.headers.set('X-XSS-Protection', '1; mode=block');
```

### CORS

Frontend is same-origin with Gateway. If deploying separately:

```bash
# Gateway CORS config
CORS_ORIGINS="https://frontend.example.com"
```

### Environment Variables

**Never commit `.env`** with production secrets:
```bash
# Good
NEXT_PUBLIC_API_BASE_URL=https://api.prod.com

# Bad
AUTH_TOKEN=secret123  # (if not NEXT_PUBLIC_ prefix)
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build & Deploy Frontend

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: docker/build-push-action@v4
        with:
          context: ./frontend
          file: ./frontend/Dockerfile
          push: true
          tags: crm-frontend:${{ github.sha }}
          build-args: |
            NEXT_PUBLIC_API_BASE_URL=${{ secrets.API_BASE_URL }}
            NEXT_PUBLIC_AUTH_DISABLED=false

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: |
          docker pull crm-frontend:${{ github.sha }}
          docker tag crm-frontend:${{ github.sha }} crm-frontend:latest
          docker-compose up -d frontend
```

## Support

For issues with the frontend, check:

1. **Frontend logs**: `docker logs crm-frontend`
2. **Browser console**: Press F12, check Console tab
3. **Network tab**: Verify API calls to Gateway
4. **Health endpoint**: `curl http://localhost:3000`

## Next Steps

1. ✅ Frontend built and tested
2. Configure production environment variables
3. Set up SSL/TLS certificates
4. Deploy to target infrastructure
5. Configure CDN for static assets
6. Set up monitoring and alerting

---

**Last Updated**: 2025-10-23
**Status**: Production Ready ✓
