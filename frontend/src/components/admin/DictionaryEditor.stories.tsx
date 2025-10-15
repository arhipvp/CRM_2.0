import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DictionaryEditor } from "./DictionaryEditor";
import { adminDictionariesMock } from "@/mocks/data";
import { adminDictionariesQueryOptions } from "@/lib/api/admin/queries";
import { useAdminFiltersStore } from "@/stores/adminFiltersStore";
import { useAdminAccessStore } from "@/stores/adminAccessStore";

const meta: Meta<typeof DictionaryEditor> = {
  title: "Admin/DictionaryEditor",
  component: DictionaryEditor,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: "Редактор справочников: docs/frontend/user-scenarios.md",
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof DictionaryEditor>;

function resetStores() {
  useAdminFiltersStore.setState((state) => ({
    ...state,
    dictionaryFilters: { kind: "all", search: "" },
  }));
  useAdminAccessStore.getState().setPermissions(["manage:dictionaries", "manage:users", "view:audit", "export:audit"]);
}

function DictionaryEditorStoryState({ scenario }: { scenario: "default" | "empty" | "loading" | "error" }) {
  const client = useQueryClient();

  useEffect(() => {
    const queryKey = adminDictionariesQueryOptions().queryKey;
    const defaultFn = adminDictionariesQueryOptions().queryFn;
    resetStores();
    client.removeQueries({ queryKey });
    client.setQueryDefaults(queryKey, { queryFn: defaultFn });

    switch (scenario) {
      case "default": {
        client.setQueryData(queryKey, adminDictionariesMock);
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
        client.setQueryDefaults(queryKey, { queryFn: () => Promise.reject(new Error("Ошибка загрузки справочников")) });
        client.invalidateQueries({ queryKey });
        break;
      }
    }

    return () => {
      client.setQueryDefaults(queryKey, { queryFn: defaultFn });
      client.removeQueries({ queryKey });
    };
  }, [client, scenario]);

  return <DictionaryEditor />;
}

export const Default: Story = {
  render: () => <DictionaryEditorStoryState scenario="default" />,
};

export const Empty: Story = {
  render: () => <DictionaryEditorStoryState scenario="empty" />,
};

export const Loading: Story = {
  render: () => <DictionaryEditorStoryState scenario="loading" />,
};

export const ErrorState: Story = {
  render: () => <DictionaryEditorStoryState scenario="error" />,
};
