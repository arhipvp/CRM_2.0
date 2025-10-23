# Frontend-Backend Integration Checklist

## Status: READY FOR INTEGRATION

The frontend is **fully implemented and waiting for backend services**. All code is in place to connect to real backend services. This checklist tracks what needs to happen on the backend side and configuration changes.

---

## Phase 1: Basic Backend Services (Critical)

### Gateway API (Port 8080)
- [ ] Gateway service running and healthy
  ```bash
  curl http://localhost:8080/health
  # Should return 200 OK
  ```
- [ ] Gateway proxying to CRM service
  ```bash
  curl http://localhost:8080/api/v1/crm/deals
  # Should forward to CRM API
  ```
- [ ] Gateway proxying to Auth service
  ```bash
  curl http://localhost:8080/api/v1/auth/me
  # Should forward to Auth API
  ```

**Frontend Action**:
```bash
# Update .env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1
NEXT_PUBLIC_AUTH_DISABLED=false  # Switch to real auth
pnpm dev
```

### CRM Service (Port 8082)
**Required Endpoints**:
- [ ] `GET /api/v1/crm/deals` - List deals
- [ ] `POST /api/v1/crm/deals` - Create deal
- [ ] `PATCH /api/v1/crm/deals/{id}/stage` - Update deal stage
- [ ] `GET /api/v1/crm/clients` - List clients
- [ ] `POST /api/v1/crm/clients` - Create client
- [ ] `GET /api/v1/crm/tasks` - List tasks
- [ ] `GET /api/v1/crm/payments` - List payments

**Response Format Example**:
```json
{
  "id": "deal-123",
  "name": "Deal Name",
  "client_id": "client-456",
  "stage": "negotiation",
  "status": "active",
  "owner_id": "user-789",
  "next_review_at": "2025-10-30T00:00:00Z",
  "created_at": "2025-10-01T00:00:00Z",
  "updated_at": "2025-10-23T00:00:00Z"
}
```

**Frontend Code Using This**:
- `/src/app/(app)/deals/page.tsx` - Deal list
- `/src/app/(app)/deals/[dealId]/page.tsx` - Deal details

### Auth Service (Port 8081)
**Required Endpoints**:
- [ ] `POST /api/auth/login` - User login
  ```bash
  POST /api/auth/login
  {
    "email": "user@example.com",
    "password": "password123"
  }
  Response:
  {
    "access_token": "eyJhbGc...",
    "refresh_token": "eyJhbGc...",
    "user": { "id": "user-123", "email": "user@example.com" }
  }
  ```

- [ ] `GET /api/auth/me` - Current user profile
  ```bash
  GET /api/auth/me
  Authorization: Bearer {access_token}
  Response:
  {
    "id": "user-123",
    "email": "user@example.com",
    "name": "John Doe",
    "roles": ["ROLE_USER", "ROLE_ADMIN"]
  }
  ```

- [ ] `POST /api/auth/logout` - Sign out

**Frontend Code Using This**:
- `/src/app/(auth)/login/page.tsx` - Login page
- `/src/app/(app)/api/auth/session/route.ts` - Session route
- `/src/stores/authStore.ts` - Auth state

### Session Management
**Frontend Expects**:
- [ ] Access token in cookie: `access_token`
- [ ] Refresh token in cookie: `refresh_token` (optional)
- [ ] Tokens should be HttpOnly, Secure (production)
- [ ] CORS headers allowing frontend domain

**Implementation in Frontend**:
```typescript
// src/lib/auth/constants.ts
const ACCESS_TOKEN_COOKIE = 'access_token';
const REFRESH_TOKEN_COOKIE = 'refresh_token';

// src/app/(app)/api/auth/session/route.ts
// Checks cookies and validates with /auth/me endpoint
```

---

## Phase 2: Real-Time Features

### SSE Streams (Required for live updates)

**Deal Updates Stream**:
- [ ] Endpoint: `GET /api/v1/streams/deals`
- [ ] Type: EventSource (Server-Sent Events)
- [ ] Events published:
  ```javascript
  // When deal is created:
  event: message
  data: {
    "type": "deal.created",
    "payload": { "id": "deal-123", "name": "..." }
  }

  // When deal stage changes:
  event: message
  data: {
    "type": "deal.updated",
    "payload": { "id": "deal-123", "stage": "won" }
  }
  ```

