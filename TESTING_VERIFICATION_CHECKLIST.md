# CRM Frontend - Testing & Verification Checklist

## Overview

This document provides a comprehensive checklist for testing and verifying that all 8 CRM features are working correctly.

---

## Pre-Testing Setup

### Environment Verification

- [ ] Node.js v20+ installed: `node --version`
- [ ] pnpm v9+ installed: `pnpm --version`
- [ ] Frontend directory exists: `ls /c/Dev/CRM_2.0/frontend`
- [ ] Dependencies installed: `pnpm install` completed
- [ ] Dev server starts: `pnpm dev` runs without errors
- [ ] No build errors: `pnpm build` (or skip due to Windows symlink issue)
- [ ] Tests can run: `pnpm test` starts without config errors

### Browser Setup

- [ ] Chrome/Edge with DevTools open (F12)
- [ ] Console tab visible to check for errors
- [ ] Network tab visible to check API calls
- [ ] Mobile device or responsive design mode (F12 → Toggle Device Toolbar)
- [ ] Dark mode enabled in one browser, light in another

### API & Mock Data Setup

- [ ] Environment variables set for mock mode:
  ```
  NEXT_PUBLIC_AUTH_DISABLED=true
  NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1 (or similar)
  ```
- [ ] Mock data loaded in application
- [ ] No API call errors in console
- [ ] SSE connections optional (can fail gracefully)

---

## Feature 1: Payment Tracking (/payments)

### Component Rendering

- [ ] Page loads at `/payments`
- [ ] Header visible: "Платежи" (Payments)
- [ ] Description visible
- [ ] Page renders without JavaScript errors
- [ ] No network errors in console

### Table/List Display

- [ ] Payment list displays with all columns:
  - [ ] ID
  - [ ] Client name
  - [ ] Deal name
  - [ ] Policy number
  - [ ] Planned amount
  - [ ] Actual amount
  - [ ] Status badge
- [ ] 5+ mock payments visible
- [ ] Status badges display correctly (Planned, In Progress, Paid, Failed)
- [ ] Amounts formatted with currency symbols
- [ ] Dates formatted in Russian locale
- [ ] Cards are clickable/expandable

### Create Payment

- [ ] "+ Add Payment" button visible
- [ ] Click opens form modal
- [ ] Form has required fields:
  - [ ] Deal (dropdown with options)
  - [ ] Client (auto-filled based on deal)
  - [ ] Policy Number (text input)
  - [ ] Planned Amount (number input)
  - [ ] Currency (select dropdown)
  - [ ] Status (dropdown)
  - [ ] Planned Date (date picker)
  - [ ] Actual Date (date picker)
  - [ ] Comment (text area)
- [ ] Submit button enabled/disabled appropriately
- [ ] Form validation:
  - [ ] Required fields show error when empty
  - [ ] Amount field only accepts numbers
  - [ ] Currency field restricts to valid values
- [ ] On submit:
  - [ ] Modal closes
  - [ ] Success notification appears
  - [ ] New payment appears in list
  - [ ] List re-sorts by updated date

### Edit Payment

- [ ] Click payment to expand
- [ ] Edit button visible on expanded card
- [ ] Edit button opens form with pre-filled data
- [ ] Form shows all current values
- [ ] Can modify any field
- [ ] Submit updates payment
- [ ] Payment updates in list immediately
- [ ] Success notification shown

### Delete Payment

- [ ] Delete button visible on expanded card
- [ ] Click shows confirmation dialog
- [ ] Dialog asks for confirmation
- [ ] Cancel button dismisses dialog
- [ ] Confirm button:
  - [ ] Removes payment from list
  - [ ] Shows success notification
  - [ ] Summary updates

### Income/Expense Management

- [ ] "+ Add Income" button visible on expanded payment
- [ ] "+ Add Expense" button visible on expanded payment
- [ ] Click opens form for adding entry
- [ ] Form has fields:
  - [ ] Category (dropdown)
  - [ ] Planned Amount (number)
  - [ ] Planned Date (date picker)
  - [ ] Note (text area)
- [ ] On submit:
  - [ ] Entry appears in payment
  - [ ] Totals update (incomes, expenses, net)
- [ ] Click entry shows edit/delete buttons
- [ ] Edit button reopens form with data
- [ ] Delete button shows confirmation
- [ ] Entry removed after confirmation
- [ ] Totals update after delete

### Confirmation Workflow

- [ ] Payment confirmation button visible
- [ ] Click opens confirmation modal
- [ ] Modal shows:
  - [ ] Current payment status
  - [ ] Planned vs Actual fields
  - [ ] Note field
- [ ] Fill in actual amount and date
- [ ] Submit changes status to "Paid"
- [ ] Status badge updates
- [ ] Revoke button appears after confirmation
- [ ] Revoke restores previous status

