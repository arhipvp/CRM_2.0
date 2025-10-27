"""Edit dialogs for all CRM entities"""
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from typing import Optional, Dict, Any, List
from datetime import datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from i18n import i18n
from document_utils import copy_files_to_deal_folder, open_deal_folder
from priority_utils import ALLOWED_PRIORITIES, DEFAULT_PRIORITY, normalize_priority


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

        tk.Button(button_frame, text=i18n("OK"), command=self.on_ok, width=10).pack(side="left", padx=5)
        tk.Button(button_frame, text=i18n("Cancel"), command=self.destroy, width=10).pack(side="left", padx=5)

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
                    messagebox.showerror(i18n("Error"), f"{field_label} cannot be empty.", parent=self)
                    return False
        return True


# --- Deal Edit Dialog ---

class DealEditDialog(BaseEditDialog):
    """Dialog for adding/editing deals"""

    def __init__(self, parent, crm_service, deal=None, clients_list: List[Dict[str, Any]] = None,
                 users_list: List[Dict[str, Any]] = None):
        super().__init__(parent, i18n("Edit Deal") if deal else i18n("Add Deal"), deal)
        self.crm_service = crm_service
        self.clients_list = clients_list or []
        self.users_list = users_list or []
        self.client_dict = {c.get("name", f"Client {c.get('id')}"): c.get("id") for c in self.clients_list}
        self.owner_dict = {}
        for user in self.users_list:
            user_id = user.get("id")
            if not user_id:
                continue
            display_name = user.get("full_name") or user.get("email") or i18n("User")
            display_label = f"{display_name} (ID: {user_id[:8]}...)"
            self.owner_dict[display_label] = user_id

        self.title_var = tk.StringVar(value=deal.get("title", "") if deal else "")
        self.client_id_var = tk.StringVar()
        self.description_var = tk.StringVar(value=deal.get("description", "") if deal else "")
        self.status_var = tk.StringVar(value=deal.get("status", "draft") if deal else "draft")
        self.next_review_var = tk.StringVar(value=deal.get("next_review_at", "") if deal else "")
        self.owner_id_var = tk.StringVar()

        # Set client dropdown to current value
        if deal and deal.get("client_id"):
            client_name = next((c.get("name") for c in self.clients_list if c.get("id") == deal.get("client_id")), None)
            if client_name:
                self.client_id_var.set(client_name)

        if deal and deal.get("owner_id"):
            owner_display = next((label for label, value in self.owner_dict.items() if value == deal.get("owner_id")), "")
            if owner_display:
                self.owner_id_var.set(owner_display)

        # Title
        self.create_field(0, i18n("Title"), self.title_var, "entry")

        # Client
        self.create_field(1, i18n("Client"), self.client_id_var, "combobox",
                         list(self.client_dict.keys()))

        # Description
        self.create_field(2, i18n("Description"), self.description_var, "text")

        # Status
        self.create_field(3, i18n("Status"), self.status_var, "combobox",
                         ["draft", "in_progress", "won", "lost"])

        # Owner
        self.create_field(4, i18n("Owner"), self.owner_id_var, "combobox",
                         list(self.owner_dict.keys()))

        # Next Review Date
        self.create_field(5, "Next Review Date", self.next_review_var, "date")

        # Buttons
        self.setup_buttons(6)

    def on_ok(self) -> None:
        """Handle OK button"""
        title = self.title_var.get().strip()
        client_name = self.client_id_var.get().strip()

        if not title:
            messagebox.showerror(i18n("Error"), "Title cannot be empty.", parent=self)
            return

        if not client_name:
            messagebox.showerror(i18n("Error"), "Client must be selected.", parent=self)
            return

        client_id = self.client_dict.get(client_name)
        if not client_id:
            messagebox.showerror(i18n("Error"), "Invalid client selected.", parent=self)
            return

        description = self.get_text_value(self.description_var)
        owner_label = self.owner_id_var.get().strip()

        if owner_label and owner_label not in self.owner_dict:
            messagebox.showerror(i18n("Error"), "Invalid owner selected.", parent=self)
            return

        next_review_raw = self.next_review_var.get().strip()
        if not next_review_raw:
            messagebox.showerror(i18n("Error"), i18n("Next review date is required."), parent=self)
            return

        try:
            datetime.strptime(next_review_raw, "%Y-%m-%d")
        except ValueError:
            messagebox.showerror(
                i18n("Error"),
                i18n("Next review date must be in YYYY-MM-DD format."),
                parent=self,
            )
            return

        self.result = {
            "title": title,
            "client_id": client_id,
            "description": description,
            "status": self.status_var.get(),
            "next_review_at": next_review_raw,
            "owner_id": self.owner_dict.get(owner_label) if owner_label else None
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
        self.selected_deal_id: Optional[str] = payment.get("deal_id") if payment else None
        self.policy_id_var = tk.StringVar()
        self.sequence_var = tk.StringVar(value=str(payment.get("sequence", "")) if payment else "")
        self.status_var = tk.StringVar(value=payment.get("status", "scheduled") if payment else "scheduled")
        self.planned_date_var = tk.StringVar(value=payment.get("planned_date", "") if payment else "")
        self.actual_date_var = tk.StringVar(value=payment.get("actual_date", "") if payment else "")
        self.planned_amount_var = tk.StringVar(value=str(payment.get("planned_amount", "")) if payment else "")
        self.currency_var = tk.StringVar(value=payment.get("currency", "RUB") if payment else "RUB")
        self.comment_var = tk.StringVar(value=payment.get("comment", "") if payment else "")
        incomes_initial = self._format_decimal_value(payment.get("incomes_total")) if payment else "0.00"
        expenses_initial = self._format_decimal_value(payment.get("expenses_total")) if payment else "0.00"
        self.incomes_total_var = tk.StringVar(value=incomes_initial)
        self.expenses_total_var = tk.StringVar(value=expenses_initial)
        self.net_total_var = tk.StringVar()

        # Set dropdowns to current values
        if payment:
            if payment.get("deal_id"):
                self.selected_deal_id = payment.get("deal_id")
                deal_name = next((d.get("title") for d in self.deals_list if d.get("id") == self.selected_deal_id), None)
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

        # Incomes Total
        self.create_field(4, "Incomes Total", self.incomes_total_var, "entry")

        # Expenses Total
        self.create_field(5, "Expenses Total", self.expenses_total_var, "entry")

        # Net Total (calculated)
        ttk.Label(self, text="Net Total:").grid(row=6, column=0, sticky="w", padx=10, pady=5)
        ttk.Label(self, textvariable=self.net_total_var).grid(row=6, column=1, sticky="w", padx=10, pady=5)

        # Currency
        self.create_field(7, "Currency", self.currency_var, "entry")

        # Status
        self.create_field(8, "Status", self.status_var, "combobox",
                         ["scheduled", "completed", "failed", "cancelled"])

        # Planned Date
        self.create_field(9, "Planned Date", self.planned_date_var, "date")

        # Actual Date
        self.create_field(10, "Actual Date", self.actual_date_var, "date")

        # Comment
        self.create_field(11, "Comment", self.comment_var, "text")

        # Setup total change tracking
        self.incomes_total_var.trace_add("write", self._on_totals_changed)
        self.expenses_total_var.trace_add("write", self._on_totals_changed)
        self._update_net_total()

        # Buttons
        self.setup_buttons(12)

    def on_ok(self) -> None:
        """Handle OK button"""
        deal_name = self.deal_id_var.get().strip()
        policy_name = self.policy_id_var.get().strip()
        planned_amount = self.planned_amount_var.get().strip()
        incomes_total_raw = self.incomes_total_var.get().strip()
        expenses_total_raw = self.expenses_total_var.get().strip()

        if not deal_name:
            messagebox.showerror(i18n("Error"), "Deal must be selected.", parent=self)
            return

        if not policy_name:
            messagebox.showerror(i18n("Error"), "Policy must be selected.", parent=self)
            return

        if not planned_amount:
            messagebox.showerror(i18n("Error"), "Planned Amount cannot be empty.", parent=self)
            return

        deal_id = self.deal_dict.get(deal_name)
        policy_id = self.policy_dict.get(policy_name)

        if not deal_id or not policy_id:
            messagebox.showerror(i18n("Error"), "Invalid deal or policy selected.", parent=self)
            return

        self.selected_deal_id = deal_id

        incomes_total = self._parse_decimal(incomes_total_raw)
        if incomes_total is None:
            messagebox.showerror(i18n("Error"), "Incomes Total must be a valid number.", parent=self)
            return

        expenses_total = self._parse_decimal(expenses_total_raw)
        if expenses_total is None:
            messagebox.showerror(i18n("Error"), "Expenses Total must be a valid number.", parent=self)
            return

        incomes_total = incomes_total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        expenses_total = expenses_total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        net_total = (incomes_total - expenses_total).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        comment = self.get_text_value(self.comment_var)

        self.result = {
            "policy_id": policy_id,
            "sequence": int(self.sequence_var.get()) if self.sequence_var.get() else None,
            "status": self.status_var.get(),
            "planned_date": self.planned_date_var.get() if self.planned_date_var.get() else None,
            "actual_date": self.actual_date_var.get() if self.actual_date_var.get() else None,
            "planned_amount": float(planned_amount),
            "currency": self.currency_var.get(),
            "comment": comment,
            "incomes_total": f"{incomes_total:.2f}",
            "expenses_total": f"{expenses_total:.2f}",
            "net_total": f"{net_total:.2f}"
        }
        self.destroy()

    def _format_decimal_value(self, value: Any) -> str:
        """Format decimal-like values for entry fields"""
        if value is None:
            return "0.00"
        if isinstance(value, (int, float, Decimal)):
            return f"{Decimal(str(value)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP):.2f}"
        string_value = str(value).strip()
        if not string_value:
            return "0.00"
        string_value = string_value.replace(",", ".")
        try:
            decimal_value = Decimal(string_value)
        except InvalidOperation:
            return "0.00"
        return f"{decimal_value.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP):.2f}"

    def _parse_decimal(self, value: str) -> Optional[Decimal]:
        """Parse user input into Decimal"""
        normalized = (value or "").strip().replace(",", ".")
        if not normalized:
            return Decimal("0")
        try:
            return Decimal(normalized)
        except InvalidOperation:
            return None

    def _on_totals_changed(self, *_):
        """Update net total when incomes or expenses change"""
        self._update_net_total()

    def _update_net_total(self):
        """Recalculate net total value"""
        incomes = self._parse_decimal(self.incomes_total_var.get())
        expenses = self._parse_decimal(self.expenses_total_var.get())
        if incomes is None or expenses is None:
            self.net_total_var.set("")
            return
        try:
            net_total = (incomes - expenses).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        except InvalidOperation:
            self.net_total_var.set("")
            return
        self.net_total_var.set(f"{net_total:.2f}")


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

        # Effective From
        self.create_field(4, "Effective From", self.effective_from_var, "date")

        # Effective To
        self.create_field(5, "Effective To", self.effective_to_var, "date")

        # Buttons
        self.setup_buttons(6)

    def on_ok(self) -> None:
        """Handle OK button"""
        policy_number = self.policy_number_var.get().strip()
        client_name = self.client_id_var.get().strip()

        if not policy_number:
            messagebox.showerror(i18n("Error"), "Policy Number cannot be empty.", parent=self)
            return

        if not client_name:
            messagebox.showerror(i18n("Error"), "Client must be selected.", parent=self)
            return

        client_id = self.client_dict.get(client_name)
        deal_id = self.deal_dict.get(self.deal_id_var.get().strip()) if self.deal_id_var.get().strip() else None

        if not client_id:
            messagebox.showerror(i18n("Error"), "Invalid client selected.", parent=self)
            return

        self.result = {
            "policy_number": policy_number,
            "client_id": client_id,
            "deal_id": deal_id,
            "status": self.status_var.get(),
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
        self.selected_deal_id: Optional[str] = calculation.get("deal_id") if calculation else None
        self.insurance_company_var = tk.StringVar(value=calculation.get("insurance_company", "") if calculation else "")
        self.program_name_var = tk.StringVar(value=calculation.get("program_name", "") if calculation else "")
        self.premium_amount_var = tk.StringVar(value=str(calculation.get("premium_amount", "")) if calculation else "")
        self.coverage_sum_var = tk.StringVar(value=str(calculation.get("coverage_sum", "")) if calculation else "")
        self.calculation_date_var = tk.StringVar(value=calculation.get("calculation_date", "") if calculation else "")
        self.status_var = tk.StringVar(value=calculation.get("status", "draft") if calculation else "draft")
        self.comments_var = tk.StringVar(value=calculation.get("comments", "") if calculation else "")
        self.selected_files: List[str] = list(calculation.get("files", [])) if calculation else []

        # Set deal dropdown to current value
        if calculation and calculation.get("deal_id"):
            deal_name = next((d.get("title") for d in self.deals_list if d.get("id") == self.selected_deal_id), None)
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

        # Files management
        ttk.Label(self, text=f"{i18n('Files')}:").grid(row=8, column=0, sticky="nw", padx=10, pady=5)

        self.files_listbox = tk.Listbox(self, height=5)
        self.files_listbox.grid(row=8, column=1, sticky="nsew", padx=10, pady=5)

        files_button_frame = ttk.Frame(self)
        files_button_frame.grid(row=8, column=2, sticky="ns", padx=5, pady=5)

        ttk.Button(files_button_frame, text=i18n("Add"), command=self._on_add_files).pack(fill="x", pady=2)
        ttk.Button(files_button_frame, text=i18n("Remove"), command=self._on_remove_files).pack(fill="x", pady=2)
        ttk.Button(files_button_frame, text=i18n("Open"), command=self._on_open_folder).pack(fill="x", pady=2)

        self._refresh_files_listbox()

        # Buttons
        self.setup_buttons(9)

    def on_ok(self) -> None:
        """Handle OK button"""
        insurance_company = self.insurance_company_var.get().strip()

        if not insurance_company:
            messagebox.showerror(i18n("Error"), "Insurance Company cannot be empty.", parent=self)
            return

        deal_name = self.deal_id_var.get().strip()
        deal_id = self.deal_dict.get(deal_name) if deal_name else None
        self.selected_deal_id = deal_id

        comments = self.get_text_value(self.comments_var)

        self.result = {
            "insurance_company": insurance_company,
            "program_name": self.program_name_var.get().strip(),
            "premium_amount": float(self.premium_amount_var.get()) if self.premium_amount_var.get() else None,
            "coverage_sum": float(self.coverage_sum_var.get()) if self.coverage_sum_var.get() else None,
            "calculation_date": self.calculation_date_var.get() if self.calculation_date_var.get() else None,
            "status": self.status_var.get(),
            "comments": comments,
            "files": list(self.selected_files),
        }
        self.destroy()

    def _refresh_files_listbox(self) -> None:
        self.files_listbox.delete(0, "end")
        for path in self.selected_files:
            self.files_listbox.insert("end", path)

    def _on_add_files(self) -> None:
        deal_name = self.deal_id_var.get().strip()
        deal_id = self.deal_dict.get(deal_name)
        if not deal_id:
            messagebox.showwarning(i18n("Warning"), i18n("Please select a deal first"), parent=self)
            return

        file_paths = filedialog.askopenfilenames(parent=self, title=i18n("Select files"))
        if not file_paths:
            return

        copied = copy_files_to_deal_folder(deal_id, file_paths)
        new_items = [path for path in copied if path not in self.selected_files]
        if new_items:
            self.selected_files.extend(new_items)
            self._refresh_files_listbox()

    def _on_remove_files(self) -> None:
        selection = list(self.files_listbox.curselection())
        if not selection:
            messagebox.showinfo(i18n("Info"), i18n("Select file to remove"), parent=self)
            return
        for index in reversed(selection):
            try:
                del self.selected_files[index]
            except IndexError:
                continue
        self._refresh_files_listbox()

    def _on_open_folder(self) -> None:
        deal_name = self.deal_id_var.get().strip()
        deal_id = self.deal_dict.get(deal_name)
        if not deal_id:
            messagebox.showwarning(i18n("Warning"), i18n("Please select a deal first"), parent=self)
            return
        open_deal_folder(deal_id)


class TaskEditDialog(BaseEditDialog):
    """Dialog for adding/editing tasks"""

    def __init__(self, parent, task=None, deals_list: List[Dict[str, Any]] = None,
                 clients_list: List[Dict[str, Any]] = None, users_list: List[Dict[str, Any]] = None):
        super().__init__(parent, "Edit Task" if task else "Add Task", task)
        self.deals_list = deals_list or []
        self.clients_list = clients_list or []
        self.users_list = users_list or []
        self.deal_dict = {
            f"{d.get('title', '') or 'Deal'} (ID: {d.get('id', '')[:8]}...)": d.get('id')
            for d in self.deals_list
            if d.get('id')
        }
        self.client_dict = {
            f"{c.get('name', '') or 'Client'} (ID: {c.get('id', '')[:8]}...)": c.get('id')
            for c in self.clients_list
            if c.get('id')
        }
        self.user_dict = {}
        for user in self.users_list:
            user_id = user.get('id')
            if not user_id:
                continue
            display_name = user.get('full_name') or user.get('email') or 'User'
            display_label = f"{display_name} (ID: {user_id[:8]}...)"
            self.user_dict[display_label] = user_id

        # Initialize variables
        self.title_var = tk.StringVar(value=task.get("title", "") if task else "")
        self.description_var = tk.StringVar(value=task.get("description", "") if task else "")
        self.status_var = tk.StringVar(
            value=self._normalize_status_value(
                task.get("status_code") if task else None,
                fallback=task.get("status") if task else None,
                default="pending",
            )
        )
        self.priority_var = tk.StringVar(value=task.get("priority", "normal") if task else "normal")
        self.due_date_var = tk.StringVar(value=task.get("due_date", "") if task else "")
        self.deal_id_var = tk.StringVar()
        self.client_id_var = tk.StringVar()
        self.owner_id_var = tk.StringVar()

        if task:
            if task.get("deal_id"):
                deal_display = next(
                    (label for label, value in self.deal_dict.items() if value == task.get("deal_id")),
                    ""
                )
                if deal_display:
                    self.deal_id_var.set(deal_display)
            if task.get("client_id"):
                client_display = next(
                    (label for label, value in self.client_dict.items() if value == task.get("client_id")),
                    ""
                )
                if client_display:
                    self.client_id_var.set(client_display)
            if task.get("owner_id"):
                owner_display = next(
                    (label for label, value in self.user_dict.items() if value == task.get("owner_id")),
                    "",
                )
                if owner_display:
                    self.owner_id_var.set(owner_display)

        # Title field
        self.create_field(0, "Title", self.title_var, "entry")

        # Description field
        self.create_field(1, "Description", self.description_var, "text")

        # Deal field
        self.create_field(2, "Deal", self.deal_id_var, "combobox", list(self.deal_dict.keys()))

        # Client field
        self.create_field(3, "Client", self.client_id_var, "combobox", list(self.client_dict.keys()))

        # Owner field
        self.create_field(4, "Owner", self.owner_id_var, "combobox", list(self.user_dict.keys()))

        # Status field
        self.create_field(
            5,
            "Status",
            self.status_var,
            "combobox",
            values=["pending", "scheduled", "in_progress", "completed", "cancelled"],
        )

        # Priority field
        self.create_field(6, "Priority", self.priority_var, "combobox",
                         values=list(ALLOWED_PRIORITIES))

        # Due Date field
        self.create_field(7, "Due Date (YYYY-MM-DD)", self.due_date_var, "entry")

        # Buttons
        button_frame = ttk.Frame(self)
        button_frame.grid(row=8, columnspan=2, pady=10)

        ttk.Button(button_frame, text=i18n("OK"), command=self.on_ok).pack(side="left", padx=5)
        ttk.Button(button_frame, text=i18n("Cancel"), command=self.destroy).pack(side="left", padx=5)

        self.geometry("500x560")
        self.grab_set()
        self.wait_window(self)

    def on_ok(self):
        """Handle OK button"""
        title = self.title_var.get().strip()
        if not title:
            messagebox.showerror(i18n("Error"), "Title cannot be empty.", parent=self)
            return

        description = self.get_text_value(self.description_var)
        due_date = self.due_date_var.get().strip()
        deal_label = self.deal_id_var.get().strip()
        client_label = self.client_id_var.get().strip()
        owner_label = self.owner_id_var.get().strip()

        if deal_label and deal_label not in self.deal_dict:
            messagebox.showerror("Error", "Invalid deal selected.", parent=self)
            return

        if client_label and client_label not in self.client_dict:
            messagebox.showerror("Error", "Invalid client selected.", parent=self)
            return

        if owner_label and owner_label not in self.user_dict:
            messagebox.showerror("Error", "Invalid owner selected.", parent=self)
            return

        selected_priority = normalize_priority(self.priority_var.get())
        self.priority_var.set(selected_priority)

        self.result = {
            "title": title,
            "description": description,
            "status": self.status_var.get(),
            "priority": selected_priority,
            "due_date": due_date if due_date else None,
            "deal_id": self.deal_dict.get(deal_label) if deal_label else None,
            "client_id": self.client_dict.get(client_label) if client_label else None,
            "owner_id": self.user_dict.get(owner_label) if owner_label else None,
        }
        self.destroy()

    @staticmethod
    def _normalize_status_value(status_code: Optional[str], *, fallback: Optional[str] = None,
                                default: str = "pending") -> str:
        """Normalize status value to allowed status code."""
        if status_code:
            normalized = TaskEditDialog._to_status_code(status_code)
            if normalized:
                return normalized
        if fallback:
            normalized = TaskEditDialog._to_status_code(fallback)
            if normalized:
                return normalized
        return default

    @staticmethod
    def _to_status_code(value: Optional[str]) -> Optional[str]:
        if not value:
            return None
        trimmed = value.strip()
        if not trimmed:
            return None
        lowered = trimmed.lower().replace(" ", "_")
        allowed = {"pending", "scheduled", "in_progress", "completed", "cancelled"}
        if lowered in allowed:
            return lowered
        return None
