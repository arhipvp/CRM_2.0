# Deal Management Workflow - API Integration Guide

## Overview

The Deal Management Workflow is designed to work seamlessly with the Gateway API backend. This document provides details on the API contracts, endpoints, and integration points.

---

## API Endpoints

### Base URL Configuration

```typescript
// src/lib/config.ts
export function getApiBaseUrl(): string {
  const base =
    process.env.API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    DEFAULT_API_BASE;
  return resolvePublicUrl(base, PUBLIC_API_FALLBACK_PATH);
}
```

**Environment Variable**:
```bash
NEXT_PUBLIC_API_BASE_URL=http://gateway.example.com/api/v1
```

### Deals Endpoints

#### List Deals with Filters
```
GET /api/v1/deals
Query Parameters:
  - stage: "qualification" | "negotiation" | "proposal" | "closedWon" | "closedLost" | "all"
  - managers: string[] (comma-separated manager IDs)
  - period: "7d" | "30d" | "90d" | "all"
  - search: string (deal name search)
  - page: number (pagination, default 1)
  - limit: number (per page, default 20)

Response:
{
  items: Deal[]
  total: number
  page: number
  pageSize: number
}
```

**Implementation**:
```typescript
// src/lib/api/queries.ts
export const dealsQueryOptions = (filters?: DealFilters) => ({
  queryKey: [dealsQueryKey, filters],
  queryFn: ({ signal }) => apiClient.getDeals(filters, { signal }),
  staleTime: 30_000, // 30 seconds
});
```

---

#### Get Deal Details
```
GET /api/v1/deals/:dealId

Response: DealDetailsData
{
  id: string
  name: string
  clientId: string
  clientName: string
  stage: DealStage
  probability: number
  expectedCloseDate: string (ISO 8601)
  nextReviewAt: string (ISO 8601)
  updatedAt: string (ISO 8601)
  owner: string
  avatarUrl: string (optional)
  riskTags: DealRiskTag[]
  priorityTag: DealPriorityTag
  quickTags: DealQuickTag[]

  // Nested data
  overview: DealOverviewData
  forms: DealFormGroup[]
  policies: DealPolicy[]
  calculations: DealCalculation[]
  actions: DealActionsPanel
  tasksBoard: DealTasksBoard
  documentsV2: DealDocumentCategory[]
  finance: DealFinanceSummary
  activity: ActivityLogEntry[]
}
```

**Implementation**:
```typescript
// src/lib/api/client.ts
async getDealDetails(dealId: string): Promise<DealDetailsData> {
  const { data } = await axiosInstance.get<DealDetailsData>(`/deals/${dealId}`);
  return data;
}
```

---

#### Create Deal
```
POST /api/v1/deals

Request Body:
{
  name: string (required, min 3 chars)
  clientId: string (required, must exist)
  nextReviewAt: string (required, ISO 8601, must be future date)
  owner?: string (optional, user ID)
  description?: string (optional)
}

Response: Deal
{
  id: string (generated server-side)
  name: string
  clientId: string
  clientName: string
  probability: number (defaults to 0.5)
  stage: "qualification" (always starts here)
  owner: string
  updatedAt: string
  nextReviewAt: string
  expectedCloseDate?: string
  ... (plus empty arrays for tasks, notes, documents, payments, activity)
}

Errors:
  400: Validation error (missing required fields, invalid date format)
  404: Client not found
  409: Deal name already exists for client (optional)
```

