# Desktop CRM - Developer Guide

## Architecture Overview

### Search and Filtering System

```
User Input (SearchFilter widget)
    ↓
_on_search_change() callback
    ↓
search_filter_rows() utility
    ↓
_refresh_tree_display()
    ↓
Filtered results shown in Treeview
```

### Export System

```
Export button click
    ↓
Get displayed items from tree
    ↓
Prepare data (columns + rows)
    ↓
DataExporter.export_to_csv/excel()
    ↓
Save to file
    ↓
Show success/error dialog
```

### Edit/Delete System

```
User selects row + clicks button
    ↓
Validation (row selected?)
    ↓
Confirmation dialog (for delete)
    ↓
API call in background thread
    ↓
refresh_tree() on completion
    ↓
Show status message
```

## Code Examples

### Adding Search to a New Tab

```python
from search_utils import SearchFilter, search_filter_rows

class MyTab(ttk.Frame):
    def __init__(self, parent, crm_service):
        super().__init__(parent)
        self.crm_service = crm_service
        self.all_data = []  # Store all data for filtering
        self.search_filter = None

        self.create_widgets()
        self.refresh_data()

    def create_widgets(self):
        # Add search filter
        search_frame = tk.Frame(self)
        search_frame.pack(pady=5, padx=5, fill="x")

        self.search_filter = SearchFilter(search_frame, self._on_search_change)
        self.search_filter.pack(fill="x")

        # ... rest of UI ...

    def _on_search_change(self, search_text: str):
        """Handle search filter change"""
        if not self.all_data:
            return

        # Define which fields to search
        search_fields = ["name", "email", "phone"]

        # Filter data
        filtered = search_filter_rows(self.all_data, search_text, search_fields)

        # Update display
        self._refresh_tree_display(filtered)

    def _refresh_tree_display(self, items):
        """Update tree with filtered items"""
        # Clear tree
        for item in self.tree.get_children():
            self.tree.delete(item)

        # Add filtered items
        for item_data in items:
            self.tree.insert("", "end", values=(
                item_data.get("field1"),
                item_data.get("field2"),
                # ... etc
            ))

    def refresh_data(self):
        """Fetch data from API"""
        thread = Thread(target=self._fetch_data, daemon=True)
        thread.start()

    def _fetch_data(self):
        """Background fetch"""
        try:
            self.all_data = self.crm_service.get_data()  # API call
            self.after(0, self._refresh_tree_display, self.all_data)
        except Exception as e:
            logger.error(f"Failed to fetch: {e}")
            self.after(0, lambda: messagebox.showerror("Error", str(e)))
```

### Adding Export to a Tab

```python
from search_utils import DataExporter
from tkinter import filedialog

def export_to_csv(self):
    """Export currently displayed data to CSV"""
    if not self.tree or not self.all_data:
        messagebox.showwarning("Warning", "No data to export.")
        return

    # Get filename from user
    filename = filedialog.asksaveasfilename(
        defaultextension=".csv",
        filetypes=[("CSV files", "*.csv"), ("All files", "*.*")]
    )

    if not filename:
        return

    try:
        # Get displayed items
        displayed_items = self.tree.get_children()
        if not displayed_items:
            messagebox.showwarning("Warning", "No data to export.")
            return

        # Prepare data
        columns = ["Column1", "Column2", "Column3"]  # Adjust as needed
        rows = []

        for item in displayed_items:
            values = self.tree.item(item)["values"]
            rows.append(list(values))

        # Export
        if DataExporter.export_to_csv(filename, columns, rows):
            messagebox.showinfo("Success", f"Data exported to {filename}")
            logger.info(f"Exported {len(rows)} rows to CSV")
        else:
            messagebox.showerror("Error", "Failed to export data")

    except Exception as e:
        logger.error(f"Export error: {e}")
        messagebox.showerror("Error", f"Failed to export: {e}")

def export_to_excel(self):
    """Export to Excel - same pattern, different method"""
    # Same code as above but call:
    # DataExporter.export_to_excel(filename, columns, rows)
    pass
```

### Implementing Delete with Confirmation

