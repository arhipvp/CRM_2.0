# CRM Desktop Application

A professional Python Tkinter-based desktop application for managing CRM clients, deals, and payments.

## Features

### Current Features
- **Authentication**: На время разработки авторизация отключена — приложение сразу создаёт `APIClient` без токена и выполняет запросы к CRM API.
- **Client Management** (просмотр/создание/редактирование):
  - View all clients in table format
  - Add new clients with name, email, phone
  - Edit existing client information
  - Delete clients with confirmation
- **Deal Management**: Create, edit, and browse deals через `DealEditDialog`; формы работают, но пока без расширенных валидаций и UX-подсказок
- **Payments Management**: Запись, обновление и удаление платежей по выбранному полису сделки; рабочий поток требует доработки UX (автовыбор полиса, подсветка обязательных полей)
- **Deal Journal**: Просмотр и создание записей журнала сделки через CRM API (дата, автор, тип записи)
- **Search & Filtering**: Inline-поиск по таблицам сделок и платежей (текстовый фильтр по нескольким полям)
- **Asynchronous Operations**: Non-blocking API calls using threading
- **Error Handling**:
  - 401 Unauthorized (session expiration) detection
  - Connection error handling with user-friendly messages
  - API timeout protection (10 seconds default)
- **Logging**: Debug logging with configurable levels
- **Deal Documents**: Attach files to deal folders and open them directly from the UI

### Planned Features
- Report generation (отчётные витрины и экспорт ещё не реализованы)
- Offline mode with local caching (нет локального хранилища и синхронизации)

## Architecture

### Module Structure

```
desktop_app/
├── main.py              # Main application window with tabs
├── login_dialog.py      # Login authentication UI
├── config.py            # Configuration and environment variables
├── logger.py            # Logging setup
├── api_client.py        # HTTP client with error handling
├── auth_service.py      # Authentication service
├── crm_service.py       # CRM business logic
├── deals_tab.py         # Deals management tab component
├── payments_tab.py      # Payments tab component (просмотр и управление платежами)
├── requirements.txt     # Python dependencies
├── README.md            # This file
└── *.py                 # Таблицы, диалоги, сервисы и диагностические скрипты
```

### Design Patterns

1. **Service Layer**: Separation of concerns with dedicated services
   - `APIClient`: Low-level HTTP communication
   - `AuthService`: Authentication logic
   - `CRMService`: Business logic for clients, deals, payments

2. **Threading**: Non-blocking operations prevent UI freezing
   - Worker threads for API calls
   - Main thread callback for UI updates

3. **Configuration Management**: Environment-based settings
   - `.env` file for secrets
   - `config.py` for centralized configuration
   - Supports development and production environments

4. **Error Handling**: Graceful error recovery
   - Custom exception `UnauthorizedException` for 401 responses
   - Callback system for session expiration
   - User-friendly error messages

## Installation

### Prerequisites
- Python 3.8 or higher
- pip or poetry

### Setup

1. Clone or navigate to the repository:
```bash
cd C:/Dev/CRM_2.0/desktop_app
```