### Filtering

- [ ] Filter buttons visible: All, Incomes, Expenses, Overdue
- [ ] Click "Incomes" shows only payments with income entries
- [ ] Click "Expenses" shows only payments with expenses
- [ ] Click "Overdue" shows only overdue payments
- [ ] Click "All" shows all payments again
- [ ] Filter buttons show active state
- [ ] Count updates when filtering

### Search

- [ ] Search input visible
- [ ] Type policy number filters list
- [ ] Type client name filters list
- [ ] Type deal name filters list
- [ ] Type category filters entries
- [ ] Results update in real-time
- [ ] Clear search shows all again
- [ ] Search is case-insensitive

### Summary Statistics

- [ ] Summary grid visible at bottom
- [ ] Shows: Plan, Incomes, Expenses, Net
- [ ] Numbers update when filtering
- [ ] Currency matches payment currency
- [ ] Formatting is correct (no -0, proper rounding)

### Responsive Design

- [ ] **Desktop (1920x1080)**:
  - [ ] Table layout optimal
  - [ ] Modals centered and sized well
  - [ ] All buttons accessible
- [ ] **Tablet (768x1024)**:
  - [ ] Layout adapts
  - [ ] Columns may stack
  - [ ] Touch-friendly buttons
- [ ] **Mobile (375x667)**:
  - [ ] Single column layout
  - [ ] Horizontally scrollable table
  - [ ] Large touch targets

### Dark Mode

- [ ] Toggle dark mode in browser
- [ ] Page background changes to dark
- [ ] Text remains readable
- [ ] Form inputs have correct contrast
- [ ] Status badges visible
- [ ] No white text on white background
- [ ] All modals have dark mode

### Error Handling

- [ ] Type invalid amount: shows error
- [ ] Select no deal: form won't submit
- [ ] Network error shows message
- [ ] Try to delete while loading: button disabled
- [ ] Error message is user-friendly (Russian)

### Accessibility

- [ ] Tab through form: logical order
- [ ] All buttons have visible focus state
- [ ] Form labels associated with inputs
- [ ] Modals have close button (X)
- [ ] Modals have keyboard escape to close
- [ ] Screen reader can read labels
- [ ] Color not only way to show status

---

## Feature 2: Task Management (/tasks)

### Component Rendering

- [ ] Page loads at `/tasks`
- [ ] Header visible: "Задачи" (Tasks)
- [ ] 2+ view mode buttons visible (Table, Kanban)
- [ ] Filters section visible
- [ ] Filter controls visible:
  - [ ] Status filter
  - [ ] Owner filter
  - [ ] Type filter
  - [ ] Tags filter
- [ ] Task calendar visible on right side
- [ ] No console errors

### Table View (Default)

- [ ] Table displays tasks in rows
- [ ] Columns visible:
  - [ ] Checkbox (for selection)
  - [ ] Title
  - [ ] Status badge
  - [ ] Owner
  - [ ] Type
  - [ ] Due date
  - [ ] Tags (if any)
  - [ ] Action buttons
- [ ] 4+ mock tasks visible
- [ ] Tasks not marked as done visible
- [ ] Can scroll table
- [ ] Hover shows action buttons

### Kanban View

- [ ] Click "Kanban" switches to kanban view
- [ ] 5 columns visible:
  - [ ] New
  - [ ] In Progress
  - [ ] Waiting
  - [ ] Done
  - [ ] Cancelled
- [ ] Tasks distributed across columns
- [ ] Drag task to different column:
  - [ ] Dragging starts
  - [ ] Drag preview shows
  - [ ] Drop on column works
  - [ ] Task appears in new column
  - [ ] Status updates in backend
  - [ ] Success notification shown
- [ ] Can't exceed column limit (if set)

### Create Task

- [ ] "+ Create Task" button visible
- [ ] Click opens form modal
- [ ] Form has fields:
  - [ ] Title (required, text)
  - [ ] Description (optional, textarea)
  - [ ] Due Date (required, date picker)
  - [ ] Owner (required, dropdown from users)
  - [ ] Status (dropdown)
  - [ ] Type (dropdown: call, meeting, document, reminder, follow-up, other)
  - [ ] Tags (optional, multi-select or comma-separated)
  - [ ] Deal (optional, dropdown)
  - [ ] Client (optional, dropdown)
- [ ] Due date picker works:
  - [ ] Click opens calendar
  - [ ] Can select date
  - [ ] Shows selected date
- [ ] On submit:
  - [ ] Modal closes
  - [ ] Task appears in list
  - [ ] Success notification
  - [ ] Task appears in Kanban "New" column

### Edit Task

