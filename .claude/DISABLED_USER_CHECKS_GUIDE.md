# Disabled User Checks Implementation Guide

**Коммит:** `TBD` (будет добавлен после commit)

## Обзор

Реализована система проверки статуса активности пользователя в Auth сервисе. Пользователи с `enabled = false` не могут:
1. Получить новые JWT токены (попытка логина)
2. Обновить существующие токены (попытка refresh)

## Проблема

При отключении учётной записи пользователя (например, из-за нарушений или при увольнении) он может продолжать использовать существующие refresh токены для получения новых access токенов. Это представляет угрозу безопасности.

## Решение

Добавлены проверки `user.enabled` в двух критических точках JWT токен-менеджмента.

### 1. TokenService.issueTokens()

**Что изменилось:** Добавлена проверка статуса активности пользователя после поиска по email, но ДО проверки пароля.

```kotlin
suspend fun issueTokens(request: TokenRequest): TokenResponse {
    val user = userService.findByEmail(request.email)
        ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials")

    // ✓ НОВОЕ: Проверка статуса активности
    if (!user.enabled) {
        throw ResponseStatusException(HttpStatus.FORBIDDEN, "User account is disabled")
    }

    if (!userService.validatePassword(user, request.password)) {
        throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials")
    }

    // ... остальной код для выпуска токенов
}
```

**Почему до проверки пароля?**
- Не раскрываем существование отключённой учётной записи через timing attack
- Отключённый пользователь получает 403 (не может логиниться), а не 401 (неверные учётные данные)
- Это помогает различить две разные причины отказа

### 2. TokenService.refreshToken()

**Что изменилось:** Добавлена проверка статуса активности пользователя после загрузки entity из БД, с удалением refresh токена из Redis.

```kotlin
suspend fun refreshToken(refreshToken: String): TokenResponse {
    val key = refreshKey(refreshToken)
    val userId = redisTemplate.opsForValue().get(key).awaitSingleOrNull()
        ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token expired")

    val uuid = runCatching { UUID.fromString(userId) }.getOrElse {
        redisTemplate.delete(key).awaitSingleOrNull()
        throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid refresh token")
    }

    val user = userService.getUserEntity(uuid)

    // ✓ НОВОЕ: Проверка статуса активности с очисткой
    if (!user.enabled) {
        redisTemplate.delete(key).awaitSingleOrNull()
        throw ResponseStatusException(HttpStatus.FORBIDDEN, "User account is disabled")
    }

    // ... остальной код для выпуска новых токенов
}
```

**Почему удаляем refresh token?**
- Предотвращает дальнейшее использование этого токена
- При переактивации учётной записи старые токены не будут работать
- Повышает безопасность при отключении пользователя

## Тестирование

### Интеграционные тесты

Добавлены два новых теста в `AuthApiTest.kt`:

#### 1. `should return 403 Forbidden when disabled user tries to login`

```kotlin
@Test
fun `should return 403 Forbidden when disabled user tries to login`() = runBlocking {
    // 1. Регистрируем пользователя
    val registerRequest = RegisterRequest(email = "disabled@example.com", password = "SecureP@ssw0rd")
    // ... регистрация ...

    // 2. Отключаем его
    val user = userRepository.findByEmail("disabled@example.com")
    userRepository.save(user!!.copy(enabled = false))

    // 3. Пытаемся залогиниться - должен быть 403
    webTestClient.post()
        .uri("/api/auth/token")
        .contentType(MediaType.APPLICATION_JSON)
        .bodyValue(TokenRequest(email = "disabled@example.com", password = "SecureP@ssw0rd"))
        .exchange()
        .expectStatus().isForbidden
        .expectBody()
        .jsonPath("$.message").value { message: String ->
            assertThat(message).contains("User account is disabled")
        }
}
```

**Проверяет:**
- Отключённый пользователь не может получить токены, даже с верным паролем
- Возвращается 403 Forbidden (не 401 Unauthorized)
- Сообщение содержит информацию о причине

#### 2. `should return 403 Forbidden when disabled user tries to refresh token`

