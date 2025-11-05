/**
 * Компонент для отображения ошибок, связанных с недоступностью сервера
 *
 * Используется в App.tsx для показа пользователю сообщений об ошибках сети
 * и сервера, отличая их от ошибок аутентификации.
 *
 * Особенности:
 * - Автоматическое закрытие при восстановлении соединения
 * - Различные стили для разных типов ошибок
 * - Кнопка повторного подключения (retry)
 */

import React, { useEffect, useState } from 'react';

export interface NetworkErrorAlertProps {
  /** Тип ошибки: 'network' для ошибок сети, 'server' для 5xx */
  type: 'network' | 'server' | 'auth';
  /** Сообщение об ошибке для показа пользователю */
  message: string;
  /** Callback для повтора попытки подключения */
  onRetry?: () => void;
  /** Callback для закрытия алерта */
  onClose?: () => void;
  /** Видимость алерта */
  visible: boolean;
}

/**
 * Компонент алерта для ошибок сети/сервера
 *
 * Примеры использования:
 *
 * // Ошибка сети
 * <NetworkErrorAlert
 *   type="network"
 *   message="Ошибка соединения. Проверьте интернет."
 *   visible={true}
 *   onRetry={() => location.reload()}
 * />
 *
 * // Ошибка сервера
 * <NetworkErrorAlert
 *   type="server"
 *   message="Сервер недоступен. Пожалуйста, попробуйте позже."
 *   visible={true}
 * />
 *
 * // Ошибка аутентификации
 * <NetworkErrorAlert
 *   type="auth"
 *   message="Ваша сессия истекла. Пожалуйста, войдите снова."
 *   visible={true}
 *   onClose={() => navigate('/login')}
 * />
 */
export const NetworkErrorAlert: React.FC<NetworkErrorAlertProps> = ({
  type,
  message,
  onRetry,
  onClose,
  visible,
}) => {
  const [isVisible, setIsVisible] = useState(visible);

  useEffect(() => {
    setIsVisible(visible);
  }, [visible]);

  if (!isVisible) {
    return null;
  }

  // Определяем стили и иконку в зависимости от типа ошибки
  const getStyles = () => {
    switch (type) {
      case 'network':
        return {
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          textColor: 'text-yellow-800',
          titleColor: 'text-yellow-900',
          icon: '⚠️',
        };
      case 'server':
        return {
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-800',
          titleColor: 'text-red-900',
          icon: '🔴',
        };
      case 'auth':
        return {
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          textColor: 'text-orange-800',
          titleColor: 'text-orange-900',
          icon: '🔒',
        };
      default:
        return {
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          textColor: 'text-gray-800',
          titleColor: 'text-gray-900',
          icon: 'ℹ️',
        };
    }
  };

  const styles = getStyles();

  const getTitle = () => {
    switch (type) {
      case 'network':
        return 'Ошибка соединения';
      case 'server':
        return 'Сервер недоступен';
      case 'auth':
        return 'Требуется повторная аутентификация';
      default:
        return 'Уведомление';
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    onClose?.();
  };

  return (
    <div
      className={`fixed top-4 right-4 max-w-md ${styles.bgColor} border ${styles.borderColor} rounded-lg shadow-lg p-4 z-50`}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex gap-3">
        {/* Иконка */}
        <div className="flex-shrink-0 text-xl">{styles.icon}</div>

        {/* Содержимое */}
        <div className="flex-1">
          <h3 className={`font-semibold ${styles.titleColor} mb-1`}>{getTitle()}</h3>
          <p className={`text-sm ${styles.textColor} mb-3`}>{message}</p>

          {/* Действия */}
          <div className="flex gap-2">
            {onRetry && type !== 'auth' && (
              <button
                onClick={onRetry}
                className={`text-sm font-medium px-3 py-1 rounded hover:opacity-80 transition ${
                  type === 'network'
                    ? 'bg-yellow-100 text-yellow-900'
                    : 'bg-red-100 text-red-900'
                }`}
              >
                Повторить
              </button>
            )}
            <button
              onClick={handleClose}
              className={`text-sm font-medium px-3 py-1 rounded hover:opacity-80 transition ${
                type === 'network'
                  ? 'bg-yellow-100 text-yellow-900'
                  : type === 'server'
                    ? 'bg-red-100 text-red-900'
                    : 'bg-orange-100 text-orange-900'
              }`}
            >
              Закрыть
            </button>
          </div>
        </div>

        {/* Кнопка закрытия */}
        <button
          onClick={handleClose}
          className={`flex-shrink-0 ${styles.textColor} hover:opacity-70 transition`}
          aria-label="Закрыть уведомление"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default NetworkErrorAlert;