**Implementation**:
```typescript
// src/lib/api/client.ts
export interface CreateDealPayload {
  name: string;
  clientId: string;
  nextReviewAt: string; // ISO 8601
  owner?: string;
  description?: string;
}

async createDeal(payload: CreateDealPayload): Promise<Deal> {
  const { data } = await axiosInstance.post<Deal>(`/deals`, payload);
  return data;
}

// src/lib/api/hooks.ts
export function useCreateDeal() {
  const queryClient = useQueryClient();

  return useMutation<Deal, unknown, CreateDealVariables>({
    mutationFn: ({ payload }) => apiClient.createDeal(payload),
    onMutate: async ({ optimisticUpdater, optimisticDealId }) => {
      // Optimistic update to deals query
      const previousDeals = queryClient.getQueriesData<Deal[]>({
        queryKey: dealsQueryKey,
      });

      if (optimisticUpdater) {
        for (const [queryKey] of previousDeals) {
          queryClient.setQueryData<Deal[] | undefined>(
            queryKey,
            (current) => optimisticUpdater(current)
          );
        }
      }

      return { previousDeals, optimisticDealId };
    },
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (!context) return;
      for (const [queryKey, deals] of context.previousDeals) {
        queryClient.setQueryData(queryKey, deals);
      }
    },
    onSuccess: async () => {
      // Refetch deals and metrics
      await queryClient.invalidateQueries({ queryKey: dealsQueryKey });
      await queryClient.invalidateQueries({ queryKey: dealStageMetricsQueryKey });
    },
  });
}
```

---

#### Update Deal
```
PUT /api/v1/deals/:dealId

Request Body (partial update):
{
  name?: string
  owner?: string
  nextReviewAt?: string (ISO 8601)
  expectedCloseDate?: string (ISO 8601)
  probability?: number (0-1)
  // ... any other updatable fields
}

Response: Deal
{
  id: string
  name: string
  ... (updated fields)
}

Errors:
  400: Validation error
  404: Deal not found
  409: Conflict (concurrent update)
```

**Implementation**:
```typescript
// src/lib/api/client.ts
async updateDeal(dealId: string, updates: Partial<Deal>): Promise<Deal> {
  const { data } = await axiosInstance.put<Deal>(
    `/deals/${dealId}`,
    updates
  );
  return data;
}

// src/components/deals/DealDetails.tsx
const handleSave = async (changes: Record<string, string>) => {
  try {
    await updateDeal({
      dealId,
      changes,
    });
    // Activity log is auto-updated on backend
  } catch (error) {
    setSaveError(formatError(error));
  }
};
```

---

#### Update Deal Stage (Critical for Drag-Drop)
```
PATCH /api/v1/deals/:dealId/stage

Request Body:
{
  stage: DealStage (must be valid transition from current stage)
}

Response: Deal
{
  id: string
  stage: DealStage (new stage)
  updatedAt: string (new timestamp)
  ... (other fields unchanged)
}

Side Effects:
  - Activity entry created automatically
  - Metrics updated
  - SSE event published to other clients

Errors:
  400: Invalid stage transition
  404: Deal not found
  409: Deal is in closing stage (read-only)
```

**Implementation**:
```typescript
// src/lib/api/client.ts
async updateDealStage(dealId: string, stage: DealStage): Promise<Deal> {
  const { data } = await axiosInstance.patch<Deal>(
    `/deals/${dealId}/stage`,
    { stage }
  );
  return data;
}

// src/lib/api/hooks.ts
export function useUpdateDealStage() {
  const queryClient = useQueryClient();

  return useMutation<
    Deal,
    unknown,
    { dealId: string; stage: DealStage; optimisticUpdate: (deal: Deal) => Deal }
  >({
    mutationFn: ({ dealId, stage }) => apiClient.updateDealStage(dealId, stage),
    onMutate: async ({ dealId, optimisticUpdate }) => {
      // Optimistic update
      const previousDeals = queryClient.getQueriesData<Deal[]>({
        queryKey: dealsQueryKey,
      });

      for (const [queryKey] of previousDeals) {
        queryClient.setQueryData<Deal[] | undefined>(queryKey, (deals) =>
          deals?.map((deal) =>
            deal.id === dealId ? optimisticUpdate(deal) : deal
          )
        );
      }

      return { previousDeals, dealId };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      // Rollback
      for (const [queryKey, deals] of context.previousDeals) {
        queryClient.setQueryData(queryKey, deals);
      }
    },
    onSuccess: async () => {
      // Invalidate metrics
      await queryClient.invalidateQueries({ queryKey: dealStageMetricsQueryKey });
    },
  });
}

// src/components/deals/DealFunnelBoard.tsx
const handleDragEnd = ({ active, over }: DragEndEvent) => {
  const nextStage = over.id as PipelineStageKey;
  const dealId = String(active.id);

  updateStageMutation.mutate(
    {
      dealId,
      stage: nextStage,
      optimisticUpdate: (deal) => ({
        ...deal,
        stage: nextStage,
        updatedAt: new Date().toISOString(),
      }),
    },
    {
      onError: (error) => {
        // Show retry button
        setFailedUpdate({ dealId, stage: nextStage });
      },
    }
  );
};
```

