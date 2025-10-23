"""Main application module for CRM Desktop App"""
import tkinter as tk
from tkinter import ttk, messagebox
from threading import Thread
from typing import Optional

from login_dialog import LoginDialog
from api_client import APIClient, UnauthorizedException
from auth_service import AuthService
from crm_service import CRMService
from logger import logger
from deals_tab import DealsTab
from payments_tab import PaymentsTab


class CustomerDialog(tk.Toplevel):
    """Dialog for adding/editing customers"""

    def __init__(self, parent, customer=None):
        super().__init__(parent)
        self.transient(parent)
        self.parent = parent
        self.result = None
        self.customer = customer

        if self.customer:
            self.title("Edit Customer")
        else:
            self.title("Add Customer")

        self.name_var = tk.StringVar(value=customer["name"] if customer else "")
        self.email_var = tk.StringVar(value=customer["email"] if customer else "")
        self.phone_var = tk.StringVar(value=customer["phone"] if customer else "")

        tk.Label(self, text="Name:").grid(row=0, column=0, padx=10, pady=5, sticky="w")
        tk.Entry(self, textvariable=self.name_var, width=30).grid(row=0, column=1, padx=10, pady=5)

        tk.Label(self, text="Email:").grid(row=1, column=0, padx=10, pady=5, sticky="w")
        tk.Entry(self, textvariable=self.email_var, width=30).grid(row=1, column=1, padx=10, pady=5)

        tk.Label(self, text="Phone:").grid(row=2, column=0, padx=10, pady=5, sticky="w")
        tk.Entry(self, textvariable=self.phone_var, width=30).grid(row=2, column=1, padx=10, pady=5)

        button_frame = tk.Frame(self)
        button_frame.grid(row=3, columnspan=2, pady=10)

        tk.Button(button_frame, text="OK", command=self.on_ok).pack(side="left", padx=5)
        tk.Button(button_frame, text="Cancel", command=self.destroy).pack(side="left", padx=5)

        self.grab_set()
        self.wait_window(self)

    def on_ok(self):
        name = self.name_var.get().strip()
        if not name:
            messagebox.showerror("Error", "Name cannot be empty.", parent=self)
            return

        self.result = {
            "id": str(self.customer["id"]) if self.customer else None,
            "name": name,
            "email": self.email_var.get().strip(),
            "phone": self.phone_var.get().strip()
        }
        self.destroy()


class App(tk.Tk):
    """Main application window"""

    def __init__(self):
        super().__init__()
        self.title("CRM Desktop Application")
        self.geometry("700x400")

        self.api_client: Optional[APIClient] = None
        self.crm_service: Optional[CRMService] = None
        self.tree: Optional[ttk.Treeview] = None

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

        # --- Clients Tab ---
        clients_frame = ttk.Frame(self.notebook)
        self.notebook.add(clients_frame, text="Clients")

        # Frame for Treeview and Scrollbar
        tree_frame = tk.Frame(clients_frame)
        tree_frame.pack(pady=10, padx=10, fill="both", expand=True)

        self.tree = ttk.Treeview(tree_frame, columns=("ID", "Name", "Email", "Phone"), show="headings")
        self.tree.heading("ID", text="ID")
        self.tree.heading("Name", text="Name")
        self.tree.heading("Email", text="Email")
        self.tree.heading("Phone", text="Phone")

        self.tree.column("ID", width=50, anchor="center")
        self.tree.column("Name", width=150)
        self.tree.column("Email", width=200)
        self.tree.column("Phone", width=120)

        scrollbar = ttk.Scrollbar(tree_frame, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=scrollbar.set)

        self.tree.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        # Frame for buttons
        button_frame = tk.Frame(clients_frame)
        button_frame.pack(pady=10)

        tk.Button(button_frame, text="Add", command=self.add_customer).pack(side="left", padx=5)
        tk.Button(button_frame, text="Edit", command=self.edit_customer).pack(side="left", padx=5)
        tk.Button(button_frame, text="Delete", command=self.delete_customer).pack(side="left", padx=5)

        # --- Deals Tab ---
        deals_frame = ttk.Frame(self.notebook)
        self.notebook.add(deals_frame, text="Deals")
        self.deals_tab = DealsTab(deals_frame, self.crm_service)

        # --- Payments Tab ---
        payments_frame = ttk.Frame(self.notebook)
        self.notebook.add(payments_frame, text="Payments")
        self.payments_tab = PaymentsTab(payments_frame, self.crm_service)

        # Exit button
        exit_button_frame = tk.Frame(self)
        exit_button_frame.pack(pady=10)
        tk.Button(exit_button_frame, text="Exit", command=self.quit).pack(padx=20)

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
        for i in self.tree.get_children():
            self.tree.delete(i)
        for client in clients:
            self.tree.insert("", "end", values=(client["id"], client["name"], client["email"], client["phone"]))

    def _handle_api_error(self, error_msg):
        """Handle API errors on main thread"""
        messagebox.showerror("API Error", error_msg)
        self.api_client = None
        self.destroy()

    def _on_unauthorized(self):
        """Handle 401 Unauthorized response"""
        logger.warning("Session expired, re-login required")
        messagebox.showwarning("Session Expired", "Your session has expired. Please login again.")
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
                        dialog.result["phone"]
                    )
                    self.after(0, self.refresh_tree)
                except Exception as e:
                    logger.error(f"Failed to add client: {e}")
                    self.after(0, lambda: messagebox.showerror("API Error", f"Failed to add client: {e}"))

            Thread(target=worker, daemon=True).start()

    def edit_customer(self):
        """Edit selected customer"""
        if not self.tree:
            return
        selected_item = self.tree.focus()
        if not selected_item:
            messagebox.showwarning("Warning", "Please select a customer to edit.")
            return

        item_values = self.tree.item(selected_item)["values"]
        client_id = item_values[0]  # UUID as string

        # Fetch current client data asynchronously
        def fetch_and_edit():
            try:
                current_customer = self.crm_service.get_client(client_id)
                self.after(0, lambda: self._show_edit_dialog(client_id, current_customer))
            except Exception as e:
                logger.error(f"Failed to fetch client for editing: {e}")
                self.after(0, lambda: messagebox.showerror("API Error", f"Failed to fetch client: {e}"))

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
                        dialog.result["phone"]
                    )
                    self.after(0, self.refresh_tree)
                except Exception as e:
                    logger.error(f"Failed to update client: {e}")
                    self.after(0, lambda: messagebox.showerror("API Error", f"Failed to update client: {e}"))

            Thread(target=worker, daemon=True).start()

    def delete_customer(self):
        """Delete selected customer"""
        if not self.tree:
            return
        selected_item = self.tree.focus()
        if not selected_item:
            messagebox.showwarning("Warning", "Please select a customer to delete.")
            return

        if messagebox.askyesno("Confirm Delete", "Are you sure you want to delete this customer?"):
            item_values = self.tree.item(selected_item)["values"]
            client_id = item_values[0]  # UUID as string

            def worker():
                try:
                    self.crm_service.delete_client(client_id)
                    self.after(0, self.refresh_tree)
                except Exception as e:
                    logger.error(f"Failed to delete client: {e}")
                    self.after(0, lambda: messagebox.showerror("API Error", f"Failed to delete client: {e}"))

            Thread(target=worker, daemon=True).start()


if __name__ == "__main__":
    app = App()
    app.mainloop()
