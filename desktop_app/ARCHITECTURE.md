# CRM Desktop Application - Architecture & Design

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CRM Desktop Application                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    main.py (App)                            │   │
│  │  ┌──────────────────────────────────────────────────────┐   │   │
│  │  │          Tkinter GUI (ttk.Notebook)                  │   │   │
│  │  │  ┌──────────────────────────────────────────────┐    │   │   │
│  │  │  │ Clients Tab │ Deals │ Payments │ Policies │...│    │   │   │
│  │  │  └──────────────────────────────────────────────┘    │   │   │
│  │  └──────────────────────────────────────────────────────┘   │   │
│  │                          │                                   │   │
│  │                          ▼                                   │   │
│  │  ┌──────────────────────────────────────────────────────┐   │   │
│  │  │          CRM Service Layer                           │   │   │
│  │  │  • get_clients()      • create_deal()                │   │   │
│  │  │  • update_client()    • delete_payment()             │   │   │
│  │  │  • get_policies()     • get_calculations()           │   │   │
│  │  │  • get_deal_policies()                              │   │   │
│  │  └──────────────────────────────────────────────────────┘   │   │
│  │                          │                                   │   │
│  │                          ▼                                   │   │
│  │  ┌──────────────────────────────────────────────────────┐   │   │
│  │  │          API Client                                  │   │   │
│  │  │  • get(url)        • post(url, data)                │   │   │
│  │  │  • patch(url, data) • delete(url)                   │   │   │
│  │  └──────────────────────────────────────────────────────┘   │   │
│  │                          │                                   │   │
│  │                          ▼                                   │   │
│  │  ┌──────────────────────────────────────────────────────┐   │   │
│  │  │    Backend API (http://localhost:8082/api/v1)       │   │   │
│  │  │  • /clients  • /deals  • /payments  • /policies      │   │   │
│  │  └──────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Dialog Layer                             │   │
│  │  • edit_dialogs.py (Add/Edit dialogs)                       │   │
│  │  • detail_dialogs.py (View details)                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

## Module Structure

### Core Modules

#### 1. **main.py** - Main Application
- Entry point приложения
- Создаёт главное окно (Tkinter)
- Инициализирует все вкладки
- Управляет аутентификацией
- Обрабатывает events главного окна

```python
class App(tk.Tk):
    def __init__(self):
        # 1. Показ диалога логина
        # 2. Инициализация API Client
        # 3. Создание UI с вкладками
        # 4. Загрузка начальных данных
```

#### 2. **crm_service.py** - Business Logic
Абстракция над API. Содержит методы для:
- Работы с клиентами (CRUD)
- Работы с сделками (CRUD)
- Работы с платежами (CRUD)
- Работы с политиками (CRUD)
- Работы с задачами (CRUD)
- Работы с расчётами (CRUD)

```python
class CRMService:
    def __init__(self, api_client):
        self.api_client = api_client

    def get_clients(self) -> List[Dict]:
        """Получить всех клиентов"""

    def create_deal(self, title, client_id, **kwargs):
        """Создать новую сделку"""
```

#### 3. **api_client.py** - HTTP Client
Низкоуровневая работа с HTTP:
- Выполнение GET/POST/PATCH/DELETE запросов
- Обработка ошибок (401, 404, 500)
- Управление headers и authentication

```python
class APIClient:
    def __init__(self, token=None):
        self.token = token
        self.session = requests.Session()

    def get(self, url) -> dict:
        """GET запрос"""

    def post(self, url, data) -> dict:
        """POST запрос"""
```

#### 4. **edit_dialogs.py** - Edit Forms
Все диалоги для Add/Edit операций:
- `BaseEditDialog` - базовый класс
- `DealEditDialog` - создание/редактирование сделок с выбором клиента и ответственного пользователя
- `PaymentEditDialog` - создание/редактирование платежей
- `PolicyEditDialog` - создание/редактирование политик
- `CalculationEditDialog` - создание/редактирование расчётов

#### 5. **detail_dialogs.py** - Detail Views
Диалоги для просмотра полной информации:
- `ClientDetailDialog` - детали клиента
- `DealDetailDialog` - детали сделки
- `PaymentDetailDialog` - детали платежа
- И другие...

### Tab Modules

#### **deals_tab.py**
```python
class DealsTab:
    def __init__(self, parent, crm_service):
        self.tree = ttk.Treeview()  # Таблица

    def refresh_tree(self):
        """Загрузить сделки из API"""

    def add_deal(self):
        """Показать диалог создания"""
        dialog = DealEditDialog(...)
        if dialog.result:
            self.crm_service.create_deal(...)

    def edit_deal(self):
        """Редактировать выбранную сделку"""

    def delete_deal(self):
        """Удалить с подтверждением"""
```

#### **payments_tab.py**
```python
class PaymentsTab:
    def __init__(self, parent, crm_service):
        self.deal_combo = ttk.Combobox()  # Выбор сделки
        self.tree = ttk.Treeview()  # Список платежей

    def _load_deals(self):
        """Загрузить сделки для dropdown'а"""

    def add_payment(self):
        """Создать платёж"""
```

Аналогично для других вкладок.

### Utility Modules

#### **auth_service.py**
Работа с аутентификацией и токенами.

#### **logger.py**
Логирование всех операций.

#### **search_utils.py**
Поиск, фильтрация и экспорт данных.

#### **config.py**
Конфигурация приложения (URLs, timeouts, etc).

## Data Flow

### Создание новой записи (Add)

```
┌─────────────────────────────────────────────────────────┐
│ 1. User clicks "Add Deal" button                        │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Dialog opens (DealEditDialog)                        │
│    • Loads clients from self.all_clients                │
│    • Shows form fields                                  │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│ 3. User fills form and clicks OK                        │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Dialog validates fields                              │
│    • Check required fields (title, client_id)           │
│    • Validate data types                                │
└────────────┬────────────────────────────────────────────┘
             │
             ▼ (if valid)
┌─────────────────────────────────────────────────────────┐
│ 5. Dialog returns dialog.result (dict with data)       │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│ 6. Start background thread for API call                 │
│    Thread(target=worker)                                │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│ 7. In thread: Call crm_service.create_deal(**result)   │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│ 8. Service calls api_client.post(url, data)             │
└────────────┬────────────────────────────────────────────┘
             │
             ▼ (network request)
┌─────────────────────────────────────────────────────────┐
│ 9. Backend creates deal in DB, returns 200 + response  │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│ 10. Back in thread: Check result                        │
│     • If success: call self.after(0, self.refresh_tree) │
│     • If error: show error message                      │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│ 11. Main thread: refresh_tree() loads deals from API   │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│ 12. UI updates: Tree repopulated with new data          │
│     User sees the new deal in the table                 │
└─────────────────────────────────────────────────────────┘
```

### Редактирование записи (Edit)

```
┌─────────────────────────────────────────────────────────┐
│ 1. User selects deal in table and clicks Edit           │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Get selected deal ID from tree focus()               │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Start thread to fetch full deal data from API       │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│ 4. API returns deal with all fields populated           │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│ 5. Open DealEditDialog with deal data pre-filled       │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│ 6. User modifies fields and clicks OK                   │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│ 7. Dialog validates and returns new data                │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│ 8. Start thread: crm_service.update_deal(id, **data)   │
└────────────┬────────────────────────────────────────────┘
             │
             ▼ (API PATCH request)
┌─────────────────────────────────────────────────────────┐
│ 9. Backend updates deal in DB                           │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│ 10. Back to main thread: refresh_tree()                 │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│ 11. UI updates: Deal in table shows new values          │
└─────────────────────────────────────────────────────────┘
```

### Удаление записи (Delete)

```
┌─────────────────────────────────────────────────────────┐
│ 1. User selects deal and clicks Delete                  │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Show confirmation dialog                             │
│    messagebox.askyesno("Confirm Delete", "Sure?")      │
└────────────┬────────────────────────────────────────────┘
             │
             ▼ (if YES)
┌─────────────────────────────────────────────────────────┐
│ 3. Start thread: crm_service.delete_deal(deal_id)      │
└────────────┬────────────────────────────────────────────┘
             │
             ▼ (API DELETE request)
┌─────────────────────────────────────────────────────────┐
│ 4. Backend deletes deal (soft delete)                   │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│ 5. Back to main thread: refresh_tree()                  │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│ 6. Deal removed from table (is_deleted=true)            │
└─────────────────────────────────────────────────────────┘
```

## Threading Model

Все операции с API выполняются в фоновых потоках:

```python
def add_deal(self):
    dialog = DealEditDialog(...)
    if dialog.result:
        def worker():
            try:
                # This runs in background thread
                self.crm_service.create_deal(**dialog.result)
                # Update UI from main thread
                self.parent.after(0, self.refresh_tree)
                # Show success message
                self.parent.after(0, lambda: messagebox.showinfo(...))
            except Exception as e:
                # Handle error in main thread
                self.parent.after(0, lambda: messagebox.showerror(...))

        Thread(target=worker, daemon=True).start()
```

**Почему threading?**
- UI не блокируется при сетевых запросах
- Можно отменить операцию (если нужно)
- Лучше UX - пользователь видит отзывчивое приложение

**self.parent.after(0, function)?**
- after(0, ...) выполняет функцию на главном Tkinter потоке
- Обновлять UI нужно только из главного потока

## Error Handling Strategy

```python
try:
    # 1. API call
    result = self.crm_service.create_deal(**data)
except UnauthorizedException:
    # 2. Handle 401 - need to re-login
    messagebox.showwarning("Session Expired", "Please login again")
    # Restart login
except Exception as e:
    # 3. Handle other errors
    logger.error(f"Failed to create deal: {e}")
    messagebox.showerror("API Error", str(e))
```

## Data Validation

### Field-level validation
```python
def on_ok(self):
    title = self.title_var.get().strip()
    if not title:
        messagebox.showerror("Error", "Title cannot be empty.")
        return
```

### Type validation
```python
try:
    amount = float(self.amount_var.get())
except ValueError:
    messagebox.showerror("Error", "Amount must be a number")
    return
```

### Business logic validation
```python
client_id = self.client_dict.get(client_name)
if not client_id:
    messagebox.showerror("Error", "Invalid client selected")
    return
```

## State Management

Состояние приложения хранится в:

1. **Instance variables**
   ```python
   self.all_deals = []  # Cache all deals
   self.current_deal_id = None  # Currently selected deal
   ```

2. **Widget variables**
   ```python
   self.deal_var = tk.StringVar()  # Dropdown selection
   self.tree = ttk.Treeview()  # Table data
   ```

3. **Dialog results**
   ```python
   dialog.result  # Returned data from edit dialog
   ```

## Performance Considerations

### 1. Data Caching
```python
# Load all clients once and reuse
self.all_clients = crm_service.get_clients()

# Use for dropdowns instead of reloading
client_dict = {c.get("name"): c.get("id") for c in self.all_clients}
```

### 2. Pagination (Future)
```python
# For large tables, implement pagination
def get_deals(self, page=1, limit=50):
    url = f"{CRM_DEALS_URL}?page={page}&limit={limit}"
```

### 3. Search Optimization
```python
# Search happens on client-side in memory
# No additional API calls for filtering
filtered = search_filter_rows(self.all_deals, query, fields)
```

## Security Considerations

1. **Authentication**
   - JWT tokens obtained at login
   - Stored in memory (not in files)
   - Sent in headers for all requests

2. **Input Validation**
   - Validate all user input before API call
   - Don't trust API responses (parse carefully)

3. **Error Messages**
   - Don't expose sensitive error details to user
   - Log full errors for debugging

4. **Session Management**
   - Handle 401 responses gracefully
   - Require re-login when token expires

## Testing Strategy

### Unit Tests
- Test individual dialog validation
- Test CRMService methods with mocked API

### Integration Tests
- Test complete flow (Add -> Refresh -> View)
- Test error scenarios

### E2E Tests
- Test against live API
- Test with real data

## Future Improvements

1. **Offline Mode** - Queue operations when offline, sync when online
2. **Undo/Redo** - Track changes, allow undo
3. **Real-time Updates** - WebSocket for live updates
4. **Async/await** - Use asyncio instead of threads
5. **ORM** - SQLAlchemy for DB access
6. **State Management** - Redux-like state container
7. **Component Library** - Reusable UI components
8. **Theming** - Support for light/dark themes

## Deployment

### Development
```bash
python main.py --debug
```

### Production
```bash
# Build executable
pyinstaller --onefile --windowed main.py

# Run
./dist/main.exe
```

## Monitoring & Logging

All operations logged to:
- Console (development)
- Log file (production)

Log levels: DEBUG, INFO, WARNING, ERROR, CRITICAL

Example:
```
2024-01-15 10:30:45 - crm_service - INFO - Created deal: "New Deal"
2024-01-15 10:31:20 - deals_tab - ERROR - Failed to fetch deals: Connection refused
```
