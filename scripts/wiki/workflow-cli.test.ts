import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { wikiFixture } from "./test-fixture";
import { WorkflowStore } from "./workflow";

const fixtures: ReturnType<typeof wikiFixture>[] = [];
afterEach(() => {
  for (const f of fixtures.splice(0)) f.cleanup();
});

describe("wiki jobs CLI", () => {
  it("lists without creating directories, recovers an exited process and never launches an agent", async () => {
    const f = wikiFixture();
    fixtures.push(f);
    expect(f.cli("wiki-jobs", ["list"]).stdout.trim()).toBe("[]");
    expect(existsSync(join(f.root, "wiki"))).toBe(false);
    // Real child process owns the running attempt and then exits without finishing it.
    const { spawnSync } = await import("node:child_process");
    const child = spawnSync(
      process.execPath,
      [
        "--import",
        import.meta.resolve("tsx"),
        "--input-type=module",
        "-e",
        `import { WorkflowStore } from ${JSON.stringify(new URL("./workflow.ts", import.meta.url).href)}; const store = new WorkflowStore(process.cwd()); const job = await store.enqueue({origin:'seed', sources:[{ref:'r@abcdef0:a.py',hash:'abcdef0'}],targets:['a'],recipeHash:'v1'},{maxAttempts:2,maxCostUsd:2,reserveUsd:1}); await store.claim(job.id);`,
      ],
      { cwd: f.root, encoding: "utf8", timeout: 10000 },
    );
    expect(child.status, child.stderr).toBe(0);
    const recover = f.cli("wiki-jobs", ["recover"]);
    expect(recover.status, recover.stderr).toBe(0);
    expect(JSON.parse(recover.stdout).recovered).toHaveLength(1);
    expect(new WorkflowStore(f.root).list()[0]?.state).toBe("failed");
  });
});