---

### Deal Metrics Endpoints

#### Get Stage Metrics
```
GET /api/v1/deals/metrics/stage

Query Parameters:
  - period: "7d" | "30d" | "90d" | "all"
  - managers?: string[] (optional filter)

Response: DealStageMetrics[]
[
  {
    stage: "qualification"
    count: number
    totalValue: number (sum of deal values)
    conversionRate: number (0-1, percentage)
    avgCycleDurationDays: number | null
  },
  ... (for each stage)
]
```

**Implementation**:
```typescript
// src/lib/api/hooks.ts
export function useDealStageMetrics(filters?: DealFilters) {
  return useQuery({
    queryKey: [dealStageMetricsQueryKey, filters],
    queryFn: ({ signal }) => apiClient.getDealStageMetrics(filters, { signal }),
    staleTime: 60_000, // 60 seconds
  });
}
```

---

### Activity & Journal Endpoints

#### Get Deal Activity
```
GET /api/v1/deals/:dealId/activity

Query Parameters:
  - type?: "note" | "email" | "meeting" | "system"
  - skip?: number (pagination)
  - limit?: number (per page, default 20)

Response: ActivityLogEntry[]
[
  {
    id: string
    type: "note" | "email" | "meeting" | "system"
    author: string
    message: string
    createdAt: string (ISO 8601)
    clientId: string
    dealId?: string
  }
]
```

**Implementation**:
```typescript
// src/lib/api/queries.ts
export const dealActivityQueryOptions = (dealId: string) => ({
  queryKey: ["deal-activity", dealId],
  queryFn: ({ signal }) => apiClient.getDealActivity(dealId, { signal }),
  staleTime: 15_000,
});

// src/components/deals/details/JournalTab.tsx
const entries = useMemo(() => {
  return activity
    .filter((entry) => filter === "all" || entry.type === filter)
    .filter((entry) => {
      if (!normalizedSearch) return true;
      const haystack = `${entry.message} ${entry.author}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
}, [activity, filter, search]);
```

---

### Client Endpoints (for deal creation)

#### List Clients
```
GET /api/v1/clients

Query Parameters:
  - search?: string (filter by name)
  - status?: "active" | "paused" | "archived"
  - page?: number
  - limit?: number

Response: PaginatedResult<Client>
{
  items: Client[]
  total: number
  page: number
  pageSize: number
}
```

**Implementation**:
```typescript
// src/lib/api/hooks.ts
export function useClients() {
  return useQuery({
    queryKey: clientsQueryOptions().queryKey,
    queryFn: ({ signal }) => apiClient.getClients({ signal }),
    staleTime: 5 * 60_000, // 5 minutes
  });
}

// Used in DealFunnelHeader for create deal modal
const { data: clients = [] } = useClients();

// In DealCreateModal
const filteredClients = useMemo(
  () =>
    clients.filter(
      (c) =>
        !clientSearch ||
        c.name.toLowerCase().includes(clientSearch.toLowerCase())
    ),
  [clients, clientSearch]
);
```

---

## Real-Time Updates via SSE

### SSE Stream Configuration

#### Deals Stream
```
GET /api/v1/streams/deals

