# Deal Management Workflow - Complete Testing Guide

## Quick Start Testing

### 1. Start the Development Environment

```bash
# Terminal 1: Start Frontend
cd frontend
pnpm dev
# Frontend starts on http://localhost:3000

# Terminal 2: Start Infrastructure (if needed)
docker compose up -d

# Terminal 3: Start Backend Services (optional)
cd backend/gateway
pnpm dev
```

### 2. Access the Application

Navigate to: **http://localhost:3000/deals**

The page should load with:
- Header section with filters and "Новая сделка" button
- 5 pipeline stage columns
- 4 sample deals distributed across stages
- Metrics panel above the board

---

## Test Scenarios - Detailed Steps

### Test 1: View Deals in Kanban Board View

**Expected**: Deals display in correct stage columns with complete information

**Steps**:
1. Open http://localhost:3000/deals
2. Observe the board layout

**Verification Checklist**:
- [ ] Page loads without errors
- [ ] 5 columns visible: Qualification, Negotiation, Proposal, Closed-Won, Closed-Lost
- [ ] Column headers show stage name and description
- [ ] Deal count badges show correct numbers:
  - Qualification: 1 deal
  - Negotiation: 1 deal
  - Proposal: 1 deal
  - Closed-Won: 1 deal
  - Closed-Lost: 0 deals
- [ ] Each deal card displays:
  - [ ] Deal name
  - [ ] Client name (gray text below title)
  - [ ] Probability percentage (top right)
  - [ ] Next review date with color indicator
  - [ ] Manager name (bottom left)
  - [ ] "Открыть" link (opens details)
- [ ] Cards have hover effects (lift slightly)
- [ ] Metrics panel above shows statistics:
  - [ ] Each stage has count, conversion rate, avg cycle duration
  - [ ] Clicking metric highlights that stage

**Sample Deal Locations**:
- Qualification: "Корпоративная страховка" (ООО «Альфа Логистик»)
- Negotiation: "Обновление полиса КАСКО" (ИП Петров)
- Proposal: "Продление ДМС" (АО «Тех Инновации»)
- Closed-Won: "Страхование склада" (ООО «Альфа Логистик»)

---

### Test 2: Switch to Table View

**Expected**: Deals display in table format with sortable columns

**Steps**:
1. From deals page, click "Таблица" button (top right)
2. Board should disappear, table should appear

**Verification Checklist**:
- [ ] Table view button is highlighted/active
- [ ] Kanban view is hidden
- [ ] Table displays all 4 deals
- [ ] Columns: Name, Client, Stage, Manager, Value (if present), Next Review Date
- [ ] Each deal row shows correct information
- [ ] Deals are sortable by next review date
- [ ] Table has same filtering capabilities (period, managers, search)

**Switch Back**:
1. Click "Канбан" button
2. Table should disappear, Kanban board reappears

---

### Test 3: Test Kanban View Filters

**Test 3a: Period Filter**

**Steps**:
1. Click "Период" dropdown (top right)
2. Select "7 дней"
3. Observe board update

**Expected**: Only deals updated in last 7 days visible (may show all 4 sample deals)

**Steps**:
4. Select "30 дней"
5. Select "90 дней"
6. Select "Весь период"

**Verification**: Board updates with each selection

---

**Test 3b: Manager Filter**

**Steps**:
1. Click "Менеджеры" button
2. Dropdown opens with list of managers:
   - [ ] Анна Савельева
   - [ ] Иван Плахов
   - [ ] Мария Орлова
3. Select "Анна Савельева" checkbox
4. Board filters to show only her deals

**Expected Deals**:
- Qualification: "Корпоративная страховка"
- Closed-Won: "Страхование склада"

**Steps**:
5. Select multiple managers (Анна + Иван)
6. Board shows deals for both

**Steps**:
7. Click "Сбросить" to clear filters
8. All deals reappear

---

**Test 3c: Search Filter**

**Steps**:
1. Click search input (middle top)
2. Type "Корпоративная"
3. Board filters to show only matching deal

**Expected**: Only "Корпоративная страховка" visible

**Steps**:
4. Clear search
5. All deals reappear

---

### Test 4: View Stage Metrics

**Expected**: Metrics panel shows deal pipeline statistics

**Steps**:
1. Look at metrics panel above Kanban board
2. For each stage, verify visible information

**Verification Checklist** (for each stage):
- [ ] Stage name displayed
- [ ] Deal count badge (e.g., "1")
- [ ] Stage description
- [ ] Conversion rate (e.g., "100%")
- [ ] Average cycle duration (e.g., "5.0 дн.")

