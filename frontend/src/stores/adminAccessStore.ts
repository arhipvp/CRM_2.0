import { create } from "zustand";
import { apiClient } from "@/lib/api/client";
import type { AdminPermission } from "@/types/admin";

interface AdminAccessState {
  permissions: AdminPermission[];
  setPermissions: (permissions: AdminPermission[]) => void;
  hasPermission: (permission: AdminPermission) => boolean;
}

const defaultPermissions = apiClient.getAdminPermissions();

export const useAdminAccessStore = create<AdminAccessState>((set, get) => ({
  permissions: defaultPermissions,
  setPermissions: (permissions) => {
    apiClient.setAdminPermissions(permissions);
    set({ permissions: permissions.length > 0 ? Array.from(new Set(permissions)) : [] });
  },
  hasPermission: (permission) => get().permissions.includes(permission),
}));

export function useHasAdminPermission(permission: AdminPermission) {
  return useAdminAccessStore((state) => state.hasPermission(permission));
}

export function useAdminPermissions() {
  return useAdminAccessStore((state) => state.permissions);
}
