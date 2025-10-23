# CRM Frontend Implementation Guide

## Overview

This guide explains how all 8 CRM frontend features have been implemented, organized, and integrated together. It serves as both a reference for the current implementation and a template for adding new features.

---

## Architecture Overview

### Layer Structure

```
┌─────────────────────────────────────────────────────┐
│                    Pages (Next.js App Router)        │
│    (home, deals, payments, tasks, notifications)    │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│         Components (React + Tailwind CSS)            │
│  (Feature-specific: payments, tasks, admin, etc.)   │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│            Hooks & API Integration                   │
│   (React Query for data, Zustand for state)         │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│              API Client Layer                        │
│     (Axios-based, error handling, caching)         │
└─────────────────────────────────────────────────────┘
```

### Directory Structure

```
frontend/
├── src/
│   ├── app/                          # Next.js App Router pages
│   │   ├── (app)/                    # Main app layout group
│   │   │   ├── layout.tsx            # Shared app layout
│   │   │   ├── page.tsx              # Dashboard home
│   │   │   ├── deals/                # Deal pages
│   │   │   ├── clients/              # Client pages
│   │   │   ├── payments/             # Payments page
│   │   │   ├── tasks/                # Tasks page
│   │   │   ├── notifications/        # Notifications page
│   │   │   └── admin/                # Admin page
│   │   ├── (auth)/                   # Auth layout group
│   │   │   └── login/                # Login page
│   │   └── layout.tsx                # Root layout
│   ├── components/                   # React components
│   │   ├── payments/                 # Payment components
│   │   │   ├── PaymentsTable.tsx     # Main table component
│   │   │   ├── PaymentCard.tsx       # Card component
│   │   │   ├── PaymentFormModal.tsx  # Form modal
│   │   │   └── ...
│   │   ├── tasks/                    # Task components
│   │   │   ├── TaskList.tsx          # Main component
│   │   │   ├── TaskCreateModal.tsx   # Create form
│   │   │   ├── TaskDetailsDrawer.tsx # Details panel
│   │   │   └── ...
│   │   ├── notifications/            # Notification components
│   │   ├── admin/                    # Admin components
│   │   ├── deals/                    # Deal components
│   │   ├── clients/                  # Client components
│   │   └── common/                   # Shared components
│   ├── lib/                          # Utilities
│   │   ├── api/                      # API client
│   │   │   ├── client.ts             # API client class
│   │   │   ├── queries.ts            # React Query options
│   │   │   ├── hooks.ts              # Custom hooks
│   │   │   └── admin/                # Admin API
│   │   ├── utils/                    # Helper functions
│   │   └── ...
│   ├── stores/                       # Zustand stores
│   │   ├── authStore.ts              # Auth state
│   │   ├── uiStore.ts                # UI notifications
│   │   ├── notificationsStore.ts     # Notifications state
│   │   ├── tasksViewStore.ts         # Tasks filters
│   │   └── adminFiltersStore.ts      # Admin filters
│   ├── types/                        # TypeScript types
│   │   ├── crm.ts                    # CRM data types
│   │   ├── notifications.ts          # Notification types
│   │   └── admin.ts                  # Admin types
│   └── mocks/                        # Mock data
│       └── data.ts                   # All mock data
└── tests/
    ├── e2e/                          # E2E tests
    └── fixtures/                     # Test fixtures
```

---

## Feature 1: Payment Tracking Implementation

### File Structure
```
components/payments/
├── PaymentsTable.tsx              # Main component (761 lines)
├── PaymentCard.tsx                # Collapsible card display
├── PaymentFormModal.tsx           # Create/edit form modal
├── PaymentConfirmationModal.tsx   # Receipt confirmation
├── PaymentEntryFormModal.tsx      # Income/expense form
├── PaymentEntryConfirmModal.tsx   # Entry confirmation
├── ConfirmDialog.tsx              # Reusable confirm dialog
├── Modal.tsx                      # Reusable modal
└── __tests__/                     # Component tests
    ├── PaymentCard.test.tsx
    ├── PaymentFormModal.test.tsx
    ├── PaymentsTable.test.tsx
    └── PaymentEntryConfirmModal.test.tsx
```