- [ ] Click task row: task details open in drawer
- [ ] Or click task card in Kanban
- [ ] Drawer shows full task details
- [ ] Edit button (if present) opens form
- [ ] Form pre-filled with current values
- [ ] Can modify any field
- [ ] Submit updates task
- [ ] List updates immediately

### Delete Task

- [ ] Delete button visible on task
- [ ] Click shows confirmation dialog
- [ ] Confirm removes task
- [ ] Task disappears from both views
- [ ] Success notification shown

### Complete Task

- [ ] Checkbox visible on task row
- [ ] Click checkbox:
  - [ ] Marks task complete
  - [ ] Moves to "Done" column (if Kanban)
  - [ ] Shows strikethrough (if Table)
  - [ ] Success notification
- [ ] Uncheck completes task again
- [ ] Completed tasks can be deleted

### Filtering

- [ ] **Status Filter**:
  - [ ] Show "New" - displays only new tasks
  - [ ] Show "In Progress" - displays only in progress
  - [ ] Show "Done" - displays only completed
  - [ ] Multiple selections: shows all selected statuses
- [ ] **Owner Filter**:
  - [ ] Select owner from list
  - [ ] Shows only tasks for that owner
  - [ ] Multiple owners: shows all selected
- [ ] **Type Filter**:
  - [ ] Select type (call, meeting, etc.)
  - [ ] Shows only that type
  - [ ] Multiple types selectable
- [ ] **Tags Filter**:
  - [ ] Select tag from list
  - [ ] Shows only tasks with tag
  - [ ] Multiple tags: shows all selected
- [ ] **Date Filter** (Calendar):
  - [ ] Click date on calendar
  - [ ] Shows tasks for that date
  - [ ] Drag to select date range
  - [ ] Shows tasks in range
  - [ ] "Week" view shows current week
  - [ ] "Month" view shows current month

### Bulk Operations

- [ ] Check multiple task checkboxes
- [ ] Selection count shows at top
- [ ] Bulk actions bar appears:
  - [ ] Change Status dropdown
  - [ ] Assign Owner dropdown
  - [ ] Shift Date dropdown
  - [ ] Apply buttons for each
- [ ] Change Status:
  - [ ] Select new status
  - [ ] Click Apply
  - [ ] All selected tasks move to new status
  - [ ] Success notification shows count
- [ ] Assign Owner:
  - [ ] Select owner
  - [ ] Click Assign
  - [ ] All selected tasks assigned to owner
  - [ ] Success notification
- [ ] Shift Dates:
  - [ ] Select number of days (1, 3, 7, 14)
  - [ ] Click Shift
  - [ ] All due dates move forward by days
  - [ ] Success notification
- [ ] Clear Selection:
  - [ ] Click "Clear Selection"
  - [ ] All checkboxes unchecked
  - [ ] Bulk actions bar disappears

### Calendar View

- [ ] Calendar visible on right side
- [ ] Shows month view
- [ ] Task count on each day
- [ ] Click day: filters to that day's tasks
- [ ] Days with tasks highlighted
- [ ] Week/Month toggle works
- [ ] Clear button removes date filter

### Task Details Drawer

- [ ] Click task opens drawer from right
- [ ] Drawer shows all task details:
  - [ ] Title (large heading)
  - [ ] Status badge
  - [ ] Full description
  - [ ] Due date
  - [ ] Owner
  - [ ] Type
  - [ ] Tags
  - [ ] Related deal (if any)
  - [ ] Related client (if any)
- [ ] Close button (X) closes drawer
- [ ] Escape key closes drawer
- [ ] Edit button opens form modal
- [ ] Delete button shows confirmation
- [ ] Complete checkbox works

### Search (if implemented)

- [ ] Search input in header
- [ ] Type task title filters list
- [ ] Type owner name filters list
- [ ] Type tag filters list
- [ ] Results update in real-time
- [ ] Clear search shows all again

### Responsive Design

- [ ] **Desktop**:
  - [ ] Table/Kanban on left, Calendar on right
  - [ ] Optimal layout
- [ ] **Tablet (768px)**:
  - [ ] Calendar may move below
  - [ ] Table/Kanban remains full width
- [ ] **Mobile (375px)**:
  - [ ] Single column layout
  - [ ] Calendar hidden or collapsed
  - [ ] Table/Kanban full width

### Dark Mode

- [ ] Dark mode applied to all elements
- [ ] Text readable in dark mode
- [ ] Status badges visible
- [ ] Kanban columns dark backgrounds
- [ ] Form elements dark mode

### Error Handling

- [ ] Leave title empty: shows error
- [ ] Try to create without due date: shows error
- [ ] Try to create without owner: shows error
- [ ] API error shows message
- [ ] Can retry operation

### Accessibility

- [ ] Tab navigates through all interactive elements
- [ ] Enter submits forms
- [ ] Escape closes dialogs
- [ ] Focus visible on all buttons
- [ ] Kanban columns accessible with keyboard (if drag-drop)