Persistent connection streaming events:

Event: message
Data: {
  type: "deal.created" | "deal.updated" | "deal.stage_changed"
  dealId: string
  deal: Deal (full deal object)
  timestamp: string (ISO 8601)
}

Example:
{
  "type": "deal.updated",
  "dealId": "deal-1",
  "deal": {
    "id": "deal-1",
    "name": "Updated Name",
    "stage": "negotiation",
    ...
  },
  "timestamp": "2025-10-23T12:00:00Z"
}
```

**Implementation**:
```typescript
// src/lib/sse/createEventStream.ts
export function createEventStream(
  url: string,
  onMessage: (event: any) => void,
  onError?: (error: Error) => void
): EventSource {
  const eventSource = new EventSource(url);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (error) {
      console.error("Failed to parse SSE message", error);
    }
  };

  eventSource.onerror = () => {
    if (onError) {
      onError(new Error("SSE connection failed"));
    }
  };

  return eventSource;
}

// src/components/providers/SSEBridge.tsx
export function SSEBridge() {
  const dealsStreamUrl = `${getApiBaseUrl()}/streams/deals`;

  useEffect(() => {
    const eventSource = createEventStream(
      dealsStreamUrl,
      (data) => {
        // Invalidate deals queries to refetch
        queryClient.invalidateQueries({ queryKey: dealsQueryKey });

        // Update metrics
        queryClient.invalidateQueries({ queryKey: dealStageMetricsQueryKey });

        // Show highlight on updated deal
        if (data.dealId) {
          highlightDeal(data.dealId);
        }
      }
    );

    return () => eventSource.close();
  }, []);

  return null;
}
```

---

## Request/Response Type Definitions

### TypeScript Interfaces

```typescript
// src/types/crm.ts

export type DealStage =
  | "qualification"
  | "negotiation"
  | "proposal"
  | "closedWon"
  | "closedLost";

export interface Deal {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  probability: number; // 0-1
  stage: DealStage;
  owner: string;
  updatedAt: string; // ISO 8601
  nextReviewAt: string; // ISO 8601
  expectedCloseDate?: string; // ISO 8601

  // Relations
  tasks: Task[];
  notes: DealNote[];
  documents: DealDocument[];
  payments: Payment[];
  activity: ActivityLogEntry[];

  // UI
  avatarUrl?: string;
  riskTags?: DealRiskTag[];
  priorityTag?: DealPriorityTag;
  quickTags?: DealQuickTag[];
}

export interface DealDetailsData extends Deal {
  // Extended details
  overview: DealOverviewData;
  forms: DealFormGroup[];
  policies: DealPolicy[];
  calculations: DealCalculation[];
  actions: DealActionsPanel;
  tasksBoard: DealTasksBoard;
  documentsV2: DealDocumentCategory[];
  finance: DealFinanceSummary;
}

export interface DealFilters {
  stage?: DealStage | "all";
  managers?: string[];
  period?: "7d" | "30d" | "90d" | "all";
  search?: string;
}

export interface DealStageMetrics {
  stage: DealStage;
  count: number;
  totalValue: number;
  conversionRate: number; // 0-1
  avgCycleDurationDays: number | null;
}
```

---

## Error Handling

### API Error Format

```typescript
// src/lib/api/client.ts

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
  }
}

// Error responses from API:
{
  error: {
    code: "VALIDATION_ERROR" | "NOT_FOUND" | "UNAUTHORIZED" | ...
    message: "Human readable message"
    details?: {
      field1: "error message"
      field2: "error message"
    }
  }
}