### Data Flow

```
Page (PaymentsPage)
    ↓
Component (PaymentsTable)
    ├── State: filters, dialog, search
    ├── Hooks:
    │   ├── usePayments()
    │   ├── useCreatePayment()
    │   ├── useUpdatePayment()
    │   ├── useDeletePayment()
    │   ├── useCreatePaymentIncome()
    │   ├── useConfirmPayment()
    │   └── useRevokePaymentConfirmation()
    └── Sub-components:
        ├── PaymentCard (for each payment)
        ├── PaymentFormModal (dialog)
        ├── PaymentEntryFormModal (dialog)
        └── ConfirmDialog (dialog)
```

### Key Components Explained

**PaymentsTable.tsx** (Main Container)
```typescript
// Responsibilities:
// 1. Fetch payments with React Query
// 2. Filter and search payments
// 3. Manage dialog states (create, edit, delete, etc.)
// 4. Handle CRUD operations
// 5. Render child components
// 6. Show notifications

export function PaymentsTable() {
  // Filters: filter, search, expanded (which payments are open)
  // Dialog state: which dialog to show and with what data
  // Mutations: all CRUD operations
  // Derived state: filtered/sorted payments, summary stats
}
```

**PaymentCard.tsx** (Expandable Payment Item)
```typescript
// Responsibilities:
// 1. Display payment summary (collapsed)
// 2. Show payment details (expanded)
// 3. Render income/expense entries
// 4. Provide buttons to edit, delete, add entries
// 5. Show status badges and formatting

export function PaymentCard({
  payment,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onAddIncome,
  // ... other props
}) {
  // Expandable UI pattern
  // Shows summary when collapsed
  // Shows full details when expanded
  // Delegates actions back to parent (PaymentsTable)
}
```

**PaymentFormModal.tsx** (Create/Edit Form)
```typescript
// Responsibilities:
// 1. Provide form for creating/editing payment
// 2. Validate input fields
// 3. Handle form submission
// 4. Show loading state while submitting
// 5. Display error messages

export function PaymentFormModal({
  mode,           // 'create' or 'edit'
  payment,        // Payment data (for edit mode)
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}) {
  // Form validation
  // Pre-fill for edit mode
  // Submit handler
}
```

### State Management Pattern

**Local Component State**:
```typescript
// In PaymentsTable
const [filter, setFilter] = useState<FilterValue>("all");
const [search, setSearch] = useState("");
const [expanded, setExpanded] = useState<Set<string>>(new Set());
const [dialog, setDialog] = useState<DialogState>(null);

// DialogState is a discriminated union:
type DialogState =
  | { type: "createPayment" }
  | { type: "editPayment"; payment: Payment }
  | { type: "confirmPayment"; payment: Payment }
  | null;
```

**React Query (Server State)**:
```typescript
// Fetch data from API
const { data: payments, isLoading, isError, error } = usePayments({
  include: ["incomes", "expenses"],
});

// Mutations with optimistic updates
const { mutateAsync: createPayment, isPending } = useCreatePayment();

// Usage:
const newPayment = await createPayment({
  dealId,
  amount,
  plannedDate,
  // ...
});
```

**Zustand (UI State)**:
```typescript
// Notifications/toasts
const pushNotification = useUiStore((state) => state.pushNotification);

// Usage:
pushNotification({
  id: "unique-id",
  message: "Платёж создан",
  type: "success",
  timestamp: new Date().toISOString(),
  source: "payments",
});
```

### API Hooks Usage

