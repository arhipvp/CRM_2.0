"""Deal journal/notes tab component"""
import tkinter as tk
from tkinter import ttk, messagebox
from threading import Thread
from typing import Optional
from datetime import datetime

from crm_service import CRMService
from logger import logger


class DealJournalTab:
    """Tab for viewing and managing deal journal entries (notes)"""

    def __init__(self, parent: ttk.Frame, crm_service: CRMService, deal_id: Optional[str] = None):
        self.parent = parent
        self.crm_service = crm_service
        self.deal_id = deal_id
        self.tree: Optional[ttk.Treeview] = None
        self.current_deal_id: Optional[str] = None

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
            columns=("Date", "Note", "Deleted"),
            show="headings"
        )
        self.tree.heading("Date", text="Date")
        self.tree.heading("Note", text="Note / Journal Entry")
        self.tree.heading("Deleted", text="Deleted")

        self.tree.column("Date", width=100)
        self.tree.column("Note", width=400)
        self.tree.column("Deleted", width=60)

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
                deal = self.crm_service.get_deal(self.current_deal_id)
                if deal:
                    # Parse journal entries from deal description
                    # Format: "date time: note" separated by "---"
                    description = deal.get("description", "")
                    entries = []

                    if description:
                        # Split entries by separator
                        parts = description.split("\n---\n")
                        for part in parts:
                            part = part.strip()
                            if part:
                                # Try to extract date and note
                                if ":" in part:
                                    date_part, note_part = part.split(":", 1)
                                    entries.append({
                                        "date": date_part.strip(),
                                        "note": note_part.strip(),
                                        "is_deleted": False
                                    })
                                else:
                                    entries.append({
                                        "date": deal.get("created_at", "N/A")[:10],
                                        "note": part,
                                        "is_deleted": False
                                    })

                    # If no entries, add created_at info
                    if not entries:
                        entries = [{
                            "date": deal.get("created_at", "N/A")[:10],
                            "note": "No notes yet",
                            "is_deleted": False
                        }]

                    self.parent.after(0, self._update_tree_ui, entries)
                else:
                    self.parent.after(0, self._update_tree_ui, [])
            except Exception as e:
                logger.error(f"Failed to fetch deal journal: {e}")
                error_msg = str(e)
                self.parent.after(0, lambda: messagebox.showerror("Error", f"Failed to fetch journal: {error_msg}"))

        Thread(target=worker, daemon=True).start()

    def _update_tree_ui(self, entries):
        """Update tree UI on main thread"""
        if not self.tree:
            return
        for i in self.tree.get_children():
            self.tree.delete(i)
        for entry in entries:
            is_deleted = "Yes" if entry.get("is_deleted", False) else "No"
            self.tree.insert("", "end", values=(
                entry.get("date", "N/A"),
                entry.get("note", "")[:100],  # Show first 100 chars
                is_deleted
            ))

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

            def worker():
                try:
                    # Update deal description with new note
                    deal = self.crm_service.get_deal(self.current_deal_id)
                    if deal:
                        current_desc = deal.get("description", "")
                        new_desc = f"{current_desc}\n---\n{datetime.now().strftime('%Y-%m-%d %H:%M')}: {note_text}"
                        self.crm_service.update_deal(
                            self.current_deal_id,
                            description=new_desc
                        )
                        logger.info(f"Added note to deal {self.current_deal_id}")
                        note_window.after(0, self.refresh_journal)
                        note_window.destroy()
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

        item_values = self.tree.item(selected_item)["values"]
        if len(item_values) > 1:
            note_text = item_values[1]

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
            item_values = self.tree.item(selected_item)["values"]
            if len(item_values) > 1:
                note_to_delete = item_values[1]

                def worker():
                    try:
                        # Get current deal
                        deal = self.crm_service.get_deal(self.current_deal_id)
                        if deal:
                            current_desc = deal.get("description", "")
                            # Remove the note from description
                            lines = current_desc.split("\n---\n")
                            filtered_lines = [line.strip() for line in lines if line.strip() and note_to_delete not in line]

                            # Reconstruct description without the deleted note
                            new_desc = "\n---\n".join(filtered_lines) if filtered_lines else ""

                            self.crm_service.update_deal(
                                self.current_deal_id,
                                description=new_desc
                            )
                            logger.info(f"Deleted note from deal {self.current_deal_id}")
                            self.parent.after(0, self.refresh_journal)
                            self.parent.after(0, lambda: messagebox.showinfo("Success", "Note deleted successfully"))
                    except Exception as e:
                        logger.error(f"Failed to delete note: {e}")
                        error_msg = str(e)
                        self.parent.after(0, lambda: messagebox.showerror("Error", f"Failed to delete note: {error_msg}"))

                Thread(target=worker, daemon=True).start()
