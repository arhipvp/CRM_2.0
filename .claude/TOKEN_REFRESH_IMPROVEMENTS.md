# Token Refresh Improvements Summary

Коммит: `f300540`

## Что было изменено

### 1. **frontend/services/apiClient.ts** (Response Interceptor)

**Проблема:** При успешном refresh token, backend может вернуть новый `refreshToken`, но фронтенд игнорировал его и сохранял только `accessToken`.

**Решение:**
```typescript
// Было:
const { accessToken } = response.data;
this.setAccessToken(accessToken);

// Стало:
const { accessToken, refreshToken: newRefreshToken } = response.data;
this.setAccessToken(accessToken);

// Обновляем refresh token если backend его прислал
if (newRefreshToken && newRefreshToken.trim()) {
  this.setRefreshToken(newRefreshToken);
  console.log('Token refresh successful: accessToken and refreshToken updated');
} else if (newRefreshToken === '') {
  // Backend прислал пустой refreshToken - не перезаписываем
  console.warn('Received empty refreshToken from server, keeping existing token');
} else {
  console.log('Token refresh successful: accessToken updated, refreshToken not provided');
}
```

**Преимущества:**
- ✓ Оба токена остаются синхронизированными
- ✓ Защита от потери данных: не перезаписываем валидный токен пустой строкой
- ✓ Улучшенная отладка: логирование операций обновления

---

### 2. **frontend/services/authApi.ts** (refreshAccessToken function)

**Проблема:** Функция `refreshAccessToken` используется для вручного refresh (например, на странице Settings), но также игнорировала `refreshToken` из ответа.

**Решение:** Применена та же логика, что и в apiClient:
```typescript
// Было:
const { accessToken } = response.data;
apiClient.setAccessToken(accessToken);

// Стало:
const { accessToken, refreshToken: newRefreshToken } = response.data;
apiClient.setAccessToken(accessToken);

if (newRefreshToken && newRefreshToken.trim()) {
  apiClient.setRefreshToken(newRefreshToken);
  console.log('refreshAccessToken: both tokens updated successfully');
} else if (newRefreshToken === '') {
  console.warn('Received empty refreshToken from server, keeping existing token');
} else {
  console.log('refreshAccessToken: accessToken updated, refreshToken not provided by server');
}
```

---

### 3. **Защита от пустого refreshToken**

Во обоих местах добавлена проверка `newRefreshToken === ''`:
- Если backend прислал **пустую строку** (не `undefined`, а именно `''`), фронтенд:
  1. **НЕ перезаписывает** существующий валидный refreshToken
  2. **Логирует warning**: `"Received empty refreshToken from server, keeping existing token"`
  3. **Продолжает работать** с существующим refreshToken

Это критично, потому что:
```
✗ Без защиты:
  sessionStorage.setItem('refreshToken', '') // Потеря валидного токена!

✓ С защитой:
  // Ничего не происходит, старый токен остаётся
  console.warn('Received empty refreshToken from server...')
```

---

## Тестирование

### Автоматические тесты
Файл: `frontend/services/apiClient.test.ts`

Включает тесты для:
- ✓ Успешного обновления обоих токенов
- ✓ Защиты от пустого refreshToken
- ✓ Логирования warning при пустом refreshToken
- ✓ Условного обновления только accessToken
- ✓ Очистки токенов
- ✓ Проверки наличия токена

Запуск:
```bash
cd frontend
npm run test -- apiClient.test.ts
```

### Ручная проверка (Emulation of 401)
Файл: `frontend/services/401-emulation-guide.md`

**Способ 1: Browser Console**
```javascript
// 1. Установить протухший accessToken
sessionStorage.setItem('accessToken', 'EXPIRED-TOKEN-123');

// 2. Выполнить API запрос
import { apiClient } from './services/apiClient.ts';
apiClient.get('/deals')
  .then(r => console.log('SUCCESS:', r.data))
  .catch(e => console.error('ERROR:', e));

// 3. Наблюдать в Network tab:
//    GET /api/v1/deals → 401
//    POST /api/v1/auth/refresh → 200
//    GET /api/v1/deals (retry) → 200
```

