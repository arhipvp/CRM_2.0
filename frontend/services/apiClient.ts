import axios, { AxiosInstance, AxiosError, AxiosResponse } from 'axios';

/**
 * HTTP клиент для работы с Backend API
 * Включает автоматическую обработку JWT токенов, refresh logic и обработку ошибок
 */

interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
  tokenStorageKey?: string;
  refreshTokenKey?: string;
}

interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

class ApiClient {
  private instance: AxiosInstance;
  private tokenStorageKey: string;
  private refreshTokenKey: string;
  private isRefreshing = false;
  private failedQueue: Array<{
    resolve: (value: string) => void;
    reject: (reason?: any) => void;
  }> = [];

  constructor(config: ApiClientConfig) {
    this.tokenStorageKey = config.tokenStorageKey || 'accessToken';
    this.refreshTokenKey = config.refreshTokenKey || 'refreshToken';

    this.instance = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
    });

    // Request interceptor - добавляем JWT токен
    this.instance.interceptors.request.use(
      (config) => {
        const token = this.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor - обработка 401 и refresh token
    this.instance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as any;

        // Если статус 401 и это не уже retry запрос
        if (error.response?.status === 401 && !originalRequest._retry) {
          if (this.isRefreshing) {
            // Добавляем запрос в очередь, ждём refresh
            return new Promise((resolve, reject) => {
              this.failedQueue.push({ resolve, reject });
            }).then((token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return this.instance(originalRequest);
            });
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            const refreshToken = this.getRefreshToken();
            if (!refreshToken) {
              this.clearTokens();
              window.location.href = '/login';
              return Promise.reject(error);
            }

            // Попытка refresh token
            const response = await axios.post<TokenResponse>(
              `${this.instance.defaults.baseURL}/auth/refresh`,
              { refreshToken }
            );

            const { accessToken } = response.data;
            this.setAccessToken(accessToken);

            // Обновляем header оригинального запроса
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;

            // Повторяем все queued запросы
            this.failedQueue.forEach(({ resolve }) => resolve(accessToken));
            this.failedQueue = [];

            return this.instance(originalRequest);
          } catch (refreshError) {
            // Refresh не прошёл - логин требуется
            this.clearTokens();
            window.location.href = '/login';
            this.failedQueue = [];
            return Promise.reject(refreshError);
          } finally {
            this.isRefreshing = false;
          }
        }

        // Обработка других статусов ошибок
        if (error.response?.status === 403) {
          console.error('Access Forbidden:', error.response?.data);
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Получить access token из хранилища
   */
  getAccessToken(): string | null {
    const storage = this.getStorage();
    return storage.getItem(this.tokenStorageKey);
  }

  /**
   * Получить refresh token из хранилища
   */
  getRefreshToken(): string | null {
    const storage = this.getStorage();
    return storage.getItem(this.refreshTokenKey);
  }

  /**
   * Установить access token
   */
  setAccessToken(token: string): void {
    const storage = this.getStorage();
    storage.setItem(this.tokenStorageKey, token);
  }

  /**
   * Установить refresh token
   */
  setRefreshToken(token: string): void {
    const storage = this.getStorage();
    storage.setItem(this.refreshTokenKey, token);
  }

  /**
   * Установить оба токена сразу
   */
  setTokens(accessToken: string, refreshToken?: string): void {
    this.setAccessToken(accessToken);
    if (refreshToken) {
      this.setRefreshToken(refreshToken);
    }
  }

  /**
   * Очистить токены
   */
  clearTokens(): void {
    const storage = this.getStorage();
    storage.removeItem(this.tokenStorageKey);
    storage.removeItem(this.refreshTokenKey);
  }

  /**
   * Проверить наличие токена
   */
  hasToken(): boolean {
    return !!this.getAccessToken();
  }

  /**
   * Получить правильное хранилище (sessionStorage или localStorage)
   * Зависит от VITE_TOKEN_STORAGE переменной окружения
   */
  private getStorage(): Storage {
    const storageType = import.meta.env.VITE_TOKEN_STORAGE || 'sessionStorage';
    return storageType === 'localStorage' ? localStorage : sessionStorage;
  }

  /**
   * Выполнить GET запрос
   */
  async get<T = any>(url: string, config?: any): Promise<AxiosResponse<T>> {
    return this.instance.get<T>(url, config);
  }

  /**
   * Выполнить POST запрос
   */
  async post<T = any>(url: string, data?: any, config?: any): Promise<AxiosResponse<T>> {
    return this.instance.post<T>(url, data, config);
  }

  /**
   * Выполнить PUT запрос
   */
  async put<T = any>(url: string, data?: any, config?: any): Promise<AxiosResponse<T>> {
    return this.instance.put<T>(url, data, config);
  }

  /**
   * Выполнить PATCH запрос
   */
  async patch<T = any>(url: string, data?: any, config?: any): Promise<AxiosResponse<T>> {
    return this.instance.patch<T>(url, data, config);
  }

  /**
   * Выполнить DELETE запрос
   */
  async delete<T = any>(url: string, config?: any): Promise<AxiosResponse<T>> {
    return this.instance.delete<T>(url, config);
  }

  /**
   * Получить экземпляр axios для прямого использования
   */
  getAxiosInstance(): AxiosInstance {
    return this.instance;
  }
}

// Создаём глобальный экземпляр API клиента
const apiClient = new ApiClient({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1',
  timeout: Number(import.meta.env.VITE_API_TIMEOUT) || 30000,
  tokenStorageKey: 'accessToken',
  refreshTokenKey: 'refreshToken',
});

export { ApiClient, apiClient };
export type { ApiClientConfig, TokenResponse };
