import { expect, it } from "vitest";
import { gitLineage, renderVerifiedLineage } from "./lineage-git";
import { wikiFixture } from "./test-fixture";

it("does not turn a common field name into a repository-wide parameter history", () => {
  const f = wikiFixture();
  try {
    f.write("repo/vllm_ascend/config.py", "class OtherConfig:\n    size: int = 4\n");
    const before = f.commit("unrelated size (#1)");
    f.write(
      "repo/vllm_ascend/config.py",
      "class OtherConfig:\n    size: int = 4\nclass KVPPConfig:\n    size: int = 1\n",
    );
    const after = f.commit("KVPP definition (#2)");
    const data = gitLineage(
      `${f.root}/repo`,
      "size",
      [before, after],
      ["vllm_ascend/config.py"],
      "KVPPConfig",
    );
    expect(data.presence.map((p) => p.files)).toEqual([0, 1]);
    const markdown = renderVerifiedLineage(data);
    expect(markdown).toContain("KVPPConfig.size");
    expect(markdown).not.toContain("/pull/1");
    expect(markdown).not.toContain("包含该提交的 tag");
  } finally {
    f.cleanup();
  }
});

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

it("detects class field presence across plain __init__ constructor parameters and dataclass fields", () => {
  const f = wikiFixture();
  try {
    f.write(
      "repo/vllm_ascend/ascend_config.py",
      `class AscendCompilationConfig:
    def __init__(self, enable_static_kernel: bool = False, **kwargs):
        self.enable_static_kernel = enable_static_kernel
`,
    );
    const v23 = f.commit("v0.23 without super kernel");
    f.write(
      "repo/vllm_ascend/ascend_config.py",
      `class AscendCompilationConfig:
    def __init__(
        self,
        enable_static_kernel: bool = False,
        enable_super_kernel: bool | None = None,
        **kwargs,
    ):
        self.enable_static_kernel = enable_static_kernel
        self.enable_super_kernel = enable_super_kernel
`,
    );
    const v26 = f.commit("v0.26 backport super kernel in __init__");
    f.write(
      "repo/vllm_ascend/ascend_config.py",
      `@config
class AscendCompilationConfig:
    enable_static_kernel: bool = False
    enable_super_kernel: bool = False
`,
    );
    const main = f.commit("main dataclass field");
    const data = gitLineage(
      `${f.root}/repo`,
      "enable_super_kernel",
      [v23, v26, main],
      ["vllm_ascend/ascend_config.py"],
      "AscendCompilationConfig",
    );
    expect(data.presence.map((p) => p.files)).toEqual([0, 1, 1]);
  } finally {
    f.cleanup();
  }
});
