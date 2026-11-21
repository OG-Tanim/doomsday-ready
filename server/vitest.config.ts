import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // API tests run against a throwaway in-memory database.
    env: { DB_PATH: ":memory:", NODE_ENV: "test" },
  },
});