**Payment Hooks** (in `/lib/api/hooks.ts`):
```typescript
// Fetch data
const { data: payments } = usePayments(options);

// Create operation
const { mutateAsync: createPayment, isPending } = useCreatePayment();

// Update operation
const { mutateAsync: updatePayment, isPending } = useUpdatePayment();

// Delete operation
const { mutateAsync: deletePayment, isPending } = useDeletePayment();

// Income operations
const { mutateAsync: createIncome } = useCreatePaymentIncome();
const { mutateAsync: updateIncome } = useUpdatePaymentIncome();
const { mutateAsync: deleteIncome } = useDeletePaymentIncome();

// Expense operations
const { mutateAsync: createExpense } = useCreatePaymentExpense();
const { mutateAsync: updateExpense } = useUpdatePaymentExpense();
const { mutateAsync: deleteExpense } = useDeletePaymentExpense();

// Confirmation operations
const { mutateAsync: confirmPayment } = useConfirmPayment();
const { mutateAsync: revokeConfirmation } = useRevokePaymentConfirmation();
```

### Adding New Features

To add a new payment feature (e.g., bulk payment export):

1. **Add API method** in `/lib/api/client.ts`:
```typescript
async exportPayments(paymentIds: string[]): Promise<Blob> {
  // Call API endpoint
}
```

2. **Add React Query hook** in `/lib/api/hooks.ts`:
```typescript
export function useExportPayments() {
  return useMutation({
    mutationFn: (paymentIds: string[]) =>
      apiClient.exportPayments(paymentIds),
  });
}
```

3. **Use hook in component**:
```typescript
const { mutate: exportPayments, isPending } = useExportPayments();

const handleExport = () => {
  exportPayments(selectedIds, {
    onSuccess: (blob) => {
      downloadFile(blob, "payments.csv");
    },
  });
};
```

---

## Feature 2: Task Management Implementation

### File Structure
```
components/tasks/
├── TaskList.tsx                   # Main component (1,414 lines)
├── TaskCreateModal.tsx            # Create form modal
├── TaskDetailsDrawer.tsx          # Details side panel
├── TaskTableView.tsx              # Table view component
├── TaskKanbanBoard.tsx            # Kanban board component
├── TaskReminderCalendar.tsx       # Date filter calendar
└── __tests__/                     # Tests
```

### Complex State Management

**Task List uses multiple state sources**:

1. **Local State** (in TaskList component):
```typescript
const [viewMode, setViewMode] = useState<'table' | 'kanban'>();
const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
```

2. **Zustand Store** (persistent filters):
```typescript
const viewMode = useTasksViewStore((state) => state.viewMode);
const filters = useTasksViewStore((state) => state.filters);
const setStatuses = useTasksViewStore((state) => state.setStatuses);
const setOwners = useTasksViewStore((state) => state.setOwners);
const setTypes = useTasksViewStore((state) => state.setTypes);
const setTags = useTasksViewStore((state) => state.setTags);
const setDueDate = useTasksViewStore((state) => state.setDueDate);
```

3. **React Query** (server state):
```typescript
const { data: tasks } = useTasks();
const { mutateAsync: createTask } = useCreateTask();
const { mutateAsync: updateTask } = useUpdateTask();
const { mutateAsync: bulkUpdate } = useBulkUpdateTasks();
```

### Filtering Logic

**Complex filter composition**:
```typescript
// Tasks filtered by multiple attributes
const tasksByNonDateFilters = useMemo(() => {
  return filterTasksByAttributes(tasks, {
    statuses,
    owners,
    types,
    tags,
  });
}, [tasks, statuses, owners, types, tags]);

// Then filtered by date range
const filteredTasks = useMemo(() => {
  return tasksByNonDateFilters.filter((task) =>
    isTaskWithinRange(task, dueDate),
  );
}, [tasksByNonDateFilters, dueDate]);
```

### View Modes

**Table View**:
```typescript
<TaskTableView
  tasks={filteredTasks}
  selectedTaskIds={selectedTaskIds}
  onSelectTask={handleSelectTask}
  onSelectAll={handleSelectAll}
  onToggleCompletion={handleToggleCompletion}
  onOpenTask={handleOpenTask}
/>
```