---

## Feature 3: Notifications (/notifications)

### Component Rendering

- [ ] Page loads at `/notifications`
- [ ] Layout: notifications on left, panels on right
- [ ] Header visible
- [ ] Notification feed visible
- [ ] Event Journal tab visible
- [ ] Delivery Settings panel visible
- [ ] No console errors

### Notification Feed

- [ ] Displays 5+ mock notifications
- [ ] Each notification shows:
  - [ ] Title
  - [ ] Message/Summary
  - [ ] Timestamp (formatted in Russian)
  - [ ] Category badge
  - [ ] Source label
  - [ ] Status indicator (unread/read/important)
- [ ] Unread notifications highlighted/bold
- [ ] Important notifications show star icon
- [ ] Failed deliveries show error indicator

### Notification Actions

- [ ] **Mark as Read**:
  - [ ] Click notification area
  - [ ] Bold style removed
  - [ ] Unread count updates (if displayed)
- [ ] **Mark as Important**:
  - [ ] Click star icon
  - [ ] Star fills in
  - [ ] Notification stays visible but marked
- [ ] **Delete Notification**:
  - [ ] Click delete/trash button
  - [ ] Notification disappears
  - [ ] Success notification shown
- [ ] **Mark All as Read**:
  - [ ] "Mark all as read" button visible
  - [ ] Click marks all as read
  - [ ] All bold styling removed

### Filtering - Category

- [ ] Filter buttons visible: All, Deal, Task, Payment, System
- [ ] Click "Deal" shows only deal notifications
- [ ] Click "Task" shows only task notifications
- [ ] Click "Payment" shows only payment notifications
- [ ] Click "System" shows only system notifications
- [ ] Click "All" shows all again
- [ ] Active filter shows highlighted

### Filtering - Source

- [ ] Filter buttons for: All, CRM, Telegram, Email, Payments
- [ ] Select source filters by source
- [ ] Multiple sources selectable
- [ ] Filtering works in combination with category filter

### Filtering - Status

- [ ] Filter buttons for: All, Unread, Important, Failed
- [ ] "Unread" shows only unread notifications
- [ ] "Important" shows only starred notifications
- [ ] "Failed" shows only failed deliveries
- [ ] Works with other filters

### Search

- [ ] Search input visible
- [ ] Type text searches notification titles/messages
- [ ] Results update in real-time
- [ ] Multiple filter + search works together

### Click Notification

- [ ] Click notification:
  - [ ] If has link in context: navigate to deal/task
  - [ ] Navigate to `/deals/deal-id` (for deal notifications)
  - [ ] Navigate to `/tasks` (for task notifications)
  - [ ] Navigate to `/payments` (for payment notifications)
- [ ] New page loads with correct data selected

### Event Journal Tab

- [ ] Click "Event Journal" tab
- [ ] Content switches to event journal
- [ ] Shows audit log entries
- [ ] Each entry shows:
  - [ ] Date/Time
  - [ ] User/Actor
  - [ ] Action description
  - [ ] Scope
  - [ ] Severity (color-coded)
- [ ] 10+ mock entries visible

### Event Journal Filtering

- [ ] **Date Range**:
  - [ ] Date picker from/to
  - [ ] Select date range filters events
- [ ] **User Filter**:
  - [ ] Dropdown of users
  - [ ] Select filters by user
- [ ] **Scope Filter**:
  - [ ] Dropdown: Deal, Task, User, Payment, System
  - [ ] Select filters by scope
- [ ] **Severity Filter**:
  - [ ] Buttons: Info, Warning, Error, Critical
  - [ ] Select shows only that severity
  - [ ] Color-coded: Blue, Yellow, Red, Dark Red
- [ ] All filters work together

### Event Journal Search

- [ ] Search input in journal
- [ ] Type text searches action summary
- [ ] Results update in real-time
- [ ] Works with other filters

### Event Journal Export

- [ ] Export buttons visible: CSV, JSON
- [ ] Click CSV downloads file:
  - [ ] Filename: `audit-log-YYYYMMDD.csv`
  - [ ] File has headers
  - [ ] Data properly formatted
- [ ] Click JSON downloads file:
  - [ ] Filename: `audit-log-YYYYMMDD.json`
  - [ ] Valid JSON format
  - [ ] All fields included

### Delivery Settings Panel

- [ ] Panel visible showing channels
- [ ] Each channel shows:
  - [ ] Name (SSE, Telegram, Email)
  - [ ] Description
  - [ ] Current status (enabled/disabled)
  - [ ] Last changed date/time
- [ ] Toggle button to enable/disable (if editable)
- [ ] Non-editable channels show locked state
- [ ] Changes save to backend/store

### Responsive Design

