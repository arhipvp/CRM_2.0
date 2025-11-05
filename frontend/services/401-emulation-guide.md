# Руководство эмуляции 401 для проверки Token Refresh

## Цель

Проверить, что при получении 401 Unauthorized цепочка запросов продолжает работать:
1. Автоматический refresh access token
2. Обновление refresh token из ответа (если присутствует)
3. Повтор оригинального запроса с новым accessToken

## Способ 1: Browser DevTools консоль

### Шаг 1: Авторизация
```javascript
// Авторизуемся нормально
// Откройте Applications → Session Storage и проверьте:
// - accessToken: "eyJ0eXAiOi..."
// - refreshToken: "eyJ0eXAiOi..."
```

### Шаг 2: Имитация протухшего accessToken
```javascript
// Откройте Console в DevTools и выполните:
sessionStorage.setItem('accessToken', 'expired-old-token-12345');

// Проверьте:
console.log(sessionStorage.getItem('accessToken'));
// Output: expired-old-token-12345
```

### Шаг 3: Выполнить запрос, который вернёт 401
```javascript
// Импортируем и выполняем любой API запрос
// Например, через apiClient напрямую

import { apiClient } from './services/apiClient.ts';

// Это вызовет 401 (expired token)
apiClient.get('/deals')
  .then(response => console.log('SUCCESS:', response.data))
  .catch(error => console.error('ERROR:', error.message));
```

### Шаг 4: Наблюдайте за процессом в Console
```
Network tab:
1. GET /api/v1/deals → 401 (expired accessToken)
2. POST /api/v1/auth/refresh → 200 (new tokens)
3. GET /api/v1/deals (retry) → 200 (success!)

Console:
- Если refresh прошёл: новый accessToken в Session Storage
- Если refreshToken не пустой: обновлён и в Session Storage
- Если refreshToken пустой: сработает warn логирование
```

## Способ 2: Программный тест в коде

### Создайте временный компонент для тестирования:

```typescript
// TestTokenRefresh.tsx
import { useEffect } from 'react';
import { apiClient } from './services/apiClient';

export function TestTokenRefresh() {
  useEffect(() => {
    const testRefresh = async () => {
      // Шаг 1: Сохраняем текущие токены
      const originalAccess = apiClient.getAccessToken();
      const originalRefresh = apiClient.getRefreshToken();

      console.log('Original tokens:');
      console.log('  accessToken:', originalAccess?.substring(0, 20) + '...');
      console.log('  refreshToken:', originalRefresh?.substring(0, 20) + '...');

      // Шаг 2: Имитируем протухший accessToken
      apiClient.setAccessToken('EXPIRED-TOKEN-123456789');

      console.log('\nSet EXPIRED accessToken');
      console.log('  accessToken:', apiClient.getAccessToken());

      // Шаг 3: Пытаемся выполнить запрос
      console.log('\nAttempting request with expired token...');

      try {
        const response = await apiClient.get('/deals');
        console.log('\n✓ SUCCESS! Request completed after automatic refresh');
        console.log('  Response:', response.data);

        // Шаг 4: Проверяем, что токены обновились
        const newAccess = apiClient.getAccessToken();
        const newRefresh = apiClient.getRefreshToken();

        console.log('\nTokens after refresh:');
        console.log('  accessToken changed:', newAccess !== 'EXPIRED-TOKEN-123456789');
        console.log('  refreshToken persisted:', newRefresh === originalRefresh || newRefresh !== '');

      } catch (error: any) {
        console.error('✗ FAILED! Error occurred:', error.message);

        // Восстанавливаем оригинальные токены для дальнейших тестов
        if (originalAccess) apiClient.setAccessToken(originalAccess);
        if (originalRefresh) apiClient.setRefreshToken(originalRefresh);
      }
    };

    // Выполняем тест с задержкой, чтобы приложение инициализировалось
    setTimeout(testRefresh, 1000);
  }, []);

  return <div>Token Refresh Test Running... Check Console</div>;
}
```

## Ожидаемые результаты

### ✓ Успешный сценарий:

```
Original tokens:
  accessToken: eyJ0eXAiOiJKV1QiLCJ...
  refreshToken: eyJ0eXAiOiJKV1QiLCJ...

Set EXPIRED accessToken
  accessToken: EXPIRED-TOKEN-123456789

Attempting request with expired token...

[Network] GET /api/v1/deals → 401 Unauthorized
[Network] POST /api/v1/auth/refresh → 200 OK
         Response: { accessToken: "new-...", refreshToken: "new-..." }
[Network] GET /api/v1/deals (retry) → 200 OK

✓ SUCCESS! Request completed after automatic refresh
  Response: { deals: [...] }

Tokens after refresh:
  accessToken changed: true
  refreshToken persisted: true
```

### ✗ Проблемный сценарий (требует исправления):

```
[Network] GET /api/v1/deals → 401 Unauthorized
[Network] POST /api/v1/auth/refresh → 200 OK
         Response: { accessToken: "new-...", refreshToken: "" }
[Warning] Received empty refreshToken from server, keeping existing token

✗ FAILED! Request still returns 401
Причина: refreshToken не обновлён на сервере
```

## Checkpoints для проверки

- [ ] Access token обновляется после refresh
- [ ] Refresh token обновляется если backend его вернул
- [ ] Если backend возвращает пустой refreshToken - старый токен сохраняется
- [ ] Логируется warning при пустом refreshToken
- [ ] Оригинальный запрос повторяется с новым accessToken
- [ ] Queued запросы выполняются с новым accessToken

## Отладка

### Если refresh не работает:

1. Проверьте, что `POST /api/v1/auth/refresh` возвращает 200
2. Убедитесь, что ответ содержит `accessToken` и опционально `refreshToken`
3. Проверьте Console на ошибки: `console.warn`, `console.error`
4. Откройте Application → Session Storage и убедитесь, что токены сохраняются

### Если запрос по-прежнему возвращает 401:

1. Новый accessToken может быть заблокирован на сервере
2. Refresh token может быть истёкшим (требует re-login)
3. Проверьте временные метки токенов: `expiresIn` в ответе refresh

## Коды ошибок

| Код | Значение | Решение |
|-----|----------|--------|
| 401 | Unauthorized | Требуется refresh token |
| 403 | Forbidden | Недостаточно прав, требуется re-login |
| 500 | Server Error | Ошибка на бэкенде при refresh |

## Дополнительные команды для тестирования в Console

```javascript
// Проверить текущие токены
console.log('Current tokens:', {
  access: sessionStorage.getItem('accessToken')?.substring(0, 30) + '...',
  refresh: sessionStorage.getItem('refreshToken')?.substring(0, 30) + '...',
});

// Полностью очистить авторизацию
sessionStorage.removeItem('accessToken');
sessionStorage.removeItem('refreshToken');

// Выполнить refresh вручную
import { refreshAccessToken } from './services/authApi';
const oldRefresh = sessionStorage.getItem('refreshToken');
if (oldRefresh) {
  refreshAccessToken(oldRefresh)
    .then(data => console.log('Refresh successful:', data))
    .catch(err => console.error('Refresh failed:', err));
}
```
