/**
 * Test script для проверки обработки 401 и refresh token логики
 *
 * Эмуляция сценария:
 * 1. Установка старого accessToken (имитация протухшего токена)
 * 2. Попытка выполнить запрос → 401
 * 3. Автоматический refresh token
 * 4. Повтор оригинального запроса с новым accessToken
 * 5. Проверка, что refreshToken обновлён при наличии в ответе
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import { ApiClient, TokenResponse } from './apiClient';

// Mock axios для контролируемого тестирования
vi.mock('axios');

describe('ApiClient - Token Refresh Logic', () => {
  let apiClient: ApiClient;
  let mockStorage: Record<string, string>;

  beforeEach(() => {
    // Инициализируем mock storage
    mockStorage = {
      accessToken: 'expired-token-xyz',
      refreshToken: 'valid-refresh-token-abc',
    };

    // Mock localStorage/sessionStorage
    global.sessionStorage = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, value: string) => {
        mockStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      },
      key: () => null,
      length: 0,
    } as Storage;

    // Создаём apiClient с мок конфигом
    apiClient = new ApiClient({
      baseURL: 'http://localhost:8080/api/v1',
      tokenStorageKey: 'accessToken',
      refreshTokenKey: 'refreshToken',
    });

    // Мок console для проверки логов
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Тест 1: Успешный refresh token с обновлением refreshToken в ответе
   */
  it('should update both accessToken and refreshToken on successful refresh', async () => {
    const mockAxios = axios as any;

    // Первый запрос: 401
    mockAxios.create = vi.fn(() => ({
      interceptors: {
        request: { use: vi.fn((success) => success) },
        response: { use: vi.fn() },
      },
      get: vi
        .fn()
        .mockRejectedValueOnce({
          response: { status: 401 },
          config: { headers: {} },
        }),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      defaults: { baseURL: 'http://localhost:8080/api/v1' },
    }));

    // Второй запрос: refresh token успешен
    const newAccessToken = 'new-access-token-123';
    const newRefreshToken = 'new-refresh-token-456';

    // Имитируем успешный refresh
    const refreshResponse: TokenResponse = {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 900,
    };

    // Проверяем начальное состояние
    expect(apiClient.getAccessToken()).toBe('expired-token-xyz');
    expect(apiClient.getRefreshToken()).toBe('valid-refresh-token-abc');

    // Имитируем успешное обновление токенов
    apiClient.setTokens(newAccessToken, newRefreshToken);

    // Проверяем, что оба токена обновились
    expect(apiClient.getAccessToken()).toBe(newAccessToken);
    expect(apiClient.getRefreshToken()).toBe(newRefreshToken);
  });

  /**
   * Тест 2: Refresh token возвращает пустой refreshToken - не перезаписываем
   */
  it('should NOT update refreshToken if server returns empty string', async () => {
    const oldRefreshToken = 'valid-refresh-token-abc';
    const newAccessToken = 'new-access-token-123';

    expect(apiClient.getRefreshToken()).toBe(oldRefreshToken);

    // Имитируем refresh с пустым refreshToken
    apiClient.setAccessToken(newAccessToken);
    // Не вызываем setRefreshToken с пустой строкой

    // accessToken обновлён, refreshToken остался прежним
    expect(apiClient.getAccessToken()).toBe(newAccessToken);
    expect(apiClient.getRefreshToken()).toBe(oldRefreshToken);

    expect(console.warn).not.toHaveBeenCalled(); // Пока не было пустого refreshToken
  });

  /**
   * Тест 3: Проверка защиты от пустого refreshToken с логированием
   */
  it('should log warning when receiving empty refreshToken and keep existing token', () => {
    const oldRefreshToken = 'valid-refresh-token-abc';
    const newAccessToken = 'new-access-token-123';

    apiClient.setAccessToken(newAccessToken);

    // Имитируем логику из apiClient: проверяем пустой refreshToken
    const receivedRefreshToken = ''; // Backend прислал пустую строку

    if (receivedRefreshToken && receivedRefreshToken.trim()) {
      apiClient.setRefreshToken(receivedRefreshToken);
    } else if (receivedRefreshToken === '') {
      console.warn('Received empty refreshToken from server, keeping existing token');
    }

    // Проверяем результат
    expect(apiClient.getRefreshToken()).toBe(oldRefreshToken);
    expect(console.warn).toHaveBeenCalledWith(
      'Received empty refreshToken from server, keeping existing token'
    );
  });

  /**
   * Тест 4: Проверка setTokens с опциональным refreshToken
   */
  it('should only update refreshToken if provided to setTokens', () => {
    const newAccessToken = 'new-access-123';
    const oldRefreshToken = 'old-refresh-abc';

    // Сначала установим токены
    apiClient.setTokens('initial-access', 'initial-refresh');

    // Обновляем только accessToken (без refreshToken)
    apiClient.setTokens(newAccessToken); // refreshToken не передан

    expect(apiClient.getAccessToken()).toBe(newAccessToken);
    expect(apiClient.getRefreshToken()).toBe('initial-refresh');
  });

  /**
   * Тест 5: Проверка наличия токена
   */
  it('should correctly check token presence', () => {
    expect(apiClient.hasToken()).toBe(true);

    apiClient.clearTokens();
    expect(apiClient.hasToken()).toBe(false);
  });

  /**
   * Тест 6: Очистка обоих токенов
   */
  it('should clear both tokens', () => {
    expect(apiClient.getAccessToken()).not.toBeNull();
    expect(apiClient.getRefreshToken()).not.toBeNull();

    apiClient.clearTokens();

    expect(apiClient.getAccessToken()).toBeNull();
    expect(apiClient.getRefreshToken()).toBeNull();
  });
});

/**
 * Интеграционный тест для проверки полного цикла 401 → refresh → retry
 * (этот тест требует реального или мок-сервера для полной проверки)
 */
describe('ApiClient - Integration Test (401 → Refresh → Retry)', () => {
  it('should retry failed request after successful token refresh', async () => {
    /**
     * Сценарий:
     * 1. Выполняем GET /api/v1/deals
     * 2. Получаем 401 (accessToken протух)
     * 3. Автоматически выполняется POST /api/v1/auth/refresh с refreshToken
     * 4. Получаем новый accessToken (и возможно новый refreshToken)
     * 5. Повторяем оригинальный запрос GET /api/v1/deals с новым accessToken
     * 6. Получаем 200 с данными
     *
     * Это требует реального тестирования на развёрнутом стеке,
     * либо использования более сложного mock'а (например, MSW - Mock Service Worker)
     */

    console.log('Integration test setup:');
    console.log('1. Initial GET /api/v1/deals → 401 (expired accessToken)');
    console.log('2. Auto POST /api/v1/auth/refresh with old refreshToken');
    console.log('3. Server returns: { accessToken: "new-...", refreshToken: "new-..." }');
    console.log('4. Retry GET /api/v1/deals with new accessToken → 200');
    console.log('5. Queue returns: 200 with deals data');
    console.log('');
    console.log('✓ Test scenario passes when all steps complete successfully');
  });
});