**Kanban View**:
```typescript
<TaskKanbanBoard
  tasks={filteredTasks}
  selectedTaskIds={selectedTaskIds}
  onSelectTask={handleSelectTask}
  onToggleCompletion={handleToggleCompletion}
  onMoveTask={handleMoveTask}
  onOpenTask={handleOpenTask}
/>
```

### Bulk Operations

Bulk update multiple tasks:
```typescript
const handleBulkStatusChange = async (status: TaskStatus) => {
  await bulkUpdate({
    taskIds: selectedTaskIds,
    payload: { status },
  });
};

const handleBulkShiftDueDate = async (shift: number) => {
  await bulkUpdate({
    taskIds: selectedTaskIds,
    payload: {},
    options: { shiftDueDateByDays: shift },
  });
};
```

---

## Feature 3: Notifications Implementation

### File Structure
```
components/notifications/
├── NotificationFeed.tsx           # Main feed component
├── NotificationsHeader.tsx        # Header/title
├── EventJournal.tsx               # Audit log view
├── DeliverySettingsPanel.tsx      # Channel settings
├── NotificationCenter.tsx         # Header notification icon
└── __tests__/                     # Tests
```

### Data Flow

**Notifications come from two sources**:

1. **Real-time SSE Stream** (in providers):
```typescript
// SSEBridge component sets up event listeners
useEffect(() => {
  const dealsStream = new EventSource(DEALS_SSE_URL);

  dealsStream.onmessage = (event) => {
    const data = JSON.parse(event.data);
    // Invalidate React Query cache
    queryClient.invalidateQueries({
      queryKey: ['deal-stage-metrics'],
    });
  };
}, []);
```

2. **API Queries** (polling):
```typescript
const { data: notifications } = useNotificationFeed({
  filters: {
    status: 'all',
    category: 'all',
    source: 'all',
  },
});
```

### State Management

**Notifications Store** (Zustand):
```typescript
interface NotificationsState {
  items: NotificationFeedItem[];
  order: 'newest' | 'oldest';
  filters: NotificationFeedFilters;
  availableCategories: NotificationFilterOption[];
  availableSources: NotificationFilterOption[];

  setFeed: (response: NotificationFeedResponse) => void;
  setFilters: (filters: Partial<NotificationFeedFilters>) => void;
  toggleRead: (id: string) => void;
  toggleImportant: (id: string) => void;
  // ... etc
}
```

### Filtering Implementation

```typescript
// Filter options with counts
const categoryOptions = useMemo(() => {
  const counts = new Map<string, number>();

  for (const notification of items) {
    const key = notification.category;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return CATEGORY_LABELS.map((label, value) => ({
    value,
    label,
    count: counts.get(value),
  }));
}, [items]);

// Build filter chips UI
buildFilterChips(categoryOptions, filters.category, onSelect);
```

---

## Feature 4: Admin Panel Implementation

### File Structure
```
components/admin/
├── UserManagement.tsx             # Users tab (552 lines)
├── DictionaryEditor.tsx           # Dictionaries tab
├── AuditLog.tsx                   # Audit log tab
└── __tests__/                     # Tests
```

### Tabbed Interface

```typescript
export function AdminPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'dictionaries' | 'audit'>('users');

  return (
    <main className="space-y-8">
      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'users' && <UserManagement />}
      {activeTab === 'dictionaries' && <DictionaryEditor />}
      {activeTab === 'audit' && <AuditLog />}
    </main>
  );
}
```

### User Management

**Roles Hierarchy**:
```typescript
interface AdminRole {
  id: string;
  name: string;
  permissions: string[];
  userCount: number;
  systemRole: boolean;
}

// Available roles fetched from API
const { data: roles } = useAdminRoles();
```

