import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { compileRaw } from "./compile-raw";
import { runStagedIntegration } from "./integration-run";
import { saveRawSnapshot } from "./raw";
import { approveReview, listReviews, readReview, rejectReview, reviewDiff } from "./review";
import { replaceText, wikiContents } from "./review-files";
import { wikiFixture } from "./test-fixture";
import { WorkflowStore } from "./workflow";

const fixtures: ReturnType<typeof wikiFixture>[] = [];
afterEach(() => {
  for (const f of fixtures.splice(0)) f.cleanup();
});

async function proposal(crossPage = false, withGapLedger = false) {
  const f = wikiFixture();
  fixtures.push(f);
  const store = new WorkflowStore(f.root);
  mkdirSync(join(f.root, "wiki/sources"), { recursive: true });
  const raw = saveRawSnapshot(join(f.root, "wiki"), "本地资料：启用需人工设置。\n");
  const source = `raw:${raw.slice(4)}#L1`;
  const page = `---\nid: a\ntitle: A\ntype: source\nsummary: 人工设置\nsources: [${source}]\nevidence: I\nupdated: '2026-09-15'\n---\n## 一句话\n启用需人工设置。\n`;
  const neighbor = page.replace("id: a", "id: b").replace("title: A", "title: B");
  if (crossPage) f.write("wiki/sources/b.md", neighbor);
  await compileRaw(
    store,
    { id: "a", source, origin: "chat", rules: "fixture", timeoutMs: 1000 },
    { maxAttempts: 1, maxCostUsd: 1, reserveUsd: 1 },
    {
      runAgent: async (req) => ({
        id: req.id,
        ok: true,
        exitCode: 0,
        stderrTail: "",
        output: page,
        costUsd: 0,
      }),
    },
  );
  const before = wikiContents(f.root);
  if (withGapLedger) f.write("wiki/_gaps.json", "private user question\n");
  const result = await runStagedIntegration(
    f.root,
    {
      id: "_integrate",
      cwd: "",
      args: [],
      stdin: "",
      timeoutMs: 1000,
      allowedWrites: ["sources/**", "_drafts/_integration.json"],
    },
    ["a"],
    "2026-09-15",
    {
      runAgent: async (req) => {
        if (withGapLedger) expect(existsSync(join(req.cwd, "_gaps.json"))).toBe(false);
        writeFileSync(
          join(req.cwd, "sources/a.md"),
          crossPage
            ? page.replace(
                "evidence: I",
                "evidence: I\nrelations: [{to: b, kind: builds-on, note: 设置背景}]",
              )
            : page,
        );
        if (crossPage)
          writeFileSync(
            join(req.cwd, "sources/b.md"),
            neighbor.replace("summary: 人工设置", "summary: 配置背景"),
          );
        writeFileSync(
          join(req.cwd, "_drafts/_integration.json"),
          JSON.stringify({ promoted: ["a"], merged: [], rejected: [] }),
        );
        return { id: req.id, ok: true, exitCode: 0, stderrTail: "" };
      },
      validate: () => [],
    },
  );
  return { ...f, store, raw, before, id: result.reviewId };
}

