# Tasks Tab Implementation Guide

**Complete code changes with exact line numbers and before/after comparisons**

---

## STEP 1: Add TaskEditDialog to edit_dialogs.py

### Location: After CalculationEditDialog (after line 433)

### Code to Add:

```python
# --- Task Edit Dialog ---

class TaskEditDialog(BaseEditDialog):
    """Dialog for adding/editing tasks"""

    def __init__(self, parent, task=None, deals_list: List[Dict[str, Any]] = None,
                 clients_list: List[Dict[str, Any]] = None):
        super().__init__(parent, "Edit Task" if task else "Add Task", task)
        self.deals_list = deals_list or []
        self.clients_list = clients_list or []
        self.deal_dict = {d.get("title", f"Deal {d.get('id')}"): d.get("id") for d in self.deals_list}
        self.client_dict = {c.get("name", f"Client {c.get('id')}"): c.get("id") for c in self.clients_list}

        self.title_var = tk.StringVar(value=task.get("title", "") if task else "")
        self.description_var = tk.StringVar(value=task.get("description", "") if task else "")
        self.status_var = tk.StringVar(value=task.get("status", "open") if task else "open")
        self.priority_var = tk.StringVar(value=task.get("priority", "normal") if task else "normal")
        self.due_date_var = tk.StringVar(value=task.get("due_date", "") if task else "")
        self.deal_id_var = tk.StringVar()
        self.client_id_var = tk.StringVar()

        # Set dropdowns to current values
        if task:
            if task.get("deal_id"):
                deal_name = next((d.get("title") for d in self.deals_list if d.get("id") == task.get("deal_id")), None)
                if deal_name:
                    self.deal_id_var.set(deal_name)
            if task.get("client_id"):
                client_name = next((c.get("name") for c in self.clients_list if c.get("id") == task.get("client_id")), None)
                if client_name:
                    self.client_id_var.set(client_name)

        # Title
        self.create_field(0, "Title", self.title_var, "entry")

        # Description
        self.create_field(1, "Description", self.description_var, "text")

        # Status
        self.create_field(2, "Status", self.status_var, "combobox",
                         ["open", "in_progress", "completed", "closed"])

        # Priority
        self.create_field(3, "Priority", self.priority_var, "combobox",
                         ["low", "normal", "high", "urgent"])

        # Due Date
        self.create_field(4, "Due Date", self.due_date_var, "date")

        # Deal (optional)
        self.create_field(5, "Deal", self.deal_id_var, "combobox",
                         list(self.deal_dict.keys()))

        # Client (optional)
        self.create_field(6, "Client", self.client_id_var, "combobox",
                         list(self.client_dict.keys()))

        # Buttons
        self.setup_buttons(7)

    def on_ok(self) -> None:
        """Handle OK button"""
        title = self.title_var.get().strip()

        if not title:
            messagebox.showerror("Error", "Title cannot be empty.", parent=self)
            return

        description = self.get_text_value(self.description_var)
        deal_name = self.deal_id_var.get().strip()
        client_name = self.client_id_var.get().strip()

        self.result = {
            "title": title,
            "description": description,
            "status": self.status_var.get(),
            "priority": self.priority_var.get(),
            "due_date": self.due_date_var.get() if self.due_date_var.get() else None,
            "deal_id": self.deal_dict.get(deal_name) if deal_name else None,
            "client_id": self.client_dict.get(client_name) if client_name else None
        }
        self.destroy()
```

---

## STEP 2: Update tasks_tab.py - Line 1-10 (Imports)

### Location: Lines 1-10

### BEFORE:
```python
"""Tasks tab module for CRM Desktop App"""
import tkinter as tk
from tkinter import ttk, messagebox, simpledialog, filedialog
from typing import Optional, Dict, Any, Callable, List
from threading import Thread
from datetime import datetime
from crm_service import CRMService
from logger import logger
from detail_dialogs import TaskDetailDialog
from search_utils import SearchFilter, DataExporter, search_filter_rows
```

### AFTER:
```python
"""Tasks tab module for CRM Desktop App"""
import tkinter as tk
from tkinter import ttk, messagebox, simpledialog, filedialog
from typing import Optional, Dict, Any, Callable, List
from threading import Thread
from datetime import datetime
from crm_service import CRMService
from logger import logger
from detail_dialogs import TaskDetailDialog
from edit_dialogs import TaskEditDialog
from search_utils import SearchFilter, DataExporter, search_filter_rows
```