**Frontend Connection**:
```bash
EventSource("http://localhost:8080/api/v1/streams/deals")
# Connected in: src/components/providers/DealsSSEProvider.tsx
```

**Notification Stream**:
- [ ] Endpoint: `GET /api/v1/streams/notifications`
- [ ] Events: Notification created/updated
- [ ] Frontend Connection: `/src/components/notifications/NotificationsProvider.tsx`

**Key Feature**: Automatic React Query cache invalidation on SSE events
```typescript
// src/lib/api/hooks.ts
onMessage: (event) => {
  const data = JSON.parse(event.data);
  queryClient.invalidateQueries(['deals']);  // Refetch deals
}
```

---

## Phase 3: Admin/Advanced Features

### Admin APIs
- [ ] `GET /api/v1/admin/users` - List users
- [ ] `POST /api/v1/admin/users` - Create user
- [ ] `GET /api/v1/admin/dictionaries` - Reference data
- [ ] `GET /api/v1/admin/audit` - Audit logs
- [ ] `GET /api/v1/admin/audit/export` - Export audit

**Frontend Location**: `/src/app/(app)/admin/page.tsx`

### Document Management
- [ ] `GET /api/v1/crm/deals/{id}/documents` - List documents
- [ ] `POST /api/v1/crm/deals/{id}/documents` - Upload document
- [ ] File storage at: `DOCUMENTS_STORAGE_ROOT` (configured in backend)

**Frontend Code**: `/src/components/deals/details/DealDocuments.tsx`

### Notifications Service
- [ ] `GET /api/v1/notifications/feed` - Notification list
- [ ] `PATCH /api/v1/notifications/{id}/read` - Mark as read
- [ ] `PATCH /api/v1/notifications/channels/{channel}` - Channel settings

**Frontend Location**: `/src/app/(app)/notifications/page.tsx`

---

## Configuration Checklist

### Frontend .env Configuration

**Development (.env.local)**:
```bash
# Make sure these are set correctly before running pnpm dev

NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1
NEXT_PUBLIC_AUTH_DISABLED=true              # Set to false for real auth
NEXT_PUBLIC_CRM_SSE_URL=http://localhost:8080/api/v1/streams/deals
NEXT_PUBLIC_NOTIFICATIONS_SSE_URL=http://localhost:8080/api/v1/streams/notifications
FRONTEND_PROXY_TIMEOUT=15000                # Client-side timeout (ms)
FRONTEND_SERVER_TIMEOUT_MS=7500             # Server-side timeout (ms)
```

**Production (.env)**:
```bash
NEXT_PUBLIC_API_BASE_URL=http://gateway:8080/api/v1
NEXT_PUBLIC_AUTH_DISABLED=false             # Require real auth
NEXT_PUBLIC_CRM_SSE_URL=http://gateway:8080/api/v1/streams/deals
NEXT_PUBLIC_NOTIFICATIONS_SSE_URL=http://gateway:8080/api/v1/streams/notifications
FRONTEND_PROXY_TIMEOUT=20000                # Increase for production
FRONTEND_SERVER_TIMEOUT_MS=10000
```

### Backend Configuration (for Gateway)

**Required Headers**:
```
CORS headers:
  Access-Control-Allow-Origin: http://localhost:3000  (dev) or https://your-domain.com (prod)
  Access-Control-Allow-Credentials: true
  Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS
  Access-Control-Allow-Headers: Content-Type, Authorization, X-Tenant-ID

Content-Type:
  application/json
```

**Session Management**:
```
Set-Cookie header with:
  access_token={jwt_token}; HttpOnly; Secure (prod only); SameSite=Strict; Path=/
  refresh_token={refresh_token}; HttpOnly; Secure (prod only); SameSite=Strict; Path=/; Max-Age=604800
```

**SSE Configuration**:
```
For Gateway -> CRM SSE proxying:
  proxy_buffering off;          # Required for SSE
  proxy_set_header Connection "keep-alive";
  proxy_set_header Cache-Control "no-cache";
  proxy_set_header Pragma "no-cache";
```

---

## Testing Checklist

### Manual Integration Testing

**Step 1: Verify Connectivity**
```bash
# Terminal 1: Start frontend
cd /c/Dev/CRM_2.0/frontend
pnpm dev

# Terminal 2: Test API connectivity
curl http://localhost:8080/health
curl http://localhost:8080/api/v1/crm/deals

# Browser: Open http://localhost:3000
# Should show frontend (with or without data depending on backend)
```

