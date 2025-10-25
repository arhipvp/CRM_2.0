"""Detail dialogs for viewing and editing CRM entities"""
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from typing import Optional, Dict, Any, List
from datetime import datetime
from i18n import i18n
from table_sort_utils import treeview_sort_column
from document_utils import copy_files_to_deal_folder, open_deal_file, open_deal_folder


class ClientDetailDialog(tk.Toplevel):
    """Dialog for viewing/editing client details"""

    def __init__(self, parent, client_data: Dict[str, Any]):
        super().__init__(parent)
        self.transient(parent)
        self.title(i18n("Client Details"))
        self.geometry("600x500")
        self.client_data = client_data

        self._create_widgets()

    def _create_widgets(self):
        """Create detail dialog widgets"""
        # Create notebook for tabs
        notebook = ttk.Notebook(self)
        notebook.pack(fill="both", expand=True, padx=10, pady=10)

        # General Info Tab
        general_frame = ttk.Frame(notebook)
        notebook.add(general_frame, text=i18n("General Info"))

        fields = [
            (i18n("ID"), self.client_data.get("id", "N/A")),
            (i18n("Name"), self.client_data.get("name", "N/A")),
            (i18n("Email"), self.client_data.get("email", "N/A")),
            (i18n("Phone"), self.client_data.get("phone", "N/A")),
            (i18n("Status"), self.client_data.get("status", "N/A")),
        ]

        for i, (label, value) in enumerate(fields):
            ttk.Label(general_frame, text=f"{label}:").grid(row=i, column=0, sticky="w", padx=10, pady=5)
            ttk.Label(general_frame, text=str(value)).grid(row=i, column=1, sticky="w", padx=10, pady=5)

        # Timestamps Tab
        timestamps_frame = ttk.Frame(notebook)
        notebook.add(timestamps_frame, text=i18n("Timestamps"))

        ts_fields = [
            (i18n("Created At"), self.client_data.get("created_at", "N/A")),
            (i18n("Updated At"), self.client_data.get("updated_at", "N/A")),
            (i18n("Is Deleted"), i18n("Yes") if self.client_data.get("is_deleted") else i18n("No")),
        ]

        for i, (label, value) in enumerate(ts_fields):
            ttk.Label(timestamps_frame, text=f"{label}:").grid(row=i, column=0, sticky="w", padx=10, pady=5)
            ttk.Label(timestamps_frame, text=str(value)).grid(row=i, column=1, sticky="w", padx=10, pady=5)

        # Close button
        ttk.Button(self, text=i18n("Close"), command=self.destroy).pack(pady=10)


