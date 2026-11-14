import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { wikiFixture } from "../test-fixture";
import { buildParamPage, paramId } from "./pages";
import { scanSources } from "./scan";

it("runs the shared sync CLI across a real Git delta and checkpoints only the completed deterministic update", () => {
  const f = wikiFixture();
  try {
    const file = "vllm_ascend/config.py";
    const old = "class ExampleConfig:\n    changed: int = 1\n    removed: int = 1\n";
    f.write(`repo/${file}`, old);
    const pin = f.commit("old");
    for (const entry of scanSources({ [file]: old }))
      f.write(
        `wiki/params/${paramId(entry)}.md`,
        buildParamPage({
          repo: "r",
          ref: "main",
          commit: pin,
          entry,
          date: new Date().toISOString().slice(0, 10),
        })
          .replace(`${entry.name} 的静态定义，正文待补。`, "控制执行数量。")
          .replace(`骨架，待补：${entry.name} 的静态参数定义。`, "控制执行数量。[D]")
          .replace("骨架，待补：为什么存在。", "限制资源使用。[D]")
          .replace("骨架，待补：开了的代价与互斥关系。", "提高上限增加资源需求。[D]"),
      );
    f.write(`repo/${file}`, "class ExampleConfig:\n    changed: int = 2\n    added: int = 1\n");
    const tip = f.commit("new (#2)");
    f.git(["update-ref", "refs/remotes/origin/main", tip]);
    f.write(
      "seeds.yaml",
      `repos:\n  r:\n    url: https://example.test/r\n    path: repo\n    refs: {main: ${pin}}\nfeatures: []\n`,
    );
    f.write("sync.json", JSON.stringify({ seeds: "seeds.yaml", parameters: true, maxNewParamPages: 1 }));
    const first = f.cli("wiki-sync", ["--config", "sync.json"]);
    expect(first.status, first.stdout + first.stderr).toBe(0);
    const result = JSON.parse(first.stdout);
    expect(result.parameters[0].published).toEqual({ added: 1, removed: 1, changed: 1, written: 1 });
    for (const entry of scanSources({ [file]: old })) {
      const page = readFileSync(join(f.root, `wiki/params/${paramId(entry)}.md`), "utf8");
      expect(page).toContain("默认表达式 | `1`");
      expect(page).not.toContain(tip);
    }
    const queued = JSON.parse(readFileSync(join(f.root, "wiki/_drafts/_param-queue.json"), "utf8"));
    expect(queued[0].skipped).toHaveLength(2);
    expect(
      queued[0].skipped.every((entry: { reason: string }) => entry.reason === "outside-teaching-pin"),
    ).toBe(true);
    expect(result.modelCallsAllowed).toBe(false);
    const next = f.cli("wiki-sync", ["--config", "sync.json"]);
    expect(next.status, next.stdout + next.stderr).toBe(0);
    expect(JSON.parse(next.stdout).parameters).toEqual([{ repo: "r", ref: "main", changed: false }]);
    const receipt = JSON.parse(readFileSync(join(f.root, "wiki/_jobs/sync/last-run.json"), "utf8"));
    expect(receipt.status).toBe("succeeded");
    expect(
      readdirSync(join(f.root, "wiki/_jobs/sync")).filter((name) => name.startsWith("run-")),
    ).toHaveLength(2);
    expect(readFileSync(join(f.root, "wiki/log.md"), "utf8")).toContain('"1" → "2"');
  } finally {
    f.cleanup();
  }
});

