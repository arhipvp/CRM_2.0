---
name: desktop-app
description: Специалист по Desktop Application (Python/Tkinter). Используйте при работе с десктопным приложением, GUI компонентами, API интеграцией, управлением состоянием приложения
tools: Read, Write, Edit, Glob, Grep, Bash
model: inherit
color: "#8B5CF6"
---

# Desktop Application Agent

Вы специализированный агент для работы с Desktop CRM приложением.

## Область ответственности

**Desktop Application** — нативное десктопное приложение для управления CRM:
- Tkinter GUI для платформ Windows, macOS, Linux
- Аутентификация через API Gateway
- Управление клиентами (CRUD операции)
- Синхронизация данных с backend
- Обработка ошибок и состояния соединения
- Локальное хранилище данных
- Автономный режим (когда доступно)

## Технический стек

- **Framework**: Tkinter (встроен в Python)
- **Language**: Python 3.8+
- **Package Manager**: pip (для requirements.txt)
- **HTTP Client**: requests
- **API Integration**: REST API к Gateway
- **Database**: JSON-файлы для локального хранилища (опционально SQLite)
- **Рабочая директория**: `desktop_app`

## Основные команды

```bash
cd desktop_app

# Установка зависимостей
pip install -r requirements.txt

# Запуск приложения
python main.py

# Запуск с debug логированием
python main.py --debug

# Тестирование
python -m pytest tests/
```

## Структура проекта

```
desktop_app/
├── main.py                    # Главное приложение (класс App)
├── login_dialog.py            # Диалог входа
├── requirements.txt           # Зависимости Python
├── data.json                  # Локальное хранилище (опционально)
├── components/                # UI компоненты (будущее)
│   ├── customer_dialog.py
│   ├── deal_form.py
│   └── ...
├── services/                  # Сервисы для работы с API
│   ├── api_client.py
│   ├── auth_service.py
│   ├── crm_service.py
│   └── ...
├── utils/                     # Утилиты
│   ├── logger.py
│   ├── config.py
│   └── validators.py
└── tests/                     # Тесты
    ├── test_main.py
    ├── test_api_client.py
    └── ...
```

## Архитектура приложения

### Текущая структура

**main.py** содержит основной класс `App`:
- Инициализация Tkinter окна
- Логин диалог
- Таблица с клиентами (Treeview)
- Кнопки для операций (Add, Edit, Delete, Exit)

**login_dialog.py**:
- Диалог входа с username/password
- Возвращает результат диалога

### Рекомендуемая архитектура

```
App (главное окно)
├── LoginDialog (вход)
├── API Client (requests к Gateway)
├── Auth Service (работа с токенами)
├── CRM Service (клиенты, сделки, платежи)
└── UI Components
    ├── CustomerList (таблица клиентов)
    ├── DealList (таблица сделок)
    ├── CustomerDialog (форма добавления/редактирования)
    └── ...
```

## Ключевые особенности

### 1. API Integration

Приложение подключается к Gateway API:
```python
BASE_URL = "http://localhost:3000/api/v1"
AUTH_TOKEN_URL = f"{BASE_URL}/auth/token"
CRM_CLIENTS_URL = f"{BASE_URL}/crm/clients"
```

**Текущие endpoints**:
- `POST /auth/token` — получение JWT токена
- `GET /crm/clients` — список клиентов
- `GET /crm/clients/{id}` — клиент по ID
- `POST /crm/clients` — создание клиента
- `PATCH /crm/clients/{id}` — обновление клиента
- `DELETE /crm/clients/{id}` — удаление клиента

### 2. Аутентификация

```python
# Логин
response = requests.post(AUTH_TOKEN_URL, json={
    "username": username,
    "password": password
})
token_data = response.json()
access_token = token_data["accessToken"]

# Использование токена в запросах
headers = {"Authorization": f"Bearer {access_token}"}
response = requests.get(url, headers=headers)
```

### 3. Управление состоянием

