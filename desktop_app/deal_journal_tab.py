"""Deal journal/notes tab component"""
import tkinter as tk
from tkinter import ttk, messagebox
from threading import Thread
from typing import Optional, List, Dict, Any
from datetime import datetime

from config import DEFAULT_JOURNAL_AUTHOR_ID
from crm_service import CRMService
from logger import logger
from table_sort_utils import treeview_sort_column


class DealJournalTab:
    """Tab for viewing and managing deal journal entries (notes)"""

    def __init__(self, parent: ttk.Frame, crm_service: CRMService, deal_id: Optional[str] = None):
        self.parent = parent
        self.crm_service = crm_service
        self.deal_id = deal_id
        self.tree: Optional[ttk.Treeview] = None
        self.current_deal_id: Optional[str] = None
        self.all_journal_entries: List[Dict[str, Any]] = []  # Store all journal entries for filtering and sorting
        self.entry_map: Dict[str, Dict[str, Any]] = {}

        self._setup_ui()

    def _setup_ui(self):
        """Setup Deal Journal tab UI"""
        # Deal selection frame
        select_frame = tk.Frame(self.parent)
        select_frame.pack(pady=5, padx=10, fill="x")

        tk.Label(select_frame, text="Select Deal:").pack(side="left", padx=5)
        self.deal_var = tk.StringVar()
        self.deal_combo = ttk.Combobox(select_frame, textvariable=self.deal_var, state="readonly", width=40)
        self.deal_combo.pack(side="left", padx=5, fill="x", expand=True)
        self.deal_combo.bind("<<ComboboxSelected>>", self._on_deal_selected)

        tk.Button(select_frame, text="Refresh", command=self._load_deals).pack(side="left", padx=5)

        # Frame for Treeview and Scrollbar
        tree_frame = tk.Frame(self.parent)
        tree_frame.pack(pady=10, padx=10, fill="both", expand=True)

        self.tree = ttk.Treeview(
            tree_frame,
            columns=("Date", "Author", "Type", "Note"),
            show="headings"
        )
        for col in ("Date", "Author", "Type", "Note"):
            self.tree.heading(col, text=col, command=lambda c=col: self._on_tree_sort(c))

        self.tree.column("Date", width=140)
        self.tree.column("Author", width=160)
        self.tree.column("Type", width=120)
        self.tree.column("Note", width=420)

        scrollbar = ttk.Scrollbar(tree_frame, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=scrollbar.set)

        self.tree.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        # Button frame
        button_frame = tk.Frame(self.parent)
        button_frame.pack(pady=10)

        tk.Button(button_frame, text="Add Note", command=self.add_note).pack(side="left", padx=5)
        tk.Button(button_frame, text="View Full Note", command=self.view_note).pack(side="left", padx=5)
        tk.Button(button_frame, text="Delete Note", command=self.delete_note).pack(side="left", padx=5)
        tk.Button(button_frame, text="Refresh", command=self.refresh_journal).pack(side="left", padx=5)

        # Load deals on init
        self._load_deals()

    def _on_tree_sort(self, col):
        display_map = {
            "Date": "created_at",
            "Author": "author_display",
            "Type": "entry_type",
            "Note": "body",
        }
        treeview_sort_column(self.tree, col, False, self.all_journal_entries, display_map)

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
            self.refresh_journal()

    def refresh_journal(self):
        """Refresh journal for selected deal"""
        if not self.current_deal_id:
            messagebox.showwarning("Warning", "Please select a deal first.")
            return

        def worker():
            try:
                data = self.crm_service.get_deal_journal(self.current_deal_id)
                items = data.get("items") if isinstance(data, dict) else data
                items = items or []
                processed_entries = [self._prepare_entry(entry) for entry in items]
                self.parent.after(0, self._update_tree_ui, processed_entries)
            except Exception as e:
                logger.error(f"Failed to fetch deal journal: {e}")
                error_msg = str(e)
                self.parent.after(0, lambda: messagebox.showerror("Error", f"Failed to fetch journal: {error_msg}"))

        Thread(target=worker, daemon=True).start()

    def _update_tree_ui(self, entries):
        """Update tree UI on main thread"""
        if not self.tree:
            return

        self.all_journal_entries = entries  # Store for sorting
        self.entry_map = {}

        for i in self.tree.get_children():
            self.tree.delete(i)
        for index, entry in enumerate(entries):
            note_preview = entry.get("body", "")[:120]
            item_id = entry.get("id") or f"entry-{index}"
            self.entry_map[item_id] = entry
            self.tree.insert(
                "",
                "end",
                iid=item_id,
                values=(
                    entry.get("date", "N/A"),
                    entry.get("author_display", entry.get("author_id", "")),
                    entry.get("entry_type", "note"),
                    note_preview,
                ),
            )

    def _prepare_entry(self, entry: Dict[str, Any]) -> Dict[str, Any]:
        """Prepare entry for UI consumption"""
        entry_id = entry.get("id")
        created_at_raw = entry.get("created_at")
        if created_at_raw:
            formatted_date = self._format_datetime(created_at_raw)
        else:
            formatted_date = "N/A"

        entry_type = entry.get("entry_type") or entry.get("type") or "note"
        body = entry.get("body") or entry.get("note", "")
        author_display = entry.get("author_name") or entry.get("author_id", "")

        return {
            **entry,
            "id": str(entry_id) if entry_id is not None else None,
            "date": formatted_date,
            "created_at": created_at_raw,
            "entry_type": entry_type,
            "body": body,
            "author_display": author_display,
        }

    @staticmethod
    def _format_datetime(value: str) -> str:
        """Format ISO datetime string to readable form"""
        try:
            normalized = value.replace("Z", "+00:00")
            dt_value = datetime.fromisoformat(normalized)
            return dt_value.strftime("%Y-%m-%d %H:%M")
        except (ValueError, TypeError):
            return value

    def add_note(self):
        """Add note to deal journal"""
        if not self.current_deal_id:
            messagebox.showwarning("Warning", "Please select a deal first.")
            return

        # Create simple input dialog
        note_window = tk.Toplevel(self.parent)
        note_window.title("Add Note to Deal")
        note_window.geometry("400x200")

        tk.Label(note_window, text="Enter note:").pack(padx=10, pady=5)
        text_widget = tk.Text(note_window, height=8, width=50)
        text_widget.pack(padx=10, pady=5, fill="both", expand=True)

        def save_note():
            note_text = text_widget.get("1.0", "end").strip()
            if not note_text:
                messagebox.showwarning("Warning", "Note cannot be empty.", parent=note_window)
                return

            if not DEFAULT_JOURNAL_AUTHOR_ID:
                messagebox.showerror(
                    "Error",
                    "Default journal author ID is not configured. Set DESKTOP_JOURNAL_AUTHOR_ID in environment.",
                    parent=note_window,
                )
                return

            def worker():
                try:
                    self.crm_service.add_journal_entry(
                        self.current_deal_id,
                        note_text,
                        author_id=DEFAULT_JOURNAL_AUTHOR_ID,
                    )
                    logger.info(f"Added journal entry to deal {self.current_deal_id}")
                    note_window.after(0, self.refresh_journal)
                    note_window.after(0, note_window.destroy)
                except Exception as e:
                    logger.error(f"Failed to add note: {e}")
                    error_msg = str(e)
                    note_window.after(0, lambda: messagebox.showerror("Error", f"Failed to add note: {error_msg}"))

            Thread(target=worker, daemon=True).start()

        tk.Button(note_window, text="Save", command=save_note).pack(side="left", padx=5, pady=5)
        tk.Button(note_window, text="Cancel", command=note_window.destroy).pack(side="left", padx=5, pady=5)

    def view_note(self):
        """View full note"""
        if not self.tree:
            return
        selected_item = self.tree.focus()
        if not selected_item:
            messagebox.showwarning("Warning", "Please select a note to view.")
            return

        entry_id = selected_item
        entry = self.entry_map.get(entry_id)
        if not entry:
            messagebox.showerror("Error", "Failed to load note details. Please refresh and try again.")
            return

        note_text = entry.get("body", "")

        # Show in a larger window
        view_window = tk.Toplevel(self.parent)
        view_window.title("Full Note")
        view_window.geometry("500x300")

        text_widget = tk.Text(view_window, wrap="word")
        text_widget.insert("1.0", note_text)
        text_widget.config(state="disabled")
        text_widget.pack(padx=10, pady=10, fill="both", expand=True)

        tk.Button(view_window, text="Close", command=view_window.destroy).pack(pady=5)

    def delete_note(self):
        """Delete selected note from deal journal"""
        if not self.current_deal_id:
            messagebox.showwarning("Warning", "Please select a deal first.")
            return

        if not self.tree:
            return

        selected_item = self.tree.focus()
        if not selected_item:
            messagebox.showwarning("Warning", "Please select a note to delete.")
            return

        if messagebox.askyesno("Confirm Delete", "Are you sure you want to delete this note?"):
            entry_id = selected_item
            if not entry_id:
                messagebox.showerror("Error", "Failed to determine note ID.")
                return

            def worker():
                try:
                    self.crm_service.delete_journal_entry(self.current_deal_id, entry_id)
                    logger.info(f"Deleted journal entry {entry_id} from deal {self.current_deal_id}")
                    self.parent.after(0, self.refresh_journal)
                    self.parent.after(0, lambda: messagebox.showinfo("Success", "Note deleted successfully"))
                except Exception as e:
                    logger.error(f"Failed to delete note: {e}")
                    error_msg = str(e)
                    self.parent.after(0, lambda: messagebox.showerror("Error", f"Failed to delete note: {error_msg}"))

            Thread(target=worker, daemon=True).start()
