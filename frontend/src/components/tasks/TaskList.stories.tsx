import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { TaskList } from "./TaskList";
import { tasksMock } from "@/mocks/data";
import { tasksQueryOptions } from "@/lib/api/queries";
import { useTasksViewStore, type TaskViewMode } from "@/stores/tasksViewStore";

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
}: {
  scenario: "default" | "empty" | "loading" | "error";
  viewMode?: TaskViewMode;
  initialSelection?: string[];
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

    return () => {
      client.setQueryDefaults(queryKey, { queryFn: defaultQueryFn });
      client.removeQueries({ queryKey });
    };
  }, [client, scenario, viewMode]);

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
