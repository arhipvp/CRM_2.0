# Role Normalization Guide

Коммит: `3c3b530`

## Обзор

Реализована comprehensive система нормализации ролей пользователей, которая гарантирует, что независимо от формата ролей, возвращаемого бэкендом, фронтенд работает с единообразной структурой данных.

## Проблема

Различные системы аутентификации возвращают роли в разных форматах:
- **Spring Security**: `[{ authority: "ROLE_ADMIN" }, ...]`
- **Keycloak**: `[{ id: "uuid", name: "admin" }, ...]`
- **Auth0**: `["admin", "user", ...]`
- **Legacy**: `"ROLE_ADMIN,ROLE_USER"`

Без нормализации код должен был бы обрабатывать все эти форматы одновременно, что приводит к ошибкам и сложности.

## Решение

### 1. RawUserResponse Interface

Описывает различные форматы ролей, которые может вернуть backend:

```typescript
interface RawUserResponse {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles?: string[] | { [key: string]: any }[] | string;
}
```

### 2. Normalized User Interface

Гарантирует единую структуру для всех компонентов:

```typescript
interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles: string[]; // ✓ Всегда массив строк, никогда не undefined
}
```

**Ключевое отличие:** `roles` всегда это массив строк, он **никогда** не бывает `undefined`.

### 3. normalizeRoles() Function

Преобразует любой формат ролей в `string[]`:

```typescript
function normalizeRoles(rolesData: any): string[]
```

**Поддерживаемые форматы:**

| Входной формат | Пример | Результат |
|---|---|---|
| Массив строк | `["ROLE_ADMIN", "ROLE_USER"]` | `["ROLE_ADMIN", "ROLE_USER"]` |
| Массив объектов (name) | `[{ name: "ROLE_ADMIN" }]` | `["ROLE_ADMIN"]` |
| Массив объектов (role) | `[{ role: "ROLE_USER" }]` | `["ROLE_USER"]` |
| Массив объектов (authority) | `[{ authority: "ROLE_ADMIN" }]` | `["ROLE_ADMIN"]` |
| Строка (запятая-разделённая) | `"ROLE_ADMIN,ROLE_USER"` | `["ROLE_ADMIN", "ROLE_USER"]` |
| Пустой/null/undefined | `null` | `[]` |
| Смешанные форматы | `["ROLE_ADMIN", { name: "ROLE_USER" }]` | `["ROLE_ADMIN", "ROLE_USER"]` |

### 4. normalizeUser() Function

Преобразует сырые данные пользователя в нормализованный объект:

```typescript
function normalizeUser(rawUser: RawUserResponse): User
```

**Примеры использования:**

```typescript
// Spring Security response
const raw = {
  id: "123",
  email: "admin@example.com",
  roles: [{ authority: "ROLE_ADMIN" }]
};
const normalized = normalizeUser(raw);
// → { id: "123", email: "admin@example.com", roles: ["ROLE_ADMIN"] }

// Keycloak response
const raw = {
  id: "456",
  email: "user@example.com",
  firstName: "John",
  roles: [{ id: "role-id", name: "user" }]
};
const normalized = normalizeUser(raw);
// → { id: "456", email: "user@example.com", firstName: "John", roles: ["user"] }
```

## Архитектура

### Поток данных

```
Backend Response (любой формат)
    ↓
login() / getCurrentUser()
    ↓
normalizeUser(rawData)
    ├── normalizeRoles(rawUser.roles)
    └── создаёт User object
    ↓
AuthContext.setUser(normalizedUser)
    ↓
Components (UserProfileDropdown, etc.)
    ├── user.roles всегда string[]
    └── formatRolesForDisplay(user.roles)
```

### Файлы

| Файл | Назначение |
|------|-----------|
| `frontend/services/authApi.ts` | Функции нормализации и API запросы |
| `frontend/contexts/AuthContext.tsx` | Использование нормализации при логине |
| `frontend/components/UserProfileDropdown.tsx` | Отображение нормализованных ролей |
| `frontend/services/authApi.test.ts` | Unit тесты для normalizeRoles/User (40+ тестов) |
| `frontend/components/UserProfileDropdown.test.tsx` | Тесты для форматирования ролей (30+ тестов) |
| `frontend/services/RoleNormalization.stories.tsx` | Интерактивная демонстрация в Storybook |
| `frontend/components/UserProfileDropdown.stories.tsx` | Примеры компонента для разных ролей |

## Использование

### Логин

```typescript
// authApi.ts
const response = await login(credentials);
// response.user уже нормализован!
```

### Получение текущего пользователя

```typescript
// authApi.ts
const user = await getCurrentUser();
// user.roles гарантированно это string[]
```

### В компонентах

```typescript
const { user } = useAuth();

// user.roles всегда это string[], можем безопасно использовать
user.roles.forEach(role => {
  console.log(`User has role: ${role}`);
});

// formatRolesForDisplay преобразует в читаемый вид
const displayText = formatRolesForDisplay(user.roles);
// "Admin, User, Manager"
```

### Экспорт функций для использования в других местах

