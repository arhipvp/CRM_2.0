import { test, expect } from "@playwright/test";

import { apiFixtures } from "../fixtures/api-data";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

test.describe("CRM фронтенд", () => {
  test("должен отображать главную страницу и получать данные из API", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Главная" })).toBeVisible();
    await expect(page.getByText("Количество сделок по этапам")).toBeVisible();

    if (apiBaseUrl) {
      await page.waitForResponse((response) =>
        response.url().startsWith(`${apiBaseUrl}/crm/deals/stage-metrics`) && response.ok(),
      );
    }

    const dealsLink = page.getByRole("link", { name: "Воронка сделок" }).first();
    const dealsResponse = apiBaseUrl
      ? page.waitForResponse((response) => response.url().startsWith(`${apiBaseUrl}/crm/deals`) && response.ok())
      : Promise.resolve();
    await Promise.all([dealsResponse, dealsLink.click()]);

    await expect(page.getByRole("heading", { name: "Воронка сделок" })).toBeVisible();
    await expect(page.getByRole("button", { name: new RegExp(apiFixtures.deals[0].name) })).toBeVisible();

    const paymentsResponse = apiBaseUrl
      ? page.waitForResponse((response) => response.url().startsWith(`${apiBaseUrl}/crm/payments`) && response.ok())
      : Promise.resolve();
    await Promise.all([paymentsResponse, page.goto("/payments")]);
    await expect(page.getByRole("heading", { name: "Платежи" })).toBeVisible();
    await expect(page.getByText(`Полис ${apiFixtures.payments[0].policyNumber}`)).toBeVisible();

    const tasksResponse = apiBaseUrl
      ? page.waitForResponse((response) => response.url().startsWith(`${apiBaseUrl}/crm/tasks`) && response.ok())
      : Promise.resolve();
    await Promise.all([tasksResponse, page.goto("/tasks")]);
    await expect(page.getByRole("heading", { name: "Задачи" })).toBeVisible();
    await expect(page.getByText(apiFixtures.tasks[0].title)).toBeVisible();
  });
});