**Step 2: Test Deal CRUD**
```bash
# In frontend browser console:

// 1. List deals
fetch('http://localhost:8080/api/v1/crm/deals')
  .then(r => r.json())
  .then(console.log)

// 2. Create deal
fetch('http://localhost:8080/api/v1/crm/deals', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Test Deal',
    client_id: 'client-123',
    next_review_at: '2025-11-01T00:00:00Z'
  })
}).then(r => r.json()).then(console.log)
```

**Step 3: Test Authentication**
```bash
# 1. Login
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# 2. Get current user (with token)
curl http://localhost:8080/api/v1/auth/me \
  -H "Authorization: Bearer {access_token}"

# 3. Check cookies in frontend
# Open DevTools > Application > Cookies
# Should see: access_token, refresh_token
```

**Step 4: Test SSE Streams**
```bash
# Terminal: Test SSE connection
curl --no-buffer http://localhost:8080/api/v1/streams/deals

# Should see heartbeat messages every 15 seconds
# Or messages when deals are created

# In frontend:
# Open DevTools > Network
# Should see EventSource connection to /api/v1/streams/deals
# Status: 200, Type: EventSource
```

**Step 5: Test Real-Time Updates**
```bash
# Terminal 1: Monitor SSE events
curl --no-buffer http://localhost:8080/api/v1/streams/deals

# Terminal 2: Create a deal
curl -X POST http://localhost:8080/api/v1/crm/deals \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","client_id":"123","next_review_at":"2025-11-01T00:00:00Z"}'

# Terminal 1: Should show deal.created event
# Frontend: Should update without page refresh
```

### Automated Testing
```bash
# Run frontend tests
pnpm test                # Unit tests
pnpm test:e2e           # E2E tests (requires backend running)
pnpm type-check         # Type checking
pnpm lint               # ESLint check
```

---

## Troubleshooting Integration

### Issue: "Failed to fetch" on page load
**Diagnosis**:
```bash
# Check if Gateway is running
curl http://localhost:8080/health

# Check if API endpoint is accessible
curl http://localhost:8080/api/v1/crm/deals -v

# Check CORS headers
curl -i http://localhost:8080/api/v1/crm/deals
```

**Solution**:
1. Ensure Gateway is running on port 8080
2. Verify CRM service is connected to Gateway
3. Check Gateway CORS configuration
4. Check firewall/network connectivity

### Issue: Authentication not working
**Diagnosis**:
```bash
# Check Auth service endpoint
curl http://localhost:8080/api/v1/auth/me
# Should return 401 (no token)

# Test with token
curl http://localhost:8080/api/v1/auth/me \
  -H "Authorization: Bearer {token}"
# Should return user data or 401 if token invalid
```

**Solution**:
1. Ensure Auth service is connected to Gateway
2. Verify JWT secret matches between Auth and Gateway
3. Check token cookie is being set
4. Verify token format (Bearer {token})

### Issue: SSE streams not connecting
**Diagnosis**:
```bash
# Check SSE endpoint
curl --no-buffer http://localhost:8080/api/v1/streams/deals -v
# Should see: Transfer-Encoding: chunked, no Content-Length

# Monitor events (should see heartbeat)
curl --no-buffer http://localhost:8080/api/v1/streams/deals | head -20
```

**Solution**:
1. Verify Gateway is proxying SSE correctly
2. Check nginx config has `proxy_buffering off`
3. Check CRM SSE endpoint is running
4. Monitor Gateway/CRM logs for errors

### Issue: Mock data not showing
**Diagnosis**:
```bash
# Check if AUTH_DISABLED is set
echo $NEXT_PUBLIC_AUTH_DISABLED

# Check if API base URL is valid
echo $NEXT_PUBLIC_API_BASE_URL
```

**Solution**:
1. Set `NEXT_PUBLIC_AUTH_DISABLED=true` in `.env.local`
2. Clear Next.js cache: `rm -rf .next`
3. Restart dev server: `pnpm dev`
4. Check browser console for errors

---

## Performance Expectations

### Response Times (Target)
- **Client-side requests**: < 500ms (with local backend)
- **Server-side rendering**: < 7.5s timeout
- **SSE reconnection**: 5s initial, up to 30s max
- **React Query cache**: 30s stale time (configurable)

