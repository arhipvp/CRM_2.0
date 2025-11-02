# Frontend Example - Comprehensive Architecture Analysis

## 1. Project Overview

**Technology Stack:**
- React 19.2.0 with TypeScript
- Vite (Build Tool)
- Tailwind CSS (Styling via Entry Point)
- Google Generative AI SDK (@google/genai) for TTS (Text-to-Speech)
- Fully responsive design with mobile-first approach

**Architecture Pattern:** Client-side state management with React hooks

---

## 2. Component Hierarchy

```
App (Root State Manager)
├── MainLayout (Navigation & Layout)
│   ├── Sidebar Navigation (7 main items)
│   ├── User Profile Dropdown
│   └── Main Content Area
└── View Components (7 Views)
    ├── DealsView
    ├── ClientsView
    ├── PoliciesView
    ├── PaymentsView
    ├── FinanceView
    ├── TasksView
    └── SettingsView
```

## 3. App.tsx State Management

**Central State (8 collections):**
- `view` - Current view
- `modal` - Active modal
- `clients` - All clients
- `deals` - All deals
- `policies` - All policies
- `payments` - All payments
- `financialTransactions` - Financial records
- `selectedDealId` - Current deal selection

**Derived State (useMemo):**
- `ALL_USERS` - Unique deal owners
- `selectedDeal` - Current deal object

**24 Handler Functions:**
1. handleSelectDeal
2. handleUpdateReviewDate
3. handleUpdateDealStatus
4. handleUpdateDealTitle
5. handleUpdateDealClient
6. handleAddNote
7. onUpdateNoteStatus
8. handleAddQuote
9. handleDeleteQuote
10. handleAddFile
11. handleDeleteFile
12. handleAddPolicy
13. handleAddPayment
14. handleAddTask
15. handleToggleTask
16. handleAddFinancialTransaction
17. handleAddChatMessage
18. handleMarkAsPaid
19. handleUpdateAmount
20. handleSelectDealFromClientView
21. handleAddClient
22. handleUpdateClient
23. handleAddDeal

---

## 4. View Components

| View | Purpose | Key Features |
|------|---------|--------------|
| DealsView | Deal management | List + Details side-by-side |
| ClientsView | Client management | Grid cards, WhatsApp links |
| PoliciesView | Policy tracking | Sortable table, renewal alerts |
| PaymentsView | Payment tracking | Filterable table |
| FinanceView | Financial summary | Stats cards + transaction tabs |
| TasksView | Task management | Renewal + active + completed |
| SettingsView | User settings | Toggles + email signature |

---

## 5. Form Components (Modal Dialogs)

1. **AddDealForm** - Create new deal
2. **AddClientForm** - Create new client
3. **EditClientForm** - Edit existing client
4. **AddQuoteForm** - Create insurance quote
5. **AddPolicyForm** - Create policy with installments
6. **AddPaymentForm** - Add payment to policy
7. **AddFinancialTransactionForm** - Record financial transaction
8. **CloseDealModal** - Close deal with reason
9. **ConfirmationModal** - Generic confirmation

---

## 6. Data Types

**DealStatus:** Новая | Расчет | Переговоры | Оформление | Ожидает продления | Закрыта
**PolicyType:** Авто | Имущество | Жизнь | Здоровье
**PaymentStatus:** Оплачен | Просрочен | Ожидает
**FinancialTransactionType:** Доход | Расход

**Main Entities:**
- Client (id, name, email, phone, address, birthDate?, notes?)
- Deal (id, title, clientId, status, owner, summary, nextReviewDate, tasks[], notes[], quotes[], files[], chat[], activityLog[])
- Policy (id, policyNumber, type, startDate, endDate, counterparty, salesChannel, clientId, dealId, carBrand?, carModel?, vin?, notes?)
- Payment (id, policyId, clientId, amount, dueDate, status)
- FinancialTransaction (id, description, amount, type, date, paymentDate?, dealId?, policyId?)
- Task (id, description, completed, assignee, dueDate, subtasks?, attachments?)
- Quote (id, insurer, insuranceType, sumInsured, premium, deductible, comments)
- Note (id, content, createdAt, status)

---

## 7. Special Features

### Text-to-Speech (TTS)
- Service: Google Generative AI API (gemini-2.5-flash-preview-tts)
- Voice: Kore (Russian)
- Sample rate: 24000 Hz
- Implementation: TTSButton.tsx + geminiService.ts

### Advanced Filtering
- Multi-field search (deals, clients, policies, payments)
- Status filters
- Date range filters
- Owner/assignee filters
- Sorting by multiple columns

### Searchable Dropdowns
- Used in AddDealForm, AddPolicyForm, ClientDetails
- Click-outside detection
- Highlight matching text
- Accessible with aria attributes

### Task Due Date Notifications
- Color-coded warnings (red/orange)
- Tooltip on hover
- Calculates days remaining

### Policy Renewal Reminders
- Auto-generated tasks
- 30-day window
- Yellow highlighting
- Icons showing urgency

### Inline Editing
- Financial transaction amounts
- Deal titles
- Click to edit, Enter to save, Esc to cancel

---

## 8. Services

**geminiService.ts:**
- `generateAndPlayAudio(text)` - TTS generation and playback
- `generateMockData()` - Initial seed data
- Audio utilities for decoding and playback

**Mock Data:**
- 3 clients (company + individuals)
- 3 deals with various statuses
- 1 policy, 1 payment, 1 transaction

---

## 9. Styling

**Color Palette:**
- Primary: sky-600, sky-700, sky-100
- Success: green-100, green-800
- Warning: yellow-100, orange-100
- Danger: red-100, red-600, red-800
- Neutral: slate-* (full range)

**Responsive Breakpoints:**
- Mobile: < 768px (1 column)
- Tablet: md (768px+)
- Desktop: lg (1024px+)
- Large: xl (1280px+)

---

## 10. Key Implementation Patterns

**State Update Pattern:**
```typescript
setDeals(prevDeals => prevDeals.map(d => 
  d.id === dealId ? { ...d, field: newValue } : d
));
```

**Modal Management:**
```typescript
type Modal = 'addDeal' | 'addClient' | { type: 'editClient'; client: Client } | null;
```

**Click-Outside Detection:**
```typescript
useEffect(() => {
  const handleClickOutside = (event) => {
    if (ref.current && !ref.current.contains(event.target)) {
      // Close
    }
  };
  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, []);
```

**ID Generation:**
- Timestamp-based: `${prefix}-${Date.now()}`
- No UUID library

**Performance:**
- useMemo for derived state
- Dependency arrays carefully managed
- No infinite loops
- Suitable for < 1000 records

---

## 11. Validation Strategy

- Minimal validation (required fields)
- Type safety via TypeScript
- No external validation library
- Error messages in red text

---

## 12. Accessibility

- Aria labels on custom components
- Aria-haspopup, aria-expanded on dropdowns
- Aria-selected on list options
- Sr-only labels for inputs
- Semantic HTML
- Focus management

---

## 13. Integration Points

1. **Backend API Needed:**
   - Replace mock data with real API calls
   - Add data persistence
   - Handle authentication

2. **Environment Variables:**
   - API_KEY for Google Generative AI

3. **Future Enhancements:**
   - Pagination for large datasets
   - Real-time updates (WebSocket)
   - Advanced validation library
   - State management library (Redux/Zustand)
   - Routing library (React Router)