```typescript
// Используйте где угодно в приложении
import { normalizeRoles, normalizeUser } from '../services/authApi';

const roles = normalizeRoles(backendData.roles);
const user = normalizeUser(backendData);
```

## Тестирование

### Запуск unit тестов

```bash
cd frontend

# Тесты для нормализации ролей
npm run test -- authApi.test.ts

# Тесты для форматирования ролей в UI
npm run test -- UserProfileDropdown.test.ts
```

### Запуск Storybook

```bash
cd frontend
npm run storybook

# Открыть:
# - Utilities/Role Normalization - интерактивные примеры
# - Components/UserProfileDropdown - примеры компонента
```

## Примеры

### Пример 1: Типичный ответ Spring Security

```typescript
// От backend
{
  accessToken: "...",
  user: {
    id: "user-123",
    email: "admin@company.com",
    firstName: "John",
    lastName: "Admin",
    roles: [
      { id: "role-1", authority: "ROLE_ADMIN" },
      { id: "role-2", authority: "ROLE_USER" }
    ]
  }
}

// После нормализации в login()
LoginResponse {
  accessToken: "...",
  user: {
    id: "user-123",
    email: "admin@company.com",
    firstName: "John",
    lastName: "Admin",
    roles: ["ROLE_ADMIN", "ROLE_USER"]  // ✓ Простой массив строк
  }
}

// В компоненте
<p>{formatRolesForDisplay(user.roles)}</p>
// Отображает: "Admin, User"
```

### Пример 2: Обработка ошибочных/неправильных данных

```typescript
// Различные неправильные форматы
normalizeRoles(null)              // → []
normalizeRoles("")                // → []
normalizeRoles([])                // → []
normalizeRoles("ROLE_ADMIN")      // → ["ROLE_ADMIN"]
normalizeRoles(["ROLE_ADMIN", "", null, "ROLE_USER"])
                                  // → ["ROLE_ADMIN", "ROLE_USER"]

// User без ролей
const user = normalizeUser({
  id: "123",
  email: "guest@example.com"
});
// user.roles → []  (не undefined!)
```

### Пример 3: Роли в UserProfileDropdown

```typescript
// Один администратор
<UserProfileDropdown />  // Отображает "Admin"

// Менеджер с несколькими ролями
user.roles = ["ROLE_MANAGER", "ROLE_EDITOR", "ROLE_USER"]
// Отображает: "Manager, Editor, User"

// Нет ролей
user.roles = []
// Отображает: "User" (дефолт)
```

## Edge Cases

### Что происходит если...

**1. Backend возвращает пустой roles?**
```typescript
normalizeRoles(null)      // → []
normalizeRoles(undefined) // → []
normalizeRoles([])        // → []
normalizeRoles("")        // → []
```

**2. Backend возвращает неизвестный формат?**
```typescript
// Объект без стандартных полей
normalizeRoles({ custom: "value" })
// → ["value"] (извлекает значения из объекта)
```

**3. Пользователь без ролей в БД?**
```typescript
const user = normalizeUser({
  id: "123",
  email: "user@example.com"
  // roles не указаны
});
console.log(user.roles); // → [] (безопасно, не undefined)
```

## Отладка

### Логирование

В `getCurrentUser()` и при логине логируются роли:

```typescript
// В console
"Current user roles: ['ROLE_ADMIN', 'ROLE_USER']"
"User logged in with roles: ['ROLE_MANAGER']"
```

### Проверка в DevTools

```javascript
// Browser console
const { user } = useAuth();
console.log('User roles:', user.roles);
console.log('Is admin?', user.roles.includes('ROLE_ADMIN'));
```

## Type Safety

### Before (без нормализации)

```typescript
interface User {
  roles?: string[] | RoleObject[] | string; // ❌ Неопределённый тип!
}

// Использование
if (user?.roles) {
  // Что это? Массив? Строка? Объект?
  user.roles.forEach(...); // ❌ Может упасть!
}
```

### After (с нормализацией)

```typescript
interface User {
  roles: string[]; // ✓ Всегда массив строк
}

// Использование
user.roles.forEach(role => {
  // ✓ 100% безопасно, это массив строк
  console.log(role);
});
```

## Интеграция с другими системами

Функции экспортируются для использования в других местах:

```typescript
// Где-то в приложении
import { normalizeRoles } from '../services/authApi';

const roles = normalizeRoles(someDataFromAnotherSource);
```

## Производительность

- `normalizeRoles()`: O(n) где n — количество ролей (обычно 1-5)
- `normalizeUser()`: O(n)
- Нет рекурсии, нет deep cloning
- Безопасно вызывать при каждом логине/refresh

## Будущие улучшения

- [ ] Кэширование нормализованных ролей
- [ ] Интеграция с i18n для отображения ролей на разных языках
- [ ] Role-based access control (RBAC) helper функции
- [ ] Валидация ролей по белому списку

## Related Commits

- `f300540` - feat: Enhance token refresh logic with refreshToken persistence
- `0761ab5` - fix: Correct GATEWAY_UPSTREAM_AUTH_BASE_URL to include /api/auth
- `3c3b530` - feat: Implement role normalization and validation (этот коммит)
