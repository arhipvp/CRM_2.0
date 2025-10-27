"""Tasks management tab component"""
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from threading import Thread
from typing import Optional, List, Dict, Any
from datetime import datetime

from crm_service import CRMService
from logger import logger
from detail_dialogs import TaskDetailDialog
from edit_dialogs import TaskEditDialog
from search_utils import SearchFilter, DataExporter, search_filter_rows
from i18n import i18n
from table_sort_utils import treeview_sort_column


class TasksTab:
    """Tab for managing tasks"""

    def __init__(self, parent: ttk.Frame, crm_service: CRMService):
        self.parent = parent
        self.crm_service = crm_service
        self.tree: Optional[ttk.Treeview] = None
        self.search_filter: Optional[SearchFilter] = None
        self.deals = []  # Store deals for dialog dropdown
        self.all_deals = []  # Store all deals for filtering
        self.clients: List[Dict[str, Any]] = []  # Store clients for dialog dropdown
        self.all_clients: List[Dict[str, Any]] = []  # Store all clients for potential reuse
        self.users: List[Dict[str, Any]] = []  # Store executors for dialog dropdown
        self.user_lookup: Dict[str, str] = {}  # Map user IDs to display names
        self.all_tasks: List[Dict[str, Any]] = []  # Store all tasks for filtering

        self._setup_ui()
        self.refresh_tree()

    def _setup_ui(self):
        """Setup Tasks tab UI"""
        # Search filter frame
        search_frame = tk.Frame(self.parent)
        search_frame.pack(pady=5, padx=10, fill="x")

        self.search_filter = SearchFilter(search_frame, self._on_search_change)
        self.search_filter.pack(fill="x")

        # Frame for Treeview and Scrollbar
        tree_frame = tk.Frame(self.parent)
        tree_frame.pack(pady=10, padx=10, fill="both", expand=True)

        self.tree = ttk.Treeview(
            tree_frame,
            columns=(
                "ID", "Owner ID", "Deleted", "Deal ID", "Client ID",
                "Title", "Description", "Status Code", "Status Name", "Priority", "Due Date",
                "Created At", "Updated At"
            ),
            show="headings"
        )

        for col in (
            "ID", "Owner ID", "Deleted", "Deal ID", "Client ID",
            "Title", "Description", "Status Code", "Status Name", "Priority", "Due Date",
            "Created At", "Updated At"
        ):
            self.tree.heading(col, text=i18n(col), command=lambda c=col: self._on_tree_sort(c))

        self.tree.column("ID", width=50, anchor="center")
        self.tree.column("Assignee ID", width=150)
        self.tree.column("Deleted", width=60)
        self.tree.column("Deal ID", width=100)
        self.tree.column("Client ID", width=100)
        self.tree.column("Title", width=250)
        self.tree.column("Description", width=200)
        self.tree.column("Status Code", width=110)
        self.tree.column("Status Name", width=140)
        self.tree.column("Priority", width=100)
        self.tree.column("Due Date", width=100)
        self.tree.column("Created At", width=150)
        self.tree.column("Updated At", width=150)

        scrollbar = ttk.Scrollbar(tree_frame, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=scrollbar.set)

        self.tree.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        # Bind double-click to open detail dialog
        self.tree.bind("<Double-1>", self._on_tree_double_click)

        # Frame for buttons
        button_frame = tk.Frame(self.parent)
        button_frame.pack(pady=10)

        tk.Button(button_frame, text=i18n("Add Task"), command=self.add_task).pack(side="left", padx=5)
        tk.Button(button_frame, text=i18n("Edit"), command=self.edit_task).pack(side="left", padx=5)
        tk.Button(button_frame, text=i18n("Delete"), command=self.delete_task).pack(side="left", padx=5)
        tk.Button(button_frame, text=i18n("Refresh"), command=self.refresh_tree).pack(side="left", padx=5)
        tk.Button(button_frame, text=i18n("Export CSV"), command=self.export_to_csv).pack(side="left", padx=5)
        tk.Button(button_frame, text=i18n("Export Excel"), command=self.export_to_excel).pack(side="left", padx=5)

    def _on_tree_sort(self, col):
        display_map = {
            "ID": "id",
            "Assignee ID": "assigneeId",
            "Deleted": "is_deleted",
            "Deal ID": "deal_id",
            "Client ID": "client_id",
            "Title": "title",
            "Description": "description",
            "Status Code": "statusCode",
            "Status Name": "statusName",
            "Priority": "priority",
            "Due Date": "dueAt",
            "Created At": "createdAt",
            "Updated At": "updatedAt",
        }
        treeview_sort_column(self.tree, col, False, self.all_tasks, display_map)

    def refresh_tree(self):
        """Refresh tasks list asynchronously"""
        def worker():
            try:
                # Load tasks with related entities
                tasks = self.crm_service.get_tasks()
                deals = self.crm_service.get_deals()
                clients = self.crm_service.get_clients()
                users = self.crm_service.get_users()
                self.parent.after(0, self._update_tree_ui, tasks, deals, clients, users)
            except Exception as e:
                logger.error(f"Failed to fetch tasks: {e}")
                error_msg = str(e)
                self.parent.after(0, lambda: messagebox.showerror(i18n("Error"), f"{i18n('Failed to fetch')} tasks: {error_msg}"))

        Thread(target=worker, daemon=True).start()

    def _fetch_tasks(self):
        """Fetch tasks in background"""
        try:
            self.tasks = self.crm_service.get_tasks()
            self.all_tasks = [self._normalize_task(task) for task in (self.tasks or [])]  # Store all tasks for filtering
            # Also fetch deals for dropdown
            self.deals = self.crm_service.get_deals()
            self.all_deals = self.deals
            # Fetch clients for dropdowns
            self.clients = self.crm_service.get_clients()
            self.all_clients = self.clients
            self.after(0, self._update_tree)
            logger.info(f"Fetched {len(self.tasks)} tasks")
        except Exception as e:
            logger.error(f"Failed to fetch tasks: {e}")
            error_msg = str(e)
            self.after(0, lambda: messagebox.showerror("Error", f"Failed to fetch tasks: {error_msg}"))
    def _update_tree_ui(self, tasks, deals=None, clients=None, users=None):
        """Update tree UI on main thread"""
        if not self.tree:
            return

        if users is not None:
            self.users = users or []
            self.user_lookup = self._build_user_lookup(self.users)

        # Store all data for filtering
        normalized_tasks = [self._normalize_task(task) for task in (tasks or [])]
        self.all_tasks = normalized_tasks
        if deals is not None:
            self.deals = deals or []
            self.all_deals = deals or []
        if clients is not None:
            self.clients = clients or []
            self.all_clients = clients or []
        self._refresh_tree_display(self.all_tasks)

    def _refresh_tree_display(self, tasks_to_display: List[Dict[str, Any]]):
        """Refresh tree display with given list of tasks"""
        if not self.tree:
            return

        # Clear tree
        for i in self.tree.get_children():
            self.tree.delete(i)

        # Add tasks
        for task in tasks_to_display:
            is_deleted = i18n("Yes") if task.get("is_deleted", False) else i18n("No")
            status_code = self._get_value(task, "statusCode", "status_code", "status") or "N/A"
            status_name = self._get_value(task, "statusName", "status_name") or status_code
            due_at_raw = self._get_value(task, "dueAt", "due_at", "dueDate", "due_date")
            due_at_display = self._format_datetime(due_at_raw, date_only=True)
            created_at_display = self._format_datetime(self._get_value(task, "createdAt", "created_at"))
            updated_at_display = self._format_datetime(self._get_value(task, "updatedAt", "updated_at"))

            self.tree.insert("", "end", iid=task.get("id"), values=(
                self._shorten_identifier(task.get("id")),
                self._shorten_identifier(task.get("owner_id")),
                is_deleted,
                self._shorten_identifier(task.get("deal_id")),
                self._shorten_identifier(task.get("client_id")),
                task.get("title", "N/A"),
                task.get("description", "N/A"),
                status_code,
                status_name or "N/A",
                task.get("priority", "N/A"),
                due_at_display,
                created_at_display,
                updated_at_display,
            ))

    @staticmethod
    def _normalize_task(task: Dict[str, Any]) -> Dict[str, Any]:
        """Ensure task dictionary contains expected camelCase keys."""
        normalized = dict(task) if task else {}

        def ensure_key(target_key: str, *aliases: str):
            if target_key not in normalized or normalized.get(target_key) in (None, ""):
                for alias in aliases:
                    if alias in normalized and normalized.get(alias) not in (None, ""):
                        normalized[target_key] = normalized.get(alias)
                        return

        ensure_key("statusCode", "status_code", "status")
        ensure_key("statusName", "status_name")
        ensure_key("dueAt", "due_at", "dueDate", "due_date")
        ensure_key("createdAt", "created_at")
        ensure_key("updatedAt", "updated_at")

        if not normalized.get("statusName") and normalized.get("statusCode"):
            normalized["statusName"] = normalized.get("statusCode")

        return normalized

    @staticmethod
    def _get_value(task: Dict[str, Any], *keys: str) -> Any:
        """Return first available value by iterating over aliases."""
        for key in keys:
            if key in task and task.get(key) not in (None, ""):
                return task.get(key)
        return None

    @staticmethod
    def _format_datetime(value: Any, date_only: bool = False) -> str:
        """Format ISO datetime string to readable form."""
        if not value:
            return "N/A"
        if isinstance(value, datetime):
            dt_value = value
        else:
            try:
                normalized = str(value).replace("Z", "+00:00")
                dt_value = datetime.fromisoformat(normalized)
            except (ValueError, TypeError):
                return str(value)

        return dt_value.strftime("%Y-%m-%d") if date_only else dt_value.strftime("%Y-%m-%d %H:%M")

    @staticmethod
    def _shorten_identifier(value: Any) -> str:
        """Shorten identifier for display in the table."""
        if not value:
            return "N/A"
        return str(value)[:8]

    def add_task(self):
        """Add new task"""
        dialog = TaskEditDialog(
            self.parent,
            task=None,
            deals_list=self.all_deals,
            clients_list=self.all_clients,
            users_list=self.users,
        )
        if dialog.result:
            def worker():
                try:
                    self.crm_service.create_task(**dialog.result)
                    self.parent.after(0, self.refresh_tree)
                    self.parent.after(0, lambda: messagebox.showinfo(i18n("Success"), f"{i18n('Task Title')} {i18n('created successfully')}"))
                except Exception as e:
                    logger.error(f"Failed to create task: {e}")
                    error_msg = str(e)
                    self.parent.after(0, lambda: messagebox.showerror(i18n("API Error"), f"{i18n('failed to create')} task: {error_msg}"))

            Thread(target=worker, daemon=True).start()

    def edit_task(self):
        """Edit selected task"""
        if not self.tree:
            return
        selected_item = self.tree.focus()
        if not selected_item:
            messagebox.showwarning(i18n("Warning"), i18n("Please select a task to edit"))
            return

        task_id = selected_item

        # Fetch current task data asynchronously
        def fetch_and_edit():
            try:
                current_task = self.crm_service.get_task(task_id)
                self.parent.after(0, lambda: self._show_edit_dialog(task_id, current_task))
            except Exception as e:
                logger.error(f"Failed to fetch task for editing: {e}")
                error_msg = str(e)
                self.parent.after(0, lambda: messagebox.showerror(i18n("API Error"), f"{i18n('Failed to fetch')} task: {error_msg}"))

        Thread(target=fetch_and_edit, daemon=True).start()

    def _show_edit_dialog(self, task_id, current_task):
        """Show edit dialog on main thread"""
        dialog = TaskEditDialog(
            self.parent,
            task=current_task,
            deals_list=self.all_deals,
            clients_list=self.all_clients,
            users_list=self.users,
        )
        if dialog.result:
            def worker():
                try:
                    self.crm_service.update_task(task_id, **dialog.result)
                    self.parent.after(0, self.refresh_tree)
                    self.parent.after(0, lambda: messagebox.showinfo(i18n("Success"), f"{i18n('Task Title')} {i18n('updated successfully')}"))
                except Exception as e:
                    logger.error(f"Failed to update task: {e}")
                    error_msg = str(e)
                    self.parent.after(0, lambda: messagebox.showerror(i18n("API Error"), f"{i18n('failed to update')} task: {error_msg}"))

            Thread(target=worker, daemon=True).start()

    def delete_task(self):
        """Delete selected task"""
        if not self.tree:
            return
        selected_item = self.tree.focus()
        if not selected_item:
            messagebox.showwarning(i18n("Warning"), i18n("Please select a task to delete"))
            return

        if messagebox.askyesno(i18n("Confirm Delete"), f"{i18n('Are you sure you want to delete this')} task?"):
            task_id = selected_item

            def worker():
                try:
                    self.crm_service.delete_task(task_id)
                    self.parent.after(0, self.refresh_tree)
                    self.parent.after(0, lambda: messagebox.showinfo(i18n("Success"), f"{i18n('Task Title')} {i18n('deleted successfully')}"))
                except Exception as e:
                    logger.error(f"Failed to delete task: {e}")
                    error_msg = str(e)
                    self.parent.after(0, lambda: messagebox.showerror(i18n("API Error"), f"{i18n('failed to delete')} task: {error_msg}"))

            Thread(target=worker, daemon=True).start()

    def _on_search_change(self, search_text: str):
        """Handle search filter change"""
        if not self.all_tasks:
            return

        # Filter tasks by search text
        search_fields = [
            "title",
            "description",
            "statusCode",
            "statusName",
            "priority",
            "dueAt",
            "createdAt",
            "updatedAt",
        ]
        filtered_tasks = search_filter_rows(self.all_tasks, search_text, search_fields)

        # Update tree display with filtered results
        self._refresh_tree_display(filtered_tasks)

    def export_to_csv(self):
        """Export tasks to CSV file"""
        if not self.tree or not self.all_tasks:
            messagebox.showwarning(i18n("Warning"), i18n("No data to export"))
            return

        # Ask user for file location
        filename = filedialog.asksaveasfilename(
            defaultextension=".csv",
            filetypes=[("CSV files", "*.csv"), ("All files", "*.*")]
        )

        if not filename:
            return

        try:
            # Prepare data
            columns = [
                i18n("ID"), i18n("Owner ID"), i18n("Deleted"), i18n("Deal ID"), i18n("Client ID"),
                i18n("Title"), i18n("Description"), i18n("Status Code"), i18n("Status Name"), i18n("Priority"), i18n("Due Date"),
                i18n("Created At"), i18n("Updated At")
            ]
            rows = []

            for task in self.all_tasks:
                is_deleted = i18n("Yes") if task.get("is_deleted", False) else i18n("No")
                status_code = self._get_value(task, "statusCode", "status_code", "status") or "N/A"
                status_name = self._get_value(task, "statusName", "status_name") or status_code
                due_at_raw = self._get_value(task, "dueAt", "due_at", "dueDate", "due_date")
                due_at_display = self._format_datetime(due_at_raw, date_only=True)
                created_at_display = self._format_datetime(self._get_value(task, "createdAt", "created_at"))
                updated_at_display = self._format_datetime(self._get_value(task, "updatedAt", "updated_at"))
                rows.append([
                    self._shorten_identifier(task.get("id")),
                    self._shorten_identifier(task.get("owner_id")),
                    is_deleted,
                    self._shorten_identifier(task.get("deal_id")),
                    self._shorten_identifier(task.get("client_id")),
                    task.get("title", "N/A"),
                    task.get("description", "N/A"),
                    status_code,
                    status_name or "N/A",
                    task.get("priority", "N/A"),
                    due_at_display,
                    created_at_display,
                    updated_at_display,
                ])

            # Export using DataExporter
            if DataExporter.export_to_csv(filename, columns, rows):
                messagebox.showinfo(i18n("Success"), f"{i18n('Data exported to')} {filename}")
                logger.info(f"Exported {len(rows)} tasks to CSV")
            else:
                messagebox.showerror(i18n("Error"), i18n("Failed to export data"))

        except Exception as e:
            logger.error(f"Export error: {e}")
            messagebox.showerror(i18n("Error"), f"{i18n('Failed to export data')}: {e}")

    def export_to_excel(self):
        """Export tasks to Excel file"""
        if not self.tree or not self.all_tasks:
            messagebox.showwarning(i18n("Warning"), i18n("No data to export"))
            return

        # Ask user for file location
        filename = filedialog.asksaveasfilename(
            defaultextension=".xlsx",
            filetypes=[("Excel files", "*.xlsx"), ("All files", "*.*")]
        )

        if not filename:
            return

        try:
            # Prepare data
            columns = [
                i18n("ID"), i18n("Owner ID"), i18n("Deleted"), i18n("Deal ID"), i18n("Client ID"),
                i18n("Title"), i18n("Description"), i18n("Status Code"), i18n("Status Name"), i18n("Priority"), i18n("Due Date"),
                i18n("Created At"), i18n("Updated At")
            ]
            rows = []

            for task in self.all_tasks:
                is_deleted = i18n("Yes") if task.get("is_deleted", False) else i18n("No")
                status_code = self._get_value(task, "statusCode", "status_code", "status") or "N/A"
                status_name = self._get_value(task, "statusName", "status_name") or status_code
                due_at_raw = self._get_value(task, "dueAt", "due_at", "dueDate", "due_date")
                due_at_display = self._format_datetime(due_at_raw, date_only=True)
                created_at_display = self._format_datetime(self._get_value(task, "createdAt", "created_at"))
                updated_at_display = self._format_datetime(self._get_value(task, "updatedAt", "updated_at"))
                rows.append([
                    self._shorten_identifier(task.get("id")),
                    self._shorten_identifier(task.get("owner_id")),
                    is_deleted,
                    self._shorten_identifier(task.get("deal_id")),
                    self._shorten_identifier(task.get("client_id")),
                    task.get("title", "N/A"),
                    task.get("description", "N/A"),
                    status_code,
                    status_name or "N/A",
                    task.get("priority", "N/A"),
                    due_at_display,
                    created_at_display,
                    updated_at_display,
                ])

            # Export using DataExporter
            if DataExporter.export_to_excel(filename, columns, rows):
                messagebox.showinfo(i18n("Success"), f"{i18n('Data exported to')} {filename}")
                logger.info(f"Exported {len(rows)} tasks to Excel")
            else:
                messagebox.showerror(i18n("Error"), f"{i18n('Failed to export data')}. Make sure openpyxl is installed.")

        except Exception as e:
            logger.error(f"Export error: {e}")
            messagebox.showerror(i18n("Error"), f"{i18n('Failed to export data')}: {e}")

    def _on_tree_double_click(self, event):
        """Handle double-click on task row to open detail dialog"""
        if not self.tree:
            return
        selected_item = self.tree.focus()
        if not selected_item:
            return

        # Fetch full task data
        task_id = selected_item
        try:
            task_data = self.crm_service.get_task(task_id)
            if task_data:
                TaskDetailDialog(self.parent, task_data)
        except Exception as e:
            logger.error(f"Failed to fetch task details: {e}")
            messagebox.showerror(i18n("Error"), f"{i18n('Failed to fetch')} task details: {e}")