**Change**: Add line 10: `from edit_dialogs import TaskEditDialog`

---

## STEP 3: Update tasks_tab.py - Constructor (Lines 13-26)

### Location: Lines 16-26 (__init__ method)

### BEFORE:
```python
    def __init__(self, parent, crm_service: CRMService, on_refresh: Optional[Callable] = None):
        super().__init__(parent)
        self.crm_service = crm_service
        self.on_refresh = on_refresh
        self.tasks = []
        self.all_tasks = []  # Store all tasks for filtering
        self.current_task = None
        self.search_filter: Optional[SearchFilter] = None

        self.create_widgets()
        self.refresh_data()
```

### AFTER:
```python
    def __init__(self, parent, crm_service: CRMService, on_refresh: Optional[Callable] = None):
        super().__init__(parent)
        self.crm_service = crm_service
        self.on_refresh = on_refresh
        self.tasks = []
        self.all_tasks = []  # Store all tasks for filtering
        self.current_task = None
        self.search_filter: Optional[SearchFilter] = None
        self.all_deals = []  # Store all deals for dropdowns
        self.all_clients = []  # Store all clients for dropdowns

        self.create_widgets()
        self.refresh_data()
```

**Changes**:
- Add line 22: `self.all_deals = []  # Store all deals for dropdowns`
- Add line 23: `self.all_clients = []  # Store all clients for dropdowns`

---

## STEP 4: Update tasks_tab.py - _fetch_tasks() Method (Lines 128-138)

### Location: Lines 128-138

### BEFORE:
```python
    def _fetch_tasks(self):
        """Fetch tasks in background"""
        try:
            self.tasks = self.crm_service.get_tasks()
            self.all_tasks = self.tasks  # Store all tasks for filtering
            self.after(0, self._update_tree)
            logger.info(f"Fetched {len(self.tasks)} tasks")
        except Exception as e:
            logger.error(f"Failed to fetch tasks: {e}")
            error_msg = str(e)
            self.after(0, lambda: messagebox.showerror("Error", f"Failed to fetch tasks: {error_msg}"))
```

### AFTER:
```python
    def _fetch_tasks(self):
        """Fetch tasks in background"""
        try:
            self.tasks = self.crm_service.get_tasks()
            self.all_tasks = self.tasks  # Store all tasks for filtering
            # Also fetch deals and clients for dropdowns
            self.all_deals = self.crm_service.get_deals()
            self.all_clients = self.crm_service.get_clients()
            self.after(0, self._update_tree)
            logger.info(f"Fetched {len(self.tasks)} tasks")
        except Exception as e:
            logger.error(f"Failed to fetch tasks: {e}")
            error_msg = str(e)
            self.after(0, lambda: messagebox.showerror("Error", f"Failed to fetch tasks: {error_msg}"))
```

**Changes**:
- Add line 134: `# Also fetch deals and clients for dropdowns`
- Add line 135: `self.all_deals = self.crm_service.get_deals()`
- Add line 136: `self.all_clients = self.crm_service.get_clients()`

---

## STEP 5: Update tasks_tab.py - add_task() Method (Lines 204-213)

### Location: Lines 204-213

### BEFORE:
```python
    def add_task(self):
        """Add new task"""
        dialog = TaskDialog(self)
        if dialog.result:
            thread = Thread(
                target=self._create_task,
                args=(dialog.result,),
                daemon=True
            )
            thread.start()
```

### AFTER:
```python
    def add_task(self):
        """Add new task"""
        dialog = TaskEditDialog(self, task=None, deals_list=self.all_deals, clients_list=self.all_clients)
        if dialog.result:
            thread = Thread(
                target=self._create_task,
                args=(dialog.result,),
                daemon=True
            )
            thread.start()
```

**Change**: Line 206 - Replace `TaskDialog(self)` with `TaskEditDialog(self, task=None, deals_list=self.all_deals, clients_list=self.all_clients)`

---

## STEP 6: Update tasks_tab.py - edit_task() Method (Lines 226-239)

### Location: Lines 226-239

### BEFORE:
```python
    def edit_task(self):
        """Edit selected task"""
        if not self.current_task:
            messagebox.showwarning("Warning", "Please select a task to edit")
            return

        dialog = TaskDialog(self, task=self.current_task)
        if dialog.result:
            thread = Thread(
                target=self._update_task,
                args=(self.current_task["id"], dialog.result),
                daemon=True
            )
            thread.start()
```