// Frontend handling:
try {
  await createDeal(payload);
} catch (error) {
  if (error instanceof ApiError) {
    if (error.status === 400) {
      // Validation error - show field errors
      setErrors(error.details);
    } else if (error.status === 404) {
      // Resource not found
      showNotification("Клиент не найден");
    } else if (error.status === 409) {
      // Conflict
      showNotification("Сделка уже существует");
    }
  }
}
```

---

## Performance Optimization

### Query Caching Strategy

```typescript
// Stale times (how long before data needs refetching)

export const dealsQueryOptions = (filters?: DealFilters) => ({
  queryKey: [dealsQueryKey, filters],
  queryFn: async ({ signal }) => apiClient.getDeals(filters, { signal }),
  staleTime: 30_000,        // 30 seconds - frequently changes
  gcTime: 5 * 60_000,       // 5 minutes - keep in cache
  refetchOnWindowFocus: true // Refetch when user returns
});

export const dealDetailsQueryOptions = (dealId: string) => ({
  queryKey: ["deal-details", dealId],
  queryFn: async ({ signal }) => apiClient.getDealDetails(dealId, { signal }),
  staleTime: 60_000,        // 60 seconds
  gcTime: 10 * 60_000,      // 10 minutes
  refetchOnWindowFocus: true
});

export const dealStageMetricsQueryOptions = () => ({
  queryKey: dealStageMetricsQueryKey,
  queryFn: async ({ signal }) => apiClient.getDealStageMetrics({ signal }),
  staleTime: 60_000,        // 60 seconds
  gcTime: 10 * 60_000,      // 10 minutes
  refetchOnWindowFocus: true
});
```

### Optimistic Updates

```typescript
// Example: Stage change with optimistic update

const handleDragEnd = ({ active, over }: DragEndEvent) => {
  const nextStage = over.id as PipelineStageKey;
  const dealId = String(active.id);

  updateStageMutation.mutate(
    {
      dealId,
      stage: nextStage,
      optimisticUpdate: (deal) => ({
        ...deal,
        stage: nextStage,
        updatedAt: new Date().toISOString(),
      }),
    },
    {
      onMutate: async (variables) => {
        // Step 1: Cancel any outgoing queries to this deal
        await queryClient.cancelQueries({
          queryKey: ["deal-details", dealId],
        });

        // Step 2: Snapshot old data
        const previousDeals = queryClient.getQueryData<Deal[]>(dealsQueryKey);

        // Step 3: Update UI optimistically
        if (previousDeals) {
          queryClient.setQueryData<Deal[]>(
            dealsQueryKey,
            previousDeals.map((deal) =>
              deal.id === dealId ? variables.optimisticUpdate(deal) : deal
            )
          );
        }

        return { previousDeals };
      },
      onError: (_error, _variables, context) => {
        // Rollback on error
        if (context?.previousDeals) {
          queryClient.setQueryData(dealsQueryKey, context.previousDeals);
        }
      },
      onSuccess: () => {
        // Server confirmed, update is already applied optimistically
        // Just refetch if needed for cache consistency
        queryClient.invalidateQueries({ queryKey: dealStageMetricsQueryKey });
      },
    }
  );
};
```

---

## Authentication & Authorization

### Header Management

```typescript
// src/lib/api/client.ts

class ApiClient {
  private authToken: string | null = null;

  setAuthToken(token: string | null) {
    this.authToken = token;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.authToken) {
      headers["Authorization"] = `Bearer ${this.authToken}`;
    }

    return headers;
  }
}

// Auth disabled mode (development)
if (isAuthDisabled()) {
  apiClient.setAuthToken(null); // No token needed
}

// Regular mode
// Auth service manages token storage and refresh
```

---

## Testing the Integration

### Mock Service Worker (MSW) Setup

```typescript
// src/mocks/handlers.ts

