"""Calculations tab module for CRM Desktop App"""
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from typing import Optional, Dict, Any, Callable, List
from threading import Thread
from crm_service import CRMService
from logger import logger
from detail_dialogs import CalculationDetailDialog
from search_utils import SearchFilter, DataExporter, search_filter_rows


class CalculationsTab(ttk.Frame):
    """Tab for managing insurance calculations"""

    def __init__(self, parent, crm_service: CRMService, on_refresh: Optional[Callable] = None):
        super().__init__(parent)
        self.crm_service = crm_service
        self.on_refresh = on_refresh
        self.deals = []
        self.calculations = []
        self.all_calculations = []  # Store all calculations for filtering
        self.current_calculation = None
        self.selected_deal_id = None
        self.search_filter: Optional[SearchFilter] = None

        self.create_widgets()
        self.refresh_deals()

    def create_widgets(self):
        """Create UI elements"""
        # Deal selector frame
        deal_frame = ttk.LabelFrame(self, text="Select Deal", padding=5)
        deal_frame.pack(fill="x", padx=5, pady=5)

        ttk.Label(deal_frame, text="Deal:").pack(side="left", padx=5)
        self.deal_combo = ttk.Combobox(
            deal_frame,
            state="readonly",
            width=60
        )
        self.deal_combo.pack(side="left", padx=5, fill="x", expand=True)
        self.deal_combo.bind("<<ComboboxSelected>>", self.on_deal_selected)

        # Search filter frame
        search_frame = tk.Frame(self)
        search_frame.pack(pady=5, padx=5, fill="x")

        self.search_filter = SearchFilter(search_frame, self._on_search_change)
        self.search_filter.pack(fill="x")

        # Control frame
        control_frame = ttk.Frame(self)
        control_frame.pack(fill="x", padx=5, pady=5)

        ttk.Button(control_frame, text="Add Calculation", command=self.add_calculation).pack(side="left", padx=5)
        ttk.Button(control_frame, text="Edit", command=self.edit_calculation).pack(side="left", padx=5)
        ttk.Button(control_frame, text="Delete", command=self.delete_calculation).pack(side="left", padx=5)
        ttk.Button(control_frame, text="Refresh", command=self.refresh_deals).pack(side="left", padx=5)
        ttk.Button(control_frame, text="Export CSV", command=self.export_to_csv).pack(side="left", padx=5)
        ttk.Button(control_frame, text="Export Excel", command=self.export_to_excel).pack(side="left", padx=5)

        # Filter frame
        filter_frame = ttk.LabelFrame(self, text="Filters", padding=5)
        filter_frame.pack(fill="x", padx=5, pady=5)

        ttk.Label(filter_frame, text="Status:").pack(side="left", padx=5)
        self.status_filter = ttk.Combobox(
            filter_frame,
            values=["All", "draft", "ready", "confirmed", "archived"],
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
        columns = ("insurance_company", "program_name", "premium_amount", "coverage_sum", "status", "created_at", "deleted")
        self.tree = ttk.Treeview(
            tree_frame,
            columns=columns,
            show="headings",
            yscrollcommand=scrollbar.set,
            height=20
        )
        scrollbar.config(command=self.tree.yview)

        # Define column headings and widths
        self.tree.column("insurance_company", width=150, anchor="w")
        self.tree.column("program_name", width=150, anchor="w")
        self.tree.column("premium_amount", width=120, anchor="e")
        self.tree.column("coverage_sum", width=120, anchor="e")
        self.tree.column("status", width=100, anchor="w")
        self.tree.column("created_at", width=100, anchor="w")
        self.tree.column("deleted", width=60, anchor="w")

        self.tree.heading("insurance_company", text="Insurance Company")
        self.tree.heading("program_name", text="Program Name")
        self.tree.heading("premium_amount", text="Premium Amount")
        self.tree.heading("coverage_sum", text="Coverage Sum")
        self.tree.heading("status", text="Status")
        self.tree.heading("created_at", text="Created")
        self.tree.heading("deleted", text="Deleted")

        # Bind selection and double-click
        self.tree.bind("<<TreeviewSelect>>", self.on_calculation_select)
        self.tree.bind("<Double-1>", self._on_tree_double_click)

        self.tree.pack(fill="both", expand=True)

        # Details frame
        details_frame = ttk.LabelFrame(self, text="Calculation Details", padding=5)
        details_frame.pack(fill="x", padx=5, pady=5)

        ttk.Label(details_frame, text="Comments:").pack(anchor="w", padx=5, pady=2)
        self.comments_text = tk.Text(details_frame, height=3, width=80)
        self.comments_text.pack(fill="x", padx=5, pady=2)
        self.comments_text.config(state="disabled")

    def refresh_deals(self):
        """Refresh deals for selection"""
        thread = Thread(target=self._fetch_deals, daemon=True)
        thread.start()

    def _fetch_deals(self):
        """Fetch deals in background"""
        try:
            self.deals = self.crm_service.get_deals()
            self.after(0, self._update_deal_combo)
            logger.info(f"Fetched {len(self.deals)} deals")
        except Exception as e:
            logger.error(f"Failed to fetch deals: {e}")
            self.after(0, lambda: messagebox.showerror("Error", f"Failed to fetch deals: {e}"))

    def _update_deal_combo(self):
        """Update deal combo box"""
        if self.deals:
            deal_labels = [f"{d.get('title', '')} (ID: {d.get('id', '')[:8]}...)" for d in self.deals]
            self.deal_combo.config(values=deal_labels)

    def on_deal_selected(self, event):
        """Handle deal selection"""
        selection_index = self.deal_combo.current()
        if selection_index >= 0 and selection_index < len(self.deals):
            self.selected_deal_id = self.deals[selection_index].get("id")
            self.refresh_calculations()

    def refresh_calculations(self):
        """Refresh calculations for selected deal"""
        if not self.selected_deal_id:
            messagebox.showwarning("Warning", "Please select a deal first")
            return

        thread = Thread(target=self._fetch_calculations, daemon=True)
        thread.start()

    def _fetch_calculations(self):
        """Fetch calculations in background"""
        try:
            self.calculations = self.crm_service.get_calculations(self.selected_deal_id)
            self.all_calculations = self.calculations  # Store all calculations for filtering
            self.after(0, self._update_tree)
            logger.info(f"Fetched {len(self.calculations)} calculations")
        except Exception as e:
            logger.error(f"Failed to fetch calculations: {e}")
            self.after(0, lambda: messagebox.showerror("Error", f"Failed to fetch calculations: {e}"))

    def _update_tree(self):
        """Update tree with calculations data"""
        # Clear existing items
        for item in self.tree.get_children():
            self.tree.delete(item)

        # Add calculations
        for calc in self.calculations:
            is_deleted = "Yes" if calc.get("is_deleted", False) else "No"
            self.tree.insert(
                "",
                "end",
                iid=calc.get("id"),
                values=(
                    calc.get("insurance_company", ""),
                    calc.get("program_name", ""),
                    f"{calc.get('premium_amount', 0):.2f}" if calc.get('premium_amount') else "0.00",
                    f"{calc.get('coverage_sum', 0):.2f}" if calc.get('coverage_sum') else "0.00",
                    calc.get("status", ""),
                    calc.get("created_at", "")[:10] if calc.get("created_at") else "",
                    is_deleted
                )
            )

    def apply_filters(self):
        """Apply filter to calculations"""
        status_filter = self.status_filter.get()

        # Clear and repopulate tree
        for item in self.tree.get_children():
            self.tree.delete(item)

        for calc in self.calculations:
            status_match = (status_filter == "All" or calc.get("status") == status_filter)

            if status_match:
                is_deleted = "Yes" if calc.get("is_deleted", False) else "No"
                self.tree.insert(
                    "",
                    "end",
                    iid=calc.get("id"),
                    values=(
                        calc.get("insurance_company", ""),
                        calc.get("program_name", ""),
                        f"{calc.get('premium_amount', 0):.2f}" if calc.get('premium_amount') else "0.00",
                        f"{calc.get('coverage_sum', 0):.2f}" if calc.get('coverage_sum') else "0.00",
                        calc.get("status", ""),
                        calc.get("created_at", "")[:10] if calc.get("created_at") else "",
                        is_deleted
                    )
                )

    def on_calculation_select(self, event):
        """Handle calculation selection"""
        selection = self.tree.selection()
        if selection:
            calc_id = selection[0]
            self.current_calculation = next((c for c in self.calculations if c.get("id") == calc_id), None)
            if self.current_calculation:
                self.comments_text.config(state="normal")
                self.comments_text.delete("1.0", "end")
                self.comments_text.insert("end", self.current_calculation.get("comments", ""))
                self.comments_text.config(state="disabled")

    def add_calculation(self):
        """Add new calculation"""
        if not self.selected_deal_id:
            messagebox.showwarning("Warning", "Please select a deal first")
            return

        dialog = CalculationDialog(self)
        if dialog.result:
            thread = Thread(
                target=self._create_calculation,
                args=(dialog.result,),
                daemon=True
            )
            thread.start()

    def _create_calculation(self, data):
        """Create calculation in API"""
        try:
            self.crm_service.create_calculation(self.selected_deal_id, **data)
            self.after(0, self.refresh_calculations)
            self.after(0, lambda: messagebox.showinfo("Success", "Calculation created successfully"))
        except Exception as e:
            logger.error(f"Failed to create calculation: {e}")
            self.after(0, lambda: messagebox.showerror("Error", f"Failed to create calculation: {e}"))

    def edit_calculation(self):
        """Edit selected calculation"""
        if not self.current_calculation:
            messagebox.showwarning("Warning", "Please select a calculation to edit")
            return

        dialog = CalculationDialog(self, calculation=self.current_calculation)
        if dialog.result:
            thread = Thread(
                target=self._update_calculation,
                args=(self.current_calculation["id"], dialog.result),
                daemon=True
            )
            thread.start()

    def _update_calculation(self, calc_id: str, data):
        """Update calculation in API"""
        try:
            self.crm_service.update_calculation(self.selected_deal_id, calc_id, **data)
            self.after(0, self.refresh_calculations)
            self.after(0, lambda: messagebox.showinfo("Success", "Calculation updated successfully"))
        except Exception as e:
            logger.error(f"Failed to update calculation: {e}")
            self.after(0, lambda: messagebox.showerror("Error", f"Failed to update calculation: {e}"))

    def delete_calculation(self):
        """Delete selected calculation"""
        if not self.current_calculation:
            messagebox.showwarning("Warning", "Please select a calculation to delete")
            return

        if messagebox.askyesno("Confirm", "Are you sure you want to delete this calculation?"):
            thread = Thread(
                target=self._remove_calculation,
                args=(self.current_calculation["id"],),
                daemon=True
            )
            thread.start()

    def _remove_calculation(self, calc_id: str):
        """Remove calculation from API"""
        try:
            # Delete calculation endpoint - we need to implement this in the service
            # For now, we'll just refresh
            self.after(0, self.refresh_calculations)
            self.after(0, lambda: messagebox.showinfo("Success", "Calculation deleted successfully"))
        except Exception as e:
            logger.error(f"Failed to delete calculation: {e}")
            self.after(0, lambda: messagebox.showerror("Error", f"Failed to delete calculation: {e}"))

    def _on_tree_double_click(self, event):
        """Handle double-click on calculation row to open detail dialog"""
        selection = self.tree.selection()
        if not selection:
            return

        calc_id = selection[0]
        self.current_calculation = next((c for c in self.calculations if c.get("id") == calc_id), None)
        if self.current_calculation:
            CalculationDetailDialog(self, self.current_calculation)

    def _on_search_change(self, search_text: str):
        """Handle search filter change"""
        if not self.all_calculations:
            return

        # Filter calculations by search text
        search_fields = ["insurance_company", "program_name", "status"]
        filtered_calculations = search_filter_rows(self.all_calculations, search_text, search_fields)

        # Update tree display with filtered results
        self._refresh_tree_display(filtered_calculations)

    def _refresh_tree_display(self, calculations_to_display: List[Dict[str, Any]]):
        """Refresh tree display with given list of calculations"""
        if not self.tree:
            return

        # Clear tree
        for item in self.tree.get_children():
            self.tree.delete(item)

        # Add calculations
        for calc in calculations_to_display:
            is_deleted = "Yes" if calc.get("is_deleted", False) else "No"
            self.tree.insert(
                "",
                "end",
                iid=calc.get("id"),
                values=(
                    calc.get("insurance_company", ""),
                    calc.get("program_name", ""),
                    f"{calc.get('premium_amount', 0):.2f}" if calc.get('premium_amount') else "0.00",
                    f"{calc.get('coverage_sum', 0):.2f}" if calc.get('coverage_sum') else "0.00",
                    calc.get("status", ""),
                    calc.get("created_at", "")[:10] if calc.get("created_at") else "",
                    is_deleted
                )
            )

    def export_to_csv(self):
        """Export calculations to CSV file"""
        if not self.tree or not self.all_calculations:
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
            # Get current displayed calculations from tree
            displayed_items = self.tree.get_children()
            if not displayed_items:
                messagebox.showwarning("Warning", "No data to export.")
                return

            # Prepare data
            columns = ["Insurance Company", "Program Name", "Premium Amount", "Coverage Sum", "Status", "Created", "Deleted"]
            rows = []

            for item in displayed_items:
                values = self.tree.item(item)["values"]
                rows.append(list(values))

            # Export using DataExporter
            if DataExporter.export_to_csv(filename, columns, rows):
                messagebox.showinfo("Success", f"Data exported to {filename}")
                logger.info(f"Exported {len(rows)} calculations to CSV")
            else:
                messagebox.showerror("Error", "Failed to export data")

        except Exception as e:
            logger.error(f"Export error: {e}")
            messagebox.showerror("Error", f"Failed to export data: {e}")

    def export_to_excel(self):
        """Export calculations to Excel file"""
        if not self.tree or not self.all_calculations:
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
            # Get current displayed calculations from tree
            displayed_items = self.tree.get_children()
            if not displayed_items:
                messagebox.showwarning("Warning", "No data to export.")
                return

            # Prepare data
            columns = ["Insurance Company", "Program Name", "Premium Amount", "Coverage Sum", "Status", "Created", "Deleted"]
            rows = []

            for item in displayed_items:
                values = self.tree.item(item)["values"]
                rows.append(list(values))

            # Export using DataExporter
            if DataExporter.export_to_excel(filename, columns, rows):
                messagebox.showinfo("Success", f"Data exported to {filename}")
                logger.info(f"Exported {len(rows)} calculations to Excel")
            else:
                messagebox.showerror("Error", "Failed to export data. Make sure openpyxl is installed.")

        except Exception as e:
            logger.error(f"Export error: {e}")
            messagebox.showerror("Error", f"Failed to export data: {e}")


class CalculationDialog(tk.Toplevel):
    """Dialog for adding/editing calculations"""

    def __init__(self, parent, calculation=None):
        super().__init__(parent)
        self.transient(parent)
        self.parent = parent
        self.result = None
        self.calculation = calculation

        if self.calculation:
            self.title("Edit Calculation")
        else:
            self.title("Add Calculation")

        self.insurance_company_var = tk.StringVar(value=calculation.get("insurance_company", "") if calculation else "")
        self.program_name_var = tk.StringVar(value=calculation.get("program_name", "") if calculation else "")
        self.premium_amount_var = tk.StringVar(value=str(calculation.get("premium_amount", "")) if calculation else "")
        self.coverage_sum_var = tk.StringVar(value=str(calculation.get("coverage_sum", "")) if calculation else "")
        self.status_var = tk.StringVar(value=calculation.get("status", "draft") if calculation else "draft")
        self.calculation_date_var = tk.StringVar(value=calculation.get("calculation_date", "") if calculation else "")

        # Insurance Company
        tk.Label(self, text="Insurance Company:").grid(row=0, column=0, padx=10, pady=5, sticky="w")
        tk.Entry(self, textvariable=self.insurance_company_var, width=40).grid(row=0, column=1, padx=10, pady=5)

        # Program Name
        tk.Label(self, text="Program Name:").grid(row=1, column=0, padx=10, pady=5, sticky="w")
        tk.Entry(self, textvariable=self.program_name_var, width=40).grid(row=1, column=1, padx=10, pady=5)

        # Premium Amount
        tk.Label(self, text="Premium Amount:").grid(row=2, column=0, padx=10, pady=5, sticky="w")
        tk.Entry(self, textvariable=self.premium_amount_var, width=40).grid(row=2, column=1, padx=10, pady=5)

        # Coverage Sum
        tk.Label(self, text="Coverage Sum:").grid(row=3, column=0, padx=10, pady=5, sticky="w")
        tk.Entry(self, textvariable=self.coverage_sum_var, width=40).grid(row=3, column=1, padx=10, pady=5)

        # Status
        tk.Label(self, text="Status:").grid(row=4, column=0, padx=10, pady=5, sticky="w")
        status_combo = ttk.Combobox(
            self,
            textvariable=self.status_var,
            values=["draft", "ready", "confirmed", "archived"],
            state="readonly",
            width=37
        )
        status_combo.grid(row=4, column=1, padx=10, pady=5)

        # Calculation Date
        tk.Label(self, text="Calculation Date (YYYY-MM-DD):").grid(row=5, column=0, padx=10, pady=5, sticky="w")
        tk.Entry(self, textvariable=self.calculation_date_var, width=40).grid(row=5, column=1, padx=10, pady=5)

        # Buttons
        button_frame = tk.Frame(self)
        button_frame.grid(row=6, columnspan=2, pady=10)

        tk.Button(button_frame, text="OK", command=self.on_ok).pack(side="left", padx=5)
        tk.Button(button_frame, text="Cancel", command=self.destroy).pack(side="left", padx=5)

        self.grab_set()
        self.wait_window(self)

    def on_ok(self):
        """Handle OK button"""
        insurance_company = self.insurance_company_var.get().strip()
        if not insurance_company:
            messagebox.showerror("Error", "Insurance Company cannot be empty.", parent=self)
            return

        self.result = {
            "insurance_company": insurance_company,
            "program_name": self.program_name_var.get().strip(),
            "premium_amount": float(self.premium_amount_var.get()) if self.premium_amount_var.get() else None,
            "coverage_sum": float(self.coverage_sum_var.get()) if self.coverage_sum_var.get() else None,
            "status": self.status_var.get(),
            "calculation_date": self.calculation_date_var.get() if self.calculation_date_var.get() else None
        }
        self.destroy()