2. Create virtual environment (optional but recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. (Optional) Create `.env` with your API configuration:
```
DESKTOP_API_BASE_URL=http://localhost:8082/api/v1
DESKTOP_API_TIMEOUT=10
DESKTOP_LOG_LEVEL=INFO
DESKTOP_DEAL_DOCUMENTS_ROOT=./var/deal_documents
```

> Значения по умолчанию заданы в `config.py`. Добавляйте `.env` только если требуется переопределить базовый URL, таймауты или уровень логирования.
> Для работы журнала сделок укажите `DESKTOP_JOURNAL_AUTHOR_ID` — UUID пользователя CRM, от имени которого создаются записи по умолчанию.

> ⚠️ **Примечание об авторизации**. Компоненты `LoginDialog` и `AuthService` остаются в коде, но в `main.py` авторизация намеренно пропущена: метод `show_login_dialog` сразу инициализирует `APIClient()` без токена и завершает выполнение. Этот блок будет актуализирован после включения проверки токенов на CRM API. Если потребуется вручную вернуть проверку, раскомментируйте существующую логику в `show_login_dialog` и обеспечьте выдачу валидного JWT через `/auth/token`.

## Usage

### Starting the Application

```bash
python main.py
```

### Login
1. Текущая сборка пропускает диалог авторизации и сразу открывает главное окно с вкладками.
2. Компоненты `LoginDialog` и `AuthService` остаются в коде на будущее, но не используются при запуске.

### Client Management
1. Navigate to "Clients" tab
2. View all clients in table
3. **Add Client**: Click "Add" button, fill form, click "OK"
4. **Edit Client**: Select client, click "Edit", modify, click "OK"
5. **Delete Client**: Функциональность удаления скрыта, пока CRM API не добавит соответствующий эндпоинт (задача `CRM-219` в backlog). При необходимости удаляйте записи напрямую через backend.

### Deals Viewing
1. Navigate to "Deals" tab
2. View all deals in table format
3. **Add Deal**: Нажмите кнопку "Add Deal", заполните форму `DealEditDialog` и подтвердите изменения.
4. **Edit Deal**: Выберите сделку в таблице и нажмите "Edit", чтобы открыть форму редактирования и обновить данные.

### Deal Documents
1. Установите переменную `DESKTOP_DEAL_DOCUMENTS_ROOT` или используйте значение по умолчанию (`<repo>/deal_documents`).
2. На вкладке **Calculations** выберите сделку и нажмите **Attach Document**, чтобы скопировать файлы в локальную папку сделки.
3. Используйте **Open Document**, чтобы открыть прикреплённый файл (если расчёт содержит список файлов) или саму папку сделки.
4. В диалоге расчёта (при создании или редактировании) добавляйте файлы кнопкой **Add** — выбранные документы копируются в папку сделки и сохраняются в поле `files` расчёта.
5. Кнопка **Open** в диалоге расчёта открывает папку сделки для ручного управления файлами.

### Payments Management
1. Перейдите на вкладку "Payments" — таблица покажет платежи для выбранной сделки и полиса.
2. Выберите сделку в верхнем списке; без выбранной сделки кнопки добавления/редактирования/удаления недоступны.
3. После выбора сделки укажите полис в выпадающем списке; пока не выбран полис, добавление или редактирование платежа недоступны, а таблица остаётся пустой.
4. **Добавление платежа**: нажмите **Add**, заполните форму (сумма, дата, комментарий и прочие обязательные поля) и подтвердите сохранение.
5. **Редактирование платежа**: выделите запись в таблице, нажмите **Edit**, внесите изменения и сохраните.
6. **Удаление платежа**: выберите запись, нажмите **Delete** и подтвердите действие в диалоге.
7. При переключении сделки или полиса список платежей автоматически обновляется; можно последовательно управлять платежами для разных связок сделки и полиса без перезапуска приложения.

## API Integration

### Endpoints Used

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `http://localhost:8082/api/v1/auth/token` | Зарезервировано под будущую авторизацию (не используется в текущей сборке) |
| GET | `http://localhost:8082/api/v1/clients` | List all clients |
| GET | `http://localhost:8082/api/v1/clients/{id}` | Get specific client |
| POST | `http://localhost:8082/api/v1/clients` | Create client |
| PATCH | `http://localhost:8082/api/v1/clients/{id}` | Update client |
| GET | `http://localhost:8082/api/v1/deals` | List all deals |
| GET | `http://localhost:8082/api/v1/deals/{id}` | Get specific deal |
| GET | `http://localhost:8082/api/v1/deals/{id}/journal` | List journal entries for deal |
| POST | `http://localhost:8082/api/v1/deals/{id}/journal` | Create journal entry |
| GET | `http://localhost:8082/api/v1/deals/{deal_id}/policies/{policy_id}/payments` | Get payments for deal policy |

> ⚠️ Операции удаления клиентов, сделок и записей журнала пока не поддерживаются CRM API. Соответствующие методы `CRMService.delete_client`, `CRMService.delete_deal` и `CRMService.delete_journal_entry` остаются в коде как заглушки на будущее.

### Authentication

В текущей сборке запросы к CRM API выполняются без Bearer-токена: `show_login_dialog` из `main.py` напрямую создаёт `APIClient()` без передачи учётных данных и немедленно возвращает управление приложению.

Механизм аутентификации сохранён в кодовой базе для будущей интеграции с CRM API. После включения проверки токенов достаточно восстановить обработку диалога входа и выдачу JWT на сервере авторизации.

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DESKTOP_API_BASE_URL` | `http://localhost:8082/api/v1` | API base URL |
| `DESKTOP_API_TIMEOUT` | `10` | Request timeout in seconds |
| `DESKTOP_LOG_LEVEL` | `INFO` | Logging level |
| `DESKTOP_JOURNAL_AUTHOR_ID` | — | UUID пользователя CRM для записей журнала по умолчанию |

### Logging

Logs are printed to console with format:
```
2025-10-23 17:30:45,123 - crm_service - INFO - Fetched 5 clients
```

Configure level in `.env`:
- `DEBUG`: Detailed diagnostic information
- `INFO`: General information (default)
- `WARNING`: Warning messages
- `ERROR`: Error messages only

## Development

### Running Tests

Отдельного каталога `tests/` пока нет. Для проверки работы API и представлений используйте диагностические скрипты в корне приложения:

```bash
# Проверка API без авторизации (требуется запущенный backend)
python test_api.py

# Диагностика получения задач из API
python test_tasks_display.py

# Имитация отображения задач в Treeview без запуска GUI
python test_treeview_display.py
```

> Скрипт `test_treeview_ui.py` открывает окно Tkinter с тестовыми данными и пригоден для ручной проверки отображения кириллицы.

### Code Style

Follow PEP 8 guidelines:
```bash
# Format code
black desktop_app/

# Check style
flake8 desktop_app/

# Type checking
mypy desktop_app/
```

### Adding New Features

1. Create new service module (например, `*_service.py`) в корне `desktop_app/` при необходимости
2. Create new tab component if adding UI
3. Add methods to `CRMService` for API calls
4. Update main.py to integrate new feature
5. Add logging at key points
6. Write tests

## Troubleshooting

### Connection Errors
- Verify API is running on port 8082
- Check firewall settings
- Review logs for detailed error messages

### Authentication Issues
- В актуальной сборке авторизация отключена; убедитесь, что backend действительно не требует токенов.
- Если сервер CRM переведён в режим проверки JWT, восстановите показ `LoginDialog` и передайте полученный токен в `APIClient`.
- При возникновении ответов 401 проверьте конфигурацию API и действительность выданного токена.

### UI Freezing
- Application uses threading for API calls
- If still frozen, check logs for errors
- Increase timeout in `.env` if network is slow

## Future Enhancements

1. **Token Refresh**: Automatic refresh before expiration
2. **Caching**: Local cache for offline functionality
3. **Sync**: Background sync with server
4. **Notifications**: Desktop notifications for updates
5. **Analytics**: Charts and reports within app
6. **Export**: Export client/deal data to CSV/PDF

## Performance Considerations

- UI thread never blocks on network calls
- Default 10-second timeout prevents hanging
- Pagination for large datasets (when implemented)
- Local cache to reduce API calls (future feature)

## Security

- При повторном включении авторизации токены будут храниться только в памяти; текущая сборка не сохраняет и не использует токены.
- HTTPS support via requests library
- No credentials logged to console
- Environment variables for sensitive config

## License

Internal use only - CRM_2.0 Project

## Support

For issues or questions:
1. Check logs: Application logs to console
2. Review API health: `http://localhost:8080/api/v1/health`
   > При необходимости замените порт на значение переменной окружения `GATEWAY_SERVICE_PORT`.
3. Check error messages in application dialogs
