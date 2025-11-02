import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * Login компонент для аутентификации пользователя
 * Используется на экране входа до того как пользователь получит доступ к приложению
 */
export const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (!email.trim() || !password.trim()) {
        setError('Email и пароль обязательны для заполнения.');
        setIsLoading(false);
        return;
      }

      // Выполняем вход через Auth Context
      await login(email, password);
      // AuthContext автоматически обновит состояние isAuthenticated
    } catch (err: any) {
      console.error('Login error:', err);

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
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    // Очищаем ошибку при редактировании
    if (error) setError('');
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    // Очищаем ошибку при редактировании
    if (error) setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Карточка входа */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden backdrop-blur">
          {/* Заголовок */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-10 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white bg-opacity-20 rounded-full mb-4">
              <svg className="w-8 h-8 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                <path d="M12 6v6l4 2" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold text-white mb-1">CRM</h1>
            <p className="text-blue-100 text-sm font-medium">Управление страховыми полисами</p>
          </div>

          {/* Содержимое */}
          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {/* Ошибка */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex items-start gap-3 animate-shake">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Email поле */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-3">
                Email адрес
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={handleEmailChange}
                disabled={isLoading}
                autoComplete="email"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:cursor-not-allowed transition bg-slate-50 hover:bg-white"
                placeholder="example@example.com"
                autoFocus
              />
            </div>

            {/* Password поле */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-3">
                Пароль
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={handlePasswordChange}
                  disabled={isLoading}
                  autoComplete="current-password"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:cursor-not-allowed transition pr-10 bg-slate-50 hover:bg-white"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 disabled:cursor-not-allowed transition"
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                      <path d="M15.171 13.576l1.414 1.414a1 1 0 00.707-.293 1 1 0 00.293-.707v-.001a5.003 5.003 0 00-7.657-7.657l1.415 1.415a3 3 0 014.242 4.242l1.586 1.586z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Кнопка входа */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold py-3 rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:from-slate-400 disabled:to-slate-500 disabled:cursor-not-allowed transition duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
            >
              {isLoading && (
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {isLoading ? 'Вход...' : 'Войти'}
            </button>

            {/* Информационное сообщение */}
            <div className="mt-2 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
              <p className="font-semibold text-slate-700 mb-2">Тестовые учётные данные:</p>
              <p className="text-slate-600">Email: <code className="bg-white px-2 py-1 rounded text-slate-700 font-mono">test@example.com</code></p>
              <p className="text-slate-600 mt-1">Пароль: <code className="bg-white px-2 py-1 rounded text-slate-700 font-mono">password</code></p>
            </div>
          </form>

          {/* Подвал */}
          <div className="bg-slate-50 px-8 py-4 border-t border-slate-200 text-center text-xs text-slate-500">
            <p>© 2025 CRM Страхового Брокера. Все права защищены.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
