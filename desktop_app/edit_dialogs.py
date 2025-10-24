"""Edit dialogs for all CRM entities"""
import tkinter as tk
from tkinter import ttk, messagebox
from typing import Optional, Dict, Any, List
from datetime import datetime


class BaseEditDialog(tk.Toplevel):
    """Base class for all edit dialogs"""

    def __init__(self, parent, title: str, entity=None):
        super().__init__(parent)
        self.transient(parent)
        self.parent = parent
        self.result = None
        self.entity = entity
        self.title(title)
        self.geometry("500x600")

        # Will be overridden in subclasses
        self.fields_config: List[tuple] = []
        self.field_vars: Dict[str, tk.Variable] = {}

    def create_field(self, row: int, label: str, var: tk.Variable,
                     field_type: str = "entry", values: List[str] = None) -> None:
        """Create a form field"""
        ttk.Label(self, text=f"{label}:").grid(row=row, column=0, sticky="w", padx=10, pady=5)

        if field_type == "entry":
            ttk.Entry(self, textvariable=var, width=40).grid(row=row, column=1, sticky="ew", padx=10, pady=5)
        elif field_type == "text":
            text_widget = tk.Text(self, height=4, width=40)
            text_widget.grid(row=row, column=1, sticky="ew", padx=10, pady=5)
            # Store reference to text widget for later access
            var.text_widget = text_widget
            text_widget.insert("end", var.get())
            var.text_widget_ref = text_widget
        elif field_type == "combobox":
            combo = ttk.Combobox(self, textvariable=var, values=values or [], state="readonly", width=37)
            combo.grid(row=row, column=1, sticky="ew", padx=10, pady=5)
        elif field_type == "date":
            ttk.Entry(self, textvariable=var, width=40).grid(row=row, column=1, sticky="ew", padx=10, pady=5)
            ttk.Label(self, text="(YYYY-MM-DD)", font=("Arial", 8)).grid(row=row, column=2, sticky="w", padx=5)

        self.columnconfigure(1, weight=1)

    def setup_buttons(self, row: int) -> None:
        """Setup OK/Cancel buttons"""
        button_frame = tk.Frame(self)
        button_frame.grid(row=row, columnspan=3, pady=15)

        tk.Button(button_frame, text="OK", command=self.on_ok, width=10).pack(side="left", padx=5)
        tk.Button(button_frame, text="Cancel", command=self.destroy, width=10).pack(side="left", padx=5)

        self.grab_set()
        self.wait_window(self)

    def on_ok(self) -> None:
        """Handle OK button - override in subclasses"""
        raise NotImplementedError

    def get_text_value(self, var: tk.Variable) -> str:
        """Get value from text widget if exists"""
        if hasattr(var, 'text_widget_ref'):
            return var.text_widget_ref.get("1.0", "end").strip()
        return var.get()

    def validate_required_fields(self, field_names: List[tuple]) -> bool:
        """Validate required fields (name, value)"""
        for field_label, var, is_required in field_names:
            if is_required:
                value = self.get_text_value(var) if hasattr(var, 'text_widget_ref') else var.get()
                if not value or not value.strip():
                    messagebox.showerror("Error", f"{field_label} cannot be empty.", parent=self)
                    return False
        return True


# --- Deal Edit Dialog ---

