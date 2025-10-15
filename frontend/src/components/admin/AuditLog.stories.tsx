import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AuditLog } from "./AuditLog";
import { adminAuditLogMock } from "@/mocks/data";
import { adminAuditLogQueryOptions } from "@/lib/api/admin/queries";
import { useAdminFiltersStore } from "@/stores/adminFiltersStore";
import { useAdminAccessStore } from "@/stores/adminAccessStore";

const meta: Meta<typeof AuditLog> = {
  title: "Admin/AuditLog",
  component: AuditLog,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: "Журнал аудита: docs/frontend/user-scenarios.md",
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof AuditLog>;

function resetStores() {
  useAdminFiltersStore.setState((state) => ({
    ...state,
    auditFilters: { search: "", scope: "all", severity: "all", actorIds: [], dateFrom: undefined, dateTo: undefined },
  }));
  useAdminAccessStore.getState().setPermissions(["view:audit", "export:audit", "manage:users", "manage:dictionaries"]);
}

function AuditLogStoryState({ scenario }: { scenario: "default" | "empty" | "loading" | "error" }) {
  const client = useQueryClient();

  useEffect(() => {
    const queryKey = adminAuditLogQueryOptions().queryKey;
    const defaultFn = adminAuditLogQueryOptions().queryFn;
    resetStores();

    client.removeQueries({ queryKey });
    client.setQueryDefaults(queryKey, { queryFn: defaultFn });

    switch (scenario) {
      case "default": {
        client.setQueryData(queryKey, adminAuditLogMock);
        break;
      }
      case "empty": {
        client.setQueryData(queryKey, []);
        break;
      }
      case "loading": {
        client.setQueryDefaults(queryKey, { queryFn: () => new Promise<never>(() => {}) });
        client.invalidateQueries({ queryKey });
        break;
      }
      case "error": {
        client.setQueryDefaults(queryKey, { queryFn: () => Promise.reject(new Error("Ошибка загрузки аудита")) });
        client.invalidateQueries({ queryKey });
        break;
      }
    }

    return () => {
      client.setQueryDefaults(queryKey, { queryFn: defaultFn });
      client.removeQueries({ queryKey });
    };
  }, [client, scenario]);

  return <AuditLog />;
}

export const Default: Story = {
  render: () => <AuditLogStoryState scenario="default" />,
};

export const Empty: Story = {
  render: () => <AuditLogStoryState scenario="empty" />,
};

export const Loading: Story = {
  render: () => <AuditLogStoryState scenario="loading" />,
};

export const ErrorState: Story = {
  render: () => <AuditLogStoryState scenario="error" />,
};
