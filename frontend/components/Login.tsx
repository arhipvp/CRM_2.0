import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const Login: React.FC = () => {
  const { login, isAuthenticated, error: authError, clearError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname ?? '/deals';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, from, navigate]);

  useEffect(() => {
    if (authError) {
      setError(authError);
    }
  }, [authError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    clearError();

    if (!email.trim() || !password.trim()) {
      setError('Введите email и пароль.');
      return;
    }

    setIsLoading(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err: any) {
      if (!err?.response) {
        setError('Не удалось связаться с сервером. Проверьте подключение.');
      } else if (err.response.status === 401) {
        setError('Неверный email или пароль.');
      } else {
        setError(err.response?.data?.message ?? 'Ошибка входа. Попробуйте ещё раз.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (error) setError('');
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (error) setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden backdrop-blur">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-10 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white bg-opacity-20 rounded-full mb-4">
              <svg className="w-8 h-8 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                <path d="M12 6v6l4 2" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold text-white mb-1">CRM</h1>
            <p className="text-blue-100 text-sm font-medium">Управление страховыми клиентами и полисами</p>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex items-start gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10A8 8 0 11 2 10a8 8 0 0116 0zm-7 3a1 1 0 10-2 0 1 1 0 002 0zm-1-8a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-600 uppercase tracking-wide">
                Email
              </label>
              <div className="mt-2 relative">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  className="block w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="qa.admin@example.com"
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-600 uppercase tracking-wide">
                Пароль
              </label>
              <div className="mt-2 relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  className="block w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="Введите пароль"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-500 hover:text-slate-700"
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
              {isLoading ? 'Вхожу...' : 'Войти'}
            </button>

            <div className="mt-2 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
              <p className="font-semibold text-slate-700 mb-2">Тестовая учётная запись:</p>
              <p className="text-slate-600">
                Email:{' '}
                <code className="bg-white px-2 py-1 rounded text-slate-700 font-mono">
                  qa.admin@example.com
                </code>
              </p>
              <p className="text-slate-600 mt-1">
                Пароль:{' '}
                <code className="bg-white px-2 py-1 rounded text-slate-700 font-mono">
                  QaAdmin!234
                </code>
              </p>
            </div>
          </form>

          <div className="bg-slate-50 px-8 py-4 border-t border-slate-200 text-center text-xs text-slate-500">
            <p>© 2025 CRM Страхового Брокера. Все права защищены.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
