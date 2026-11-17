import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { createEvidenceViewController, readerPageEvidenceSchema } from "../../content/wiki/evidence-schema";
import { Article } from "../pages/WikiPage";
import { EvidencePane } from "./EvidencePane";
import { ReviewSvgAssets } from "./ReviewPane";
import { shouldStopChatOnPanelClose } from "./WikiPanel";

describe("离线证据面板 UI 第 1 段（Task 045 · 000868）", () => {
  const rev = "a".repeat(64);

  it("按状态如实渲染 repo/raw 纯文本行号、整文件截断提示、纯外链卡片、未知仓库不可用卡与失败重试", async () => {
    let failOnce = true;
    const rawHash = "b".repeat(64);
    const rawRef = `raw:sha256-${rawHash}.md#L2-L3`;
    const pack = readerPageEvidenceSchema.parse({
      version: 1,
      revision: rev,
      pageId: "quant-page",
      pageSources: [
        "vllm-ascend@95f18abc:src/quant.py#L10-L11",
        "vllm-ascend@95f18abc:src/whole.py",
        rawRef,
        "https://docs.vllm.ai/en/latest/quantization.html",
        "unlisted-repo@12345678:src/custom.py#L1-L2",
        "vllm-ascend@95f18abc:src/quant.py#L0-L2",
      ],
      diagrams: [],
      entries: {
        "vllm-ascend@95f18abc:src/quant.py#L10-L11": {
          ref: "vllm-ascend@95f18abc:src/quant.py#L10-L11",
          kind: "repo",
          status: "ok",
          repo: "vllm-ascend",
          commit: "95f18abc",
          path: "src/quant.py",
          versionRefs: ["v0.26.0rc"],
          lineStart: 10,
          lineEnd: 11,
          totalLines: 120,
          lines: [
            { number: 10, text: 'x = "<script>window.__evil=1</script>"' },
            { number: 11, text: "return x" },
          ],
          externalHref: "https://github.com/vllm-project/vllm-ascend/blob/95f18abc/src/quant.py#L10-L11",
        },
        "vllm-ascend@95f18abc:src/whole.py": {
          ref: "vllm-ascend@95f18abc:src/whole.py",
          kind: "repo",
          status: "ok",
          repo: "vllm-ascend",
          commit: "95f18abc",
          path: "src/whole.py",
          versionRefs: ["v0.26.0rc"],
          lineStart: 1,
          lineEnd: 2,
          totalLines: 850,
          lines: [
            { number: 1, text: "# header" },
            { number: 2, text: "import torch" },
          ],
          externalHref: "https://github.com/vllm-project/vllm-ascend/blob/95f18abc/src/whole.py",
        },
        [rawRef]: {
          ref: rawRef,
          kind: "raw",
          status: "ok",
          path: `raw/sha256-${rawHash}.md`,
          lineStart: 2,
          lineEnd: 3,
          totalLines: 12,
          lines: [
            { number: 2, text: "<div>原文标签纯文本</div>" },
            { number: 3, text: "第三行" },
          ],
          rawViewerHref: `./wiki-raw/sha256-${rawHash}.html?lines=2-3#L2`,
        },
        "https://docs.vllm.ai/en/latest/quantization.html": {
          ref: "https://docs.vllm.ai/en/latest/quantization.html",
          kind: "url",
          status: "external",
          externalHref: "https://docs.vllm.ai/en/latest/quantization.html",
        },
        "unlisted-repo@12345678:src/custom.py#L1-L2": {
          ref: "unlisted-repo@12345678:src/custom.py#L1-L2",
          kind: "repo",
          status: "unavailable",
          reason: "unknown-repo",
          repo: "unlisted-repo",
          commit: "12345678",
          path: "src/custom.py",
          versionRefs: [],
          lineStart: 1,
          lineEnd: 2,
          externalHref: null,
        },
        "vllm-ascend@95f18abc:src/quant.py#L0-L2": {
          ref: "vllm-ascend@95f18abc:src/quant.py#L0-L2",
          kind: "repo",
          status: "unavailable",
          reason: "out-of-range",
          repo: "vllm-ascend",
          commit: "95f18abc",
          path: "src/quant.py",
          versionRefs: ["v0.26.0rc"],
          totalLines: 120,
          externalHref: "https://github.com/vllm-project/vllm-ascend/blob/95f18abc/src/quant.py",
        },
      },
    });
    const loadPageEvidence = vi.fn(() => {
      if (failOnce) {
        failOnce = false;
        return Promise.reject(new Error("离线证据读取失败"));
      }
      return Promise.resolve(pack);
    });
    const ctl = createEvidenceViewController({ loadPageEvidence });

    const idleHtml = renderToStaticMarkup(
      createElement(EvidencePane, { id: "wiki-panel-evidence", hidden: false, controller: ctl }),
    );
    expect(idleHtml).toContain('data-testid="evidence-empty"');

    await ctl.openForSource("quant-page", rev, 0);
    const errorHtml = renderToStaticMarkup(
      createElement(EvidencePane, { id: "wiki-panel-evidence", hidden: false, controller: ctl }),
    );
    expect(errorHtml).toContain('data-testid="evidence-error"');
    expect(errorHtml).toContain("离线证据读取失败");
    expect(errorHtml).toContain('data-testid="evidence-retry"');

    await ctl.retry();
    const repoOkHtml = renderToStaticMarkup(
      createElement(EvidencePane, { id: "wiki-panel-evidence", hidden: false, controller: ctl }),
    );
    expect(repoOkHtml).toContain("v0.26.0rc");
    expect(repoOkHtml).toContain("src/quant.py");
    expect(repoOkHtml).toContain("第 10–11 行（共 120 行）");
    expect(repoOkHtml).toContain("&lt;script&gt;window.__evil=1&lt;/script&gt;");
    expect(repoOkHtml).not.toContain("<script>window.__evil=1</script>");

    ctl.selectSource(1);
    const truncatedHtml = renderToStaticMarkup(
      createElement(EvidencePane, { id: "wiki-panel-evidence", hidden: false, controller: ctl }),
    );
    expect(truncatedHtml).toContain("显示前 1–2 行（共 850 行");
    expect(truncatedHtml).toContain("未指定行号范围");

    ctl.selectSource(3);
    const urlHtml = renderToStaticMarkup(
      createElement(EvidencePane, { id: "wiki-panel-evidence", hidden: false, controller: ctl }),
    );
    expect(urlHtml).toContain('data-testid="evidence-external"');
    expect(urlHtml).toContain("未保存其本地离线快照");

    ctl.selectSource(4);
    const unknownRepoHtml = renderToStaticMarkup(
      createElement(EvidencePane, { id: "wiki-panel-evidence", hidden: false, controller: ctl }),
    );
    expect(unknownRepoHtml).toContain('data-testid="evidence-unavailable"');
    expect(unknownRepoHtml).toContain("未在本地 seeds 配置中登记");

    ctl.selectSource(5);
    const outOfRangeHtml = renderToStaticMarkup(
      createElement(EvidencePane, { id: "wiki-panel-evidence", hidden: false, controller: ctl }),
    );
    expect(outOfRangeHtml).toContain("超出该固定版本文件的有效行范围");
    expect(outOfRangeHtml).toContain("vllm-ascend@95f18abc:src/quant.py#L0-L2");
  });

  it("正文角标与来源列表：未知仓库角标仍可激活证据面板，原外链保留，且关闭非问答页签不误停在途问答", () => {
    expect(shouldStopChatOnPanelClose("chat")).toBe(true);
    expect(shouldStopChatOnPanelClose("evidence")).toBe(false);
    expect(shouldStopChatOnPanelClose("review")).toBe(false);

    const page = {
      id: "sample",
      title: "样本",
      type: "concept" as const,
      summary: "摘要",
      file: "concepts/sample.md",
      sources: ["vllm-ascend@95f18abc:src/quant.py#L10-L11", "unlisted-repo@12345678:src/custom.py#L1-L2"],
      evidence: "C" as const,
      updated: "2026-11-16",
      aliases: [],
      chapters: [],
      relations: [],
      related: [],
      verified: ["releases/v0.26.0rc"],
      origin: "seed" as const,
      order: 0,
      prerequisites: [],
      contradicts: [],
      backlinks: [],
    };
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(Article, {
          page,
          body: "## 对照源码\n\n已知来源 [C1] 与未知仓库来源 [C2]。",
          diagrams: new Map(),
        }),
      ),
    );
    expect(html).toContain('class="wiki-mark-link"');
    expect(html).toContain('data-source="1"');
    expect(html).toContain('class="wiki-mark-btn"');
    expect(html).toContain('data-source="2"');
    expect(html).toContain('data-testid="source-item-open-1"');
    expect(html).toContain('data-testid="source-item-open-2"');
    expect(html).toContain('class="wiki-source-ext"');
  });

  it("图下「对照源码」、多 pin 精确范围切换、无 pins 诚实空态与未发布 Review 预览隔离边界", async () => {
    const diagramPack = readerPageEvidenceSchema.parse({
      version: 1,
      revision: rev,
      pageId: "quant-page",
      pageSources: ["vllm-ascend@db701c1f:src/w8a8.py#L1-L200"],
      diagrams: [
        {
          diagramId: "quant-pins",
          caption: "动态量化路径",
          pins: [
            {
              pinIndex: 0,
              ref: "vllm-ascend@db701c1f:src/w8a8.py#L61-L62",
              symbols: ["weight_scale", "weight_offset"],
            },
            {
              pinIndex: 1,
              ref: "vllm-ascend@db701c1f:src/w8a8.py#L75-L76",
              symbols: ["npu_dynamic_quant"],
            },
            {
              pinIndex: 2,
              ref: "vllm-ascend@db701c1f:src/w8a8.py#L75-L76",
              symbols: ["npu_quant_matmul"],
            },
          ],
        },
        {
          diagramId: "pure-concept",
          caption: "纯算术示意",
          pins: [],
        },
      ],
      entries: {
        "vllm-ascend@db701c1f:src/w8a8.py#L1-L200": {
          ref: "vllm-ascend@db701c1f:src/w8a8.py#L1-L200",
          kind: "repo",
          status: "ok",
          repo: "vllm-ascend",
          commit: "db701c1f",
          path: "src/w8a8.py",
          versionRefs: ["v0.26.0rc"],
          lineStart: 1,
          lineEnd: 2,
          totalLines: 200,
          lines: [
            { number: 1, text: "# coarse" },
            { number: 2, text: "# coarse 2" },
          ],
          externalHref: "https://github.com/vllm-project/vllm-ascend/blob/db701c1f/src/w8a8.py#L1-L200",
        },
        "vllm-ascend@db701c1f:src/w8a8.py#L61-L62": {
          ref: "vllm-ascend@db701c1f:src/w8a8.py#L61-L62",
          kind: "repo",
          status: "ok",
          repo: "vllm-ascend",
          commit: "db701c1f",
          path: "src/w8a8.py",
          versionRefs: ["v0.26.0rc"],
          lineStart: 61,
          lineEnd: 62,
          totalLines: 200,
          lines: [
            { number: 61, text: "self.weight_scale = scale" },
            { number: 62, text: "self.weight_offset = offset" },
          ],
          externalHref: "https://github.com/vllm-project/vllm-ascend/blob/db701c1f/src/w8a8.py#L61-L62",
        },
        "vllm-ascend@db701c1f:src/w8a8.py#L75-L76": {
          ref: "vllm-ascend@db701c1f:src/w8a8.py#L75-L76",
          kind: "repo",
          status: "ok",
          repo: "vllm-ascend",
          commit: "db701c1f",
          path: "src/w8a8.py",
          versionRefs: ["v0.26.0rc"],
          lineStart: 75,
          lineEnd: 76,
          totalLines: 200,
          lines: [
            { number: 75, text: "q = npu_dynamic_quant(x)" },
            { number: 76, text: "return npu_quant_matmul(q, w)" },
          ],
          externalHref: "https://github.com/vllm-project/vllm-ascend/blob/db701c1f/src/w8a8.py#L75-L76",
        },
      },
    });
    const loadEvidence = vi.fn(() => Promise.resolve(diagramPack));
    const ctl = createEvidenceViewController({ loadPageEvidence: loadEvidence });

    await ctl.openForDiagram("quant-page", rev, "quant-pins", 0);
    const pin0Html = renderToStaticMarkup(
      createElement(EvidencePane, { id: "wiki-panel-evidence", hidden: false, controller: ctl }),
    );
    expect(pin0Html).toContain('data-testid="evidence-pin-0"');
    expect(pin0Html).toContain('data-testid="evidence-pin-2"');
    expect(pin0Html).toContain('data-testid="evidence-pin-symbols"');
    expect(pin0Html).toContain("weight_scale、weight_offset");
    expect(pin0Html).toContain("第 61–62 行（共 200 行）");
    expect(pin0Html).not.toContain("# coarse");

    ctl.selectPin(2);
    const pin2Html = renderToStaticMarkup(
      createElement(EvidencePane, { id: "wiki-panel-evidence", hidden: false, controller: ctl }),
    );
    expect(pin2Html).toContain("npu_quant_matmul");
    expect(pin2Html).toContain("第 75–76 行（共 200 行）");
    expect(loadEvidence).toHaveBeenCalledTimes(1);

    await ctl.openForDiagram("quant-page", rev, "pure-concept", 0);
    const emptyPinsHtml = renderToStaticMarkup(
      createElement(EvidencePane, { id: "wiki-panel-evidence", hidden: false, controller: ctl }),
    );
    expect(emptyPinsHtml).toContain('data-testid="evidence-diagram-empty"');
    expect(emptyPinsHtml).toContain("未绑定源码符号定位");
    expect(loadEvidence).toHaveBeenCalledTimes(1);

    const minSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 40"><title>测试图</title><rect x="2" y="2" width="40" height="20" fill="#087f73"/></svg>';
    const g = globalThis as unknown as Record<string, unknown>;
    const saved = {
      Node: g.Node,
      DOMParser: g.DOMParser,
      document: g.document,
      XMLSerializer: g.XMLSerializer,
    };
    class MiniNode {
      static readonly ELEMENT_NODE = 1;
      static readonly TEXT_NODE = 3;
      nodeType = 1;
      tagName = "svg";
      attributes: { name: string; value: string }[] = [];
      childNodes: unknown[] = [];
      setAttribute(name: string, value: string) {
        this.attributes.push({ name, value });
      }
      appendChild(child: unknown) {
        this.childNodes.push(child);
        return child;
      }
    }
    g.Node = MiniNode;
    g.DOMParser = class {
      parseFromString() {
        const root = new MiniNode();
        root.attributes.push({ name: "viewBox", value: "0 0 80 40" });
        return { documentElement: root, getElementsByTagName: () => ({ length: 0 }) };
      }
    };
    g.document = {
      implementation: {
        createDocument: () => ({
          documentElement: new MiniNode(),
          createElementNS: (_ns: string, tag: string) => {
            const el = new MiniNode();
            el.tagName = tag;
            return el;
          },
          createTextNode: (t: string) => Object.assign(new MiniNode(), { nodeType: 3, nodeValue: t }),
          getElementsByTagName: () => ({ length: 0 }),
        }),
      },
    };
    g.XMLSerializer = class {
      serializeToString() {
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 40"/>';
      }
    };

    try {
      const page = {
        id: "sample",
        title: "样本",
        type: "concept" as const,
        summary: "摘要",
        file: "concepts/sample.md",
        sources: ["vllm-ascend@db701c1f:src/w8a8.py#L1-L200"],
        evidence: "C" as const,
        updated: "2026-11-16",
        aliases: [],
        chapters: [],
        relations: [],
        related: [],
        verified: ["releases/v0.26.0rc"],
        origin: "seed" as const,
        order: 0,
        prerequisites: [],
        contradicts: [],
        backlinks: [],
      };
      const wiredArticleHtml = renderToStaticMarkup(
        createElement(
          MemoryRouter,
          null,
          createElement(Article, {
            page,
            body: "```wiki-diagram\nfile: quant-pins\n```",
            diagrams: new Map([["quant-pins", minSvg]]),
            onOpenDiagram: () => {},
          }),
        ),
      );
      expect(wiredArticleHtml).toContain('data-testid="diagram-evidence-quant-pins"');

      const reviewPreviewHtml = renderToStaticMarkup(
        createElement(ReviewSvgAssets, {
          writes: [{ path: "wiki/diagrams/quant-pins.svg", before: null, after: minSvg }],
        }),
      );
      expect(reviewPreviewHtml).not.toContain("diagram-evidence-");
      expect(reviewPreviewHtml).not.toContain("对照源码");
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete g[k];
        else g[k] = v;
      }
    }
  });
});