class DealDetailDialog(tk.Toplevel):
    """Dialog for viewing/editing deal details with dependent entities management"""

    def __init__(self, parent, crm_service, deal_data: Dict[str, Any]):
        super().__init__(parent)
        self.transient(parent)
        self.title(i18n("Deal Details"))
        self.geometry("1000x750")
        self.deal_data = deal_data
        self.crm_service = crm_service
        self.parent_app = parent
        self.policies = []
        self.calculations = []
        self.payments = []
        self.all_clients = []

        # Store IDs for display in trees
        self.policy_id_map = {}  # Maps tree item ID to policy ID
        self.calculation_id_map = {}  # Maps tree item ID to calculation ID
        self.payment_id_map = {}  # Maps tree item ID to payment ID

        self._create_widgets()
        self._load_dependent_data()

    def _create_widgets(self):
        """Create detail dialog widgets"""
        notebook = ttk.Notebook(self)
        notebook.pack(fill="both", expand=True, padx=10, pady=10)

        # General Info Tab
        general_frame = ttk.Frame(notebook)
        notebook.add(general_frame, text=i18n("General Info"))

        # General fields
        fields = [
            (i18n("ID"), self.deal_data.get("id", "N/A")),
            (i18n("Deal Title"), self.deal_data.get("title", "N/A")),
            (i18n("Client"), self.deal_data.get("client_id", "N/A")),
            (i18n("Status"), self.deal_data.get("status", "N/A")),
            (i18n("Amount"), self.deal_data.get("amount", "N/A")),
            (i18n("Next Review Date"), self.deal_data.get("next_review_at", "N/A")),
        ]

        for i, (label, value) in enumerate(fields):
            ttk.Label(general_frame, text=f"{label}:").grid(row=i, column=0, sticky="w", padx=10, pady=5)
            ttk.Label(general_frame, text=str(value)).grid(row=i, column=1, sticky="w", padx=10, pady=5)

        # Description
        ttk.Label(general_frame, text=i18n("Description") + ":").grid(row=len(fields), column=0, sticky="nw", padx=10, pady=5)
        desc_text = tk.Text(general_frame, height=5, width=80)
        desc_text.grid(row=len(fields), column=1, sticky="ew", padx=10, pady=5)
        desc_text.insert("end", self.deal_data.get("description", ""))
        desc_text.config(state="disabled")

        # Timestamps
        ts_fields = [
            (i18n("Created At"), self.deal_data.get("created_at", "N/A")),
            (i18n("Updated At"), self.deal_data.get("updated_at", "N/A")),
            (i18n("Is Deleted"), i18n("Yes") if self.deal_data.get("is_deleted") else i18n("No")),
        ]

        for i, (label, value) in enumerate(ts_fields):
            ttk.Label(general_frame, text=f"{label}:").grid(row=len(fields) + 1 + i, column=0, sticky="w", padx=10, pady=5)
            ttk.Label(general_frame, text=str(value)).grid(row=len(fields) + 1 + i, column=1, sticky="w", padx=10, pady=5)

        # Policies Tab
        policies_frame = ttk.Frame(notebook)
        notebook.add(policies_frame, text=i18n("Policies"))
        self._create_policies_tab(policies_frame)

        # Calculations Tab
        calculations_frame = ttk.Frame(notebook)
        notebook.add(calculations_frame, text=i18n("Calculations"))
        self._create_calculations_tab(calculations_frame)

        # Payments Tab
        payments_frame = ttk.Frame(notebook)
        notebook.add(payments_frame, text=i18n("Payments"))
        self._create_payments_tab(payments_frame)

        # Income/Expenses Tab
        finances_frame = ttk.Frame(notebook)
        notebook.add(finances_frame, text=i18n("Income/Expenses"))
        self._create_finances_tab(finances_frame)

        # Close button
        ttk.Button(self, text=i18n("Close"), command=self.destroy).pack(pady=10)

    def _create_policies_tab(self, parent):
        """Create policies management tab"""
        # Treeview for policies
        tree_frame = ttk.Frame(parent)
        tree_frame.pack(fill="both", expand=True, padx=10, pady=10)

        self.policies_tree = ttk.Treeview(
            tree_frame,
            columns=("Number", "Status", "Premium", "From", "To"),
            show="headings",
            height=12
        )

        for col in ("Number", "Status", "Premium", "From", "To"):
            self.policies_tree.heading(col, text=i18n(col), command=lambda c=col: self._on_policies_tree_sort(c))

        self.policies_tree.column("Number", width=100)
        self.policies_tree.column("Status", width=80)
        self.policies_tree.column("Premium", width=100)
        self.policies_tree.column("From", width=120)
        self.policies_tree.column("To", width=120)

        scrollbar = ttk.Scrollbar(tree_frame, orient="vertical", command=self.policies_tree.yview)
        self.policies_tree.configure(yscrollcommand=scrollbar.set)

        self.policies_tree.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        # Buttons
        button_frame = ttk.Frame(parent)
        button_frame.pack(pady=5)
        ttk.Button(button_frame, text=i18n("Add"), command=self._add_policy).pack(side="left", padx=5)
        ttk.Button(button_frame, text=i18n("Delete"), command=self._delete_policy).pack(side="left", padx=5)

    def _on_policies_tree_sort(self, col):
        display_map = {
            "Number": "policy_number",
            "Status": "status",
            "Premium": "premium",
            "From": "effective_from",
            "To": "effective_to",
        }
        treeview_sort_column(self.policies_tree, col, False, self.policies, display_map)

    def _create_calculations_tab(self, parent):
        """Create calculations management tab"""
        # Treeview for calculations
        tree_frame = ttk.Frame(parent)
        tree_frame.pack(fill="both", expand=True, padx=10, pady=10)

        self.calculations_tree = ttk.Treeview(
            tree_frame,
            columns=("Company", "Program", "Amount", "Coverage"),
            show="headings",
            height=12
        )

        for col in ("Company", "Program", "Amount", "Coverage"):
            self.calculations_tree.heading(col, text=i18n(col), command=lambda c=col: self._on_calculations_tree_sort(c))

        self.calculations_tree.column("Company", width=120)
        self.calculations_tree.column("Program", width=150)
        self.calculations_tree.column("Amount", width=100)
        self.calculations_tree.column("Coverage", width=120)

        scrollbar = ttk.Scrollbar(tree_frame, orient="vertical", command=self.calculations_tree.yview)
        self.calculations_tree.configure(yscrollcommand=scrollbar.set)

        self.calculations_tree.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        # Buttons
        button_frame = ttk.Frame(parent)
        button_frame.pack(pady=5)
        ttk.Button(button_frame, text=i18n("Add"), command=self._add_calculation).pack(side="left", padx=5)
        ttk.Button(button_frame, text=i18n("Delete"), command=self._delete_calculation).pack(side="left", padx=5)
        ttk.Button(button_frame, text=i18n("Attach Document"), command=self._attach_document).pack(side="left", padx=5)
        ttk.Button(button_frame, text=i18n("Open Document"), command=self._open_document).pack(side="left", padx=5)

    def _on_calculations_tree_sort(self, col):
        display_map = {
            "Company": "insurance_company",
            "Program": "program_name",
            "Amount": "premium_amount",
            "Coverage": "coverage_sum",
        }
        treeview_sort_column(self.calculations_tree, col, False, self.calculations, display_map)

    def _create_payments_tab(self, parent):
        """Create payments management tab"""
        # Treeview for payments
        tree_frame = ttk.Frame(parent)
        tree_frame.pack(fill="both", expand=True, padx=10, pady=10)

        self.payments_tree = ttk.Treeview(
            tree_frame,
            columns=("Date", "Incomes", "Expenses", "Net", "Status", "Planned"),
            show="headings",
            height=12
        )

        for col in ("Date", "Incomes", "Expenses", "Net", "Status", "Planned"):
            self.payments_tree.heading(col, text=col, command=lambda c=col: self._on_payments_tree_sort(c))

        self.payments_tree.column("Date", width=120)
        self.payments_tree.column("Incomes", width=100)
        self.payments_tree.column("Expenses", width=100)
        self.payments_tree.column("Net", width=100)
        self.payments_tree.column("Status", width=100)
        self.payments_tree.column("Planned", width=100)

        scrollbar = ttk.Scrollbar(tree_frame, orient="vertical", command=self.payments_tree.yview)
        self.payments_tree.configure(yscrollcommand=scrollbar.set)

        self.payments_tree.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        # Buttons
        button_frame = ttk.Frame(parent)
        button_frame.pack(pady=5)
        ttk.Button(button_frame, text=i18n("Add"), command=self._add_payment).pack(side="left", padx=5)
        ttk.Button(button_frame, text=i18n("Delete"), command=self._delete_payment).pack(side="left", padx=5)

    def _on_payments_tree_sort(self, col):
        display_map = {
            "Date": "actual_date",
            "Incomes": "incomes_total",
            "Expenses": "expenses_total",
            "Net": "net_total",
            "Status": "status",
            "Planned": "planned_amount",
        }
        treeview_sort_column(self.payments_tree, col, False, self.payments, display_map)

    def _create_finances_tab(self, parent):
        """Create income/expenses summary tab"""
        summary_frame = ttk.LabelFrame(parent, text=i18n("Financial Summary"))
        summary_frame.pack(fill="both", expand=True, padx=10, pady=10)

        # Total Income
        ttk.Label(summary_frame, text=f"{i18n('Total Income')}:").grid(row=0, column=0, sticky="w", padx=10, pady=5)
        self.income_label = ttk.Label(summary_frame, text="0.00", font=("Arial", 12, "bold"))
        self.income_label.grid(row=0, column=1, sticky="w", padx=10, pady=5)

        # Total Expenses
        ttk.Label(summary_frame, text=f"{i18n('Total Expenses')}:").grid(row=1, column=0, sticky="w", padx=10, pady=5)
        self.expenses_label = ttk.Label(summary_frame, text="0.00", font=("Arial", 12, "bold"))
        self.expenses_label.grid(row=1, column=1, sticky="w", padx=10, pady=5)

        # Net
        ttk.Label(summary_frame, text=f"{i18n('Net')}:").grid(row=2, column=0, sticky="w", padx=10, pady=5)
        self.net_label = ttk.Label(summary_frame, text="0.00", font=("Arial", 12, "bold"))
        self.net_label.grid(row=2, column=1, sticky="w", padx=10, pady=5)

    def _load_dependent_data(self):
        """Load policies, calculations, and payments asynchronously"""
        from threading import Thread
        def worker():
            try:
                deal_id = self.deal_data.get("id", "")
                self.all_clients = self.crm_service.get_clients()
                self.policies = self.crm_service.get_deal_policies(deal_id)
                self.calculations = self.crm_service.get_calculations(deal_id)
                payments = self.crm_service.get_payments(deal_id)
                self.payments = [self._normalize_payment(payment) for payment in payments]
                self.after(0, self._update_dependent_data)
            except Exception as e:
                from logger import logger
                logger.error(f"Failed to load deal dependent data: {e}")

        Thread(target=worker, daemon=True).start()

    def _update_dependent_data(self):
        """Update the tree views with loaded data"""
        self._update_policies_tree()
        self._update_calculations_tree()
        self._update_payments_tree()
        self._update_finances()

    def _add_policy(self):
        """Add policy to deal"""
        from edit_dialogs import PolicyEditDialog
        dialog = PolicyEditDialog(self, clients_list=self.all_clients, deals_list=[self.deal_data], policy=None)
        if dialog.result:
            def worker():
                try:
                    self.crm_service.create_policy(**dialog.result)
                    self.after(0, lambda: messagebox.showinfo(i18n("Success"), i18n("Policy created successfully")))
                    self.after(0, self._reload_policies)
                except Exception as e:
                    from logger import logger
                    logger.error(f"Failed to create policy: {e}")
                    self.after(0, lambda: messagebox.showerror(i18n("Error"), f"Failed to create policy: {str(e)}"))
            from threading import Thread
            Thread(target=worker, daemon=True).start()

    def _delete_policy(self):
        """Delete policy from deal"""
        try:
            selected = self.policies_tree.selection()[0]
        except:
            messagebox.showwarning(i18n("Warning"), i18n("Please select a policy to delete"))
            return

        if not messagebox.askyesno(i18n("Confirm Delete"), i18n("Are you sure you want to delete this")):
            return

        policy_id = self.policy_id_map.get(selected)
        if not policy_id:
            messagebox.showerror(i18n("Error"), "Policy ID not found")
            return

        def worker():
            try:
                self.crm_service.delete_policy(policy_id)
                self.after(0, lambda: messagebox.showinfo(i18n("Success"), i18n("Policy deleted successfully")))
                self.after(0, self._reload_policies)
            except Exception as e:
                from logger import logger
                logger.error(f"Failed to delete policy: {e}")
                self.after(0, lambda: messagebox.showerror(i18n("Error"), f"Failed to delete policy: {str(e)}"))

        from threading import Thread
        Thread(target=worker, daemon=True).start()

    def _add_calculation(self):
        """Add calculation to deal"""
        from edit_dialogs import CalculationEditDialog
        dialog = CalculationEditDialog(self, calculation=None, deals_list=[self.deal_data])
        if dialog.result:
            payload = {k: v for k, v in dialog.result.items() if k != "deal_id"}
            deal_id = dialog.selected_deal_id or self.deal_data.get("id", "")
            if not deal_id:
                messagebox.showerror(i18n("Error"), i18n("Please select a deal first"), parent=self)
                return

            def worker():
                try:
                    self.crm_service.create_calculation(deal_id, **payload)
                    self.after(0, lambda: messagebox.showinfo(i18n("Success"), i18n("Calculation created successfully")))
                    self.after(0, self._reload_calculations)
                except Exception as e:
                    from logger import logger
                    logger.error(f"Failed to create calculation: {e}")
                    self.after(0, lambda: messagebox.showerror(i18n("Error"), f"Failed to create calculation: {str(e)}"))
            from threading import Thread
            Thread(target=worker, daemon=True).start()

    def _delete_calculation(self):
        """Delete calculation from deal"""
        try:
            selected = self.calculations_tree.selection()[0]
        except:
            messagebox.showwarning(i18n("Warning"), i18n("Please select a calculation to delete"))
            return

        if not messagebox.askyesno(i18n("Confirm Delete"), i18n("Are you sure you want to delete this")):
            return

        calc_id = self.calculation_id_map.get(selected)
        if not calc_id:
            messagebox.showerror(i18n("Error"), "Calculation ID not found")
            return

        def worker():
            try:
                deal_id = self.deal_data.get("id", "")
                self.crm_service.delete_calculation(deal_id, calc_id)
                self.after(0, lambda: messagebox.showinfo(i18n("Success"), i18n("Calculation deleted successfully")))
                self.after(0, self._reload_calculations)
            except Exception as e:
                from logger import logger
                logger.error(f"Failed to delete calculation: {e}")
                self.after(0, lambda: messagebox.showerror(i18n("Error"), f"Failed to delete calculation: {str(e)}"))

        from threading import Thread
        Thread(target=worker, daemon=True).start()

    def _attach_document(self):
        """Attach files to the deal folder."""
        deal_id = self.deal_data.get("id")
        if not deal_id:
            messagebox.showerror(i18n("Error"), i18n("Deal ID not found"), parent=self)
            return

        file_paths = filedialog.askopenfilenames(parent=self, title=i18n("Select files"))
        if not file_paths:
            return

        copied = copy_files_to_deal_folder(deal_id, file_paths)
        if not copied:
            messagebox.showerror(i18n("Error"), i18n("No files were attached"), parent=self)
            return

        folder = open_deal_folder(deal_id)
        messagebox.showinfo(i18n("Success"), i18n("Files attached to deal folder") + f"\n{folder}", parent=self)

    def _open_document(self):
        """Open a document or the deal folder."""
        deal_id = self.deal_data.get("id")
        if not deal_id:
            messagebox.showerror(i18n("Error"), i18n("Deal ID not found"), parent=self)
            return

        selection = self.calculations_tree.selection()
        files: List[str] = []
        if selection:
            calc_id = self.calculation_id_map.get(selection[0])
            calculation = next((c for c in self.calculations if c.get("id") == calc_id), None)
            if calculation:
                files = list(calculation.get("files") or [])

        if files:
            file_to_open = self._choose_file_from_list(files)
            if not file_to_open:
                return
            try:
                open_deal_file(file_to_open)
            except FileNotFoundError:
                messagebox.showerror(
                    i18n("Error"),
                    i18n("File not found in deal folder. It may have been moved or deleted."),
                    parent=self,
                )
        else:
            open_deal_folder(deal_id)

    def _choose_file_from_list(self, files: List[str]) -> Optional[str]:
        if len(files) == 1:
            return files[0]

        dialog = tk.Toplevel(self)
        dialog.transient(self)
        dialog.title(i18n("Select file"))
        result: Dict[str, Optional[str]] = {"value": None}

        ttk.Label(dialog, text=i18n("Select a document to open")).pack(padx=10, pady=5)
        listbox = tk.Listbox(dialog, height=min(10, len(files)))
        listbox.pack(fill="both", expand=True, padx=10, pady=5)
        for path in files:
            listbox.insert("end", path)

        def on_ok():
            selection = listbox.curselection()
            if not selection:
                return
            result["value"] = listbox.get(selection[0])
            dialog.destroy()

        def on_cancel():
            dialog.destroy()

        button_frame = ttk.Frame(dialog)
        button_frame.pack(pady=5)
        ttk.Button(button_frame, text=i18n("OK"), command=on_ok).pack(side="left", padx=5)
        ttk.Button(button_frame, text=i18n("Cancel"), command=on_cancel).pack(side="left", padx=5)

        listbox.bind("<Double-1>", lambda _event: on_ok())
        dialog.grab_set()
        dialog.protocol("WM_DELETE_WINDOW", on_cancel)
        dialog.wait_window(dialog)

        return result["value"]

    def _add_payment(self):
        """Add payment to deal"""
        from edit_dialogs import PaymentEditDialog
        dialog = PaymentEditDialog(self, payment=None, deals_list=[self.deal_data], policies_list=self.policies)
        if dialog.result:
            payload = {k: v for k, v in dialog.result.items() if k != "deal_id"}
            deal_id = dialog.selected_deal_id or self.deal_data.get("id", "")
            if not deal_id:
                messagebox.showerror(i18n("Error"), i18n("Please select a deal first"), parent=self)
                return

            def worker():
                try:
                    payment = self.crm_service.create_payment(deal_id, **payload)
                    self.after(0, lambda: self._handle_payment_saved(payment, i18n("Payment created successfully")))
                except Exception as e:
                    from logger import logger
                    logger.error(f"Failed to create payment: {e}")
                    self.after(0, lambda: messagebox.showerror(i18n("Error"), f"Failed to create payment: {str(e)}"))
            from threading import Thread
            Thread(target=worker, daemon=True).start()

    def _delete_payment(self):
        """Delete payment from deal"""
        try:
            selected = self.payments_tree.selection()[0]
        except:
            messagebox.showwarning(i18n("Warning"), i18n("Please select a payment to delete"))
            return

        if not messagebox.askyesno(i18n("Confirm Delete"), i18n("Are you sure you want to delete this")):
            return

        payment_id = self.payment_id_map.get(selected)
        if not payment_id:
            messagebox.showerror(i18n("Error"), "Payment ID not found")
            return

        def worker():
            try:
                self.crm_service.delete_payment(payment_id)
                self.after(0, lambda: messagebox.showinfo(i18n("Success"), i18n("Payment deleted successfully")))
                self.after(0, self._reload_payments)
            except Exception as e:
                from logger import logger
                logger.error(f"Failed to delete payment: {e}")
                self.after(0, lambda: messagebox.showerror(i18n("Error"), f"Failed to delete payment: {str(e)}"))

        from threading import Thread
        Thread(target=worker, daemon=True).start()

    def _reload_policies(self):
        """Reload policies data"""
        def worker():
            try:
                deal_id = self.deal_data.get("id", "")
                self.policies = self.crm_service.get_deal_policies(deal_id)
                self.after(0, self._update_policies_tree)
            except Exception as e:
                from logger import logger
                logger.error(f"Failed to reload policies: {e}")

        from threading import Thread
        Thread(target=worker, daemon=True).start()

    def _reload_calculations(self):
        """Reload calculations data"""
        def worker():
            try:
                deal_id = self.deal_data.get("id", "")
                self.calculations = self.crm_service.get_calculations(deal_id)
                self.after(0, self._update_calculations_tree)
            except Exception as e:
                from logger import logger
                logger.error(f"Failed to reload calculations: {e}")

        from threading import Thread
        Thread(target=worker, daemon=True).start()

    def _reload_payments(self):
        """Reload payments data"""
        def worker():
            try:
                deal_id = self.deal_data.get("id", "")
                payments = self.crm_service.get_payments(deal_id)
                self.payments = [self._normalize_payment(payment) for payment in payments]
                self.after(0, self._update_payments_tree)
                self.after(0, self._update_finances)
            except Exception as e:
                from logger import logger
                logger.error(f"Failed to reload payments: {e}")

        from threading import Thread
        Thread(target=worker, daemon=True).start()

    def _update_policies_tree(self):
        """Update policies tree view"""
        # Clear existing items
        for item in self.policies_tree.get_children():
            self.policies_tree.delete(item)

        self.policy_id_map.clear()

        # Add policies
        for policy in self.policies:
            item_id = self.policies_tree.insert("", "end", values=(
                policy.get("policy_number", "N/A"),
                policy.get("status", "N/A"),
                policy.get("premium", "N/A"),
                policy.get("effective_from", "N/A"),
                policy.get("effective_to", "N/A"),
            ))
            self.policy_id_map[item_id] = policy.get("id")

    def _update_calculations_tree(self):
        """Update calculations tree view"""
        # Clear existing items
        for item in self.calculations_tree.get_children():
            self.calculations_tree.delete(item)

        self.calculation_id_map.clear()

        # Add calculations
        for calc in self.calculations:
            item_id = self.calculations_tree.insert("", "end", values=(
                calc.get("insurance_company", "N/A"),
                calc.get("program_name", "N/A"),
                calc.get("premium_amount", "N/A"),
                calc.get("coverage_sum", "N/A"),
            ))
            self.calculation_id_map[item_id] = calc.get("id")

    def _update_payments_tree(self):
        """Update payments tree view"""
        # Clear existing items
        for item in self.payments_tree.get_children():
            self.payments_tree.delete(item)

        self.payment_id_map.clear()

        # Add payments
        for payment in self.payments:
            item_id = self.payments_tree.insert("", "end", values=(
                payment.get("actual_date", payment.get("planned_date", "N/A")),
                self._format_amount(payment.get("incomes_total")),
                self._format_amount(payment.get("expenses_total")),
                self._format_amount(payment.get("net_total")),
                payment.get("status", "N/A"),
                self._format_amount(payment.get("planned_amount")),
            ))
            self.payment_id_map[item_id] = payment.get("id")

    def _update_finances(self):
        """Update financial summary"""
        total_income = sum(self._coerce_numeric(p.get("incomes_total")) for p in self.payments)
        total_expenses = sum(self._coerce_numeric(p.get("expenses_total")) for p in self.payments)
        net = total_income - total_expenses

        self.income_label.config(text=f"{total_income:,.2f}")
        self.expenses_label.config(text=f"{total_expenses:,.2f}")
        self.net_label.config(text=f"{net:,.2f}")

    def _handle_payment_saved(self, payment: Optional[Dict[str, Any]], success_message: Optional[str] = None):
        """Handle payment creation/update feedback"""
        if payment:
            normalized = self._normalize_payment(payment)
            self._upsert_payment(normalized)
        if success_message:
            messagebox.showinfo(i18n("Success"), success_message)
        self._reload_payments()

    def _normalize_payment(self, payment: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize numeric fields for display"""
        normalized = dict(payment or {})
        for field in ("planned_amount", "incomes_total", "expenses_total", "net_total"):
            normalized[field] = self._coerce_numeric(normalized.get(field))
        return normalized

    def _upsert_payment(self, payment: Dict[str, Any]):
        """Insert or update payment locally"""
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
        self._update_payments_tree()
        self._update_finances()

    @staticmethod
    def _coerce_numeric(value: Any) -> float:
        """Convert provided value to float"""
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
        """Format numeric values for tree display"""
        return f"{DealDetailDialog._coerce_numeric(value):.2f}"


class PolicyDetailDialog(tk.Toplevel):
    """Dialog for viewing/editing policy details"""

    def __init__(self, parent, policy_data: Dict[str, Any]):
        super().__init__(parent)
        self.transient(parent)
        self.title(i18n("Policy Details"))
        self.geometry("700x600")
        self.policy_data = policy_data

        self._create_widgets()

    def _create_widgets(self):
        """Create detail dialog widgets"""
        notebook = ttk.Notebook(self)
        notebook.pack(fill="both", expand=True, padx=10, pady=10)

        # General Info Tab
        general_frame = ttk.Frame(notebook)
        notebook.add(general_frame, text=i18n("General Info"))

        fields = [
            (i18n("ID"), self.policy_data.get("id", "N/A")),
            (i18n("Policy Number"), self.policy_data.get("policy_number", "N/A")),
            (i18n("Client ID"), self.policy_data.get("client_id", "N/A")),
            (i18n("Deal ID"), self.policy_data.get("deal_id", "N/A")),
            (i18n("Status"), self.policy_data.get("status", "N/A")),
            (i18n("Premium"), self.policy_data.get("premium", "N/A")),
            (i18n("Effective From"), self.policy_data.get("effective_from", "N/A")),
            (i18n("Effective To"), self.policy_data.get("effective_to", "N/A")),
        ]

        for i, (label, value) in enumerate(fields):
            ttk.Label(general_frame, text=f"{label}:").grid(row=i, column=0, sticky="w", padx=10, pady=5)
            ttk.Label(general_frame, text=str(value)).grid(row=i, column=1, sticky="w", padx=10, pady=5)

        # Timestamps Tab
        timestamps_frame = ttk.Frame(notebook)
        notebook.add(timestamps_frame, text=i18n("Timestamps"))

        ts_fields = [
            (i18n("Created At"), self.policy_data.get("created_at", "N/A")),
            (i18n("Updated At"), self.policy_data.get("updated_at", "N/A")),
            (i18n("Is Deleted"), i18n("Yes") if self.policy_data.get("is_deleted") else i18n("No")),
        ]

        for i, (label, value) in enumerate(ts_fields):
            ttk.Label(timestamps_frame, text=f"{label}:").grid(row=i, column=0, sticky="w", padx=10, pady=5)
            ttk.Label(timestamps_frame, text=str(value)).grid(row=i, column=1, sticky="w", padx=10, pady=5)

        # Close button
        ttk.Button(self, text=i18n("Close"), command=self.destroy).pack(pady=10)


class CalculationDetailDialog(tk.Toplevel):
    """Dialog for viewing/editing calculation details"""

    def __init__(self, parent, calc_data: Dict[str, Any]):
        super().__init__(parent)
        self.transient(parent)
        self.title(i18n("Calculation Details"))
        self.geometry("700x700")
        self.calc_data = calc_data

        self._create_widgets()

    def _create_widgets(self):
        """Create detail dialog widgets"""
        notebook = ttk.Notebook(self)
        notebook.pack(fill="both", expand=True, padx=10, pady=10)

        # General Info Tab
        general_frame = ttk.Frame(notebook)
        notebook.add(general_frame, text=i18n("General Info"))

        fields = [
            (i18n("ID"), self.calc_data.get("id", "N/A")),
            (i18n("Deal ID"), self.calc_data.get("deal_id", "N/A")),
            (i18n("Insurance Company"), self.calc_data.get("insurance_company", "N/A")),
            (i18n("Program Name"), self.calc_data.get("program_name", "N/A")),
            (i18n("Premium Amount"), self.calc_data.get("premium_amount", "N/A")),
            (i18n("Coverage Sum"), self.calc_data.get("coverage_sum", "N/A")),
            (i18n("Calculation Date"), self.calc_data.get("calculation_date", "N/A")),
            (i18n("Status"), self.calc_data.get("status", "N/A")),
        ]

        for i, (label, value) in enumerate(fields):
            ttk.Label(general_frame, text=f"{label}:").grid(row=i, column=0, sticky="w", padx=10, pady=5)
            ttk.Label(general_frame, text=str(value)).grid(row=i, column=1, sticky="w", padx=10, pady=5)

        # Comments Tab
        comments_frame = ttk.Frame(notebook)
        notebook.add(comments_frame, text=i18n("Comments"))

        ttk.Label(comments_frame, text=i18n("Comments") + ":").pack(anchor="w", padx=10, pady=5)
        comments_text = tk.Text(comments_frame, height=12, width=80)
        comments_text.pack(padx=10, pady=5, fill="both", expand=True)
        comments_text.insert("end", self.calc_data.get("comments", ""))
        comments_text.config(state="disabled")

        # Timestamps Tab
        timestamps_frame = ttk.Frame(notebook)
        notebook.add(timestamps_frame, text=i18n("Timestamps"))

        ts_fields = [
            (i18n("Created At"), self.calc_data.get("created_at", "N/A")),
            (i18n("Updated At"), self.calc_data.get("updated_at", "N/A")),
            (i18n("Is Deleted"), i18n("Yes") if self.calc_data.get("is_deleted") else i18n("No")),
        ]

        for i, (label, value) in enumerate(ts_fields):
            ttk.Label(timestamps_frame, text=f"{label}:").grid(row=i, column=0, sticky="w", padx=10, pady=5)
            ttk.Label(timestamps_frame, text=str(value)).grid(row=i, column=1, sticky="w", padx=10, pady=5)

        # Close button
        ttk.Button(self, text=i18n("Close"), command=self.destroy).pack(pady=10)


class TaskDetailDialog(tk.Toplevel):
    """Dialog for viewing/editing task details"""

    def __init__(self, parent, task_data: Dict[str, Any]):
        super().__init__(parent)
        self.transient(parent)
        self.title(i18n("Task Details"))
        self.geometry("700x600")
        self.task_data = task_data

        self._create_widgets()

    def _create_widgets(self):
        """Create detail dialog widgets"""
        notebook = ttk.Notebook(self)
        notebook.pack(fill="both", expand=True, padx=10, pady=10)

        # General Info Tab
        general_frame = ttk.Frame(notebook)
        notebook.add(general_frame, text=i18n("General Info"))

        fields = [
            (i18n("ID"), self.task_data.get("id", "N/A")),
            (i18n("Title"), self.task_data.get("title", "N/A")),
            (i18n("Status"), self.task_data.get("status", "N/A")),
            (i18n("Priority"), self.task_data.get("priority", "N/A")),
            (i18n("Due Date"), self.task_data.get("due_date", "N/A")),
            (i18n("Deal ID"), self.task_data.get("deal_id", "N/A")),
            (i18n("Client ID"), self.task_data.get("client_id", "N/A")),
        ]

        for i, (label, value) in enumerate(fields):
            ttk.Label(general_frame, text=f"{label}:").grid(row=i, column=0, sticky="w", padx=10, pady=5)
            ttk.Label(general_frame, text=str(value)).grid(row=i, column=1, sticky="w", padx=10, pady=5)

        # Description Tab
        desc_frame = ttk.Frame(notebook)
        notebook.add(desc_frame, text=i18n("Description"))

        ttk.Label(desc_frame, text=i18n("Description") + ":").pack(anchor="w", padx=10, pady=5)
        desc_text = tk.Text(desc_frame, height=10, width=80)
        desc_text.pack(padx=10, pady=5, fill="both", expand=True)
        desc_text.insert("end", self.task_data.get("description", ""))
        desc_text.config(state="disabled")

        # Timestamps Tab
        timestamps_frame = ttk.Frame(notebook)
        notebook.add(timestamps_frame, text=i18n("Timestamps"))

        ts_fields = [
            (i18n("Created At"), self.task_data.get("created_at", "N/A")),
            (i18n("Updated At"), self.task_data.get("updated_at", "N/A")),
            (i18n("Is Deleted"), i18n("Yes") if self.task_data.get("is_deleted") else i18n("No")),
        ]

        for i, (label, value) in enumerate(ts_fields):
            ttk.Label(timestamps_frame, text=f"{label}:").grid(row=i, column=0, sticky="w", padx=10, pady=5)
            ttk.Label(timestamps_frame, text=str(value)).grid(row=i, column=1, sticky="w", padx=10, pady=5)

        # Close button
        ttk.Button(self, text=i18n("Close"), command=self.destroy).pack(pady=10)


class PaymentDetailDialog(tk.Toplevel):
    """Dialog for viewing/editing payment details"""

    def __init__(self, parent, payment_data: Dict[str, Any]):
        super().__init__(parent)
        self.transient(parent)
        self.title(i18n("Payment Details"))
        self.geometry("700x700")
        self.payment_data = payment_data

        self._create_widgets()

    def _create_widgets(self):
        """Create detail dialog widgets"""
        notebook = ttk.Notebook(self)
        notebook.pack(fill="both", expand=True, padx=10, pady=10)

        # General Info Tab
        general_frame = ttk.Frame(notebook)
        notebook.add(general_frame, text=i18n("General Info"))

        fields = [
            (i18n("ID"), self.payment_data.get("id", "N/A")),
            (i18n("Deal ID"), self.payment_data.get("deal_id", "N/A")),
            (i18n("Policy ID"), self.payment_data.get("policy_id", "N/A")),
            (i18n("Sequence"), self.payment_data.get("sequence", "N/A")),
            (i18n("Status"), self.payment_data.get("status", "N/A")),
            (i18n("Currency"), self.payment_data.get("currency", "N/A")),
        ]

        for i, (label, value) in enumerate(fields):
            ttk.Label(general_frame, text=f"{label}:").grid(row=i, column=0, sticky="w", padx=10, pady=5)
            ttk.Label(general_frame, text=str(value)).grid(row=i, column=1, sticky="w", padx=10, pady=5)

        # Dates Tab
        dates_frame = ttk.Frame(notebook)
        notebook.add(dates_frame, text=i18n("Dates"))

        dates_fields = [
            (i18n("Planned Date"), self.payment_data.get("planned_date", "N/A")),
            (i18n("Actual Date"), self.payment_data.get("actual_date", "N/A")),
        ]

        for i, (label, value) in enumerate(dates_fields):
            ttk.Label(dates_frame, text=f"{label}:").grid(row=i, column=0, sticky="w", padx=10, pady=5)
            ttk.Label(dates_frame, text=str(value)).grid(row=i, column=1, sticky="w", padx=10, pady=5)

        # Amounts Tab
        amounts_frame = ttk.Frame(notebook)
        notebook.add(amounts_frame, text=i18n("Amounts"))

        amounts_fields = [
            (i18n("Planned Amount"), self.payment_data.get("planned_amount", "N/A")),
            (i18n("Incomes Total"), self.payment_data.get("incomes_total", "N/A")),
            (i18n("Expenses Total"), self.payment_data.get("expenses_total", "N/A")),
            (i18n("Net Total"), self.payment_data.get("net_total", "N/A")),
        ]

        for i, (label, value) in enumerate(amounts_fields):
            ttk.Label(amounts_frame, text=f"{label}:").grid(row=i, column=0, sticky="w", padx=10, pady=5)
            ttk.Label(amounts_frame, text=str(value)).grid(row=i, column=1, sticky="w", padx=10, pady=5)

        # Comment Tab
        comment_frame = ttk.Frame(notebook)
        notebook.add(comment_frame, text=i18n("Comment"))

        ttk.Label(comment_frame, text=i18n("Comment") + ":").pack(anchor="w", padx=10, pady=5)
        comment_text = tk.Text(comment_frame, height=10, width=80)
        comment_text.pack(padx=10, pady=5, fill="both", expand=True)
        comment_text.insert("end", self.payment_data.get("comment", ""))
        comment_text.config(state="disabled")

        # Timestamps Tab
        timestamps_frame = ttk.Frame(notebook)
        notebook.add(timestamps_frame, text=i18n("Timestamps"))

        ts_fields = [
            (i18n("Created At"), self.payment_data.get("created_at", "N/A")),
            (i18n("Updated At"), self.payment_data.get("updated_at", "N/A")),
        ]

        for i, (label, value) in enumerate(ts_fields):
            ttk.Label(timestamps_frame, text=f"{label}:").grid(row=i, column=0, sticky="w", padx=10, pady=5)
            ttk.Label(timestamps_frame, text=str(value)).grid(row=i, column=1, sticky="w", padx=10, pady=5)

        # Close button
        ttk.Button(self, text=i18n("Close"), command=self.destroy).pack(pady=10)