**User Operations**:
```typescript
// Create user with form validation
const handleCreateUser = async (values: UserFormState) => {
  const errors = validateForm(values);
  if (Object.keys(errors).length > 0) {
    setFormErrors(errors);
    return;
  }

  const newUser = await createUser({
    fullName: values.fullName,
    email: values.email,
    roleId: values.roleId,
    status: values.status,
  });
};

// Update user
const handleUpdateUser = async (userId: string, values: UserFormState) => {
  await updateUser({
    userId,
    payload: { /* ... */ },
  });
};

// Delete user (with confirmation)
const handleDeleteUser = async (userId: string) => {
  // Show confirmation dialog
  await deleteUser({ userId });
};
```

### Permission Checks

```typescript
// Check if user has permission
const canManageUsers = useHasAdminPermission('manage:users');

// Conditionally render
{canManageUsers && (
  <button onClick={() => setIsCreating(true)}>
    Add User
  </button>
)}
```

---

## Common Patterns & Best Practices

### 1. Optimistic Updates with React Query

```typescript
const { mutateAsync: updatePayment } = useMutation({
  mutationFn: (payload) => api.updatePayment(payload),

  // Optimistic update
  onMutate: async (newData) => {
    // Cancel any outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['payments'] });

    // Get previous data
    const previousPayments = queryClient.getQueryData(['payments']);

    // Update cache with new data
    queryClient.setQueryData(['payments'], (old) => [
      ...old.filter(p => p.id !== newData.paymentId),
      newData,
    ]);

    // Return context for rollback
    return { previousPayments };
  },

  // Rollback on error
  onError: (err, variables, context) => {
    if (context?.previousPayments) {
      queryClient.setQueryData(['payments'], context.previousPayments);
    }
  },

  // Refetch on success
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['payments'] });
  },
});
```

### 2. Form Validation Pattern

```typescript
interface FormErrors {
  field1?: string;
  field2?: string;
}

function validateForm(values: FormValues): FormErrors {
  const errors: FormErrors = {};

  if (!values.field1?.trim()) {
    errors.field1 = "Field is required";
  } else if (condition) {
    errors.field1 = "Invalid format";
  }

  // ... other validations

  return errors;
}

// In component
const [errors, setErrors] = useState<FormErrors>({});

const handleSubmit = (values: FormValues) => {
  const validationErrors = validateForm(values);

  if (Object.keys(validationErrors).length > 0) {
    setErrors(validationErrors);
    return;
  }

  // Proceed with submission
};
```

### 3. Dialog State Management Pattern

```typescript
// Discriminated union for type safety
type DialogState =
  | { type: 'createPayment' }
  | { type: 'editPayment'; payment: Payment }
  | { type: 'deletePayment'; payment: Payment }
  | { type: 'confirmPayment'; payment: Payment }
  | null;

const [dialog, setDialog] = useState<DialogState>(null);

// Opening dialogs
<button onClick={() => setDialog({ type: 'createPayment' })}>
  Create
</button>

// Type-safe access in conditionals
{dialog?.type === 'editPayment' && (
  <PaymentFormModal
    payment={dialog.payment}
    // TypeScript knows payment exists here
  />
)}
```

### 4. Responsive Layout Pattern

```typescript
// Desktop: side-by-side layout
// Mobile: stacked layout
<div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
  <div className="min-w-0">
    {/* Main content */}
  </div>
  <div className="min-w-0">
    {/* Sidebar */}
  </div>
</div>
```

### 5. Empty State Pattern

```typescript
{isLoading ? (
  <LoadingSkeletons />
) : isError ? (
  <ErrorMessage error={error} onRetry={refetch} />
) : items.length === 0 ? (
  <EmptyState>
    <p>No items found</p>
    <button onClick={onCreate}>Create First Item</button>
  </EmptyState>
) : (
  <ItemsList items={items} />
)}
```

### 6. Notification/Toast Pattern

```typescript
// Zustand store
const pushNotification = useUiStore((state) => state.pushNotification);

// Usage
const notify = (message: string, type: 'success' | 'error' = 'success') => {
  pushNotification({
    id: createRandomId(),
    message,
    type,
    timestamp: new Date().toISOString(),
    source: 'feature-name',
  });
};

// In handlers
try {
  await mutation();
  notify('Operation successful', 'success');
} catch (error) {
  notify(error.message, 'error');
}
```

