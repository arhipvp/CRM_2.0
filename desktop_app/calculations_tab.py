"""Calculations tab module for CRM Desktop App"""
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from typing import Optional, Dict, Any, List
from threading import Thread

from crm_service import CRMService
from logger import logger
from detail_dialogs import CalculationDetailDialog
from edit_dialogs import CalculationEditDialog
from search_utils import SearchFilter, DataExporter, search_filter_rows
from i18n import i18n
from table_sort_utils import treeview_sort_column
from document_utils import copy_files_to_deal_folder, open_deal_file, open_deal_folder


class CalculationsTab:
    """Tab for managing insurance calculations"""

    def __init__(self, parent: ttk.Frame, crm_service: CRMService):
        self.parent = parent
        self.crm_service = crm_service
        self.deals: List[Dict[str, Any]] = []
        self.all_calculations: List[Dict[str, Any]] = []  # Store all calculations for filtering
        self.current_calculation: Optional[Dict[str, Any]] = None
        self.selected_deal_id: Optional[str] = None
        self.search_filter: Optional[SearchFilter] = None
        self.tree: Optional[ttk.Treeview] = None
        self.deal_combo: Optional[ttk.Combobox] = None
        self.status_filter: Optional[ttk.Combobox] = None
        self.comments_text: Optional[tk.Text] = None

        self._setup_ui()
        self.refresh_deals()

    def _setup_ui(self):
        """Setup Calculations tab UI"""
        # Deal selector frame
        deal_frame = ttk.LabelFrame(self.parent, text=i18n("Select Deal"), padding=5)
        deal_frame.pack(fill="x", padx=5, pady=5)

        ttk.Label(deal_frame, text=f"{i18n('Deal')}:").pack(side="left", padx=5)
        self.deal_combo = ttk.Combobox(
            deal_frame,
            state="readonly",
            width=60
        )
        self.deal_combo.pack(side="left", padx=5, fill="x", expand=True)
        self.deal_combo.bind("<<ComboboxSelected>>", self._on_deal_selected)

        # Search filter frame
        search_frame = tk.Frame(self.parent)
        search_frame.pack(pady=5, padx=5, fill="x")

        self.search_filter = SearchFilter(search_frame, self._on_search_change)
        self.search_filter.pack(fill="x")

        # Control frame
        control_frame = ttk.Frame(self.parent)
        control_frame.pack(fill="x", padx=5, pady=5)

        tk.Button(control_frame, text=i18n("Add Calculation"), command=self.add_calculation).pack(side="left", padx=5)
        tk.Button(control_frame, text=i18n("Edit"), command=self.edit_calculation).pack(side="left", padx=5)
        tk.Button(control_frame, text=i18n("Delete"), command=self.delete_calculation).pack(side="left", padx=5)
        tk.Button(control_frame, text=i18n("Refresh"), command=self.refresh_deals).pack(side="left", padx=5)
        tk.Button(control_frame, text=i18n("Export CSV"), command=self.export_to_csv).pack(side="left", padx=5)
        tk.Button(control_frame, text=i18n("Export Excel"), command=self.export_to_excel).pack(side="left", padx=5)
        tk.Button(control_frame, text=i18n("Attach Document"), command=self.attach_document).pack(side="left", padx=5)
        tk.Button(control_frame, text=i18n("Open Document"), command=self.open_document).pack(side="left", padx=5)

        # Filter frame
        filter_frame = ttk.LabelFrame(self.parent, text=i18n("Filters"), padding=5)
        filter_frame.pack(fill="x", padx=5, pady=5)

        ttk.Label(filter_frame, text=f"{i18n('Status')}:").pack(side="left", padx=5)
        self.status_filter = ttk.Combobox(
            filter_frame,
            values=[i18n("All"), "draft", "ready", "confirmed", "archived"],
            state="readonly",
            width=15
        )
        self.status_filter.set(i18n("All"))
        self.status_filter.pack(side="left", padx=5)
        self.status_filter.bind("<<ComboboxSelected>>", lambda e: self._apply_filters())

        # Treeview frame
        tree_frame = ttk.Frame(self.parent)
        tree_frame.pack(fill="both", expand=True, padx=5, pady=5)

        # Scrollbar
        scrollbar = ttk.Scrollbar(tree_frame)
        scrollbar.pack(side="right", fill="y")

        # Treeview
        columns = (
            "ID", "Owner ID", "Deleted", "Deal ID",
            "Insurance Company", "Program Name", "Premium Amount", "Coverage Sum",
            "Calculation Date", "Validity Period", "Status", "Files", "Comments",
            "Created At", "Updated At"
        )
        self.tree = ttk.Treeview(
            tree_frame,
            columns=columns,
            show="headings",
            yscrollcommand=scrollbar.set
        )
        scrollbar.config(command=self.tree.yview)

        # Define column headings and widths
        for col in columns:
            self.tree.heading(col, text=i18n(col), command=lambda c=col: self._on_tree_sort(c))

        self.tree.column("ID", width=100, anchor="w")
        self.tree.column("Owner ID", width=100, anchor="w")
        self.tree.column("Deleted", width=60, anchor="w")
        self.tree.column("Deal ID", width=100, anchor="w")
        self.tree.column("Insurance Company", width=150, anchor="w")
        self.tree.column("Program Name", width=150, anchor="w")
        self.tree.column("Premium Amount", width=120, anchor="e")
        self.tree.column("Coverage Sum", width=120, anchor="e")
        self.tree.column("Calculation Date", width=100, anchor="w")
        self.tree.column("Validity Period", width=150, anchor="w")
        self.tree.column("Status", width=100, anchor="w")
        self.tree.column("Files", width=80, anchor="w")
        self.tree.column("Comments", width=200, anchor="w")
        self.tree.column("Created At", width=150, anchor="w")
        self.tree.column("Updated At", width=150, anchor="w")

        # Bind selection and double-click
        self.tree.bind("<<TreeviewSelect>>", self._on_calculation_select)
        self.tree.bind("<Double-1>", self._on_tree_double_click)

        self.tree.pack(fill="both", expand=True)

        # Details frame
        details_frame = ttk.LabelFrame(self.parent, text=i18n("Calculation Details"), padding=5)
        details_frame.pack(fill="x", padx=5, pady=5)

        ttk.Label(details_frame, text=f"{i18n('Comments')}:").pack(anchor="w", padx=5, pady=2)
        self.comments_text = tk.Text(details_frame, height=3, width=80)
        self.comments_text.pack(fill="x", padx=5, pady=2)
        self.comments_text.config(state="disabled")

    def _on_tree_sort(self, col):
        display_map = {
            "ID": "id",
            "Owner ID": "owner_id",
            "Deleted": "is_deleted",
            "Deal ID": "deal_id",
            "Insurance Company": "insurance_company",
            "Program Name": "program_name",
            "Premium Amount": "premium_amount",
            "Coverage Sum": "coverage_sum",
            "Calculation Date": "calculation_date",
            "Validity Period": "validity_period",
            "Status": "status",
            "Files": "files",
            "Comments": "comments",
            "Created At": "created_at",
            "Updated At": "updated_at",
        }
        treeview_sort_column(self.tree, col, False, self.all_calculations, display_map)

    def refresh_deals(self):
        """Refresh deals for selection asynchronously"""
        def worker():
            try:
                deals = self.crm_service.get_deals()
                self.parent.after(0, self._update_deals, deals)
            except Exception as e:
                logger.error(f"Failed to fetch deals: {e}")
                error_msg = str(e)
                self.parent.after(0, lambda: messagebox.showerror(i18n("Error"), f"{i18n('Failed to fetch')} deals: {error_msg}"))

        Thread(target=worker, daemon=True).start()

    def _update_deals(self, deals):
        """Update deals on main thread"""
        self.deals = deals
        self._update_deal_combo()

    def _update_deal_combo(self):
        """Update deal combo box"""
        if self.deal_combo and self.deals:
            deal_labels = [f"{d.get('title', '')} (ID: {d.get('id', '')[:8]}...)" for d in self.deals]
            self.deal_combo.config(values=deal_labels)

    def _on_deal_selected(self, event):
        """Handle deal selection"""
        if not self.deal_combo:
            return
        selection_index = self.deal_combo.current()
        if selection_index >= 0 and selection_index < len(self.deals):
            self.selected_deal_id = self.deals[selection_index].get("id")
            self.refresh_calculations()

    def refresh_calculations(self):
        """Refresh calculations for selected deal asynchronously"""
        if not self.selected_deal_id:
            messagebox.showwarning(i18n("Warning"), i18n("Please select a deal first"))
            return

        def worker():
            try:
                calculations = self.crm_service.get_calculations(self.selected_deal_id)
                self.parent.after(0, self._update_calculations_ui, calculations)
            except Exception as e:
                logger.error(f"Failed to fetch calculations: {e}")
                error_msg = str(e)
                self.parent.after(0, lambda: messagebox.showerror(i18n("Error"), f"{i18n('Failed to fetch')} calculations: {error_msg}"))

        Thread(target=worker, daemon=True).start()

    def _update_calculations_ui(self, calculations):
        """Update calculations UI on main thread"""
        if not self.tree:
            return

        # Store all data for filtering
        self.all_calculations = calculations
        self._refresh_tree_display(calculations)

    def _refresh_tree_display(self, calculations_to_display: List[Dict[str, Any]]):
        """Refresh tree display with given list of calculations"""
        if not self.tree:
            return

        # Clear tree
        for item in self.tree.get_children():
            self.tree.delete(item)

        # Add calculations
        for calc in calculations_to_display:
            is_deleted = i18n("Yes") if calc.get("is_deleted", False) else i18n("No")
            self.tree.insert(
                "",
                "end",
                iid=calc.get("id"),
                values=(
                    str(calc.get("id", "N/A"))[:8],
                    str(calc.get("owner_id", "N/A"))[:8],
                    is_deleted,
                    str(calc.get("deal_id", "N/A"))[:8],
                    calc.get("insurance_company", "N/A"),
                    calc.get("program_name", "N/A"),
                    f"{calc.get('premium_amount', 0):.2f}" if calc.get('premium_amount') else "0.00",
                    f"{calc.get('coverage_sum', 0):.2f}" if calc.get('coverage_sum') else "0.00",
                    calc.get("calculation_date", "N/A"),
                    str(calc.get("validity_period", "N/A")),
                    calc.get("status", "N/A"),
                    str(calc.get("files", "N/A")),
                    calc.get("comments", "N/A"),
                    calc.get("created_at", "N/A"),
                    calc.get("updated_at", "N/A"),
                )
            )

    def _apply_filters(self):
        """Apply filters to calculations display"""
        if not self.all_calculations:
            return

        status_filter = self.status_filter.get() if self.status_filter else "All"

        # Filter by status
        filtered_calculations = [
            calc for calc in self.all_calculations
            if status_filter == "All" or calc.get("status") == status_filter
        ]

        # Update tree display with filtered results
        self._refresh_tree_display(filtered_calculations)

    def _on_calculation_select(self, event):
        """Handle calculation selection"""
        if not self.tree:
            return
        selection = self.tree.selection()
        if selection:
            calc_id = selection[0]
            self.current_calculation = next((c for c in self.all_calculations if c.get("id") == calc_id), None)
            if self.current_calculation and self.comments_text:
                self.comments_text.config(state="normal")
                self.comments_text.delete("1.0", "end")
                self.comments_text.insert("end", self.current_calculation.get("comments", ""))
                self.comments_text.config(state="disabled")

    def _get_selected_calculation(self) -> Optional[Dict[str, Any]]:
        if not self.tree:
            return None
        selection = self.tree.selection()
        if not selection:
            return None
        selected_id = selection[0]
        return next((c for c in self.all_calculations if str(c.get("id")) == selected_id), None)

    def add_calculation(self):
        """Add new calculation"""
        if not self.selected_deal_id:
            messagebox.showwarning(i18n("Warning"), i18n("Please select a deal first"))
            return

        dialog = CalculationEditDialog(self.parent, calculation=None, deals_list=self.deals)
        if dialog.result:
            payload = {k: v for k, v in dialog.result.items() if k != "deal_id"}
            deal_id = dialog.selected_deal_id or self.selected_deal_id
            if not deal_id:
                messagebox.showerror(i18n("Error"), i18n("Please select a deal first"))
                return

            def worker():
                try:
                    self.crm_service.create_calculation(deal_id, **payload)
                    self.parent.after(0, self.refresh_calculations)
                    self.parent.after(0, lambda: messagebox.showinfo(i18n("Success"), f"{i18n('Add Calculation')} {i18n('created successfully')}"))
                except Exception as e:
                    logger.error(f"Failed to create calculation: {e}")
                    error_msg = str(e)
                    self.parent.after(0, lambda: messagebox.showerror(i18n("Error"), f"{i18n('failed to create')} calculation: {error_msg}"))

            Thread(target=worker, daemon=True).start()

    def edit_calculation(self):
        """Edit selected calculation"""
        if not self.current_calculation:
            messagebox.showwarning(i18n("Warning"), i18n("Please select a calculation to edit"))
            return

        def fetch_and_edit():
            try:
                current_calculation = self.crm_service.get_calculation(self.selected_deal_id, self.current_calculation["id"])
                self.parent.after(0, lambda: self._show_edit_dialog(self.current_calculation["id"], current_calculation))
            except Exception as e:
                logger.error(f"Failed to fetch calculation for editing: {e}")
                error_msg = str(e)
                self.parent.after(0, lambda: messagebox.showerror(i18n("API Error"), f"{i18n('Failed to fetch')} calculation: {error_msg}"))

        Thread(target=fetch_and_edit, daemon=True).start()

    def _show_edit_dialog(self, calc_id, current_calculation):
        """Show edit dialog on main thread"""
        dialog = CalculationEditDialog(self.parent, calculation=current_calculation, deals_list=self.deals)
        if dialog.result:
            payload = {k: v for k, v in dialog.result.items() if k != "deal_id"}
            deal_id = dialog.selected_deal_id or self.selected_deal_id
            if not deal_id:
                messagebox.showerror(i18n("Error"), i18n("Please select a deal first"))
                return

            def worker():
                try:
                    self.crm_service.update_calculation(deal_id, calc_id, **payload)
                    self.parent.after(0, self.refresh_calculations)
                    self.parent.after(0, lambda: messagebox.showinfo(i18n("Success"), f"{i18n('Add Calculation')} {i18n('updated successfully')}"))
                except Exception as e:
                    logger.error(f"Failed to update calculation: {e}")
                    error_msg = str(e)
                    self.parent.after(0, lambda: messagebox.showerror(i18n("API Error"), f"{i18n('failed to update')} calculation: {error_msg}"))

            Thread(target=worker, daemon=True).start()

    def delete_calculation(self):
        """Delete selected calculation"""
        if not self.current_calculation:
            messagebox.showwarning(i18n("Warning"), i18n("Please select a calculation to delete"))
            return

        if messagebox.askyesno(i18n("Confirm Delete"), f"{i18n('Are you sure you want to delete this')} calculation?"):
            calc_id = self.current_calculation["id"]

            def worker():
                try:
                    self.crm_service.delete_calculation(self.selected_deal_id, calc_id)
                    self.parent.after(0, self.refresh_calculations)
                    self.parent.after(0, lambda: messagebox.showinfo(i18n("Success"), f"{i18n('Add Calculation')} {i18n('deleted successfully')}"))
                except Exception as e:
                    logger.error(f"Failed to delete calculation: {e}")
                    error_msg = str(e)
                    self.parent.after(0, lambda: messagebox.showerror(i18n("API Error"), f"{i18n('failed to delete')} calculation: {error_msg}"))

            Thread(target=worker, daemon=True).start()

    def attach_document(self) -> None:
        if not self.selected_deal_id:
            messagebox.showwarning(i18n("Warning"), i18n("Please select a deal first"))
            return

        file_paths = filedialog.askopenfilenames(parent=self.parent, title=i18n("Select files"))
        if not file_paths:
            return

        copied = copy_files_to_deal_folder(self.selected_deal_id, file_paths)
        if not copied:
            messagebox.showerror(i18n("Error"), i18n("No files were attached"))
            return

        folder = open_deal_folder(self.selected_deal_id)
        messagebox.showinfo(
            i18n("Success"),
            i18n("Files attached to deal folder") + f"\n{folder}",
        )

    def open_document(self) -> None:
        if not self.selected_deal_id:
            messagebox.showwarning(i18n("Warning"), i18n("Please select a deal first"))
            return

        calculation = self._get_selected_calculation()
        files = calculation.get("files") if calculation else None

        if files:
            file_to_open = self._choose_file(list(files))
            if not file_to_open:
                return
            try:
                open_deal_file(file_to_open)
            except FileNotFoundError:
                messagebox.showerror(
                    i18n("Error"),
                    i18n("File not found in deal folder. It may have been moved or deleted."),
                )
        else:
            open_deal_folder(self.selected_deal_id)

    def _choose_file(self, files: List[str]) -> Optional[str]:
        if len(files) == 1:
            return files[0]

        dialog = FileSelectionDialog(self.parent.winfo_toplevel(), files)
        return dialog.result

    def _on_search_change(self, search_text: str):
        """Handle search filter change"""
        if not self.all_calculations:
            return

        # Filter calculations by search text
        search_fields = ["insurance_company", "program_name", "status"]
        filtered_calculations = search_filter_rows(self.all_calculations, search_text, search_fields)

        # Update tree display with filtered results
        self._refresh_tree_display(filtered_calculations)

    def _on_tree_double_click(self, event):
        """Handle double-click on calculation row to open detail dialog"""
        if not self.tree:
            return
        selection = self.tree.selection()
        if not selection:
            return

        calc_id = selection[0]
        self.current_calculation = next((c for c in self.all_calculations if c.get("id") == calc_id), None)
        if self.current_calculation:
            CalculationDetailDialog(self.parent, self.current_calculation)

    def export_to_csv(self):
        """Export calculations to CSV file"""
        if not self.tree or not self.all_calculations:
            messagebox.showwarning(i18n("Warning"), i18n("No data to export"))
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
                i18n("ID"), i18n("Owner ID"), i18n("Deleted"), i18n("Deal ID"),
                i18n("Insurance Company"), i18n("Program Name"), i18n("Premium Amount"), i18n("Coverage Sum"),
                i18n("Calculation Date"), i18n("Validity Period"), i18n("Status"), i18n("Files"), i18n("Comments"),
                i18n("Created At"), i18n("Updated At")
            ]
            rows = []

            for calc in self.all_calculations:
                is_deleted = i18n("Yes") if calc.get("is_deleted", False) else i18n("No")
                rows.append([
                    calc.get("id", "N/A")[:8],
                    calc.get("owner_id", "N/A")[:8],
                    is_deleted,
                    calc.get("deal_id", "N/A")[:8],
                    calc.get("insurance_company", "N/A"),
                    calc.get("program_name", "N/A"),
                    f"{calc.get('premium_amount', 0):.2f}" if calc.get('premium_amount') else "0.00",
                    f"{calc.get('coverage_sum', 0):.2f}" if calc.get('coverage_sum') else "0.00",
                    calc.get("calculation_date", "N/A"),
                    str(calc.get("validity_period", "N/A")),
                    calc.get("status", "N/A"),
                    str(calc.get("files", "N/A")),
                    calc.get("comments", "N/A"),
                    calc.get("created_at", "N/A"),
                    calc.get("updated_at", "N/A"),
                ])

            # Export using DataExporter
            if DataExporter.export_to_csv(filename, columns, rows):
                messagebox.showinfo(i18n("Success"), f"{i18n('Data exported to')} {filename}")
                logger.info(f"Exported {len(rows)} calculations to CSV")
            else:
                messagebox.showerror(i18n("Error"), i18n("Failed to export data"))

        except Exception as e:
            logger.error(f"Export error: {e}")
            messagebox.showerror(i18n("Error"), f"{i18n('Failed to export data')}: {e}")