class DealEditDialog(BaseEditDialog):
    """Dialog for adding/editing deals"""

    def __init__(self, parent, crm_service, deal=None, clients_list: List[Dict[str, Any]] = None):
        super().__init__(parent, "Edit Deal" if deal else "Add Deal", deal)
        self.crm_service = crm_service
        self.clients_list = clients_list or []
        self.client_dict = {c.get("name", f"Client {c.get('id')}"): c.get("id") for c in self.clients_list}

        self.title_var = tk.StringVar(value=deal.get("title", "") if deal else "")
        self.client_id_var = tk.StringVar()
        self.description_var = tk.StringVar(value=deal.get("description", "") if deal else "")
        self.status_var = tk.StringVar(value=deal.get("status", "draft") if deal else "draft")
        self.next_review_var = tk.StringVar(value=deal.get("next_review_at", "") if deal else "")
        self.amount_var = tk.StringVar(value=str(deal.get("amount", "")) if deal else "")

        # Set client dropdown to current value
        if deal and deal.get("client_id"):
            client_name = next((c.get("name") for c in self.clients_list if c.get("id") == deal.get("client_id")), None)
            if client_name:
                self.client_id_var.set(client_name)

        # Title
        self.create_field(0, "Title", self.title_var, "entry")

        # Client
        self.create_field(1, "Client", self.client_id_var, "combobox",
                         list(self.client_dict.keys()))

        # Description
        self.create_field(2, "Description", self.description_var, "text")

        # Status
        self.create_field(3, "Status", self.status_var, "combobox",
                         ["draft", "in_progress", "won", "lost"])

        # Amount
        self.create_field(4, "Amount", self.amount_var, "entry")

        # Next Review Date
        self.create_field(5, "Next Review Date", self.next_review_var, "date")

        # Buttons
        self.setup_buttons(6)

    def on_ok(self) -> None:
        """Handle OK button"""
        title = self.title_var.get().strip()
        client_name = self.client_id_var.get().strip()

        if not title:
            messagebox.showerror("Error", "Title cannot be empty.", parent=self)
            return

        if not client_name:
            messagebox.showerror("Error", "Client must be selected.", parent=self)
            return

        client_id = self.client_dict.get(client_name)
        if not client_id:
            messagebox.showerror("Error", "Invalid client selected.", parent=self)
            return

        description = self.get_text_value(self.description_var)

        self.result = {
            "title": title,
            "client_id": client_id,
            "description": description,
            "status": self.status_var.get(),
            "amount": float(self.amount_var.get()) if self.amount_var.get() else None,
            "next_review_at": self.next_review_var.get() if self.next_review_var.get() else None
        }
        self.destroy()


# --- Payment Edit Dialog ---

