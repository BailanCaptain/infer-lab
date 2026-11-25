import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown, { type Components } from "react-markdown";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { compileMarkdown } from "../../../scripts/wiki/compile-markdown";
import { createWikiRehypePlugins, WIKI_REMARK_PLUGINS } from "../../content/wiki/markdown";
import type { CompiledNode, RegistryEntry } from "../../content/wiki/schema";
import {
  CompiledHastView,
  createWikiMarkdownComponents,
  DiagramEvidenceContext,
  DiagramPageContext,
  DiagramSnapshot,
  extractSingleVllmServeFenceCommand,
  parseInlineStyle,
  sanitizeHastUrl,
} from "./CompiledHastView";

function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === "object") {
    Object.freeze(obj);
    for (const val of Object.values(obj as Record<string, unknown>)) {
      deepFreeze(val);
    }
  }
  return obj;
}

const samplePage: RegistryEntry = {
  id: "quantization",
  title: "量化基础",
  type: "concept",
  origin: "seed",
  summary: "量化基础测试页",
  aliases: [],
  chapters: ["06"],
  order: 500,
  prerequisites: [],
  sources: [
    "vllm-ascend@95f18abc:src/quant.py#L10-L11",
    "unlisted-repo@12345678:src/custom.py#L1-L2",
    "https://docs.vllm.ai/en/latest/quantization.html",
  ],
  verified: [],
  evidence: "C",
  relations: [],
  related: [],
  contradicts: [],
  updated: "2026-11-24",
  file: "concepts/quantization.md",
  backlinks: [],
  legacyAnchors: {
    "old-section-anchor": "公式与源码核验-c1",
  },
};

