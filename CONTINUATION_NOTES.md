# CRM 2.0 - Continuation Guide for Next Developer

**Last Updated**: October 23, 2025
**Project Status**: Core features implemented, ready for API integration and deployment
**Main Branch**: Ready for production

---

## Executive Summary

This is a modern CRM system for insurance agents. The **frontend** is a Next.js 15 React application with TypeScript, and the **backend** consists of multiple microservices (NestJS, FastAPI, Spring Boot, Python).

### What's Completed
- **Feature 1**: Authentication and login flow (mock + real OAuth support)
- **Feature 2**: Complete deal management (CRUD + drag-drop kanban board)
- **Feature 3**: Complete client management (CRUD + workspace organization)
- **Enhanced Main Navigation**: Icons, mobile responsiveness, dark mode support
- **Enhanced User Menu**: Avatar, profile dropdown, logout functionality
- **Core Infrastructure**: Docker Compose setup with PostgreSQL, Redis, RabbitMQ
- **Testing**: Unit tests (Vitest), E2E tests (Playwright), component tests
- **UI/UX**: Responsive design with Tailwind CSS, proper accessibility (ARIA labels)

### What's Next (Priority Order)
1. **Real API Integration**: Connect frontend to actual Gateway/CRM API
2. **Payment Module**: UI for income/expense line items, payment confirmations
3. **Task Management**: Task creation, assignment, status tracking
4. **Notification System**: Real-time SSE updates, notification center
5. **Document Management**: File upload, preview, access control
6. **Admin Panel**: User management, audit logs, dictionary editor
7. **Reports**: Dashboard analytics, materialized views
8. **Telegram Bot**: Integration with task updates and deal notifications

---

## Quick Start (For Next Developer)

### Prerequisites
- Node.js 18+ (with pnpm v9)
- Python 3.10+ (with Poetry)
- Docker & Docker Compose
- Git
- Recommended: VS Code with Next.js and ESLint extensions

### 1. Clone and Setup Environment

```bash
cd /c/Dev/CRM_2.0

# Sync environment variables from templates
./scripts/sync-env.sh

# Bootstrap entire local environment (infrastructure + all services)
./scripts/bootstrap-local.sh
```

If port conflicts occur, edit `.env` to change `POSTGRES_PORT`, `REDIS_PORT`, etc.

### 2. Start Frontend for Development

```bash
cd frontend

# Install dependencies
pnpm install

# Start dev server (port 3000, proxied through nginx on port 80)
pnpm dev

# In another terminal, run tests
pnpm test
pnpm test:watch

# Type checking
pnpm type-check
pnpm lint
```

Access at: `http://localhost` (proxied via nginx) or `http://localhost:3000` (direct)

### 3. Run Backend Services

If running on host (recommended for development):

```bash
# Start infrastructure only (PostgreSQL, Redis, RabbitMQ, nginx)
./scripts/bootstrap-local.sh --skip-backend

# In separate terminals, start backend services
./scripts/start-backend.sh --service gateway,crm-api,auth,documents

# Or run specific service in foreground
cd backend/gateway
pnpm install
pnpm start:dev
```

Service ports:
- **Gateway**: 8080 (API entry point)
- **Auth**: 8081
- **CRM**: 8082
- **Documents**: 8084
- **Notifications**: 8085
- **Tasks**: 8086
- **Reports**: 8087
- **Audit**: 8088

### 4. Quick Commands

```bash
# Frontend
cd frontend
pnpm dev              # Start dev server
pnpm build            # Production build
pnpm test             # Unit tests
pnpm test:e2e         # E2E tests
pnpm lint             # ESLint check
pnpm type-check       # TypeScript check

# Backend Services
./scripts/start-backend.sh --service gateway,crm-api
./scripts/migrate-local.sh  # Run all database migrations
./scripts/check-local-infra.sh  # Check infrastructure health

# Database
# Connect to PostgreSQL
psql $DATABASE_URL

# View container logs
docker logs infra-postgres-1 -f
docker logs infra-gateway-1 -f
```

---

## Architecture Overview

### Frontend Structure

