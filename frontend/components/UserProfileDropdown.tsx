import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const UserProfileDropdown: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setIsOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName ?? ''}`.trim()
    : user?.email ?? 'Пользователь';

  /**
   * Форматирует роли для отображения
   * Преобразует имена ролей в читаемый вид (ROLE_ADMIN → Admin)
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

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center space-x-3 w-full p-2 rounded-lg hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
      >
        <div className="h-10 w-10 flex items-center justify-center rounded-full bg-sky-600 text-white font-semibold">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div className="text-left">
          <p className="font-semibold text-sm text-slate-800">{displayName}</p>
          <p className="text-xs text-slate-500">{formatRolesForDisplay(user?.roles)}</p>
        </div>
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-56 bg-white rounded-md shadow-lg border border-slate-200 z-10">
          <div className="py-1">
            <button
              type="button"
              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
              onClick={() => setIsOpen(false)}
            >
              Профиль
            </button>
            <button
              type="button"
              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
              onClick={() => setIsOpen(false)}
            >
              Настройки
            </button>
            <div className="border-t border-slate-200 my-1"></div>
            <button
              type="button"
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              onClick={handleLogout}
            >
              Выйти
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
