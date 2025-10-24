"""Detail dialogs for viewing and editing CRM entities"""
import tkinter as tk
from tkinter import ttk, messagebox
from typing import Optional, Dict, Any
from datetime import datetime
from i18n import i18n
from table_sort_utils import treeview_sort_column


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
        notebook.add(general_frame, text="General Info")

        fields = [
            ("ID", self.client_data.get("id", "N/A")),
            ("Name", self.client_data.get("name", "N/A")),
            ("Email", self.client_data.get("email", "N/A")),
            ("Phone", self.client_data.get("phone", "N/A")),
            ("Status", self.client_data.get("status", "N/A")),
        ]

        for i, (label, value) in enumerate(fields):
            ttk.Label(general_frame, text=f"{label}:").grid(row=i, column=0, sticky="w", padx=10, pady=5)
            ttk.Label(general_frame, text=str(value)).grid(row=i, column=1, sticky="w", padx=10, pady=5)

        # Timestamps Tab
        timestamps_frame = ttk.Frame(notebook)
        notebook.add(timestamps_frame, text="Timestamps")

        ts_fields = [
            ("Created At", self.client_data.get("created_at", "N/A")),
            ("Updated At", self.client_data.get("updated_at", "N/A")),
            ("Is Deleted", "Yes" if self.client_data.get("is_deleted") else "No"),
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

        fields = [
            ("ID", self.deal_data.get("id", "N/A")),
            (i18n("Deal Title"), self.deal_data.get("title", "N/A")),
            (i18n("Client"), self.deal_data.get("client_id", "N/A")),
            (i18n("Status"), self.deal_data.get("status", "N/A")),
            (i18n("Amount"), self.deal_data.get("amount", "N/A")),
            ("Next Review Date", self.deal_data.get("next_review_at", "N/A")),
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
        desc_text.insert("end", self.deal_data.get("description", ""))
        desc_text.config(state="disabled")

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

        # Timestamps Tab
        timestamps_frame = ttk.Frame(notebook)
        notebook.add(timestamps_frame, text="Timestamps")

        ts_fields = [
            ("Created At", self.deal_data.get("created_at", "N/A")),
            ("Updated At", self.deal_data.get("updated_at", "N/A")),
            ("Is Deleted", i18n("Yes") if self.deal_data.get("is_deleted") else i18n("No")),
        ]

        for i, (label, value) in enumerate(ts_fields):
            ttk.Label(timestamps_frame, text=f"{label}:").grid(row=i, column=0, sticky="w", padx=10, pady=5)
            ttk.Label(timestamps_frame, text=str(value)).grid(row=i, column=1, sticky="w", padx=10, pady=5)

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
            columns=("Date", "Amount", "Status", "Planned"),
            show="headings",
            height=12
        )

        for col in ("Date", "Amount", "Status", "Planned"):
            self.payments_tree.heading(col, text=col, command=lambda c=col: self._on_payments_tree_sort(c))

        self.payments_tree.column("Date", width=120)
        self.payments_tree.column("Amount", width=100)
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
            "Amount": "incomes_total",
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
                self.policies = self.crm_service.get_policies()
                self.calculations = self.crm_service.get_calculations(deal_id)
                self.payments = self.crm_service.get_payments(deal_id)
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
        dialog = CalculationEditDialog(self, self.crm_service, deals_list=[self.deal_data], calculation=None)
        if dialog.result:
            def worker():
                try:
                    deal_id = self.deal_data.get("id", "")
                    self.crm_service.create_calculation(deal_id, **dialog.result)
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

    def _add_payment(self):
        """Add payment to deal"""
        from edit_dialogs import PaymentEditDialog
        dialog = PaymentEditDialog(self, self.crm_service, deals_list=[self.deal_data], policies_list=self.policies, payment=None)
        if dialog.result:
            def worker():
                try:
                    deal_id = self.deal_data.get("id", "")
                    self.crm_service.create_payment(deal_id, **dialog.result)
                    self.after(0, lambda: messagebox.showinfo(i18n("Success"), i18n("Payment created successfully")))
                    self.after(0, self._reload_payments)
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
                self.policies = self.crm_service.get_policies()
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
                self.payments = self.crm_service.get_payments(deal_id)
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
                payment.get("incomes_total", "N/A"),
                payment.get("status", "N/A"),
                payment.get("planned_amount", "N/A"),
            ))
            self.payment_id_map[item_id] = payment.get("id")

    def _update_finances(self):
        """Update financial summary"""
        total_income = sum(float(p.get("incomes_total", 0) or 0) for p in self.payments)
        total_expenses = sum(float(p.get("expenses_total", 0) or 0) for p in self.payments)
        net = total_income - total_expenses

        self.income_label.config(text=f"{total_income:,.2f}")
        self.expenses_label.config(text=f"{total_expenses:,.2f}")
        self.net_label.config(text=f"{net:,.2f}")


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
        notebook.add(general_frame, text="General Info")

        fields = [
            ("ID", self.policy_data.get("id", "N/A")),
            ("Policy Number", self.policy_data.get("policy_number", "N/A")),
            ("Client ID", self.policy_data.get("client_id", "N/A")),
            ("Deal ID", self.policy_data.get("deal_id", "N/A")),
            ("Status", self.policy_data.get("status", "N/A")),
            ("Premium", self.policy_data.get("premium", "N/A")),
            ("Effective From", self.policy_data.get("effective_from", "N/A")),
            ("Effective To", self.policy_data.get("effective_to", "N/A")),
        ]

        for i, (label, value) in enumerate(fields):
            ttk.Label(general_frame, text=f"{label}:").grid(row=i, column=0, sticky="w", padx=10, pady=5)
            ttk.Label(general_frame, text=str(value)).grid(row=i, column=1, sticky="w", padx=10, pady=5)

        # Timestamps Tab
        timestamps_frame = ttk.Frame(notebook)
        notebook.add(timestamps_frame, text="Timestamps")

        ts_fields = [
            ("Created At", self.policy_data.get("created_at", "N/A")),
            ("Updated At", self.policy_data.get("updated_at", "N/A")),
            ("Is Deleted", "Yes" if self.policy_data.get("is_deleted") else "No"),
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
        notebook.add(general_frame, text="General Info")

        fields = [
            ("ID", self.calc_data.get("id", "N/A")),
            ("Deal ID", self.calc_data.get("deal_id", "N/A")),
            ("Insurance Company", self.calc_data.get("insurance_company", "N/A")),
            ("Program Name", self.calc_data.get("program_name", "N/A")),
            ("Premium Amount", self.calc_data.get("premium_amount", "N/A")),
            ("Coverage Sum", self.calc_data.get("coverage_sum", "N/A")),
            ("Calculation Date", self.calc_data.get("calculation_date", "N/A")),
            ("Status", self.calc_data.get("status", "N/A")),
        ]

        for i, (label, value) in enumerate(fields):
            ttk.Label(general_frame, text=f"{label}:").grid(row=i, column=0, sticky="w", padx=10, pady=5)
            ttk.Label(general_frame, text=str(value)).grid(row=i, column=1, sticky="w", padx=10, pady=5)

        # Comments Tab
        comments_frame = ttk.Frame(notebook)
        notebook.add(comments_frame, text="Comments")

        ttk.Label(comments_frame, text="Comments:").pack(anchor="w", padx=10, pady=5)
        comments_text = tk.Text(comments_frame, height=12, width=80)
        comments_text.pack(padx=10, pady=5, fill="both", expand=True)
        comments_text.insert("end", self.calc_data.get("comments", ""))
        comments_text.config(state="disabled")

        # Timestamps Tab
        timestamps_frame = ttk.Frame(notebook)
        notebook.add(timestamps_frame, text="Timestamps")

        ts_fields = [
            ("Created At", self.calc_data.get("created_at", "N/A")),
            ("Updated At", self.calc_data.get("updated_at", "N/A")),
            ("Is Deleted", "Yes" if self.calc_data.get("is_deleted") else "No"),
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
        notebook.add(general_frame, text="General Info")

        fields = [
            ("ID", self.task_data.get("id", "N/A")),
            ("Title", self.task_data.get("title", "N/A")),
            ("Status", self.task_data.get("status", "N/A")),
            ("Priority", self.task_data.get("priority", "N/A")),
            ("Due Date", self.task_data.get("due_date", "N/A")),
            ("Deal ID", self.task_data.get("deal_id", "N/A")),
            ("Client ID", self.task_data.get("client_id", "N/A")),
        ]

        for i, (label, value) in enumerate(fields):
            ttk.Label(general_frame, text=f"{label}:").grid(row=i, column=0, sticky="w", padx=10, pady=5)
            ttk.Label(general_frame, text=str(value)).grid(row=i, column=1, sticky="w", padx=10, pady=5)

        # Description Tab
        desc_frame = ttk.Frame(notebook)
        notebook.add(desc_frame, text="Description")

        ttk.Label(desc_frame, text="Description:").pack(anchor="w", padx=10, pady=5)
        desc_text = tk.Text(desc_frame, height=10, width=80)
        desc_text.pack(padx=10, pady=5, fill="both", expand=True)
        desc_text.insert("end", self.task_data.get("description", ""))
        desc_text.config(state="disabled")

        # Timestamps Tab
        timestamps_frame = ttk.Frame(notebook)
        notebook.add(timestamps_frame, text="Timestamps")

        ts_fields = [
            ("Created At", self.task_data.get("created_at", "N/A")),
            ("Updated At", self.task_data.get("updated_at", "N/A")),
            ("Is Deleted", "Yes" if self.task_data.get("is_deleted") else "No"),
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
        notebook.add(general_frame, text="General Info")

        fields = [
            ("ID", self.payment_data.get("id", "N/A")),
            ("Deal ID", self.payment_data.get("deal_id", "N/A")),
            ("Policy ID", self.payment_data.get("policy_id", "N/A")),
            ("Sequence", self.payment_data.get("sequence", "N/A")),
            ("Status", self.payment_data.get("status", "N/A")),
            ("Currency", self.payment_data.get("currency", "N/A")),
        ]

        for i, (label, value) in enumerate(fields):
            ttk.Label(general_frame, text=f"{label}:").grid(row=i, column=0, sticky="w", padx=10, pady=5)
            ttk.Label(general_frame, text=str(value)).grid(row=i, column=1, sticky="w", padx=10, pady=5)

        # Dates Tab
        dates_frame = ttk.Frame(notebook)
        notebook.add(dates_frame, text="Dates")

        dates_fields = [
            ("Planned Date", self.payment_data.get("planned_date", "N/A")),
            ("Actual Date", self.payment_data.get("actual_date", "N/A")),
        ]

        for i, (label, value) in enumerate(dates_fields):
            ttk.Label(dates_frame, text=f"{label}:").grid(row=i, column=0, sticky="w", padx=10, pady=5)
            ttk.Label(dates_frame, text=str(value)).grid(row=i, column=1, sticky="w", padx=10, pady=5)

        # Amounts Tab
        amounts_frame = ttk.Frame(notebook)
        notebook.add(amounts_frame, text="Amounts")

        amounts_fields = [
            ("Planned Amount", self.payment_data.get("planned_amount", "N/A")),
            ("Incomes Total", self.payment_data.get("incomes_total", "N/A")),
            ("Expenses Total", self.payment_data.get("expenses_total", "N/A")),
            ("Net Total", self.payment_data.get("net_total", "N/A")),
        ]

        for i, (label, value) in enumerate(amounts_fields):
            ttk.Label(amounts_frame, text=f"{label}:").grid(row=i, column=0, sticky="w", padx=10, pady=5)
            ttk.Label(amounts_frame, text=str(value)).grid(row=i, column=1, sticky="w", padx=10, pady=5)

        # Comment Tab
        comment_frame = ttk.Frame(notebook)
        notebook.add(comment_frame, text="Comment")

        ttk.Label(comment_frame, text="Comment:").pack(anchor="w", padx=10, pady=5)
        comment_text = tk.Text(comment_frame, height=10, width=80)
        comment_text.pack(padx=10, pady=5, fill="both", expand=True)
        comment_text.insert("end", self.payment_data.get("comment", ""))
        comment_text.config(state="disabled")

        # Timestamps Tab
        timestamps_frame = ttk.Frame(notebook)
        notebook.add(timestamps_frame, text="Timestamps")

        ts_fields = [
            ("Created At", self.payment_data.get("created_at", "N/A")),
            ("Updated At", self.payment_data.get("updated_at", "N/A")),
        ]

        for i, (label, value) in enumerate(ts_fields):
            ttk.Label(timestamps_frame, text=f"{label}:").grid(row=i, column=0, sticky="w", padx=10, pady=5)
            ttk.Label(timestamps_frame, text=str(value)).grid(row=i, column=1, sticky="w", padx=10, pady=5)

        # Close button
        ttk.Button(self, text=i18n("Close"), command=self.destroy).pack(pady=10)
