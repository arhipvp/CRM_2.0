# Deal Management Workflow - Quick Reference Guide

## Quick Navigation

### Pages
- **Deals List**: `/deals`
- **Deal Details**: `/deals/[dealId]`
- **Login**: `/login` (if auth enabled)

### Key Files

#### Components
```
src/components/deals/
├── DealFunnelBoard.tsx          → Kanban board view
├── DealFunnelTable.tsx          → Table view
├── DealFunnelHeader.tsx         → Filters & create
├── DealCard.tsx                 → Card component
├── DealCreateModal.tsx          → Create dialog
├── DealDetails.tsx              → Main details page
└── details/
    ├── OverviewTab.tsx          → Overview
    ├── FormsTab.tsx             → Edit fields
    ├── CalculationsTab.tsx      → Calculations
    ├── PoliciesTab.tsx          → Policies
    ├── JournalTab.tsx           → Activity log
    ├── ActionsTab.tsx           → Quick actions
    ├── TasksTab.tsx             → Tasks
    ├── DocumentsTab.tsx         → Documents
    └── FinanceTab.tsx           → Finance
```

#### API & Hooks
```
src/lib/api/
├── client.ts                    → API client
├── hooks.ts                     → React hooks
└── queries.ts                   → Query config

Key Hooks:
- useDeals()                      → List deals
- useDealDetails(id)             → Deal details
- useCreateDeal()                → Create deal
- useUpdateDeal(id)              → Update deal
- useUpdateDealStage()           → Change stage
```

#### Types & Data
```
src/types/crm.ts                → Type definitions
src/mocks/data.ts               → Mock data
src/stores/uiStore.ts           → UI state
```

---

## Common Tasks

### Display Deals List

```typescript
import { useDeals } from '@/lib/api/hooks';

function DealsList() {
  const { data: deals, isLoading } = useDeals({ stage: 'qualification' });

  if (isLoading) return <Skeleton />;

  return deals.map(deal => <DealCard key={deal.id} deal={deal} />);
}
```

### Create New Deal

```typescript
import { useCreateDeal } from '@/lib/api/hooks';

function CreateDeal() {
  const { mutateAsync: createDeal } = useCreateDeal();

  const handleSubmit = async (formData) => {
    const newDeal = await createDeal({
      payload: {
        name: formData.name,
        clientId: formData.clientId,
        nextReviewAt: formData.nextReviewAt,
        owner: formData.owner,
      },
      optimisticUpdater: (deals) => [
        { id: 'temp-id', ...formData, stage: 'qualification' },
        ...deals,
      ],
    });
  };
}
```

### Update Deal Stage

```typescript
import { useUpdateDealStage } from '@/lib/api/hooks';

function MoveDeal() {
  const { mutate } = useUpdateDealStage();

  const handleDragEnd = (event) => {
    mutate({
      dealId: event.active.id,
      stage: event.over.id,
      optimisticUpdate: (deal) => ({
        ...deal,
        stage: event.over.id,
      }),
    });
  };
}
```

### Get Deal Details

```typescript
import { useDealDetails } from '@/lib/api/hooks';

function DealDetailsPage({ dealId }) {
  const { data: deal, isLoading, error } = useDealDetails(dealId);

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div>
      <h1>{deal.name}</h1>
      <p>Client: {deal.clientName}</p>
      <p>Stage: {deal.stage}</p>
    </div>
  );
}
```

### Edit Deal

```typescript
import { useUpdateDeal } from '@/lib/api/hooks';

function EditDeal({ dealId }) {
  const { mutate: updateDeal } = useUpdateDeal(dealId);

  const handleSave = (changes) => {
    updateDeal({
      dealId,
      changes,
    });
  };

  return <FormsTab onSave={handleSave} />;
}
```

### Access Deal Stage Metrics

```typescript
import { useDealStageMetrics } from '@/lib/api/hooks';

function MetricsPanel() {
  const { data: metrics } = useDealStageMetrics({ period: '30d' });

  return metrics.map(m => (
    <div key={m.stage}>
      {m.stage}: {m.count} deals, {Math.round(m.conversionRate * 100)}% conversion
    </div>
  ));
}
```

---

## State Management

### UI State (Zustand)

