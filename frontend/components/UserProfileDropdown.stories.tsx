/**
 * Storybook stories для UserProfileDropdown компонента
 *
 * Демонстрирует различные состояния и форматы отображения ролей пользователя
 */

import type { Meta, StoryObj } from '@storybook/react';
import { UserProfileDropdown } from './UserProfileDropdown';
import { AuthProvider } from '../contexts/AuthContext';
import { BrowserRouter } from 'react-router-dom';
import * as authApi from '../services/authApi';
import React, { ReactNode } from 'react';

/**
 * Mock для AuthContext с различными пользователями и ролями
 */
const createAuthWrapper = (user: authApi.User | null) => {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <BrowserRouter>
        <div className="flex justify-center p-8 bg-gray-50 min-h-screen">
          {children}
        </div>
      </BrowserRouter>
    );
  };
};

const meta = {
  title: 'Components/UserProfileDropdown',
  component: UserProfileDropdown,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <BrowserRouter>
        <div className="flex justify-center p-8 bg-gray-50 min-h-screen">
          <Story />
        </div>
      </BrowserRouter>
    ),
  ],
} satisfies Meta<typeof UserProfileDropdown>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Стандартный администратор с одной ролью
 */
export const AdminUser: Story = {
  render: () => {
    const mockUser: authApi.User = {
      id: 'admin-123',
      email: 'admin@company.com',
      firstName: 'John',
      lastName: 'Administrator',
      roles: ['ROLE_ADMIN'],
    };

    return (
      <UserProfileDropdown />
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Пользователь с ролью ROLE_ADMIN. Роль отображается как "Admin".',
      },
    },
  },
};

/**
 * Пользователь с множественными ролями
 */
export const MultiRoleUser: Story = {
  render: () => {
    const mockUser: authApi.User = {
      id: 'manager-456',
      email: 'manager@company.com',
      firstName: 'Jane',
      lastName: 'Manager',
      roles: ['ROLE_MANAGER', 'ROLE_USER', 'ROLE_EDITOR'],
    };

    return (
      <UserProfileDropdown />
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Пользователь с несколькими ролями. Все роли отображаются через запятую, отформатированные в читаемый вид.',
      },
    },
  },
};

/**
 * Обычный пользователь без специальных ролей
 */
export const RegularUser: Story = {
  render: () => {
    const mockUser: authApi.User = {
      id: 'user-789',
      email: 'user@company.com',
      firstName: 'Bob',
      lastName: 'User',
      roles: ['ROLE_USER'],
    };

    return (
      <UserProfileDropdown />
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Обычный пользователь с ролью ROLE_USER, отображается как "User".',
      },
    },
  },
};

/**
 * Пользователь без ролей (пустой массив)
 */
export const NoRoles: Story = {
  render: () => {
    const mockUser: authApi.User = {
      id: 'guest-000',
      email: 'guest@company.com',
      firstName: 'Guest',
      lastName: 'User',
      roles: [],
    };

    return (
      <UserProfileDropdown />
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Пользователь без ролей. Отображается дефолтный текст "User".',
      },
    },
  },
};

/**
 * Пользователь без имени и фамилии (только email)
 */
export const NoName: Story = {
  render: () => {
    const mockUser: authApi.User = {
      id: 'anon-111',
      email: 'anonymous@company.com',
      roles: ['ROLE_USER'],
    };

    return (
      <UserProfileDropdown />
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Пользователь без firstName и lastName. Использует email как отображаемое имя.',
      },
    },
  },
};

/**
 * Кастомные роли (не стандартный ROLE_ формат)
 */
export const CustomRoles: Story = {
  render: () => {
    const mockUser: authApi.User = {
      id: 'custom-222',
      email: 'specialist@company.com',
      firstName: 'Alice',
      lastName: 'Specialist',
      roles: ['analyst', 'reporter', 'auditor'],
    };

    return (
      <UserProfileDropdown />
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Пользователь с кастомными ролями (без префикса ROLE_). Отображаются как есть (с заглавной первой буквой).',
      },
    },
  },
};

/**
 * Инженер с техническими ролями
 */
export const EngineerUser: Story = {
  render: () => {
    const mockUser: authApi.User = {
      id: 'engineer-333',
      email: 'engineer@company.com',
      firstName: 'Charlie',
      lastName: 'Developer',
      roles: ['ROLE_ENGINEER', 'ROLE_DEVELOPER', 'ROLE_REVIEWER'],
    };

    return (
      <UserProfileDropdown />
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Пользователь с техническими ролями. Демонстрирует множество ролей в тесном пространстве.',
      },
    },
  },
};

/**
 * Демонстрация компонента в реальном контексте приложения
 */
export const InApplicationContext: Story = {
  render: () => {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white border border-gray-200 rounded-lg shadow p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Header с профилем пользователя</h3>
          <div className="border-t border-gray-200 pt-4">
            <UserProfileDropdown />
          </div>
        </div>

        {/* Info box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-xs font-semibold text-blue-800 mb-2">Информация о ролях</h4>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>• Роли автоматически нормализуются из различных форматов</li>
            <li>• Форматируются в читаемый вид (ROLE_ADMIN → Admin)</li>
            <li>• Всегда представлены как массив строк</li>
            <li>• Отображаются через запятую в dropdown</li>
          </ul>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Компонент в контексте реального приложения с информацией о нормализации ролей.',
      },
    },
  },
};
