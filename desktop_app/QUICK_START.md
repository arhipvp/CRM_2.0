# Desktop CRM - Quick Start Guide

## What's New?

The Desktop CRM application has been enhanced with powerful search, filtering, editing, and export capabilities across all data tables.

## New Features

### 1. Search & Filter (Real-time)

All tables now have a search bar at the top:

```
Search: [________________] [Clear]
```

**How to use:**
- Type in the search field
- Results filter in real-time as you type
- Click "Clear" to reset the search
- Search is case-insensitive

**What you can search:**
- **Clients**: Name, Email, Phone
- **Deals**: Title, Status
- **Tasks**: Title, Description, Status
- **Payments**: Type, Status
- **Policies**: Policy Number, Status
- **Calculations**: Insurance Company, Program Name, Status

### 2. Edit & Delete

**Delete Operation:**
- Select a row in the table
- Click "Delete" button (кнопка активна только для сущностей с поддержкой удаления на стороне API)
- Confirm deletion in the dialog (если доступно)
- Row is removed from the database (для поддерживаемых сущностей)

**Edit Operation:**
- Select a row in the table
- Click "Edit" button
- Modify the data
- Click "OK" to save changes

### 3. Export Data

Export your filtered data to files:

**Export to CSV:**
1. (Optional) Apply filters to show only needed data
2. Click "Export CSV" button
3. Choose location and filename
4. File is saved with all visible columns

**Export to Excel:**
1. (Optional) Apply filters
2. Click "Export Excel" button
3. Choose location and filename
4. Excel file is created with:
   - Styled headers (blue background)
   - Auto-adjusted column widths
   - All visible data

## Installation

Install new dependencies:

```bash
cd desktop_app
pip install -r requirements.txt
```

New dependency: `openpyxl>=3.0.0` for Excel export support

## Running the Application

```bash
cd desktop_app
python main.py
```

## UI Layout for Each Tab

Each tab now has:

```
Search: [search box] [Clear]
[Add] [Edit] [Delete] [Refresh] [Export CSV] [Export Excel]
[Status Filter] [Priority Filter] (where applicable)
┌──────────────────────────────┐
│ Table with data              │
│ (filtered by search)         │
└──────────────────────────────┘
```

## Workflow Examples

### Example 1: Find and Export Specific Clients

1. Go to **Clients** tab
2. Type "john" in search box
3. Click "Export CSV"
4. Save as "john_clients.csv"
5. Open in Excel or Notepad

### Example 2: Find and Review Expired Policies

1. Go to **Policies** tab
2. Type "inactive" in search box
3. Review filtered results
4. Select a policy to open it in the editor if you need to update details

> **Примечание.** Кнопка **Delete** на вкладке **Policies** пока не работает: в CRM API отсутствует `DELETE`-эндпоинт для полисов. См. реализацию роутера в файле [`backend/crm/crm/api/routers/policies.py`](../backend/crm/crm/api/routers/policies.py).

### Example 3: Generate Task Report

1. Go to **Tasks** tab
2. Set Status filter to "completed"
3. (Optionally) Search for specific keywords
4. Click "Export Excel"
5. Save as "completed_tasks_report.xlsx"
6. Open in Excel, view formatted report

## Tips & Tricks

### Search Tips
- Search updates as you type - no Enter key needed
- Use multiple words to narrow results
- Clear search to see all data again

### Export Tips
- Only currently visible (filtered) data is exported
- Apply filters before exporting for focused reports
- Excel export auto-formats columns for readability
- CSV files can be opened in any spreadsheet app

### Deal Documents Management

- Настройте переменную окружения `DESKTOP_DEAL_DOCUMENTS_ROOT` (по умолчанию `./deal_documents`).
- На вкладке **Calculations** доступны кнопки **Attach Document** (копирование файлов в папку сделки) и **Open Document** (открытие выбранного документа или папки).
- В окне редактирования расчёта используйте кнопки **Add**/**Remove** для управления списком файлов. Новые файлы автоматически копируются в папку сделки и добавляются в поле `files` отправляемого запроса.

### Performance
- Search on large datasets (1000+ rows) may take 1-2 seconds
- Export might take time for very large datasets
- All operations are non-blocking (UI stays responsive)

## Keyboard Shortcuts

While not yet implemented, consider using:
- `Ctrl+F` - Focus search box (browser-like)
- `Ctrl+E` - Export data (future enhancement)
- `Delete` - Delete selected row (future enhancement)

## Troubleshooting

### "No data to export" error
- Ensure you have at least one row selected/visible
- Check if search filtered out all data
- Click "Refresh" to reload data from server

### Export button not working
- Check file permissions in target directory
- Try a different save location
- Ensure disk has enough space

### Excel export fails
- Install openpyxl: `pip install openpyxl`
- Try CSV export instead
- Check file path has no special characters

### Search not filtering
- Wait a moment - search is real-time but slightly delayed
- Try clicking another field and returning
- Click "Clear" and start over

## File Locations

After exporting, files are saved to your chosen location:
- **Windows**: Usually `C:\Users\YourName\Downloads\`
- **macOS**: Usually `~/Downloads/`
- **Linux**: Depends on file manager settings

## What's Not Yet Implemented

- Advanced search (date ranges, operators)
- Batch operations (delete multiple at once)
- PDF export format
- Scheduled exports
- Search history
- Column sorting by clicking headers
- Custom export templates

## Getting Help

1. Check the **IMPROVEMENTS_SUMMARY.md** file for detailed info
2. Look at the function docstrings in the code
3. Check log messages in the terminal
4. Review error dialogs for specific problems

## Performance Notes

- Search performance is O(n) where n = number of records
- Export performance depends on file I/O
- UI remains responsive during all operations (threading)
- Recommended max dataset size: 5000 records

## Future Enhancements

The following features are planned:
- Advanced filtering with date ranges
- Full-text search
- Export to PDF
- Scheduled/recurring exports
- Search history and saved filters
- Batch delete/edit operations
- Dark mode support
- Custom export formats

## Version Info

- App: Desktop CRM 2.0
- Last Updated: 2025-10-24
- Python: 3.8+
- Dependencies: requests, python-dotenv, openpyxl

## Support Resources

- GitHub Issues: [Project Repo]
- Documentation: See IMPROVEMENTS_SUMMARY.md
- Code Examples: Check individual tab implementations

---

Enjoy the improved Desktop CRM experience!
