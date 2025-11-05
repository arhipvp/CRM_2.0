/**
 * Storybook stories для компонента NetworkErrorAlert
 *
 * Демонстрирует различные состояния ошибок:
 * - Ошибки сети (Connection Error)
 * - Ошибки сервера (Server Error)
 * - Ошибки аутентификации (Auth Error)
 */

import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { NetworkErrorAlert } from './NetworkErrorAlert';

const meta = {
  title: 'Components/NetworkErrorAlert',
  component: NetworkErrorAlert,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="p-8 bg-gray-50 min-h-screen">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NetworkErrorAlert>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Компонент-обёртка для управления состоянием в Storybook
 */
const NetworkErrorAlertWithState: React.FC<{
  initialType: 'network' | 'server' | 'auth';
  initialMessage: string;
}> = ({ initialType, initialMessage }) => {
  const [visible, setVisible] = useState(true);

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded border border-gray-200">
        <button
          onClick={() => setVisible(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Показать ошибку
        </button>
      </div>

      <NetworkErrorAlert
        type={initialType}
        message={initialMessage}
        visible={visible}
        onClose={() => setVisible(false)}
        onRetry={() => {
          console.log('Retry clicked');
          setVisible(false);
        }}
      />
    </div>
  );
};

/**
 * Ошибка сети - самая серьёзная, требует действия пользователя
 */
export const NetworkError: Story = {
  render: () => (
    <NetworkErrorAlertWithState
      initialType="network"
      initialMessage="Ошибка соединения с сервером. Проверьте интернет соединение."
    />
  ),
  parameters: {
    docs: {
      description: {
        story: 'Показывает ошибку потери соединения с интернетом. Пользователь может повторить попытку.',
      },
    },
  },
};

/**
 * Ошибка сервера - 5xx ошибки, сервис временно недоступен
 */
export const ServerError: Story = {
  render: () => (
    <NetworkErrorAlertWithState
      initialType="server"
      initialMessage="Сервер недоступен. Пожалуйста, попробуйте позже."
    />
  ),
  parameters: {
    docs: {
      description: {
        story: 'Показывает ошибку серверной части (500, 502, 503 и т.д.). Рекомендуется подождать и повторить.',
      },
    },
  },
};

/**
 * Ошибка аутентификации - сессия истекла или учётная запись отключена
 */
export const AuthenticationError: Story = {
  render: () => (
    <NetworkErrorAlertWithState
      initialType="auth"
      initialMessage="Ваша сессия истекла. Пожалуйста, войдите снова."
    />
  ),
  parameters: {
    docs: {
      description: {
        story: 'Показывает ошибку аутентификации. Пользователю нужно переподтвердить учётные данные.',
      },
    },
  },
};

/**
 * Ошибка аутентификации - учётная запись отключена
 */
export const AccountDisabledError: Story = {
  render: () => (
    <NetworkErrorAlertWithState
      initialType="auth"
      initialMessage="Ваша учётная запись отключена. Пожалуйста, обратитесь в поддержку."
    />
  ),
  parameters: {
    docs: {
      description: {
        story: 'Показывает ошибку отключённой учётной записи. Требуется контактировать с поддержкой.',
      },
    },
  },
};

/**
 * Различные состояния на одной странице для сравнения
 */
export const AllErrorTypes: Story = {
  render: () => {
    const [visibleErrors, setVisibleErrors] = useState<Set<string>>(new Set());

    const toggleError = (id: string) => {
      const newSet = new Set(visibleErrors);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      setVisibleErrors(newSet);
    };

    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded shadow">
          <h2 className="text-xl font-bold mb-4">Примеры всех типов ошибок</h2>
          <div className="space-y-2">
            <button
              onClick={() => toggleError('network')}
              className="block w-full text-left px-4 py-2 bg-yellow-50 border border-yellow-200 rounded hover:bg-yellow-100"
            >
              {visibleErrors.has('network') ? '✓' : '○'} Ошибка сети
            </button>
            <button
              onClick={() => toggleError('server')}
              className="block w-full text-left px-4 py-2 bg-red-50 border border-red-200 rounded hover:bg-red-100"
            >
              {visibleErrors.has('server') ? '✓' : '○'} Ошибка сервера
            </button>
            <button
              onClick={() => toggleError('auth')}
              className="block w-full text-left px-4 py-2 bg-orange-50 border border-orange-200 rounded hover:bg-orange-100"
            >
              {visibleErrors.has('auth') ? '✓' : '○'} Ошибка аутентификации
            </button>
          </div>
        </div>

        {visibleErrors.has('network') && (
          <NetworkErrorAlert
            type="network"
            message="Ошибка соединения с сервером. Проверьте интернет соединение."
            visible={true}
            onClose={() => toggleError('network')}
            onRetry={() => {
              console.log('Network retry');
              toggleError('network');
            }}
          />
        )}

        {visibleErrors.has('server') && (
          <NetworkErrorAlert
            type="server"
            message="Сервер недоступен. Пожалуйста, попробуйте позже."
            visible={true}
            onClose={() => toggleError('server')}
            onRetry={() => {
              console.log('Server retry');
              toggleError('server');
            }}
          />
        )}

        {visibleErrors.has('auth') && (
          <NetworkErrorAlert
            type="auth"
            message="Ваша сессия истекла. Пожалуйста, войдите снова."
            visible={true}
            onClose={() => toggleError('auth')}
          />
        )}
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Показывает все типы ошибок с возможностью переключения между ними.',
      },
    },
  },
};