class PaymentEditDialog(BaseEditDialog):
    """Dialog for adding/editing payments"""

    def __init__(self, parent, payment=None, deals_list: List[Dict[str, Any]] = None,
                 policies_list: List[Dict[str, Any]] = None):
        super().__init__(parent, "Edit Payment" if payment else "Add Payment", payment)
        self.deals_list = deals_list or []
        self.policies_list = policies_list or []
        self.deal_dict = {d.get("title", f"Deal {d.get('id')}"): d.get("id") for d in self.deals_list}
        self.policy_dict = {p.get("policy_number", f"Policy {p.get('id')}"): p.get("id") for p in self.policies_list}

        self.deal_id_var = tk.StringVar()
        self.policy_id_var = tk.StringVar()
        self.sequence_var = tk.StringVar(value=str(payment.get("sequence", "")) if payment else "")
        self.status_var = tk.StringVar(value=payment.get("status", "scheduled") if payment else "scheduled")
        self.planned_date_var = tk.StringVar(value=payment.get("planned_date", "") if payment else "")
        self.actual_date_var = tk.StringVar(value=payment.get("actual_date", "") if payment else "")
        self.planned_amount_var = tk.StringVar(value=str(payment.get("planned_amount", "")) if payment else "")
        self.currency_var = tk.StringVar(value=payment.get("currency", "RUB") if payment else "RUB")
        self.comment_var = tk.StringVar(value=payment.get("comment", "") if payment else "")

        # Set dropdowns to current values
        if payment:
            if payment.get("deal_id"):
                deal_name = next((d.get("title") for d in self.deals_list if d.get("id") == payment.get("deal_id")), None)
                if deal_name:
                    self.deal_id_var.set(deal_name)
            if payment.get("policy_id"):
                policy_name = next((p.get("policy_number") for p in self.policies_list if p.get("id") == payment.get("policy_id")), None)
                if policy_name:
                    self.policy_id_var.set(policy_name)

        # Deal
        self.create_field(0, "Deal", self.deal_id_var, "combobox",
                         list(self.deal_dict.keys()))

        # Policy
        self.create_field(1, "Policy", self.policy_id_var, "combobox",
                         list(self.policy_dict.keys()))

        # Sequence
        self.create_field(2, "Sequence", self.sequence_var, "entry")

        # Planned Amount
        self.create_field(3, "Planned Amount", self.planned_amount_var, "entry")

        # Currency
        self.create_field(4, "Currency", self.currency_var, "entry")

        # Status
        self.create_field(5, "Status", self.status_var, "combobox",
                         ["scheduled", "completed", "failed", "cancelled"])

        # Planned Date
        self.create_field(6, "Planned Date", self.planned_date_var, "date")

        # Actual Date
        self.create_field(7, "Actual Date", self.actual_date_var, "date")

        # Comment
        self.create_field(8, "Comment", self.comment_var, "text")

        # Buttons
        self.setup_buttons(9)

    def on_ok(self) -> None:
        """Handle OK button"""
        deal_name = self.deal_id_var.get().strip()
        policy_name = self.policy_id_var.get().strip()
        planned_amount = self.planned_amount_var.get().strip()

        if not deal_name:
            messagebox.showerror("Error", "Deal must be selected.", parent=self)
            return

        if not policy_name:
            messagebox.showerror("Error", "Policy must be selected.", parent=self)
            return

        if not planned_amount:
            messagebox.showerror("Error", "Planned Amount cannot be empty.", parent=self)
            return

        deal_id = self.deal_dict.get(deal_name)
        policy_id = self.policy_dict.get(policy_name)

        if not deal_id or not policy_id:
            messagebox.showerror("Error", "Invalid deal or policy selected.", parent=self)
            return

        comment = self.get_text_value(self.comment_var)

        self.result = {
            "deal_id": deal_id,
            "policy_id": policy_id,
            "sequence": int(self.sequence_var.get()) if self.sequence_var.get() else None,
            "status": self.status_var.get(),
            "planned_date": self.planned_date_var.get() if self.planned_date_var.get() else None,
            "actual_date": self.actual_date_var.get() if self.actual_date_var.get() else None,
            "planned_amount": float(planned_amount),
            "currency": self.currency_var.get(),
            "comment": comment
        }
        self.destroy()


# --- Policy Edit Dialog ---

