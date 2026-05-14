import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  fullyParallel: false,
  retries: 1,
  use: {
    baseURL: process.env.FRONTEND_URL || "http://frontend:3000",
    extraHTTPHeaders: {
      "Content-Type": "application/json",
    },
  },
  projects: [
    {
      name: "e2e",
      testMatch: "**/*.e2e.spec.ts",
    },
    {
      name: "integration",
      testMatch: "**/*.integration.spec.ts",
    },
  ],
});
