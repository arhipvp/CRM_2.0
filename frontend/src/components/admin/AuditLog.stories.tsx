import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryKey, QueryObserverOptions } from "@tanstack/react-query";
import { AuditLog } from "./AuditLog";
import { adminAuditLogMock } from "@/mocks/data";
import { adminAuditLogQueryOptions } from "@/lib/api/admin/queries";
import { useAdminFiltersStore } from "@/stores/adminFiltersStore";
import { useAdminAccessStore } from "@/stores/adminAccessStore";
import type { AdminAuditLogEntry } from "@/types/admin";

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

type AdminAuditLogData = AdminAuditLogEntry[];

function AuditLogStoryState({ scenario }: { scenario: "default" | "empty" | "loading" | "error" }) {
  const client = useQueryClient();

  useEffect(() => {
    const baseQueryOptions = adminAuditLogQueryOptions();
    const queryKey = baseQueryOptions.queryKey as QueryKey;
    const defaultOptions = {
      ...baseQueryOptions,
      queryKey,
    } as unknown as QueryObserverOptions<AdminAuditLogData, Error>;
    resetStores();

    client.removeQueries({ queryKey });
    client.setQueryDefaults(queryKey, defaultOptions);

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
        client.setQueryDefaults(
          queryKey,
          {
            ...defaultOptions,
            queryFn: () => new Promise<never>(() => {}),
          } as QueryObserverOptions<AdminAuditLogData, Error>,
        );
        client.invalidateQueries({ queryKey });
        break;
      }
      case "error": {
        client.setQueryDefaults(
          queryKey,
          {
            ...defaultOptions,
            queryFn: () => Promise.reject(new Error("Ошибка загрузки аудита")),
          } as QueryObserverOptions<AdminAuditLogData, Error>,
        );
        client.invalidateQueries({ queryKey });
        break;
      }
    }

    return () => {
      client.setQueryDefaults(queryKey, defaultOptions);
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
