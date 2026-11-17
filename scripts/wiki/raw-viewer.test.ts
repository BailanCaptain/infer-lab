import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { saveRawSnapshot } from "./raw";
import { collectPublishedRawPathsFromPages, emitStaticRawSnapshots, serveWikiRawPage } from "./raw-viewer";
import { wikiFixture } from "./test-fixture";

describe("raw-viewer publication boundary", () => {
  it("never exports unreferenced or quarantined raw snapshots when zero formal pages reference them", () => {
    const fx = wikiFixture();
    try {
      const wiki = join(fx.root, "wiki");
      const outDir = join(fx.root, "dist");
      const unpublishedPath = saveRawSnapshot(
        wiki,
        "UNPUBLISHED-SYNTHETIC-MATERIAL-NO-APPROVED-PAGE\nsecond line\n",
      );
      const unpublishedHash = /^raw\/sha256-([a-f0-9]{64})\.md$/.exec(unpublishedPath)![1]!;

      // Also seed a stale HTML file in dist/wiki-raw to verify clean rebuilds purge unreferenced files.
      mkdirSync(join(outDir, "wiki-raw"), { recursive: true });
      writeFileSync(join(outDir, "wiki-raw", `sha256-${"f".repeat(64)}.html`), "stale", "utf8");

      emitStaticRawSnapshots(wiki, outDir);

      expect(existsSync(join(outDir, "wiki-raw", `sha256-${unpublishedHash}.html`))).toBe(false);
      expect(existsSync(join(outDir, "wiki-raw", `sha256-${"f".repeat(64)}.html`))).toBe(false);
    } finally {
      fx.cleanup();
    }
  });

  it("exports only formal PAGE_DIRS referenced raw snapshots and blocks build on missing cited raw", () => {
    const fx = wikiFixture();
    try {
      const wiki = join(fx.root, "wiki");
      const outDir = join(fx.root, "dist");
      const approvedPath = saveRawSnapshot(wiki, "approved line 1\napproved line 2\n");
      const approvedHash = /^raw\/sha256-([a-f0-9]{64})\.md$/.exec(approvedPath)![1]!;
      const bodyLinkedPath = saveRawSnapshot(wiki, "body linked raw\n");
      const bodyLinkedHash = /^raw\/sha256-([a-f0-9]{64})\.md$/.exec(bodyLinkedPath)![1]!;
      const quarantinedPath = saveRawSnapshot(wiki, "QUARANTINED-DROP-UPLOAD-SECRET\n");
      const quarantinedHash = /^raw\/sha256-([a-f0-9]{64})\.md$/.exec(quarantinedPath)![1]!;

      fx.write(
        "wiki/concepts/published-topic.md",
        [
          "---",
          "id: published-topic",
          "title: 已发布主题",
          "type: concept",
          "summary: 正式发布页",
          `sources: ["raw:sha256-${approvedHash}.md#L1-L2"]`,
          "evidence: S",
          "updated: '2026-11-15'",
          "---",
          `正文同时通过链接引用 [补充原文](raw:sha256-${bodyLinkedHash}.md#L1)。`,
          "",
        ].join("\n"),
      );
      // Drafts outside PAGE_DIRS must NOT authorize public export.
      fx.write("wiki/_drafts/unapproved.md", `raw:sha256-${quarantinedHash}.md#L1\n`);

      emitStaticRawSnapshots(wiki, outDir);

      expect(existsSync(join(outDir, "wiki-raw", `sha256-${approvedHash}.html`))).toBe(true);
      expect(existsSync(join(outDir, "wiki-raw", `sha256-${bodyLinkedHash}.html`))).toBe(true);
      expect(existsSync(join(outDir, "wiki-raw", `sha256-${quarantinedHash}.html`))).toBe(false);

      // Missing cited raw in a formal page must throw and block the build.
      const missingHash = "e".repeat(64);
      fx.write(
        "wiki/concepts/broken-raw.md",
        [
          "---",
          "id: broken-raw",
          "title: 断链页",
          "type: concept",
          "summary: 引用缺失原文",
          `sources: ["raw:sha256-${missingHash}.md#L1"]`,
          "evidence: S",
          "updated: '2026-11-15'",
          "---",
          "正文。\n",
        ].join("\n"),
      );
      expect(() => emitStaticRawSnapshots(wiki, outDir)).toThrow();
    } finally {
      fx.cleanup();
    }
  });

  it("enforces the same published raw allowlist on dev /wiki-raw/ HTTP responses", async () => {
    const fx = wikiFixture();
    const wiki = join(fx.root, "wiki");
    const approvedPath = saveRawSnapshot(wiki, "public approved text\nline two\n");
    const approvedHash = /^raw\/sha256-([a-f0-9]{64})\.md$/.exec(approvedPath)![1]!;
    const secretPath = saveRawSnapshot(wiki, "PENDING-REVIEW-UNPUBLISHED-RAW\n");
    const secretHash = /^raw\/sha256-([a-f0-9]{64})\.md$/.exec(secretPath)![1]!;

    fx.write(
      "wiki/concepts/published.md",
      [
        "---",
        "id: published",
        "title: 公开页",
        "type: concept",
        "summary: 公开摘要",
        `sources: ["raw:sha256-${approvedHash}.md#L1-L2"]`,
        "evidence: S",
        "updated: '2026-11-15'",
        "---",
        "正文。\n",
      ].join("\n"),
    );

    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      if (!serveWikiRawPage(req.method, url, res, wiki)) {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as { port: number }).port;
    const base = `http://127.0.0.1:${port}`;
    try {
      const okRes = await fetch(`${base}/wiki-raw/sha256-${approvedHash}.html?lines=1-2`);
      expect(okRes.status).toBe(200);
      expect(await okRes.text()).toContain("public approved text");

      const blockedRes = await fetch(`${base}/wiki-raw/sha256-${secretHash}.html?lines=1`);
      expect(blockedRes.status).toBe(404);
      expect(await blockedRes.text()).not.toContain("PENDING-REVIEW-UNPUBLISHED-RAW");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      fx.cleanup();
    }
  });

  it("ignores HTML comments, code spans/fences, and malformed URLs while exporting genuine inline and reference links", async () => {
    const fx = wikiFixture();
    const wiki = join(fx.root, "wiki");
    const outDir = join(fx.root, "dist");
    const commentRaw = saveRawSnapshot(wiki, "COMMENT-ONLY-SECRET\n");
    const commentHash = /^raw\/sha256-([a-f0-9]{64})\.md$/.exec(commentRaw)![1]!;
    const codeRaw = saveRawSnapshot(wiki, "CODE-EXAMPLE-SECRET\n");
    const codeHash = /^raw\/sha256-([a-f0-9]{64})\.md$/.exec(codeRaw)![1]!;
    const invalidSuffixRaw = saveRawSnapshot(wiki, "INVALID-SUFFIX-SECRET\n");
    const invalidSuffixHash = /^raw\/sha256-([a-f0-9]{64})\.md$/.exec(invalidSuffixRaw)![1]!;
    const inlineLinkRaw = saveRawSnapshot(wiki, "INLINE-LINK-PUBLIC\n");
    const inlineLinkHash = /^raw\/sha256-([a-f0-9]{64})\.md$/.exec(inlineLinkRaw)![1]!;
    const refLinkRaw = saveRawSnapshot(wiki, "REF-LINK-PUBLIC-1\nREF-LINK-PUBLIC-2\n");
    const refLinkHash = /^raw\/sha256-([a-f0-9]{64})\.md$/.exec(refLinkRaw)![1]!;

    const body = [
      `<!-- internal note raw:sha256-${commentHash}.md -->`,
      `行内示例 \`raw:sha256-${codeHash}.md#L1\` 与围栏示例：`,
      "```md",
      `[example](raw:sha256-${codeHash}.md#L1)`,
      "```",
      `非法尾缀 [bad](raw:sha256-${invalidSuffixHash}.mdINVALID) 与反序行号 [rev](raw:sha256-${invalidSuffixHash}.md#L5-L2)。`,
      `合法内联 [source](raw:sha256-${inlineLinkHash}.md#L1) 与合法引用式 [ref-source][r1]。`,
      "",
      `[r1]: ../raw/sha256-${refLinkHash}.md#L1-L2`,
      "",
    ].join("\n");

    const directSet = collectPublishedRawPathsFromPages([{ fm: { sources: [] }, body }]);
    expect([...directSet].sort()).toEqual([inlineLinkRaw, refLinkRaw].sort());

    fx.write(
      "wiki/concepts/link-boundary.md",
      [
        "---",
        "id: link-boundary",
        "title: 链接边界测试",
        "type: concept",
        "summary: 仅真实合法链接可导出本地原文",
        "sources: ['vllm-ascend@1234567:vllm_ascend/config.py#L1-L2']",
        "evidence: C",
        "updated: '2026-11-15'",
        "---",
        body,
      ].join("\n"),
    );

    emitStaticRawSnapshots(wiki, outDir);
    expect(existsSync(join(outDir, "wiki-raw", `sha256-${commentHash}.html`))).toBe(false);
    expect(existsSync(join(outDir, "wiki-raw", `sha256-${codeHash}.html`))).toBe(false);
    expect(existsSync(join(outDir, "wiki-raw", `sha256-${invalidSuffixHash}.html`))).toBe(false);
    expect(existsSync(join(outDir, "wiki-raw", `sha256-${inlineLinkHash}.html`))).toBe(true);
    expect(existsSync(join(outDir, "wiki-raw", `sha256-${refLinkHash}.html`))).toBe(true);

    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      if (!serveWikiRawPage(req.method, url, res, wiki)) {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as { port: number }).port;
    const base = `http://127.0.0.1:${port}`;
    try {
      for (const blockedHash of [commentHash, codeHash, invalidSuffixHash]) {
        const res = await fetch(`${base}/wiki-raw/sha256-${blockedHash}.html?lines=1`);
        expect(res.status).toBe(404);
      }
      const okInline = await fetch(`${base}/wiki-raw/sha256-${inlineLinkHash}.html?lines=1`);
      expect(okInline.status).toBe(200);
      expect(await okInline.text()).toContain("INLINE-LINK-PUBLIC");

      const okRef = await fetch(`${base}/wiki-raw/sha256-${refLinkHash}.html?lines=1-2`);
      expect(okRef.status).toBe(200);
      expect(await okRef.text()).toContain("REF-LINK-PUBLIC-2");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      fx.cleanup();
    }
  });

  it("resolves duplicate reference link definitions with CommonMark first-definition-wins so shadowed raw targets stay isolated", async () => {
    const fx = wikiFixture();
    const wiki = join(fx.root, "wiki");
    const outDir = join(fx.root, "dist");
    const firstRaw = saveRawSnapshot(wiki, "FIRST-DEFINITION-PUBLIC\n");
    const firstHash = /^raw\/sha256-([a-f0-9]{64})\.md$/.exec(firstRaw)![1]!;
    const shadowedRaw = saveRawSnapshot(wiki, "SECOND-DEFINITION-SHADOWED-SECRET\n");
    const shadowedHash = /^raw\/sha256-([a-f0-9]{64})\.md$/.exec(shadowedRaw)![1]!;
    const unicodeRaw = saveRawSnapshot(wiki, "UNICODE-FOLDED-PUBLIC\n");
    const unicodeHash = /^raw\/sha256-([a-f0-9]{64})\.md$/.exec(unicodeRaw)![1]!;
    const shadowedByExtRaw = saveRawSnapshot(wiki, "SHADOWED-BY-EXTERNAL-DEF-SECRET\n");
    const shadowedByExtHash = /^raw\/sha256-([a-f0-9]{64})\.md$/.exec(shadowedByExtRaw)![1]!;

    const body = [
      "正文引用 [source][ref]、[unicode][ẞ] 与 [external][ext]。",
      "",
      `[ref]: raw:sha256-${firstHash}.md#L1`,
      `[ref]: raw:sha256-${shadowedHash}.md#L1`,
      `[ss]: raw:sha256-${unicodeHash}.md#L1`,
      `[ẞ]: raw:sha256-${shadowedHash}.md#L1`,
      "[ext]: https://docs.vllm.ai/en/latest/",
      `[ext]: raw:sha256-${shadowedByExtHash}.md#L1`,
      "",
    ].join("\n");

    const directSet = collectPublishedRawPathsFromPages([{ fm: { sources: [] }, body }]);
    expect([...directSet].sort()).toEqual([firstRaw, unicodeRaw].sort());

    fx.write(
      "wiki/concepts/dup-defs.md",
      [
        "---",
        "id: dup-defs",
        "title: 重复引用定义测试",
        "type: concept",
        "summary: 首定义优先且遮蔽目标隔离",
        "sources: ['vllm-ascend@1234567:vllm_ascend/config.py#L1-L2']",
        "evidence: C",
        "updated: '2026-11-15'",
        "---",
        body,
      ].join("\n"),
    );

    emitStaticRawSnapshots(wiki, outDir);
    expect(existsSync(join(outDir, "wiki-raw", `sha256-${firstHash}.html`))).toBe(true);
    expect(existsSync(join(outDir, "wiki-raw", `sha256-${unicodeHash}.html`))).toBe(true);
    expect(existsSync(join(outDir, "wiki-raw", `sha256-${shadowedHash}.html`))).toBe(false);
    expect(existsSync(join(outDir, "wiki-raw", `sha256-${shadowedByExtHash}.html`))).toBe(false);

    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      if (!serveWikiRawPage(req.method, url, res, wiki)) {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as { port: number }).port;
    const base = `http://127.0.0.1:${port}`;
    try {
      const okFirst = await fetch(`${base}/wiki-raw/sha256-${firstHash}.html?lines=1`);
      expect(okFirst.status).toBe(200);
      expect(await okFirst.text()).toContain("FIRST-DEFINITION-PUBLIC");

      const okUnicode = await fetch(`${base}/wiki-raw/sha256-${unicodeHash}.html?lines=1`);
      expect(okUnicode.status).toBe(200);
      expect(await okUnicode.text()).toContain("UNICODE-FOLDED-PUBLIC");

      for (const blockedHash of [shadowedHash, shadowedByExtHash]) {
        const blockedRes = await fetch(`${base}/wiki-raw/sha256-${blockedHash}.html?lines=1`);
        expect(blockedRes.status).toBe(404);
      }
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      fx.cleanup();
    }
  });
});