### AFTER:
```python
    def edit_task(self):
        """Edit selected task"""
        if not self.current_task:
            messagebox.showwarning("Warning", "Please select a task to edit")
            return

        dialog = TaskEditDialog(self, task=self.current_task, deals_list=self.all_deals, clients_list=self.all_clients)
        if dialog.result:
            thread = Thread(
                target=self._update_task,
                args=(self.current_task["id"], dialog.result),
                daemon=True
            )
            thread.start()
```

**Change**: Line 232 - Replace `TaskDialog(self, task=self.current_task)` with `TaskEditDialog(self, task=self.current_task, deals_list=self.all_deals, clients_list=self.all_clients)`

---

## STEP 7: Fix export_to_csv() Method (Lines 363-365)

### Location: Lines 363-365 (in except block)

### BEFORE:
```python
        except Exception as e:
            logger.error(f"Export error: {e}")
            messagebox.showerror("Error", f"Failed to export data: {e}")
```

### AFTER:
```python
        except Exception as e:
            logger.error(f"Export error: {e}")
            error_msg = str(e)
            messagebox.showerror("Error", f"Failed to export data: {error_msg}")
```

**Changes**:
- Add line 365: `error_msg = str(e)`
- Modify line 366: Change `{e}` to `{error_msg}`

---

## STEP 8: Fix export_to_excel() Method (Lines 404-406)

### Location: Lines 404-406 (in except block)

### BEFORE:
```python
        except Exception as e:
            logger.error(f"Export error: {e}")
            messagebox.showerror("Error", f"Failed to export data: {e}")
```

### AFTER:
```python
        except Exception as e:
            logger.error(f"Export error: {e}")
            error_msg = str(e)
            messagebox.showerror("Error", f"Failed to export data: {error_msg}")
```

**Changes**:
- Add line 406: `error_msg = str(e)`
- Modify line 407: Change `{e}` to `{error_msg}`

---

## STEP 9: REMOVE TaskDialog Class (Lines 409-491)

### Location: Lines 409-491

### ACTION: DELETE THE ENTIRE CLASS

```python
# DELETE ALL OF THIS (lines 409-491):
class TaskDialog(tk.Toplevel):
    """Dialog for adding/editing tasks"""

    def __init__(self, parent, task=None):
        super().__init__(parent)
        self.transient(parent)
        self.parent = parent
        self.result = None
        self.task = task

        if self.task:
            self.title("Edit Task")
        else:
            self.title("Add Task")

        self.title_var = tk.StringVar(value=task.get("title", "") if task else "")
        self.description_var = tk.StringVar(value=task.get("description", "") if task else "")
        self.status_var = tk.StringVar(value=task.get("status", "open") if task else "open")
        self.priority_var = tk.StringVar(value=task.get("priority", "normal") if task else "normal")
        self.due_date_var = tk.StringVar(value=task.get("due_date", "") if task else "")

        # Title
        tk.Label(self, text="Title:").grid(row=0, column=0, padx=10, pady=5, sticky="w")
        tk.Entry(self, textvariable=self.title_var, width=40).grid(row=0, column=1, padx=10, pady=5)

        # Description
        tk.Label(self, text="Description:").grid(row=1, column=0, padx=10, pady=5, sticky="nw")
        description_text = tk.Text(self, height=3, width=40)
        description_text.grid(row=1, column=1, padx=10, pady=5)
        description_text.insert("end", task.get("description", "") if task else "")
        self.description_text = description_text

        # Status
        tk.Label(self, text="Status:").grid(row=2, column=0, padx=10, pady=5, sticky="w")
        status_combo = ttk.Combobox(
            self,
            textvariable=self.status_var,
            values=["open", "in_progress", "completed", "closed"],
            state="readonly",
            width=37
        )
        status_combo.grid(row=2, column=1, padx=10, pady=5)

        # Priority
        tk.Label(self, text="Priority:").grid(row=3, column=0, padx=10, pady=5, sticky="w")
        priority_combo = ttk.Combobox(
            self,
            textvariable=self.priority_var,
            values=["low", "normal", "high", "urgent"],
            state="readonly",
            width=37
        )
        priority_combo.grid(row=3, column=1, padx=10, pady=5)

        # Due Date
        tk.Label(self, text="Due Date (YYYY-MM-DD):").grid(row=4, column=0, padx=10, pady=5, sticky="w")
        tk.Entry(self, textvariable=self.due_date_var, width=40).grid(row=4, column=1, padx=10, pady=5)

        # Buttons
        button_frame = tk.Frame(self)
        button_frame.grid(row=5, columnspan=2, pady=10)

        tk.Button(button_frame, text="OK", command=self.on_ok).pack(side="left", padx=5)
        tk.Button(button_frame, text="Cancel", command=self.destroy).pack(side="left", padx=5)

        self.grab_set()
        self.wait_window(self)

    def on_ok(self):
        """Handle OK button"""
        title = self.title_var.get().strip()
        if not title:
            messagebox.showerror("Error", "Title cannot be empty.", parent=self)
            return

        self.result = {
            "title": title,
            "description": self.description_text.get("1.0", "end").strip(),
            "status": self.status_var.get(),
            "priority": self.priority_var.get(),
            "due_date": self.due_date_var.get() if self.due_date_var.get() else None
        }
        self.destroy()
```

