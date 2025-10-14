import React from "react";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tasksQueryOptions } from "@/lib/api/queries";
import { tasksMock } from "@/mocks/data";
import { TaskList } from "@/components/tasks/TaskList";
import { apiClient } from "@/lib/api/client";
import { createTestQueryClient, renderWithQueryClient } from "@/test-utils";
import type { TaskStatus } from "@/types/crm";

describe("TaskList", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("показывает состояние загрузки", () => {
    const client = createTestQueryClient();
    const pending = new Promise<never>(() => {});
    vi.spyOn(apiClient, "getTasks").mockReturnValue(pending);

    renderWithQueryClient(<TaskList />, client);

    expect(screen.getByRole("status", { name: /загрузка задач/i })).toBeInTheDocument();
  });

  it("отображает пустое состояние при отсутствии задач", async () => {
    const client = createTestQueryClient();
    client.setQueryData(tasksQueryOptions().queryKey, []);

    renderWithQueryClient(<TaskList />, client);

    expect(await screen.findByText(/Задачи не найдены/i)).toBeInTheDocument();
  });

  it("отображает ошибку синхронизации и повторяет запрос", async () => {
    const client = createTestQueryClient();
    const spy = vi.spyOn(apiClient, "getTasks").mockRejectedValue(new Error("network error"));

    renderWithQueryClient(<TaskList />, client);

    expect(await screen.findByText(/Не удалось загрузить задачи/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Повторить загрузку/i }));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
  });

  it("выполняет массовое изменение статуса", async () => {
    const client = createTestQueryClient();
    client.setQueryData(tasksQueryOptions().queryKey, tasksMock);

    const spy = vi
      .spyOn(apiClient, "bulkUpdateTasks")
      .mockImplementation(async (taskIds, payload) =>
        tasksMock
          .filter((task) => taskIds.includes(task.id))
          .map((task) => ({
            ...task,
            ...payload,
            status: (payload.status as TaskStatus | undefined) ?? task.status,
            completed:
              payload.completed ?? (payload.status ? (payload.status as TaskStatus) === "done" : task.completed),
          })),
      );

    renderWithQueryClient(<TaskList />, client);

    await screen.findByText(tasksMock[0].title);

    await userEvent.click(screen.getByLabelText(`Выбрать задачу ${tasksMock[0].title}`));
    await userEvent.click(screen.getByLabelText(`Выбрать задачу ${tasksMock[1].title}`));

    const statusSelect = screen.getByLabelText(/Изменить статус/i);
    await userEvent.selectOptions(statusSelect, "cancelled");
    await userEvent.click(screen.getByRole("button", { name: /применить/i }));

    await waitFor(() => expect(spy).toHaveBeenCalledWith([tasksMock[0].id, tasksMock[1].id], { status: "cancelled" }, undefined));
  });
});