**Clicking Metric**:
1. Click on "Qualification" metric card
2. Stage should highlight with blue ring

**Expected**: Only Qualification column shows, others fade

1. Click again to deselect
2. All columns reappear at full opacity

---

### Test 5: Create New Deal

**Expected**: New deal appears in Qualification column

**Steps**:
1. Click "+ Новая сделка" button (top right)
2. Modal opens with form

**Verify Modal**:
- [ ] Title: "Создать сделку"
- [ ] Fields visible:
  - [ ] Название сделки (name)
  - [ ] Клиент (client dropdown)
  - [ ] Следующий просмотр (date)
  - [ ] Ответственный (owner)
  - [ ] Описание (description)

**Fill Form**:
1. Name: "Тестовая сделка"
2. Client: Select "ООО «Альфа Логистик»"
3. Date: Tomorrow (auto-filled)
4. Owner: "Мария Орлова"
5. Description: "Тестовое описание"

**Submit**:
1. Click "Создать сделку" button
2. Modal closes
3. Success notification appears (top right): "Сделка «Тестовая сделка» создана"

**Verify Deal Created**:
1. Check Qualification column
2. New deal should appear at top
3. Card shows correct information

**Verify Metrics Update**:
1. Qualification count should increase from 1 to 2

---

### Test 6: Drag-and-Drop Deal Between Stages

**Expected**: Deal moves to new stage and updates in database

**Steps**:
1. Click and hold "Обновление полиса КАСКО" in Negotiation column
2. Drag towards Proposal column
3. Release over Proposal column

**During Drag**:
- [ ] Card becomes semi-transparent
- [ ] Drag preview follows mouse
- [ ] Drop zone (Proposal column) highlights with blue ring
- [ ] Mouse cursor indicates drop target

**After Drop**:
- [ ] Card moves to Proposal column
- [ ] Success notification appears
- [ ] Negotiation count badge decreases (1 → 0)
- [ ] Proposal count badge increases (1 → 2)

**Test Invalid Operations**:
1. Try to drag a deal onto same column
2. Nothing should happen (no movement)

**Test Error Handling**:
1. Create network error condition (dev tools)
2. Try to drag deal
3. If drop fails:
   - [ ] Card returns to original position
   - [ ] Error message appears: "Не удалось обновить стадию"
   - [ ] "Повторить" button available

---

### Test 7: Drag-and-Drop - Keyboard Navigation

**Expected**: Deals can be moved via keyboard

**Steps**:
1. Tab to a deal card to focus it
2. Press `Space` or `Enter` to activate
3. Use arrow keys to select target stage
4. Press `Enter` to move

**Verification**:
- [ ] Card visually indicates focus
- [ ] Keyboard movement works
- [ ] Deal moves to target stage

---

### Test 8: Open Deal Details

**Expected**: Deal details page loads with all information

**Steps**:
1. On Kanban board, click "Открыть" link on a deal card
2. Detail page loads for that deal

**Example**: Click "Открыть" on "Корпоративная страховка"

**URL Should Be**: `http://localhost:3000/deals/deal-1`

**Verify Page Elements**:
- [ ] Header shows deal name and status
- [ ] Manager information displayed
- [ ] Client link available
- [ ] Risk tags visible (if any)
- [ ] Tab navigation visible below header

---

### Test 9: Navigate Deal Detail Tabs

**Expected**: All tabs load and display content

**Tabs to Test**:

#### 9.1 Overview Tab (Default)
```
Visible Elements:
- [ ] Key metrics (probability, next review date)
- [ ] Next events timeline
- [ ] Warning badges (if any)
- [ ] Recent interactions/activities
- [ ] Confirmed payments
```

**Click to verify data loads**

---

#### 9.2 Forms Tab
```
Visible Elements:
- [ ] "Основные данные" section (collapsed/expanded)
- [ ] Form fields:
  - [ ] Название сделки (name)
  - [ ] Следующий просмотр (date)
  - [ ] Ответственный (owner)
- [ ] "Финансовые параметры" section
  - [ ] Вероятность (probability %)
- [ ] "Дополнительные виджеты" section
```

**Test Collapsible Sections**:
1. Click section title to collapse
2. Content should hide
3. Click again to expand
4. Content should show

---