```typescript
import { useUiStore } from '@/stores/uiStore';

// Filters
const filters = useUiStore(state => state.filters);
const setFilters = useUiStore(state => state.setFilters);

// View mode
const viewMode = useUiStore(state => state.viewMode);
const setViewMode = useUiStore(state => state.setViewMode);

// Selected deals
const selectedDealIds = useUiStore(state => state.selectedDealIds);
const toggleDealSelection = useUiStore(state => state.toggleDealSelection);

// Notifications
const pushNotification = useUiStore(state => state.pushNotification);
pushNotification({
  id: 'notif-1',
  message: 'Deal created',
  type: 'success',
  timestamp: new Date().toISOString(),
  source: 'crm',
});

// Deal details tab
const activeTab = useUiStore(state => state.dealDetailsTab);
const setActiveTab = useUiStore(state => state.setDealDetailsTab);
```

### Server State (React Query)

```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query';

const queryClient = useQueryClient();

// Manual invalidation
queryClient.invalidateQueries({ queryKey: ['deals'] });
queryClient.invalidateQueries({ queryKey: ['deal-details', dealId] });

// Manual refetch
const { refetch } = useQuery({...});
refetch();

// Cancel queries
queryClient.cancelQueries({ queryKey: ['deals'] });
```

---

## Component Examples

### Deal Card

```typescript
import { DealCard } from '@/components/deals/DealCard';

<DealCard
  deal={deal}
  selected={isSelected}
  onToggleSelect={() => toggleSelection(deal.id)}
  onOpenPreview={() => openPreview(deal.id)}
  highlighted={deal.id === highlightedId}
  isDragging={isDragging}
/>
```

### Deal Details

```typescript
import { DealDetails } from '@/components/deals/DealDetails';

<DealDetails dealId={dealId} />
```

### Forms Tab

```typescript
import { FormsTab } from '@/components/deals/details/FormsTab';

<FormsTab
  groups={deal.forms}
  onFieldChange={(groupId, fieldId, value) => {
    // Handle change
  }}
/>
```

### Journal Tab

```typescript
import { JournalTab } from '@/components/deals/details/JournalTab';

<JournalTab activity={deal.activity} />
```

---

## Data Types

### Deal
```typescript
interface Deal {
  id: string
  name: string
  clientId: string
  clientName: string
  stage: DealStage  // "qualification" | "negotiation" | "proposal" | "closedWon" | "closedLost"
  probability: number  // 0-1
  owner: string
  updatedAt: string  // ISO 8601
  nextReviewAt: string  // ISO 8601
  expectedCloseDate?: string  // ISO 8601

  tasks: Task[]
  notes: DealNote[]
  documents: DealDocument[]
  payments: Payment[]
  activity: ActivityLogEntry[]

  avatarUrl?: string
  riskTags?: DealRiskTag[]
  priorityTag?: DealPriorityTag
  quickTags?: DealQuickTag[]
}
```

### DealFilters
```typescript
interface DealFilters {
  stage?: DealStage | "all"
  managers?: string[]
  period?: "7d" | "30d" | "90d" | "all"
  search?: string
}
```

### DealStageMetrics
```typescript
interface DealStageMetrics {
  stage: DealStage
  count: number
  totalValue: number
  conversionRate: number  // 0-1
  avgCycleDurationDays: number | null
}
```

---

## API Endpoints

### GET /api/v1/deals
Get deals list with filters

**Params**: `stage`, `managers`, `period`, `search`

### POST /api/v1/deals
Create new deal

**Body**: `{ name, clientId, nextReviewAt, owner?, description? }`

### GET /api/v1/deals/:dealId
Get deal details

### PUT /api/v1/deals/:dealId
Update deal fields

**Body**: Partial Deal object

### PATCH /api/v1/deals/:dealId/stage
Change deal stage

**Body**: `{ stage: DealStage }`

### GET /api/v1/deals/metrics/stage
Get stage metrics

**Params**: `period`, `managers?`

### GET /api/v1/deals/:dealId/activity
Get deal activity log

**Params**: `type`, `skip`, `limit`

---

## Configuration

### Environment Variables

```bash
# Required
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1

# Optional
NEXT_PUBLIC_AUTH_DISABLED=true  # Enable mock auth
NEXT_PUBLIC_CRM_SSE_URL=http://localhost:8080/api/v1/streams/deals
NEXT_PUBLIC_NOTIFICATIONS_SSE_URL=http://localhost:8080/api/v1/streams/notifications
```

### Build & Start

```bash
# Dev
pnpm dev

# Production
pnpm build
pnpm start

# Docker
docker build -t crm-frontend .
docker run -p 3000:3000 crm-frontend
```

---

## Testing

### Run Tests

```bash
# All tests
pnpm test

# Watch mode
pnpm test:watch

# E2E
pnpm test:e2e

# E2E UI
pnpm test:e2e --ui
```