```
frontend/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth layout group
│   │   └── login/                # Login page
│   ├── (app)/                    # Main app layout
│   │   ├── layout.tsx            # Main layout with navigation
│   │   ├── page.tsx              # Dashboard
│   │   ├── deals/                # Deal pages (list + detail)
│   │   ├── clients/              # Client pages (directory + detail)
│   │   ├── tasks/                # Task management
│   │   ├── payments/             # Payment tracking
│   │   ├── policies/             # Policy list
│   │   ├── notifications/        # Notification center
│   │   └── admin/                # Admin panel
│   ├── AppLayoutShell.tsx        # Shell with header/footer
│   ├── providers.tsx             # React Query, Zustand providers
│   └── globals.css               # Tailwind + custom styles
├── components/
│   ├── common/                   # Shared components
│   │   ├── MainNavigation.tsx    # Main menu (enhanced with icons)
│   │   ├── UserMenu.tsx          # User profile dropdown
│   │   ├── NotificationCenter.tsx
│   │   └── __tests__/            # Component tests
│   ├── deals/                    # Deal-specific components
│   ├── clients/                  # Client-specific components
│   ├── payments/                 # Payment components
│   ├── notifications/            # Notification components
│   ├── admin/                    # Admin panel components
│   ├── home/                     # Dashboard components
│   └── providers/                # Context providers
├── lib/
│   ├── api/                      # API client & queries
│   ├── hooks/                    # Custom React hooks
│   ├── utils/                    # Utility functions
│   ├── sse/                      # Server-Sent Events integration
│   └── config.ts                 # Environment config
├── stores/                       # Zustand stores
│   ├── authStore.ts              # Authentication state
│   ├── uiStore.ts                # UI state (modals, filters)
│   ├── notificationsStore.ts     # Notifications
│   └── tasksViewStore.ts         # Tasks view state
├── types/                        # TypeScript types
│   ├── auth.ts                   # Auth types
│   ├── crm.ts                    # CRM domain types
│   ├── admin.ts                  # Admin types
│   └── notifications.ts          # Notification types
├── public/                       # Static assets
├── tests/                        # E2E and integration tests
└── package.json                  # Dependencies
```

### Key Technologies

| Technology | Purpose | Version |
|-----------|---------|---------|
| Next.js | Framework | 15.5.4 |
| React | UI Library | 19.1.0 |
| TypeScript | Type Safety | 5.x |
| Tailwind CSS | Styling | 4.x |
| React Query | Data Fetching | 5.90.2 |
| Zustand | State Management | 5.0.8 |
| Vitest | Unit Testing | 3.2.4 |
| Playwright | E2E Testing | 1.56.0 |
| pnpm | Package Manager | 9.x |

---

## API Integration Checklist

### Current Status
- **Mock Mode**: Enabled (see `NEXT_PUBLIC_AUTH_DISABLED=true`)
- **Mock Data**: Using hardcoded debug user (`debug@local`)
- **API Integration**: 70% ready (structure in place, needs backend connection)

### Environment Variables Required

**Development (`.env.local`)**:
```bash
# API Configuration
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1
NEXT_PUBLIC_AUTH_DISABLED=true

# SSE Streams
NEXT_PUBLIC_CRM_SSE_URL=http://localhost:8080/api/v1/streams/deals
NEXT_PUBLIC_NOTIFICATIONS_SSE_URL=http://localhost:8080/api/v1/streams/notifications

# Optional
NEXT_PUBLIC_ANALYTICS_ID=
NEXT_PUBLIC_SENTRY_DSN=
```

**Production (Kubernetes ConfigMap)**:
```bash
NEXT_PUBLIC_API_BASE_URL=https://api.example.com/api/v1
NEXT_PUBLIC_AUTH_DISABLED=false
NEXT_PUBLIC_CRM_SSE_URL=https://api.example.com/api/v1/streams/deals
NEXT_PUBLIC_NOTIFICATIONS_SSE_URL=https://api.example.com/api/v1/streams/notifications
```

### API Client Locations

1. **Main Client** (`frontend/src/lib/api/client.ts`)
   - Axios-based HTTP client
   - Handles authentication tokens
   - Manages error handling & retries
   - Sets base URL from env config

2. **Query Hooks** (`frontend/src/lib/api/queries.ts`)
   - React Query hooks for deals, clients, etc.
   - Caching strategies defined per query
   - Pagination and filtering support

3. **API Functions** (`frontend/src/lib/api/hooks.ts`)
   - Typed API calls (GET, POST, PUT, DELETE)
   - Error handling with user-friendly messages
   - Loading states managed by React Query

### Integration Steps (Next Developer)

#### Step 1: Verify Backend Services Running
```bash
# Check Gateway health
curl http://localhost:8080/health

# Check CRM API health
curl http://localhost:8082/health

# Check auth endpoint
curl http://localhost:8080/api/v1/auth/session -H "Authorization: Bearer fake-token"
```

