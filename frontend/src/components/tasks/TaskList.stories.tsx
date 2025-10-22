import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { TaskList } from "./TaskList";
import { tasksMock } from "@/mocks/data";
import { tasksQueryOptions } from "@/lib/api/queries";
import { useTasksViewStore, type TaskViewMode } from "@/stores/tasksViewStore";
import { apiClient } from "@/lib/api/client";

const meta: Meta<typeof TaskList> = {
  title: "CRM/TaskList",
  component: TaskList,
  parameters: {
    docs: {
      description: {
        component: "Сценарии задач: docs/frontend/tasks.md",
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof TaskList>;

function resetTasksView(viewMode: TaskViewMode) {
  useTasksViewStore.setState({
    viewMode,
    filters: { statuses: [], owners: [], types: [], tags: [] },
  });
}

function TaskListStoryState({
  scenario,
  viewMode = "table",
  initialSelection,
  setup,
  afterRender,
}: {
  scenario: "default" | "empty" | "loading" | "error";
  viewMode?: TaskViewMode;
  initialSelection?: string[];
  setup?: (client: ReturnType<typeof useQueryClient>) => void | (() => void);
  afterRender?: () => void;
}) {
  const client = useQueryClient();

  useEffect(() => {
    const queryKey = tasksQueryOptions().queryKey;
    const defaultQueryFn = tasksQueryOptions().queryFn;

    resetTasksView(viewMode);
    client.removeQueries({ queryKey });
    client.setQueryDefaults(queryKey, { queryFn: defaultQueryFn });

    switch (scenario) {
      case "default": {
        client.setQueryData(queryKey, tasksMock);
        break;
      }
      case "empty": {
        client.setQueryData(queryKey, []);
        break;
      }
      case "loading": {
        client.setQueryDefaults(queryKey, {
          queryFn: () => new Promise<never>(() => {}),
        });
        client.invalidateQueries({ queryKey });
        break;
      }
      case "error": {
        client.setQueryDefaults(queryKey, {
          queryFn: () => Promise.reject(new Error("Ошибка синхронизации")),
        });
        client.invalidateQueries({ queryKey });
        break;
      }
    }

    const cleanup = setup?.(client);

    return () => {
      client.setQueryDefaults(queryKey, { queryFn: defaultQueryFn });
      client.removeQueries({ queryKey });
      cleanup?.();
    };
  }, [client, scenario, viewMode, setup]);

  useEffect(() => {
    if (!afterRender) {
      return;
    }

    const timer = window.setTimeout(() => {
      afterRender();
    }, 400);

    return () => window.clearTimeout(timer);
  }, [afterRender]);

  return <TaskList initialSelectedTaskIds={initialSelection} />;
}

export const Default: Story = {
  render: () => <TaskListStoryState scenario="default" viewMode="table" />,
};

export const KanbanView: Story = {
  render: () => <TaskListStoryState scenario="default" viewMode="kanban" />,
};

export const LoadingState: Story = {
  render: () => <TaskListStoryState scenario="loading" viewMode="table" />,
};

export const EmptyState: Story = {
  render: () => <TaskListStoryState scenario="empty" viewMode="table" />,
};

export const ErrorState: Story = {
  render: () => <TaskListStoryState scenario="error" viewMode="table" />,
};

export const MassActions: Story = {
  render: () => (
    <TaskListStoryState
      scenario="default"
      viewMode="table"
      initialSelection={[tasksMock[0].id, tasksMock[1].id]}
    />
  ),
};

export const DetailsOpen: Story = {
  render: () => (
    <TaskListStoryState scenario="default" viewMode="table" initialSelection={[tasksMock[0].id]} />
  ),
};

export const ChecklistError: Story = {
  render: () => (
    <TaskListStoryState
      scenario="default"
      viewMode="table"
      initialSelection={[tasksMock[0].id]}
      setup={() => {
        const originalUpdate = apiClient.updateTask;
        apiClient.updateTask = async () => Promise.reject(new Error("Ошибка сохранения"));
        return () => {
          apiClient.updateTask = originalUpdate;
        };
      }}
      afterRender={() => {
        const toggle = () => {
          const element = document.getElementById("check-task-1-check-2") as HTMLInputElement | null;
          if (element) {
            element.click();
            return true;
          }
          return false;
        };

        if (!toggle()) {
          window.setTimeout(() => {
            toggle();
          }, 300);
        }
      }}
    />
  ),
};

export const ChecklistUpdated: Story = {
  render: () => (
    <TaskListStoryState
      scenario="default"
      viewMode="table"
      initialSelection={[tasksMock[0].id]}
      setup={() => {
        const originalUpdate = apiClient.updateTask;
        apiClient.updateTask = async (taskId, payload) => {
          const current = tasksMock.find((task) => task.id === taskId);
          if (!current) {
            return originalUpdate(taskId, payload);
          }
          return {
            ...current,
            ...payload,
            checklist: payload.checklist ?? current.checklist,
          };
        };
        return () => {
          apiClient.updateTask = originalUpdate;
        };
      }}
      afterRender={() => {
        const toggle = () => {
          const element = document.getElementById("check-task-1-check-2") as HTMLInputElement | null;
          if (element) {
            element.click();
            return true;
          }
          return false;
        };

        if (!toggle()) {
          window.setTimeout(() => {
            toggle();
          }, 300);
        }
      }}
    />
  ),
};