### Test Examples

```typescript
import { render, screen } from '@testing-library/react';
import { DealCard } from '@/components/deals/DealCard';

it('displays deal name', () => {
  const deal = { id: '1', name: 'Test Deal', ... };
  render(<DealCard deal={deal} />);

  expect(screen.getByText('Test Deal')).toBeInTheDocument();
});
```

---

## Debugging

### Browser DevTools

```javascript
// React DevTools
// - Inspect components
// - View props/state
// - Edit state in real-time

// React Query DevTools
// - View query cache
// - Refetch queries
// - Inspect mutations

// Network Tab
// - Check API calls
// - Verify request/response
// - Check for CORS errors

// Console
// - View logs
// - Check for errors
// - Run API calls manually
```

### Next.js Dev Server

```bash
# Start with verbose logging
DEBUG=* pnpm dev

# Check build output
pnpm build 2>&1 | grep -i error

# Type check
pnpm type-check
```

---

## Performance Tips

1. **Use React Query**: Always fetch data through hooks, not direct API calls
2. **Memoize**: Use `useMemo` for expensive computations
3. **Lazy Load**: Components load on demand
4. **Images**: Use Next.js `Image` component for optimization
5. **Code Splitting**: Routes automatically code-split
6. **Avoid Re-renders**: Use proper key props, memoization

---

## Common Issues

### Page Returns 404
**Fix**: Ensure `NEXT_PUBLIC_AUTH_DISABLED=true` in .env.local

### No Deals Visible
**Check**:
- Mock data loaded
- API returning data
- Filters not hiding all deals

### Drag-Drop Not Working
**Check**:
- dnd-kit installed
- DndContext wrapping board
- Browser supports drag events

### Styles Not Applied
**Fix**:
- Run `pnpm build`
- Clear browser cache
- Check Tailwind configuration

### API Calls Failing
**Check**:
- Backend running on localhost:8080
- CORS headers present
- `NEXT_PUBLIC_API_BASE_URL` correct

---

## Useful Links

- [Next.js Docs](https://nextjs.org/docs)
- [React Query Docs](https://tanstack.com/query/latest)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Zustand Docs](https://github.com/pmndrs/zustand)
- [dnd-kit Docs](https://docs.dndkit.com)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)

---

## Git Workflow

```bash
# Feature branch
git checkout -b feature/deal-feature

# Make changes, then:
git add .
git commit -m "feat: add deal feature"

# Push
git push origin feature/deal-feature

# Create PR on GitHub
# (PR template auto-fills)
```

---

## Code Style

### Naming Conventions
- Components: `PascalCase` (DealCard, DealDetails)
- Hooks: `camelCase` starting with `use` (useDeals, useDealDetails)
- Variables: `camelCase` (dealList, selectedDealId)
- Constants: `UPPER_SNAKE_CASE` (DEAL_STAGE_TITLES, DEAL_UPDATE_TIMEOUT)

### File Organization
- One component per file (+ tests)
- Group related files in directories
- Index files for exports (`index.ts`)
- Use descriptive names

### Import Order
1. React/Third-party
2. App components
3. Hooks/API
4. Types
5. Utilities
6. CSS/styles

Example:
```typescript
import { useState, useEffect } from 'react';
import Link from 'next/link';

import { DealCard } from '@/components/deals/DealCard';
import { useDeals } from '@/lib/api/hooks';
import type { Deal } from '@/types/crm';
import { formatDate } from '@/lib/utils/date';
import styles from './page.module.css';
```

---

## Support

### Documentation
- Implementation Report: `DEAL_WORKFLOW_IMPLEMENTATION_REPORT.md`
- Testing Guide: `DEAL_WORKFLOW_TESTING_GUIDE.md`
- API Integration: `DEAL_WORKFLOW_API_INTEGRATION.md`
- Quick Reference: `DEAL_WORKFLOW_QUICK_REFERENCE.md` (this file)

### Contact
- Check GitHub issues
- Review pull requests
- Check CI/CD logs
- Run local tests

---

## Checklist for New Feature

- [ ] Create component file
- [ ] Add TypeScript types
- [ ] Implement component logic
- [ ] Add unit tests
- [ ] Add E2E test if needed
- [ ] Update documentation
- [ ] Run linter: `pnpm lint`
- [ ] Run type check: `pnpm type-check`
- [ ] Run tests: `pnpm test`
- [ ] Create PR

---

**Last Updated**: 2025-10-23
**Version**: 1.0