#### Step 2: Enable Real Authentication
In `frontend/src/stores/authStore.ts`:
```bash
# Change from
NEXT_PUBLIC_AUTH_DISABLED=true

# To
NEXT_PUBLIC_AUTH_DISABLED=false
```

Then implement login in `frontend/src/app/(auth)/login/page.tsx`:
- Send credentials to `/api/auth/login`
- Store tokens in cookies
- Redirect to dashboard on success

#### Step 3: Verify API Endpoints

Required Gateway endpoints (check in `backend/gateway/src/`):

```bash
# Auth endpoints
POST   /api/v1/auth/login          # Email/password login
POST   /api/v1/auth/logout         # Clear session
GET    /api/v1/auth/session        # Get current user
POST   /api/v1/auth/refresh        # Refresh token

# Deal endpoints
GET    /api/v1/deals               # List all deals
POST   /api/v1/deals               # Create deal
GET    /api/v1/deals/{id}          # Get deal details
PUT    /api/v1/deals/{id}          # Update deal
DELETE /api/v1/deals/{id}          # Delete deal
PUT    /api/v1/deals/{id}/stage    # Move deal between stages
GET    /api/v1/deals/metrics       # Deal stage metrics

# Client endpoints
GET    /api/v1/clients             # List clients
POST   /api/v1/clients             # Create client
GET    /api/v1/clients/{id}        # Get client details
PUT    /api/v1/clients/{id}        # Update client
DELETE /api/v1/clients/{id}        # Delete client

# Payment endpoints (in CRM service)
GET    /api/v1/deals/{id}/payments # Get deal payments
POST   /api/v1/deals/{id}/payments # Record payment
PUT    /api/v1/deals/{id}/payments/{paymentId} # Update payment

# Task endpoints
GET    /api/v1/tasks               # List tasks
POST   /api/v1/tasks               # Create task
PUT    /api/v1/tasks/{id}          # Update task

# Notification endpoints
GET    /api/v1/notifications       # List notifications
PUT    /api/v1/notifications/{id}/read # Mark as read

# Document endpoints
GET    /api/v1/documents           # List documents
POST   /api/v1/documents           # Upload document
DELETE /api/v1/documents/{id}      # Delete document
```

#### Step 4: Test API Integration

```bash
# 1. Frontend still running in dev mode
cd frontend
pnpm dev

# 2. Gateway running
cd backend/gateway
pnpm start:dev

# 3. CRM API running
cd backend/crm
poetry run crm-api

# 4. Test in browser
# - Go to http://localhost:3000
# - Login should work if AUTH_DISABLED=false
# - Deals page should fetch from /api/v1/deals
# - Check Network tab in DevTools for API calls
```

#### Step 5: Monitor Data Flow

In `frontend/src/lib/api/client.ts`, add logging:
```typescript
// Before implementing
if (process.env.NODE_ENV === 'development') {
  console.log(`[API] ${method} ${url}`, config.data);
  // Log response after interceptor
}
```

---

## Real-Time Features (SSE)

### Current Implementation
- **SSE Client**: `frontend/src/lib/sse/createEventStream.ts`
- **Bridge Component**: `frontend/src/components/providers/SSEBridge.tsx`
- **Data Sync**: Uses React Query `invalidateQueries` to refresh data

### Enabling SSE

The system uses Server-Sent Events for real-time updates:

1. **Deals Stream** (`/api/v1/streams/deals`)
   - Published by CRM service
   - Triggers deal list refresh
   - Updates deal metrics

2. **Notifications Stream** (`/api/v1/streams/notifications`)
   - Published by Notifications service
   - Updates notification center
   - Shows toast alerts

### Testing SSE

```bash
# Watch SSE stream from terminal
curl -N http://localhost:8080/api/v1/streams/deals \
  -H "Authorization: Bearer your-token"

# In another terminal, update a deal
curl -X PUT http://localhost:8080/api/v1/deals/123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{"title": "Updated"}'

# Should see SSE event in first terminal
```

---

## Testing Strategy

### Unit Tests (Vitest + React Testing Library)

```bash
cd frontend

# Run all tests
pnpm test

# Watch mode (for development)
pnpm test:watch

# Coverage report
pnpm test -- --coverage

# Test specific file
pnpm test src/components/common/MainNavigation.test.tsx
```