class PolicyEditDialog(BaseEditDialog):
    """Dialog for adding/editing policies"""

    def __init__(self, parent, policy=None, clients_list: List[Dict[str, Any]] = None,
                 deals_list: List[Dict[str, Any]] = None):
        super().__init__(parent, "Edit Policy" if policy else "Add Policy", policy)
        self.clients_list = clients_list or []
        self.deals_list = deals_list or []
        self.client_dict = {c.get("name", f"Client {c.get('id')}"): c.get("id") for c in self.clients_list}
        self.deal_dict = {d.get("title", f"Deal {d.get('id')}"): d.get("id") for d in self.deals_list}

        self.policy_number_var = tk.StringVar(value=policy.get("policy_number", "") if policy else "")
        self.client_id_var = tk.StringVar()
        self.deal_id_var = tk.StringVar()
        self.status_var = tk.StringVar(value=policy.get("status", "draft") if policy else "draft")
        self.premium_var = tk.StringVar(value=str(policy.get("premium", "")) if policy else "")
        self.effective_from_var = tk.StringVar(value=policy.get("effective_from", "") if policy else "")
        self.effective_to_var = tk.StringVar(value=policy.get("effective_to", "") if policy else "")

        # Set dropdowns to current values
        if policy:
            if policy.get("client_id"):
                client_name = next((c.get("name") for c in self.clients_list if c.get("id") == policy.get("client_id")), None)
                if client_name:
                    self.client_id_var.set(client_name)
            if policy.get("deal_id"):
                deal_name = next((d.get("title") for d in self.deals_list if d.get("id") == policy.get("deal_id")), None)
                if deal_name:
                    self.deal_id_var.set(deal_name)

        # Policy Number
        self.create_field(0, "Policy Number", self.policy_number_var, "entry")

        # Client
        self.create_field(1, "Client", self.client_id_var, "combobox",
                         list(self.client_dict.keys()))

        # Deal
        self.create_field(2, "Deal", self.deal_id_var, "combobox",
                         list(self.deal_dict.keys()))

        # Status
        self.create_field(3, "Status", self.status_var, "combobox",
                         ["draft", "active", "inactive"])

        # Premium
        self.create_field(4, "Premium", self.premium_var, "entry")

        # Effective From
        self.create_field(5, "Effective From", self.effective_from_var, "date")

        # Effective To
        self.create_field(6, "Effective To", self.effective_to_var, "date")

        # Buttons
        self.setup_buttons(7)

    def on_ok(self) -> None:
        """Handle OK button"""
        policy_number = self.policy_number_var.get().strip()
        client_name = self.client_id_var.get().strip()

        if not policy_number:
            messagebox.showerror("Error", "Policy Number cannot be empty.", parent=self)
            return

        if not client_name:
            messagebox.showerror("Error", "Client must be selected.", parent=self)
            return

        client_id = self.client_dict.get(client_name)
        deal_id = self.deal_dict.get(self.deal_id_var.get().strip()) if self.deal_id_var.get().strip() else None

        if not client_id:
            messagebox.showerror("Error", "Invalid client selected.", parent=self)
            return

        self.result = {
            "policy_number": policy_number,
            "client_id": client_id,
            "deal_id": deal_id,
            "status": self.status_var.get(),
            "premium": float(self.premium_var.get()) if self.premium_var.get() else None,
            "effective_from": self.effective_from_var.get() if self.effective_from_var.get() else None,
            "effective_to": self.effective_to_var.get() if self.effective_to_var.get() else None
        }
        self.destroy()


# --- Calculation Edit Dialog ---

class CalculationEditDialog(BaseEditDialog):
    """Dialog for adding/editing calculations"""

    def __init__(self, parent, calculation=None, deals_list: List[Dict[str, Any]] = None):
        super().__init__(parent, "Edit Calculation" if calculation else "Add Calculation", calculation)
        self.deals_list = deals_list or []
        self.deal_dict = {d.get("title", f"Deal {d.get('id')}"): d.get("id") for d in self.deals_list}

        self.deal_id_var = tk.StringVar()
        self.insurance_company_var = tk.StringVar(value=calculation.get("insurance_company", "") if calculation else "")
        self.program_name_var = tk.StringVar(value=calculation.get("program_name", "") if calculation else "")
        self.premium_amount_var = tk.StringVar(value=str(calculation.get("premium_amount", "")) if calculation else "")
        self.coverage_sum_var = tk.StringVar(value=str(calculation.get("coverage_sum", "")) if calculation else "")
        self.calculation_date_var = tk.StringVar(value=calculation.get("calculation_date", "") if calculation else "")
        self.status_var = tk.StringVar(value=calculation.get("status", "draft") if calculation else "draft")
        self.comments_var = tk.StringVar(value=calculation.get("comments", "") if calculation else "")

        # Set deal dropdown to current value
        if calculation and calculation.get("deal_id"):
            deal_name = next((d.get("title") for d in self.deals_list if d.get("id") == calculation.get("deal_id")), None)
            if deal_name:
                self.deal_id_var.set(deal_name)

        # Deal
        self.create_field(0, "Deal", self.deal_id_var, "combobox",
                         list(self.deal_dict.keys()))

        # Insurance Company
        self.create_field(1, "Insurance Company", self.insurance_company_var, "entry")

        # Program Name
        self.create_field(2, "Program Name", self.program_name_var, "entry")

        # Premium Amount
        self.create_field(3, "Premium Amount", self.premium_amount_var, "entry")

        # Coverage Sum
        self.create_field(4, "Coverage Sum", self.coverage_sum_var, "entry")

        # Calculation Date
        self.create_field(5, "Calculation Date", self.calculation_date_var, "date")

        # Status
        self.create_field(6, "Status", self.status_var, "combobox",
                         ["draft", "ready", "confirmed", "archived"])

        # Comments
        self.create_field(7, "Comments", self.comments_var, "text")

        # Buttons
        self.setup_buttons(8)

    def on_ok(self) -> None:
        """Handle OK button"""
        insurance_company = self.insurance_company_var.get().strip()

        if not insurance_company:
            messagebox.showerror("Error", "Insurance Company cannot be empty.", parent=self)
            return

        deal_name = self.deal_id_var.get().strip()
        deal_id = self.deal_dict.get(deal_name) if deal_name else None

        comments = self.get_text_value(self.comments_var)

        self.result = {
            "deal_id": deal_id,
            "insurance_company": insurance_company,
            "program_name": self.program_name_var.get().strip(),
            "premium_amount": float(self.premium_amount_var.get()) if self.premium_amount_var.get() else None,
            "coverage_sum": float(self.coverage_sum_var.get()) if self.coverage_sum_var.get() else None,
            "calculation_date": self.calculation_date_var.get() if self.calculation_date_var.get() else None,
            "status": self.status_var.get(),
            "comments": comments
        }
        self.destroy()