/**
 * Интерактивный пример с имитацией реальной ситуации
 */
export const RealWorldScenario: Story = {
  render: () => {
    const [authStatus, setAuthStatus] = useState<'checking' | 'success' | 'network-error' | 'server-error' | 'auth-error'>(
      'checking'
    );

    const handleCheck = async () => {
      setAuthStatus('checking');
      // Имитируем проверку аутентификации
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const result = Math.random();
      if (result < 0.33) {
        setAuthStatus('network-error');
      } else if (result < 0.66) {
        setAuthStatus('server-error');
      } else if (result < 0.8) {
        setAuthStatus('auth-error');
      } else {
        setAuthStatus('success');
      }
    };

    return (
      <div className="space-y-4">
        <div className="bg-white p-6 rounded shadow">
          <h2 className="text-xl font-bold mb-4">Реальный сценарий: Проверка аутентификации</h2>
          <p className="text-gray-600 mb-4">
            Клик на кнопку "Проверить" имитирует проверку аутентификации пользователя при загрузке приложения.
            Случайно может выбраться успех или одна из трёх ошибок.
          </p>

          <button
            onClick={handleCheck}
            disabled={authStatus === 'checking'}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400"
          >
            {authStatus === 'checking' ? 'Проверяю...' : 'Проверить аутентификацию'}
          </button>

          {authStatus === 'success' && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
              <p className="text-green-800">✓ Аутентификация успешна! Добро пожаловать.</p>
            </div>
          )}
        </div>

        {authStatus === 'network-error' && (
          <NetworkErrorAlert
            type="network"
            message="Ошибка соединения с сервером. Проверьте интернет соединение."
            visible={true}
            onClose={() => setAuthStatus('checking')}
            onRetry={handleCheck}
          />
        )}

        {authStatus === 'server-error' && (
          <NetworkErrorAlert
            type="server"
            message="Сервер недоступен. Пожалуйста, попробуйте позже."
            visible={true}
            onClose={() => setAuthStatus('checking')}
            onRetry={handleCheck}
          />
        )}

        {authStatus === 'auth-error' && (
          <NetworkErrorAlert
            type="auth"
            message="Ваша сессия истекла. Пожалуйста, войдите снова."
            visible={true}
            onClose={() => setAuthStatus('checking')}
          />
        )}
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Реальный сценарий с имитацией проверки аутентификации при загрузке приложения.',
      },
    },
  },
};
