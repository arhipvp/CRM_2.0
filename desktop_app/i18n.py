"""Internationalization (i18n) module for CRM Desktop application."""

from __future__ import annotations

from typing import Dict

# Russian translations dictionary
TRANSLATIONS: Dict[str, str] = {
    # Main window
    "CRM Desktop": "CRM Desktop",
    "File": "Файл",
    "Exit": "Выход",
    "View": "Вид",
    "Refresh current tab": "Обновить текущую вкладку",

    # Dashboard
    "Dashboard": "Панель управления",
    "Quick stats": "Быстрая статистика",
    "Refresh": "Обновить",
    "Loading...": "Загрузка...",
    "Clients:": "Клиенты:",
    "Deals:": "Сделки:",
    "Policies:": "Полисы:",
    "Tasks:": "Задачи:",
    "Rows loaded: {}": "Строк загружено: {}",

    # Tab titles
    "Clients": "Клиенты",
    "Deals": "Сделки",
    "Policies": "Полисы",
    "Finance": "Финансы",
    "Tasks": "Задачи",

    # Login dialog
    "CRM Desktop - Login": "CRM Desktop - Вход",
    "Sign In": "Вход",
    "Email:": "Email:",
    "Password:": "Пароль:",
    "Enter your email address": "Введите вашу почту",
    "Enter your password": "Введите пароль",
    "Exit": "Выход",
    "Signing in...": "Вход в систему...",
    "Please enter username and password": "Пожалуйста, введите почту и пароль",
    "Invalid username or password": "Неверная почта или пароль",
    "Login failed: {}": "Ошибка входа: {}",

    # Client dialog
    "Email": "Email",
    "active": "active",

    # Deal dialog
    "New deal": "Новая сделка",
    "Edit deal": "Редактирование сделки",
    "Create deal": "Создать сделку",
    "Add client": "Добавить клиента",
    "Title *": "Название *",
    "Description": "Описание",
    "Status": "Статус",
    "Next review *": "Следующая проверка *",
    "Client *": "Клиент *",
    "Create client": "Создать клиента",
    "Validation": "Проверка данных",
    "Enter a deal title.": "Введите название сделки.",
    "Select a client.": "Выберите клиента.",
    "Select a review date.": "Выберите дату проверки.",
    "Load policies": "Загрузить полисы",
    "Load tasks": "Загрузить задачи",

    # Table column headers - Clients
    "ID": "ID",
    "Name": "Название",
    "Phone": "Телефон",
    "Owner ID": "Owner ID",
    "Created": "Создано",
    "Updated": "Обновлено",
    "Deleted": "Удалено",

    # Table column headers - Deals
    "Title": "Название",
    "Description": "Описание",
    "Client": "Клиент",
    "Stage": "Этап",
    "Next review": "Следующая проверка",

    # Table column headers - Policies
    "Policy #": "Полис №",
    "Policy number": "Номер полиса",
    "Deal": "Сделка",
    "Premium": "Премия",
    "Effective From": "Действует с",
    "Effective from": "Действует с",
    "Effective To": "Действует по",
    "Effective to": "Действует по",

    # Table column headers - Finance/Payments
    "Seq": "Посл.",
    "Planned Date": "Плановая дата",
    "Actual Date": "Фактическая дата",
    "Planned Amount": "Плановая сумма",
    "Currency": "Валюта",
    "Comment": "Комментарий",
    "Incomes": "Доходы",
    "Expenses": "Расходы",
    "Net": "Чистая прибыль",

    # Table column headers - Tasks
    "Assignee": "Исполнитель",
    "Author": "Автор",
    "Policy": "Полис",
    "Due": "Срок",

    # Tab titles in dialogs
    "Policies": "Полисы",
    "Payments": "Платежи",
    "Finance": "Финансы",

    # Success messages
    "Success": "Успешно",
    "Client successfully created.": "Клиент успешно создан.",
    "Client data updated.": "Данные клиента обновлены.",
    "Client removed.": "Клиент удален.",
    "Deal successfully created.": "Сделка успешно создана.",
    "Deal updated.": "Сделка обновлена.",
    "Deal removed.": "Сделка удалена.",

    # Delete confirmations
    "Delete client": "Удалить клиента",
    "Delete client \"{}\"?": "Удалить клиента \"{}\"?",
    "Delete deal": "Удалить сделку",
    "Delete deal \"{}\"?": "Удалить сделку \"{}\"?",

    # Error messages
    "Error": "Ошибка",
    "Invalid response type": "Неверный тип ответа",
    "Invalid response types": "Неверные типы ответов",
    "Showing cached data (network error: {})": "Показываю кэшированные данные (ошибка сети: {})",
    "Operation failed: {}": "Операция не удалась: {}",
    "Failed to create client: {}": "Не удалось создать клиента: {}",
    "Failed to update client: {}": "Не удалось обновить клиента: {}",
    "Failed to delete client: {}": "Не удалось удалить клиента: {}",
    "Failed to create deal: {}": "Не удалось создать сделку: {}",
    "Failed to update deal: {}": "Не удалось обновить сделку: {}",
    "Failed to delete deal: {}": "Не удалось удалить сделку: {}",
    "Create a client first.": "Сначала создайте клиента.",

    # Base table actions (translating English versions that might be shown)
    "Добавить": "Добавить",
    "Изменить": "Изменить",
    "Удалить": "Удалить",
    "Обновить": "Обновить",
    "Действие недоступно": "Действие недоступно",
    "Функция добавления пока не реализована.": "Функция добавления пока не реализована.",
    "Функция изменения пока не реализована.": "Функция изменения пока не реализована.",
    "Функция удаления пока не реализована.": "Функция удаления пока не реализована.",
    "Выбор строки": "Выбор строки",
    "Выберите запись для изменения.": "Выберите запись для изменения.",
    "Выберите запись для удаления.": "Выберите запись для удаления.",
}


def translate(text: str, *args) -> str:
    """Translate a string to Russian.

    Args:
        text: English text to translate
        *args: Arguments for string formatting

    Returns:
        Translated text, or original text if translation not found
    """
    translated = TRANSLATIONS.get(text, text)
    if args:
        try:
            return translated.format(*args)
        except (IndexError, KeyError):
            return translated
    return translated


# Alias for convenience
_ = translate
