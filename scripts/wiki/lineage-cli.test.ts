import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildParamPage } from "./params/pages";
import { scanSources } from "./params/scan";
import { wikiFixture } from "./test-fixture";

const fixtures: ReturnType<typeof wikiFixture>[] = [];
afterEach(() => {
  for (const f of fixtures.splice(0)) f.cleanup();
});

describe("wiki:lineage git errors", () => {
  it("publishes lineage at teaching pins even when origin/main has removed the field", () => {
    const f = wikiFixture();
    fixtures.push(f);
    const source = "class ExampleConfig:\n    limit: int = 1\n";
    f.write("repo/vllm_ascend/config.py", source);
    const commit = f.commit("teaching definition");
    const entry = scanSources({ "vllm_ascend/config.py": source })[0]!;
    f.write(
      "wiki/params/limit.md",
      buildParamPage({ repo: "r", ref: "main", commit, entry, date: "2026-11-10", pageId: "limit" }),
    );
    f.write(
      "seeds.yaml",
      `repos:\n  r:\n    url: https://example.test/r\n    path: repo\n    refs: {main: ${commit}}\nfeatures: []\n`,
    );
    f.write("repo/vllm_ascend/config.py", "class ExampleConfig:\n    other: int = 2\n");
    const tip = f.commit("patrol removal");
    f.git(["update-ref", "refs/remotes/origin/main", tip]);
    const result = f.cli("wiki-lineage-apply", ["--seeds", "seeds.yaml"]);
    expect(result.status, result.stderr).toBe(0);
    const page = readFileSync(join(f.root, "wiki/params/limit.md"), "utf8");
    expect(page).toContain(`| main | 有 | \`${commit.slice(0, 8)}\` |`);
    expect(page).not.toContain(`| main | 无 | \`${tip.slice(0, 8)}\` |`);
  });
  it("fails without emitting absence for an invalid ref, but accepts grep no-match", () => {
    const f = wikiFixture();
    fixtures.push(f);
    f.write("repo/vllm_ascend/a.py", "known = 1\n");
    const sha = f.commit("initial");
    f.git(["update-ref", "refs/remotes/origin/main", sha]);
    f.write(
      "seeds.yaml",
      `repos:\n  r:\n    url: https://example.test/r\n    path: repo\n    refs: {main: ${sha}}\nfeatures: []\n`,
    );
    const failed = f.cli("wiki-lineage", ["known", "--refs", "does-not-exist", "--seeds", "seeds.yaml"]);
    expect(failed.status).toBe(1);
    expect(failed.stdout).not.toContain("| does-not-exist | 无 |");
    expect(failed.stderr).toContain("does-not-exist");
    const absent = f.cli("wiki-lineage", ["not_present", "--refs", "main", "--seeds", "seeds.yaml"]);
    expect(absent.status, absent.stderr).toBe(0);
    expect(absent.stdout).toContain("| main | 无 |");
  });
});