#### 9.3 Calculations Tab
```
Visible Elements:
- [ ] Calculation cards (at least 1)
- [ ] For each calculation:
  - [ ] Insurer name
  - [ ] Program name
  - [ ] Premium amount
  - [ ] Period dates
  - [ ] Status badge (e.g., "Готово")
  - [ ] Uploaded files (if any)
```

---

#### 9.4 Policies Tab
```
Visible Elements:
- [ ] Policy cards (at least 1)
- [ ] For each policy:
  - [ ] Policy number
  - [ ] Product name
  - [ ] Insurer
  - [ ] Status (e.g., "Активен")
  - [ ] Premium
  - [ ] Period dates
  - [ ] "Current" badge if active
```

---

#### 9.5 Journal Tab
```
Visible Elements:
- [ ] Activity filters:
  - [ ] "Все" button
  - [ ] "note", "email", "meeting", "system" filter buttons
- [ ] Search input
- [ ] "Добавить событие" button
- [ ] Activity list with entries:
  - [ ] Entry type (uppercase)
  - [ ] Timestamp
  - [ ] Message
  - [ ] Author name
```

**Test Filtering**:
1. Click "meeting" filter
2. Only meeting activities show
3. Click "Все"
4. All activities show

**Test Search**:
1. Type author name in search
2. Only matching entries show

---

#### 9.6 Actions Tab
```
Visible Elements:
- [ ] Quick action shortcuts:
  - [ ] "Создать задачу"
  - [ ] "Отправить письмо"
  - [ ] "Запросить документы"
- [ ] Integrations status panel
- [ ] Warning/info banners if needed
```

---

#### 9.7 Tasks Tab
```
Visible Elements:
- [ ] Task board with lanes:
  - [ ] "Назначенные" (Assigned)
  - [ ] "К исполнению" (Waiting)
  - [ ] "Архив" (Archive)
- [ ] Task cards showing:
  - [ ] Task title
  - [ ] Due date
  - [ ] Owner
  - [ ] Status
  - [ ] Type badge
  - [ ] Checklist items
```

---

#### 9.8 Documents Tab
```
Visible Elements:
- [ ] Document categories:
  - [ ] "Договор" (Contracts)
  - [ ] "Согласия" (Consents)
  - [ ] "Дополнительные материалы" (Additional)
- [ ] For each document:
  - [ ] Document name
  - [ ] File type (PDF, DOCX, etc.)
  - [ ] File size
  - [ ] Upload date/author
  - [ ] Review status
  - [ ] Version history toggle
```

---

#### 9.9 Finance Tab
```
Visible Elements:
- [ ] Last updated timestamp
- [ ] Financial metrics:
  - [ ] "Всего начислено" (Total accrued)
  - [ ] "Получено" (Received)
  - [ ] "Комиссия агента" (Agent commission)
  - [ ] "Расходы исполнителя" (Executor expenses)
  - [ ] "Ожидает подтверждения" (Pending confirmation)
- [ ] Export button (if enabled)
```

**Verify Amounts**:
- Check each metric displays amount and currency (RUB)
- Verify totals are reasonable

---

### Test 10: Edit Deal Information

**Expected**: Deal properties can be updated

**Steps**:
1. Go to deal detail page (e.g., "Корпоративная страховка")
2. Click "Forms" tab
3. Find "Название сделки" field
4. Click input to edit
5. Change name: "Корпоративная страховка - ОБНОВЛЕНО"
6. Find "Вероятность" field
7. Change value: "75" (or different value)
8. Click "Сохранить" button

**During Save**:
- [ ] Button shows loading state
- [ ] Page briefly indicates saving

**After Save**:
- [ ] Success notification appears
- [ ] Form values update
- [ ] Deal name updates in header
- [ ] Activity log updates

**Verify Changes**:
1. Go back to deals list (click back button)
2. Find updated deal in board
3. Card should show new name

---

### Test 11: Deal Activity Log

**Expected**: All changes are tracked in Journal tab

**Steps**:
1. Open deal details page
2. Click "Journal" tab
3. Look for activity entries

**Activity Types Visible**:
- [ ] "note" entries - Comments/notes
- [ ] "email" entries - Email communications
- [ ] "meeting" entries - Meetings/calls
- [ ] "system" entries - System events (edits, stage changes)

**Test Filtering**:
1. Click "system" filter
2. Only system activities show
3. Click another activity type
4. List updates

**Test Search**:
1. Type partial text in search
2. Matching entries highlight/filter

---

### Test 12: Deal Stage Transition History

**Expected**: Journal shows when deals move between stages

