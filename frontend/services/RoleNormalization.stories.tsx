/**
 * Storybook stories для демонстрации нормализации ролей
 *
 * Визуально показывает как различные форматы ролей преобразуются
 * в нормализованный формат
 */

import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { normalizeRoles, normalizeUser } from './authApi';

/**
 * Компонент для визуализации нормализации ролей
 */
const RoleNormalizationDemo: React.FC<{
  input: any;
  description: string;
}> = ({ input, description }) => {
  const output = normalizeRoles(input);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
      <h4 className="text-sm font-semibold text-gray-800 mb-2">{description}</h4>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2">Входные данные:</p>
          <div className="bg-gray-50 p-3 rounded text-xs font-mono overflow-auto max-h-32">
            {typeof input === 'string' ? (
              <span className="text-blue-600">"{input}"</span>
            ) : (
              <pre>{JSON.stringify(input, null, 2)}</pre>
            )}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2">Нормализованный результат:</p>
          <div className="bg-green-50 p-3 rounded text-xs font-mono">
            <pre>
              {output.length === 0 ? (
                <span className="text-gray-500">[] (пустой массив)</span>
              ) : (
                JSON.stringify(output, null, 2)
              )}
            </pre>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {output.map((role, idx) => (
          <span key={idx} className="inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-medium">
            {role}
          </span>
        ))}
      </div>
    </div>
  );
};

/**
 * Компонент для визуализации нормализации пользователя
 */
const UserNormalizationDemo: React.FC<{
  rawUser: any;
  description: string;
}> = ({ rawUser, description }) => {
  const normalizedUser = normalizeUser(rawUser);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
      <h4 className="text-sm font-semibold text-gray-800 mb-2">{description}</h4>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2">Сырые данные от backend:</p>
          <div className="bg-gray-50 p-3 rounded text-xs font-mono overflow-auto max-h-48">
            <pre>{JSON.stringify(rawUser, null, 2)}</pre>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2">Нормализованный объект User:</p>
          <div className="bg-green-50 p-3 rounded text-xs font-mono overflow-auto max-h-48">
            <pre>{JSON.stringify(normalizedUser, null, 2)}</pre>
          </div>
        </div>
      </div>

      <div className="mt-3 p-3 bg-blue-50 rounded text-xs">
        <p className="text-blue-800">
          <strong>Роли:</strong>{' '}
          {normalizedUser.roles.length === 0 ? (
            <span className="text-gray-600">(нет ролей)</span>
          ) : (
            normalizedUser.roles.map((role) => (
              <span key={role} className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded mr-2">
                {role}
              </span>
            ))
          )}
        </p>
      </div>
    </div>
  );
};

