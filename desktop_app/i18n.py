"""
Internationalization (i18n) module for CRM Desktop Application
Russian localization support
"""

# Russian translations dictionary
TRANSLATIONS_RU = {
    # Main window
    "CRM Management System": "CRM Система управления",
    "File": "Файл",
    "Help": "Справка",
    "Exit": "Выход",
    "About": "О программе",
    "Login": "Вход",
    "Logout": "Выход из аккаунта",
    "Settings": "Параметры",

    # Tab names
    "Deals": "Сделки",
    "Tasks": "Задачи",
    "Policies": "Полисы",
    "Payments": "Платежи",
    "Calculations": "Расчеты",
    "Deal Journal": "Журнал сделок",

    # Common buttons
    "Add": "Добавить",
    "Edit": "Редактировать",
    "Delete": "Удалить",
    "Refresh": "Обновить",
    "Search": "Поиск",
    "Export CSV": "Экспорт CSV",
    "Export Excel": "Экспорт Excel",
    "Cancel": "Отмена",
    "Save": "Сохранить",
    "OK": "ОК",
    "Close": "Закрыть",
    "Submit": "Отправить",
    "Open": "Открыть",
    "Remove": "Удалить",
    "Info": "Информация",

    # Common dialogs
    "Success": "Успех",
    "Error": "Ошибка",
    "Warning": "Предупреждение",
    "Confirm": "Подтверждение",
    "Confirm Delete": "Подтвердить удаление",
    "Are you sure you want to delete this": "Вы уверены что хотите удалить это",
    "created successfully": "успешно создано",
    "updated successfully": "успешно обновлено",
    "deleted successfully": "успешно удалено",
    "failed to create": "ошибка при создании",
    "failed to update": "ошибка при обновлении",
    "failed to delete": "ошибка при удалении",

    # Deals tab
    "Deal Title": "Название сделки",
    "Status": "Статус",
    "Client": "Клиент",
    "Amount": "Сумма",
    "Start Date": "Дата начала",
    "End Date": "Дата окончания",
    "Created": "Создана",
    "Deleted": "Удалена",
    "Add Deal": "Добавить сделку",
    "Edit Deal": "Редактировать сделку",
    "Deal Details": "Детали сделки",
    "Notes": "Заметки",
    "Payments": "Платежи",
    "Add Note": "Добавить заметку",

    # Tasks tab
    "Task Title": "Название задачи",
    "Title": "Название",
    "Priority": "Приоритет",
    "Due Date": "Срок выполнения",
    "Description": "Описание",
    "Add Task": "Добавить задачу",
    "Edit Task": "Редактировать задачу",
    "Task Details": "Детали задачи",
    "Please select a task to edit": "Пожалуйста выберите задачу для редактирования",
    "Please select a task to delete": "Пожалуйста выберите задачу для удаления",

    # Policies tab
    "Policy Number": "Номер полиса",
    "Premium": "Премия",
    "Effective From": "Дата начала действия",
    "Effective To": "Дата окончания действия",
    "Add Policy": "Добавить полис",
    "Edit Policy": "Редактировать полис",
    "Policy Details": "Детали полиса",
    "Please select a policy to edit": "Пожалуйста выберите полис для редактирования",
    "Please select a policy to delete": "Пожалуйста выберите полис для удаления",

    # Calculations tab
    "Select Deal": "Выбрать сделку",
    "Deal": "Сделка",
    "Insurance Company": "Страховая компания",
    "Program Name": "Название программы",
    "Premium Amount": "Размер премии",
    "Coverage Sum": "Сумма покрытия",
    "Filters": "Фильтры",
    "Add Calculation": "Добавить расчет",
    "Edit Calculation": "Редактировать расчет",
    "Delete Calculation": "Удалить расчет",
    "Calculation Details": "Детали расчета",
    "Comments": "Комментарии",
    "Please select a deal first": "Пожалуйста выберите сделку сначала",
    "Please select a calculation to edit": "Пожалуйста выберите расчет для редактирования",
    "Please select a calculation to delete": "Пожалуйста выберите расчет для удаления",
    "Attach Document": "Прикрепить документ",
    "Open Document": "Открыть документ",

    # Payments tab
    "Payment Date": "Дата платежа",
    "Amount Paid": "Сумма платежа",
    "Payment Method": "Способ платежа",
    "Reference": "Ссылка",
    "Add Payment": "Добавить платеж",
    "Edit Payment": "Редактировать платеж",
    "Payment Details": "Детали платежа",

    # Deal Journal tab
    "Action": "Действие",
    "Timestamp": "Время",
    "Changes": "Изменения",
    "Deal Journal": "Журнал сделок",

    # Common fields
    "ID": "ИД",
    "Name": "Имя",
    "Email": "Электронная почта",
    "Phone": "Телефон",
    "Address": "Адрес",
    "Notes": "Примечания",
    "Comments": "Комментарии",
    "No": "Нет",
    "Yes": "Да",
    "All": "Все",
    "Files": "Файлы",

    # Messages
    "No data to export": "Нет данных для экспорта",
    "Data exported to": "Данные экспортированы в",
    "Failed to export data": "Ошибка при экспорте данных",
    "Exported to CSV": "Экспортировано в CSV",
    "Exported to Excel": "Экспортировано в Excel",
    "Please select an item": "Пожалуйста выберите элемент",
    "Are you sure": "Вы уверены",
    "Failed to fetch": "Ошибка при получении",
    "API Error": "Ошибка API",
    "No files were attached": "Файлы не были прикреплены",
    "Files attached to deal folder": "Файлы сохранены в папку сделки",
    "File not found in deal folder. It may have been moved or deleted.": "Файл не найден в папке сделки. Возможно, он был перемещен или удален.",
    "Select file": "Выберите файл",
    "Select files": "Выберите файлы",
    "Select a document to open": "Выберите документ для открытия",
    "Select file to remove": "Выберите файл для удаления",
    "Deal ID not found": "Идентификатор сделки не найден",

    # Search and Filter
    "Search by title": "Поиск по названию",
    "Search by name": "Поиск по имени",
    "Search by email": "Поиск по электронной почте",
    "Filter": "Фильтр",

    # Login dialog
    "Login": "Вход",
    "Username": "Имя пользователя",
    "Password": "Пароль",
    "Sign In": "Войти",
    "Invalid credentials": "Неверные учетные данные",
    "Please enter username": "Пожалуйста введите имя пользователя",
    "Please enter password": "Пожалуйста введите пароль",

    # Clients tab (if exists)
    "Clients": "Клиенты",
    "Add Client": "Добавить клиента",
    "Edit Client": "Редактировать клиента",
    "Client Details": "Детали клиента",
    "Company Name": "Название компании",
    "Contact Person": "Контактное лицо",

    # Date/Time
    "Today": "Сегодня",
    "Yesterday": "Вчера",
    "This Week": "На этой неделе",
    "This Month": "В этом месяце",
    "This Year": "В этом году",
}

class I18n:
    """Internationalization handler"""

    def __init__(self, language: str = "ru"):
        self.language = language
        self.translations = TRANSLATIONS_RU if language == "ru" else {}

    def get(self, key: str, default: str = None) -> str:
        """Get translated string, fallback to key if not found"""
        if key in self.translations:
            return self.translations[key]
        return default or key

    def __call__(self, key: str) -> str:
        """Allow using i18n as callable: i18n('key')"""
        return self.get(key)


# Global i18n instance
i18n = I18n("ru")