**Steps**:
1. Open deal details
2. Click "Journal" tab
3. Look for entries about stage changes

**What to Look For**:
- Type: "system"
- Message containing stage names
- Timestamp of change
- Original actor if available

**Verify by Dragging**:
1. Go back to deals board
2. Drag a deal to different stage
3. Wait for success notification
4. Go back to that deal details
5. Open Journal tab
6. Should see new stage change entry at top

---

### Test 13: Back Navigation

**Expected**: Proper navigation between pages

**Steps**:
1. From deals board, click deal to open details
2. Details page shows
3. Click browser back button
4. Should return to deals board with same filters
5. Click deal again
6. Details page shows again (cached if available)

**Verify**:
- [ ] Deals board maintains view mode (Kanban vs Table)
- [ ] Filters are preserved
- [ ] Active tab selection not lost

---

### Test 14: Responsive Design (Mobile)

**Expected**: App works on mobile devices

**Steps**:
1. Open deals page in desktop browser
2. Press F12 to open Developer Tools
3. Click Device Toolbar (mobile view icon)
4. Select "iPhone 12" preset

**Verify Mobile View**:
- [ ] Kanban columns stack vertically
- [ ] Cards are readable at mobile width
- [ ] Buttons are touch-friendly (larger)
- [ ] Modal fits screen
- [ ] Filters collapse into dropdown/sheet
- [ ] No horizontal scroll

---

### Test 15: Dark Mode

**Expected**: App works in dark mode

**Steps**:
1. Open any page
2. Check system dark mode setting (OS level)
3. Or use browser DevTools to simulate
4. Reload page

**Verify Dark Mode**:
- [ ] Background is dark (slate-900)
- [ ] Text is light (readable contrast)
- [ ] Cards have dark background
- [ ] Inputs readable in dark mode
- [ ] Buttons visible

---

### Test 16: Accessibility Features

**Expected**: App follows a11y best practices

**Steps**:
1. Open deals page
2. Press Tab repeatedly
3. Focus should move through interactive elements
4. Press Enter/Space on focused elements
5. Action should trigger

**Verify Keyboard Navigation**:
- [ ] Can tab through all buttons
- [ ] Can tab through deal cards
- [ ] Enter/Space activates buttons
- [ ] Can open/close modals with keyboard
- [ ] Search fields receive focus

**Verify Screen Reader Support** (with tools like NVDA):
- [ ] Page title announced
- [ ] Button purposes announced
- [ ] Deal card information announced clearly
- [ ] Error messages announced
- [ ] Form labels associated with inputs

---

### Test 17: Error States

**Expected**: App handles errors gracefully

**Steps**:
1. Open DevTools Network tab
2. Throttle to "Offline"
3. Try to create deal
4. Action should fail with error message

**Expected Error**:
- [ ] Error notification appears
- [ ] Error message is clear
- [ ] "Retry" button available (if applicable)
- [ ] No console errors
- [ ] App remains functional

**Test Network Recovery**:
1. Set throttling back to "No throttle"
2. Click "Retry" button
3. Action should succeed
4. Success notification appears

---

### Test 18: Notifications

**Expected**: User gets feedback on actions

**Steps**:
1. Create a new deal
2. Success notification appears (top right)
3. Says: "Сделка «[name]» создана"
4. Auto-dismisses after 5 seconds (or shows close button)

**Verify Notifications**:
- [ ] Appear in consistent location
- [ ] Have clear messaging
- [ ] Show appropriate icon (success, error, info)
- [ ] Close button works
- [ ] Auto-dismiss works

---

## Bulk Operations Testing

### Test 19: Bulk Deal Selection

**Expected**: Multiple deals can be selected and managed

**Steps**:
1. On deals board, hover over deal card
2. Checkbox appears on left side
3. Click checkbox to select
4. Card shows selection ring

**Multi-Select**:
1. Select multiple deals (e.g., 2-3)
2. Number badge appears on checkbox
3. Bulk action panel appears at bottom

**Bulk Actions Panel**:
- [ ] Shows "X deals selected" count
- [ ] Has bulk operation buttons (move, delete, assign, etc.)
- [ ] "Clear selection" button works
- [ ] Dismisses when all deselected

---

## Performance Testing

### Test 20: Load Performance

**Steps**:
1. Open DevTools Performance tab
2. Reload deals page
3. Measure Time to Interactive (TTI)