describe("durable human review", () => {
  it("does not give the question ledger to the integration agent", async () => {
    const f = await proposal(false, true);
    expect(readReview(f.root, f.id).payload.base).not.toHaveProperty("wiki/_gaps.json");
    expect(readFileSync(join(f.root, "wiki/_gaps.json"), "utf8")).toBe("private user question\n");
  });
  it("recording a question does not invalidate or get overwritten by an existing publication", async () => {
    const f = await proposal();
    f.write("wiki/_gaps.json", "local question ledger\n");
    await approveReview(f.root, f.id, { validate: () => [] });
    expect(readFileSync(join(f.root, "wiki/_gaps.json"), "utf8")).toBe("local question ledger\n");
  });
  it("never overwrites an occupied immutable snapshot address", async () => {
    const f = await proposal();
    f.write(`wiki/${f.raw}`, "concurrent corrupt write");
    expect(() => replaceText(f.root, `wiki/${f.raw}`, "本地资料：启用需人工设置。\n")).toThrow(/hash/);
    expect(readFileSync(join(f.root, "wiki", f.raw), "utf8")).toBe("concurrent corrupt write");
  });
  it("reviews new and updated pages together, then derives the inverse relation from one declaration", async () => {
    const f = await proposal(true);
    const diff = reviewDiff(f.root, f.id);
    expect(diff).toContain("wiki/sources/a.md (新增)");
    expect(diff).toContain("wiki/sources/b.md (更新)");
    expect(wikiContents(f.root)).toEqual(f.before);
    await approveReview(f.root, f.id);
    const registry = JSON.parse(readFileSync(join(f.root, "src/content/wiki/registry.json"), "utf8"));
    expect(registry.pages.find((p: { id: string }) => p.id === "b").backlinks).toEqual([
      { from: "a", kind: "enables", note: "设置背景" },
    ]);
  });
  it("shows the full revision, then validates and publishes a raw-source draft exactly once", async () => {
    const f = await proposal();
    expect(wikiContents(f.root)).toEqual(f.before);
    expect(f.store.list()[0]?.state).toBe("draft");
    const show = f.cli("wiki-review", ["show", f.id]);
    expect(show.status, show.stderr).toBe(0);
    expect(show.stdout).toContain("sources/a.md (新增)");
    expect(show.stdout).toContain("+启用需人工设置。");
    // 派生文件发布时重新生成，不在待审差异里
    expect(reviewDiff(f.root, f.id)).not.toContain("wiki/log.md");
    const approve = f.cli("wiki-review", ["approve", f.id]);
    expect(approve.status, approve.stderr).toBe(0);
    expect(readReview(f.root, f.id).state).toBe("published");
    expect(f.store.list()[0]?.state).toBe("integrated");
    expect(existsSync(join(f.root, "wiki/_drafts/a.md"))).toBe(false);
    expect(readFileSync(join(f.root, "wiki", f.raw), "utf8")).toBe("本地资料：启用需人工设置。\n");
    const after = wikiContents(f.root);
    await approveReview(f.root, f.id);
    expect(wikiContents(f.root)).toEqual(after);
    expect(readFileSync(join(f.root, "wiki/log.md"), "utf8").match(/晋升/g)).toHaveLength(1);
  });
  it("rejects a revision permanently and preserves the original draft and official files", async () => {
    const f = await proposal();
    expect((await rejectReview(f.root, f.id, "材料不足")).state).toBe("rejected");
    await expect(approveReview(f.root, f.id)).rejects.toThrow(/驳回/);
    expect(wikiContents(f.root)).toEqual(f.before);
    expect(f.store.list()[0]?.state).toBe("draft");
    expect(listReviews(f.root)[0]?.reason).toBe("材料不足");
  });
  it.each(["wiki/raw", "job", "written page"])("refuses stale approval after %s changes", async (kind) => {
    const f = await proposal(true);
    const file =
      kind === "wiki/raw"
        ? `wiki/${f.raw}`
        : kind === "job"
          ? `wiki/_jobs/${f.store.list()[0]!.id}.json`
          : "wiki/sources/b.md";
    f.write(file, "user change");
    const before = wikiContents(f.root);
    await expect(approveReview(f.root, f.id)).rejects.toThrow(/变化/);
    expect(wikiContents(f.root)).toEqual(before);
    expect(readReview(f.root, f.id).state).toBe("pending");
  });
  it("runs validation again at approval, and retains the pending revision on failure", async () => {
    const f = await proposal();
    await expect(approveReview(f.root, f.id, { validate: () => ["fixture new lint error"] })).rejects.toThrow(
      /new lint error/,
    );
    expect(wikiContents(f.root)).toEqual(f.before);
    expect(readReview(f.root, f.id).state).toBe("pending");
  });
  it("rechecks source hashes after validation before writing any approved content", async () => {
    const f = await proposal();
    await expect(
      approveReview(f.root, f.id, {
        validate: () => {
          f.write(`wiki/${f.raw}`, "changed during validation");
          return [];
        },
      }),
    ).rejects.toThrow(/变化/);
    expect(readReview(f.root, f.id).state).toBe("pending");
    expect(existsSync(join(f.root, "wiki/sources/a.md"))).toBe(false);
  });
  it("detects edited payloads and disallows recovery as implicit approval", async () => {
    const f = await proposal();
    const recovery = f.cli("wiki-review", ["recover", f.id]);
    expect(recovery.status).toBe(1);
    expect(recovery.stderr).toContain("不能批准");
    const record = readReview(f.root, f.id);
    record.payload.writes[0]!.after = "tampered";
    f.write(`wiki/_jobs/reviews/${f.id}.json`, JSON.stringify(record));
    await expect(approveReview(f.root, f.id)).rejects.toThrow(/revision/);
    expect(wikiContents(f.root)).toEqual(f.before);
  });
  it("recovers after a real child process exits between writes and leaves its lock behind", async () => {
    const f = await proposal();
    const code = `import { approveReview } from ${JSON.stringify(new URL("./review.ts", import.meta.url).href)}; await approveReview(${JSON.stringify(f.root)}, ${JSON.stringify(f.id)}, { afterWrite: (path) => { if (path === "wiki/sources/a.md") process.exit(73); } });`;
    const child = spawnSync(
      process.execPath,
      ["--import", import.meta.resolve("tsx"), "--input-type=module", "-e", code],
      { encoding: "utf8", timeout: 20_000 },
    );
    expect(child.status, child.stderr).toBe(73);
    expect(readReview(f.root, f.id).state).toBe("publishing");
    expect(existsSync(join(f.root, "tools/wiki-runtime/workflow.lock"))).toBe(true);
    expect(f.store.list()[0]?.state).toBe("draft");
    const recovered = f.cli("wiki-review", ["recover", f.id]);
    expect(recovered.status, recovered.stderr).toBe(0);
    expect(readReview(f.root, f.id).state).toBe("published");
    expect(f.store.list()[0]?.state).toBe("integrated");
    expect(readFileSync(join(f.root, "wiki/log.md"), "utf8").match(/晋升/g)).toHaveLength(1);
    expect(f.cli("wiki-review", ["recover", f.id]).status).toBe(0);
  });
  it("preserves a user edit during interrupted publication instead of overwriting it on recovery", async () => {
    const f = await proposal();
    let path = "";
    await expect(
      approveReview(f.root, f.id, {
        afterWrite: (written) => {
          path = written;
          throw new Error("interrupt");
        },
      }),
    ).rejects.toThrow("interrupt");
    f.write(path, "user change");
    await expect(approveReview(f.root, f.id)).rejects.toThrow(/变化/);
    expect(readFileSync(join(f.root, path), "utf8")).toBe("user change");
    expect(readReview(f.root, f.id).state).toBe("publishing");
  });
  it("never removes a live owner's workflow lock", async () => {
    const f = await proposal();
    f.write("tools/wiki-runtime/workflow.lock", JSON.stringify({ pid: process.pid, at: "now" }));
    expect(() => f.store.recoverLock()).toThrow(/仍存活/);
    expect(existsSync(join(f.root, "tools/wiki-runtime/workflow.lock"))).toBe(true);
  });
});

