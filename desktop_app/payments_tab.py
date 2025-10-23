"""Payments management tab component"""
import tkinter as tk
from tkinter import ttk, messagebox
from threading import Thread
from typing import Optional

from crm_service import CRMService
from logger import logger


class PaymentsTab:
    """Tab for viewing payments"""

    def __init__(self, parent: ttk.Frame, crm_service: CRMService):
        self.parent = parent
        self.crm_service = crm_service
        self.tree: Optional[ttk.Treeview] = None
        self.current_deal_id: Optional[str] = None

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

        # Frame for Treeview and Scrollbar
        tree_frame = tk.Frame(self.parent)
        tree_frame.pack(pady=10, padx=10, fill="both", expand=True)

        self.tree = ttk.Treeview(
            tree_frame,
            columns=("Date", "Type", "Amount", "Status"),
            show="headings"
        )
        self.tree.heading("Date", text="Date")
        self.tree.heading("Type", text="Type")
        self.tree.heading("Amount", text="Amount")
        self.tree.heading("Status", text="Status")

        self.tree.column("Date", width=100)
        self.tree.column("Type", width=100)
        self.tree.column("Amount", width=100)
        self.tree.column("Status", width=100)

        scrollbar = ttk.Scrollbar(tree_frame, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=scrollbar.set)

        self.tree.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        # Load deals
        self._load_deals()

    def _load_deals(self):
        """Load deals for dropdown"""
        def worker():
            try:
                deals = self.crm_service.get_deals()
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
                self.parent.after(0, lambda: messagebox.showerror("Error", f"Failed to fetch payments: {e}"))

        Thread(target=worker, daemon=True).start()

    def _update_tree_ui(self, payments):
        """Update tree UI on main thread"""
        if not self.tree:
            return
        for i in self.tree.get_children():
            self.tree.delete(i)
        for payment in payments:
            self.tree.insert("", "end", values=(
                payment.get("date", "N/A"),
                payment.get("type", "N/A"),
                payment.get("amount", "N/A"),
                payment.get("status", "N/A")
            ))
