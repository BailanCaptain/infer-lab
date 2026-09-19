import { expect, it } from "vitest";
import { gitLineage, renderVerifiedLineage } from "./lineage-git";
import { wikiFixture } from "./test-fixture";

it("verifies presence transitions and containing tags instead of choosing any pickaxe change", () => {
  const f = wikiFixture();
  try {
    f.write("repo/vllm_ascend/config.py", "gate = False\n");
    const first = f.commit("add gate (#1)");
    f.git(["tag", "v1"]);
    f.write("repo/vllm_ascend/config.py", "gate = False\n# gate appears again\n");
    const changed = f.commit("mention gate (#2)");
    f.write("repo/vllm_ascend/config.py", "other = False\n");
    const removed = f.commit("remove gate (#3)");
    f.git(["tag", "v2"]);
    f.git(["update-ref", "refs/remotes/origin/main", removed]);
    f.git(["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main"]);
    const data = gitLineage(`${f.root}/repo`, "gate", ["v1", "v2", "main"], ["vllm_ascend/"]);
    expect(data.presence.map((r) => r.files)).toEqual([1, 0, 0]);
    expect(data.events.some((e) => e.commit === first && e.kind === "introduced")).toBe(true);
    expect(data.events.some((e) => e.commit === removed && e.kind === "removed" && e.pr === 3)).toBe(true);
    expect(data.events.some((e) => e.commit === changed)).toBe(false);
    expect(data.tagsWithTerm).toEqual(["v1"]);
    expect(data.events.find((e) => e.commit === removed)!.topFiles).toEqual([
      { path: "vllm_ascend/config.py", added: 1, removed: 2 },
    ]);
    const markdown = renderVerifiedLineage(data);
    expect(markdown).toContain("从 git 历史算出");
    expect(markdown).toContain("/pull/3");
    expect(markdown).toContain("−2");
    expect(gitLineage(`${f.root}/repo`, "absent", ["v1", "v2"], ["vllm_ascend/"]).events).toEqual([]);
    expect(
      gitLineage(`${f.root}/repo`, "other", ["main"], ["vllm_ascend/"]).events.every(
        (e) => e.kind === "introduced",
      ),
    ).toBe(true);
    expect(data.events.find((e) => e.commit === removed)!.containedIn.tags).toContain("v2");
    expect(data.events.find((e) => e.commit === removed)!.containedIn.branches).toEqual([
      "main",
      "origin/main",
    ]);
  } finally {
    f.cleanup();
  }
});

it("uses the tracked branch tip when the local checkout remains pinned to an older commit", () => {
  const f = wikiFixture();
  try {
    f.write("repo/vllm_ascend/a.py", "gate = 1\n");
    const pin = f.commit("old pin");
    f.write("repo/vllm_ascend/a.py", "other = 1\n");
    const tip = f.commit("remove gate (#2)");
    f.git(["update-ref", "refs/remotes/origin/main", tip]);
    f.git(["update-ref", "refs/heads/main", pin]);
    expect(gitLineage(`${f.root}/repo`, "gate", ["main"], ["vllm_ascend/"]).presence[0]).toMatchObject({
      commit: tip,
      files: 0,
    });
    expect(gitLineage(`${f.root}/repo`, "gate", [pin], ["vllm_ascend/"]).presence[0]).toMatchObject({
      commit: pin,
      files: 1,
    });
  } finally {
    f.cleanup();
  }
});
