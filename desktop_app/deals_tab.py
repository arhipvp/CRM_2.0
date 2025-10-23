"""Deals management tab component"""
import tkinter as tk
from tkinter import ttk, messagebox
from threading import Thread
from typing import Optional

from crm_service import CRMService
from logger import logger


class DealsTab:
    """Tab for managing deals"""

    def __init__(self, parent: ttk.Frame, crm_service: CRMService):
        self.parent = parent
        self.crm_service = crm_service
        self.tree: Optional[ttk.Treeview] = None

        self._setup_ui()
        self.refresh_tree()

    def _setup_ui(self):
        """Setup Deals tab UI"""
        # Frame for Treeview and Scrollbar
        tree_frame = tk.Frame(self.parent)
        tree_frame.pack(pady=10, padx=10, fill="both", expand=True)

        self.tree = ttk.Treeview(
            tree_frame,
            columns=("ID", "Title", "Client ID", "Status", "Amount"),
            show="headings"
        )
        self.tree.heading("ID", text="ID")
        self.tree.heading("Title", text="Deal Title")
        self.tree.heading("Client ID", text="Client")
        self.tree.heading("Status", text="Status")
        self.tree.heading("Amount", text="Amount")

        self.tree.column("ID", width=50, anchor="center")
        self.tree.column("Title", width=200)
        self.tree.column("Client ID", width=100)
        self.tree.column("Status", width=100)
        self.tree.column("Amount", width=100)

        scrollbar = ttk.Scrollbar(tree_frame, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=scrollbar.set)

        self.tree.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        # Frame for buttons
        button_frame = tk.Frame(self.parent)
        button_frame.pack(pady=10)

        tk.Button(button_frame, text="Add Deal", command=self.add_deal).pack(side="left", padx=5)
        tk.Button(button_frame, text="Edit", command=self.edit_deal).pack(side="left", padx=5)
        tk.Button(button_frame, text="Delete", command=self.delete_deal).pack(side="left", padx=5)

    def refresh_tree(self):
        """Refresh deals list asynchronously"""
        def worker():
            try:
                deals = self.crm_service.get_deals()
                self.parent.after(0, self._update_tree_ui, deals)
            except Exception as e:
                logger.error(f"Failed to fetch deals: {e}")
                self.parent.after(0, lambda: messagebox.showerror("Error", f"Failed to fetch deals: {e}"))

        Thread(target=worker, daemon=True).start()

    def _update_tree_ui(self, deals):
        """Update tree UI on main thread"""
        if not self.tree:
            return
        for i in self.tree.get_children():
            self.tree.delete(i)
        for deal in deals:
            self.tree.insert("", "end", values=(
                deal.get("id"),
                deal.get("title", "N/A"),
                deal.get("client_id", "N/A"),
                deal.get("status", "N/A"),
                deal.get("amount", "N/A")
            ))

    def add_deal(self):
        """Add new deal"""
        messagebox.showinfo("Coming Soon", "Deal creation feature coming soon!")

    def edit_deal(self):
        """Edit selected deal"""
        if not self.tree:
            return
        selected_item = self.tree.focus()
        if not selected_item:
            messagebox.showwarning("Warning", "Please select a deal to edit.")
            return
        messagebox.showinfo("Coming Soon", "Deal editing feature coming soon!")

    def delete_deal(self):
        """Delete selected deal"""
        if not self.tree:
            return
        selected_item = self.tree.focus()
        if not selected_item:
            messagebox.showwarning("Warning", "Please select a deal to delete.")
            return
        messagebox.showinfo("Coming Soon", "Deal deletion feature coming soon!")