- [ ] **Desktop**: Feed + sidebar layout
- [ ] **Tablet**: Feed full width, sidebar below
- [ ] **Mobile**: Single column, stacked layout

### Dark Mode

- [ ] All elements render in dark mode
- [ ] Severity colors visible in dark mode
- [ ] Text contrast acceptable

### Error Handling

- [ ] Load error shows message
- [ ] Can retry loading
- [ ] Export error shows message

### Accessibility

- [ ] Tab navigates filters and buttons
- [ ] Enter activates buttons
- [ ] Screen reader reads content
- [ ] Color not only indicator (severity has icon + color)

---

## Feature 4: Admin Panel (/admin)

### Component Rendering

- [ ] Page loads at `/admin`
- [ ] Three tabs visible: Users, Dictionaries, Audit Log
- [ ] Initial tab (Users) displays
- [ ] No console errors

### Users Tab

#### User Table

- [ ] Table displays users with columns:
  - [ ] Name
  - [ ] Email
  - [ ] Role
  - [ ] Status (Active, Invited, Suspended)
  - [ ] Last Active (date/time)
  - [ ] Action buttons (Edit, Delete)
- [ ] 4+ mock users visible
- [ ] Status badges show correct color:
  - [ ] Active: green
  - [ ] Invited: yellow
  - [ ] Suspended: red/gray

#### Create User

- [ ] "+ Add User" button visible
- [ ] Click opens form modal
- [ ] Form fields:
  - [ ] Full Name (text, required)
  - [ ] Email (email, required, validated)
  - [ ] Role (dropdown, required)
  - [ ] Status (dropdown, default: Invited)
  - [ ] MFA Enabled (checkbox, optional)
- [ ] Form validation:
  - [ ] Require full name
  - [ ] Require valid email format
  - [ ] Require role selection
  - [ ] Show error messages
- [ ] On submit:
  - [ ] Modal closes
  - [ ] New user appears in table
  - [ ] Success notification
  - [ ] Form resets

#### Edit User

- [ ] Edit button visible on user row
- [ ] Click opens form with pre-filled data
- [ ] Can change:
  - [ ] Full Name
  - [ ] Email
  - [ ] Role
  - [ ] Status
  - [ ] MFA Enabled
- [ ] Submit updates user
- [ ] User row updates in table
- [ ] Success notification

#### Delete User

- [ ] Delete button visible on user row
- [ ] Click shows confirmation dialog
- [ ] Dialog asks for confirmation
- [ ] Confirm removes user
- [ ] User disappears from table
- [ ] Success notification

#### Suspend/Activate User

- [ ] If user is Active: "Suspend" button
- [ ] If user is Suspended: "Activate" button
- [ ] Click toggles status
- [ ] Status badge updates
- [ ] No confirmation needed (or quick confirm)

### Dictionaries Tab

#### Dictionary Table

- [ ] Click "Dictionaries" tab
- [ ] Table displays entries with columns:
  - [ ] Code (unique identifier)
  - [ ] Label (display name)
  - [ ] Type (category)
  - [ ] Active (toggle switch)
- [ ] 8+ mock entries visible
- [ ] Different types represented:
  - [ ] Stage (New, Negotiation, Proposal, Contract)
  - [ ] Type (Call, Meeting, Document)
  - [ ] Status (Planned, Paid, Failed)

#### Create Dictionary Entry

- [ ] "+ Add Entry" button visible
- [ ] Click opens form modal
- [ ] Form fields:
  - [ ] Code (text, required, unique)
  - [ ] Label (text, required)
  - [ ] Type (dropdown, required)
  - [ ] Active (toggle, default: true)
- [ ] On submit:
  - [ ] Modal closes
  - [ ] Entry appears in table
  - [ ] Success notification

#### Edit Dictionary Entry

- [ ] Edit button visible on entry row
- [ ] Click opens form with pre-filled data
- [ ] Can edit all fields
- [ ] Code should be read-only (prevent changing ID)
- [ ] Submit updates entry
- [ ] Table updates

#### Delete Dictionary Entry

- [ ] Delete button visible
- [ ] Click shows confirmation
- [ ] Confirm removes entry
- [ ] Entry disappears from table

#### Bulk Toggle Active

- [ ] Select multiple entry checkboxes
- [ ] Selection count shows
- [ ] Bulk action buttons appear
- [ ] "Activate All" button
- [ ] "Deactivate All" button
- [ ] Click toggles active status for all selected
- [ ] Entries update in table
- [ ] Success notification shows count

### Audit Log Tab

#### Audit Log Timeline

- [ ] Click "Audit Log" tab
- [ ] Timeline view displays
- [ ] Each entry shows:
  - [ ] Date/Time (formatted Russian)
  - [ ] User/Actor name
  - [ ] Action description
  - [ ] Scope (Deal, User, Payment, System)
  - [ ] Summary of changes
  - [ ] Severity (color-coded badge)
