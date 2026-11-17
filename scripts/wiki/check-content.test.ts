import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readKnowledgeSnapshot, readReaderSnapshot } from "../../server/snapshot";
import { createReaderStore } from "../../src/content/wiki/reader-store";
import { parseRawRef } from "../../src/content/wiki/schema";
import * as CheckContentModule from "../check-content";
import { runBuild } from "./build";
import { diagramRefs } from "./diagrams";
import { parsePage } from "./pages";
import { wikiFixture } from "./test-fixture";

const fixtures: ReturnType<typeof wikiFixture>[] = [];
afterEach(() => {
  for (const f of fixtures.splice(0)) f.cleanup();
});

const samplePage = (id: string, summary = "示例摘要") =>
  `---\nid: ${id}\ntitle: ${id.toUpperCase()}\ntype: concept\nsummary: ${summary}\nchapters: ["11"]\nsources: [https://docs.vllm.ai/en/latest/]\nevidence: S\nupdated: '2026-09-15'\n---\n## 一句话\n正文。\n`;

describe("check:content 磁盘 ↔ registry.json ↔ wiki/index.md 双向一致性门禁", () => {
  it("wiki:build 后通过；磁盘多出未注册孤儿页、文件缺失、frontmatter 漂移或 wiki/index.md 失步均报错", () => {
    const checkContent = (CheckContentModule as unknown as { checkContent?: (rootDir: string) => void })
      .checkContent;
    expect(checkContent).toBeTypeOf("function");

    const f = wikiFixture();
    fixtures.push(f);
    f.write("wiki/concepts/alpha.md", samplePage("alpha"));
    expect(runBuild(f.root).problems).toBe(0);

    // 1. 干净构建产物通过双向校验
    expect(() => checkContent!(f.root)).not.toThrow();

    // 2. 磁盘新增孤儿页但未重跑 wiki:build -> 反向校验必须抓出孤儿页
    f.write("wiki/concepts/orphan.md", samplePage("orphan"));
    expect(() => checkContent!(f.root)).toThrow(/orphan\.md/);
    rmSync(join(f.root, "wiki/concepts/orphan.md"));
    expect(() => checkContent!(f.root)).not.toThrow();

    // 3. 磁盘页面摘要变更但 registry.json 未同步 -> 必须报错
    f.write("wiki/concepts/alpha.md", samplePage("alpha", "修改后的摘要"));
    expect(() => checkContent!(f.root)).toThrow(/registry\.json/);
    expect(runBuild(f.root).problems).toBe(0);
    expect(() => checkContent!(f.root)).not.toThrow();

    // 4. wiki/index.md 被手改或滞后 -> 必须报错
    writeFileSync(join(f.root, "wiki/index.md"), "# 过期索引\n");
    expect(() => checkContent!(f.root)).toThrow(/index\.md/);
    expect(runBuild(f.root).problems).toBe(0);
    expect(() => checkContent!(f.root)).not.toThrow();

    // 5. registry.json 收录的文件从磁盘被删 -> 必须报错
    rmSync(join(f.root, "wiki/concepts/alpha.md"));
    expect(() => checkContent!(f.root)).toThrow(/alpha\.md/);
  });

  it("隔离真实页样本（rope / kv-cache）挂接 legacyIds 后通过 build + check:content + 快照解析，且跨页冲突在全入口拒绝", async () => {
    const repoRoot = process.cwd();
    const f = wikiFixture();
    fixtures.push(f);
    f.write("wiki/HANDBOOK.md", readFileSync(join(repoRoot, "wiki/HANDBOOK.md"), "utf8"));

    const copySampleWithAssets = (relPage: string, transform?: (src: string) => string) => {
      const raw = readFileSync(join(repoRoot, "wiki", relPage), "utf8");
      const next = transform ? transform(raw) : raw;
      f.write(`wiki/${relPage}`, next);
      const parsed = parsePage(relPage, raw).page;
      for (const rawPath of [
        ...(parsed?.fm.rawSources ?? []),
        ...(parsed?.fm.sources.flatMap((s) => {
          const r = parseRawRef(s);
          return r ? [r.path] : [];
        }) ?? []),
      ]) {
        const srcAbs = join(repoRoot, "wiki", rawPath);
        if (existsSync(srcAbs)) f.write(`wiki/${rawPath}`, readFileSync(srcAbs, "utf8"));
      }
      for (const dId of diagramRefs(parsed?.body ?? "")) {
        for (const ext of ["yaml", "svg"]) {
          const dRel = `diagrams/${dId}.${ext}`;
          const dAbs = join(repoRoot, "wiki", dRel);
          if (existsSync(dAbs)) f.write(`wiki/${dRel}`, readFileSync(dAbs, "utf8"));
        }
      }
    };

    copySampleWithAssets("concepts/rope.md", (src) =>
      src.replace(/^id: rope\r?\n/m, "id: rope\nlegacyIds:\n  - rotary-position-embedding\n  - rope-v0\n"),
    );
    copySampleWithAssets("concepts/kv-cache.md");

    expect(runBuild(f.root).problems).toBe(0);
    expect(() => CheckContentModule.checkContent(f.root)).not.toThrow();

    const readerSnap = await readReaderSnapshot(f.root);
    const store = createReaderStore(readerSnap) as ReturnType<typeof createReaderStore> & {
      resolvePageId: (id: string) => string | undefined;
    };
    expect(store.resolvePageId("rotary-position-embedding")).toBe("rope");
    expect(store.resolvePageId("rope-v0")).toBe("rope");
    expect(store.getPage("rotary-position-embedding")?.fm.id).toBe("rope");

    // 注入跨页 legacyIds 冲突（kv-cache 声称已归属 rope 的旧 ID）-> build / checkContent / snapshot 全部拒绝
    copySampleWithAssets("concepts/kv-cache.md", (src) =>
      src.replace(/^id: kv-cache\r?\n/m, "id: kv-cache\nlegacyIds:\n  - rope-v0\n"),
    );
    expect(runBuild(f.root).problems).toBeGreaterThan(0);
    await expect(readKnowledgeSnapshot(f.root)).rejects.toThrow(/legacyIds/);
    await expect(readReaderSnapshot(f.root)).rejects.toThrow(/legacyIds/);
  });

  it("失败构建（跨目录重复规范 ID 或 legacyIds 冲突）不得修改已有的 wiki/index.md 与 registry.json", () => {
    const f = wikiFixture();
    fixtures.push(f);
    f.write("wiki/index.md", "original index\n");
    f.write("src/content/wiki/registry.json", '{"sentinel":true}\n');
    f.write("wiki/concepts/duplicate.md", samplePage("duplicate", "概念目录同名页"));
    f.write("wiki/sources/duplicate.md", samplePage("duplicate", "来源目录同名页"));

    let failed = false;
    try {
      const r = runBuild(f.root);
      failed = r.problems > 0;
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
    expect(readFileSync(join(f.root, "wiki/index.md"), "utf8")).toBe("original index\n");
    expect(readFileSync(join(f.root, "src/content/wiki/registry.json"), "utf8")).toBe('{"sentinel":true}\n');
  });
});