**Способ 2: Programmatic Test Component**
```typescript
// frontend/components/TestTokenRefresh.tsx
import { useEffect } from 'react';
import { apiClient } from '../services/apiClient';

export function TestTokenRefresh() {
  useEffect(() => {
    const testRefresh = async () => {
      const original = apiClient.getAccessToken();

      // Имитируем протухший токен
      apiClient.setAccessToken('EXPIRED-TOKEN-123456789');

      try {
        // Попытка запроса с протухшим токеном
        const response = await apiClient.get('/deals');
        console.log('✓ SUCCESS! Refresh and retry worked');
        console.log('  New accessToken:', apiClient.getAccessToken() !== 'EXPIRED-TOKEN-123456789');
      } catch (error) {
        console.error('✗ FAILED:', error.message);
        apiClient.setAccessToken(original);
      }
    };

    setTimeout(testRefresh, 1000);
  }, []);

  return <div>Testing token refresh...</div>;
}
```

---

## Ожидаемые результаты

### ✓ Успешный сценарий:

```
Network tab:
1. GET /api/v1/deals → 401 Unauthorized
2. POST /api/v1/auth/refresh → 200 OK
   Response: { accessToken: "new-...", refreshToken: "new-..." }
3. GET /api/v1/deals (retry) → 200 OK

Console:
✓ Token refresh successful: accessToken and refreshToken updated
✓ Original request completed successfully

Storage:
- accessToken: new-token-value
- refreshToken: new-refresh-value
```

### ✓ Сценарий с пустым refreshToken от сервера:

```
Network tab:
1. GET /api/v1/deals → 401 Unauthorized
2. POST /api/v1/auth/refresh → 200 OK
   Response: { accessToken: "new-...", refreshToken: "" }
3. GET /api/v1/deals (retry) → 200 OK

Console:
⚠ Received empty refreshToken from server, keeping existing token
✓ Original request completed successfully

Storage:
- accessToken: new-token-value
- refreshToken: old-refresh-value (НЕ перезаписан!)
```

---

## Файлы, которые нужно проверить

| Файл | Назначение |
|------|-----------|
| `frontend/services/apiClient.ts` | Response interceptor с логикой refresh token |
| `frontend/services/authApi.ts` | Функция `refreshAccessToken` с синхронизацией токенов |
| `frontend/services/apiClient.test.ts` | Unit тесты для логики token refresh |
| `frontend/services/401-emulation-guide.md` | Руководство для ручного тестирования |

---

## Логирование для отладки

Все операции refresh логируются в Console:

```javascript
// При успешном refresh обоих токенов:
console.log('Token refresh successful: accessToken and refreshToken updated');

// При refresh только accessToken:
console.log('Token refresh successful: accessToken updated, refreshToken not provided');

// При попытке записать пустой refreshToken:
console.warn('Received empty refreshToken from server, keeping existing token');

// При ошибке refresh:
console.error('Token refresh failed:', error.response?.data || error.message);
```

---

## Checklist для проверки

- [ ] Access token обновляется после 401
- [ ] Refresh token обновляется если backend его вернул
- [ ] Пустой refreshToken от сервера НЕ перезаписывает существующий
- [ ] Console логирует все операции refresh
- [ ] Оригинальный запрос повторяется с новым accessToken
- [ ] Queued запросы выполняются с новым accessToken
- [ ] Тесты `npm run test` проходят
- [ ] Нет JavaScript ошибок при обновлении токена

---

## Дополнительные команды для отладки

```javascript
// Проверить текущие токены в Console
console.log('Tokens:', {
  access: sessionStorage.getItem('accessToken')?.substring(0, 30) + '...',
  refresh: sessionStorage.getItem('refreshToken')?.substring(0, 30) + '...',
});

// Полностью очистить авторизацию
sessionStorage.clear();

// Выполнить refresh вручную
import { refreshAccessToken } from './services/authApi';
refreshAccessToken(sessionStorage.getItem('refreshToken'))
  .then(data => console.log('Refresh OK:', data))
  .catch(err => console.error('Refresh FAILED:', err));
```

---

## Связанные коммиты

- `0761ab5` - fix: Correct GATEWAY_UPSTREAM_AUTH_BASE_URL to include /api/auth endpoint
- `f300540` - feat: Enhance token refresh logic with refreshToken persistence and safeguards (этот коммит)

## Смежные улучшения

Убедитесь, что backend также:
1. Возвращает свежий `refreshToken` в ответе `/auth/refresh` (опционально, если требуется ротация)
2. Правильно обрабатывает случай, когда frontend отправляет старый `refreshToken`
3. Возвращает 401 для истёкших токенов, а не 500/503

Это обеспечит полный цикл обновления токенов на обе стороны.
