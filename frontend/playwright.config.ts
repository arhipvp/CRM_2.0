import { createServer } from "node:http";

import { defineConfig, devices } from "@playwright/test";

import { apiFixtures } from "./tests/fixtures/api-data";

const apiServer = createServer((req, res) => {
  if (!req.url) {
    res.statusCode = 404;
    res.end();
    return;
  }

  const requestUrl = new URL(req.url, `http://${req.headers.host ?? "127.0.0.1"}`);

  const sendJson = (body: unknown, status = 200) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(body));
  };

    if (req.method === "GET" && requestUrl.pathname === "/crm/deals") {
      const stage = requestUrl.searchParams.get("stage");
      const managers = requestUrl.searchParams.getAll("manager");
      const search = requestUrl.searchParams.get("search");

      let deals = [...apiFixtures.deals];

      if (stage && stage !== "all") {
        deals = deals.filter((deal) => deal.stage === stage);
      }

      if (managers.length > 0) {
        deals = deals.filter((deal) => managers.includes(deal.owner));
      }

      if (search) {
        const normalized = search.trim().toLowerCase();
        if (normalized.length > 0) {
          deals = deals.filter((deal) => `${deal.name} ${deal.clientName}`.toLowerCase().includes(normalized));
        }
      }

      sendJson(deals);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/crm/deals/stage-metrics") {
      const stage = requestUrl.searchParams.get("stage");
      const metrics =
        stage && stage !== "all"
          ? apiFixtures.stageMetrics.filter((metric) => metric.stage === stage)
          : apiFixtures.stageMetrics;
      sendJson(metrics);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/crm/clients") {
      sendJson(apiFixtures.clients);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/crm/tasks") {
      sendJson(apiFixtures.tasks);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/crm/payments") {
      sendJson(apiFixtures.payments);
      return;
    }

  sendJson({ message: "Not found" }, 404);
});

const API_PORT = Number(process.env.E2E_API_PORT ?? (4300 + Math.floor(Math.random() * 1000)));
const apiServerStateKey = Symbol.for("crm.apiServer");
type ApiServerState = { server: ReturnType<typeof createServer>; port: number };
const globalState = globalThis as typeof globalThis & { [apiServerStateKey]?: ApiServerState };

let resolvedApiPort = API_PORT;

if (globalState[apiServerStateKey]) {
  resolvedApiPort = globalState[apiServerStateKey]!.port;
} else {
  apiServer.listen(API_PORT);
  resolvedApiPort = API_PORT;
  globalState[apiServerStateKey] = { server: apiServer, port: resolvedApiPort };

  process.on("exit", () => apiServer.close());
  process.on("SIGINT", () => {
    apiServer.close();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    apiServer.close();
    process.exit(0);
  });
}

const PORT = process.env.FRONTEND_SERVICE_PORT ?? process.env.PORT ?? "3000";
const NEXT_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? `http://127.0.0.1:${resolvedApiPort}`;
process.env.NEXT_PUBLIC_API_BASE_URL = NEXT_API_BASE_URL;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [["list"], ["html", { outputFolder: "./playwright-report" }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    reuseExistingServer: !process.env.CI,
    cwd: __dirname,
    port: Number(PORT),
    stdout: "pipe",
    stderr: "pipe",
    env: {
      NEXT_PUBLIC_API_BASE_URL: NEXT_API_BASE_URL,
      FRONTEND_SERVICE_PORT: PORT,
    },
  },
});
