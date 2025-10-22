import tkinter as tk
from tkinter import ttk, messagebox
import requests
import json
from uuid import UUID

from login_dialog import LoginDialog

# --- API Configuration ---
BASE_URL = "http://173.249.7.183/api/v1"
AUTH_TOKEN_URL = f"{BASE_URL}/auth/token"
CRM_CLIENTS_URL = f"{BASE_URL}/crm/clients"

class CustomerDialog(tk.Toplevel):
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
            "id": str(self.customer["id"]) if self.customer else None, # Ensure UUID is string
            "name": name,
            "email": self.email_var.get().strip(),
            "phone": self.phone_var.get().strip()
        }
        self.destroy()


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Simple CRM")
        self.geometry("700x400")

        self.access_token = None
        self.headers = {}

        self.show_login_dialog()

        # If login was cancelled or failed, exit the app
        if not self.access_token:
            self.destroy()
            return

        # Frame for Treeview and Scrollbar
        tree_frame = tk.Frame(self)
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
        button_frame = tk.Frame(self)
        button_frame.pack(pady=10)

        tk.Button(button_frame, text="Add", command=self.add_customer).pack(side="left", padx=5)
        tk.Button(button_frame, text="Edit", command=self.edit_customer).pack(side="left", padx=5)
        tk.Button(button_frame, text="Delete", command=self.delete_customer).pack(side="left", padx=5)
        tk.Button(button_frame, text="Exit", command=self.quit).pack(side="left", padx=20)

        self.refresh_tree()

    def show_login_dialog(self):
        dialog = LoginDialog(self)
        if dialog.result:
            username = dialog.result["username"]
            password = dialog.result["password"]
            try:
                response = requests.post(AUTH_TOKEN_URL, json={
                    "username": username,
                    "password": password
                })
                response.raise_for_status() # Raise an exception for HTTP errors
                token_data = response.json()
                self.access_token = token_data["accessToken"]
                self.headers = {"Authorization": f"Bearer {self.access_token}"}
            except requests.exceptions.RequestException as e:
                messagebox.showerror("Login Error", f"Failed to login: {e}")
                self.access_token = None
            except KeyError:
                messagebox.showerror("Login Error", "Invalid token response from server.")
                self.access_token = None
        else:
            self.access_token = None # Login cancelled

    def refresh_tree(self):
        for i in self.tree.get_children():
            self.tree.delete(i)
        try:
            response = requests.get(CRM_CLIENTS_URL, headers=self.headers)
            response.raise_for_status()
            clients = response.json()
            for client in clients:
                self.tree.insert("", "end", values=(client["id"], client["name"], client["email"], client["phone"]))
        except requests.exceptions.RequestException as e:
            messagebox.showerror("API Error", f"Failed to fetch clients: {e}")
            self.access_token = None # Invalidate token on API error
            self.destroy()

    def add_customer(self):
        dialog = CustomerDialog(self)
        if dialog.result:
            new_customer_data = {
                "name": dialog.result["name"],
                "email": dialog.result["email"],
                "phone": dialog.result["phone"]
            }
            try:
                response = requests.post(CRM_CLIENTS_URL, json=new_customer_data, headers=self.headers)
                response.raise_for_status()
                self.refresh_tree()
            except requests.exceptions.RequestException as e:
                messagebox.showerror("API Error", f"Failed to add client: {e}")

    def edit_customer(self):
        selected_item = self.tree.focus()
        if not selected_item:
            messagebox.showwarning("Warning", "Please select a customer to edit.")
            return

        item_values = self.tree.item(selected_item)["values"]
        client_id = item_values[0] # UUID as string

        # Fetch current client data to pre-fill dialog
        try:
            response = requests.get(f"{CRM_CLIENTS_URL}/{client_id}", headers=self.headers)
            response.raise_for_status()
            current_customer = response.json()
        except requests.exceptions.RequestException as e:
            messagebox.showerror("API Error", f"Failed to fetch client for editing: {e}")
            return

        dialog = CustomerDialog(self, customer=current_customer)
        if dialog.result:
            updated_customer_data = {
                "name": dialog.result["name"],
                "email": dialog.result["email"],
                "phone": dialog.result["phone"]
            }
            try:
                response = requests.patch(f"{CRM_CLIENTS_URL}/{client_id}", json=updated_customer_data, headers=self.headers)
                response.raise_for_status()
                self.refresh_tree()
            except requests.exceptions.RequestException as e:
                messagebox.showerror("API Error", f"Failed to update client: {e}")

    def delete_customer(self):
        selected_item = self.tree.focus()
        if not selected_item:
            messagebox.showwarning("Warning", "Please select a customer to delete.")
            return

        if messagebox.askyesno("Confirm Delete", "Are you sure you want to delete this customer?"):
            item_values = self.tree.item(selected_item)["values"]
            client_id = item_values[0] # UUID as string
            try:
                response = requests.delete(f"{CRM_CLIENTS_URL}/{client_id}", headers=self.headers)
                response.raise_for_status()
                self.refresh_tree()
            except requests.exceptions.RequestException as e:
                messagebox.showerror("API Error", f"Failed to delete client: {e}")


if __name__ == "__main__":
    app = App()
    app.mainloop()