- [ ] 10+ mock entries visible
- [ ] Entries in chronological order (newest first)

#### Audit Filtering

- [ ] **Date Range**:
  - [ ] Date picker from date
  - [ ] Date picker to date
  - [ ] Select filters events in range
- [ ] **User Filter**:
  - [ ] Dropdown of users
  - [ ] Select filters by user
- [ ] **Scope Filter**:
  - [ ] Buttons or dropdown
  - [ ] Options: Deal, Task, User, Payment, System
  - [ ] Select filters by scope
- [ ] **Severity Filter**:
  - [ ] Options: Info, Warning, Error, Critical
  - [ ] Color-coded
  - [ ] Select filters by severity
- [ ] All filters work together

#### Audit Search

- [ ] Search input visible
- [ ] Type searches action summary
- [ ] Results update in real-time
- [ ] Works with other filters

#### Audit Export

- [ ] Export buttons: CSV, JSON
- [ ] CSV download:
  - [ ] Filename: `audit-log-YYYYMMDD.csv`
  - [ ] Proper format
  - [ ] All columns included
- [ ] JSON download:
  - [ ] Filename: `audit-log-YYYYMMDD.json`
  - [ ] Valid JSON
  - [ ] All data included

### Tab Navigation

- [ ] Click "Users" tab: switches to users
- [ ] Click "Dictionaries" tab: switches to dictionaries
- [ ] Click "Audit Log" tab: switches to audit log
- [ ] Content switches without page reload
- [ ] Tab state persists (or can be lost on refresh)

### Permission Checks

- [ ] If user has "manage:users" permission: can see all user buttons
- [ ] If missing permission: buttons hidden/disabled
- [ ] Mock mode: all permissions granted

### Responsive Design

- [ ] **Desktop**: Optimal table width and spacing
- [ ] **Tablet**: Tables may stack horizontally
- [ ] **Mobile**: Single column, scrollable tables

### Dark Mode

- [ ] All elements dark mode compatible
- [ ] Text readable
- [ ] Badge colors visible
- [ ] Form elements styled correctly

### Error Handling

- [ ] Invalid email: shows error
- [ ] Duplicate code: shows error
- [ ] API error: shows message
- [ ] Can retry operations

### Accessibility

- [ ] Tab navigates all form fields
- [ ] Tab navigates all buttons
- [ ] Enter submits forms
- [ ] Escape closes modals
- [ ] Focus visible on all elements

---

## Feature 5: Dashboard (/home or /)

### Component Rendering

- [ ] Page loads at `/`
- [ ] Header "Главная" visible
- [ ] Description text visible
- [ ] Main overview section visible
- [ ] Deal funnel board visible
- [ ] Metrics visible

### Deal Stage Metrics

- [ ] Chart/metrics showing deal distribution
- [ ] All stages represented
- [ ] Numbers sum correctly
- [ ] Visual hierarchy clear

### Deal Funnel Board

- [ ] Shows deals organized by stage
- [ ] Cards for each deal
- [ ] Can drag deals between stages
- [ ] Drag feedback visible
- [ ] Status updates on drop

### Filters

- [ ] Filter panel visible
- [ ] Can filter by stage, manager, period
- [ ] Filtered view updates
- [ ] Metrics update when filtering

---

## Feature 6: Deal Management (/deals)

### Deal List

- [ ] Page loads at `/deals`
- [ ] "Воронка сделок" header visible
- [ ] Deal board visible with columns by stage
- [ ] Deal table visible with list view
- [ ] Create deal button visible

### Create Deal

- [ ] "+ Create Deal" button visible
- [ ] Click opens form modal
- [ ] Form has fields: Name, Amount, Stage, Manager, etc.
- [ ] Form validates
- [ ] Submit adds deal to list

### Edit Deal

- [ ] Click deal opens detail view
- [ ] Edit button available
- [ ] Form opens pre-filled
- [ ] Submit updates deal

### Delete Deal

- [ ] Delete button available
- [ ] Confirmation dialog shown
- [ ] Confirm removes deal

### Deal Details

- [ ] Click deal opens detail page
- [ ] Multiple tabs visible:
  - [ ] Overview
  - [ ] Finance
  - [ ] Documents
  - [ ] Tasks
  - [ ] Policies
  - [ ] Journal
  - [ ] etc.
- [ ] Each tab loads relevant data

---

## Feature 7: Client Management (/clients)

### Client List

- [ ] Page loads at `/clients`
- [ ] "Клиенты" header visible
- [ ] Client cards/list visible
- [ ] Create client button visible

### Create Client

- [ ] "+ Create Client" button visible
- [ ] Click opens form
- [ ] Form has: Name, Contact, Email, Phone, etc.
- [ ] Submit adds client