const meta = {
  title: 'Utilities/Role Normalization',
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Демонстрация нормализации различных форматов ролей
 */
export const RoleFormats: Story = {
  render: () => (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-bold text-blue-900 mb-2">Нормализация различных форматов ролей</h3>
        <p className="text-sm text-blue-800">
          Функция normalizeRoles() преобразует роли из различных форматов в единый нормализованный массив строк.
        </p>
      </div>

      <RoleNormalizationDemo
        description="1. Массив строк (стандартный формат)"
        input={['ROLE_ADMIN', 'ROLE_USER']}
      />

      <RoleNormalizationDemo
        description="2. Массив объектов с полем 'name' (Spring Security)"
        input={[{ id: 1, name: 'ROLE_ADMIN' }, { id: 2, name: 'ROLE_USER' }]}
      />

      <RoleNormalizationDemo
        description="3. Массив объектов с полем 'role'"
        input={[
          { id: 1, role: 'ROLE_MANAGER' },
          { id: 2, role: 'ROLE_EDITOR' },
        ]}
      />

      <RoleNormalizationDemo
        description="4. Массив объектов с полем 'authority' (Keycloak)"
        input={[{ id: 1, authority: 'ROLE_ADMIN' }, { id: 2, authority: 'ROLE_VIEWER' }]}
      />

      <RoleNormalizationDemo
        description="5. Строка со строками, разделёнными запятыми"
        input={'ROLE_ADMIN,ROLE_USER,ROLE_MANAGER'}
      />

      <RoleNormalizationDemo
        description="6. Строка со пробелами вокруг запятых"
        input={'ROLE_ADMIN , ROLE_USER , ROLE_EDITOR'}
      />

      <RoleNormalizationDemo
        description="7. Смешанные форматы в массиве"
        input={['ROLE_ADMIN', { name: 'ROLE_USER' }, 'ROLE_MANAGER']}
      />

      <RoleNormalizationDemo description="8. Пустой массив" input={[]} />

      <RoleNormalizationDemo description="9. undefined/null" input={null} />

      <RoleNormalizationDemo description="10. Пустая строка" input={''} />
    </div>
  ),
};

/**
 * Демонстрация нормализации полных объектов пользователя
 */
export const UserNormalization: Story = {
  render: () => (
    <div className="space-y-6">
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-bold text-purple-900 mb-2">Нормализация полных объектов пользователя</h3>
        <p className="text-sm text-purple-800">
          Функция normalizeUser() нормализует данные пользователя, включая преобразование ролей в единый формат.
          Гарантирует, что roles всегда это массив строк.
        </p>
      </div>

      <UserNormalizationDemo
        description="1. Полный объект пользователя со строками ролей"
        rawUser={{
          id: 'user-123',
          email: 'admin@company.com',
          firstName: 'John',
          lastName: 'Admin',
          roles: ['ROLE_ADMIN', 'ROLE_USER'],
        }}
      />

      <UserNormalizationDemo
        description="2. Пользователь с объектами ролей (Spring Security format)"
        rawUser={{
          id: 'user-456',
          email: 'manager@company.com',
          firstName: 'Jane',
          lastName: 'Manager',
          roles: [
            { id: '1', name: 'ROLE_MANAGER' },
            { id: '2', name: 'ROLE_USER' },
          ],
        }}
      />

      <UserNormalizationDemo
        description="3. Пользователь без ролей (undefined)"
        rawUser={{
          id: 'user-789',
          email: 'user@company.com',
          firstName: 'Bob',
        }}
      />

      <UserNormalizationDemo
        description="4. Пользователь с пустым массивом ролей"
        rawUser={{
          id: 'user-000',
          email: 'guest@company.com',
          firstName: 'Guest',
          roles: [],
        }}
      />

      <UserNormalizationDemo
        description="5. Пользователь со строкой ролей (разделённые запятой)"
        rawUser={{
          id: 'user-111',
          email: 'specialist@company.com',
          firstName: 'Alice',
          lastName: 'Specialist',
          roles: 'ROLE_ANALYST,ROLE_AUDITOR,ROLE_REPORTER',
        }}
      />

      <UserNormalizationDemo
        description="6. Пользователь только с email и id (минимальные данные)"
        rawUser={{
          id: 'user-222',
          email: 'minimal@company.com',
        }}
      />

      <UserNormalizationDemo
        description="7. Ответ от /auth/me с кастомными ролями"
        rawUser={{
          id: 'current-user',
          email: 'current@company.com',
          firstName: 'Current',
          lastName: 'User',
          roles: ['admin', 'developer', 'reviewer'],
        }}
      />
    </div>
  ),
};

/**
 * Реальные примеры из различных систем аутентификации
 */
export const RealWorldExamples: Story = {
  render: () => (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-bold text-amber-900 mb-2">Реальные примеры из различных систем</h3>
        <p className="text-sm text-amber-800">
          Демонстрирует как различные системы аутентификации форматируют роли
          и как normalizeRoles() их обрабатывает.
        </p>
      </div>

      <UserNormalizationDemo
        description="Spring Security (Java)"
        rawUser={{
          id: 'spring-user-1',
          email: 'spring@example.com',
          firstName: 'Spring',
          lastName: 'User',
          roles: [
            { authority: 'ROLE_ADMIN', id: 'auth-1' },
            { authority: 'ROLE_USER', id: 'auth-2' },
          ],
        }}
      />

      <UserNormalizationDemo
        description="Keycloak (OIDC)"
        rawUser={{
          id: '12345678-1234-5678-1234-567812345678',
          email: 'keycloak@example.com',
          firstName: 'Keycloak',
          lastName: 'User',
          roles: [
            { id: 'role-uuid-1', name: 'admin' },
            { id: 'role-uuid-2', name: 'user' },
          ],
        }}
      />

      <UserNormalizationDemo
        description="Auth0"
        rawUser={{
          id: 'auth0|1234567890',
          email: 'auth0@example.com',
          firstName: 'Auth0',
          lastName: 'User',
          roles: ['admin', 'user', 'editor'],
        }}
      />

      <UserNormalizationDemo
        description="Custom Legacy System"
        rawUser={{
          id: 'legacy-001',
          email: 'legacy@example.com',
          firstName: 'Legacy',
          lastName: 'User',
          roles: 'ADMIN,USER,MANAGER',
        }}
      />
    </div>
  ),
};

/**
 * Тестирование edge cases
 */
export const EdgeCases: Story = {
  render: () => (
    <div className="space-y-6">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-bold text-red-900 mb-2">Edge Cases и граничные случаи</h3>
        <p className="text-sm text-red-800">
          Как normalizeRoles() обрабатывает необычные и ошибочные входные данные.
        </p>
      </div>

      <RoleNormalizationDemo
        description="Роли с пробелами"
        input={['  ROLE_ADMIN  ', '  ROLE_USER  ']}
      />

      <RoleNormalizationDemo
        description="Массив с пустыми строками и null"
        input={['ROLE_ADMIN', '', null, 'ROLE_USER', undefined]}
      />

      <RoleNormalizationDemo
        description="Объект вместо массива"
        input={{ 0: 'ROLE_ADMIN', 1: 'ROLE_USER' }}
      />

      <RoleNormalizationDemo
        description="Числовые значения в массиве"
        input={['ROLE_ADMIN', 123, 'ROLE_USER']}
      />

      <RoleNormalizationDemo
        description="Очень длинная строка ролей"
        input={'ROLE_ADMIN,ROLE_USER,ROLE_MANAGER,ROLE_EDITOR,ROLE_VIEWER,ROLE_ANALYST,ROLE_AUDITOR'}
      />

      <RoleNormalizationDemo
        description="Специальные символы в именах ролей"
        input={['ROLE_SUPER_ADMIN', 'ROLE_DATA_ANALYST', 'ROLE_QA_ENGINEER']}
      />

      <RoleNormalizationDemo
        description="Дублирующиеся роли (не фильтруются)"
        input={['ROLE_USER', 'ROLE_USER', 'ROLE_ADMIN', 'ROLE_USER']}
      />
    </div>
  ),
};