```kotlin
@Test
fun `should return 403 Forbidden when disabled user tries to refresh token`() = runBlocking {
    // 1. Регистрируем и логиним пользователя, пока он включен
    // ... регистрация и получение refresh токена ...

    // 2. Отключаем его
    val user = userRepository.findByEmail("disable-refresh@example.com")
    userRepository.save(user!!.copy(enabled = false))

    // 3. Пытаемся обновить токены - должен быть 403
    webTestClient.post()
        .uri("/api/auth/refresh")
        .contentType(MediaType.APPLICATION_JSON)
        .bodyValue(mapOf("refreshToken" to refreshToken))
        .exchange()
        .expectStatus().isForbidden
        .expectBody()
        .jsonPath("$.message").value { message: String ->
            assertThat(message).contains("User account is disabled")
        }
}
```

**Проверяет:**
- Отключённый пользователь не может обновить существующие токены
- Возвращается 403 Forbidden
- Refresh токен удаляется из Redis (не проверяем напрямую, но код это делает)

### Запуск тестов

```bash
cd backend/auth

# Запустить все тесты Auth сервиса
./gradlew test

# Запустить только тесты API
./gradlew test --tests "AuthApiTest"

# Запустить конкретный тест
./gradlew test --tests "AuthApiTest.should return 403 Forbidden when disabled user tries to login"
```

## API Документация

Обновлена документация в `docs/api/auth.md`:

### POST `/api/auth/token`

Добавлена новая ошибка:

| Код | Сообщение | Условия |
| --- | --- | --- |
| 403 | `User account is disabled` | Учётная запись пользователя отключена. |

### POST `/api/auth/refresh`

Добавлена новая ошибка:

| Код | Сообщение | Условия |
| --- | --- | --- |
| 403 | `User account is disabled` | Учётная запись пользователя отключена. Refresh токен удаляется из хранилища. |

## Сценарии использования

### Сценарий 1: Отключение пользователя в реальном времени

```
Администратор отключает пользователя через Admin API:
├─ user.enabled = false в БД
├─ Пользователь с существующим access токеном может ещё использовать API
│  (access токены не проверяют статус на каждый запрос)
├─ При истечении access токена пользователь пытается refresh
│  ├─ TokenService.refreshToken() находит user
│  ├─ Проверка: !user.enabled → выброс исключения
│  ├─ Refresh токен удаляется из Redis
│  └─ Возврат 403 Forbidden
└─ Пользователь полностью отсоединён от системы
```

### Сценарий 2: Попытка логина отключённого пользователя

```
Пользователь (которого затем отключили) пытается залогиниться:
├─ TokenService.issueTokens() ищет пользователя по email
├─ Пользователь найден, но user.enabled = false
├─ Проверка: !user.enabled → выброс исключения
└─ Возврат 403 Forbidden (не раскрываем наличие учётной записи)
```

### Сценарий 3: Переактивация пользователя

```
Администратор переактивирует пользователя:
├─ user.enabled = true в БД
├─ Старые refresh токены всё ещё в Redis (удаление лучше сделать явно)
│  (опционально: добавить endpoint для инвалидации старых токенов)
├─ Пользователь может залогиниться заново с паролем
└─ Получит новую пару access/refresh токенов
```

## Безопасность

### Защиты, реализованные:

1. **Двухуровневая защита:**
   - Запрет на логин (issueTokens)
   - Запрет на использование существующих токенов (refreshToken)

2. **Очистка токенов:**
   - Refresh токены удаляются при обнаружении отключённого пользователя
   - Предотвращает бесконечное использование одного токена

3. **Различие ошибок:**
   - 401 Unauthorized: неверные учётные данные
   - 403 Forbidden: учётная запись отключена
   - Позволяет клиенту различить ситуации

4. **Правильный порядок проверок:**
   - В issueTokens: проверка enabled ДО проверки пароля
   - Избегаем timing attacks

### Что НЕ защищено (по дизайну):

- **Существующие access токены:** Отключённый пользователь может использовать текущий access токен до его истечения
  - Причина: Access токены self-signed JWT, проверка enabled потребовала бы обращения к БД на каждый запрос
  - Решение: Использовать более короткий TTL для access токенов (текущий: 15 минут)
  - Альтернатива: Реализовать token blacklist (планируется)

## Связанные изменения

- Commit `3c3b530` — Role normalization implementation
- Commit `f300540` — Token refresh logic enhancements
- Commit `0761ab5` — Gateway upstream auth URL fix

## Будущие улучшения

- [ ] Endpoint для явной инвалидации старых refresh токенов при отключении
- [ ] Token blacklist для access токенов
- [ ] Audit logging для действий отключения пользователя
- [ ] Notification при отключении пользователя
- [ ] UI для управления активностью пользователя в Admin panel
- [ ] Автоматическое отключение при N неудачных попыток логина