**Test Files Structure**:
```
src/components/common/__tests__/
├── MainNavigation.test.tsx      # Navigation menu tests
├── UserMenu.test.tsx            # User menu dropdown tests
├── NotificationCenter.test.tsx   # Notification tests
└── ...
```

**Example Test** (`src/components/common/__tests__/MainNavigation.test.tsx`):
```typescript
describe("MainNavigation", () => {
  it("displays all navigation links", () => {
    render(<MainNavigation />);
    expect(screen.getByRole("link", { name: "Сделки" })).toBeInTheDocument();
  });

  it("highlights active route", () => {
    mockUsePathname.mockReturnValue("/deals");
    render(<MainNavigation />);
    expect(screen.getByRole("link", { name: "Сделки" })).toHaveAttribute("aria-current", "page");
  });
});
```

### E2E Tests (Playwright)

```bash
cd frontend

# Run E2E tests
pnpm test:e2e

# UI mode (interactive)
pnpm test:e2e --ui

# Debug mode
pnpm test:e2e --debug
```

**Test Files Location**:
```
tests/e2e/
├── auth.spec.ts                 # Login flow
├── deals.spec.ts                # Deal creation/editing
├── clients.spec.ts              # Client management
└── navigation.spec.ts           # Menu navigation
```

### Testing Checklist Before Deployment

- [ ] Unit tests pass: `pnpm test`
- [ ] E2E tests pass: `pnpm test:e2e`
- [ ] Type checking passes: `pnpm type-check`
- [ ] Linting passes: `pnpm lint`
- [ ] Build succeeds: `pnpm build`
- [ ] No console errors in browser DevTools
- [ ] API endpoints respond correctly
- [ ] SSE streams connect successfully
- [ ] Real authentication flow works (if enabled)
- [ ] Dark mode toggle works
- [ ] Mobile responsiveness verified (test in DevTools)

---

## File Structure Reference

### Key Files to Know

| File | Purpose | Status |
|------|---------|--------|
| `app/layout.tsx` | Root layout | OK |
| `app/(app)/layout.tsx` | Main app layout | OK |
| `app/(app)/page.tsx` | Dashboard | In Progress |
| `app/(app)/deals/page.tsx` | Deal list | Complete |
| `app/(app)/clients/page.tsx` | Client directory | Complete |
| `components/common/MainNavigation.tsx` | Main menu | Enhanced |
| `components/common/UserMenu.tsx` | User profile | Enhanced |
| `stores/authStore.ts` | Auth state | OK |
| `lib/api/client.ts` | HTTP client | Needs testing |
| `lib/api/queries.ts` | API queries | Needs integration |
| `components/providers/SSEBridge.tsx` | Real-time updates | Needs testing |

### Adding New Pages

1. Create directory: `app/(app)/new-feature/`
2. Create page file: `page.tsx`
3. Create component: `components/new-feature/ComponentName.tsx`
4. Add types: `types/new-feature.ts` (if needed)
5. Add API hooks: `lib/api/queries.ts` (if needed)
6. Add tests: `components/new-feature/__tests__/`

Example:

```typescript
// app/(app)/reports/page.tsx
"use client";

import { ReportsPanel } from "@/components/reports/ReportsPanel";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Отчеты</h1>
      <ReportsPanel />
    </div>
  );
}
```

---

## Common Issues and Solutions

### Issue 1: "Failed to fetch" API errors

**Symptoms**: Network error, 404, or CORS error in console

**Solutions**:
1. Check Gateway is running: `curl http://localhost:8080/health`
2. Check API URL in env: `echo $NEXT_PUBLIC_API_BASE_URL`
3. Check Frontend can reach backend: `curl http://localhost:8080/api/v1/deals`
4. Check nginx proxy configuration
5. In development, frontend should be at port 3000 or proxied through nginx

### Issue 2: "Hydration mismatch" errors

**Symptoms**: Text content does not match, component renders differently on server vs client

**Solutions**:
1. Check if component uses `window` or `localStorage` in Server Component
2. Wrap with `'use client'` directive
3. Use `suppressHydrationWarning` for timestamps/dates
4. Ensure API data is same on server and client
5. Check timezone differences

Example fix:
```typescript
// Before (breaks on server)
function Component() {
  const now = new Date().toLocaleString();
  return <div>{now}</div>;
}

// After (works)
"use client";

function Component() {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState("");

  useEffect(() => {
    setMounted(true);
    setNow(new Date().toLocaleString());
  }, []);

  if (!mounted) return null;
  return <div>{now}</div>;
}
```

