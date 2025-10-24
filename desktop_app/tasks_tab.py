"""Tasks management tab component"""
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from threading import Thread
from typing import Optional, List, Dict, Any

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
        self.all_tasks: List[Dict[str, Any]] = []  # Store all tasks for filtering
        self.all_deals: List[Dict[str, Any]] = []  # Store all deals for dropdowns

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
                "ID", "Tenant ID", "Owner ID", "Deleted", "Deal ID", "Client ID",
                "Title", "Description", "Status", "Priority", "Due Date",
                "Created At", "Updated At"
            ),
            show="headings"
        )

        for col in (
            "ID", "Tenant ID", "Owner ID", "Deleted", "Deal ID", "Client ID",
            "Title", "Description", "Status", "Priority", "Due Date",
            "Created At", "Updated At"
        ):
            self.tree.heading(col, text=i18n(col), command=lambda c=col: self._on_tree_sort(c))

        self.tree.column("ID", width=50, anchor="center")
        self.tree.column("Tenant ID", width=100)
        self.tree.column("Owner ID", width=100)
        self.tree.column("Deleted", width=60)
        self.tree.column("Deal ID", width=100)
        self.tree.column("Client ID", width=100)
        self.tree.column("Title", width=250)
        self.tree.column("Description", width=200)
        self.tree.column("Status", width=100)
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
            "Tenant ID": "tenant_id",
            "Owner ID": "owner_id",
            "Deleted": "is_deleted",
            "Deal ID": "deal_id",
            "Client ID": "client_id",
            "Title": "title",
            "Description": "description",
            "Status": "status",
            "Priority": "priority",
            "Due Date": "due_date",
            "Created At": "created_at",
            "Updated At": "updated_at",
        }
        treeview_sort_column(self.tree, col, False, self.all_tasks, display_map)

    def refresh_tree(self):
        """Refresh tasks list asynchronously"""
        def worker():
            try:
                # Load both tasks and deals
                tasks = self.crm_service.get_tasks()
                deals = self.crm_service.get_deals()
                self.parent.after(0, self._update_tree_ui, tasks, deals)
            except Exception as e:
                logger.error(f"Failed to fetch tasks: {e}")
                error_msg = str(e)
                self.parent.after(0, lambda: messagebox.showerror(i18n("Error"), f"{i18n('Failed to fetch')} tasks: {error_msg}"))

        Thread(target=worker, daemon=True).start()

    def _fetch_tasks(self):
        """Fetch tasks in background"""
        try:
            self.tasks = self.crm_service.get_tasks()
            self.all_tasks = self.tasks  # Store all tasks for filtering
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
    def _update_tree_ui(self, tasks, deals=None):
        """Update tree UI on main thread"""
        if not self.tree:
            return

        # Store all data for filtering
        self.all_tasks = tasks
        if deals:
            self.all_deals = deals
        self._refresh_tree_display(tasks)

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
            self.tree.insert("", "end", iid=task.get("id"), values=(
                str(task.get("id", "N/A"))[:8],
                str(task.get("tenant_id", "N/A"))[:8],
                str(task.get("owner_id", "N/A"))[:8],
                is_deleted,
                str(task.get("deal_id", "N/A"))[:8],
                str(task.get("client_id", "N/A"))[:8],
                task.get("title", "N/A"),
                task.get("description", "N/A"),
                task.get("status", "N/A"),
                task.get("priority", "N/A"),
                task.get("due_date", "N/A"),
                task.get("created_at", "N/A"),
                task.get("updated_at", "N/A"),
            ))

    def add_task(self):
        """Add new task"""
        dialog = TaskEditDialog(self, deals_list=self.deals, clients_list=self.clients)
        dialog = TaskEditDialog(self.parent, task=None, deals_list=self.all_deals)
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

        dialog = TaskEditDialog(self, task=self.current_task, deals_list=self.deals,
                                clients_list=self.clients)
        Thread(target=fetch_and_edit, daemon=True).start()

    def _show_edit_dialog(self, task_id, current_task):
        """Show edit dialog on main thread"""
        dialog = TaskEditDialog(self.parent, task=current_task, deals_list=self.all_deals)
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
        search_fields = ["title", "description", "status"]
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
                i18n("ID"), i18n("Tenant ID"), i18n("Owner ID"), i18n("Deleted"), i18n("Deal ID"), i18n("Client ID"),
                i18n("Title"), i18n("Description"), i18n("Status"), i18n("Priority"), i18n("Due Date"),
                i18n("Created At"), i18n("Updated At")
            ]
            rows = []

            for task in self.all_tasks:
                is_deleted = i18n("Yes") if task.get("is_deleted", False) else i18n("No")
                rows.append([
                    task.get("id", "N/A")[:8],
                    task.get("tenant_id", "N/A")[:8],
                    task.get("owner_id", "N/A")[:8],
                    is_deleted,
                    task.get("deal_id", "N/A")[:8],
                    task.get("client_id", "N/A")[:8],
                    task.get("title", "N/A"),
                    task.get("description", "N/A"),
                    task.get("status", "N/A"),
                    task.get("priority", "N/A"),
                    task.get("due_date", "N/A"),
                    task.get("created_at", "N/A"),
                    task.get("updated_at", "N/A"),
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
                i18n("ID"), i18n("Tenant ID"), i18n("Owner ID"), i18n("Deleted"), i18n("Deal ID"), i18n("Client ID"),
                i18n("Title"), i18n("Description"), i18n("Status"), i18n("Priority"), i18n("Due Date"),
                i18n("Created At"), i18n("Updated At")
            ]
            rows = []

            for task in self.all_tasks:
                is_deleted = i18n("Yes") if task.get("is_deleted", False) else i18n("No")
                rows.append([
                    task.get("id", "N/A")[:8],
                    task.get("tenant_id", "N/A")[:8],
                    task.get("owner_id", "N/A")[:8],
                    is_deleted,
                    task.get("deal_id", "N/A")[:8],
                    task.get("client_id", "N/A")[:8],
                    task.get("title", "N/A"),
                    task.get("description", "N/A"),
                    task.get("status", "N/A"),
                    task.get("priority", "N/A"),
                    task.get("due_date", "N/A"),
                    task.get("created_at", "N/A"),
                    task.get("updated_at", "N/A"),
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
