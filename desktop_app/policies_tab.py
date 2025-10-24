"""Policies management tab component"""
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from threading import Thread
from typing import Optional, List, Dict, Any

from crm_service import CRMService
from logger import logger
from detail_dialogs import PolicyDetailDialog
from edit_dialogs import PolicyEditDialog
from search_utils import SearchFilter, DataExporter, search_filter_rows
from i18n import i18n
from table_sort_utils import treeview_sort_column


class PoliciesTab:
    """Tab for managing policies"""

    def __init__(self, parent: ttk.Frame, crm_service: CRMService):
        self.parent = parent
        self.crm_service = crm_service
        self.tree: Optional[ttk.Treeview] = None
        self.search_filter: Optional[SearchFilter] = None
        self.all_policies: List[Dict[str, Any]] = []  # Store all policies for filtering
        self.all_clients: List[Dict[str, Any]] = []  # Store all clients for dropdowns
        self.all_deals: List[Dict[str, Any]] = []  # Store all deals for dropdowns

        self._setup_ui()
        self.refresh_tree()

    def _setup_ui(self):
        """Setup Policies tab UI"""
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

                        "ID", "Owner ID", "Deleted", "Client ID", "Deal ID",

                        "Policy Number", "Status", "Effective From", "Effective To",

                        "Created At", "Updated At"

                    ),

                    show="headings"

                )

        

                for col in (

                    "ID", "Owner ID", "Deleted", "Client ID", "Deal ID",

                    "Policy Number", "Status", "Effective From", "Effective To",

                    "Created At", "Updated At"

                ):

                    self.tree.heading(col, text=i18n(col), command=lambda c=col: self._on_tree_sort(c))

        

                self.tree.column("ID", width=50, anchor="center")

                self.tree.column("Owner ID", width=100)

                self.tree.column("Deleted", width=60)

                self.tree.column("Client ID", width=100)

                self.tree.column("Deal ID", width=100)

                self.tree.column("Policy Number", width=150)

                self.tree.column("Status", width=100)

                self.tree.column("Effective From", width=120)

                self.tree.column("Effective To", width=120)

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

        

                tk.Button(button_frame, text=i18n("Add Policy"), command=self.add_policy).pack(side="left", padx=5)

                tk.Button(button_frame, text=i18n("Edit"), command=self.edit_policy).pack(side="left", padx=5)

                tk.Button(button_frame, text=i18n("Delete"), command=self.delete_policy).pack(side="left", padx=5)

                tk.Button(button_frame, text=i18n("Refresh"), command=self.refresh_tree).pack(side="left", padx=5)

                tk.Button(button_frame, text=i18n("Export CSV"), command=self.export_to_csv).pack(side="left", padx=5)

                tk.Button(button_frame, text=i18n("Export Excel"), command=self.export_to_excel).pack(side="left", padx=5)

        

            def _on_tree_sort(self, col):

                display_map = {

                    "ID": "id",

                    "Owner ID": "owner_id",

                    "Deleted": "is_deleted",

                    "Client ID": "client_id",

                    "Deal ID": "deal_id",

                    "Policy Number": "policy_number",

                    "Status": "status",

                    "Effective From": "effective_from",

                    "Effective To": "effective_to",

                    "Created At": "created_at",

                    "Updated At": "updated_at",

                }

                treeview_sort_column(self.tree, col, False, self.all_policies, display_map)

        

            def refresh_tree(self):

                """Refresh policies list asynchronously"""

                def worker():

                    try:

                        # Load policies, clients, and deals

                        policies = self.crm_service.get_policies()

                        clients = self.crm_service.get_clients()

                        deals = self.crm_service.get_deals()

                        self.parent.after(0, self._update_tree_ui, policies, clients, deals)

                    except Exception as e:

                        logger.error(f"Failed to fetch policies: {e}")

                        error_msg = str(e)

                        self.parent.after(0, lambda: messagebox.showerror(i18n("Error"), f"{i18n('Failed to fetch')} policies: {error_msg}"))

        

                Thread(target=worker, daemon=True).start()

        

            def _update_tree_ui(self, policies, clients=None, deals=None):

                """Update tree UI on main thread"""

                if not self.tree:

                    return

        

                # Store all data for filtering

                self.all_policies = policies

                if clients:

                    self.all_clients = clients

                if deals:

                    self.all_deals = deals

                self._refresh_tree_display(policies)

        

            def _refresh_tree_display(self, policies_to_display: List[Dict[str, Any]]):

                """Refresh tree display with given list of policies"""

                if not self.tree:

                    return

        

                # Clear tree

                for i in self.tree.get_children():

                    self.tree.delete(i)

        

                # Add policies

                for policy in policies_to_display:

                    is_deleted = i18n("Yes") if policy.get("is_deleted", False) else i18n("No")

        

                    self.tree.insert("", "end", iid=policy.get("id"), values=(

                        str(policy.get("id", "N/A"))[:8],

                        str(policy.get("owner_id", "N/A"))[:8],

                        is_deleted,

                        str(policy.get("client_id", "N/A"))[:8],

                        str(policy.get("deal_id", "N/A"))[:8],

                        policy.get("policy_number", "N/A"),

                        policy.get("status", "N/A"),

                        policy.get("effective_from", "N/A"),

                        policy.get("effective_to", "N/A"),

                        policy.get("created_at", "N/A"),

                        policy.get("updated_at", "N/A"),

                    ))

        

            def add_policy(self):

                """Add new policy"""

                dialog = PolicyEditDialog(self.parent, policy=None, clients_list=self.all_clients, deals_list=self.all_deals)

                if dialog.result:

                    def worker():

                        try:

                            self.crm_service.create_policy(**dialog.result)

                            self.parent.after(0, self.refresh_tree)

                            self.parent.after(0, lambda: messagebox.showinfo(i18n("Success"), f"{i18n('Policy Number')} {i18n('created successfully')}"))

                        except Exception as e:

                            logger.error(f"Failed to create policy: {e}")

                            error_msg = str(e)

                            self.parent.after(0, lambda: messagebox.showerror(i18n("API Error"), f"{i18n('failed to create')} policy: {error_msg}"))

        

                    Thread(target=worker, daemon=True).start()

        

            def edit_policy(self):

                """Edit selected policy"""

                if not self.tree:

                    return

                selected_item = self.tree.focus()

                if not selected_item:

                    messagebox.showwarning(i18n("Warning"), i18n("Please select a policy to edit"))

                    return

        

                policy_id = selected_item

        

                # Fetch current policy data asynchronously

                def fetch_and_edit():

                    try:

                        current_policy = self.crm_service.get_policy(policy_id)

                        self.parent.after(0, lambda: self._show_edit_dialog(policy_id, current_policy))

                    except Exception as e:

                        logger.error(f"Failed to fetch policy for editing: {e}")

                        error_msg = str(e)

                        self.parent.after(0, lambda: messagebox.showerror(i18n("API Error"), f"{i18n('Failed to fetch')} policy: {error_msg}"))

        

                Thread(target=fetch_and_edit, daemon=True).start()

        

            def _show_edit_dialog(self, policy_id, current_policy):

                """Show edit dialog on main thread"""

                dialog = PolicyEditDialog(self.parent, policy=current_policy, clients_list=self.all_clients, deals_list=self.all_deals)

                if dialog.result:

                    def worker():

                        try:

                            self.crm_service.update_policy(policy_id, **dialog.result)

                            self.parent.after(0, self.refresh_tree)

                            self.parent.after(0, lambda: messagebox.showinfo(i18n("Success"), f"{i18n('Policy Number')} {i18n('updated successfully')}"))

                        except Exception as e:

                            logger.error(f"Failed to update policy: {e}")

                            error_msg = str(e)

                            self.parent.after(0, lambda: messagebox.showerror(i18n("API Error"), f"{i18n('failed to update')} policy: {error_msg}"))

        

                    Thread(target=worker, daemon=True).start()

        

            def delete_policy(self):

                """Delete selected policy"""

                if not self.tree:

                    return

                selected_item = self.tree.focus()

                if not selected_item:

                    messagebox.showwarning(i18n("Warning"), i18n("Please select a policy to delete"))

                    return

        

                if messagebox.askyesno(i18n("Confirm Delete"), f"{i18n('Are you sure you want to delete this')} policy?"):

                    policy_id = selected_item

        

                    def worker():

                        try:

                            self.crm_service.delete_policy(policy_id)

                            self.parent.after(0, self.refresh_tree)

                            self.parent.after(0, lambda: messagebox.showinfo(i18n("Success"), f"{i18n('Policy Number')} {i18n('deleted successfully')}"))

                        except Exception as e:

                            logger.error(f"Failed to delete policy: {e}")

                            error_msg = str(e)

                            self.parent.after(0, lambda: messagebox.showerror(i18n("API Error"), f"{i18n('failed to delete')} policy: {error_msg}"))

        

                    Thread(target=worker, daemon=True).start()

        

            def _on_search_change(self, search_text: str):

                """Handle search filter change"""

                if not self.all_policies:

                    return

        

                # Filter policies by search text

                search_fields = ["policy_number", "status"]

                filtered_policies = search_filter_rows(self.all_policies, search_text, search_fields)

        

                # Update tree display with filtered results

                self._refresh_tree_display(filtered_policies)

        

            def export_to_csv(self):

                """Export policies to CSV file"""

                if not self.tree or not self.all_policies:

                    messagebox.showwarning(i18n("Warning"), i18n("No data to export"))

                    return

        

                # Ask user for file location

                filename = filedialog.asksaveasfilename(

                    defaultextension=".csv",

                    filetypes=[("CSV files", "*.csv"), ("All files", "*.* ")]

                )

        

                if not filename:

                    return

        

                try:

                    # Prepare data

                    columns = [

                        i18n("ID"), i18n("Owner ID"), i18n("Deleted"), i18n("Client ID"), i18n("Deal ID"),

                        i18n("Policy Number"), i18n("Status"), i18n("Effective From"), i18n("Effective To"),

                        i18n("Created At"), i18n("Updated At")

                    ]

                    rows = []

        

                    for policy in self.all_policies:

                        is_deleted = i18n("Yes") if policy.get("is_deleted", False) else i18n("No")

                        rows.append([

                            str(policy.get("id", "N/A"))[:8],

                            str(policy.get("owner_id", "N/A"))[:8],

                            is_deleted,

                            str(policy.get("client_id", "N/A"))[:8],

                            str(policy.get("deal_id", "N/A"))[:8],

                            policy.get("policy_number", "N/A"),

                            policy.get("status", "N/A"),

                            policy.get("effective_from", "N/A"),

                            policy.get("effective_to", "N/A"),

                            policy.get("created_at", "N/A"),

                            policy.get("updated_at", "N/A"),

                        ])

        

                    # Export using DataExporter

                    if DataExporter.export_to_csv(filename, columns, rows):

                        messagebox.showinfo(i18n("Success"), f"{i18n('Data exported to')} {filename}")

                        logger.info(f"Exported {len(rows)} policies to CSV")

                    else:

                        messagebox.showerror(i18n("Error"), i18n("Failed to export data"))

        

                except Exception as e:

                    logger.error(f"Export error: {e}")

                    messagebox.showerror(i18n("Error"), f"{i18n('Failed to export data')}: {e}")

        

            def export_to_excel(self):

                """Export policies to Excel file"""

                if not self.tree or not self.all_policies:

                    messagebox.showwarning(i18n("Warning"), i18n("No data to export"))

                    return

        

                # Ask user for file location

                filename = filedialog.asksaveasfilename(

                    defaultextension=".xlsx",

                    filetypes=[("Excel files", "*.xlsx"), ("All files", "*.* ")]

                )

        

                if not filename:

                    return

        

                try:

                    # Prepare data

                    columns = [

                        i18n("ID"), i18n("Owner ID"), i18n("Deleted"), i18n("Client ID"), i18n("Deal ID"),

                        i18n("Policy Number"), i18n("Status"), i18n("Effective From"), i18n("Effective To"),

                        i18n("Created At"), i18n("Updated At")

                    ]

                    rows = []

        

                    for policy in self.all_policies:

                        is_deleted = i18n("Yes") if policy.get("is_deleted", False) else i18n("No")

                        rows.append([

                            str(policy.get("id", "N/A"))[:8],

                            str(policy.get("owner_id", "N/A"))[:8],

                            is_deleted,

                            str(policy.get("client_id", "N/A"))[:8],

                            str(policy.get("deal_id", "N/A"))[:8],

                            policy.get("policy_number", "N/A"),

                            policy.get("status", "N/A"),

                            policy.get("effective_from", "N/A"),

                            policy.get("effective_to", "N/A"),

                            policy.get("created_at", "N/A"),

                            policy.get("updated_at", "N/A"),

                        ])

        

                    # Export using DataExporter

                    if DataExporter.export_to_excel(filename, columns, rows):

                        messagebox.showinfo(i18n("Success"), f"{i18n('Data exported to')} {filename}")

                        logger.info(f"Exported {len(rows)} policies to Excel")

                    else:

                        messagebox.showerror(i18n("Error"), f"{i18n('Failed to export data')}. Make sure openpyxl is installed.")

        

                except Exception as e:

                    logger.error(f"Export error: {e}")

                    messagebox.showerror(i18n("Error"), f"{i18n('Failed to export data')}: {e}")

    def _on_tree_double_click(self, event):
        """Handle double-click on policy row to open detail dialog"""
        if not self.tree:
            return
        selected_item = self.tree.focus()
        if not selected_item:
            return

        # Fetch full policy data
        policy_id = selected_item
        try:
            policy_data = self.crm_service.get_policy(policy_id)
            if policy_data:
                PolicyDetailDialog(self.parent, policy_data)
        except Exception as e:
            logger.error(f"Failed to fetch policy details: {e}")
            messagebox.showerror(i18n("Error"), f"{i18n('Failed to fetch')} policy details: {e}")
