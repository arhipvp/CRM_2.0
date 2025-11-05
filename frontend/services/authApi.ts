import { apiClient, TokenResponse } from './apiClient';

/**
 * API методы для аутентификации через Auth сервис
 */

interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Сырая структура ответа от backend (может содержать разные форматы ролей)
 */
interface RawUserResponse {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles?: string[] | { [key: string]: any }[] | string;
}

/**
 * Нормализованная структура пользователя с гарантированным массивом ролей
 */
interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles: string[]; // Всегда массив строк, никогда не undefined
}

interface LoginResponse extends TokenResponse {
  user?: User;
}

interface RefreshTokenRequest {
  refreshToken: string;
}

/**
 * Преобразует различные форматы ролей в нормализованный массив строк
 * @param rolesData - Данные о ролях от backend (может быть массив строк, объектов или строка)
 * @returns Нормализованный массив строк с именами ролей
 */
function normalizeRoles(rolesData: any): string[] {
  // Если undefined/null - возвращаем пустой массив
  if (!rolesData) {
    return [];
  }

  // Если это массив
  if (Array.isArray(rolesData)) {
    return rolesData
      .map((role) => {
        // Если элемент - строка, используем её
        if (typeof role === 'string') {
          return role.trim();
        }
        // Если элемент - объект, ищем поле 'name' или 'role' или конвертируем в строку
        if (typeof role === 'object' && role !== null) {
          return role.name || role.role || role.authority || String(role);
        }
        return String(role);
      })
      .filter((role) => role.length > 0); // Фильтруем пустые строки
  }

  // Если это строка, разбиваем по запятой
  if (typeof rolesData === 'string') {
    return rolesData
      .split(',')
      .map((role) => role.trim())
      .filter((role) => role.length > 0);
  }

  // Если это объект (неожиданный формат), пытаемся извлечь значения
  if (typeof rolesData === 'object') {
    return Object.values(rolesData)
      .map((val) => String(val))
      .filter((val) => val.length > 0);
  }

  // Fallback - возвращаем пустой массив
  return [];
}

/**
 * Нормализует данные пользователя из различных источников
 * @param rawUser - Сырые данные пользователя от backend
 * @returns Нормализованный объект User с гарантированными полями
 */
function normalizeUser(rawUser: RawUserResponse): User {
  return {
    id: rawUser.id,
    email: rawUser.email,
    firstName: rawUser.firstName,
    lastName: rawUser.lastName,
    roles: normalizeRoles(rawUser.roles),
  };
}

/**
 * Выполнить вход с email и password
 */
export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  try {
    const response = await apiClient.post<{ accessToken: string; refreshToken?: string; user?: RawUserResponse }>(
      '/auth/token',
      credentials
    );
    const { accessToken, refreshToken, user: rawUser } = response.data;

    // Сохраняем токены
    apiClient.setAccessToken(accessToken);
    if (refreshToken) {
      apiClient.setRefreshToken(refreshToken);
    }

    // Нормализуем данные пользователя если они есть
    const normalizedUser = rawUser ? normalizeUser(rawUser) : undefined;

    return {
      accessToken,
      refreshToken,
      expiresIn: response.data.expiresIn,
      user: normalizedUser,
    };
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
 * Нормализует данные пользователя, включая массив ролей
 */
export async function getCurrentUser(): Promise<User> {
  try {
    const response = await apiClient.get<RawUserResponse>('/auth/me');
    const normalizedUser = normalizeUser(response.data);
    console.log('Current user roles:', normalizedUser.roles);
    return normalizedUser;
  } catch (error: any) {
    console.error('Failed to get current user:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Анализирует ошибку и определяет, нужно ли очищать аутентификацию
 *
 * @param error - Ошибка от axios
 * @returns Объект с информацией об ошибке и типом
 *
 * Возвращаемый объект содержит:
 * - isAuthenticationInvalid: true если нужно выполнить logout (401, 403)
 * - isNetworkError: true если ошибка сети/сервера (отсутствие response)
 * - isServerError: true если 5xx ошибка
 * - status: HTTP статус код
 * - message: Пользовательское сообщение
 * - userMessage: Сообщение для показа пользователю
 */
export interface ErrorAnalysis {
  isAuthenticationInvalid: boolean;
  isNetworkError: boolean;
  isServerError: boolean;
  status: number | null;
  message: string;
  userMessage: string;
}

export function analyzeAuthError(error: any): ErrorAnalysis {
  const status = error?.response?.status;
  const errorData = error?.response?.data;

  // 401 Unauthorized или 403 Forbidden - аутентификация недействительна
  if (status === 401 || status === 403) {
    const message = errorData?.message || 'Authorization failed';
    return {
      isAuthenticationInvalid: true,
      isNetworkError: false,
      isServerError: false,
      status,
      message,
      userMessage:
        status === 401
          ? 'Ваша сессия истекла. Пожалуйста, войдите снова.'
          : 'Ваша учётная запись отключена. Пожалуйста, обратитесь в поддержку.',
    };
  }

  // 5xx ошибки сервера
  if (status && status >= 500) {
    return {
      isAuthenticationInvalid: false,
      isNetworkError: false,
      isServerError: true,
      status,
      message: `Server error: ${status}`,
      userMessage: 'Сервер недоступен. Пожалуйста, попробуйте позже.',
    };
  }

  // Ошибки сети (нет response или Network Error)
  if (!error?.response || error?.message === 'Network Error') {
    return {
      isAuthenticationInvalid: false,
      isNetworkError: true,
      isServerError: false,
      status: null,
      message: error?.message || 'Network error',
      userMessage: 'Ошибка соединения с сервером. Проверьте интернет соединение.',
    };
  }

  // Другие ошибки (4xx, кроме 401/403)
  return {
    isAuthenticationInvalid: false,
    isNetworkError: false,
    isServerError: false,
    status: status || null,
    message: errorData?.message || error?.message || 'Unknown error',
    userMessage: 'Произошла ошибка. Пожалуйста, попробуйте снова.',
  };
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

export type { LoginRequest, LoginResponse, RefreshTokenRequest, User, RawUserResponse, ErrorAnalysis };
export { normalizeRoles, normalizeUser };
