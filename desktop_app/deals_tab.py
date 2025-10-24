"""Deals management tab component with hierarchical structure"""
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from threading import Thread
from typing import Optional, List, Dict, Any

from crm_service import CRMService
from logger import logger
from detail_dialogs import DealDetailDialog
from edit_dialogs import DealEditDialog
from search_utils import SearchFilter, DataExporter, search_filter_rows
from i18n import i18n


class DealsTab:
    """Tab for managing deals with hierarchical view (policies, calculations, payments)"""

    def __init__(self, parent: ttk.Frame, crm_service: CRMService):
        self.parent = parent
        self.crm_service = crm_service
        self.tree: Optional[ttk.Treeview] = None
        self.search_filter: Optional[SearchFilter] = None
        self.all_deals: List[Dict[str, Any]] = []  # Store all deals for filtering
        self.all_clients: List[Dict[str, Any]] = []  # Store all clients for dropdowns
        self.selected_deal_id: Optional[str] = None

        self._setup_ui()
        self.refresh_tree()

    def _setup_ui(self):
        """Setup Deals tab UI with hierarchical tree structure"""
        # Search filter frame
        search_frame = tk.Frame(self.parent)
        search_frame.pack(pady=5, padx=10, fill="x")

        self.search_filter = SearchFilter(search_frame, self._on_search_change)
        self.search_filter.pack(fill="x")

        # Frame for Treeview and Scrollbar
        tree_frame = tk.Frame(self.parent)
        tree_frame.pack(pady=10, padx=10, fill="both", expand=True)

        # Create hierarchical Treeview (no columns, just text)
        self.tree = ttk.Treeview(
            tree_frame,
            columns=(),
            show="tree"
        )

        scrollbar = ttk.Scrollbar(tree_frame, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=scrollbar.set)

        self.tree.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        # Bind double-click to open detail dialog
        self.tree.bind("<Double-1>", self._on_tree_double_click)
        # Bind right-click to context menu (expand/collapse)
        self.tree.bind("<Button-3>", self._on_tree_right_click)

        # Frame for buttons
        button_frame = tk.Frame(self.parent)
        button_frame.pack(pady=10)

        tk.Button(button_frame, text=i18n("Add Deal"), command=self.add_deal).pack(side="left", padx=5)
        tk.Button(button_frame, text=i18n("Edit"), command=self.edit_deal).pack(side="left", padx=5)
        tk.Button(button_frame, text=i18n("Delete"), command=self.delete_deal).pack(side="left", padx=5)
        tk.Button(button_frame, text=i18n("Refresh"), command=self.refresh_tree).pack(side="left", padx=5)
        tk.Button(button_frame, text=i18n("Export CSV"), command=self.export_to_csv).pack(side="left", padx=5)
        tk.Button(button_frame, text=i18n("Export Excel"), command=self.export_to_excel).pack(side="left", padx=5)

        # Info frame at bottom
        info_frame = tk.Frame(self.parent)
        info_frame.pack(pady=5, padx=10, fill="x")
        self.info_label = tk.Label(info_frame, text=i18n("Select a deal to view its details"), fg="gray")
        self.info_label.pack(side="left")

    def refresh_tree(self):
        """Refresh deals list asynchronously"""
        def worker():
            try:
                # Load both deals and clients
                deals = self.crm_service.get_deals()
                clients = self.crm_service.get_clients()
                self.parent.after(0, self._update_tree_ui, deals, clients)
            except Exception as e:
                logger.error(f"Failed to fetch deals: {e}")
                error_msg = str(e)
                self.parent.after(0, lambda: messagebox.showerror(i18n("Error"), f"{i18n('Failed to fetch')} deals: {error_msg}"))

        Thread(target=worker, daemon=True).start()

    def _update_tree_ui(self, deals, clients=None):
        """Update tree UI on main thread"""
        if not self.tree:
            return

        # Store all data for filtering
        self.all_deals = deals
        if clients:
            self.all_clients = clients
        self._refresh_tree_display(deals)

    def _refresh_tree_display(self, deals_to_display: List[Dict[str, Any]]):
        """Refresh tree display with hierarchical structure"""
        if not self.tree:
            return

        # Clear tree
        for i in self.tree.get_children():
            self.tree.delete(i)

        # Add deals with hierarchical children
        for deal in deals_to_display:
            is_deleted = "✓" if deal.get("is_deleted", False) else ""
            deal_id = deal.get("id", "")

            # Main deal node
            deal_text = (
                f"{deal.get('title', 'N/A')} | "
                f"{i18n('Status')}: {deal.get('status', 'N/A')} | "
                f"{i18n('Amount')}: {deal.get('amount', 'N/A')} "
                f"{is_deleted}"
            )
            deal_item = self.tree.insert("", "end", iid=deal_id, text=deal_text, open=False)

            # Add placeholder children that will be loaded on expand
            # This makes the tree appear expandable
            self.tree.insert(deal_item, "end", text=f"📋 {i18n('Policies')}...", tags=("policies_group",))
            self.tree.insert(deal_item, "end", text=f"📊 {i18n('Calculations')}...", tags=("calculations_group",))
            self.tree.insert(deal_item, "end", text=f"💰 {i18n('Payments')}...", tags=("payments_group",))

        # Bind expand event to load actual data
        self.tree.bind("<<TreeviewOpen>>", self._on_expand_node)

    def _on_expand_node(self, event):
        """Load child data when node is expanded"""
        selected = self.tree.focus()
        if not selected:
            return

        # Check if this is a deal node (has 3 placeholder children)
        children = self.tree.get_children(selected)
        if len(children) != 3:
            return  # Not a deal node

        # Check if we already loaded data (no placeholder children)
        first_child_text = self.tree.item(children[0])["text"]
        if "..." not in first_child_text:
            return  # Already loaded

        # Load actual data
        deal_id = selected
        self._load_deal_children(deal_id)

    def _load_deal_children(self, deal_id: str):
        """Load policies, calculations, and payments for a deal"""
        def worker():
            try:
                policies = self.crm_service.get_policies()  # Get all policies (filter by deal if needed)
                calculations = self.crm_service.get_calculations(deal_id)
                payments = self.crm_service.get_payments(deal_id)
                self.parent.after(0, self._populate_deal_children, deal_id, policies, calculations, payments)
            except Exception as e:
                logger.error(f"Failed to load deal children: {e}")

        Thread(target=worker, daemon=True).start()

    def _populate_deal_children(self, deal_id: str, policies: List, calculations: List, payments: List):
        """Populate deal node with actual policies, calculations, and payments"""
        if not self.tree:
            return

        try:
            deal_item = self.tree.selection()[0] if self.tree.selection() else deal_id
        except:
            return

        # Clear placeholder children
        children = self.tree.get_children(deal_item)
        for child in children:
            self.tree.delete(child)

        # Add Policies section
        policies_node = self.tree.insert(deal_item, "end", text=f"📋 {i18n('Policies')} ({len(policies)})", tags=("section",))
        for policy in policies:
            status = policy.get("status", "N/A")
            premium = policy.get("premium", "N/A")
            self.tree.insert(policies_node, "end", text=f"  • {policy.get('policy_number', 'N/A')} | {i18n('Status')}: {status} | {i18n('Premium')}: {premium}")

        # Add Calculations section
        calculations_node = self.tree.insert(deal_item, "end", text=f"📊 {i18n('Calculations')} ({len(calculations)})", tags=("section",))
        for calc in calculations:
            company = calc.get("insurance_company", "N/A")
            amount = calc.get("premium_amount", "N/A")
            self.tree.insert(calculations_node, "end", text=f"  • {company} | {amount}")

        # Add Payments section
        payments_node = self.tree.insert(deal_item, "end", text=f"💰 {i18n('Payments')} ({len(payments)})", tags=("section",))
        for payment in payments:
            amount = payment.get("amount", "N/A")
            date = payment.get("payment_date", "N/A")
            status = payment.get("status", "N/A")
            self.tree.insert(payments_node, "end", text=f"  • {date} | {amount} | {status}")

    def _on_tree_right_click(self, event):
        """Handle right-click context menu"""
        item = self.tree.identify("item", event.x, event.y)
        if item:
            self.tree.selection_set(item)
            # Simple context menu - just show info
            logger.info(f"Right-clicked on: {self.tree.item(item)['text']}")

    def add_deal(self):
        """Add new deal"""
        dialog = DealEditDialog(self.parent, self.crm_service, deal=None, clients_list=self.all_clients)
        if dialog.result:
            def worker():
                try:
                    self.crm_service.create_deal(**dialog.result)
                    self.parent.after(0, self.refresh_tree)
                    self.parent.after(0, lambda: messagebox.showinfo(i18n("Success"), i18n("Deal created successfully")))
                except Exception as e:
                    logger.error(f"Failed to create deal: {e}")
                    error_msg = str(e)
                    self.parent.after(0, lambda: messagebox.showerror(i18n("API Error"), f"Failed to create deal: {error_msg}"))

            Thread(target=worker, daemon=True).start()

    def edit_deal(self):
        """Edit selected deal"""
        if not self.tree:
            return
        try:
            selected_item = self.tree.selection()[0]
        except:
            messagebox.showwarning(i18n("Warning"), i18n("Please select a deal to edit"))
            return

        # Check if it's a deal (not a child node)
        parent = self.tree.parent(selected_item)
        if parent:
            messagebox.showwarning(i18n("Warning"), i18n("Please select a deal, not a child item"))
            return

        deal_id = selected_item

        # Fetch current deal data asynchronously
        def fetch_and_edit():
            try:
                current_deal = self.crm_service.get_deal(deal_id)
                self.parent.after(0, lambda: self._show_edit_dialog(deal_id, current_deal))
            except Exception as e:
                logger.error(f"Failed to fetch deal for editing: {e}")
                error_msg = str(e)
                self.parent.after(0, lambda: messagebox.showerror(i18n("API Error"), f"Failed to fetch deal: {error_msg}"))

        Thread(target=fetch_and_edit, daemon=True).start()

    def _show_edit_dialog(self, deal_id, current_deal):
        """Show edit dialog on main thread"""
        dialog = DealEditDialog(self.parent, self.crm_service, deal=current_deal, clients_list=self.all_clients)
        if dialog.result:
            def worker():
                try:
                    self.crm_service.update_deal(deal_id, **dialog.result)
                    self.parent.after(0, self.refresh_tree)
                    self.parent.after(0, lambda: messagebox.showinfo(i18n("Success"), i18n("Deal updated successfully")))
                except Exception as e:
                    logger.error(f"Failed to update deal: {e}")
                    error_msg = str(e)
                    self.parent.after(0, lambda: messagebox.showerror(i18n("API Error"), f"Failed to update deal: {error_msg}"))

            Thread(target=worker, daemon=True).start()

    def delete_deal(self):
        """Delete selected deal"""
        if not self.tree:
            return
        try:
            selected_item = self.tree.selection()[0]
        except:
            messagebox.showwarning(i18n("Warning"), i18n("Please select a deal to delete"))
            return

        # Check if it's a deal (not a child node)
        parent = self.tree.parent(selected_item)
        if parent:
            messagebox.showwarning(i18n("Warning"), i18n("Please select a deal, not a child item"))
            return

        if messagebox.askyesno(i18n("Confirm Delete"), i18n("Are you sure you want to delete this")):
            deal_id = selected_item

            def worker():
                try:
                    self.crm_service.delete_deal(deal_id)
                    self.parent.after(0, self.refresh_tree)
                    self.parent.after(0, lambda: messagebox.showinfo(i18n("Success"), i18n("Deal deleted successfully")))
                except Exception as e:
                    logger.error(f"Failed to delete deal: {e}")
                    error_msg = str(e)
                    self.parent.after(0, lambda: messagebox.showerror(i18n("API Error"), f"Failed to delete deal: {error_msg}"))

            Thread(target=worker, daemon=True).start()

    def _on_search_change(self, search_text: str):
        """Handle search filter change"""
        if not self.all_deals:
            return

        # Filter deals by search text
        search_fields = ["title", "status"]
        filtered_deals = search_filter_rows(self.all_deals, search_text, search_fields)

        # Update tree display with filtered results
        self._refresh_tree_display(filtered_deals)

    def export_to_csv(self):
        """Export deals to CSV file (flat format)"""
        if not self.tree or not self.all_deals:
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
            # Prepare data from all_deals
            columns = [i18n("ID"), i18n("Title"), i18n("Client"), i18n("Status"), i18n("Amount"), i18n("Deleted")]
            rows = []

            for deal in self.all_deals:
                is_deleted = i18n("Yes") if deal.get("is_deleted", False) else i18n("No")
                rows.append([
                    deal.get("id", "")[:8],
                    deal.get("title", "N/A"),
                    deal.get("client_id", "N/A"),
                    deal.get("status", "N/A"),
                    deal.get("amount", "N/A"),
                    is_deleted
                ])

            # Export using DataExporter
            if DataExporter.export_to_csv(filename, columns, rows):
                messagebox.showinfo(i18n("Success"), i18n("Data exported to") + f" {filename}")
                logger.info(f"Exported {len(rows)} deals to CSV")
            else:
                messagebox.showerror(i18n("Error"), i18n("Failed to export data"))

        except Exception as e:
            logger.error(f"Export error: {e}")
            messagebox.showerror(i18n("Error"), i18n("Failed to export data") + f": {e}")

    def export_to_excel(self):
        """Export deals to Excel file (flat format)"""
        if not self.tree or not self.all_deals:
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
            # Prepare data from all_deals
            columns = [i18n("ID"), i18n("Title"), i18n("Client"), i18n("Status"), i18n("Amount"), i18n("Deleted")]
            rows = []

            for deal in self.all_deals:
                is_deleted = i18n("Yes") if deal.get("is_deleted", False) else i18n("No")
                rows.append([
                    deal.get("id", "")[:8],
                    deal.get("title", "N/A"),
                    deal.get("client_id", "N/A"),
                    deal.get("status", "N/A"),
                    deal.get("amount", "N/A"),
                    is_deleted
                ])

            # Export using DataExporter
            if DataExporter.export_to_excel(filename, columns, rows):
                messagebox.showinfo(i18n("Success"), i18n("Data exported to") + f" {filename}")
                logger.info(f"Exported {len(rows)} deals to Excel")
            else:
                messagebox.showerror(i18n("Error"), i18n("Failed to export data. Make sure openpyxl is installed."))

        except Exception as e:
            logger.error(f"Export error: {e}")
            messagebox.showerror(i18n("Error"), i18n("Failed to export data") + f": {e}")

    def _on_tree_double_click(self, event):
        """Handle double-click on deal row to open detail dialog"""
        if not self.tree:
            return
        try:
            selected_item = self.tree.selection()[0]
        except:
            return

        # Check if it's a deal (not a child node)
        parent = self.tree.parent(selected_item)
        if parent:
            return  # Clicked on child node, not a deal

        # Fetch full deal data
        deal_id = selected_item
        try:
            deal_data = self.crm_service.get_deal(deal_id)
            if deal_data:
                DealDetailDialog(self.parent, deal_data)
        except Exception as e:
            logger.error(f"Failed to fetch deal details: {e}")
            messagebox.showerror(i18n("Error"), f"Failed to fetch deal details: {e}")

    def refresh_data(self):
        """Public method to refresh data (called from main.py on tab change)"""
        self.refresh_tree()