describe("CompiledHastView direct HAST renderer", () => {
  it("与原 ReactMarkdown 管线的 renderToStaticMarkup HTML 输出 100% 字节级一致，且对只读冻结树零修改", () => {
    const markdown = [
      "## 公式与源码核验 [C1]",
      "",
      "正文含未知仓库角标 [C2]、外链角标 [S3] 与无编号角标 [D]，以及专名 GLM-5.3-Flash。",
      "",
      "超长标识符插 `<wbr>`：`vllm_ascend/worker/model_runner_v1_with_extra_long_identifier_name.py#L120-L188`。",
      "",
      '链接与图片：[相对知识页](../params/size-40a1c2ca47b8.md#锚点)、[显式标题相对页](../concepts/kv-cache.md "KV 缓存说明")、[页内锚点](#公式与源码核验)、[外链](https://example.com/doc "外部参考文档")、![示意图](./img/arch.png)。',
      "",
      "正文脚注引用[^1]。",
      "",
      "[^1]: 脚注详细解释内容。",
      "",
      "行内公式 $y = \\mathrm{RMSNorm}(x) \\cdot W_q$ 与复杂块级公式（含 `<svg>` 根号、内联 `style`、MathML 属性）：",
      "",
      "$$",
      "\\mathrm{Attention}(Q, K, V) = \\mathrm{softmax}\\left(\\frac{QK^\\top}{\\sqrt{d_k}}\\right)V + \\sum_{i=1}^{N} \\sqrt[3]{x_i^2 + 1}",
      "$$",
      "",
      "| 阶段 | 对齐数值 | 说明 |",
      "| :--- | ---: | :---: |",
      "| Prefill | 1024 | 吞吐优先 |",
      "| Decode | 32 | 时延敏感 |",
      "",
      "```text",
      "张量快照 → [B, S, H]  汉字等宽",
      "```",
      "",
      "```calc",
      "title: 显存估算",
      "权重显存 = 14 * 2 = 28 GB",
      "KV 预算 = 64 - 28 = 36 GB",
      "```",
      "",
      "```wiki-tool",
      "tool: aicore-lab",
      "mode: single",
      "```",
      "",
      "```python",
      "def quantize(x):",
      "    return x",
      "```",
      "",
      "- [x] 已完成",
      "- [ ] 未完成",
      "",
      "内联 HTML：<br> 保持转义文本。",
      "",
      "## 对照源码",
      "",
      "折叠详情区 [C1]。",
    ].join("\n");

    const compiled = deepFreeze(compileMarkdown(markdown, samplePage.legacyAnchors) as CompiledNode);
    const diagrams = new Map<string, string>();

    const wrapProviders = (child: React.ReactElement) =>
      createElement(
        MemoryRouter,
        null,
        createElement(
          DiagramPageContext.Provider,
          { value: samplePage.id },
          createElement(
            DiagramEvidenceContext.Provider,
            { value: undefined },
            createElement(DiagramSnapshot.Provider, { value: diagrams }, child),
          ),
        ),
      );

    const directHtml = renderToStaticMarkup(
      wrapProviders(
        createElement(CompiledHastView, {
          root: compiled,
          page: samplePage,
        }),
      ),
    );

    const legacyHtml = renderToStaticMarkup(
      wrapProviders(
        createElement(
          ReactMarkdown,
          {
            remarkPlugins: WIKI_REMARK_PLUGINS,
            rehypePlugins: createWikiRehypePlugins(samplePage.legacyAnchors),
            components: createWikiMarkdownComponents(samplePage) as Components,
          },
          markdown,
        ),
      ),
    );

    expect(directHtml).toBe(legacyHtml);
    expect(directHtml).toContain('class="katex-html"');
    expect(directHtml).toContain("<svg");
    expect(directHtml).toContain("viewBox=");
    expect(directHtml).toContain("preserveAspectRatio=");
    expect(directHtml).toContain('class="wiki-mark-link"');
    expect(directHtml).toContain('class="wiki-mark-btn"');
    expect(directHtml).toContain('class="wiki-table-scroll"');
    expect(directHtml).toContain('data-testid="wiki-tool-aicore-lab"');
    expect(directHtml).toContain('data-testid="wiki-source-check"');
    expect(directHtml).toContain('id="old-section-anchor"');
    expect(directHtml).toContain('id="user-content-fnref-1"');
    expect(directHtml).toContain("data-footnote-ref");
    expect(directHtml).toContain('aria-describedby="footnote-label"');
    expect(directHtml).toContain("data-footnote-backref");
    expect(directHtml).toContain('aria-label="Back to reference 1"');
    expect(directHtml).toContain("#user-content-fnref-1");
    expect(directHtml).toContain('title="外部参考文档"');
    expect(directHtml).toContain('title="KV 缓存说明"');
  });

  it("严格拦截 javascript:/data:/vbscript: 危险协议并放行安全协议与相对路径", () => {
    expect(sanitizeHastUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(sanitizeHastUrl("http://example.com/a")).toBe("http://example.com/a");
    expect(sanitizeHastUrl("mailto:user@example.com")).toBe("mailto:user@example.com");
    expect(sanitizeHastUrl("tel:+8610000")).toBe("tel:+8610000");
    expect(sanitizeHastUrl("/wiki/kv-cache")).toBe("/wiki/kv-cache");
    expect(sanitizeHastUrl("./wiki-raw/sha256-a.html?x=1:2")).toBe("./wiki-raw/sha256-a.html?x=1:2");
    expect(sanitizeHastUrl("../concepts/a.md#sec:1")).toBe("../concepts/a.md#sec:1");
    expect(sanitizeHastUrl("#anchor:colon")).toBe("#anchor:colon");

    expect(sanitizeHastUrl("javascript:alert(1)")).toBe("");
    expect(sanitizeHastUrl("  JaVaScRiPt:alert(1)")).toBe("");
    expect(sanitizeHastUrl("java\nscript:alert(1)")).toBe("");
    expect(sanitizeHastUrl("data:text/html,<script>alert(1)</script>")).toBe("");
    expect(sanitizeHastUrl("vbscript:msgbox(1)")).toBe("");

    const maliciousTree: CompiledNode = deepFreeze({
      type: "root",
      children: [
        {
          type: "element",
          tagName: "p",
          properties: {},
          children: [
            {
              type: "element",
              tagName: "a",
              properties: { href: "javascript:alert(1)" },
              children: [{ type: "text", value: "bad link" }],
            },
            {
              type: "element",
              tagName: "img",
              properties: { src: "data:image/svg+xml,<svg onload=alert(1)>", alt: "bad img" },
              children: [],
            },
          ],
        },
      ],
    });

    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(CompiledHastView, { root: maliciousTree, page: samplePage }),
      ),
    );
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("data:image");
    expect(html).toContain('<a href="">bad link</a>');
    expect(html).toContain('<img alt="bad img" decoding="async"');
  });

  it("正确解析内联 CSS style 字符串（含自定义属性、厂商前缀与括号分号）", () => {
    expect(
      parseInlineStyle(
        "height:0.75em; vertical-align:-0.25em; --custom-gap: 8px; -webkit-transform: scale(1); -ms-flex: 1; background-image: url('a;b.png');",
      ),
    ).toEqual({
      height: "0.75em",
      verticalAlign: "-0.25em",
      "--custom-gap": "8px",
      WebkitTransform: "scale(1)",
      msFlex: "1",
      backgroundImage: "url('a;b.png')",
    });
  });

  it("活代码块单命令门禁：普通围栏渲染复制按钮；仅唯一合法 vllm serve 围栏暴露「送去体检」，严格拒绝多命令与 <model> 占位符", async () => {
    const singleServeCmd = [
      "# 单机四卡启动 Qwen3-30B-A3B",
      "export ASCEND_RT_VISIBLE_DEVICES=0,1,2,3",
      "export HCCL_BUFFSIZE=1024",
      "vllm serve /root/.cache/Qwen3-30B-A3B-W8A8 \\",
      "    --served-model-name qwen3-30b-a3b \\",
      "    --tensor-parallel-size 4 \\",
      "    --enable-expert-parallel",
    ].join("\n");

    const extracted = extractSingleVllmServeFenceCommand(singleServeCmd, "bash");
    expect(extracted).not.toBeNull();
    expect(extracted).toContain("export ASCEND_RT_VISIBLE_DEVICES=0,1,2,3");
    expect(extracted).toContain("export HCCL_BUFFSIZE=1024");
    expect(extracted).toContain("vllm serve /root/.cache/Qwen3-30B-A3B-W8A8 \\\n");
    expect(extracted).toContain("--enable-expert-parallel");

    // Reject multi-command fences (like ascend-env-and-serve.md A/B/C templates)
    const multiServeFence = [
      "export ASCEND_RT_VISIBLE_DEVICES=0",
      "vllm serve /root/.cache/Qwen3-8B --max-model-len 8192",
      "export ASCEND_RT_VISIBLE_DEVICES=0,1,2,3",
      "vllm serve /root/.cache/Qwen3-30B-A3B-W8A8 --tensor-parallel-size 4 --enable-expert-parallel",
    ].join("\n");
    expect(extractSingleVllmServeFenceCommand(multiServeFence, "bash")).toBeNull();

    // Reject placeholder <model> / angle-bracket / ellipsis / undefined env var / non-shell language
    expect(
      extractSingleVllmServeFenceCommand("vllm serve <model> --tensor-parallel-size 2", "bash"),
    ).toBeNull();
    expect(
      extractSingleVllmServeFenceCommand("vllm serve /path/to/<your-model> --max-model-len 8192", "bash"),
    ).toBeNull();
    expect(extractSingleVllmServeFenceCommand("vllm serve ... -tp 2", "bash")).toBeNull();
    expect(extractSingleVllmServeFenceCommand("vllm serve $UNSET_MODEL -tp 2", "bash")).toBeNull();
    const literalShellBraceVar = `\${${"MODEL_PATH"}}`;
    expect(
      extractSingleVllmServeFenceCommand(`vllm serve /models/${literalShellBraceVar} -tp 2`, "bash"),
    ).toBeNull();
    expect(
      extractSingleVllmServeFenceCommand(
        `export MODEL_PATH=/data/Qwen3-8B\nvllm serve "${literalShellBraceVar}" -tp 2`,
        "bash",
      ),
    ).toBeNull();
    expect(
      extractSingleVllmServeFenceCommand("cd /models\nvllm serve Qwen/Qwen3-8B -tp 2", "bash"),
    ).toBeNull();
    expect(
      extractSingleVllmServeFenceCommand("vllm serve Qwen/Qwen3-8B -tp 2\necho ready", "bash"),
    ).toBeNull();
    expect(
      extractSingleVllmServeFenceCommand("vllm serve Qwen/Qwen3-8B -tp 2 | tee serve.log", "bash"),
    ).toBeNull();
    expect(extractSingleVllmServeFenceCommand("vllm serve Qwen/Qwen3-8B -tp 2 &", "bash")).toBeNull();
    expect(
      extractSingleVllmServeFenceCommand("export FOO=1 && vllm serve Qwen/Qwen3-8B -tp 2", "bash"),
    ).toBeNull();
    expect(extractSingleVllmServeFenceCommand("vllm serve Qwen/Qwen3-8B -tp 2 || true", "bash")).toBeNull();
    expect(
      extractSingleVllmServeFenceCommand("export FOO=1; vllm serve Qwen/Qwen3-8B -tp 2", "bash"),
    ).toBeNull();
    // Trailing whitespace after `\` line continuation breaks bash continuation -> must reject
    expect(extractSingleVllmServeFenceCommand("vllm serve Qwen/Qwen3-8B \\   \n  -tp 2", "bash")).toBeNull();
    expect(extractSingleVllmServeFenceCommand("# vllm serve comment only\necho ok", "bash")).toBeNull();
    expect(extractSingleVllmServeFenceCommand('cmd = "vllm serve Qwen/Qwen3-8B -tp 2"', "python")).toBeNull();

    // Leading whitespace text node inside <pre>\n<code>...</code></pre> still locates <code> and renders both Copy & Doctor buttons
    const preWithLeadingNewlineTree: CompiledNode = deepFreeze({
      type: "root",
      children: [
        {
          type: "element",
          tagName: "pre",
          properties: {},
          children: [
            { type: "text", value: "\n" },
            {
              type: "element",
              tagName: "code",
              properties: { className: ["language-bash"] },
              children: [{ type: "text", value: "vllm serve Qwen/Qwen3-8B -tp 2\n" }],
            },
          ],
        },
      ],
    });
    const preWhitespaceHtml = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(CompiledHastView, { root: preWithLeadingNewlineTree, page: samplePage }),
      ),
    );
    expect(preWhitespaceHtml).toContain('data-testid="wiki-code-copy-btn"');
    expect(preWhitespaceHtml).toContain('data-testid="wiki-code-doctor-btn"');
    expect(preWhitespaceHtml).toContain('data-testid="wiki-code-3d-btn"');

    // Render full markdown mixing implicit-quant single-serve, unambiguous single-serve, multi-serve, placeholder, and calc fences
    const mixedMd = [
      "```bash",
      singleServeCmd,
      "```",
      "",
      "```bash",
      "vllm serve Qwen/Qwen3-8B --tensor-parallel-size 2",
      "```",
      "",
      "```bash",
      multiServeFence,
      "```",
      "",
      "```bash",
      "vllm serve <model> --tensor-parallel-size 2",
      "```",
      "",
      "```calc",
      "权重显存 = 8 * 2 = 16 GB",
      "```",
    ].join("\n");

    const compiled = deepFreeze(compileMarkdown(mixedMd) as CompiledNode);
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(
          DiagramPageContext.Provider,
          { value: "ascend-env-and-serve" },
          createElement(CompiledHastView, { root: compiled, page: samplePage }),
        ),
      ),
    );

    // 4 fallback code blocks -> 4 copy buttons, 2 doctor handoff buttons, and ONLY 1 3D sharding button (implicit -W8A8 without --quantization goes to Doctor only!)
    expect(html.match(/data-testid="wiki-code-copy-btn"/g)?.length).toBe(4);
    expect(html.match(/data-testid="wiki-code-doctor-btn"/g)?.length).toBe(2);
    expect(html.match(/data-testid="wiki-code-3d-btn"/g)?.length).toBe(1);
    // Calc fence untouched
    expect(html).toContain('class="wiki-calc"');

    // main-only param examples infer version="main" and IPv6 addresses are redacted in share links
    const { inferFenceRuleVersion } = await import("./CompiledHastView");
    const { sanitizeDiagnosticText } = await import("../tools/workbenchHandoff");
    expect(
      inferFenceRuleVersion(
        'vllm serve /models/Qwen3-32B -tp 8 --additional-config \'{"quantized_all_reduce_config":{"enable":true}}\'',
        "quantized-all-reduce-config-3cc69e492011",
      ),
    ).toBe("main");
    const ipv6Check = sanitizeDiagnosticText(
      "2026-11-26 10:12:35 c10::Error::Error --host 2001:db8::1 --endpoint [fe80::1]:29661",
    );
    expect(ipv6Check.sanitized).toContain("10:12:35");
    expect(ipv6Check.sanitized).toContain("c10::Error::Error");
    expect(ipv6Check.sanitized).not.toContain("2001:db8::1");
    expect(ipv6Check.sanitized).not.toContain("fe80::1");
    expect(ipv6Check.sanitized).toContain("<REDACTED_IP>");
    expect(ipv6Check.sanitized).toContain("[<REDACTED_IP>]:29661");
  });
});