it("works an over-limit delta off a few pages per night instead of deferring the same batch forever", () => {
  const f = wikiFixture();
  try {
    const file = "vllm_ascend/config.py";
    f.write(`repo/${file}`, "class ExampleConfig:\n    existing: int = 1\n");
    const pin = f.commit("old");
    f.write(
      `repo/${file}`,
      "class ExampleConfig:\n    existing: int = 1\n    alpha_flag: int = 1\n    beta_flag: int = 2\n    gamma_flag: int = 3\n",
    );
    const tip = f.commit("new (#7)");
    f.git(["update-ref", "refs/remotes/origin/main", tip]);
    f.write(
      "seeds.yaml",
      `repos:\n  r:\n    url: https://example.test/r\n    path: repo\n    refs: {main: ${pin}}\nfeatures: []\n`,
    );
    f.write("sync.json", JSON.stringify({ seeds: "seeds.yaml", maxNewParamPages: 2 }));
    const pages = () =>
      existsSync(join(f.root, "wiki/_drafts"))
        ? readdirSync(join(f.root, "wiki/_drafts")).filter((name) => name.endsWith(".md"))
        : [];

    const first = f.cli("wiki-sync", ["--config", "sync.json"]);
    expect(first.status, first.stdout + first.stderr).toBe(0);
    expect(JSON.parse(first.stdout).parameters[0].published).toMatchObject({ added: 2, heldBack: 1 });
    expect(pages()).toHaveLength(2);

    const second = f.cli("wiki-sync", ["--config", "sync.json"]);
    expect(second.status, second.stdout + second.stderr).toBe(0);
    expect(JSON.parse(second.stdout).parameters[0].published).toEqual({
      added: 1,
      removed: 0,
      changed: 0,
      written: 1,
    });
    expect(pages()).toHaveLength(3);
    // 跨批保留精确字段身份和固定提交；提交标题不能代替字段引入证据。
    for (const name of pages()) {
      const body = readFileSync(join(f.root, "wiki/_drafts", name), "utf8");
      expect(body).toMatch(/ExampleConfig\.(alpha_flag|beta_flag|gamma_flag)` 字段定义/);
      expect(body).toContain(`| main | 有 | \`${tip.slice(0, 8)}\` |`);
      expect(body).not.toContain("#7");
    }
    expect(readdirSync(join(f.root, "wiki/params")).filter((name) => name.endsWith(".md"))).toEqual([]);

    const third = f.cli("wiki-sync", ["--config", "sync.json"]);
    expect(JSON.parse(third.stdout).parameters).toEqual([{ repo: "r", ref: "main", changed: false }]);
  } finally {
    f.cleanup();
  }
});

it("defers an over-limit parameter delta without advancing its checkpoint and still runs patrol", () => {
  const f = wikiFixture();
  try {
    f.write("repo/vllm_ascend/config.py", "class ExampleConfig:\n    existing: int = 1\n");
    const pin = f.commit("old");
    f.write(
      "repo/vllm_ascend/config.py",
      "class ExampleConfig:\n    existing: int = 1\n    extra: int = 2\n",
    );
    const tip = f.commit("new");
    f.git(["update-ref", "refs/remotes/origin/main", tip]);
    f.write(
      "seeds.yaml",
      `repos:\n  r:\n    url: https://example.test/r\n    path: repo\n    refs: {main: ${pin}}\nfeatures: []\n`,
    );
    f.write("sync.json", JSON.stringify({ seeds: "seeds.yaml", maxNewParamPages: 0 }));
    const result = f.cli("wiki-sync", ["--config", "sync.json"]);
    expect(result.status, result.stdout + result.stderr).toBe(1);
    const output = JSON.parse(result.stdout);
    expect(output.parameters[0]).toMatchObject({
      repo: "r",
      ref: "main",
      status: "deferred",
      added: 1,
      limit: 0,
    });
    expect(output.modelCallsAllowed).toBe(false);
    expect(existsSync(output.patrol.path)).toBe(true);
    expect(readdirSync(join(f.root, "wiki/_jobs/parameter-sync"))).toEqual([]);
    expect(existsSync(join(f.root, "wiki/params"))).toBe(false);
    expect(JSON.parse(readFileSync(join(f.root, "wiki/_jobs/sync/last-run.json"), "utf8"))).toMatchObject({
      status: "deferred",
      deferred: 1,
    });
  } finally {
    f.cleanup();
  }
});
