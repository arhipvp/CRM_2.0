import React from "react";
import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { tasksQueryOptions } from "@/lib/api/queries";
import { tasksMock } from "@/mocks/data";
import { TaskList } from "@/components/tasks/TaskList";
import { apiClient } from "@/lib/api/client";
import { createTestQueryClient, renderWithQueryClient } from "@/test-utils";

describe("TaskList", () => {
  it("отображает задачи и отправляет изменения статуса", async () => {
    const client = createTestQueryClient();
    client.setQueryData(tasksQueryOptions().queryKey, tasksMock);

    const spy = vi.spyOn(apiClient, "updateTaskStatus").mockImplementation(async (taskId, completed) => ({
      ...tasksMock.find((task) => task.id === taskId)!,
      completed,
    }));

    renderWithQueryClient(<TaskList />, client);

    expect(await screen.findByText(/Назначить встречу/i)).toBeInTheDocument();

    await userEvent.click(await screen.findByText(/Назначить встречу/i));

    expect(spy).toHaveBeenCalledWith(tasksMock[0].id, !tasksMock[0].completed);
    spy.mockRestore();
  });
});