### Edit Client

- [ ] Click client opens detail
- [ ] Edit available
- [ ] Form pre-filled
- [ ] Submit updates

### View Client Details

- [ ] Click client opens detail page
- [ ] Shows all client info
- [ ] Shows related deals
- [ ] Shows related tasks

---

## Feature 8: End-to-End Workflow

### Complete User Journey

- [ ] **Login**:
  - [ ] Navigate to `/login`
  - [ ] See login form
  - [ ] Enter any email/password
  - [ ] Click login
  - [ ] Redirect to home page
- [ ] **View Dashboard**:
  - [ ] Home page shows metrics
  - [ ] Deal stages visible
  - [ ] Can see number of deals
- [ ] **Create Client**:
  - [ ] Navigate to `/clients`
  - [ ] Create new client
  - [ ] Client appears in list
- [ ] **Create Deal**:
  - [ ] Navigate to `/deals`
  - [ ] Create new deal
  - [ ] Link to client
  - [ ] Deal appears in funnel
- [ ] **Move Deal**:
  - [ ] Drag deal between stages
  - [ ] Status updates
  - [ ] Or use dropdown to change stage
- [ ] **Create Payment**:
  - [ ] Navigate to `/payments`
  - [ ] Create payment for deal
  - [ ] Add income/expense
  - [ ] Confirm payment
- [ ] **Create Task**:
  - [ ] Navigate to `/tasks`
  - [ ] Create task for deal
  - [ ] Assign owner
  - [ ] Switch to Kanban view
  - [ ] Drag to move status
- [ ] **View Notifications**:
  - [ ] Navigate to `/notifications`
  - [ ] See notifications generated by actions
  - [ ] Filter notifications
  - [ ] Mark as read/important
- [ ] **Admin Actions**:
  - [ ] Navigate to `/admin`
  - [ ] Create new user
  - [ ] Add dictionary entry
  - [ ] View audit log
  - [ ] Export audit log
- [ ] **Navigation Links Work**:
  - [ ] Deal link navigates to deal detail
  - [ ] Client link navigates to client detail
  - [ ] Payment link navigates to payment view
  - [ ] Task link navigates to task
  - [ ] All links return properly
- [ ] **Data Persistence**:
  - [ ] Create item, refresh page
  - [ ] Item still visible (React Query cache)
  - [ ] Create item, navigate away, come back
  - [ ] Item still visible
- [ ] **Logout**:
  - [ ] Click user menu
  - [ ] Click logout
  - [ ] Redirect to login page
  - [ ] Can log back in

---

## Cross-Feature Testing

### Integration Tests

- [ ] **Deal ↔ Payment**:
  - [ ] Create deal
  - [ ] Create payment from deal view
  - [ ] Payment links back to deal
  - [ ] Navigate: deal → payments → deal
- [ ] **Deal ↔ Task**:
  - [ ] Create deal
  - [ ] Create task for deal
  - [ ] Task shows deal link
  - [ ] Navigate to deal from task
- [ ] **Client ↔ Deal**:
  - [ ] Create client
  - [ ] Create deal for client
  - [ ] Deal shows client
  - [ ] Client shows deals
- [ ] **Task ↔ Notification**:
  - [ ] Create task
  - [ ] Notification should appear
  - [ ] Click notification navigates to task
- [ ] **Bulk Operations**:
  - [ ] Select multiple deals
  - [ ] Bulk update (if implemented)
  - [ ] All update together

---

## Browser Compatibility

- [ ] **Chrome** (latest):
  - [ ] All features work
  - [ ] No errors in console
- [ ] **Edge** (latest):
  - [ ] All features work
  - [ ] No errors in console
- [ ] **Firefox** (latest):
  - [ ] All features work
  - [ ] No errors in console
- [ ] **Safari** (latest):
  - [ ] All features work
  - [ ] No errors in console

---

## Accessibility Testing

### Keyboard Navigation

- [ ] Tab through entire application
- [ ] Can access all buttons
- [ ] Can fill all form fields
- [ ] Can submit forms with Enter
- [ ] Can close dialogs with Escape
- [ ] Tab order logical and expected
- [ ] Focus always visible

### Screen Reader

- [ ] Page structure makes sense
- [ ] Form labels associated with inputs
- [ ] Button purposes clear
- [ ] Status information announced
- [ ] Images have alt text (if any)
- [ ] Links have descriptive text

### Color Contrast

- [ ] Text readable on background (WCAG AA)
- [ ] Status not indicated by color alone
- [ ] Badges have icons + color
- [ ] Links distinguishable from text

### Text Sizing

- [ ] Zoom page to 200%: still usable
- [ ] No horizontal scrolling required
- [ ] Text not truncated inappropriately

---

