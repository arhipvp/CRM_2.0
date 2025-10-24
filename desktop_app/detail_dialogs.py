"""Detail dialogs for viewing and editing CRM entities"""
import tkinter as tk
from tkinter import ttk, messagebox
from typing import Optional, Dict, Any
from datetime import datetime
from i18n import i18n


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
    """Dialog for viewing/editing deal details"""

    def __init__(self, parent, deal_data: Dict[str, Any]):
        super().__init__(parent)
        self.transient(parent)
        self.title(i18n("Deal Details"))
        self.geometry("700x600")
        self.deal_data = deal_data

        self._create_widgets()

    def _create_widgets(self):
        """Create detail dialog widgets"""
        notebook = ttk.Notebook(self)
        notebook.pack(fill="both", expand=True, padx=10, pady=10)

        # General Info Tab
        general_frame = ttk.Frame(notebook)
        notebook.add(general_frame, text="General Info")

        fields = [
            ("ID", self.deal_data.get("id", "N/A")),
            ("Title", self.deal_data.get("title", "N/A")),
            ("Client ID", self.deal_data.get("client_id", "N/A")),
            ("Status", self.deal_data.get("status", "N/A")),
            ("Amount", self.deal_data.get("amount", "N/A")),
            ("Next Review Date", self.deal_data.get("next_review_at", "N/A")),
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
        desc_text.insert("end", self.deal_data.get("description", ""))
        desc_text.config(state="disabled")

        # Timestamps Tab
        timestamps_frame = ttk.Frame(notebook)
        notebook.add(timestamps_frame, text="Timestamps")

        ts_fields = [
            ("Created At", self.deal_data.get("created_at", "N/A")),
            ("Updated At", self.deal_data.get("updated_at", "N/A")),
            ("Is Deleted", "Yes" if self.deal_data.get("is_deleted") else "No"),
        ]

        for i, (label, value) in enumerate(ts_fields):
            ttk.Label(timestamps_frame, text=f"{label}:").grid(row=i, column=0, sticky="w", padx=10, pady=5)
            ttk.Label(timestamps_frame, text=str(value)).grid(row=i, column=1, sticky="w", padx=10, pady=5)

        # Close button
        ttk.Button(self, text=i18n("Close"), command=self.destroy).pack(pady=10)


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