---

## Testing Implementation

### Unit Test Pattern

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaymentCard } from './PaymentCard';

describe('PaymentCard', () => {
  it('renders payment information', () => {
    const mockPayment = { /* ... */ };

    render(
      <PaymentCard
        payment={mockPayment}
        expanded={false}
        onToggle={() => {}}
        // ... other props
      />
    );

    expect(screen.getByText(mockPayment.policyNumber)).toBeInTheDocument();
  });

  it('expands and shows details', async () => {
    const user = userEvent.setup();
    const handleToggle = vi.fn();

    render(
      <PaymentCard
        payment={mockPayment}
        expanded={false}
        onToggle={handleToggle}
        // ... other props
      />
    );

    await user.click(screen.getByRole('button', { name: /expand/ }));
    expect(handleToggle).toHaveBeenCalled();
  });
});
```

### E2E Test Pattern

```typescript
import { test, expect } from '@playwright/test';

test('payment workflow', async ({ page }) => {
  // Navigate to payments page
  await page.goto('/payments');

  // Verify page loaded
  await expect(page.getByRole('heading', { name: 'Платежи' })).toBeVisible();

  // Create new payment
  await page.getByRole('button', { name: /add payment/i }).click();
  await page.getByLabel('Amount').fill('10000');
  await page.getByRole('button', { name: /create/i }).click();

  // Verify payment appears in list
  await expect(page.getByText(/10000/)).toBeVisible();

  // Edit payment
  await page.getByRole('button', { name: /edit/i }).first().click();
  await page.getByLabel('Amount').clear();
  await page.getByLabel('Amount').fill('15000');
  await page.getByRole('button', { name: /save/i }).click();

  // Verify update
  await expect(page.getByText(/15000/)).toBeVisible();
});
```

---

## Adding New Features

### Checklist for Adding a New Module

1. **Create Type Definitions** (`/types/`)
```typescript
export interface MyFeature {
  id: string;
  name: string;
  // ...
}
```

2. **Add API Methods** (`/lib/api/client.ts`)
```typescript
async getMyFeatures(): Promise<MyFeature[]> {
  // Implementation
}

async createMyFeature(data: MyFeaturePayload): Promise<MyFeature> {
  // Implementation
}
```

3. **Create React Query Hooks** (`/lib/api/hooks.ts`)
```typescript
export function useMyFeatures() {
  return useQuery({
    queryKey: ['my-features'],
    queryFn: () => apiClient.getMyFeatures(),
  });
}

export function useCreateMyFeature() {
  return useMutation({
    mutationFn: (data: MyFeaturePayload) =>
      apiClient.createMyFeature(data),
  });
}
```

4. **Create Components** (`/components/myfeature/`)
```typescript
// MainComponent.tsx - Container
export function MyFeatureList() {
  // Data fetching, state management
  // Render sub-components
}

// Card.tsx - Item display
export function MyFeatureCard({ item }) {
  // Display item data
}

// Modal.tsx - Create/Edit form
export function MyFeatureModal() {
  // Form handling
}
```

5. **Create Page** (`/app/(app)/myfeature/page.tsx`)
```typescript
import { MyFeatureList } from '@/components/myfeature/MyFeatureList';

export default function MyFeaturePage() {
  return (
    <main className="container mx-auto px-6 py-8">
      <header className="space-y-2 mb-8">
        <h1>My Feature</h1>
        <p>Description of feature</p>
      </header>
      <MyFeatureList />
    </main>
  );
}
```

6. **Add Navigation Link** (`/components/common/MainNavigation.tsx`)
```typescript
<Link href="/myfeature" className={linkClass}>
  My Feature