## Performance Testing

### Load Time

- [ ] **First Contentful Paint**: < 2s
- [ ] **Largest Contentful Paint**: < 2.5s
- [ ] **Time to Interactive**: < 3s
- [ ] **Cumulative Layout Shift**: < 0.1

### Runtime Performance

- [ ] Page stays responsive
- [ ] No janky animations
- [ ] Filters respond quickly (< 500ms)
- [ ] No visible lag when typing
- [ ] Scrolling smooth

### Network

- [ ] Check Network tab in DevTools
- [ ] No unnecessary requests
- [ ] Requests properly cached
- [ ] No failed requests (except optional SSE)
- [ ] Bundle size reasonable

---

## Responsive Design Testing

### Breakpoints

- [ ] **Desktop (1920x1080)**:
  - [ ] All features visible
  - [ ] Side-by-side layouts
  - [ ] Optimal spacing
- [ ] **Laptop (1280x720)**:
  - [ ] All features visible
  - [ ] Minor layout adjustments
- [ ] **Tablet (768x1024)**:
  - [ ] Single column layouts
  - [ ] Touch-friendly buttons
  - [ ] Readable text without zoom
- [ ] **Mobile (375x667)**:
  - [ ] Single column layout
  - [ ] Bottom navigation (if applicable)
  - [ ] Large touch targets
  - [ ] Minimal horizontal scrolling

### Touch Testing (on actual device if possible)

- [ ] Buttons easily clickable
- [ ] Drag-drop works on Kanban
- [ ] Modals close properly
- [ ] Forms fillable
- [ ] Keyboard appears when needed

---

## Dark Mode Testing

### All Pages

- [ ] Enable dark mode
- [ ] Visit `/` - dark mode applied
- [ ] Visit `/deals` - dark mode applied
- [ ] Visit `/clients` - dark mode applied
- [ ] Visit `/payments` - dark mode applied
- [ ] Visit `/tasks` - dark mode applied
- [ ] Visit `/notifications` - dark mode applied
- [ ] Visit `/admin` - dark mode applied

### Color Scheme

- [ ] No pure white (use gray-900 or similar)
- [ ] Text color appropriate (white or light gray)
- [ ] Backgrounds dark (gray-950, slate-900, etc.)
- [ ] Badge colors visible
- [ ] All elements have dark mode styles

### Contrast

- [ ] All text readable in dark mode
- [ ] Inputs/forms usable
- [ ] Buttons visible
- [ ] Icons visible

---

## Error State Testing

### Form Validation

- [ ] Submit empty form: shows errors
- [ ] Invalid email: shows error
- [ ] Required fields enforced
- [ ] Error messages clear and helpful

### Network Errors

- [ ] Offline: shows error message
- [ ] API down: shows error
- [ ] Slow network: loading states visible
- [ ] Can retry operations

### Edge Cases

- [ ] Very long text: handled gracefully
- [ ] Special characters: displayed correctly
- [ ] Missing optional fields: not required
- [ ] No results: empty state shown

---

## Console & Network Verification

### Browser Console

- [ ] No JavaScript errors
- [ ] No uncaught exceptions
- [ ] No deprecation warnings
- [ ] No security warnings (CSP, etc.)

### Network Tab

- [ ] All requests successful (2xx status)
- [ ] No failed requests (except optional)
- [ ] No duplicate requests
- [ ] Response times reasonable
- [ ] No sensitive data in logs

### Performance Tab (Lighthouse)

- [ ] Performance score > 80
- [ ] Accessibility score > 90
- [ ] Best Practices score > 90
- [ ] SEO score > 90
- [ ] No critical issues

---

## Final Sign-Off Checklist

### Core Functionality

- [ ] All 8 features working
- [ ] All CRUD operations complete
- [ ] Filtering and search functional
- [ ] Notifications displaying
- [ ] Admin panel operational

### User Experience

- [ ] Responsive on all devices
- [ ] Dark mode supported
- [ ] Accessible via keyboard
- [ ] Screen reader friendly
- [ ] Fast and responsive

### Code Quality

- [ ] No console errors
- [ ] No network failures
- [ ] Proper error handling
- [ ] Clear user feedback
- [ ] Consistent styling

### Testing

- [ ] Unit tests passing
- [ ] E2E tests passing
- [ ] Manual testing complete
- [ ] All edge cases tested
- [ ] Documentation complete

---

## Sign-Off

- [ ] **QA Tester**: _________________ Date: _________
- [ ] **Project Manager**: _____________ Date: _________
- [ ] **Technical Lead**: _____________ Date: _________

## Notes

```
[Space for any issues found or notes]
```

---

**Document Version**: 1.0
**Last Updated**: October 23, 2025
**Status**: READY FOR TESTING

Test this checklist thoroughly to verify all features work correctly!