```python
def delete_item(self):
    """Delete selected item with confirmation"""
    if not self.tree:
        return

    selected = self.tree.focus()
    if not selected:
        messagebox.showwarning("Warning", "Please select an item to delete.")
        return

    # Confirm deletion
    if messagebox.askyesno("Confirm Delete", "Delete this item?"):
        item_id = selected

        # Delete in background
        def worker():
            try:
                self.crm_service.delete_item(item_id)
                self.after(0, self.refresh_data)
                self.after(0, lambda: messagebox.showinfo("Success", "Item deleted"))
            except Exception as e:
                logger.error(f"Delete failed: {e}")
                self.after(0, lambda: messagebox.showerror("Error", str(e)))

        Thread(target=worker, daemon=True).start()
```

## Data Flow

### Search Flow

```
User Types → StringVar trace callback → _on_search_change()
                                            ↓
                                    search_filter_rows()
                                            ↓
                                    _refresh_tree_display()
                                            ↓
                                    Clear and repopulate tree
```

### Export Flow

```
User clicks Export CSV/Excel
    ↓
Get file path from dialog
    ↓
Get all visible rows from tree
    ↓
Convert to list of lists
    ↓
DataExporter method call
    ↓
File written to disk
    ↓
Show success/error message
```

## Utility Functions Reference

### SearchFilter Class

```python
class SearchFilter:
    def __init__(self, parent, on_filter_change: Callable):
        """Create search widget

        Args:
            parent: Parent widget (usually a tk.Frame)
            on_filter_change: Callback function that receives search text
        """

    def pack(self, **kwargs):
        """Pack the search frame"""

    def get_search_text(self) -> str:
        """Get current search text"""
```

### search_filter_rows Function

```python
def search_filter_rows(
    rows: List[Dict[str, Any]],
    search_text: str,
    search_fields: List[str]
) -> List[Dict[str, Any]]:
    """Filter rows by search text

    Args:
        rows: List of dictionaries containing data
        search_text: Text to search for (case-insensitive)
        search_fields: Which fields to search in

    Returns:
        Filtered list of dictionaries

    Example:
        data = [
            {"name": "John", "email": "john@example.com"},
            {"name": "Jane", "email": "jane@example.com"}
        ]
        filtered = search_filter_rows(data, "john", ["name", "email"])
        # Returns: [{"name": "John", "email": "john@example.com"}]
    """
```

### DataExporter Class

```python
class DataExporter:
    @staticmethod
    def export_to_csv(
        filename: str,
        columns: List[str],
        rows: List[List[Any]]
    ) -> bool:
        """Export data to CSV file

        Args:
            filename: Output file path
            columns: Column headers
            rows: List of lists (each inner list is a row)

        Returns:
            True if successful, False otherwise
        """

    @staticmethod
    def export_to_excel(
        filename: str,
        columns: List[str],
        rows: List[List[Any]]
    ) -> bool:
        """Export to Excel with formatting

        Args:
            filename: Output .xlsx file path
            columns: Column headers
            rows: Data rows

        Returns:
            True if successful, False otherwise
        """
```

## Common Patterns

### Pattern 1: Store All Data, Display Filtered

```python
# Initialization
self.all_data = []  # Store everything
self.tree = ttk.Treeview(...)  # Display filtered

# Fetch
def _fetch_data(self):
    self.all_data = self.crm_service.get_data()
    self.after(0, self._refresh_tree_display, self.all_data)

# Filter
def _on_search_change(self, text):
    filtered = search_filter_rows(self.all_data, text, fields)
    self._refresh_tree_display(filtered)
```

### Pattern 2: Async Operations with Threading

```python
def async_operation(self, callback_method, *args):
    """Generic async pattern"""
    def worker():
        try:
            result = self.crm_service.operation(*args)
            self.after(0, callback_method, result)
        except Exception as e:
            logger.error(str(e))
            self.after(0, lambda: messagebox.showerror("Error", str(e)))

    Thread(target=worker, daemon=True).start()
```

### Pattern 3: Safe Tree Operations

```python
def _refresh_tree_display(self, items):
    """Safe pattern for updating tree"""
    if not self.tree:
        return

    # Clear
    for item in self.tree.get_children():
        self.tree.delete(item)

    # Populate
    for item_data in items:
        try:
            self.tree.insert(
                "",
                "end",
                iid=item_data.get("id"),  # Unique identifier
                values=(item_data.get("field1"), ...)
            )
        except Exception as e:
            logger.error(f"Failed to insert row: {e}")
```

## Debugging Tips

### Enable Verbose Logging

```python
import logging

logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Then use throughout:
logger.debug("Starting search...")
logger.info(f"Filtered to {len(filtered)} items")
logger.error(f"Export failed: {e}")
```

