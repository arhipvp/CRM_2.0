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


class TasksTab(ttk.Frame):
    """Tab for managing tasks"""

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

    def create_widgets(self):
        """Create UI elements"""
        # Search filter frame
        search_frame = tk.Frame(self)
        search_frame.pack(pady=5, padx=5, fill="x")

        self.search_filter = SearchFilter(search_frame, self._on_search_change)
        self.search_filter.pack(fill="x")

        # Control frame
        control_frame = ttk.Frame(self)
        control_frame.pack(fill="x", padx=5, pady=5)

        ttk.Button(control_frame, text="Add Task", command=self.add_task).pack(side="left", padx=5)
        ttk.Button(control_frame, text="Edit", command=self.edit_task).pack(side="left", padx=5)
        ttk.Button(control_frame, text="Delete", command=self.delete_task).pack(side="left", padx=5)
        ttk.Button(control_frame, text="Refresh", command=self.refresh_data).pack(side="left", padx=5)
        ttk.Button(control_frame, text="Export CSV", command=self.export_to_csv).pack(side="left", padx=5)
        ttk.Button(control_frame, text="Export Excel", command=self.export_to_excel).pack(side="left", padx=5)

        # Filter frame
        filter_frame = ttk.LabelFrame(self, text="Filters", padding=5)
        filter_frame.pack(fill="x", padx=5, pady=5)

        ttk.Label(filter_frame, text="Status:").pack(side="left", padx=5)
        self.status_filter = ttk.Combobox(
            filter_frame,
            values=["All", "open", "in_progress", "completed", "closed"],
            state="readonly",
            width=15
        )
        self.status_filter.set("All")
        self.status_filter.pack(side="left", padx=5)
        self.status_filter.bind("<<ComboboxSelected>>", lambda e: self.apply_filters())

        ttk.Label(filter_frame, text="Priority:").pack(side="left", padx=5)
        self.priority_filter = ttk.Combobox(
            filter_frame,
            values=["All", "low", "normal", "high", "urgent"],
            state="readonly",
            width=15
        )
        self.priority_filter.set("All")
        self.priority_filter.pack(side="left", padx=5)
        self.priority_filter.bind("<<ComboboxSelected>>", lambda e: self.apply_filters())

        # Treeview frame
        tree_frame = ttk.Frame(self)
        tree_frame.pack(fill="both", expand=True, padx=5, pady=5)

        # Scrollbar
        scrollbar = ttk.Scrollbar(tree_frame)
        scrollbar.pack(side="right", fill="y")

        # Treeview
        columns = ("title", "status", "priority", "due_date", "created_at", "deleted")
        self.tree = ttk.Treeview(
            tree_frame,
            columns=columns,
            show="headings",
            yscrollcommand=scrollbar.set,
            height=20
        )
        scrollbar.config(command=self.tree.yview)

        # Define column headings and widths
        self.tree.column("title", width=300, anchor="w")
        self.tree.column("status", width=100, anchor="w")
        self.tree.column("priority", width=80, anchor="w")
        self.tree.column("due_date", width=100, anchor="w")
        self.tree.column("created_at", width=100, anchor="w")
        self.tree.column("deleted", width=60, anchor="w")

        self.tree.heading("title", text="Title")
        self.tree.heading("status", text="Status")
        self.tree.heading("priority", text="Priority")
        self.tree.heading("due_date", text="Due Date")
        self.tree.heading("created_at", text="Created")
        self.tree.heading("deleted", text="Deleted")

        # Bind selection and double-click
        self.tree.bind("<<TreeviewSelect>>", self.on_task_select)
        self.tree.bind("<Double-1>", self._on_tree_double_click)

        self.tree.pack(fill="both", expand=True)

        # Details frame
        details_frame = ttk.LabelFrame(self, text="Task Details", padding=5)
        details_frame.pack(fill="x", padx=5, pady=5)

        ttk.Label(details_frame, text="Description:").pack(anchor="w", padx=5, pady=2)
        self.description_text = tk.Text(details_frame, height=3, width=80)
        self.description_text.pack(fill="x", padx=5, pady=2)
        self.description_text.config(state="disabled")

    def refresh_data(self):
        """Refresh tasks data from API"""
        thread = Thread(target=self._fetch_tasks, daemon=True)
        thread.start()

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

    def _update_tree(self):
        """Update tree with tasks data"""
        # Clear existing items
        for item in self.tree.get_children():
            self.tree.delete(item)

        # Add tasks
        for task in self.tasks:
            is_deleted = "Yes" if task.get("is_deleted", False) else "No"
            self.tree.insert(
                "",
                "end",
                iid=task.get("id"),
                values=(
                    task.get("title", ""),
                    task.get("status", ""),
                    task.get("priority", ""),
                    task.get("due_date", ""),
                    task.get("created_at", "")[:10] if task.get("created_at") else "",
                    is_deleted
                )
            )

    def apply_filters(self):
        """Apply filter to tasks"""
        status_filter = self.status_filter.get()
        priority_filter = self.priority_filter.get()

        # Clear and repopulate tree
        for item in self.tree.get_children():
            self.tree.delete(item)

        for task in self.tasks:
            status_match = (status_filter == "All" or task.get("status") == status_filter)
            priority_match = (priority_filter == "All" or task.get("priority") == priority_filter)

            if status_match and priority_match:
                is_deleted = "Yes" if task.get("is_deleted", False) else "No"
                self.tree.insert(
                    "",
                    "end",
                    iid=task.get("id"),
                    values=(
                        task.get("title", ""),
                        task.get("status", ""),
                        task.get("priority", ""),
                        task.get("due_date", ""),
                        task.get("created_at", "")[:10] if task.get("created_at") else "",
                        is_deleted
                    )
                )

    def on_task_select(self, event):
        """Handle task selection"""
        selection = self.tree.selection()
        if selection:
            task_id = selection[0]
            self.current_task = next((t for t in self.tasks if t.get("id") == task_id), None)
            if self.current_task:
                self.description_text.config(state="normal")
                self.description_text.delete("1.0", "end")
                self.description_text.insert("end", self.current_task.get("description", ""))
                self.description_text.config(state="disabled")

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

    def _create_task(self, data):
        """Create task in API"""
        try:
            self.crm_service.create_task(**data)
            self.after(0, self.refresh_data)
            self.after(0, lambda: messagebox.showinfo("Success", "Task created successfully"))
        except Exception as e:
            logger.error(f"Failed to create task: {e}")
            error_msg = str(e)
            self.after(0, lambda: messagebox.showerror("Error", f"Failed to create task: {error_msg}"))

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

    def _update_task(self, task_id: str, data):
        """Update task in API"""
        try:
            self.crm_service.update_task(task_id, **data)
            self.after(0, self.refresh_data)
            self.after(0, lambda: messagebox.showinfo("Success", "Task updated successfully"))
        except Exception as e:
            logger.error(f"Failed to update task: {e}")
            error_msg = str(e)
            self.after(0, lambda: messagebox.showerror("Error", f"Failed to update task: {error_msg}"))

    def delete_task(self):
        """Delete selected task"""
        if not self.current_task:
            messagebox.showwarning("Warning", "Please select a task to delete")
            return

        if messagebox.askyesno("Confirm", "Are you sure you want to delete this task?"):
            thread = Thread(
                target=self._remove_task,
                args=(self.current_task["id"],),
                daemon=True
            )
            thread.start()

    def _remove_task(self, task_id: str):
        """Remove task from API"""
        try:
            self.crm_service.delete_task(task_id)
            self.after(0, self.refresh_data)
            self.after(0, lambda: messagebox.showinfo("Success", "Task deleted successfully"))
        except Exception as e:
            logger.error(f"Failed to delete task: {e}")
            error_msg = str(e)
            self.after(0, lambda: messagebox.showerror("Error", f"Failed to delete task: {error_msg}"))

    def _on_tree_double_click(self, event):
        """Handle double-click on task row to open detail dialog"""
        selection = self.tree.selection()
        if not selection:
            return

        task_id = selection[0]
        self.current_task = next((t for t in self.tasks if t.get("id") == task_id), None)
        if self.current_task:
            TaskDetailDialog(self, self.current_task)

    def _on_search_change(self, search_text: str):
        """Handle search filter change"""
        if not self.all_tasks:
            return

        # Filter tasks by search text
        search_fields = ["title", "description", "status"]
        filtered_tasks = search_filter_rows(self.all_tasks, search_text, search_fields)

        # Update tree display with filtered results
        self._refresh_tree_display(filtered_tasks)

    def _refresh_tree_display(self, tasks_to_display: List[Dict[str, Any]]):
        """Refresh tree display with given list of tasks"""
        if not self.tree:
            return

        # Clear tree
        for item in self.tree.get_children():
            self.tree.delete(item)

        # Add tasks
        for task in tasks_to_display:
            is_deleted = "Yes" if task.get("is_deleted", False) else "No"
            self.tree.insert(
                "",
                "end",
                iid=task.get("id"),
                values=(
                    task.get("title", ""),
                    task.get("status", ""),
                    task.get("priority", ""),
                    task.get("due_date", ""),
                    task.get("created_at", "")[:10] if task.get("created_at") else "",
                    is_deleted
                )
            )

    def export_to_csv(self):
        """Export tasks to CSV file"""
        if not self.tree or not self.all_tasks:
            messagebox.showwarning("Warning", "No data to export.")
            return

        # Ask user for file location
        filename = filedialog.asksaveasfilename(
            defaultextension=".csv",
            filetypes=[("CSV files", "*.csv"), ("All files", "*.*")]
        )

        if not filename:
            return

        try:
            # Get current displayed tasks from tree
            displayed_items = self.tree.get_children()
            if not displayed_items:
                messagebox.showwarning("Warning", "No data to export.")
                return

            # Prepare data
            columns = ["Title", "Status", "Priority", "Due Date", "Created", "Deleted"]
            rows = []

            for item in displayed_items:
                values = self.tree.item(item)["values"]
                rows.append(list(values))

            # Export using DataExporter
            if DataExporter.export_to_csv(filename, columns, rows):
                messagebox.showinfo("Success", f"Data exported to {filename}")
                logger.info(f"Exported {len(rows)} tasks to CSV")
            else:
                messagebox.showerror("Error", "Failed to export data")

        except Exception as e:
            logger.error(f"Export error: {e}")
            messagebox.showerror("Error", f"Failed to export data: {e}")

    def export_to_excel(self):
        """Export tasks to Excel file"""
        if not self.tree or not self.all_tasks:
            messagebox.showwarning("Warning", "No data to export.")
            return

        # Ask user for file location
        filename = filedialog.asksaveasfilename(
            defaultextension=".xlsx",
            filetypes=[("Excel files", "*.xlsx"), ("All files", "*.*")]
        )

        if not filename:
            return

        try:
            # Get current displayed tasks from tree
            displayed_items = self.tree.get_children()
            if not displayed_items:
                messagebox.showwarning("Warning", "No data to export.")
                return

            # Prepare data
            columns = ["Title", "Status", "Priority", "Due Date", "Created", "Deleted"]
            rows = []

            for item in displayed_items:
                values = self.tree.item(item)["values"]
                rows.append(list(values))

            # Export using DataExporter
            if DataExporter.export_to_excel(filename, columns, rows):
                messagebox.showinfo("Success", f"Data exported to {filename}")
                logger.info(f"Exported {len(rows)} tasks to Excel")
            else:
                messagebox.showerror("Error", "Failed to export data. Make sure openpyxl is installed.")

        except Exception as e:
            logger.error(f"Export error: {e}")
            messagebox.showerror("Error", f"Failed to export data: {e}")


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
