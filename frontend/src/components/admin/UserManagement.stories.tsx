import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { UserManagement } from "./UserManagement";
import { adminRolesMock, adminUsersMock } from "@/mocks/data";
import { adminRolesQueryOptions, adminUsersQueryOptions } from "@/lib/api/admin/queries";
import { useAdminFiltersStore } from "@/stores/adminFiltersStore";
import { useAdminAccessStore } from "@/stores/adminAccessStore";

const meta: Meta<typeof UserManagement> = {
  title: "Admin/UserManagement",
  component: UserManagement,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: "Управление пользователями: docs/frontend/user-scenarios.md",
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof UserManagement>;

function resetStores() {
  useAdminFiltersStore.setState((state) => ({
    ...state,
    userFilters: { search: "", roleIds: [], statuses: [] },
  }));
  useAdminAccessStore.getState().setPermissions(["manage:users", "manage:dictionaries", "view:audit", "export:audit"]);
}

function UserManagementStoryState({ scenario }: { scenario: "default" | "empty" | "loading" | "error" }) {
  const client = useQueryClient();

  useEffect(() => {
    const usersKey = adminUsersQueryOptions().queryKey;
    const usersFn = adminUsersQueryOptions().queryFn;
    const rolesKey = adminRolesQueryOptions().queryKey;
    const rolesFn = adminRolesQueryOptions().queryFn;

    resetStores();

    client.removeQueries({ queryKey: usersKey });
    client.removeQueries({ queryKey: rolesKey });
    client.setQueryDefaults(usersKey, { queryFn: usersFn });
    client.setQueryDefaults(rolesKey, { queryFn: rolesFn });

    switch (scenario) {
      case "default": {
        client.setQueryData(usersKey, adminUsersMock);
        client.setQueryData(rolesKey, adminRolesMock);
        break;
      }
      case "empty": {
        client.setQueryData(usersKey, []);
        client.setQueryData(rolesKey, adminRolesMock);
        break;
      }
      case "loading": {
        client.setQueryDefaults(usersKey, { queryFn: () => new Promise<never>(() => {}) });
        client.invalidateQueries({ queryKey: usersKey });
        client.setQueryData(rolesKey, adminRolesMock);
        break;
      }
      case "error": {
        client.setQueryDefaults(usersKey, { queryFn: () => Promise.reject(new Error("Не удалось загрузить пользователей")) });
        client.invalidateQueries({ queryKey: usersKey });
        client.setQueryData(rolesKey, adminRolesMock);
        break;
      }
    }

    return () => {
      client.setQueryDefaults(usersKey, { queryFn: usersFn });
      client.setQueryDefaults(rolesKey, { queryFn: rolesFn });
      client.removeQueries({ queryKey: usersKey });
      client.removeQueries({ queryKey: rolesKey });
    };
  }, [client, scenario]);

  return <UserManagement />;
}

export const Default: Story = {
  render: () => <UserManagementStoryState scenario="default" />,
};

export const Empty: Story = {
  render: () => <UserManagementStoryState scenario="empty" />,
};

export const Loading: Story = {
  render: () => <UserManagementStoryState scenario="loading" />,
};

export const ErrorState: Story = {
  render: () => <UserManagementStoryState scenario="error" />,
};
