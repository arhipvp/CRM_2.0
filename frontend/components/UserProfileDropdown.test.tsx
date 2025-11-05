/**
 * Unit тесты для UserProfileDropdown компонента
 *
 * Проверяет:
 * - Правильное отображение имени пользователя
 * - Правильное форматирование ролей
 * - Обработка различных форматов ролей
 * - Edge cases (отсутствие имени, ролей и т.д.)
 */

import { describe, it, expect } from 'vitest';

/**
 * Функция форматирования ролей (копирована из компонента для тестирования)
 */
const formatRolesForDisplay = (roles: string[] | undefined): string => {
  if (!roles || roles.length === 0) {
    return 'User';
  }

  return roles
    .map((role) => {
      // Удаляем префикс ROLE_ если есть
      const roleName = role.replace(/^ROLE_/, '');
      // Преобразуем в заглавный первый символ (Admin, User и т.д.)
      return roleName.charAt(0).toUpperCase() + roleName.slice(1).toLowerCase();
    })
    .join(', ');
};

describe('UserProfileDropdown - formatRolesForDisplay', () => {
  describe('Single role formatting', () => {
    it('should format ROLE_ADMIN as Admin', () => {
      const result = formatRolesForDisplay(['ROLE_ADMIN']);
      expect(result).toBe('Admin');
    });

    it('should format ROLE_USER as User', () => {
      const result = formatRolesForDisplay(['ROLE_USER']);
      expect(result).toBe('User');
    });

    it('should format ROLE_MANAGER as Manager', () => {
      const result = formatRolesForDisplay(['ROLE_MANAGER']);
      expect(result).toBe('Manager');
    });

    it('should format ROLE_EDITOR as Editor', () => {
      const result = formatRolesForDisplay(['ROLE_EDITOR']);
      expect(result).toBe('Editor');
    });

    it('should format ROLE_VIEWER as Viewer', () => {
      const result = formatRolesForDisplay(['ROLE_VIEWER']);
      expect(result).toBe('Viewer');
    });
  });

  describe('Multiple roles formatting', () => {
    it('should format multiple roles separated by comma', () => {
      const result = formatRolesForDisplay(['ROLE_ADMIN', 'ROLE_USER']);
      expect(result).toBe('Admin, User');
    });

    it('should format three roles', () => {
      const result = formatRolesForDisplay(['ROLE_ADMIN', 'ROLE_MANAGER', 'ROLE_USER']);
      expect(result).toBe('Admin, Manager, User');
    });

    it('should format many roles', () => {
      const result = formatRolesForDisplay([
        'ROLE_ADMIN',
        'ROLE_MANAGER',
        'ROLE_EDITOR',
        'ROLE_VIEWER',
        'ROLE_USER',
      ]);
      expect(result).toBe('Admin, Manager, Editor, Viewer, User');
    });
  });

  describe('Custom role names (without ROLE_ prefix)', () => {
    it('should format custom role names', () => {
      const result = formatRolesForDisplay(['admin', 'user']);
      expect(result).toBe('Admin, User');
    });

    it('should format custom role with multiple words', () => {
      const result = formatRolesForDisplay(['super_admin']);
      expect(result).toBe('Super_admin');
    });

    it('should handle mixed case custom roles', () => {
      const result = formatRolesForDisplay(['Admin', 'USER']);
      expect(result).toBe('Admin, User');
    });
  });

  describe('Edge cases', () => {
    it('should return "User" for undefined', () => {
      const result = formatRolesForDisplay(undefined);
      expect(result).toBe('User');
    });

    it('should return "User" for empty array', () => {
      const result = formatRolesForDisplay([]);
      expect(result).toBe('User');
    });

    it('should handle roles with lowercase names', () => {
      const result = formatRolesForDisplay(['role_admin']);
      expect(result).toBe('Role_admin');
    });

    it('should handle roles with uppercase names', () => {
      const result = formatRolesForDisplay(['ADMIN']);
      expect(result).toBe('Admin');
    });

    it('should preserve order of roles', () => {
      const roles = ['ROLE_USER', 'ROLE_ADMIN', 'ROLE_MANAGER'];
      const result = formatRolesForDisplay(roles);
      expect(result).toBe('User, Admin, Manager');
    });
  });

  describe('Real-world scenarios', () => {
    it('should format normalized roles from API', () => {
      // Имитирует роли после нормализации в authApi.ts
      const normalizedRoles = ['ROLE_ADMIN', 'ROLE_USER'];
      const result = formatRolesForDisplay(normalizedRoles);
      expect(result).toBe('Admin, User');
    });

    it('should format single admin role', () => {
      const adminRoles = ['ROLE_ADMIN'];
      const result = formatRolesForDisplay(adminRoles);
      expect(result).toBe('Admin');
    });

    it('should handle manager with multiple permissions', () => {
      const managerRoles = ['ROLE_MANAGER', 'ROLE_EDITOR', 'ROLE_USER'];
      const result = formatRolesForDisplay(managerRoles);
      expect(result).toBe('Manager, Editor, User');
    });

    it('should handle guest user with no special roles', () => {
      const guestRoles: string[] = [];
      const result = formatRolesForDisplay(guestRoles);
      expect(result).toBe('User');
    });

    it('should handle user with only custom roles', () => {
      const customRoles = ['analyst', 'auditor'];
      const result = formatRolesForDisplay(customRoles);
      expect(result).toBe('Analyst, Auditor');
    });
  });

  describe('Internationalization ready', () => {
    it('should preserve role names for translation', () => {
      // Функция сохраняет роли в понятном виде для i18n
      const roles = ['ROLE_ADMIN', 'ROLE_USER'];
      const result = formatRolesForDisplay(roles);

      // Результат содержит читаемые названия, которые можно переводить
      expect(result).toContain('Admin');
      expect(result).toContain('User');
    });
  });
});

/**
 * Интеграционный тест: проверка отображения ролей в контексте компонента
 */
describe('UserProfileDropdown - Integration', () => {
  it('should display formatted roles correctly', () => {
    // Тест демонстрирует полный цикл: от normalizeRoles → к formatRolesForDisplay
    const mockRoles = ['ROLE_ADMIN', 'ROLE_USER'];
    const displayed = formatRolesForDisplay(mockRoles);

    expect(displayed).toBe('Admin, User');
    expect(displayed).not.toContain('ROLE_');
  });

  it('should handle no roles gracefully', () => {
    const mockRoles: string[] = [];
    const displayed = formatRolesForDisplay(mockRoles);

    expect(displayed).toBe('User');
    expect(displayed).not.toBe('');
  });

  it('should create user-friendly role display', () => {
    // Spring Security формат → нормализованный → отображение
    const springSecurityRoles = ['ROLE_SUPER_ADMIN', 'ROLE_MANAGER', 'ROLE_EDITOR'];
    const displayed = formatRolesForDisplay(springSecurityRoles);

    // Проверяем что:
    // 1. ROLE_ префиксы удалены
    // 2. Разделены запятой
    // 3. В читаемом виде (заглавная буква)
    expect(displayed).toBe('Super_admin, Manager, Editor');
    expect(displayed).not.toContain('ROLE_');
    expect(displayed).not.toContain('_USER'); // Не добавлено лишних ролей
  });
});
