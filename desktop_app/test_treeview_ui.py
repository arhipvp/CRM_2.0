#!/usr/bin/env python3
"""Test Treeview rendering with actual data"""
import tkinter as tk
from tkinter import ttk
import sys

# Fix encoding on Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Create window
root = tk.Tk()
root.title("Treeview Test - Tasks")
root.geometry("800x600")

print("Creating Treeview...")

# Create frame
frame = ttk.Frame(root)
frame.pack(fill="both", expand=True, padx=10, pady=10)

# Create scrollbar
scrollbar = ttk.Scrollbar(frame)
scrollbar.pack(side="right", fill="y")

# Create treeview
columns = ("title", "status", "priority", "due_date", "created_at", "deleted")
tree = ttk.Treeview(
    frame,
    columns=columns,
    show="headings",
    yscrollcommand=scrollbar.set,
    height=20
)
scrollbar.config(command=tree.yview)

# Configure columns
tree.column("title", width=300, anchor="w")
tree.column("status", width=100, anchor="w")
tree.column("priority", width=80, anchor="w")
tree.column("due_date", width=100, anchor="w")
tree.column("created_at", width=100, anchor="w")
tree.column("deleted", width=60, anchor="w")

# Configure headings
tree.heading("title", text="Title")
tree.heading("status", text="Status")
tree.heading("priority", text="Priority")
tree.heading("due_date", text="Due Date")
tree.heading("created_at", text="Created")
tree.heading("deleted", text="Deleted")

tree.pack(fill="both", expand=True)

print("Treeview created successfully")

# Test data - Russian names
test_data = [
    ("1945edd5-73b2-49e1-8c4a-1aa5f0408752", "Задача 1", "open", "high", "2025-10-27", "2025-10-24", "No"),
    ("391f1851-8039-4424-8108-a090ad6c5e8a", "Задача 2", "in_progress", "normal", "2025-10-29", "2025-10-24", "No"),
    ("4714ed0a-b833-4769-be95-0a0d5d99d2f7", "Задача 3", "completed", "low", "2025-10-25", "2025-10-24", "No"),
    ("22f75af9-42ee-41b3-9fdb-e25630c7fee0", "Задача 4", "closed", "urgent", "2025-10-22", "2025-10-24", "No"),
    ("d736f7f2-fca8-4241-a9a1-d0c504aef45b", "Задача 5", "open", "high", "2025-10-31", "2025-10-24", "No"),
]

print(f"Inserting {len(test_data)} rows into tree...")

# Insert test data
for task_id, title, status, priority, due_date, created_at, is_deleted in test_data:
    try:
        tree.insert(
            "",
            "end",
            iid=task_id,
            values=(title, status, priority, due_date, created_at, is_deleted)
        )
        print(f"  Inserted: {title}")
    except Exception as e:
        print(f"  ERROR inserting {title}: {e}")

# Check what's in the tree
children = tree.get_children()
print(f"\nTree now contains {len(children)} rows")
for child_id in children:
    item = tree.item(child_id)
    print(f"  Row ID: {child_id}, Values: {item['values']}")

print("\nWindow is ready. You should see 5 Russian task titles in the table above.")
print("If you don't see them, there's a rendering issue with Cyrillic characters.")

# Show window
root.mainloop()
