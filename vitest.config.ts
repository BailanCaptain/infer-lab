import { defineConfig } from "vitest/config";
import { wikiReaderPlugin } from "./scripts/wiki/reader-plugin";

export default defineConfig({
  plugins: [wikiReaderPlugin()],
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  test: {
    environment: "node",
    // Windows forks can fail at spawn (EPERM) before a test runs. Keep isolated workers,
    // but avoid a fresh OS process for each file; CLI tests still spawn the actual CLI.
    pool: process.platform === "win32" ? "threads" : "forks",
    // Serialize filesystem/CLI fixtures on Windows; in-test concurrency checks stay intact.
    maxWorkers: process.platform === "win32" ? 1 : 4,
    projects: [
      { extends: true, test: { name: "unit", include: ["src/**/*.test.ts", "src/**/*.test.tsx"] } },
      {
        extends: true,
        test: {
          name: "wiki-integration",
          include: ["scripts/**/*.test.ts", "server/**/*.test.ts"],
          // Real CLI children have a 20s deadline; allow setup, fsync and cleanup around it.
          // Functional assertions and individual test deadlines remain unchanged.
          testTimeout: 30_000,
        },
      },
    ],
    passWithNoTests: true,
  },
});
