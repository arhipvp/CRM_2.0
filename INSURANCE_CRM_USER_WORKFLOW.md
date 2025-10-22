# Insurance CRM - Complete User Workflow Guide

**Version**: 1.0
**Last Updated**: 2025-10-23
**Status**: Production Ready

---

## Table of Contents

1. [System Access & Authentication](#system-access--authentication)
2. [Dashboard Overview](#dashboard-overview)
3. [Deal Management Workflow](#deal-management-workflow)
4. [Client Management](#client-management)
5. [Payment Tracking](#payment-tracking)
6. [Task Management](#task-management)
7. [Notification System](#notification-system)
8. [Document Management](#document-management)
9. [Administrative Functions](#administrative-functions)
10. [Typical Daily Workflow](#typical-daily-workflow)

---

## System Access & Authentication

### 1.1 Login to the System

**URL**: `http://localhost:3000/login`

**Credentials** (Mock Mode - NEXT_PUBLIC_AUTH_DISABLED=true):
- Email: Any valid email format (e.g., `agent@insurance.com`)
- Password: Any password

**Steps**:
1. Open http://localhost:3000 in browser
2. You'll be redirected to /login automatically
3. Enter email address
4. Enter password
5. Click "Войти" (Login)
6. You'll be redirected to the dashboard (/)

**Expected Result**:
- Dashboard loads with deal metrics
- User name appears in top-right user menu
- Navigation menu shows all available sections

### 1.2 Session Management

**Session Features**:
- Auto-restored on page refresh (cookies-based)
- Token-based authentication ready
- Unauthorized requests redirect to login
- Logout clears session

**Logout**:
1. Click user icon (top-right)
2. Select "Logout"
3. Redirected to login page
4. Session cleared

---

## Dashboard Overview

### 2.1 Dashboard Components

**URL**: `http://localhost:3000/`

After login, dashboard shows:

1. **Pipeline Metrics Panel**
   - 5 deal stages displayed in columns:
     - 🎯 Qualification (1 deal)
     - 🤝 Negotiation (1 deal)
     - 📋 Proposal (1 deal)
     - ✅ Won (1 deal)
     - ❌ Lost (0 deals)

   Each column shows:
   - Count of deals
   - Total value in column
   - Conversion rate to next stage
   - Average cycle duration

2. **Quick Filters**
   - **Stage**: All / Qualification / Negotiation / Proposal / Won / Lost
   - **Manager**: Multiple selection (shows "No Manager" option)
   - **Period**: All / This Month / Last Month / Last Quarter / Last Year
   - **Search**: Free-text search by deal name

3. **Metric Chart**
   - Visual representation of pipeline
   - Shows deal counts per stage
   - Conversion funnel visualization

### 2.2 Dashboard Interactions

**Applying Filters**:
```
1. Click "Stage" dropdown → Select "Negotiation"
2. Dashboard metrics update in real-time
3. Shows only deals in Negotiation stage
4. Filters persist during session
```

**Exporting View**:
Currently: Export to CSV available through individual pages
Coming Soon: Dashboard-level export

---

## Deal Management Workflow

### 3.1 Viewing All Deals

**URL**: `http://localhost:3000/deals`

Two view modes available:

#### A. Kanban Board View (Default)

**Layout**:
- 5 vertical columns representing deal stages
- Each column contains deal cards
- Cards show:
  - Deal name
  - Client name
  - Deal value
  - Risk/Status tags
  - Owner (manager name)

**Interactive Features**:
```
Drag & Drop:
1. Click on deal card
2. Drag to different column
3. Drop to change stage
4. Deal status updates automatically
5. Confirmation shows new stage

Example: Move deal "Insurance Renewal" from
Qualification → Negotiation
```

**Filtering**:
- Same filters as dashboard available
- Apply before viewing board
- Realtime update of cards

#### B. Table View

**Columns**:
- Deal Name
- Client
- Stage
- Manager
- Value
- Next Review Date
- Created Date

**Interactions**:
```
Sorting:
- Click column header to sort A→Z or Z→A

Searching:
- Use search box to filter by deal name

Selection:
- Click checkbox to select deals
- Use "Select All" to select all visible deals
```

### 3.2 Creating a New Deal

**URL**: Click "+" button in deal list

**Form Fields**:
```
1. Deal Name *
   Enter: "Q4 Life Insurance Package - Acme Corp"

2. Client * (Dropdown)
   Select existing client:
   - АО "Ромашка"
   - ООО "Альфа"
   - ЗАО "Петрос"

   Or create new inline

3. Next Review Date *
   Select: 2025-12-31
   (Date picker with calendar)

4. Owner (Optional)
   Select manager or leave empty for "No Manager"

5. Description (Optional)
   Enter: "Annual renewal with 15% discount"
```

**Submit**:
```
Click "Создать" (Create)
↓
New deal created with stage "Qualification"
↓
Dashboard updates automatically
↓
Navigate to deal details (automatic or click deal)
```

### 3.3 Editing Deal Details

**URL**: `http://localhost:3000/deals/[dealId]`

**Access via**:
- Click deal card in Kanban board
- Click deal name in table view
- Click deal in search results

**Multi-Tab Interface**:

#### Tab 1: Overview
Shows:
- Deal key metrics (value, probability, cycle duration)
- Recent events (6 last activities)
- Any warnings/risks
- Last interaction date

#### Tab 2: Forms
Editable deal fields:
```
✏️ Edit Fields:
- Deal Name
- Stage (dropdown)
- Value (currency)
- Probability (0-100%)
- Expected Close Date
- Owner/Manager

Save Changes:
- Click "Сохранить" button
- Updates propagate to dashboard
```

#### Tab 3: Calculations
Insurance-specific calculations:
```
Shows:
- Premium calculations
- Commission estimates
- Risk assessment score
- Profitability analysis
- Quote details
```

#### Tab 4: Policies
Client policies for this deal:
```
List of policies:
- Policy Number
- Product Type
- Insurer
- Premium Amount
- Coverage Period
- Status (Active/Archived/Expired)

Actions:
- View full policy details
- Edit policy terms
- Update status
```

#### Tab 5: Journal
Complete activity log:
```
Timeline of all actions:
2025-10-23 15:30 - Created deal
2025-10-23 15:45 - Moved to Negotiation
2025-10-23 16:00 - Added policy
2025-10-23 16:15 - Updated value to $50,000
...

Shows:
- Timestamp
- Action type
- Changed fields
- User who made change
```

#### Tab 6: Tasks
Deal-specific tasks:
```
All tasks related to this deal:
✓ Task 1: Send quote (Done)
⏳ Task 2: Follow-up call (In Progress)
⭕ Task 3: Contract review (Not Started)

Create Task:
- Title: "Send final contract"
- Due Date: 2025-11-15
- Owner: Select team member
- Priority: High/Medium/Low

✓ Complete task by clicking checkbox
```

#### Tab 7: Documents
File management for deal:
```
Uploaded documents:
📄 Quote_v1.pdf (Uploaded: 2025-10-23)
📄 Contract_draft.docx (Uploaded: 2025-10-23)
📄 Insurance_Schedule.xlsx (Uploaded: 2025-10-24)

For each document:
- View version history
- Download file
- Delete document
- Mark for review
- Change review status

Upload New:
1. Click "Upload Document"
2. Select file from computer
3. Set title (optional)
4. Click "Upload"
```

#### Tab 8: Actions
Quick actions:
```
Available Actions:
[Create Task] - Create new task
[Send Email] - Create email draft
[Add Note] - Add quick note
[Schedule Call] - Create calendar event
[Generate Quote] - Create quote PDF
[Export Deal] - Download deal data
```

#### Tab 9: Finance
Financial tracking:
```
Shows:
- Total deal value: $50,000
- Expected commission: $2,500
- Expenses: $500
- Net value: $1,500
- Profitability: 3%

Payment tracking:
All payments related to deal
Payment schedule and history
```

### 3.4 Deal Status Transitions

**Workflow**:
```
Qualification (Initial)
    ↓
Negotiation (Terms discussed)
    ↓ (Both directions)
Proposal (Quote sent)
    ↓
Closed-Won (Signed)
    ↓
Closed-Lost (Rejected)
```

**Example Scenario**:
```
Day 1 - Qualification:
- New lead comes in
- Create deal "Company A - Auto Insurance"
- Stage: Qualification
- Value: Estimated $30,000

Day 3 - Negotiation:
- Contact client
- Discuss terms
- Drag deal to "Negotiation" column
- Update value based on quote: $32,000

Day 5 - Proposal:
- Send formal quote
- Move to "Proposal" stage
- Upload quote PDF in Documents tab
- Create follow-up task

Day 7 - Won:
- Client accepts
- Sign contract
- Move to "Closed-Won"
- Create payment record
- Archive related tasks

Day 8 - Follow-up:
- Schedule next review
- Create reminder task
- Add notes for relationship management
```

---

## Client Management

### 4.1 Viewing Clients

**URL**: `http://localhost:3000/clients`

**Client Directory**:
Shows list of all clients:
```
Column view:
- Client Name
- Industry
- City
- Total Deals (active)
- Lifetime Value
- Last Activity Date
- Status (Active/Inactive)

Interactions:
- Click client name to view details
- Filter by industry/status
- Search by name
- Sort by columns
```

### 4.2 Creating a Client

**URL**: Click "+" in clients list

**Form**:
```
1. Company Name *
   Enter: "ООО Альфа Страхование"

2. Email *
   Enter: "info@alpha-insurance.ru"

3. Phone *
   Enter: "+7 (495) 123-45-67"

4. Owner (Optional)
   Select account manager

5. Additional Info (Optional):
   - Industry: Insurance Broker
   - City: Moscow
```

**Submit**: Click "Создать" (Create)

### 4.3 Client Workspace

**URL**: `http://localhost:3000/clients/[clientId]`

**Navigation Tabs**:

#### Client Overview
```
Key Information:
- Company name & logo
- Contact details (email, phone)
- Associated manager
- Status
- Tags/Categories

Contact Information:
- Primary email & phone
- Alternative contacts
- Preferred communication method

Quick Stats:
- Total active deals: 2
- Lifetime value: $250,000
- Last activity: 2 days ago
- Account age: 6 months
```

#### Client Deals
```
All deals with this client:

Active Deals:
1. Q4 Insurance Package - $50,000 (Negotiation)
2. Fleet Insurance Review - $30,000 (Qualification)

Closed Deals (Past 12 months):
1. Annual Renewal - $100,000 (Won)
2. Policy Adjustment - $20,000 (Won)

View Deal:
- Click deal name → Opens deal details
- Move between stages from here
```

#### Client Policies
```
Insurance policies for this client:

Active Policies:
1. General Liability
   - Product: General Liability Insurance
   - Insurer: AXA Insurance
   - Premium: $5,000/year
   - Period: Jan 1 - Dec 31, 2025
   - Status: Active ✓

2. Workers Compensation
   - Premium: $3,500/year
   - Period: Jan 1 - Dec 31, 2025
   - Status: Active ✓

Archived Policies:
- Previous years' policies with dates

Actions:
- Click policy to view full details
- Edit terms if needed
- Renew policy (creates new deal)
- Archive policy
```

#### Client Tasks
```
All tasks for this client:

Open Tasks:
☐ Send annual renewal quote
  Due: 2025-11-15
  Owner: John Smith

☐ Follow-up call on pricing
  Due: 2025-11-20
  Owner: Sarah Johnson

Completed Tasks:
☑ Initial consultation
  Completed: 2025-10-20

Create Task:
- Title: "Quarterly business review"
- Due: 2025-11-30
- Assign to: Manager
```

#### Client Reminders
```
Important dates:
- Policy renewals
- Payment due dates
- Review schedule
- Contract anniversaries

Calendar view shows:
- Upcoming renewal dates
- Historical milestones
- Interaction schedule
```

### 4.4 Editing Client Information

**Edit Contacts**:
```
In Client Workspace → Overview tab

Click "Edit" button:
1. Update company name
2. Change email
3. Update phone
4. Add/remove contact persons
5. Save changes

Changes sync to all related deals
```

---

## Payment Tracking

### 5.1 Viewing All Payments

**URL**: `http://localhost:3000/payments`

**Payment Table**:
```
Columns:
- Payment ID
- Client Name
- Deal Name
- Policy Number
- Planned Amount
- Actual Amount
- Planned Date
- Actual Date
- Status
- Actions

Status Values:
- 🟡 Planned (waiting for client)
- ⏳ In Progress (being processed)
- ✅ Paid (confirmed received)
- ❌ Failed (payment issue)
- 📋 Pending Review (awaiting approval)

Filtering:
- By status
- By client
- By deal
- By date range
```

### 5.2 Creating a Payment Record

**URL**: Click "+" in payments list

**Payment Form**:
```
1. Deal * (Dropdown)
   Select deal this payment is for:
   "Q4 Insurance Package"

2. Client * (Auto-populated from deal)
   Shows: "ООО Альфа"

3. Policy Number *
   Enter: "POL-2025-001234"

4. Planned Amount *
   Enter: $50,000

5. Planned Date *
   Select: 2025-11-30

6. Currency *
   Select: USD / EUR / RUB

7. Status (Optional)
   Default: "Planned"

8. Comment (Optional)
   Enter: "Annual premium payment"

9. Owner (Optional)
   Select who handles this payment
```

**Submit**: Click "Создать" (Create)

### 5.3 Recording Payment Receipt

**When Payment Received**:

1. Navigate to payment in payments table
2. Click payment row to open details
3. Click "Confirm Payment" button

**Confirmation Form**:
```
1. Actual Amount *
   Enter: $50,000
   (Can differ from planned)

2. Actual Date *
   Select: 2025-11-28
   (When payment was received)

3. Recorded By *
   Auto-filled: Your name

4. Comment (Optional)
   Enter: "Received via bank transfer"

5. Attachments (Optional)
   Upload: Bank confirmation, receipt
```

**Submit**: Click "Confirm" (Подтвердить)

**Result**:
- Status changes to "Paid" ✅
- Date updated to actual
- Amount updated if different
- Linked to deal automatically
- Recorded in activity log

### 5.4 Payment Lifecycle Example

```
Oct 23 - Create payment:
  Amount: $50,000
  Due: Nov 30
  Status: Planned

Nov 15 - Update planned date:
  Move to Nov 20 (customer called)
  Create follow-up task

Nov 20 - Still waiting:
  Status: In Progress
  Add note about delay

Nov 28 - Payment received:
  Click "Confirm Payment"
  Enter actual amount: $50,000
  Confirm receipt
  Status: Paid ✅

Dec 1 - Review payment:
  Check payment history
  Verify in financial reports
```

---

## Task Management

### 6.1 Viewing All Tasks

**URL**: `http://localhost:3000/tasks`

**Task List**:
```
View modes:
- Board view (columns by status)
- List view (table)
- Calendar view (timeline)

Statuses:
- 🆕 New (created but not started)
- ⏳ In Progress (being worked on)
- ⏸️ Waiting (blocked/waiting on someone)
- ✅ Done (completed)

Filtering:
- By status
- By owner
- By due date
- By priority
- By type (call, email, meeting, follow-up)

Sorting:
- By due date (urgent first)
- By priority
- By assignee
```

### 6.2 Creating a Task

**URL**: Click "+" in tasks list OR via deal/client workspace

**Task Form**:
```
1. Title *
   Enter: "Send final contract to customer"

2. Due Date *
   Select: 2025-11-20

3. Owner *
   Select team member to assign

4. Status (Optional)
   Default: "New"
   Options: New / In Progress / Waiting / Done

5. Priority (Optional)
   Default: Medium
   Options: Low / Medium / High / Urgent

6. Type (Optional)
   Select: Call / Email / Meeting / Follow-up / Admin

7. Related To (Optional):
   - Select Deal: "Q4 Insurance Package"
   - OR Select Client: "ООО Альфа"

8. Description (Optional)
   Enter task details and context

9. Checklist (Optional):
   Add sub-tasks:
   ☐ Research client needs
   ☐ Prepare quote
   ☐ Schedule call
   ☐ Send materials

10. Reminder (Optional)
    Set to: 1 day before, 2 hours before, etc.
```

**Submit**: Click "Создать"

### 6.3 Managing Tasks

**Updating Task Status**:
```
Option 1 - Quick update:
1. In task list, click status dropdown
2. Select new status
3. Auto-saves

Option 2 - Full edit:
1. Click task to open details
2. Click "Edit" button
3. Change any fields
4. Click "Save"

Status Workflow:
New → In Progress → Done
     ↓            ↓
   Waiting (if blocked/awaiting)
```

**Completing Tasks**:
```
1. In task list, check task checkbox
2. Task moves to "Done" section
3. Completion date recorded

OR

1. Click task details
2. Click "Complete" button
3. Confirm
```

**Task Example Workflow**:
```
Monday 9:00 - Create task:
Task: "Follow up on quote"
Due: Wednesday 2pm
Owner: You

Monday 10:00 - Start working:
Status: In Progress
Add note: "Contacted customer, waiting for feedback"

Wednesday 1:00 - Customer responds:
Status: Waiting (they're reviewing internally)
Set reminder: Friday 9am

Friday 9:00 - Follow up again:
Check status, customer still reviewing
Status: Still Waiting

Friday 2:00 - Customer approves:
Update status: Done ✅
Completion date: 2025-10-27
Create follow-up task: "Process contract"
```

### 6.4 Bulk Task Operations

**Bulk Edit**:
```
1. Select multiple tasks (checkboxes)
2. Click "Bulk Actions" button
3. Choose action:
   - Change status (all → "In Progress")
   - Change owner (reassign to different person)
   - Shift due date (+3 days, -1 week, etc.)
   - Add tag/category
   - Delete (confirm)
```

**Example**:
```
Scenario: Manager going on vacation
Action: Reassign all their open tasks

1. Filter: Owner = "John Smith", Status != Done
2. Select all: [Select All]
3. Click "Bulk Actions"
4. Choose: "Change Owner"
5. New Owner: "Sarah Johnson"
6. Confirm
→ All of John's tasks reassigned to Sarah
```

---

## Notification System

### 7.1 Notification Feed

**URL**: `http://localhost:3000/notifications`

**Two Sections**:

#### Feed Tab - Incoming Notifications
```
Shows all notifications:
- Deal created by team member
- Payment confirmed
- Task due soon
- Policy renewal reminder
- Client status changed
- Document uploaded
- System alerts

Each notification shows:
- Title: "New deal created"
- Message: "Sales agent John created..."
- Timestamp: "2 hours ago"
- Category: Deal / Task / Payment / System
- Source: CRM / Telegram / Email
- Status: Read / Unread
- Importance: Normal / Important ⭐

Filters:
- Category: All / Deal / Task / Payment / System
- Source: All / CRM / Telegram / Email
- Status: All / Unread / Important / Failed
- Date range
```

#### Event Journal Tab - Audit Log
```
Complete system activity log:

Shows events in chronological order:
2025-10-23 15:30 - Deal created
  Actor: John Smith (Sales Agent)
  Scope: Deal Management
  Summary: Created deal "Insurance Package"
  Severity: Info

2025-10-23 15:45 - Deal stage changed
  Actor: John Smith
  Scope: Deal Management
  Summary: Moved deal to "Negotiation" stage
  Severity: Info

2025-10-23 16:00 - Payment recorded
  Actor: Sarah Johnson (Accountant)
  Scope: Payment Management
  Summary: Recorded $50,000 payment
  Severity: Info

2025-10-23 17:30 - User permission changed
  Actor: Admin (System Admin)
  Scope: User Management
  Summary: Granted "manage_deals" permission
  Severity: Warning

Filtering:
- By scope (Deal, Payment, User, System, etc.)
- By severity (Info, Warning, Critical)
- By date range
- By user
- By action type
```

### 7.2 Notification Delivery Channels

**Available Channels**:

#### SSE (Server-Sent Events)
- Real-time in-app notifications
- Browser push notifications
- Default: ✅ Enabled
- Use for: Immediate alerts

#### Telegram Integration
- Push notifications to Telegram
- Bot integration ready
- Configuration: `/notifications` → Settings
- Use for: Critical alerts

**Channel Settings**:
```
In Notifications page:

SSE Notifications:
  ☑️ Enabled
  Push to browser: ☑️

Telegram:
  ☑️ Enabled
  Bot connected: Yes (@CRMBot)
  Chat ID: Linked
  Notifications: Daily Summary

Email:
  ☑️ Enabled
  Frequency: Immediate / Daily / Weekly
  Types: All / Important Only
```

### 7.3 Notification Interactions

**Mark as Read**:
```
Unread notification in feed:
1. Click notification or "Mark as read" button
2. Notification moves to "Read" section
3. Badge count decreases
```

**Mark as Important**:
```
Important notification (keep for reference):
1. Click star icon on notification
2. Starred notifications group at top
3. Can filter to show only important
```

**Delete Notification**:
```
1. Hover over notification
2. Click trash/delete icon
3. Confirm deletion
4. Notification removed from feed
```

---

## Document Management

### 8.1 Uploading Documents

**Where to Upload**:

**Option 1 - From Deal Page**:
```
1. Go to Deal Details → Documents Tab
2. Click "Upload Document"
3. Select file from computer (PDF, Word, Excel, Images)
4. Enter document title (optional)
5. Click "Upload"
6. Document appears in list
```

**Option 2 - From Deal Creation**:
```
Can attach documents while creating deal
1. In deal form, scroll to Documents section
2. Click "Add Document"
3. Select file
4. Click Upload
5. Document attached to deal
```

### 8.2 Document Organization

**Document Types**:
```
For deals:
- Quotes and proposals
- Contracts
- Insurance schedules
- Payment confirmations
- Certificates

For clients:
- Company documents
- ID/Registration
- Insurance records
- Historical documents

File Organization:
Deal ID / Document ID / Version
Example: deal_123 / quote_456 / v2 / quote.pdf
```

### 8.3 Document Versioning

**When Document Updated**:
```
1. Upload new version of same file
2. System keeps version history
3. Can compare versions
4. Can revert to previous version

Example:
Quote_v1.pdf (Oct 20, 10:00 AM)
Quote_v2.pdf (Oct 20, 2:30 PM) - Revised
Quote_v3.pdf (Oct 21, 9:00 AM) - Final

Click on any version to:
- Download it
- View it
- Restore it as current
- Compare with other version
```

### 8.4 Document Status

**Review Status**:
```
Set document status:
- 📄 Draft (not yet ready)
- ✏️ Pending Review (awaiting approval)
- ✅ Reviewed (approved)
- 🔒 Final (locked, don't change)
- 🗑️ Archived (old version)

Track who reviewed:
- Reviewer name
- Review date
- Comments
```

---

## Administrative Functions

### 9.1 User Management

**URL**: `http://localhost:3000/admin`

**View Users**:
```
Table of all system users:

Columns:
- User Name
- Email
- Role
- Status (Active / Invited / Suspended)
- Last Active
- Actions

Current Users:
1. admin@company.com (Super Admin) - Active
2. john.smith@company.com (Sales) - Active
3. sarah.johnson@company.com (Sales) - Active
4. account@company.com (Accountant) - Invited
```

**Create New User**:
```
Click "Add User" button:

Form:
1. Full Name *
   Enter: "Michael Brown"

2. Email *
   Enter: "michael.brown@company.com"

3. Role *
   Select: Sales / Accountant / Manager / Super Admin

4. Initial Status
   Default: "Invited"
   (User gets email with activation link)

5. Enable MFA
   Checkbox: Two-factor authentication

6. Permissions (role-specific)
   Auto-populated by role
   Can customize if needed

Submit: Click "Create User"
```

**Edit User**:
```
1. Click user row
2. Click "Edit" button
3. Update:
   - Name
   - Role
   - Status
   - Permissions
   - MFA settings
4. Click "Save"
```

**Suspend User**:
```
If user leaves or needs to be deactivated:
1. Click user row
2. Click "Actions" → "Suspend"
3. User marked as Suspended
4. Cannot login
5. Can be reactivated later
```

### 9.2 System Dictionaries

**What are Dictionaries?**

System values that categorize data:
```
Deal Types:
- Insurance Brokerage
- Risk Management
- Claims Handling
- Policy Renewal

Task Types:
- Sales Call
- Email Follow-up
- Meeting
- Document Review

Payment Status:
- Pending
- In Progress
- Paid
- Failed
```

**Managing Dictionaries**:
```
In Admin → Dictionaries tab:

Show: All / Deal Types / Task Types / Payment Status / etc.

For each entry:
- Code: Internal identifier
- Label: Display name (in Russian)
- Description: What it's for
- Active: ☑️ Yes / ☐ No

Add New:
1. Click "Add Entry"
2. Select type
3. Enter code: "new_deal_type"
4. Enter label: "Новый тип сделки"
5. Enter description
6. Click "Add"

Edit Entry:
1. Click entry
2. Update label/description
3. Click "Save"

Bulk Operations:
1. Select multiple entries
2. Click "Bulk Edit"
3. Activate/deactivate all at once
```

### 9.3 Audit Log

**View Audit Trail**:

```
URL: Admin → Audit Log tab

Shows all system actions:

Entry Example:
Date: 2025-10-23 15:30:00
User: John Smith (Sales Agent)
Action: create_deal
Scope: Deal Management
Resource: Deal #123
Summary: Created new deal "Insurance Package"
Severity: Info

Filtering:
- By date range
- By user
- By scope (Deal, Payment, User, etc.)
- By severity (Info, Warning, Critical)
- Search by action/resource

Export:
- Click "Export"
- Choose format: CSV or JSON
- Download audit records
- Use for compliance, reporting
```

---

## Typical Daily Workflow

### Complete Day-in-the-Life Scenario

**User**: Sales Agent (John Smith)

---

### Morning (9:00 AM)

**1. Check Dashboard**
```
9:00 AM - Login
- Open http://localhost:3000
- Enter credentials
- Dashboard loads

Review Metrics:
- Pipeline: $250,000 total value
- Conversion rate: 50% (negotiation → proposal)
- Review upcoming tasks and deadlines

Check Notifications:
- 3 unread notifications
- Review for urgent items
```

**2. Check Tasks**
```
9:15 AM - Navigate to Tasks page

Morning tasks:
☐ Follow up on quote from yesterday (Due today)
☐ Send proposal to Company B (Due tomorrow)
☐ Schedule call with existing client (Due 2 days)
☐ Review insurance calculations (Due 3 days)

Click first task:
- Open "Follow up on quote from yesterday"
- Status: In Progress (already started)
- Client: Company A
- Deal: "Q4 Insurance Package"
- Related to deal: Click to open deal details
```

**3. Open Deal Details**
```
9:20 AM - Deal: "Q4 Insurance Package"

Review current state:
- Status: Negotiation
- Value: $45,000
- Days in stage: 3
- Last activity: Sent quote yesterday

Check Documents Tab:
- Quote_v2.pdf (sent yesterday)
- Previous communication notes

Current Action:
- Call customer for feedback
- Expected: Positive response today
- Update task: "Follow up on quote"
- Status: In Progress
```

---

### Midday (11:00 AM - 2:00 PM)

**4. Create New Deal**
```
11:30 AM - New lead comes in from inbound call

Navigate to: Deals page → Click "+"

Create Deal Form:
- Deal Name: "Company C - General Liability"
- Client: Select "Company C" from list
- Next Review: 2025-11-15
- Owner: John Smith (already selected)
- Description: "Inbound lead, needs GL coverage"

Submit: Create deal
→ New deal created in Qualification stage
→ Dashboard updates
```

**5. Open New Deal to Add More Info**
```
11:45 AM - Click on new deal card

Add Information:
- Forms tab: Set estimated value $60,000
- Set probability: 40% (early stage)
- Create task: "Send initial quote" (Due 2 days)
- Save changes

Result:
- Deal value added to pipeline
- Task created and assigned
- Notifications sent to team
```

**6. Respond to Customer Call**
```
1:00 PM - Phone call from Company A

Customer says: "Quote looks good,
but need to see payment terms"

Update Deal:
- Move from Negotiation → Proposal
  (Drag card to Proposal column)
- Update task: "Send proposal"
  Status: In Progress
- Create new task: "Prepare payment terms"
  Due: Tomorrow (for internal review)
```

---

### Afternoon (2:00 PM - 5:00 PM)

**7. Review Payments**
```
2:30 PM - Navigate to Payments page

Check status:
- Last month: Company A paid $50,000 ✅
- Current: Company B payment $30,000 due yesterday
  Status: In Progress (late)

Action on late payment:
1. Click payment row
2. Add note: "Following up with Company B"
3. Create reminder task
4. Schedule follow-up call
```

**8. Record Received Payment**
```
3:00 PM - Email from accounting:
"Company C payment received: $15,000"

Navigate to payment for Company C:
1. Find payment in table
2. Click "Confirm Payment"
3. Fill form:
   - Actual Amount: $15,000
   - Actual Date: 2025-10-23
   - Status: Paid
4. Submit
5. Payment marked as ✅ Paid
6. Notification sent to team
7. Deal financial metrics update
```

**9. Administrative Task - Add Notes**
```
3:30 PM - Quick admin work

Go to Admin → User Management:
- Check new team member status
- New user "Sarah Wilson" invited but not yet activated
- Send reminder email if needed

Go to Admin → Audit Log:
- Check recent deal creations
- Verify all changes logged properly
```

**10. Final Review of Day**
```
4:45 PM - Review what's left

Check Notifications:
- Review all unread
- Mark important ones with star
- Delete spam/old notifications

Check Tomorrow's Tasks:
- 2 tasks due tomorrow
- Both on track
- One needs reminder set

Check Email/Messages:
- 1 client response to quote
- Update related deal with customer feedback
```

---

### Late Day (5:00 PM)

**11. Prepare for Tomorrow**
```
4:50 PM - Review pending items

Tomorrow's focus:
1. Follow up on Company C quote (high priority)
2. Schedule meeting with Company B about payment
3. Send payment terms to Company A
4. Review insurance calculations for new deal

Create prep tasks if needed:
- Document review needed: Create task
- Manager approval needed: Assign to manager
- Client info missing: Add note to deal

Save any draft responses/quotes for morning
```

**12. Logout**
```
5:00 PM - End of day

Click user menu → "Logout"
✓ Session ends
✓ All changes saved
✓ Ready for next login

Next day:
- Login again
- Dashboard shows updated metrics
- New notifications waiting
- Tasks carry over
```

---

## Key Metrics & KPIs Tracked

### Deal Metrics
- **Pipeline Value**: Total value of open deals
- **Conversion Rate**: % moving from stage to stage
- **Average Cycle Time**: Days from Qualification to Won
- **Win Rate**: % of deals won vs. lost

### Payment Metrics
- **On-time Rate**: % payments received by due date
- **Average Days Late**: For overdue payments
- **Collection Rate**: % of expected payments received
- **Payment Forecast**: Expected cash by period

### Task Metrics
- **Completion Rate**: % of tasks completed on time
- **Average Task Duration**: Days from creation to completion
- **Overdue Rate**: % of tasks past due date
- **Workload Balance**: Tasks per team member

### Client Metrics
- **Lifetime Value**: Total value of all deals with client
- **Active Deal Count**: Number of active opportunities
- **Policy Count**: Active insurance policies
- **Renewal Rate**: % of policies renewed

---

## Common Issues & Solutions

### Issue: Deal won't move between stages
**Solution**:
1. Refresh page (F5)
2. Ensure deal value is set
3. Check if blocked by missing information
4. Try again

### Issue: Payment not showing up
**Solution**:
1. Ensure deal is selected for payment
2. Check date range in filters
3. Refresh notifications
4. Verify payment was created successfully

### Issue: Task not assigned
**Solution**:
1. Open task details
2. Click "Edit"
3. Select owner from dropdown
4. Click "Save"

### Issue: Notifications not arriving
**Solution**:
1. Check notification settings
2. Verify delivery channel enabled
3. Check email/Telegram settings
4. Refresh browser

---

## Tips & Best Practices

### Deal Management
✓ Always set next review date when creating deal
✓ Update deal value as you learn more
✓ Use descriptive deal names
✓ Move deals stage only when criteria met
✓ Document key decisions in deal notes

### Task Management
✓ Create tasks for every follow-up action
✓ Set realistic due dates
✓ Assign to responsible person immediately
✓ Complete tasks before deal closes
✓ Use reminders for critical dates

### Payment Tracking
✓ Create payment record immediately after quote
✓ Confirm payment receipt within 24 hours
✓ Document any discrepancies
✓ Follow up on overdue payments immediately
✓ Monthly reconciliation

### Client Relations
✓ Update client info after each interaction
✓ Note interaction history in journal
✓ Keep policy records current
✓ Schedule regular review meetings
✓ Proactive renewal outreach

### Admin Best Practices
✓ Regular audit log review (weekly)
✓ User access reviews (monthly)
✓ Keep dictionary values current
✓ Archive old data quarterly
✓ Document policy changes

---

## System Requirements

- **Browser**: Modern browser (Chrome, Firefox, Safari, Edge)
- **Internet**: Stable connection
- **Screen Size**: 1366x768 minimum (responsive design)
- **Mobile**: Mobile view available (optimized for tablets)

## Support

For issues or questions:
1. Check this guide first
2. Review notification messages for hints
3. Contact system admin
4. Report bugs with details

---

**Last Updated**: 2025-10-23
**Version**: 1.0
**Status**: Production Ready