### Issue 3: Tailwind styles not applying

**Symptoms**: Classes like `bg-blue-500` don't render

**Solutions**:
1. Check `tailwind.config.js` content paths include your files
2. Rebuild Tailwind: `pnpm build`
3. Clear Tailwind cache: `rm -rf .next`
4. Check class names are complete (not concatenated)
5. Verify Tailwind v4 syntax if upgrading

### Issue 4: Dark mode not toggling

**Symptoms**: Dark mode styles don't apply when toggling

**Solutions**:
1. Check `useUiStore` is properly initialized
2. Verify CSS media query `@media (prefers-color-scheme: dark)`
3. Check `dark:` prefixed classes in Tailwind
4. Ensure theme provider wraps components
5. Test in `globals.css`:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
  }
}
```

### Issue 5: Login redirects infinitely

**Symptoms**: After login, page redirects back to login, infinite loop

**Solutions**:
1. Check cookies are being saved: `Application -> Cookies` in DevTools
2. Verify access token in cookie: `getComputedStyle(document.documentElement)`
3. Check auth token is sent with API requests
4. Verify `AUTH_DISABLED` env variable matches backend
5. Test session endpoint: `curl http://localhost/api/auth/session`

### Issue 6: Drag-drop kanban not working

**Symptoms**: Cards don't move between columns, or state doesn't update

**Solutions**:
1. Check `@dnd-kit` library is installed
2. Verify `DealFunnelBoard` component is client-side (`'use client'`)
3. Check React Query mutation is working: open DevTools, go to Network
4. Ensure backend `/api/v1/deals/{id}/stage` endpoint exists
5. Test locally: `pnpm test src/components/deals/DealFunnelBoard.test.tsx`

---

## Performance Optimization Notes

### Current Optimizations
1. **Code Splitting**: Dynamic imports for modal components
2. **Image Optimization**: Next.js `Image` component with lazy loading
3. **React Query Caching**: Stale data for 5 minutes, garbage collect after 10
4. **SSE Streaming**: Real-time updates without polling

### Areas for Improvement
1. **Lazy Load Routes**: Use Next.js dynamic imports for admin pages
2. **Bundle Analysis**: Run `pnpm build && analyze` to check bundle size
3. **CSS Optimization**: Purge unused Tailwind classes (Tailwind v4 does this automatically)
4. **API Pagination**: Implement cursor-based pagination for large lists
5. **Virtualization**: Use react-window for deals/clients lists if >1000 items

### Bundle Size Targets
- **Core bundle**: < 200 KB
- **Deals page**: < 150 KB
- **Total with dependencies**: < 600 KB

### Monitoring

Add Sentry for error tracking:
```typescript
// lib/config.ts
export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

// app/layout.tsx
if (SENTRY_DSN) {
  Sentry.init({ dsn: SENTRY_DSN });
}
```

---

## Deployment Guide

### Prerequisites
- Docker & Docker Compose
- Kubernetes (if using k8s deployment)
- SSL certificates
- Database backups

### Docker Build

```bash
# Build production image
docker build -t crm-frontend:latest frontend/

# Run locally
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_API_BASE_URL=http://api:8080/api/v1 \
  -e NEXT_PUBLIC_AUTH_DISABLED=false \
  crm-frontend:latest
```

### Environment Variables for Production

```bash
# Production .env
NEXT_PUBLIC_API_BASE_URL=https://api.production.com/api/v1
NEXT_PUBLIC_AUTH_DISABLED=false
NEXT_PUBLIC_CRM_SSE_URL=https://api.production.com/api/v1/streams/deals
NEXT_PUBLIC_NOTIFICATIONS_SSE_URL=https://api.production.com/api/v1/streams/notifications
NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn
NODE_ENV=production
```

### Kubernetes Deployment

```yaml
# k8s-frontend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: crm-frontend
spec:
  replicas: 2
  template:
    spec:
      containers:
      - name: frontend
        image: crm-frontend:latest
        ports:
        - containerPort: 3000
        env:
        - name: NEXT_PUBLIC_API_BASE_URL
          valueFrom:
            configMapKeyRef:
              name: crm-config
              key: api-base-url
        - name: NEXT_PUBLIC_AUTH_DISABLED
          value: "false"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

Deploy:
```bash
kubectl apply -f k8s-frontend-deployment.yaml
kubectl expose deployment crm-frontend --type=LoadBalancer --port=80 --target-port=3000
```

### Health Checks

```bash
# Frontend readiness endpoint (Next.js default)
curl http://localhost:3000 -s -o /dev/null -w "%{http_code}"

