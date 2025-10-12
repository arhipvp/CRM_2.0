#!/usr/bin/env node
import { spawn } from "node:child_process";

const [, , ...argv] = process.argv;

if (argv.length === 0) {
  console.error("Usage: pnpm run <script> -- <command> [args...]\nExample: pnpm run dev");
  process.exit(1);
}

const [command, ...commandArgs] = argv;
const env = { ...process.env };

env.PORT = process.env.FRONTEND_SERVICE_PORT ?? env.PORT ?? "3000";

const child = spawn(command, commandArgs, {
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