class TaskEditDialog(BaseEditDialog):
    """Dialog for adding/editing tasks"""

    def __init__(self, parent, task=None, deals_list: List[Dict[str, Any]] = None):
        super().__init__(parent, "Edit Task" if task else "Add Task", task)
        self.deals_list = deals_list or []
        self.deal_dict = {f"{d.get('title', '')} (ID: {d.get('id', '')[:8]}...)": d.get('id')
                         for d in self.deals_list}

        # Initialize variables
        self.title_var = tk.StringVar(value=task.get("title", "") if task else "")
        self.description_var = tk.StringVar(value=task.get("description", "") if task else "")
        self.status_var = tk.StringVar(value=task.get("status", "open") if task else "open")
        self.priority_var = tk.StringVar(value=task.get("priority", "normal") if task else "normal")
        self.due_date_var = tk.StringVar(value=task.get("due_date", "") if task else "")

        # Title field
        self.create_field(0, "Title", self.title_var, "entry")

        # Description field
        self.create_field(1, "Description", self.description_var, "text")

        # Status field
        self.create_field(2, "Status", self.status_var, "combobox",
                         values=["open", "in_progress", "completed", "closed"])

        # Priority field
        self.create_field(3, "Priority", self.priority_var, "combobox",
                         values=["low", "normal", "high", "urgent"])

        # Due Date field
        self.create_field(4, "Due Date (YYYY-MM-DD)", self.due_date_var, "entry")

        # Buttons
        button_frame = ttk.Frame(self)
        button_frame.grid(row=5, columnspan=2, pady=10)

        ttk.Button(button_frame, text="OK", command=self.on_ok).pack(side="left", padx=5)
        ttk.Button(button_frame, text="Cancel", command=self.destroy).pack(side="left", padx=5)

        self.geometry("500x450")
        self.grab_set()
        self.wait_window(self)

    def on_ok(self):
        """Handle OK button"""
        title = self.title_var.get().strip()
        if not title:
            messagebox.showerror("Error", "Title cannot be empty.", parent=self)
            return

        description = self.get_text_value(self.description_var)
        due_date = self.due_date_var.get().strip()

        self.result = {
            "title": title,
            "description": description,
            "status": self.status_var.get(),
            "priority": self.priority_var.get(),
            "due_date": due_date if due_date else None
        }
        self.destroy()