// 2026-09-23：待审包以前比对整个 wiki/ 加注册表，任何改动（新草稿、直接发布的页、改手册）都让所有待审包过期；
// 每个包又都带着 registry.json / index.md / log.md 的整份新内容，两个包批了一个，另一个必然过期。
describe("待审包只盯本包依赖的文件", () => {
  it("与本包无关的改动不让包过期：新增别的页、改手册、别的草稿", async () => {
    const f = await proposal();
    const unrelated =
      "---\nid: new\ntitle: New\ntype: source\nsummary: 别处\nsources: [https://docs.vllm.ai/en/latest/]\nevidence: S\nupdated: '2026-09-15'\n---\n## 一句话\n别处的页。\n";
    f.write("wiki/sources/new.md", unrelated);
    f.write("wiki/HANDBOOK.md", "# 手册\n\n补一句。\n");
    f.write("wiki/_drafts/other.md", "another draft");
    await approveReview(f.root, f.id, { validate: () => [] });
    expect(readReview(f.root, f.id).state).toBe("published");
    expect(readFileSync(join(f.root, "wiki/sources/new.md"), "utf8")).toBe(unrelated);
  });

  it("包里不带 registry.json / index.md / log.md；base 只有本包写的文件、消耗的草稿、引用的原始材料和任务回执", async () => {
    const f = await proposal(true);
    const { payload } = readReview(f.root, f.id);
    const paths = payload.writes.map((w) => w.path);
    for (const derived of ["src/content/wiki/registry.json", "wiki/index.md", "wiki/log.md"]) {
      expect(paths).not.toContain(derived);
      expect(payload.base).not.toHaveProperty(derived);
    }
    expect(Object.keys(payload.base).sort()).toEqual(
      [
        "wiki/_drafts/a.md",
        `wiki/_jobs/${f.store.list()[0]!.id}.json`,
        `wiki/${f.raw}`,
        "wiki/sources/b.md",
      ].sort(),
    );
    expect(payload.log).toContain("晋升 sources/a.md");
  });

  it("两个同时待审的包先后批准都能发布，注册表、目录和日志在发布时重新生成、两页都在", async () => {
    const f = wikiFixture();
    fixtures.push(f);
    const store = new WorkflowStore(f.root);
    mkdirSync(join(f.root, "wiki/sources"), { recursive: true });
    const raw = saveRawSnapshot(join(f.root, "wiki"), "本地资料：启用需人工设置。\n");
    const source = `raw:${raw.slice(4)}#L1`;
    const page = (id: string) =>
      `---\nid: ${id}\ntitle: 页${id}\ntype: source\nsummary: 人工设置\nsources: [${source}]\nevidence: I\nupdated: '2026-09-15'\n---\n## 一句话\n启用需人工设置。\n`;
    const pack = async (id: string) => {
      await compileRaw(
        store,
        { id, source, origin: "chat", rules: "fixture", timeoutMs: 1000 },
        { maxAttempts: 1, maxCostUsd: 1, reserveUsd: 1 },
        {
          runAgent: async (req) => ({
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            output: page(id),
            costUsd: 0,
          }),
        },
      );
      const result = await runStagedIntegration(
        f.root,
        {
          id: "_integrate",
          cwd: "",
          args: [],
          stdin: "",
          timeoutMs: 1000,
          allowedWrites: ["sources/**", "_drafts/_integration.json"],
        },
        [id],
        "2026-09-15",
        {
          runAgent: async (req) => {
            writeFileSync(join(req.cwd, `sources/${id}.md`), page(id));
            writeFileSync(
              join(req.cwd, "_drafts/_integration.json"),
              JSON.stringify({ promoted: [id], merged: [], rejected: [] }),
            );
            return { id: req.id, ok: true, exitCode: 0, stderrTail: "" };
          },
          validate: () => [],
        },
      );
      return result.reviewId;
    };
    const first = await pack("a");
    const second = await pack("b");
    await approveReview(f.root, first);
    await approveReview(f.root, second);
    expect(readReview(f.root, second).state).toBe("published");
    const registry = JSON.parse(readFileSync(join(f.root, "src/content/wiki/registry.json"), "utf8"));
    expect(registry.pages.map((p: { id: string }) => p.id).sort()).toEqual(["a", "b"]);
    const index = readFileSync(join(f.root, "wiki/index.md"), "utf8");
    expect(index).toContain("页a");
    expect(index).toContain("页b");
    const log = readFileSync(join(f.root, "wiki/log.md"), "utf8");
    expect(log).toContain("晋升 sources/a.md");
    expect(log).toContain("晋升 sources/b.md");
  });
});