export const handlers = [
  // Deals endpoints
  http.get("*/api/v1/deals", ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get("search");
    const stage = url.searchParams.get("stage");

    let deals = dealsMock;

    if (search) {
      deals = deals.filter((d) =>
        d.name.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (stage && stage !== "all") {
      deals = deals.filter((d) => d.stage === stage);
    }

    return HttpResponse.json({
      items: deals,
      total: deals.length,
      page: 1,
      pageSize: 20,
    });
  }),

  http.post("*/api/v1/deals", async ({ request }) => {
    const payload = await request.json() as CreateDealPayload;

    const newDeal: Deal = {
      id: `deal-${Math.random()}`,
      name: payload.name,
      clientId: payload.clientId,
      clientName: "Test Client",
      stage: "qualification",
      probability: 0.5,
      owner: payload.owner || "System",
      updatedAt: new Date().toISOString(),
      nextReviewAt: payload.nextReviewAt,
      tasks: [],
      notes: [],
      documents: [],
      payments: [],
      activity: [],
    };

    return HttpResponse.json(newDeal, { status: 201 });
  }),

  http.patch("*/api/v1/deals/:dealId/stage", async ({ request, params }) => {
    const { dealId } = params;
    const { stage } = await request.json() as { stage: DealStage };

    const deal = dealsMock.find((d) => d.id === dealId);
    if (!deal) {
      return HttpResponse.json(
        { error: { code: "NOT_FOUND", message: "Deal not found" } },
        { status: 404 }
      );
    }

    deal.stage = stage;
    deal.updatedAt = new Date().toISOString();

    return HttpResponse.json(deal);
  }),
];
```

---

## Production Deployment

### Environment Configuration

```bash
# Production .env
NEXT_PUBLIC_API_BASE_URL=https://api.crm.example.com/api/v1
NEXT_PUBLIC_AUTH_DISABLED=false
NEXT_PUBLIC_CRM_SSE_URL=https://api.crm.example.com/api/v1/streams/deals
```

### Docker Build

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN npm install -g pnpm && pnpm install --prod

# Copy source
COPY . .

# Build
RUN pnpm build

# Start
EXPOSE 3000
CMD ["pnpm", "start"]
```

### Health Check

```typescript
// src/app/api/health/route.ts
export async function GET() {
  return Response.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
```

---

## Troubleshooting Common Integration Issues

### Issue: 401 Unauthorized

**Cause**: Token expired or invalid
**Solution**:
```typescript
// Auth service refreshes token automatically
// Or, if auth disabled, ensure NEXT_PUBLIC_AUTH_DISABLED=true
```

---

### Issue: CORS Errors

**Cause**: Gateway CORS headers missing
**Solution**:
```
// In Gateway/API:
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Credentials: true
```

---

### Issue: SSE Connection Fails

**Cause**: Nginx buffering enabled
**Solution**:
```nginx
location /api/v1/streams/ {
  proxy_pass http://backend;
  proxy_buffering off;
  proxy_cache off;
  proxy_http_version 1.1;
  proxy_set_header Connection "keep-alive";
}
```

---

### Issue: Drag-Drop Not Updating Server

**Cause**: Network request failing silently
**Solution**:
1. Check network tab in DevTools
2. Verify endpoint URL is correct
3. Check server logs for errors
4. Enable error notification (already implemented)

---

## Performance Metrics

### Target Metrics

```
First Contentful Paint (FCP): < 1.5s
Largest Contentful Paint (LCP): < 2.5s
Cumulative Layout Shift (CLS): < 0.1
Time to Interactive (TTI): < 3s
```

### Monitoring

```typescript
// Monitor performance
import { getCLS, getFCP, getFID, getLCP, getTTFB } from 'web-vitals';

getCLS(console.log);
getFCP(console.log);
getFID(console.log);
getLCP(console.log);
getTTFB(console.log);
```

---

## API Versioning

Current version: **v1**

Future versions will maintain backward compatibility or provide migration paths.

---

**API Integration Guide Version**: 1.0
**Last Updated**: 2025-10-23
**Status**: Complete
