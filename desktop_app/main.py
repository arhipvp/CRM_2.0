"""Main application module for CRM Desktop App"""
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from threading import Thread
from typing import Optional, List, Dict, Any

from login_dialog import LoginDialog
from api_client import APIClient, UnauthorizedException
from auth_service import AuthService
from crm_service import CRMService
from logger import logger
from i18n import i18n
from deals_tab import DealsTab
from payments_tab import PaymentsTab
from deal_journal_tab import DealJournalTab
from tasks_tab import TasksTab
from policies_tab import PoliciesTab
from calculations_tab import CalculationsTab
from detail_dialogs import ClientDetailDialog
from search_utils import SearchFilter, DataExporter, search_filter_rows
from table_sort_utils import treeview_sort_column


class CustomerDialog(tk.Toplevel):
    """Dialog for adding/editing customers"""

    def __init__(self, parent, customer=None):
        super().__init__(parent)
        self.transient(parent)
        self.parent = parent
        self.result = None
        self.customer = customer

        if self.customer:
            self.title(i18n("Edit Customer"))
        else:
            self.title(i18n("Add Customer"))

        self.name_var = tk.StringVar(value=customer["name"] if customer else "")
        self.email_var = tk.StringVar(value=customer["email"] if customer else "")
        self.phone_var = tk.StringVar(value=customer["phone"] if customer else "")
        self.status_var = tk.StringVar(value=customer.get("status", "active") if customer else "active")

        tk.Label(self, text=i18n("Name") + ":").grid(row=0, column=0, padx=10, pady=5, sticky="w")
        tk.Entry(self, textvariable=self.name_var, width=30).grid(row=0, column=1, padx=10, pady=5)

        tk.Label(self, text=i18n("Email") + ":").grid(row=1, column=0, padx=10, pady=5, sticky="w")
        tk.Entry(self, textvariable=self.email_var, width=30).grid(row=1, column=1, padx=10, pady=5)

        tk.Label(self, text=i18n("Phone") + ":").grid(row=2, column=0, padx=10, pady=5, sticky="w")
        tk.Entry(self, textvariable=self.phone_var, width=30).grid(row=2, column=1, padx=10, pady=5)

        tk.Label(self, text=i18n("Status") + ":").grid(row=3, column=0, padx=10, pady=5, sticky="w")
        status_combo = ttk.Combobox(
            self,
            textvariable=self.status_var,
            values=["active", "prospect", "inactive"],
            state="readonly",
            width=28
        )
        status_combo.grid(row=3, column=1, padx=10, pady=5)

        button_frame = tk.Frame(self)
        button_frame.grid(row=4, columnspan=2, pady=10)

        tk.Button(button_frame, text=i18n("OK"), command=self.on_ok).pack(side="left", padx=5)
        tk.Button(button_frame, text=i18n("Cancel"), command=self.destroy).pack(side="left", padx=5)

        self.grab_set()
        self.wait_window(self)

    def on_ok(self):
        name = self.name_var.get().strip()
        if not name:
            messagebox.showerror(i18n("Error"), i18n("Name cannot be empty."), parent=self)
            return

        self.result = {
            "id": str(self.customer["id"]) if self.customer else None,
            "name": name,
            "email": self.email_var.get().strip(),
            "phone": self.phone_var.get().strip(),
            "status": self.status_var.get()
        }
        self.destroy()


