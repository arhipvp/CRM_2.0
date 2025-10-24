"""Payments management tab component"""
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from threading import Thread
from typing import Optional, List, Dict, Any

from crm_service import CRMService
from logger import logger
from detail_dialogs import PaymentDetailDialog
from edit_dialogs import PaymentEditDialog
from search_utils import SearchFilter, DataExporter, search_filter_rows


class PaymentsTab:
    """Tab for viewing payments"""

    def __init__(self, parent: ttk.Frame, crm_service: CRMService):
        self.parent = parent
        self.crm_service = crm_service
        self.tree: Optional[ttk.Treeview] = None
        self.current_deal_id: Optional[str] = None
        self.payments = []
        self.all_payments = []  # Store all payments for filtering
        self.search_filter: Optional[SearchFilter] = None
        self.all_deals: List[Dict[str, Any]] = []
        self.all_policies: List[Dict[str, Any]] = []
        self.deal_dict = {}

        self._setup_ui()

    def _setup_ui(self):
        """Setup Payments tab UI"""
        # Deal selection frame
        select_frame = tk.Frame(self.parent)
        select_frame.pack(pady=5, padx=10, fill="x")

        tk.Label(select_frame, text="Select Deal:").pack(side="left", padx=5)
        self.deal_var = tk.StringVar()
        self.deal_combo = ttk.Combobox(select_frame, textvariable=self.deal_var, state="readonly", width=40)
        self.deal_combo.pack(side="left", padx=5, fill="x", expand=True)
        self.deal_combo.bind("<<ComboboxSelected>>", self._on_deal_selected)

        tk.Button(select_frame, text="Refresh Deals", command=self._load_deals).pack(side="left", padx=5)

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
            columns=("Date", "Type", "Amount", "Status", "Deleted"),
            show="headings"
        )
        self.tree.heading("Date", text="Date")
        self.tree.heading("Type", text="Type")
        self.tree.heading("Amount", text="Amount")
        self.tree.heading("Status", text="Status")
        self.tree.heading("Deleted", text="Deleted")

        self.tree.column("Date", width=100)
        self.tree.column("Type", width=100)
        self.tree.column("Amount", width=100)
        self.tree.column("Status", width=100)
        self.tree.column("Deleted", width=60)

        scrollbar = ttk.Scrollbar(tree_frame, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=scrollbar.set)

        self.tree.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        # Bind double-click to open detail dialog
        self.tree.bind("<Double-1>", self._on_tree_double_click)

        # Frame for buttons
        button_frame = tk.Frame(self.parent)
        button_frame.pack(pady=10)

        tk.Button(button_frame, text="Add Payment", command=self.add_payment).pack(side="left", padx=5)
        tk.Button(button_frame, text="Edit", command=self.edit_payment).pack(side="left", padx=5)
        tk.Button(button_frame, text="Delete", command=self.delete_payment).pack(side="left", padx=5)
        tk.Button(button_frame, text="Refresh", command=self._refresh_current_deal).pack(side="left", padx=5)
        tk.Button(button_frame, text="Export CSV", command=self.export_to_csv).pack(side="left", padx=5)
        tk.Button(button_frame, text="Export Excel", command=self.export_to_excel).pack(side="left", padx=5)

        # Load deals
        self._load_deals()

    def _load_deals(self):
        """Load deals for dropdown"""
        def worker():
            try:
                deals = self.crm_service.get_deals()
                policies = self.crm_service.get_policies()
                self.all_deals = deals
                self.all_policies = policies
                deal_dict = {deal.get("title", f"Deal {deal.get('id')}"): deal.get("id") for deal in deals}
                self.parent.after(0, self._update_deals_combo, deal_dict)
            except Exception as e:
                logger.error(f"Failed to fetch deals: {e}")

        Thread(target=worker, daemon=True).start()

    def _update_deals_combo(self, deal_dict: dict):
        """Update deals dropdown"""
        self.deal_dict = deal_dict
        self.deal_combo["values"] = list(deal_dict.keys())

    def _on_deal_selected(self, event=None):
        """Handle deal selection"""
        selected_deal = self.deal_var.get()
        if selected_deal and selected_deal in self.deal_dict:
            self.current_deal_id = self.deal_dict[selected_deal]
            self.refresh_payments()

    def _refresh_current_deal(self):
        """Refresh payments for current deal"""
        if self.current_deal_id:
            self.refresh_payments()
        else:
            messagebox.showwarning("Warning", "Please select a deal first.")

    def refresh_payments(self):
        """Refresh payments list for selected deal"""
        if not self.current_deal_id:
            messagebox.showwarning("Warning", "Please select a deal first.")
            return

        def worker():
            try:
                payments = self.crm_service.get_payments(self.current_deal_id)
                self.parent.after(0, self._update_tree_ui, payments)
            except Exception as e:
                logger.error(f"Failed to fetch payments: {e}")
                error_str = str(e)
                # Check if it's a 404 error - payments endpoint may not be fully implemented
                if "404" in error_str:
                    logger.info(f"Payments endpoint not implemented for this deal")
                    self.parent.after(0, self._update_tree_ui, [])
                else:
                    error_msg = error_str
                    self.parent.after(0, lambda: messagebox.showerror("Error", f"Failed to fetch payments: {error_msg}"))

        Thread(target=worker, daemon=True).start()

    def add_payment(self):
        """Add new payment"""
        if not self.current_deal_id:
            messagebox.showwarning("Warning", "Please select a deal first.")
            return

        dialog = PaymentEditDialog(self.parent, payment=None, deals_list=self.all_deals, policies_list=self.all_policies)
        if dialog.result:
            def worker():
                try:
                    self.crm_service.create_payment(**dialog.result)
                    self.parent.after(0, self.refresh_payments)
                    self.parent.after(0, lambda: messagebox.showinfo("Success", "Payment created successfully"))
                except Exception as e:
                    logger.error(f"Failed to create payment: {e}")
                    self.parent.after(0, lambda: messagebox.showerror("API Error", f"Failed to create payment: {e}"))

            Thread(target=worker, daemon=True).start()

    def edit_payment(self):
        """Edit selected payment"""
        if not self.tree:
            return
        selected_item = self.tree.focus()
        if not selected_item:
            messagebox.showwarning("Warning", "Please select a payment to edit.")
            return

        payment_id = selected_item
        # Find payment in list
        payment_data = next((p for p in self.payments if p.get("id") == payment_id), None)
        if not payment_data:
            messagebox.showerror("Error", "Payment not found.")
            return

        dialog = PaymentEditDialog(self.parent, payment=payment_data, deals_list=self.all_deals, policies_list=self.all_policies)
        if dialog.result:
            def worker():
                try:
                    self.crm_service.update_payment(payment_id, **dialog.result)
                    self.parent.after(0, self.refresh_payments)
                    self.parent.after(0, lambda: messagebox.showinfo("Success", "Payment updated successfully"))
                except Exception as e:
                    logger.error(f"Failed to update payment: {e}")
                    self.parent.after(0, lambda: messagebox.showerror("API Error", f"Failed to update payment: {e}"))

            Thread(target=worker, daemon=True).start()

    def delete_payment(self):
        """Delete selected payment"""
        if not self.tree:
            return
        selected_item = self.tree.focus()
        if not selected_item:
            messagebox.showwarning("Warning", "Please select a payment to delete.")
            return

        if messagebox.askyesno("Confirm Delete", "Are you sure you want to delete this payment?"):
            payment_id = selected_item

            def worker():
                try:
                    self.crm_service.delete_payment(payment_id)
                    self.parent.after(0, self.refresh_payments)
                    self.parent.after(0, lambda: messagebox.showinfo("Success", "Payment deleted successfully"))
                except Exception as e:
                    logger.error(f"Failed to delete payment: {e}")
                    self.parent.after(0, lambda: messagebox.showerror("API Error", f"Failed to delete payment: {e}"))

            Thread(target=worker, daemon=True).start()

    def _update_tree_ui(self, payments):
        """Update tree UI on main thread"""
        if not self.tree:
            return
        self.payments = payments
        self.all_payments = payments  # Store all payments for filtering
        self._refresh_tree_display(payments)

    def _refresh_tree_display(self, payments_to_display: List[Dict[str, Any]]):
        """Refresh tree display with given list of payments"""
        if not self.tree:
            return

        # Clear tree
        for i in self.tree.get_children():
            self.tree.delete(i)

        # Add payments
        for payment in payments_to_display:
            is_deleted = "Yes" if payment.get("is_deleted", False) else "No"
            self.tree.insert("", "end", iid=payment.get("id"), values=(
                payment.get("date", "N/A"),
                payment.get("type", "N/A"),
                payment.get("amount", "N/A"),
                payment.get("status", "N/A"),
                is_deleted
            ))

    def _on_search_change(self, search_text: str):
        """Handle search filter change"""
        if not self.all_payments:
            return

        # Filter payments by search text
        search_fields = ["type", "status"]
        filtered_payments = search_filter_rows(self.all_payments, search_text, search_fields)

        # Update tree display with filtered results
        self._refresh_tree_display(filtered_payments)

    def export_to_csv(self):
        """Export payments to CSV file"""
        if not self.tree or not self.all_payments:
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
            # Get current displayed payments from tree
            displayed_items = self.tree.get_children()
            if not displayed_items:
                messagebox.showwarning("Warning", "No data to export.")
                return

            # Prepare data
            columns = ["Date", "Type", "Amount", "Status", "Deleted"]
            rows = []

            for item in displayed_items:
                values = self.tree.item(item)["values"]
                rows.append(list(values))

            # Export using DataExporter
            if DataExporter.export_to_csv(filename, columns, rows):
                messagebox.showinfo("Success", f"Data exported to {filename}")
                logger.info(f"Exported {len(rows)} payments to CSV")
            else:
                messagebox.showerror("Error", "Failed to export data")

        except Exception as e:
            logger.error(f"Export error: {e}")
            messagebox.showerror("Error", f"Failed to export data: {e}")

    def export_to_excel(self):
        """Export payments to Excel file"""
        if not self.tree or not self.all_payments:
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
            # Get current displayed payments from tree
            displayed_items = self.tree.get_children()
            if not displayed_items:
                messagebox.showwarning("Warning", "No data to export.")
                return

            # Prepare data
            columns = ["Date", "Type", "Amount", "Status", "Deleted"]
            rows = []

            for item in displayed_items:
                values = self.tree.item(item)["values"]
                rows.append(list(values))

            # Export using DataExporter
            if DataExporter.export_to_excel(filename, columns, rows):
                messagebox.showinfo("Success", f"Data exported to {filename}")
                logger.info(f"Exported {len(rows)} payments to Excel")
            else:
                messagebox.showerror("Error", "Failed to export data. Make sure openpyxl is installed.")

        except Exception as e:
            logger.error(f"Export error: {e}")
            messagebox.showerror("Error", f"Failed to export data: {e}")

    def _on_tree_double_click(self, event):
        """Handle double-click on payment row to open detail dialog"""
        if not self.tree:
            return
        selected_item = self.tree.focus()
        if not selected_item:
            return

        payment_id = selected_item
        payment_data = next((p for p in self.payments if p.get("id") == payment_id), None)
        if payment_data:
            PaymentDetailDialog(self.parent, payment_data)