**Result after deletion**: tasks_tab.py will be 83 lines shorter (492 → 409 lines)

---

## Summary of Changes

| File | Action | Lines | Impact |
|------|--------|-------|--------|
| edit_dialogs.py | Add | +100 | New TaskEditDialog class |
| tasks_tab.py | Modify | Line 10 | Add import |
| tasks_tab.py | Modify | Lines 22-23 | Add attributes |
| tasks_tab.py | Modify | Lines 134-136 | Load deals/clients |
| tasks_tab.py | Modify | Line 206 | Update add_task() |
| tasks_tab.py | Modify | Line 232 | Update edit_task() |
| tasks_tab.py | Modify | Lines 365-366 | Fix CSV error handling |
| tasks_tab.py | Modify | Lines 406-407 | Fix Excel error handling |
| tasks_tab.py | Delete | Lines 409-491 | Remove TaskDialog |

**Net Change**:
- edit_dialogs.py: +100 lines
- tasks_tab.py: -80 lines (adding ~10, removing 83, fixing ~10)
- Total impact: +20 lines of code, improved architecture

---

## Testing Checklist After Changes

```
Functionality Tests:
[ ] Create new task (minimal fields)
[ ] Create new task with deal
[ ] Create new task with client
[ ] Create new task with deal and client
[ ] Edit existing task
[ ] Change status of task
[ ] Change priority of task
[ ] Delete task
[ ] Confirm delete works

Filter/Search Tests:
[ ] Search by title
[ ] Filter by status=open
[ ] Filter by status=in_progress
[ ] Filter by status=completed
[ ] Filter by status=closed
[ ] Filter by priority=low
[ ] Filter by priority=normal
[ ] Filter by priority=high
[ ] Filter by priority=urgent

Export Tests:
[ ] Export to CSV (no data)
[ ] Export to CSV (with data)
[ ] Export to Excel (no data)
[ ] Export to Excel (with data)
[ ] Verify error handling (disconnect API)

UI Tests:
[ ] Double-click task shows detail dialog
[ ] TaskEditDialog window appears centered
[ ] TaskEditDialog has proper size
[ ] All fields display correctly in dialog
[ ] Comboboxes populate from deals/clients

Error Handling Tests:
[ ] Network timeout shows clean message
[ ] Validation error for empty title
[ ] Export error shows clean message
```

---

## Before/After File Sizes

```
BEFORE:
  edit_dialogs.py: 434 lines
  tasks_tab.py: 492 lines
  Total: 926 lines

AFTER:
  edit_dialogs.py: 534 lines (+100)
  tasks_tab.py: 409 lines (-83)
  Total: 943 lines (+17)

Code Quality: Improved (consistent pattern)
Functionality: Same (enhanced with deal/client fields)
```

---

## Common Mistakes to Avoid

1. **Forget to remove TaskDialog class** - Will get duplicate TaskDialog error
2. **Forget to add import** - Will get NameError: TaskEditDialog not defined
3. **Forget to load deals/clients** - Dropdowns will be empty
4. **Copy/paste error in _fetch_tasks()** - Make sure indentation matches
5. **Not fixing both export methods** - Only fix one of CSV or Excel
6. **Leaving old line references** - Update all references to dialog.result structure
7. **Forgetting parameter names in TaskEditDialog call** - Use keyword arguments (deals_list=, clients_list=)

---

## Rollback Plan

If issues arise:
1. Restore edit_dialogs.py from git (remove TaskEditDialog)
2. Restore tasks_tab.py from git (revert all changes)
3. Run `git diff` to compare with working version
4. Identify specific line that broke functionality

Command:
```bash
git checkout edit_dialogs.py tasks_tab.py
```
