import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { selectIngestFeatures, selectIntegrationDrafts } from "./ingest";
import { wikiFixture } from "./test-fixture";

const fixtures: ReturnType<typeof wikiFixture>[] = [];
afterEach(() => {
  for (const f of fixtures.splice(0)) f.cleanup();
});

describe("ingest selection boundary", () => {
  it("requires explicit per-job budgets before paid work", () => {
    const f = wikiFixture();
    fixtures.push(f);
    f.write(
      "seeds.yaml",
      "repos:\n  r:\n    url: https://example.test/r\n    path: missing\n    refs: {main: abcdef0}\nfeatures:\n  - id: a\n    title: A\n    type: concept\n    chapters: ['11']\n    repo: r\n    entry: [a.py]\n    ask: Explain\n",
    );
    const run = f.cli("wiki-ingest", ["--seeds", "seeds.yaml"]);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("--job-budget-usd");
    expect(existsSync(join(f.root, "wiki"))).toBe(false);
  });
  it("rejects invalid execution options before reading repositories or creating outputs", () => {
    const f = wikiFixture();
    fixtures.push(f);
    f.write(
      "seeds.yaml",
      "repos:\n  r:\n    url: https://example.test/r\n    path: missing-repo\n    refs: {main: 28bf3a2e}\nfeatures: []\n",
    );
    for (const args of [
      ["--concurrency", "NaN"],
      ["--concurrency", "0"],
      ["--timeout-min", "-1"],
    ]) {
      const run = f.cli("wiki-ingest", ["--seeds", "seeds.yaml", ...args]);
      expect(run.status).toBe(1);
      expect(run.stderr).toContain("必须是正整数");
      expect(existsSync(join(f.root, "wiki"))).toBe(false);
    }
  });
  it("refuses an existing checkout at a different commit before invoking the agent", () => {
    const f = wikiFixture();
    fixtures.push(f);
    f.write("repo/a.py", "old\n");
    const old = f.commit("old");
    f.write("repo/a.py", "new\n");
    f.commit("new");
    f.write(
      "seeds.yaml",
      `repos:\n  r:\n    url: https://example.test/r\n    path: repo\n    refs: {main: ${old}}\nfeatures: []\n`,
    );
    const run = f.cli("wiki-ingest", ["--seeds", "seeds.yaml", "--phase", "extract"]);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("钉住");
    expect(existsSync(join(f.root, "wiki/_drafts"))).toBe(false);
  });
  it("CLI dry-run does not create output directories or integrate old drafts", () => {
    const f = wikiFixture();
    fixtures.push(f);
    f.write(
      "seeds.yaml",
      "repos:\n  r:\n    url: https://example.test/r\n    path: repo\n    refs: {main: 28bf3a2e}\nfeatures: []\n",
    );
    f.write(
      "wiki/HANDBOOK.md",
      ["页面格式", "提取", "整合", "查询", "Lint", "人类须知"].map((h) => `## ${h}\nfixture\n`).join("\n"),
    );
    const defaultDry = f.cli("wiki-ingest", ["--seeds", "seeds.yaml", "--dry-run"]);
    expect(defaultDry.status).toBe(0);
    expect(defaultDry.stdout).not.toContain("整合计划");
    const dry = f.cli("wiki-ingest", ["--seeds", "seeds.yaml", "--phase", "all", "--dry-run"]);
    expect(dry.status, dry.stderr).toBe(0);
    expect(dry.stdout).toContain("不读取旧草稿");
    expect(existsSync(join(f.root, "wiki/_drafts"))).toBe(false);
    const standalone = f.cli("wiki-ingest", ["--seeds", "seeds.yaml", "--phase", "integrate", "--dry-run"]);
    expect(standalone.status).toBe(1);
    expect(standalone.stderr).toContain("显式");
  });
  it("skip-existing includes params, and unknown --only ids fail", () => {
    const f = wikiFixture();
    fixtures.push(f);
    f.write("wiki/params/old-param.md", "existing");
    const features = [{ id: "old-param" }, { id: "new-param" }];
    expect(selectIngestFeatures(features, `${f.root}/wiki`, { skipExisting: true })).toEqual([
      { id: "new-param" },
    ]);
    expect(() => selectIngestFeatures(features, `${f.root}/wiki`, { only: ["typo"] })).toThrow(/typo/);
  });
  it("all integrates current successes only; standalone requires explicit selection", () => {
    const state = {
      available: ["good", "failed", "other-batch"],
      failures: { failed: { at: "today", reason: "timeout", stderrTail: "" } },
    };
    expect(selectIntegrationDrafts({ ...state, succeeded: ["good"] })).toEqual(["good"]);
    expect(selectIntegrationDrafts({ ...state, succeeded: [] })).toEqual([]);
    expect(() => selectIntegrationDrafts(state)).toThrow(/显式/);
    expect(() => selectIntegrationDrafts({ ...state, only: ["failed"] })).toThrow(/failed/);
    expect(() => selectIntegrationDrafts({ ...state, only: ["missing"] })).toThrow(/missing/);
    expect(selectIntegrationDrafts({ ...state, only: ["good"] })).toEqual(["good"]);
  });
});
