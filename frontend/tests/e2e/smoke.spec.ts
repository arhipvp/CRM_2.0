import { test, expect } from "@playwright/test";

test.describe("CRM фронтенд", () => {
  test("должен отображать главную страницу и переходы", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "CRM 2.0" })).toBeVisible();

    await page.getByRole("link", { name: "Воронка сделок" }).first().click();
    await expect(page.getByRole("heading", { name: "Воронка сделок" })).toBeVisible();

    await page.goto("/payments");
    await expect(page.getByRole("heading", { name: "Платежи" })).toBeVisible();

    await page.goto("/tasks");
    await expect(page.getByRole("heading", { name: "Задачи" })).toBeVisible();
  });
});
