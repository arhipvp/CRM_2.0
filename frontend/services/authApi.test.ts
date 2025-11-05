/**
 * Unit тесты для authApi функций нормализации
 *
 * Проверяет:
 * - Преобразование различных форматов ролей в нормализованный массив строк
 * - Обработка edge cases (пустые, undefined, null значения)
 * - Корректность работы с объектами ролей (RoleResponse)
 * - Нормализация полных объектов пользователей
 */

import { describe, it, expect } from 'vitest';
import { normalizeRoles, normalizeUser } from './authApi';

describe('authApi - Role Normalization', () => {
  describe('normalizeRoles', () => {
    // ===== Тесты для массива строк =====
    it('should handle array of strings', () => {
      const result = normalizeRoles(['ROLE_ADMIN', 'ROLE_USER']);
      expect(result).toEqual(['ROLE_ADMIN', 'ROLE_USER']);
    });

    it('should trim whitespace from role strings in array', () => {
      const result = normalizeRoles(['  ROLE_ADMIN  ', 'ROLE_USER ']);
      expect(result).toEqual(['ROLE_ADMIN', 'ROLE_USER']);
    });

    it('should filter out empty strings from array', () => {
      const result = normalizeRoles(['ROLE_ADMIN', '', '  ', 'ROLE_USER']);
      expect(result).toEqual(['ROLE_ADMIN', 'ROLE_USER']);
    });

    // ===== Тесты для массива объектов =====
    it('should extract name field from array of objects', () => {
      const roles = [
        { id: 1, name: 'ROLE_ADMIN' },
        { id: 2, name: 'ROLE_USER' },
      ];
      const result = normalizeRoles(roles);
      expect(result).toEqual(['ROLE_ADMIN', 'ROLE_USER']);
    });

    it('should extract role field from array of objects if name not present', () => {
      const roles = [
        { id: 1, role: 'ROLE_ADMIN' },
        { id: 2, role: 'ROLE_USER' },
      ];
      const result = normalizeRoles(roles);
      expect(result).toEqual(['ROLE_ADMIN', 'ROLE_USER']);
    });

    it('should extract authority field from array of objects if name and role not present', () => {
      const roles = [
        { id: 1, authority: 'ROLE_ADMIN' },
        { id: 2, authority: 'ROLE_USER' },
      ];
      const result = normalizeRoles(roles);
      expect(result).toEqual(['ROLE_ADMIN', 'ROLE_USER']);
    });

    it('should handle mixed format in array (strings and objects)', () => {
      const roles = [
        'ROLE_ADMIN',
        { name: 'ROLE_USER' },
        'ROLE_MANAGER',
        { role: 'ROLE_EDITOR' },
      ];
      const result = normalizeRoles(roles);
      expect(result).toEqual(['ROLE_ADMIN', 'ROLE_USER', 'ROLE_MANAGER', 'ROLE_EDITOR']);
    });

    it('should fallback to string representation of object if no standard fields', () => {
      const roles = [{ custom_field: 'ROLE_ADMIN' }];
      const result = normalizeRoles(roles);
      expect(result.length).toBe(1);
      expect(result[0]).toMatch(/\[object Object\]/);
    });

    // ===== Тесты для строки =====
    it('should split comma-separated string', () => {
      const result = normalizeRoles('ROLE_ADMIN,ROLE_USER');
      expect(result).toEqual(['ROLE_ADMIN', 'ROLE_USER']);
    });

    it('should trim whitespace when splitting string', () => {
      const result = normalizeRoles('ROLE_ADMIN, ROLE_USER , ROLE_MANAGER');
      expect(result).toEqual(['ROLE_ADMIN', 'ROLE_USER', 'ROLE_MANAGER']);
    });

    it('should handle single role as string', () => {
      const result = normalizeRoles('ROLE_ADMIN');
      expect(result).toEqual(['ROLE_ADMIN']);
    });

    // ===== Тесты для объекта =====
    it('should extract values from plain object', () => {
      const roles = { admin: 'ROLE_ADMIN', user: 'ROLE_USER' };
      const result = normalizeRoles(roles);
      expect(result).toContain('ROLE_ADMIN');
      expect(result).toContain('ROLE_USER');
    });

    // ===== Edge cases =====
    it('should return empty array for undefined', () => {
      expect(normalizeRoles(undefined)).toEqual([]);
    });

    it('should return empty array for null', () => {
      expect(normalizeRoles(null)).toEqual([]);
    });

    it('should return empty array for empty string', () => {
      expect(normalizeRoles('')).toEqual([]);
    });

    it('should return empty array for empty array', () => {
      expect(normalizeRoles([])).toEqual([]);
    });

    it('should return empty array for empty object', () => {
      expect(normalizeRoles({})).toEqual([]);
    });

    it('should handle array with null/undefined elements', () => {
      const result = normalizeRoles(['ROLE_ADMIN', null, undefined, 'ROLE_USER']);
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result).toContain('ROLE_ADMIN');
      expect(result).toContain('ROLE_USER');
    });

    it('should handle false/0/empty values', () => {
      const result = normalizeRoles(['ROLE_ADMIN', false, 0, '', 'ROLE_USER']);
      expect(result).toEqual(['ROLE_ADMIN', 'ROLE_USER']);
    });
  });

  describe('normalizeUser', () => {
    it('should normalize user with string array roles', () => {
      const rawUser = {
        id: '123',
        email: 'admin@example.com',
        firstName: 'John',
        lastName: 'Doe',
        roles: ['ROLE_ADMIN', 'ROLE_USER'],
      };

      const result = normalizeUser(rawUser);

      expect(result.id).toBe('123');
      expect(result.email).toBe('admin@example.com');
      expect(result.firstName).toBe('John');
      expect(result.lastName).toBe('Doe');
      expect(result.roles).toEqual(['ROLE_ADMIN', 'ROLE_USER']);
    });

    it('should normalize user with object roles array', () => {
      const rawUser = {
        id: '456',
        email: 'user@example.com',
        roles: [{ name: 'ROLE_USER' }, { name: 'ROLE_EDITOR' }],
      };

      const result = normalizeUser(rawUser);

      expect(result.roles).toEqual(['ROLE_USER', 'ROLE_EDITOR']);
    });

    it('should normalize user without roles', () => {
      const rawUser = {
        id: '789',
        email: 'guest@example.com',
      };

      const result = normalizeUser(rawUser);

      expect(result.roles).toEqual([]);
    });

    it('should normalize user with string roles (comma-separated)', () => {
      const rawUser = {
        id: '999',
        email: 'manager@example.com',
        roles: 'ROLE_MANAGER,ROLE_USER',
      };

      const result = normalizeUser(rawUser);

      expect(result.roles).toEqual(['ROLE_MANAGER', 'ROLE_USER']);
    });

    it('should preserve optional fields when present', () => {
      const rawUser = {
        id: '111',
        email: 'admin@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        roles: ['ROLE_ADMIN'],
      };

      const result = normalizeUser(rawUser);

      expect(result.firstName).toBe('Jane');
      expect(result.lastName).toBe('Smith');
    });

    it('should omit optional fields when not present', () => {
      const rawUser = {
        id: '222',
        email: 'user@example.com',
      };

      const result = normalizeUser(rawUser);

      expect(result.firstName).toBeUndefined();
      expect(result.lastName).toBeUndefined();
    });

    it('should always have roles as array, never undefined', () => {
      const testCases = [
        { id: '1', email: 'a@test.com' },
        { id: '2', email: 'b@test.com', roles: null },
        { id: '3', email: 'c@test.com', roles: undefined },
        { id: '4', email: 'd@test.com', roles: [] },
      ];

      testCases.forEach((rawUser) => {
        const result = normalizeUser(rawUser as any);
        expect(Array.isArray(result.roles)).toBe(true);
        expect(result.roles).not.toBeUndefined();
      });
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle Spring Security role format', () => {
      // Spring Security обычно возвращает роли как объекты с authority
      const springRoles = [
        { authority: 'ROLE_ADMIN' },
        { authority: 'ROLE_USER' },
      ];

      const result = normalizeRoles(springRoles);
      expect(result).toEqual(['ROLE_ADMIN', 'ROLE_USER']);
    });

    it('should handle Keycloak role format', () => {
      // Keycloak может возвращать роли с name и id
      const keycloakRoles = [
        { id: 'role-123', name: 'admin' },
        { id: 'role-456', name: 'user' },
      ];

      const result = normalizeRoles(keycloakRoles);
      expect(result).toEqual(['admin', 'user']);
    });

    it('should handle Auth0 role format', () => {
      // Auth0 обычно возвращает роли как простой массив строк
      const auth0Roles = ['admin', 'user', 'editor'];
      const result = normalizeRoles(auth0Roles);
      expect(result).toEqual(['admin', 'user', 'editor']);
    });

    it('should handle legacy role string format', () => {
      const legacyRoles = 'ROLE_ADMIN,ROLE_USER,ROLE_MANAGER';
      const result = normalizeRoles(legacyRoles);
      expect(result).toEqual(['ROLE_ADMIN', 'ROLE_USER', 'ROLE_MANAGER']);
    });

    it('should normalize complete login response user', () => {
      // Представляет типичный ответ от /auth/token
      const loginResponseUser = {
        id: 'user-id-123',
        email: 'admin@company.com',
        firstName: 'Admin',
        lastName: 'User',
        roles: [
          { id: 'role-1', name: 'ROLE_ADMIN' },
          { id: 'role-2', name: 'ROLE_USER' },
        ],
      };

      const result = normalizeUser(loginResponseUser as any);

      expect(result.id).toBe('user-id-123');
      expect(result.email).toBe('admin@company.com');
      expect(result.roles).toEqual(['ROLE_ADMIN', 'ROLE_USER']);
      expect(Array.isArray(result.roles)).toBe(true);
    });

    it('should normalize GET /auth/me response', () => {
      // Представляет типичный ответ от /auth/me
      const meResponse = {
        id: 'current-user-id',
        email: 'user@company.com',
        firstName: 'John',
        lastName: 'Doe',
        roles: ['ROLE_USER', 'ROLE_EDITOR'],
      };

      const result = normalizeUser(meResponse as any);

      expect(result.id).toBe('current-user-id');
      expect(result.email).toBe('user@company.com');
      expect(result.roles).toEqual(['ROLE_USER', 'ROLE_EDITOR']);
    });
  });
});