class App(tk.Tk):
    """Main application window"""

    def __init__(self):
        super().__init__()
        self.title(i18n("CRM Management System"))
        self.geometry("1300x700")

        self.api_client: Optional[APIClient] = None
        self.crm_service: Optional[CRMService] = None
        self.tree: Optional[ttk.Treeview] = None
        self.search_filter: Optional[SearchFilter] = None
        self.all_clients: List[Dict[str, Any]] = []  # Store all clients for filtering

        # Show login dialog
        self.show_login_dialog()

        # If login was cancelled or failed, exit the app
        if not self.api_client:
            self.destroy()
            return

        # Setup UI
        self._setup_ui()

        # Setup 401 callback
        self.api_client.set_unauthorized_callback(self._on_unauthorized)

        self.refresh_tree()

    def show_login_dialog(self):
        """Show login dialog and authenticate user"""
        # Пропускаем авторизацию - подключаемся напрямую к CRM API без токена
        self.api_client = APIClient()  # Без авторизации для разработки
        self.crm_service = CRMService(self.api_client)
        return

        dialog = LoginDialog(self)
        if dialog.result:
            username = dialog.result["username"]
            password = dialog.result["password"]
            try:
                access_token = AuthService.login(username, password)
                if access_token:
                    self.api_client = APIClient(access_token)
                    self.crm_service = CRMService(self.api_client)
                else:
                    messagebox.showerror("Login Error", "Invalid credentials.")
                    self.api_client = None
            except Exception as e:
                messagebox.showerror("Login Error", f"Failed to login: {e}")
                self.api_client = None
        else:
            self.api_client = None  # Login cancelled

    def _setup_ui(self):
        """Setup user interface with tabs"""
        # Create tab interface
        self.notebook = ttk.Notebook(self)
        self.notebook.pack(pady=10, padx=10, fill="both", expand=True)

        # Bind tab change event to refresh data
        self.notebook.bind("<<NotebookTabChanged>>", self._on_tab_changed)

        # --- Clients Tab ---
        clients_frame = ttk.Frame(self.notebook)
        self.notebook.add(clients_frame, text=i18n("Clients"))

        # Search filter frame
        search_frame = tk.Frame(clients_frame)
        search_frame.pack(pady=5, padx=10, fill="x")

        self.search_filter = SearchFilter(search_frame, self._on_search_change)
        self.search_filter.pack(fill="x")

        # Frame for Treeview and Scrollbar
        tree_frame = tk.Frame(clients_frame)
        tree_frame.pack(pady=10, padx=10, fill="both", expand=True)

        self.tree = ttk.Treeview(
            tree_frame,
            columns=(
                "ID", "Tenant ID", "Owner ID", "Deleted", "Name", "Email",
                "Phone", "Status", "Created At", "Updated At"
            ),
            show="headings"
        )

        for col in (
            "ID", "Tenant ID", "Owner ID", "Deleted", "Name", "Email",
            "Phone", "Status", "Created At", "Updated At"
        ):
            self.tree.heading(col, text=i18n(col), command=lambda c=col: self._on_tree_sort(c))

        self.tree.column("ID", width=50)
        self.tree.column("Tenant ID", width=100)
        self.tree.column("Owner ID", width=100)
        self.tree.column("Deleted", width=60)
        self.tree.column("Name", width=140)
        self.tree.column("Email", width=180)
        self.tree.column("Phone", width=100)
        self.tree.column("Status", width=70)
        self.tree.column("Created At", width=150)
        self.tree.column("Updated At", width=150)

        scrollbar = ttk.Scrollbar(tree_frame, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=scrollbar.set)

        self.tree.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        # Bind double-click to open detail dialog
        self.tree.bind("<Double-1>", self._on_tree_double_click)

        # Frame for buttons
        button_frame = tk.Frame(clients_frame)
        button_frame.pack(pady=10)

        tk.Button(button_frame, text=i18n("Add"), command=self.add_customer).pack(side="left", padx=5)
        tk.Button(button_frame, text=i18n("Edit"), command=self.edit_customer).pack(side="left", padx=5)
        tk.Button(button_frame, text=i18n("Delete"), command=self.delete_customer).pack(side="left", padx=5)
        tk.Button(button_frame, text=i18n("Refresh"), command=self.refresh_tree).pack(side="left", padx=5)
        tk.Button(button_frame, text=i18n("Export CSV"), command=self.export_to_csv).pack(side="left", padx=5)
        tk.Button(button_frame, text=i18n("Export Excel"), command=self.export_to_excel).pack(side="left", padx=5)

        # --- Deals Tab ---
        deals_frame = ttk.Frame(self.notebook)
        self.notebook.add(deals_frame, text=i18n("Deals"))
        self.deals_tab = DealsTab(deals_frame, self.crm_service)

        # --- Payments Tab ---
        payments_frame = ttk.Frame(self.notebook)
        self.notebook.add(payments_frame, text=i18n("Payments"))
        self.payments_tab = PaymentsTab(payments_frame, self.crm_service)

        # --- Deal Journal Tab ---
        journal_frame = ttk.Frame(self.notebook)
        self.notebook.add(journal_frame, text=i18n("Deal Journal"))
        self.journal_tab = DealJournalTab(journal_frame, self.crm_service)

        # --- Tasks Tab ---
        tasks_frame = ttk.Frame(self.notebook)
        self.notebook.add(tasks_frame, text=i18n("Tasks"))
        self.tasks_tab = TasksTab(tasks_frame, self.crm_service)

        # --- Policies Tab ---
        policies_frame = ttk.Frame(self.notebook)
        self.notebook.add(policies_frame, text=i18n("Policies"))
        self.policies_tab = PoliciesTab(policies_frame, self.crm_service)

        # --- Calculations Tab ---
        calculations_frame = ttk.Frame(self.notebook)
        self.notebook.add(calculations_frame, text=i18n("Calculations"))
        self.calculations_tab = CalculationsTab(calculations_frame, self.crm_service)

        # Exit button
        exit_button_frame = tk.Frame(self)
        exit_button_frame.pack(pady=10)
        tk.Button(exit_button_frame, text=i18n("Exit"), command=self.quit).pack(padx=20)

    def _on_tree_sort(self, col):
        display_map = {
            "ID": "id",
            "Tenant ID": "tenant_id",
            "Owner ID": "owner_id",
            "Deleted": "is_deleted",
            "Name": "name",
            "Email": "email",
            "Phone": "phone",
            "Status": "status",
            "Created At": "created_at",
            "Updated At": "updated_at",
        }
        treeview_sort_column(self.tree, col, False, self.all_clients, display_map)

    def refresh_tree(self):
        """Refresh client list asynchronously"""
        def worker():
            try:
                clients = self.crm_service.get_clients()
                self.after(0, self._update_tree_ui, clients)
            except Exception as e:
                logger.error(f"Failed to fetch clients: {e}")
                self.after(0, self._handle_api_error, f"Failed to fetch clients: {e}")

        Thread(target=worker, daemon=True).start()

    def _update_tree_ui(self, clients):
        """Update tree UI on main thread"""
        if not self.tree:
            return

        # Store all clients for filtering
        self.all_clients = clients
        self._refresh_tree_display(clients)

    def _refresh_tree_display(self, clients_to_display: List[Dict[str, Any]]):
        """Refresh tree display with given list of clients"""
        if not self.tree:
            return

        # Clear tree
        for i in self.tree.get_children():
            self.tree.delete(i)

        # Add clients
        for client in clients_to_display:
            client_id = str(client.get("id", "N/A"))[:8]  # Show first 8 chars of UUID
            tenant_id = str(client.get("tenant_id", "N/A"))[:8]
            owner_id = str(client.get("owner_id", "N/A"))[:8]
            is_deleted = "Yes" if client.get("is_deleted", False) else "No"
            self.tree.insert("", "end", iid=client.get("id"), values=(
                client_id,
                tenant_id,
                owner_id,
                is_deleted,
                client.get("name", "N/A"),
                client.get("email", "N/A"),
                client.get("phone", "N/A"),
                client.get("status", "N/A"),
                client.get("created_at", "N/A"),
                client.get("updated_at", "N/A"),
            ))

    def _handle_api_error(self, error_msg):
        """Handle API errors on main thread"""
        messagebox.showerror(i18n("API Error"), error_msg)
        self.api_client = None
        self.destroy()

    def _on_unauthorized(self):
        """Handle 401 Unauthorized response"""
        logger.warning("Session expired, re-login required")
        messagebox.showwarning(i18n("Session Expired"), i18n("Your session has expired. Please login again."))
        self.api_client = None
        self.destroy()

    def add_customer(self):
        """Add new customer"""
        dialog = CustomerDialog(self)
        if dialog.result:
            def worker():
                try:
                    self.crm_service.create_client(
                        dialog.result["name"],
                        dialog.result["email"],
                        dialog.result["phone"],
                        status=dialog.result.get("status", "active")
                    )
                    self.after(0, self.refresh_tree)
                except Exception as e:
                    logger.error(f"Failed to add client: {e}")
                    error_msg = str(e)
                    self.after(0, lambda: messagebox.showerror("API Error", f"Failed to add client: {error_msg}"))

            Thread(target=worker, daemon=True).start()

    def edit_customer(self):
        """Edit selected customer"""
        if not self.tree:
            return
        selected_item = self.tree.focus()
        if not selected_item:
            messagebox.showwarning(i18n("Warning"), i18n("Please select a customer to edit."))
            return

        client_id = selected_item  # Use the iid which is the client ID

        # Fetch current client data asynchronously
        def fetch_and_edit():
            try:
                current_customer = self.crm_service.get_client(client_id)
                self.after(0, lambda: self._show_edit_dialog(client_id, current_customer))
            except Exception as e:
                logger.error(f"Failed to fetch client for editing: {e}")
                error_msg = str(e)
                self.after(0, lambda: messagebox.showerror(i18n("API Error"), i18n("Failed to fetch client") + ": " + error_msg))

        Thread(target=fetch_and_edit, daemon=True).start()

    def _show_edit_dialog(self, client_id, current_customer):
        """Show edit dialog on main thread"""
        dialog = CustomerDialog(self, customer=current_customer)
        if dialog.result:
            def worker():
                try:
                    self.crm_service.update_client(
                        client_id,
                        dialog.result["name"],
                        dialog.result["email"],
                        dialog.result["phone"],
                        status=dialog.result.get("status", "active")
                    )
                    self.after(0, self.refresh_tree)
                except Exception as e:
                    logger.error(f"Failed to update client: {e}")
                    error_msg = str(e)
                    self.after(0, lambda: messagebox.showerror("API Error", f"Failed to update client: {error_msg}"))

            Thread(target=worker, daemon=True).start()

    def delete_customer(self):
        """Delete selected customer"""
        if not self.tree:
            return
        selected_item = self.tree.focus()
        if not selected_item:
            messagebox.showwarning("Warning", "Please select a customer to delete.")
            return

        if messagebox.askyesno(i18n("Confirm Delete"), i18n("Are you sure you want to delete this")):
            client_id = selected_item  # Use the iid which is the client ID

            def worker():
                try:
                    self.crm_service.delete_client(client_id)
                    self.after(0, self.refresh_tree)
                except Exception as e:
                    logger.error(f"Failed to delete client: {e}")
                    error_msg = str(e)
                    self.after(0, lambda: messagebox.showerror(i18n("API Error"), i18n("Failed to delete client") + ": " + error_msg))

            Thread(target=worker, daemon=True).start()

    def _on_tree_double_click(self, event):
        """Handle double-click on client row to open detail dialog"""
        if not self.tree:
            return
        selected_item = self.tree.focus()
        if not selected_item:
            return

        # Fetch full client data
        client_id = selected_item
        try:
            client_data = self.crm_service.get_client(client_id)
            if client_data:
                ClientDetailDialog(self, client_data)
        except Exception as e:
            logger.error(f"Failed to fetch client details: {e}")
            messagebox.showerror(i18n("Error"), i18n("Failed to fetch") + f": {e}")

    def _on_search_change(self, search_text: str):
        """Handle search filter change"""
        if not self.all_clients:
            return

        # Filter clients by search text
        search_fields = ["name", "email", "phone"]
        filtered_clients = search_filter_rows(self.all_clients, search_text, search_fields)

        # Update tree display with filtered results
        self._refresh_tree_display(filtered_clients)

    def export_to_csv(self):
        """Export clients to CSV file"""
        if not self.tree or not self.all_clients:
            messagebox.showwarning(i18n("Warning"), i18n("No data to export"))
            return

        # Ask user for file location
        filename = filedialog.asksaveasfilename(
            defaultextension=".csv",
            filetypes=[(i18n("CSV files"), "*.csv"), (i18n("All files"), "*.*")]
        )

        if not filename:
            return

        try:
            # Prepare data
            columns = [
                i18n("ID"), i18n("Tenant ID"), i18n("Owner ID"), i18n("Deleted"), i18n("Name"), i18n("Email"),
                i18n("Phone"), i18n("Status"), i18n("Created At"), i18n("Updated At")
            ]
            rows = []

            for client in self.all_clients:
                is_deleted = i18n("Yes") if client.get("is_deleted", False) else i18n("No")
                rows.append([
                    client.get("id", "N/A")[:8],
                    client.get("tenant_id", "N/A")[:8],
                    client.get("owner_id", "N/A")[:8],
                    is_deleted,
                    client.get("name", "N/A"),
                    client.get("email", "N/A"),
                    client.get("phone", "N/A"),
                    client.get("status", "N/A"),
                    client.get("created_at", "N/A"),
                    client.get("updated_at", "N/A"),
                ])

            # Export using DataExporter
            if DataExporter.export_to_csv(filename, columns, rows):
                messagebox.showinfo(i18n("Success"), i18n("Data exported to") + f" {filename}")
                logger.info(f"Exported {len(rows)} clients to CSV")
            else:
                messagebox.showerror(i18n("Error"), i18n("Failed to export data"))

        except Exception as e:
            logger.error(f"Export error: {e}")
            messagebox.showerror(i18n("Error"), i18n("Failed to export data") + f": {e}")

    def export_to_excel(self):
        """Export clients to Excel file"""
        if not self.tree or not self.all_clients:
            messagebox.showwarning(i18n("Warning"), i18n("No data to export"))
            return

        # Ask user for file location
        filename = filedialog.asksaveasfilename(
            defaultextension=".xlsx",
            filetypes=[(i18n("Excel files"), "*.xlsx"), (i18n("All files"), "*.*")]
        )

        if not filename:
            return

        try:
            # Prepare data
            columns = [
                i18n("ID"), i18n("Tenant ID"), i18n("Owner ID"), i18n("Deleted"), i18n("Name"), i18n("Email"),
                i18n("Phone"), i18n("Status"), i18n("Created At"), i18n("Updated At")
            ]
            rows = []

            for client in self.all_clients:
                is_deleted = i18n("Yes") if client.get("is_deleted", False) else i18n("No")
                rows.append([
                    client.get("id", "N/A")[:8],
                    client.get("tenant_id", "N/A")[:8],
                    client.get("owner_id", "N/A")[:8],
                    is_deleted,
                    client.get("name", "N/A"),
                    client.get("email", "N/A"),
                    client.get("phone", "N/A"),
                    client.get("status", "N/A"),
                    client.get("created_at", "N/A"),
                    client.get("updated_at", "N/A"),
                ])

            # Export using DataExporter
            if DataExporter.export_to_excel(filename, columns, rows):
                messagebox.showinfo(i18n("Success"), i18n("Data exported to") + f" {filename}")
                logger.info(f"Exported {len(rows)} clients to Excel")
            else:
                messagebox.showerror(i18n("Error"), i18n("Failed to export data. Make sure openpyxl is installed."))

        except Exception as e:
            logger.error(f"Export error: {e}")
            messagebox.showerror(i18n("Error"), i18n("Failed to export data") + f": {e}")

    def _on_tab_changed(self, event):
        """Handle notebook tab change to refresh data"""
        selected_tab_index = self.notebook.index(self.notebook.select())
        selected_tab_name = self.notebook.tab(selected_tab_index, "text")

        logger.info(f"Switched to tab: {selected_tab_name}")

        # Refresh data for the selected tab
        if selected_tab_name == "Tasks":
            self.tasks_tab.refresh_data()
        elif selected_tab_name == "Policies":
            self.policies_tab.refresh_data()
        elif selected_tab_name == "Calculations":
            self.calculations_tab.refresh_deals()
        elif selected_tab_name == "Deals":
            self.deals_tab.refresh_data()
        elif selected_tab_name == "Payments":
            self.payments_tab.refresh_data()


if __name__ == "__main__":
    app = App()
    app.mainloop()
