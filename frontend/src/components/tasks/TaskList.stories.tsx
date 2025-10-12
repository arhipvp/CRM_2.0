import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { TaskList } from "./TaskList";
import { tasksMock } from "@/mocks/data";
import { tasksQueryOptions } from "@/lib/api/queries";

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

const Template = () => {
  const client = useQueryClient();
  useEffect(() => {
    client.setQueryData(tasksQueryOptions().queryKey, tasksMock);
  }, [client]);

  return <TaskList />;
};

export const Default: Story = {
  render: () => <Template />,
};