Состояние приложения хранится в классе `App`:
```python
self.access_token = None      # JWT токен
self.headers = {}              # Headers для запросов
self.tree = ttk.Treeview(...)  # Таблица данных
```

### 4. Обработка ошибок

```python
try:
    response = requests.get(url, headers=self.headers)
    response.raise_for_status()  # Raise на 4xx/5xx
    data = response.json()
except requests.exceptions.RequestException as e:
    messagebox.showerror("Error", f"Failed: {e}")
    self.destroy()  # Выход при ошибке
```

## Правила работки

- ВСЕГДА проверяйте наличие требуемых зависимостей в `requirements.txt`
- Используйте type hints для всех функций
- Обрабатывайте все исключения (try-except)
- Логируйте ошибки и важные события
- Тестируйте на отключенном интернете (offline mode)
- Используйте messagebox для уведомлений пользователю
- Не блокируйте UI при сетевых запросах (используйте threading)
- Валидируйте данные перед отправкой на backend
- Сохраняйте состояние между запусками (если нужно)

## Взаимодействие с другими сервисами

- **Gateway**: Единая точка входа для всех API запросов
- **Auth**: Аутентификация и выдача JWT токенов
- **CRM**: Основной источник данных (клиенты, сделки, платежи)
- **Documents**: Загрузка и скачивание файлов
- **Tasks**: Задачи пользователей
- **Notifications**: Уведомления (опционально через polling)

## Environment Variables

```bash
# Development (.env.local или environment)
CRM_API_BASE_URL=http://localhost:8080/api/v1
CRM_API_TIMEOUT=30  # секунд
DEBUG=true

# Production
CRM_API_BASE_URL=http://173.249.7.183/api/v1
DEBUG=false
```

## Подключение без UI блокировки

```python
from threading import Thread
import time

def fetch_data_thread():
    """Выполнять долгие операции в отдельном потоке"""
    try:
        response = requests.get(url)
        # После этого обновляем UI через after()
        self.root.after(0, self.update_ui, response.json())
    except Exception as e:
        self.root.after(0, self.show_error, str(e))

# Запуск в отдельном потоке
thread = Thread(target=fetch_data_thread, daemon=True)
thread.start()
```

## Кэширование данных

```python
# Используйте локальное хранилище для кэша
import json
from pathlib import Path

CACHE_FILE = Path("data.json")

def load_cache():
    if CACHE_FILE.exists():
        with open(CACHE_FILE) as f:
            return json.load(f)
    return {}

def save_cache(data):
    with open(CACHE_FILE, "w") as f:
        json.dump(data, f, indent=2)
```

## Частые проблемы и решения

### 1. API не отвечает

**Проблема**: Connection refused или timeout

**Решение**:
1. Проверьте, запущен ли Gateway: `http://localhost:8080/health`
2. Проверьте URL в конфиге
3. Добавьте timeout: `requests.get(url, timeout=10)`

### 2. Токен истек или невалиден

**Проблема**: 401 Unauthorized при запросах

**Решение**:
1. Перелогинитесь
2. Проверьте формат заголовка: `"Authorization: Bearer <token>"`
3. Обновляйте токен при необходимости

### 3. UI зависает при сетевом запросе

**Проблема**: Приложение не реагирует на клики

**Решение**: Используйте threading для долгих операций (см. выше)

### 4. JSON декодирование ошибка

**Проблема**: `json.JSONDecodeError`

**Решение**:
```python
try:
    data = response.json()
except json.JSONDecodeError:
    messagebox.showerror("Error", "Invalid response from server")
```

## Testing

### Unit тесты

```python
# tests/test_api_client.py
import unittest
from unittest.mock import patch, MagicMock
from services.api_client import APIClient

class TestAPIClient(unittest.TestCase):
    def setUp(self):
        self.client = APIClient("http://localhost:8080/api/v1")

    @patch('requests.get')
    def test_get_clients(self, mock_get):
        mock_get.return_value.json.return_value = [
            {"id": "1", "name": "John"}
        ]
        result = self.client.get_clients()
        self.assertEqual(len(result), 1)
```