### Print Debug Info

```python
def _on_search_change(self, text):
    print(f"Search text: {text}")
    print(f"All data count: {len(self.all_data)}")
    filtered = search_filter_rows(self.all_data, text, fields)
    print(f"Filtered count: {len(filtered)}")
```

### Check Tree Contents

```python
def debug_tree(self):
    """Print current tree contents"""
    for item in self.tree.get_children():
        values = self.tree.item(item)["values"]
        print(f"Item {item}: {values}")
```

## Performance Optimization

### 1. Lazy Loading
```python
# Instead of loading all data at startup
# Load on demand when user needs it
```

### 2. Pagination
```python
# For very large datasets (10k+ rows)
# Load data in chunks and display only visible portion
```

### 3. Caching
```python
# Store API responses locally
# Reduce API calls for repeated searches
```

### 4. Async Operations
```python
# All long operations run in background threads
# UI remains responsive always
```

## Testing

### Unit Test Example

```python
import unittest
from unittest.mock import Mock, patch
from search_utils import search_filter_rows

class TestSearchFilter(unittest.TestCase):
    def test_search_filter_rows(self):
        data = [
            {"name": "John", "email": "john@example.com"},
            {"name": "Jane", "email": "jane@example.com"}
        ]

        result = search_filter_rows(data, "john", ["name", "email"])
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["name"], "John")

    def test_search_case_insensitive(self):
        data = [{"name": "John"}]
        result = search_filter_rows(data, "JOHN", ["name"])
        self.assertEqual(len(result), 1)

    def test_search_empty_text(self):
        data = [{"name": "John"}]
        result = search_filter_rows(data, "", ["name"])
        self.assertEqual(len(result), 1)  # Returns all
```

### Integration Test Example

```python
@patch('crm_service.CRMService.get_clients')
def test_client_search_integration(self, mock_get):
    mock_get.return_value = [
        {"id": "1", "name": "John", "email": "john@example.com"},
        {"id": "2", "name": "Jane", "email": "jane@example.com"}
    ]

    # Simulate search
    app = App()
    app._on_search_change("john")

    # Verify filtered display
    items = app.tree.get_children()
    self.assertEqual(len(items), 1)
```

## Extending the System

### Adding Search to a New Entity Type

1. Implement `get_<entity>()` in `CRMService`
2. Create new tab class
3. Add `SearchFilter` widget
4. Implement `_on_search_change()` callback
5. Define search fields
6. Test thoroughly

### Adding New Export Format

1. Extend `DataExporter` class
2. Add static method `export_to_<format>()`
3. Handle errors gracefully
4. Add button to UI
5. Test file creation

### Custom Filtering Logic

Instead of simple substring match, implement:

```python
def advanced_filter(rows, criteria):
    """Custom filter function"""
    filtered = []
    for row in rows:
        if meets_criteria(row, criteria):
            filtered.append(row)
    return filtered
```

## Security Considerations

1. **File Paths**: Validate user input for export paths
2. **Data Leakage**: Ensure sensitive data isn't exported unintentionally
3. **File Permissions**: Check write permissions before export
4. **Input Validation**: Sanitize search input (done in search_filter_rows)
5. **Error Messages**: Don't expose sensitive info in error dialogs

## Memory Management

- Trees automatically clean up deleted items
- Threading daemon threads don't prevent shutdown
- No circular references or memory leaks in current implementation
- Large datasets (1000+ rows) are handled efficiently

## Compatibility

- Python 3.8+
- Tkinter built-in
- requests library
- openpyxl for Excel (optional, graceful fallback)
- Works on Windows, macOS, Linux

## Future Improvements

1. **Advanced Search**
   - Date range filtering
   - Numeric comparisons
   - Boolean operators (AND, OR, NOT)

2. **Performance**
   - Index commonly searched fields
   - Implement pagination
   - Cache API responses

3. **UX**
   - Keyboard shortcuts
   - Search history
   - Saved filters
   - Column sorting

4. **Export**
   - PDF format
   - JSON format
   - XML format
   - Custom templates

## References

- Python Tkinter: https://docs.python.org/3/library/tkinter.html
- Threading: https://docs.python.org/3/library/threading.html
- CSV module: https://docs.python.org/3/library/csv.html
- openpyxl: https://openpyxl.readthedocs.io/

---

Last Updated: 2025-10-24