**Expected**:
- [ ] Page loads in < 3 seconds
- [ ] Board visible in < 2 seconds
- [ ] Interactions responsive (< 100ms)
- [ ] No layout shifts (CLS score good)

---

## Browser Compatibility

### Test 21: Cross-Browser Testing

**Test in**:
- [ ] Chrome/Chromium (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

**Verify on Each**:
- [ ] Page loads without errors
- [ ] All features work
- [ ] Layout looks correct
- [ ] Performance is acceptable

---

## Testing Commands

### Run Unit Tests

```bash
cd frontend
pnpm test
```

**Expected Output**:
- All tests pass
- Coverage report generated

**Key Test Files**:
- `src/components/deals/__tests__/DealCard.test.tsx`
- `src/components/deals/__tests__/DealFunnelBoard.test.tsx`
- `src/components/deals/__tests__/DealCreateModal.test.tsx`
- `src/lib/api/__tests__/hooks.test.ts`

---

### Run E2E Tests

```bash
cd frontend
pnpm test:e2e
```

**Expected Output**:
- E2E tests execute in Chromium
- Smoke test passes (creates deal, navigates pages)
- No errors reported

---

### Check Linting

```bash
cd frontend
pnpm lint
```

**Expected Output**:
- No ESLint errors
- All rules pass

---

### Type Check

```bash
cd frontend
pnpm type-check
```

**Expected Output**:
- No TypeScript errors
- All types valid

---

## Summary Checklist

### Critical Features
- [ ] Test 1: Kanban board displays correctly
- [ ] Test 5: Deal creation works
- [ ] Test 6: Drag-and-drop updates stage
- [ ] Test 8: Deal details page loads
- [ ] Test 10: Editing works
- [ ] Test 12: Activity log tracks changes

### Important Features
- [ ] Test 2: Table view toggle works
- [ ] Test 3: Filters work (period, manager, search)
- [ ] Test 4: Metrics display correctly
- [ ] Test 9: All detail tabs load
- [ ] Test 14: Mobile responsive
- [ ] Test 17: Error handling works

### Nice-to-Have Features
- [ ] Test 15: Dark mode works
- [ ] Test 16: Keyboard navigation works
- [ ] Test 19: Bulk selection works
- [ ] Test 20: Performance acceptable
- [ ] Test 21: Cross-browser compatible

---

## Troubleshooting

### Page Returns 404
**Solution**: Ensure auth is disabled
```bash
# In .env.local:
NEXT_PUBLIC_AUTH_DISABLED=true
```

### No deals visible
**Check**:
1. Mock data is loaded (check `src/mocks/data.ts`)
2. useDeals hook returns data
3. Browser console for errors

### Drag-and-drop not working
**Check**:
1. dnd-kit library installed: `pnpm ls @dnd-kit/core`
2. DndContext wrapping board
3. Browser supports touch events

### Styles not applying
**Check**:
1. Tailwind CSS built: `npm run build`
2. CSS classes in HTML
3. Dark mode setting

### API calls failing
**Check**:
1. Gateway running on localhost:8080
2. NEXT_PUBLIC_API_BASE_URL correct
3. Network tab shows request status
4. CORS headers present

---

## Final Verification

Run this complete checklist to verify Feature 2 is fully implemented:

```
Deal Management Workflow - Complete Verification

[ ] Deals List Page (/deals)
  [ ] Kanban board displays 5 columns
  [ ] All 4 sample deals visible
  [ ] Table view toggle works
  [ ] Filters work (period, manager, search)
  [ ] Metrics display statistics

[ ] Drag-and-Drop
  [ ] Can drag deal between stages
  [ ] Stage updates on drop
  [ ] Activity log records change
  [ ] Error handling works

[ ] Deal Creation
  [ ] Modal opens on button click
  [ ] Form validates inputs
  [ ] New deal appears in Qualification
  [ ] Success notification shows

[ ] Deal Details Page
  [ ] Details page loads for any deal
  [ ] All 9 tabs accessible and load
  [ ] Header shows deal info
  [ ] Back navigation works

[ ] Deal Editing
  [ ] Forms tab allows editing
  [ ] Save persists changes
  [ ] Activity log updates
  [ ] Changes visible in list

[ ] Other Features
  [ ] Dark mode supported
  [ ] Mobile responsive
  [ ] Error handling graceful
  [ ] Loading states show
  [ ] All buttons functional

OVERALL STATUS: READY FOR PRODUCTION ✅
```

---

**Test Document Version**: 1.0
**Last Updated**: 2025-10-23
**Status**: Complete