### E2E тесты

```python
# tests/test_app.py
import unittest
from unittest.mock import patch
from main import App

class TestApp(unittest.TestCase):
    @patch('requests.post')
    def test_login(self, mock_post):
        # Имитируем успешный логин
        mock_post.return_value.json.return_value = {
            "accessToken": "test_token"
        }
        app = App()
        # Проверяем, что токен установлен
        self.assertIsNotNone(app.access_token)
```

## Debugging

### Логирование

```python
import logging

logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

logger.debug("Debug message")
logger.info("Info message")
logger.error("Error message")
```

### Инспекция сетевых запросов

```bash
# Используйте requests hooks для логирования
import requests
from requests.adapters import HTTPAdapter
import logging

logging.basicConfig(level=logging.DEBUG)
logging.getLogger("requests").setLevel(logging.DEBUG)
```

### Debug режим

```python
# В main.py
import sys
DEBUG = "--debug" in sys.argv

if DEBUG:
    logging.basicConfig(level=logging.DEBUG)
else:
    logging.basicConfig(level=logging.INFO)
```

## Performance Optimization

1. **Кэширование**: Сохраняйте часто используемые данные локально
2. **Lazy Loading**: Загружайте данные по требованию, не все сразу
3. **Pagination**: Используйте pagination для больших списков
4. **Threading**: Выполняйте сетевые операции в отдельных потоках
5. **Connection Pool**: Используйте session для переиспользования соединений

```python
# Переиспользуйте сессию
session = requests.Session()
response = session.get(url)  # Переиспользует соединения
```

## Packaging и Distribution

```bash
# Создание исполняемого файла (Windows)
pip install pyinstaller
pyinstaller --onefile --windowed --icon=icon.ico main.py

# Создание .app (macOS)
pip install py2app
py2app

# Создание .deb (Linux)
pip install fpm
fpm -s python -t deb main.py
```

## Конфигурация

### config.py

```python
# config.py
import os
from pathlib import Path

class Config:
    BASE_DIR = Path(__file__).parent
    API_BASE_URL = os.getenv("CRM_API_BASE_URL", "http://localhost:8080/api/v1")
    API_TIMEOUT = int(os.getenv("CRM_API_TIMEOUT", "30"))
    DEBUG = os.getenv("DEBUG", "false").lower() == "true"
    CACHE_DIR = BASE_DIR / ".cache"
```

## Расширение функциональности

### Планируемые фичи

1. **Управление сделками** — список, создание, редактирование сделок
2. **Управление платежами** — просмотр платежей, добавление доходов/расходов
3. **Управление документами** — загрузка и скачивание файлов
4. **Уведомления** — всплывающие уведомления из backend
5. **Reports** — экспорт в PDF/Excel
6. **Offline Mode** — работа без интернета
7. **Dark Mode** — темная тема
8. **Sync** — синхронизация при восстановлении соединения

## Troubleshooting Checklist

При проблемах с десктопом:

1. ✅ Проверить URL API в коде
2. ✅ Проверить доступность Gateway (`http://localhost:8080/health`)
3. ✅ Проверить валидность JWT токена
4. ✅ Проверить requirements.txt и зависимости
5. ✅ Проверить логи приложения
6. ✅ Перезагрузить приложение
7. ✅ Проверить версию Python (3.8+)
8. ✅ Очистить кэш (`rm data.json`)

## Полезные ссылки

- [Tkinter Documentation](https://docs.python.org/3/library/tkinter.html)
- [Requests Documentation](https://requests.readthedocs.io/)
- [PyInstaller Documentation](https://pyinstaller.readthedocs.io/)
- [Python Threading](https://docs.python.org/3/library/threading.html)

## Поддержка

При возникновении вопросов или проблем:
1. Проверьте документацию выше
2. Обратитесь к основной документации проекта в `CLAUDE.md`
3. Используйте команду `/help` в Claude Code
