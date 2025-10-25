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
from table_sort_utils import treeview_sort_column


class PaymentsTab:
    """Tab for viewing payments"""

    def __init__(self, parent: ttk.Frame, crm_service: CRMService):
        self.parent = parent
        self.crm_service = crm_service
        self.tree: Optional[ttk.Treeview] = None
        self.current_deal_id: Optional[str] = None
        self.payments: List[Dict[str, Any]] = []
        self.all_payments: List[Dict[str, Any]] = []  # Store all payments for filtering
        self.search_filter: Optional[SearchFilter] = None
        self.all_deals: List[Dict[str, Any]] = []
        self.current_policies: List[Dict[str, Any]] = []
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

        columns = (
            "ID", "Deal ID", "Policy ID", "Sequence", "Status",
            "Planned Date", "Actual Date", "Planned Amount", "Currency", "Comment",
            "Recorded By ID", "Created By ID", "Updated By ID", "Incomes Total",
            "Expenses Total", "Net Total", "Created At", "Updated At"
        )
        self.tree = ttk.Treeview(
            tree_frame,
            columns=columns,
            show="headings"
        )

        for col in columns:
            self.tree.heading(col, text=col, command=lambda c=col: self._on_tree_sort(c))

        self.tree.column("ID", width=100)
        self.tree.column("Deal ID", width=100)
        self.tree.column("Policy ID", width=100)
        self.tree.column("Sequence", width=80)
        self.tree.column("Status", width=100)
        self.tree.column("Planned Date", width=100)
        self.tree.column("Actual Date", width=100)
        self.tree.column("Planned Amount", width=120)
        self.tree.column("Currency", width=80)
        self.tree.column("Comment", width=200)
        self.tree.column("Recorded By ID", width=100)
        self.tree.column("Created By ID", width=100)
        self.tree.column("Updated By ID", width=100)
        self.tree.column("Incomes Total", width=120)
        self.tree.column("Expenses Total", width=120)
        self.tree.column("Net Total", width=120)
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

        tk.Button(button_frame, text="Add Payment", command=self.add_payment).pack(side="left", padx=5)
        tk.Button(button_frame, text="Edit", command=self.edit_payment).pack(side="left", padx=5)
        tk.Button(button_frame, text="Delete", command=self.delete_payment).pack(side="left", padx=5)
        tk.Button(button_frame, text="Refresh", command=self._refresh_current_deal).pack(side="left", padx=5)
        tk.Button(button_frame, text="Export CSV", command=self.export_to_csv).pack(side="left", padx=5)
        tk.Button(button_frame, text="Export Excel", command=self.export_to_excel).pack(side="left", padx=5)

        # Load deals
        self._load_deals()

    def _on_tree_sort(self, col):
        display_map = {
            "ID": "id",
            "Deal ID": "deal_id",
            "Policy ID": "policy_id",
            "Sequence": "sequence",
            "Status": "status",
            "Planned Date": "planned_date",
            "Actual Date": "actual_date",
            "Planned Amount": "planned_amount",
            "Currency": "currency",
            "Comment": "comment",
            "Recorded By ID": "recorded_by_id",
            "Created By ID": "created_by_id",
            "Updated By ID": "updated_by_id",
            "Incomes Total": "incomes_total",
            "Expenses Total": "expenses_total",
            "Net Total": "net_total",
            "Created At": "created_at",
            "Updated At": "updated_at",
        }
        treeview_sort_column(self.tree, col, False, self.all_payments, display_map)

    def _load_deals(self):
        """Load deals for dropdown"""
        def worker():
            try:
                deals = self.crm_service.get_deals()
                self.all_deals = deals
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
            payments = []
            policies = []
            payment_error: Optional[Exception] = None
            policies_error: Optional[Exception] = None

            try:
                payments = self.crm_service.get_payments(self.current_deal_id)
            except Exception as e:
                payment_error = e

            try:
                policies = self.crm_service.get_deal_policies(self.current_deal_id)
            except Exception as e:
                policies_error = e
                logger.error(f"Failed to fetch policies for deal {self.current_deal_id}: {e}")

            def update_ui():
                payments_to_display = payments if payment_error is None else []
                policies_to_use = policies if policies_error is None else []
                self._update_tree_ui(payments_to_display, policies_to_use)

                if payment_error is not None:
                    error_str = str(payment_error)
                    if "404" in error_str:
                        logger.info("Payments endpoint not implemented for this deal")
                    else:
                        messagebox.showerror("Error", f"Failed to fetch payments: {error_str}")

            self.parent.after(0, update_ui)

        Thread(target=worker, daemon=True).start()

    def add_payment(self):
        """Add new payment"""
        if not self.current_deal_id:
            messagebox.showwarning("Warning", "Please select a deal first.")
            return

        dialog = PaymentEditDialog(self.parent, payment=None, deals_list=self.all_deals, policies_list=self.current_policies)
        if dialog.result:
            def worker():
                try:
                    payment = self.crm_service.create_payment(**dialog.result)
                    self.parent.after(0, lambda: self._handle_payment_saved(payment, message="Payment created successfully"))
                except Exception as e:
                    logger.error(f"Failed to create payment: {e}")
                    error_msg = str(e)
                    self.parent.after(0, lambda: messagebox.showerror("API Error", f"Failed to create payment: {error_msg}"))

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

        dialog = PaymentEditDialog(self.parent, payment=payment_data, deals_list=self.all_deals, policies_list=self.current_policies)
        if dialog.result:
            def worker():
                try:
                    payment = self.crm_service.update_payment(payment_id, **dialog.result)
                    self.parent.after(0, lambda: self._handle_payment_saved(payment, message="Payment updated successfully"))
                except Exception as e:
                    logger.error(f"Failed to update payment: {e}")
                    error_msg = str(e)
                    self.parent.after(0, lambda: messagebox.showerror("API Error", f"Failed to update payment: {error_msg}"))

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
                    error_msg = str(e)
                    self.parent.after(0, lambda: messagebox.showerror("API Error", f"Failed to delete payment: {error_msg}"))

            Thread(target=worker, daemon=True).start()

    def _update_tree_ui(self, payments, policies=None):
        """Update tree UI on main thread"""
        if not self.tree:
            return
        normalized = [self._normalize_payment(payment) for payment in payments]
        self.payments = normalized
        self.all_payments = list(normalized)  # Store all payments for filtering
        self._refresh_tree_display(normalized)

    def _refresh_tree_display(self, payments_to_display: List[Dict[str, Any]]):
        """Refresh tree display with given list of payments"""
        if not self.tree:
            return

        # Clear tree
        for i in self.tree.get_children():
            self.tree.delete(i)

        # Add payments
        for payment in payments_to_display:
            self.tree.insert("", "end", iid=payment.get("id"), values=(
                str(payment.get("id", "N/A"))[:8],
                str(payment.get("deal_id", "N/A"))[:8],
                str(payment.get("policy_id", "N/A"))[:8],
                payment.get("sequence", "N/A"),
                payment.get("status", "N/A"),
                payment.get("planned_date", "N/A"),
                payment.get("actual_date", "N/A"),
                self._format_amount(payment.get("planned_amount")),
                payment.get("currency", "N/A"),
                payment.get("comment", "N/A"),
                str(payment.get("recorded_by_id", "N/A"))[:8],
                str(payment.get("created_by_id", "N/A"))[:8],
                str(payment.get("updated_by_id", "N/A"))[:8],
                self._format_amount(payment.get("incomes_total")),
                self._format_amount(payment.get("expenses_total")),
                self._format_amount(payment.get("net_total")),
                payment.get("created_at", "N/A"),
                payment.get("updated_at", "N/A"),
            ))

    def _handle_payment_saved(self, payment: Optional[Dict[str, Any]], message: Optional[str] = None,
                               refresh: bool = True):
        """Update UI after payment creation/update"""
        if payment:
            normalized = self._normalize_payment(payment)
            self._upsert_payment(normalized)
        if message:
            messagebox.showinfo("Success", message)
        if refresh and self.current_deal_id:
            self.refresh_payments()

    def _normalize_payment(self, payment: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize numeric fields for consistent formatting"""
        normalized = dict(payment or {})
        for field in ("planned_amount", "incomes_total", "expenses_total", "net_total"):
            normalized[field] = self._coerce_numeric(normalized.get(field))
        return normalized

    def _upsert_payment(self, payment: Dict[str, Any]):
        """Insert or update payment in local collections"""
        payment_id = payment.get("id")
        if not payment_id:
            return
        updated = False
        for index, existing in enumerate(self.payments):
            if existing.get("id") == payment_id:
                merged = existing.copy()
                merged.update(payment)
                self.payments[index] = merged
                updated = True
                break
        if not updated:
            self.payments.append(payment)
        self.all_payments = list(self.payments)
        self._refresh_tree_display(self.payments)

    @staticmethod
    def _coerce_numeric(value: Any) -> float:
        """Convert value to float for formatting"""
        if value is None or value == "":
            return 0.0
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return float(value)
        try:
            return float(str(value).replace(",", "."))
        except (TypeError, ValueError):
            return 0.0

    @staticmethod
    def _format_amount(value: Any) -> str:
        """Format numeric values for display"""
        number = PaymentsTab._coerce_numeric(value)
        return f"{number:.2f}"

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
            # Prepare data
            columns = [
                "ID", "Deal ID", "Policy ID", "Sequence", "Status",
                "Planned Date", "Actual Date", "Planned Amount", "Currency", "Comment",
                "Recorded By ID", "Created By ID", "Updated By ID", "Incomes Total",
                "Expenses Total", "Net Total", "Created At", "Updated At"
            ]
            rows = []

            for payment in self.all_payments:
                rows.append([
                    payment.get("id", "N/A")[:8],
                    payment.get("deal_id", "N/A")[:8],
                    payment.get("policy_id", "N/A")[:8],
                    payment.get("sequence", "N/A"),
                    payment.get("status", "N/A"),
                    payment.get("planned_date", "N/A"),
                    payment.get("actual_date", "N/A"),
                    f"{payment.get('planned_amount', 0):.2f}" if payment.get('planned_amount') else "0.00",
                    payment.get("currency", "N/A"),
                    payment.get("comment", "N/A"),
                    payment.get("recorded_by_id", "N/A")[:8],
                    payment.get("created_by_id", "N/A")[:8],
                    payment.get("updated_by_id", "N/A")[:8],
                    f"{payment.get('incomes_total', 0):.2f}" if payment.get('incomes_total') else "0.00",
                    f"{payment.get('expenses_total', 0):.2f}" if payment.get('expenses_total') else "0.00",
                    f"{payment.get('net_total', 0):.2f}" if payment.get('net_total') else "0.00",
                    payment.get("created_at", "N/A"),
                    payment.get("updated_at", "N/A"),
                ])

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
            # Prepare data
            columns = [
                "ID", "Deal ID", "Policy ID", "Sequence", "Status",
                "Planned Date", "Actual Date", "Planned Amount", "Currency", "Comment",
                "Recorded By ID", "Created By ID", "Updated By ID", "Incomes Total",
                "Expenses Total", "Net Total", "Created At", "Updated At"
            ]
            rows = []

            for payment in self.all_payments:
                rows.append([
                    payment.get("id", "N/A")[:8],
                    payment.get("deal_id", "N/A")[:8],
                    payment.get("policy_id", "N/A")[:8],
                    payment.get("sequence", "N/A"),
                    payment.get("status", "N/A"),
                    payment.get("planned_date", "N/A"),
                    payment.get("actual_date", "N/A"),
                    f"{payment.get('planned_amount', 0):.2f}" if payment.get('planned_amount') else "0.00",
                    payment.get("currency", "N/A"),
                    payment.get("comment", "N/A"),
                    payment.get("recorded_by_id", "N/A")[:8],
                    payment.get("created_by_id", "N/A")[:8],
                    payment.get("updated_by_id", "N/A")[:8],
                    f"{payment.get('incomes_total', 0):.2f}" if payment.get('incomes_total') else "0.00",
                    f"{payment.get('expenses_total', 0):.2f}" if payment.get('expenses_total') else "0.00",
                    f"{payment.get('net_total', 0):.2f}" if payment.get('net_total') else "0.00",
                    payment.get("created_at", "N/A"),
                    payment.get("updated_at", "N/A"),
                ])

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
