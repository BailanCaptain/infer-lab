import { afterEach, describe, expect, it } from "vitest";
import { wikiFixture } from "./test-fixture";

const fixtures: ReturnType<typeof wikiFixture>[] = [];
afterEach(() => {
  for (const f of fixtures.splice(0)) f.cleanup();
});

describe("wiki:lineage git errors", () => {
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
