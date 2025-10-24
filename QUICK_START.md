# CRM Desktop Application - Quick Start Guide

## 5-Minute Setup

### Step 1: Install Dependencies
```bash
cd desktop_app
pip install -r requirements.txt
```

### Step 2: Ensure Backend is Running
```bash
# Backend should be at http://localhost:8082/api/v1
curl http://localhost:8082/api/v1/clients
# Should return: [] or list of clients
```

### Step 3: Start Application
```bash
python main.py
```

### Step 4: Test Basic Operations
1. On "Clients" tab: Click "Add" → Create test client
2. On "Deals" tab: Click "Add Deal" → Create test deal
3. View details by double-clicking any row
4. Edit by selecting and clicking "Edit"
5. Delete by selecting and clicking "Delete"

---

## What You Can Do

### Clients Tab
- ✓ Create, edit, delete clients
- ✓ View full client details
- ✓ Search by name/email/phone
- ✓ Export to CSV/Excel

### Deals Tab (NEW)
- ✓ Create, edit, delete deals
- ✓ Select client from dropdown
- ✓ Add description and due date
- ✓ View deal details
- ✓ Search and export

### Payments Tab (ENHANCED)
- ✓ Create, edit, delete payments
- ✓ Select deal and policy
- ✓ Track payment status and amounts
- ✓ View payment history
- ✓ Search and export

### Policies Tab (ENHANCED)
- ✓ Create, edit, delete policies
- ✓ Link to clients and deals
- ✓ Set effective dates
- ✓ Manage premium amounts
- ✓ Search and export

### Calculations Tab (ENHANCED)
- ✓ Create, edit, delete calculations
- ✓ Track insurance programs
- ✓ Calculate coverage sums
- ✓ Manage status and comments
- ✓ Search and export

### Tasks Tab
- ✓ Create, edit, delete tasks
- ✓ Set priority and due dates
- ✓ Track status and progress
- ✓ Link to deals/clients
- ✓ Search and export

---

## Common Operations

### Creating a Record

#### Example: Create a Deal
1. Click "Deals" tab
2. Click "Add Deal" button
3. In dialog:
   - Title: "New Project Deal"
   - Client: Select from dropdown (required)
   - Description: "Project details"
   - Status: "draft"
   - Amount: "50000"
   - Next Review Date: "2024-12-31"
4. Click OK
5. Confirm in table

### Editing a Record

#### Example: Edit a Payment
1. Click "Payments" tab
2. Select deal from dropdown
3. Click payment in table
4. Click "Edit" button
5. Modify fields (all pre-filled)
6. Click OK
7. Confirm changes

### Deleting a Record

#### Example: Delete a Policy
1. Click "Policies" tab
2. Select policy in table
3. Click "Delete" button
4. Confirm in dialog
5. Policy removed from table

### Viewing Details

#### Example: View Client Details
1. Click "Clients" tab
2. Double-click any client row
3. Detail dialog opens with:
   - General Info tab
   - Timestamps tab (creation, updates)
4. Close when done

---

## Troubleshooting

### "Connection refused" Error
**Problem**: Backend API not running
**Solution**:
```bash
# Check if backend is running
curl http://localhost:8082/api/v1/clients

# If not running, start your backend first
# Then restart the CRM application
```

### "Dropdown is empty" Error
**Problem**: No related data to select from
**Solution**: Create the related entity first
- Example: Create Clients before creating Deals
- Example: Create Deals and Policies before creating Payments

### "UI is frozen"
**Problem**: API call in progress
**Solution**: Wait for operation to complete (usually 1-5 seconds)

### "Invalid [field] selected"
**Problem**: Selected item no longer exists in DB
**Solution**: Click "Refresh" button to reload data

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Alt+A | Add new record |
| Alt+E | Edit selected record |
| Alt+D | Delete selected record |
| Alt+R | Refresh/Reload data |
| Escape | Close dialogs |
| Enter | Submit form in dialog |

---

## Data Flow

### Creating a Record
```
User clicks Add
      ↓
Dialog opens (pre-filled if editing)
      ↓
User fills fields and clicks OK
      ↓
Validation occurs
      ↓
API call in background thread
      ↓
Success: Table refreshes, message shown
Error: Error message displayed
```

### Searching/Filtering
```
User types in search box
      ↓
Table filtered in real-time
      ↓
Only matching rows shown
      ↓
Refresh or clear to see all again
```

### Exporting
```
User clicks Export CSV/Excel
      ↓
File save dialog opens
      ↓
Choose location and filename
      ↓
File created with current table data
```

---

## Important Notes

### Data Validation
- All required fields must be filled (shown in error messages)
- Numbers must be valid numbers
- Dates must be YYYY-MM-DD format
- Dropdown selections must be made from available options

### Threading
- All API operations run in background
- UI remains responsive
- Error messages appear when operations complete

### State Management
- Data is cached in memory during session
- Click "Refresh" to reload from server
- Changes are persisted to backend immediately