class FileSelectionDialog(tk.Toplevel):
    """Простой диалог для выбора документа из списка."""

    def __init__(self, parent, files: List[str]):
        super().__init__(parent)
        self.transient(parent)
        self.title(i18n("Select file"))
        self.result: Optional[str] = None

        ttk.Label(self, text=i18n("Select a document to open")).pack(padx=10, pady=5)

        self.listbox = tk.Listbox(self, height=min(10, len(files)))
        self.listbox.pack(fill="both", expand=True, padx=10, pady=5)
        for file_path in files:
            self.listbox.insert("end", file_path)

        button_frame = ttk.Frame(self)
        button_frame.pack(pady=5)
        ttk.Button(button_frame, text=i18n("OK"), command=self._on_ok).pack(side="left", padx=5)
        ttk.Button(button_frame, text=i18n("Cancel"), command=self._on_cancel).pack(side="left", padx=5)

        self.listbox.bind("<Double-1>", lambda _event: self._on_ok())

        self.grab_set()
        self.protocol("WM_DELETE_WINDOW", self._on_cancel)
        self.wait_window(self)

    def _on_ok(self):
        selection = self.listbox.curselection()
        if not selection:
            return
        self.result = self.listbox.get(selection[0])
        self.destroy()

    def _on_cancel(self):
        self.result = None
        self.destroy()

    def export_to_excel(self):
        """Export calculations to Excel file"""
        if not self.tree or not self.all_calculations:
            messagebox.showwarning(i18n("Warning"), i18n("No data to export"))
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
                i18n("ID"), i18n("Owner ID"), i18n("Deleted"), i18n("Deal ID"),
                i18n("Insurance Company"), i18n("Program Name"), i18n("Premium Amount"), i18n("Coverage Sum"),
                i18n("Calculation Date"), i18n("Validity Period"), i18n("Status"), i18n("Files"), i18n("Comments"),
                i18n("Created At"), i18n("Updated At")
            ]
            rows = []

            for calc in self.all_calculations:
                is_deleted = i18n("Yes") if calc.get("is_deleted", False) else i18n("No")
                rows.append([
                    calc.get("id", "N/A")[:8],
                    calc.get("owner_id", "N/A")[:8],
                    is_deleted,
                    calc.get("deal_id", "N/A")[:8],
                    calc.get("insurance_company", "N/A"),
                    calc.get("program_name", "N/A"),
                    f"{calc.get('premium_amount', 0):.2f}" if calc.get('premium_amount') else "0.00",
                    f"{calc.get('coverage_sum', 0):.2f}" if calc.get('coverage_sum') else "0.00",
                    calc.get("calculation_date", "N/A"),
                    str(calc.get("validity_period", "N/A")),
                    calc.get("status", "N/A"),
                    str(calc.get("files", "N/A")),
                    calc.get("comments", "N/A"),
                    calc.get("created_at", "N/A"),
                    calc.get("updated_at", "N/A"),
                ])

            # Export using DataExporter
            if DataExporter.export_to_excel(filename, columns, rows):
                messagebox.showinfo(i18n("Success"), f"{i18n('Data exported to')} {filename}")
                logger.info(f"Exported {len(rows)} calculations to Excel")
            else:
                messagebox.showerror(i18n("Error"), f"{i18n('Failed to export data')}. Make sure openpyxl is installed.")

        except Exception as e:
            logger.error(f"Export error: {e}")
            messagebox.showerror(i18n("Error"), f"{i18n('Failed to export data')}: {e}")
