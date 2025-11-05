import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as authApi from '../services/authApi';

export interface AuthContextType {
  isAuthenticated: boolean;
  user: authApi.User | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider компонент для управления состоянием аутентификации
 * Предоставляет context для всего приложения
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<authApi.User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Проверяем наличие токена при загрузке компонента
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setIsLoading(true);

        // Проверяем есть ли токен в localStorage/sessionStorage
        const hasToken = authApi.isAuthenticated();

        if (hasToken) {
          // Если токен есть, попытаемся получить информацию о пользователе
          try {
            const currentUser = await authApi.getCurrentUser();
            setUser(currentUser);
            setIsAuthenticated(true);
          } catch (err) {
            // Анализируем ошибку
            const errorAnalysis = authApi.analyzeAuthError(err);

            if (errorAnalysis.isAuthenticationInvalid) {
              // 401/403 - аутентификация недействительна, выполняем logout
              console.warn('Authentication invalid:', errorAnalysis.message);
              await authApi.logout();
              setIsAuthenticated(false);
              setUser(null);
              setError(errorAnalysis.userMessage);
            } else {
              // Ошибка сети или сервера - сохраняем токены, показываем уведомление
              console.warn('Failed to verify user due to network/server error:', errorAnalysis.message);
              // Оставляем пользователя в состоянии "loading" до восстановления соединения
              setError(errorAnalysis.userMessage);
              // НЕ очищаем токены, оставляем isAuthenticated в неопределённом состоянии
              // Это позволит пользователю видеть ошибку и попробовать снова
            }
          }
        } else {
          // Нет токена
          setIsAuthenticated(false);
          setUser(null);
        }
      } catch (err: any) {
        console.error('Auth check failed:', err);
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authApi.login({ email, password });

      // Если в ответе есть информация о пользователе, используем её (она уже нормализована)
      if (response.user) {
        setUser(response.user);
        console.log('User logged in with roles:', response.user.roles);
      } else {
        // Если пользователя нет в ответе, получим его отдельно
        try {
          const currentUser = await authApi.getCurrentUser();
          setUser(currentUser);
        } catch (err) {
          console.warn('Could not load user info after login:', err);
        }
      }

      setIsAuthenticated(true);
    } catch (err: any) {
      console.error('Login failed:', err);

      // Обработка различных ошибок
      if (err.response?.status === 401) {
        setError('Неверный email или пароль.');
      } else if (err.response?.status === 400) {
        setError('Пожалуйста, проверьте корректность введённых данных.');
      } else if (err.message === 'Network Error' || !err.response) {
        setError('Ошибка соединения с сервером. Проверьте интернет соединение.');
      } else {
        setError(err.response?.data?.message || 'Ошибка входа. Пожалуйста, попробуйте снова.');
      }

      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      setIsAuthenticated(false);
      setUser(null);
      setError(null);
    }
  };

  const clearError = () => {
    setError(null);
  };

  const value: AuthContextType = {
    isAuthenticated,
    user,
    isLoading,
    error,
    login,
    logout,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook для использования Auth Context
 * Должен использоваться только внутри AuthProvider
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth должен использоваться внутри AuthProvider');
  }

  return context;
};