### Dropdowns
- Loaded from database
- Display friendly names (e.g., client names)
- Store IDs internally
- Must select from list (can't type new values)

---

## API Integration

### Endpoints Used

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/v1/clients | List clients |
| POST | /api/v1/clients | Create client |
| PATCH | /api/v1/clients/{id} | Update client |
| DELETE | /api/v1/clients/{id} | Delete client |
| GET | /api/v1/deals | List deals |
| POST | /api/v1/deals | Create deal |
| PATCH | /api/v1/deals/{id} | Update deal |
| DELETE | /api/v1/deals/{id} | Delete deal |
| GET | /api/v1/payments | List payments |
| POST | /api/v1/payments | Create payment |
| PATCH | /api/v1/payments/{id} | Update payment |
| DELETE | /api/v1/payments/{id} | Delete payment |
| ... | ... | ... (similar for policies, tasks) |

### Test API Connection
```bash
# Get all clients
curl http://localhost:8082/api/v1/clients

# Create a client
curl -X POST http://localhost:8082/api/v1/clients \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com","phone":"+7-999-1234567"}'

# Update a client (replace {id})
curl -X PATCH http://localhost:8082/api/v1/clients/{id} \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane Doe"}'

# Delete a client
curl -X DELETE http://localhost:8082/api/v1/clients/{id}
```

---

## Configuration

### API Configuration
Edit `config.py` to change API URL:
```python
API_BASE_URL = "http://localhost:8082/api/v1"
API_TIMEOUT = 10  # seconds
```

### Logging
Edit `logger.py` to change log level:
```python
LOG_LEVEL = "DEBUG"  # or INFO, WARNING, ERROR
```

---

## Next Steps

### 1. Get Familiar with UI (5 minutes)
- Open each tab
- Click buttons to see dialogs
- Get comfortable with layout

### 2. Create Sample Data (5 minutes)
- Create 2-3 test clients
- Create 2-3 test deals (must select client)
- Create test policies and payments

### 3. Test CRUD Operations (10 minutes)
- Create, edit, delete each entity
- Try searching/filtering
- Export to CSV

### 4. Read Full Documentation (20 minutes)
- IMPLEMENTATION_SUMMARY.md (overview)
- TESTING_GUIDE.md (detailed test cases)
- ARCHITECTURE.md (system design)

### 5. Run Full Test Suite (30 minutes)
- Follow test cases in TESTING_GUIDE.md
- Verify all features work
- Test with real backend

### 6. Deploy (Optional)
- Package as executable using PyInstaller
- Distribute to team
- Monitor logs

---

## Feature Checklist

### Before Going Live
- [ ] All CRUD operations tested
- [ ] Search/filtering working
- [ ] Export to CSV/Excel working
- [ ] Error messages appropriate
- [ ] UI responsive (no freezing)
- [ ] Validation works correctly
- [ ] Date fields accepting YYYY-MM-DD
- [ ] Dropdowns populated correctly
- [ ] Detail views displaying all data
- [ ] Refresh button working

### Performance Check
- [ ] App starts in < 3 seconds
- [ ] Adding record takes 1-2 seconds
- [ ] Searching 1000 records is instant
- [ ] Exporting 1000 records takes < 1 second
- [ ] No memory leaks after long use

### Error Handling
- [ ] Network errors handled gracefully
- [ ] Validation errors show clear messages
- [ ] 401 errors prompt re-login
- [ ] 404 errors show user-friendly message
- [ ] 500 errors show error details

---

## Support & Help

### Documentation Files
Located in `desktop_app/`:
- **IMPLEMENTATION_SUMMARY.md** - What was implemented
- **TESTING_GUIDE.md** - How to test everything
- **ARCHITECTURE.md** - How the system works
- **FEATURES_IMPLEMENTED.md** - Feature details
- **FILES_OVERVIEW.md** - File guide

### Common Issues

| Issue | Solution |
|-------|----------|
| API error | Ensure backend is running at correct URL |
| Dropdown empty | Create parent entity first (e.g., Clients) |
| UI freezing | Wait for API call to complete |
| Invalid selection | Dropdown value changed in DB, refresh |
| Export fails | Ensure openpyxl installed for Excel |

---

## Video Tutorial (Simulated)

### 1. Opening the App (30 seconds)
- Double-click main.py
- App loads
- Login (if required)
- Main window appears

### 2. Creating a Client (1 minute)
- Click "Clients" tab
- Click "Add" button
- Fill Name, Email, Phone, Status
- Click OK
- Client appears in table

### 3. Creating a Deal (2 minutes)
- Click "Deals" tab
- Click "Add Deal"
- Fill Title, select Client, add Description
- Set Status to "draft"
- Enter Amount and Due Date
- Click OK
- Deal appears in table

### 4. Editing a Record (1 minute)
- Click record in table
- Click "Edit"
- Modify fields
- Click OK
- Changes appear immediately

### 5. Searching (30 seconds)
- Type in search box
- Table filters instantly
- Clear to see all again

---

## Conclusion

You now have a fully functional CRM Desktop Application with:
- ✓ Complete CRUD for 6 entities
- ✓ Professional dialogs with validation
- ✓ Search and export capabilities
- ✓ Error handling and user feedback
- ✓ Responsive UI with background operations

**Start using it now!**

```bash
cd desktop_app
python main.py
```

---

**Need help?** Check the documentation files or review TESTING_GUIDE.md for detailed instructions.

**Happy CRM-ing!**