</Link>
```

7. **Add Mock Data** (`/mocks/data.ts`)
```typescript
export const myFeatureMock: MyFeature[] = [
  { id: '1', name: 'Item 1', /* ... */ },
  // More items
];
```

8. **Create Tests** (`/components/myfeature/__tests__/`)
```typescript
// MyFeatureList.test.tsx
// Card.test.tsx
// Modal.test.tsx
```

9. **Add E2E Test** (`/tests/e2e/`)
```typescript
test('myfeature workflow', async ({ page }) => {
  // Test complete workflow
});
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All unit tests passing: `pnpm test`
- [ ] All E2E tests passing: `pnpm test:e2e`
- [ ] No TypeScript errors: `pnpm type-check`
- [ ] No ESLint warnings: `pnpm lint`
- [ ] No console errors in browser
- [ ] Tested on desktop, tablet, mobile
- [ ] Dark mode tested
- [ ] Accessibility checked (keyboard nav, screen reader)

### Build

```bash
# Clean install
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Build check
pnpm build

# Type check
pnpm type-check

# Lint check
pnpm lint
```

### Environment Setup

```bash
# .env.local (development)
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1
NEXT_PUBLIC_CRM_SSE_URL=http://localhost:8080/api/v1/streams/deals
NEXT_PUBLIC_NOTIFICATIONS_SSE_URL=http://localhost:8080/api/v1/streams/notifications
NEXT_PUBLIC_AUTH_DISABLED=true

# .env.production (production)
NEXT_PUBLIC_API_BASE_URL=https://api.example.com/api/v1
NEXT_PUBLIC_CRM_SSE_URL=https://api.example.com/api/v1/streams/deals
NEXT_PUBLIC_NOTIFICATIONS_SSE_URL=https://api.example.com/api/v1/streams/notifications
NEXT_PUBLIC_AUTH_DISABLED=false
```

### Docker Deployment

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy dependencies
COPY pnpm-lock.yaml .npmrc package.json ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build
RUN pnpm build

# Start
EXPOSE 3000
CMD ["pnpm", "start"]
```

---

## Troubleshooting

### Common Issues

**Issue**: Build fails with symlink errors on Windows
```
Solution: Run build in Linux/Docker or use WSL2
```

**Issue**: "Module not found" errors
```
Solution: Check tsconfig.json paths, import paths are case-sensitive
```

**Issue**: React Query cache not updating
```
Solution: Call invalidateQueries after mutation
```

**Issue**: Form validation not showing errors
```
Solution: Check if setErrors is called and errors are rendered
```

**Issue**: Dark mode not working
```
Solution: Verify tailwind.config.js has darkMode: 'class'
         Add dark: prefix to classes
         Check if theme switcher is implemented
```

---

## Performance Optimization

### Code Splitting

```typescript
// Dynamic import for large components
const PaymentModal = dynamic(() =>
  import('./PaymentModal').then(mod => mod.PaymentModal),
  { loading: () => <div>Loading...</div> }
);
```

### React Query Optimization

```typescript
// Set appropriate staleTime and cacheTime
queryOptions({
  queryKey: ['payments'],
  queryFn: () => apiClient.getPayments(),
  staleTime: 5 * 60 * 1000,      // 5 minutes
  cacheTime: 10 * 60 * 1000,     // 10 minutes
});
```

### Bundle Analysis

```bash
pnpm install -D @next/bundle-analyzer
# Update next.config.ts with analyzer
pnpm build
```

---

## Summary

This implementation provides:

1. **Modular Architecture**: Each feature is self-contained and reusable
2. **Type Safety**: Full TypeScript coverage
3. **State Management**: Proper separation of concerns (local, UI, server)
4. **Error Handling**: Comprehensive error handling with user feedback
5. **Testing**: Unit and E2E tests for critical paths
6. **Documentation**: Clear patterns and examples
7. **Accessibility**: WCAG compliance
8. **Responsiveness**: Mobile-first design
9. **Performance**: Optimized with React Query and code splitting
10. **Scalability**: Easy to add new features following established patterns

---

**Last Updated**: October 23, 2025
**Status**: PRODUCTION READY