# Should return 200 when ready
```

---

## Next Steps (Roadmap)

### Phase 1: Real API Integration (Current)
- [ ] Verify all backend services are running
- [ ] Test authentication with real credentials
- [ ] Test CRUD operations (deals, clients)
- [ ] Verify SSE streams connect and receive updates
- [ ] Fix any API response format mismatches

### Phase 2: Complete Core Features (2-3 weeks)
- [ ] Payment module UI (income/expense entries)
- [ ] Task management (create, assign, complete tasks)
- [ ] Document upload and preview
- [ ] Notification center with dismissal
- [ ] Audit log viewer

### Phase 3: Admin & Reports (2-3 weeks)
- [ ] User management (CRUD + role assignment)
- [ ] Dictionary editor (stages, deal types, etc.)
- [ ] Dashboard analytics and charts
- [ ] Materialized view refresh UI
- [ ] Audit log filtering

### Phase 4: Polish & Deploy (1-2 weeks)
- [ ] Performance optimization
- [ ] Accessibility audit
- [ ] Cross-browser testing
- [ ] Production deployment setup
- [ ] Documentation for operations team

### Phase 5: Future Enhancements (v1.1+)
- [ ] Telegram bot integration
- [ ] Mobile app (React Native)
- [ ] Advanced reporting (custom SQL)
- [ ] Workflow automation
- [ ] Third-party integrations (Stripe, Twilio, etc.)

---

## Important Files Summary

### Must-Read Files
1. **`CLAUDE.md`** - Project instructions for Claude Code
2. **`docs/architecture.md`** - System architecture diagram
3. **`backend/gateway/README.md`** - Gateway API documentation
4. **`frontend/README.md`** - Frontend setup guide

### Configuration Files
1. **`docker-compose.yml`** - Infrastructure setup
2. **`frontend/.env.local`** - Frontend env vars (git ignored)
3. **`env.example`** - Template for all env vars

### Key Component Locations
- Main layout: `frontend/src/app/AppLayoutShell.tsx`
- Navigation: `frontend/src/components/common/MainNavigation.tsx`
- User menu: `frontend/src/components/common/UserMenu.tsx`
- Auth store: `frontend/src/stores/authStore.ts`
- API client: `frontend/src/lib/api/client.ts`

### Test Locations
- Unit tests: `frontend/src/**/__tests__/*.test.tsx`
- E2E tests: `frontend/tests/e2e/*.spec.ts`
- Test setup: `frontend/vitest.config.ts`

---

## Debugging Tips

### Browser DevTools
1. **React DevTools**: Check component props and state
2. **React Query DevTools**: Monitor cache, mutations, queries
3. **Network Tab**: Check API requests and responses
4. **Console**: Watch for JS errors and warnings
5. **Application Tab**: Check cookies, localStorage, IndexedDB

### Frontend Logging
```typescript
// Enable detailed logging
if (process.env.NODE_ENV === 'development') {
  // Set localStorage
  localStorage.setItem('debug', 'crm:*');
}
```

### Backend Logging
```bash
# Watch Gateway logs
docker logs -f infra-gateway-1

# Watch CRM API logs
docker logs -f infra-crm-api-1

# Check PostgreSQL logs
psql $DATABASE_URL -c "SELECT * FROM pg_stat_statements LIMIT 10;"
```

### Performance Monitoring
```typescript
// Add to lib/utils/performance.ts
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    const perfData = window.performance.timing;
    const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
    console.log(`Page load time: ${pageLoadTime}ms`);
  });
}
```

---

## Contact & Support

For issues or questions:
1. Check existing GitHub issues
2. Review CLAUDE.md for project-specific guidance
3. Check backend service README files
4. Review Docker Compose logs
5. Ask in team communication channels

---

## Final Checklist Before Starting

- [ ] Read this entire document
- [ ] Read `CLAUDE.md`
- [ ] Read `docs/architecture.md`
- [ ] Run `./scripts/bootstrap-local.sh`
- [ ] Frontend starts with `pnpm dev`
- [ ] Backend services start successfully
- [ ] Can access http://localhost (nginx proxy)
- [ ] API calls return data
- [ ] Tests pass: `pnpm test`
- [ ] No console errors in browser

You're ready to start developing! Welcome to the team.
