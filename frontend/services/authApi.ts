import { apiClient, TokenResponse } from './apiClient';

/**
 * API методы для аутентификации через Auth сервис
 */

interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse extends TokenResponse {
  user?: {
    id: string;
    email: string;
    roles?: string[];
  };
}

interface RefreshTokenRequest {
  refreshToken: string;
}

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles?: string[];
}

/**
 * Выполнить вход с email и password
 */
export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  try {
    const response = await apiClient.post<LoginResponse>('/auth/token', credentials);
    const { accessToken, refreshToken } = response.data;

    // Сохраняем токены
    apiClient.setAccessToken(accessToken);
    if (refreshToken) {
      apiClient.setRefreshToken(refreshToken);
    }

    return response.data;
  } catch (error: any) {
    console.error('Login failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Обновить access token используя refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<LoginResponse> {
  try {
    const response = await apiClient.post<LoginResponse>('/auth/refresh', {
      refreshToken,
    });
    const { accessToken, refreshToken: newRefreshToken } = response.data;

    apiClient.setAccessToken(accessToken);

    // Обновляем refresh token если backend его прислал
    if (newRefreshToken && newRefreshToken.trim()) {
      apiClient.setRefreshToken(newRefreshToken);
      console.log('refreshAccessToken: both tokens updated successfully');
    } else if (newRefreshToken === '') {
      // Backend прислал пустой refreshToken - не перезаписываем
      console.warn('Received empty refreshToken from server, keeping existing token');
    } else {
      console.log('refreshAccessToken: accessToken updated, refreshToken not provided by server');
    }

    return response.data;
  } catch (error: any) {
    console.error('Token refresh failed:', error.response?.data || error.message);
    apiClient.clearTokens();
    throw error;
  }
}

/**
 * Выйти (очистить токены)
 * Опционально: отправить запрос на backend для инвалидации refresh token
 */
export async function logout(): Promise<void> {
  try {
    // Опционально отправляем logout запрос на backend
    const refreshToken = apiClient.getRefreshToken();
    if (refreshToken) {
      await apiClient.post('/auth/logout', { refreshToken }).catch(() => {
        // Игнорируем ошибки при logout
      });
    }
  } finally {
    // В любом случае очищаем локальные токены
    apiClient.clearTokens();
  }
}

/**
 * Получить информацию текущего пользователя
 */
export async function getCurrentUser(): Promise<User> {
  try {
    const response = await apiClient.get<User>('/auth/me');
    return response.data;
  } catch (error: any) {
    console.error('Failed to get current user:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Проверить наличие валидного токена
 */
export function isAuthenticated(): boolean {
  return apiClient.hasToken();
}

/**
 * Получить текущий access token (для отладки)
 */
export function getAccessToken(): string | null {
  return apiClient.getAccessToken();
}

/**
 * Получить текущий refresh token (для отладки)
 */
export function getRefreshToken(): string | null {
  return apiClient.getRefreshToken();
}

export type { LoginRequest, LoginResponse, RefreshTokenRequest, User };