### Browser Metrics
- **First Contentful Paint (FCP)**: < 2s
- **Largest Contentful Paint (LCP)**: < 2.5s
- **Cumulative Layout Shift (CLS)**: < 0.1
- **Time to Interactive (TTI)**: < 3.5s

### Network
- **Bundle size**: ~500KB (uncompressed)
- **SSE connections**: 2 (deals + notifications)
- **API calls on page load**: 2-3 (deals, clients, metrics)
- **Concurrent requests**: max 6 (browser limit)

---

## Rollout Plan

### Week 1: Basic Integration
- [ ] Deploy Gateway on port 8080
- [ ] Deploy CRM service
- [ ] Test `/crm/deals` endpoint
- [ ] Update frontend `.env.local`
- [ ] Verify deal list loads from backend

### Week 2: Authentication
- [ ] Deploy Auth service
- [ ] Setup JWT token issuance
- [ ] Test `/auth/login` endpoint
- [ ] Update frontend auth flow
- [ ] Verify login/logout works

### Week 3: Real-Time Features
- [ ] Setup RabbitMQ for CRM events
- [ ] Configure SSE streams in Gateway
- [ ] Test `/streams/deals` endpoint
- [ ] Verify live updates work
- [ ] Monitor SSE connection stability

### Week 4: Advanced Features
- [ ] Deploy Admin APIs
- [ ] Deploy Documents service
- [ ] Deploy Notifications service
- [ ] Test admin panel
- [ ] Test file uploads

### Week 5: Testing & Optimization
- [ ] Run E2E test suite
- [ ] Performance optimization
- [ ] Security audit
- [ ] Load testing
- [ ] Production readiness review

---

## API Specification Reference

### Deal Object
```json
{
  "id": "deal-123",
  "name": "Enterprise Package Deal",
  "client_id": "client-456",
  "title": "Enterprise Package Deal",
  "description": "Long-term insurance package",
  "status": "active",  // "active", "archived"
  "stage": "negotiation",  // "lead", "qualification", "negotiation", "proposal", "won", "lost"
  "probability": 75,
  "expected_close_date": "2025-11-30",
  "owner_id": "user-789",
  "owner": "John Doe",
  "next_review_at": "2025-10-30T00:00:00Z",
  "created_at": "2025-10-01T00:00:00Z",
  "updated_at": "2025-10-23T10:30:00Z",
  "value": 50000,
  "currency": "RUB"
}
```

### Client Object
```json
{
  "id": "client-456",
  "name": "Acme Corporation",
  "email": "contact@acme.com",
  "phone": "+7 (555) 123-4567",
  "industry": "Manufacturing",
  "city": "Moscow",
  "status": "active",  // "active", "inactive", "archived"
  "owner_id": "user-789",
  "owner": "John Doe",
  "total_deals": 5,
  "lifetime_value": 250000,
  "last_activity_at": "2025-10-23T10:30:00Z",
  "tags": ["enterprise", "premium"],
  "created_at": "2025-10-01T00:00:00Z",
  "updated_at": "2025-10-23T10:30:00Z"
}
```

### Payment Object
```json
{
  "id": "payment-123",
  "deal_id": "deal-123",
  "client_id": "client-456",
  "amount": 50000,
  "currency": "RUB",
  "status": "planned",  // "planned", "confirmed", "received", "overdue"
  "planned_posted_at": "2025-11-01T00:00:00Z",
  "actual_posted_at": null,
  "confirmed_at": null,
  "confirmed_by": null,
  "incomes": [...],
  "expenses": [...],
  "created_at": "2025-10-01T00:00:00Z",
  "updated_at": "2025-10-23T10:30:00Z"
}
```

---

## Support & Next Steps

**Frontend is Ready**: All UI/UX complete, mock data working, just needs backend services

**Backend Prerequisites**:
1. Gateway API running and healthy
2. CRM service with deal endpoints
3. Auth service with login endpoint
4. RabbitMQ for event publishing
5. SSE stream setup in Gateway

**Questions?**:
- Check `/FRONTEND_ANALYSIS_REPORT.md` for detailed architecture
- Review API client implementation: `/src/lib/api/client.ts`
- Check mock data: `/src/mocks/data.ts`
- Review integration examples in component files

**Current Status**: ✅ Frontend ready, ⏳ Awaiting backend deployment
