"""Policies tab module for CRM Desktop App"""
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from typing import Optional, Dict, Any, Callable, List
from threading import Thread
from crm_service import CRMService
from logger import logger
from detail_dialogs import PolicyDetailDialog
from edit_dialogs import PolicyEditDialog
from search_utils import SearchFilter, DataExporter, search_filter_rows


class PoliciesTab(ttk.Frame):
    """Tab for managing policies"""

    def __init__(self, parent, crm_service: CRMService, on_refresh: Optional[Callable] = None):
        super().__init__(parent)
        self.crm_service = crm_service
        self.on_refresh = on_refresh
        self.policies = []
        self.all_policies = []  # Store all policies for filtering
        self.current_policy = None
        self.search_filter: Optional[SearchFilter] = None
        self.all_clients: List[Dict[str, Any]] = []
        self.all_deals: List[Dict[str, Any]] = []

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

        ttk.Button(control_frame, text="Add Policy", command=self.add_policy).pack(side="left", padx=5)
        ttk.Button(control_frame, text="Edit", command=self.edit_policy).pack(side="left", padx=5)
        ttk.Button(control_frame, text="Delete", command=self.delete_policy).pack(side="left", padx=5)
        ttk.Button(control_frame, text="Refresh", command=self.refresh_data).pack(side="left", padx=5)
        ttk.Button(control_frame, text="Export CSV", command=self.export_to_csv).pack(side="left", padx=5)
        ttk.Button(control_frame, text="Export Excel", command=self.export_to_excel).pack(side="left", padx=5)

        # Filter frame
        filter_frame = ttk.LabelFrame(self, text="Filters", padding=5)
        filter_frame.pack(fill="x", padx=5, pady=5)

        ttk.Label(filter_frame, text="Status:").pack(side="left", padx=5)
        self.status_filter = ttk.Combobox(
            filter_frame,
            values=["All", "draft", "active", "inactive"],
            state="readonly",
            width=15
        )
        self.status_filter.set("All")
        self.status_filter.pack(side="left", padx=5)
        self.status_filter.bind("<<ComboboxSelected>>", lambda e: self.apply_filters())

        # Treeview frame
        tree_frame = ttk.Frame(self)
        tree_frame.pack(fill="both", expand=True, padx=5, pady=5)

        # Scrollbar
        scrollbar = ttk.Scrollbar(tree_frame)
        scrollbar.pack(side="right", fill="y")

        # Treeview
        columns = ("policy_number", "status", "premium", "effective_from", "effective_to", "created_at", "deleted")
        self.tree = ttk.Treeview(
            tree_frame,
            columns=columns,
            show="headings",
            yscrollcommand=scrollbar.set,
            height=20
        )
        scrollbar.config(command=self.tree.yview)

        # Define column headings and widths
        self.tree.column("policy_number", width=150, anchor="w")
        self.tree.column("status", width=100, anchor="w")
        self.tree.column("premium", width=100, anchor="e")
        self.tree.column("effective_from", width=100, anchor="w")
        self.tree.column("effective_to", width=100, anchor="w")
        self.tree.column("created_at", width=100, anchor="w")
        self.tree.column("deleted", width=60, anchor="w")

        self.tree.heading("policy_number", text="Policy Number")
        self.tree.heading("status", text="Status")
        self.tree.heading("premium", text="Premium")
        self.tree.heading("effective_from", text="Effective From")
        self.tree.heading("effective_to", text="Effective To")
        self.tree.heading("created_at", text="Created")
        self.tree.heading("deleted", text="Deleted")

        # Bind selection and double-click
        self.tree.bind("<<TreeviewSelect>>", self.on_policy_select)
        self.tree.bind("<Double-1>", self._on_tree_double_click)

        self.tree.pack(fill="both", expand=True)

        # Details frame
        details_frame = ttk.LabelFrame(self, text="Policy Details", padding=5)
        details_frame.pack(fill="x", padx=5, pady=5)

        ttk.Label(details_frame, text="Policy Number:").grid(row=0, column=0, sticky="w", padx=5, pady=2)
        self.policy_number_label = ttk.Label(details_frame, text="")
        self.policy_number_label.grid(row=0, column=1, sticky="w", padx=5, pady=2)

        ttk.Label(details_frame, text="Client ID:").grid(row=1, column=0, sticky="w", padx=5, pady=2)
        self.client_id_label = ttk.Label(details_frame, text="")
        self.client_id_label.grid(row=1, column=1, sticky="w", padx=5, pady=2)

        ttk.Label(details_frame, text="Status:").grid(row=2, column=0, sticky="w", padx=5, pady=2)
        self.status_label = ttk.Label(details_frame, text="")
        self.status_label.grid(row=2, column=1, sticky="w", padx=5, pady=2)

        ttk.Label(details_frame, text="Premium:").grid(row=3, column=0, sticky="w", padx=5, pady=2)
        self.premium_label = ttk.Label(details_frame, text="")
        self.premium_label.grid(row=3, column=1, sticky="w", padx=5, pady=2)

    def refresh_data(self):
        """Refresh policies data from API"""
        thread = Thread(target=self._fetch_policies, daemon=True)
        thread.start()

    def _fetch_policies(self):
        """Fetch policies in background"""
        try:
            self.policies = self.crm_service.get_policies()
            self.all_policies = self.policies  # Store all policies for filtering
            # Also fetch clients and deals for dropdowns
            self.all_clients = self.crm_service.get_clients()
            self.all_deals = self.crm_service.get_deals()
            self.after(0, self._update_tree)
            logger.info(f"Fetched {len(self.policies)} policies")
        except Exception as e:
            logger.error(f"Failed to fetch policies: {e}")
            error_msg = str(e)
            self.after(0, lambda: messagebox.showerror("Error", f"Failed to fetch policies: {error_msg}"))

    def _update_tree(self):
        """Update tree with policies data"""
        # Clear existing items
        for item in self.tree.get_children():
            self.tree.delete(item)

        # Add policies
        for policy in self.policies:
            is_deleted = "Yes" if policy.get("is_deleted", False) else "No"
            self.tree.insert(
                "",
                "end",
                iid=policy.get("id"),
                values=(
                    policy.get("policy_number", ""),
                    policy.get("status", ""),
                    f"{policy.get('premium', 0):.2f}" if policy.get('premium') else "0.00",
                    policy.get("effective_from", ""),
                    policy.get("effective_to", ""),
                    policy.get("created_at", "")[:10] if policy.get("created_at") else "",
                    is_deleted
                )
            )

    def apply_filters(self):
        """Apply filter to policies"""
        status_filter = self.status_filter.get()

        # Clear and repopulate tree
        for item in self.tree.get_children():
            self.tree.delete(item)

        for policy in self.policies:
            status_match = (status_filter == "All" or policy.get("status") == status_filter)

            if status_match:
                is_deleted = "Yes" if policy.get("is_deleted", False) else "No"
                self.tree.insert(
                    "",
                    "end",
                    iid=policy.get("id"),
                    values=(
                        policy.get("policy_number", ""),
                        policy.get("status", ""),
                        f"{policy.get('premium', 0):.2f}" if policy.get('premium') else "0.00",
                        policy.get("effective_from", ""),
                        policy.get("effective_to", ""),
                        policy.get("created_at", "")[:10] if policy.get("created_at") else "",
                        is_deleted
                    )
                )

    def on_policy_select(self, event):
        """Handle policy selection"""
        selection = self.tree.selection()
        if selection:
            policy_id = selection[0]
            self.current_policy = next((p for p in self.policies if p.get("id") == policy_id), None)
            if self.current_policy:
                self.policy_number_label.config(text=self.current_policy.get("policy_number", ""))
                self.client_id_label.config(text=str(self.current_policy.get("client_id", "")))
                self.status_label.config(text=self.current_policy.get("status", ""))
                premium = self.current_policy.get("premium", 0)
                self.premium_label.config(text=f"{premium:.2f}" if premium else "0.00")

    def add_policy(self):
        """Add new policy"""
        dialog = PolicyEditDialog(self, policy=None, clients_list=self.all_clients, deals_list=self.all_deals)
        if dialog.result:
            thread = Thread(
                target=self._create_policy,
                args=(dialog.result,),
                daemon=True
            )
            thread.start()

    def _create_policy(self, data):
        """Create policy in API"""
        try:
            self.crm_service.create_policy(**data)
            self.after(0, self.refresh_data)
            self.after(0, lambda: messagebox.showinfo("Success", "Policy created successfully"))
        except Exception as e:
            logger.error(f"Failed to create policy: {e}")
            error_msg = str(e)
            self.after(0, lambda: messagebox.showerror("Error", f"Failed to create policy: {error_msg}"))

    def edit_policy(self):
        """Edit selected policy"""
        if not self.current_policy:
            messagebox.showwarning("Warning", "Please select a policy to edit")
            return

        dialog = PolicyEditDialog(self, policy=self.current_policy, clients_list=self.all_clients, deals_list=self.all_deals)
        if dialog.result:
            thread = Thread(
                target=self._update_policy,
                args=(self.current_policy["id"], dialog.result),
                daemon=True
            )
            thread.start()

    def _update_policy(self, policy_id: str, data):
        """Update policy in API"""
        try:
            self.crm_service.update_policy(policy_id, **data)
            self.after(0, self.refresh_data)
            self.after(0, lambda: messagebox.showinfo("Success", "Policy updated successfully"))
        except Exception as e:
            logger.error(f"Failed to update policy: {e}")
            error_msg = str(e)
            self.after(0, lambda: messagebox.showerror("Error", f"Failed to update policy: {error_msg}"))

    def delete_policy(self):
        """Delete selected policy"""
        if not self.current_policy:
            messagebox.showwarning("Warning", "Please select a policy to delete")
            return

        if messagebox.askyesno("Confirm", "Are you sure you want to delete this policy?"):
            thread = Thread(
                target=self._remove_policy,
                args=(self.current_policy["id"],),
                daemon=True
            )
            thread.start()

    def _remove_policy(self, policy_id: str):
        """Remove policy from API"""
        try:
            self.crm_service.delete_policy(policy_id)
            self.after(0, self.refresh_data)
            self.after(0, lambda: messagebox.showinfo("Success", "Policy deleted successfully"))
        except Exception as e:
            logger.error(f"Failed to delete policy: {e}")
            error_msg = str(e)
            self.after(0, lambda: messagebox.showerror("Error", f"Failed to delete policy: {error_msg}"))

    def _on_tree_double_click(self, event):
        """Handle double-click on policy row to open detail dialog"""
        selection = self.tree.selection()
        if not selection:
            return

        policy_id = selection[0]
        self.current_policy = next((p for p in self.policies if p.get("id") == policy_id), None)
        if self.current_policy:
            PolicyDetailDialog(self, self.current_policy)

    def _on_search_change(self, search_text: str):
        """Handle search filter change"""
        if not self.all_policies:
            return

        # Filter policies by search text
        search_fields = ["policy_number", "status"]
        filtered_policies = search_filter_rows(self.all_policies, search_text, search_fields)

        # Update tree display with filtered results
        self._refresh_tree_display(filtered_policies)

    def _refresh_tree_display(self, policies_to_display: List[Dict[str, Any]]):
        """Refresh tree display with given list of policies"""
        if not self.tree:
            return

        # Clear tree
        for item in self.tree.get_children():
            self.tree.delete(item)

        # Add policies
        for policy in policies_to_display:
            is_deleted = "Yes" if policy.get("is_deleted", False) else "No"
            self.tree.insert(
                "",
                "end",
                iid=policy.get("id"),
                values=(
                    policy.get("policy_number", ""),
                    policy.get("status", ""),
                    f"{policy.get('premium', 0):.2f}" if policy.get('premium') else "0.00",
                    policy.get("effective_from", ""),
                    policy.get("effective_to", ""),
                    policy.get("created_at", "")[:10] if policy.get("created_at") else "",
                    is_deleted
                )
            )

    def export_to_csv(self):
        """Export policies to CSV file"""
        if not self.tree or not self.all_policies:
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
            # Get current displayed policies from tree
            displayed_items = self.tree.get_children()
            if not displayed_items:
                messagebox.showwarning("Warning", "No data to export.")
                return

            # Prepare data
            columns = ["Policy Number", "Status", "Premium", "Effective From", "Effective To", "Created", "Deleted"]
            rows = []

            for item in displayed_items:
                values = self.tree.item(item)["values"]
                rows.append(list(values))

            # Export using DataExporter
            if DataExporter.export_to_csv(filename, columns, rows):
                messagebox.showinfo("Success", f"Data exported to {filename}")
                logger.info(f"Exported {len(rows)} policies to CSV")
            else:
                messagebox.showerror("Error", "Failed to export data")

        except Exception as e:
            logger.error(f"Export error: {e}")
            messagebox.showerror("Error", f"Failed to export data: {e}")

    def export_to_excel(self):
        """Export policies to Excel file"""
        if not self.tree or not self.all_policies:
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
            # Get current displayed policies from tree
            displayed_items = self.tree.get_children()
            if not displayed_items:
                messagebox.showwarning("Warning", "No data to export.")
                return

            # Prepare data
            columns = ["Policy Number", "Status", "Premium", "Effective From", "Effective To", "Created", "Deleted"]
            rows = []

            for item in displayed_items:
                values = self.tree.item(item)["values"]
                rows.append(list(values))

            # Export using DataExporter
            if DataExporter.export_to_excel(filename, columns, rows):
                messagebox.showinfo("Success", f"Data exported to {filename}")
                logger.info(f"Exported {len(rows)} policies to Excel")
            else:
                messagebox.showerror("Error", "Failed to export data. Make sure openpyxl is installed.")

        except Exception as e:
            logger.error(f"Export error: {e}")
            messagebox.showerror("Error", f"Failed to export data: {e}")


