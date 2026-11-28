import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import APPROVED_SVG from "../../../wiki/diagrams/quantization-intuition.svg?raw";
import {
  ACL_CAPTURE_MODES,
  AclGraphModeInteractive,
  computeAclGraphRemediation,
  computeAclGraphSandboxState,
} from "./AclGraphModeInteractive";
import {
  CHUNKED_BUDGET_OPTIONS,
  ChunkedPrefillInteractive,
  computeChunkedPrefillPlan,
  DECODE_CONCURRENCY_OPTIONS,
} from "./ChunkedPrefillInteractive";
import { decodeXmlEntities, sanitizeDiagram } from "./diagram-sanitize";
import {
  ACL_GRAPH_MODE_BUDGET_APPROVED_SHA256,
  ASCEND_FA_HBM_VS_TILING_APPROVED_SHA256,
  CHUNKED_PREFILL_BUDGET_GAME_APPROVED_SHA256,
  COLL_COMM_FIG_HCCS_VS_ROCE_APPROVED_SHA256,
  CONTEXT_PARALLEL_FIG_INTERLEAVE_SLOTS_APPROVED_SHA256,
  CONTINUOUS_BATCHING_TWO_QUEUES_TRACE_APPROVED_SHA256,
  DP_FIG_DUMMY_AND_EXCLUSION_APPROVED_SHA256,
  ENGRAM_FIG_LOOKUP_FLOW_APPROVED_SHA256,
  EPLB_CYCLE_APPROVED_SHA256,
  GQA_FIG_SHARED_KV_COST_SPLIT_APPROVED_SHA256,
  HCCL_BUFFER_FIG_DOMAIN_LEDGER_APPROVED_SHA256,
  LOW_PREC_FIG_BIT_ANATOMY_APPROVED_SHA256,
  MEM_PROF_FIG_QWEN3_WATERFALL_APPROVED_SHA256,
  MLA_INTUITION_APPROVED_SHA256,
  MOE_DISPATCH_FIG_STATE_MACHINE_APPROVED_SHA256,
  MOE_ROUTER_CALC_QWEN3_APPROVED_SHA256,
  MOONCAKE_CONNECTOR_APPROVED_SHA256,
  ONBOARDING_FOUR_GATES_APPROVED_SHA256,
  PAGED_ATTENTION_FIG_WASTE_VS_PAGING_APPROVED_SHA256,
  PD_DISAGGREGATION_INTUITION_APPROVED_SHA256,
  PREFILL_FIG_COMPUTE_VS_BW_APPROVED_SHA256,
  PREFIX_CACHING_APPROVED_SHA256,
  QUANTIZATION_INTUITION_APPROVED_SHA256,
  REQUEST_FIG_CAUSAL_KV_MLP_APPROVED_SHA256,
  RFORK_ROUTE_AND_FALLBACK_APPROVED_SHA256,
  RFORK_TROUBLESHOOTING_APPROVED_SHA256,
  ROOFLINE_MATMUL_INTENSITY_APPROVED_SHA256,
  registeredInteractiveDiagramIds,
  resolveInteractiveDiagram,
  SPECULATIVE_DECODING_APPROVED_SHA256,
  sha256Hex,
  TENSOR_LAYOUT_FIG_ND_NZ_CUBE_APPROVED_SHA256,
  TENSOR_PARALLEL_TWO_SPLITS_APPROVED_SHA256,
  TOKEN_BPE_APPROVED_SHA256,
  V030_MIG_FIG_CHECKLIST_APPROVED_SHA256,
  WORKER_LIFECYCLE_APPROVED_SHA256,
} from "./interactive-diagrams";
import { PREFIX_CACHING_STEPS, PrefixCachingInteractive } from "./PrefixCachingInteractive";
import { RFORK_SCENARIOS, RforkFallbackInteractive } from "./RforkFallbackInteractive";
import { WikiDiagram } from "./WikiDiagram";

interface MiniAttr {
  name: string;
  value: string;
}

abstract class MiniNode {
  static readonly ELEMENT_NODE = 1;
  static readonly TEXT_NODE = 3;
  static readonly CDATA_SECTION_NODE = 4;
  abstract readonly nodeType: number;
}

class MiniText extends MiniNode {
  readonly nodeType = 3;
  constructor(public readonly nodeValue: string) {
    super();
  }
}

class MiniCdata extends MiniNode {
  readonly nodeType = 4;
  constructor(public readonly nodeValue: string) {
    super();
  }
}

class MiniElement extends MiniNode {
  readonly nodeType = 1;
  readonly nodeValue = null;
  readonly attributes: MiniAttr[] = [];
  readonly childNodes: Array<MiniElement | MiniText | MiniCdata> = [];
  constructor(public readonly tagName: string) {
    super();
  }
  setAttribute(name: string, value: string): void {
    const existing = this.attributes.find((a) => a.name === name);
    if (existing) existing.value = value;
    else this.attributes.push({ name, value });
  }
  appendChild(child: MiniElement | MiniText | MiniCdata): MiniElement | MiniText | MiniCdata {
    this.childNodes.push(child);
    return child;
  }
}

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function serializeMini(el: MiniElement): string {
  const attrs = el.attributes.map((a) => ` ${a.name}="${escapeXml(a.value)}"`).join("");
  if (el.childNodes.length === 0) return `<${el.tagName}${attrs}/>`;
  const inner = el.childNodes
    .map((child) =>
      child instanceof MiniText || child instanceof MiniCdata
        ? escapeXml(child.nodeValue)
        : serializeMini(child),
    )
    .join("");
  return `<${el.tagName}${attrs}>${inner}</${el.tagName}>`;
}

function parseSimpleXml(xml: string): MiniElement {
  const rootHolder = new MiniElement("holder");
  const stack: MiniElement[] = [rootHolder];
  const tokenRe =
    /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([A-Za-z0-9:_-]+)([^>]*?)(\/?)>|([^<]+)/g;
  let match: RegExpExecArray | null = tokenRe.exec(xml);
  while (match) {
    const [full, cdataText, closing, tag, attrText, selfClosing, rawText] = match;
    const current = stack[stack.length - 1]!;
    if (!full.startsWith("<!--") && !full.startsWith("<?")) {
      if (cdataText !== undefined) {
        current.appendChild(new MiniCdata(cdataText));
      } else if (rawText !== undefined) {
        if (stack.length > 1 || rawText.trim()) current.appendChild(new MiniText(decodeXmlEntities(rawText)));
      } else if (closing) {
        if (stack.length > 1) stack.pop();
      } else if (tag) {
        const el = new MiniElement(tag);
        const attrRe = /([A-Za-z0-9:_-]+)="([^"]*)"/g;
        let am: RegExpExecArray | null = attrRe.exec(attrText ?? "");
        while (am) {
          if (am[1] !== undefined && am[2] !== undefined) {
            el.setAttribute(am[1], decodeXmlEntities(am[2].replace(/[\r\n\t]/g, " ")));
          }
          am = attrRe.exec(attrText ?? "");
        }
        current.appendChild(el);
        if (!selfClosing) stack.push(el);
      }
    }
    match = tokenRe.exec(xml);
  }
  const first = rootHolder.childNodes.find((c): c is MiniElement => c instanceof MiniElement);
  return first ?? new MiniElement("invalid");
}

const savedGlobals: Record<string, unknown> = {};

beforeAll(() => {
  const g = globalThis as unknown as Record<string, unknown>;
  for (const key of ["Node", "DOMParser", "document", "XMLSerializer"]) savedGlobals[key] = g[key];
  g.Node = MiniNode;
  g.DOMParser = class {
    parseFromString(source: string) {
      const root = parseSimpleXml(source.startsWith("\uFEFF") ? source.slice(1) : source);
      return {
        documentElement: root,
        getElementsByTagName: () => ({ length: 0 }),
      };
    }
  };
  g.document = {
    implementation: {
      createDocument(_ns: string, qn: string) {
        const root = new MiniElement(qn);
        return {
          documentElement: root,
          createElementNS: (_childNs: string, tag: string) => new MiniElement(tag),
          createTextNode: (text: string) => new MiniText(text),
          getElementsByTagName: () => ({ length: 0 }),
        };
      },
    },
  };
  g.XMLSerializer = class {
    serializeToString(el: MiniElement) {
      return serializeMini(el);
    }
  };
});

afterAll(() => {
  const g = globalThis as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(savedGlobals)) {
    if (value === undefined) delete g[key];
    else g[key] = value;
  }
});

describe("人工静态白名单交互式 React 2D 注册表与版本绑定", () => {
  it("纯 TS 同步 sha256Hex 与标准 Web Crypto SHA-256 完全一致，并锁定审定 quantization-intuition.svg 指纹", async () => {
    for (const sample of [
      "",
      "a",
      "a".repeat(55),
      "a".repeat(56),
      "a".repeat(64),
      "a".repeat(65),
      "普通动态 W8A8 Linear 🔍🧪🚀",
      APPROVED_SVG,
    ]) {
      const digestBuf = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(sample));
      const expected = Array.from(new Uint8Array(digestBuf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      expect(sha256Hex(sample)).toBe(expected);
    }
    expect(sha256Hex(APPROVED_SVG.replace(/\r\n/g, "\n"))).toBe(QUANTIZATION_INTUITION_APPROVED_SHA256);
    expect(registeredInteractiveDiagramIds()).toEqual([
      "quantization-intuition",
      "prefix-caching",
      "chunked-prefill-fig-budget-game",
      "acl-graph-fig-mode-budget",
      "rfork-fig-route-and-fallback",
      "request-fig-causal-kv-mlp",
      "token-bpe",
      "gqa-fig-shared-kv-cost-split",
      "moe-router-calc-qwen3",
      "continuous-batching-two-queues-trace",
      "paged-attention-fig-waste-vs-paging",
      "mla-intuition",
      "speculative-decoding",
      "roofline-matmul-intensity",
      "ascend-fa-hbm-vs-tiling",
      "eplb-cycle",
      "mooncake-connector",
      "worker-lifecycle",
      "mem-prof-fig-qwen3-waterfall",
      "v030-mig-fig-checklist",
      "rfork-troubleshooting",
      "prefill-fig-compute-vs-bw",
      "low-prec-fig-bit-anatomy",
      "onboarding-four-gates",
      "tensor-layout-fig-nd-nz-cube",
      "engram-fig-lookup-flow",
      "pd-disaggregation-intuition",
      "moe-dispatch-fig-state-machine",
      "coll-comm-fig-hccs-vs-roce",
      "hccl-buffer-fig-domain-ledger",
      "tensor-parallel-two-splits",
      "context-parallel-fig-interleave-slots",
      "dp-fig-dummy-and-exclusion",
    ]);
  });

  it("拒绝未知图 ID、非 kebab-case 路径与 Object.prototype 同名属性，绝不回落到原型对象", () => {
    for (const badId of [
      "unknown-diagram",
      "paged-attention",
      "../quantization-intuition",
      "Quantization-Intuition",
      "constructor",
      "toString",
      "__proto__",
      "valueOf",
      "hasOwnProperty",
      "isPrototypeOf",
      "propertyIsEnumerable",
      "toLocaleString",
    ]) {
      expect(
        resolveInteractiveDiagram({ id: badId, svg: APPROVED_SVG, allowInteractive: true }),
        `badId=${badId}`,
      ).toBeNull();
    }
  });

  it("allowInteractive 默认关闭；Review/候选预览与 live SVG 字节变化均自动回退真实静态清洗 SVG", () => {
    // 1) 未显式开启 allowInteractive（如 ReviewPane / 未发布预览）-> 静态渲染
    const previewHtml = renderToStaticMarkup(
      createElement(WikiDiagram, { id: "quantization-intuition", svg: APPROVED_SVG }),
    );
    expect(previewHtml).not.toContain('data-interactive="true"');
    expect(previewHtml).not.toContain("wiki-diagram-toolbar");
    expect(previewHtml).toContain("离线做一次：权重压成 INT8");

    // 2) 显式开启 allowInteractive 且匹配审定 SHA-256 -> 挂载四步交互外壳，默认静态总览
    const formalHtml = renderToStaticMarkup(
      createElement(WikiDiagram, {
        id: "quantization-intuition",
        svg: APPROVED_SVG.replace(/\n/g, "\r\n"),
        allowInteractive: true,
        onOpenEvidence: () => {},
      }),
    );
    expect(formalHtml).toContain('data-interactive="true"');
    expect(formalHtml).toContain('data-mode="overview"');
    expect(formalHtml).toContain('data-step="0"');
    expect(formalHtml).toContain("静态总览");
    expect(formalHtml).toContain("手动分步");
    expect(formalHtml).toContain('data-testid="diagram-evidence-quantization-intuition"');
    expect(formalHtml).not.toContain("-77");
    expect(formalHtml).not.toContain("127, -45");
    expect(formalHtml).not.toContain("—");

    // 3) 同 ID 的 live SVG 已改变（哪怕仅修改一处文案或几何）-> 自动回退展示新静态图，绝不遮盖新内容
    const liveChangedSvg = APPROVED_SVG.replace("BF16：每个数 2 字节", "LIVE_UPDATED_BF16_LABEL");
    expect(
      resolveInteractiveDiagram({
        id: "quantization-intuition",
        svg: liveChangedSvg,
        allowInteractive: true,
      }),
    ).toBeNull();
    const fallbackHtml = renderToStaticMarkup(
      createElement(WikiDiagram, {
        id: "quantization-intuition",
        svg: liveChangedSvg,
        allowInteractive: true,
      }),
    );
    expect(fallbackHtml).not.toContain('data-interactive="true"');
    expect(fallbackHtml).not.toContain("wiki-diagram-toolbar");
    expect(fallbackHtml).toContain("LIVE_UPDATED_BF16_LABEL");
  });

  it("同页双实例交互式 WikiDiagram 仍经过共用 sanitizeDiagram 清洗并按实例隔离内部 marker id", () => {
    const dualHtml = renderToStaticMarkup(
      createElement(
        "div",
        null,
        createElement(WikiDiagram, {
          id: "quantization-intuition",
          svg: APPROVED_SVG,
          allowInteractive: true,
        }),
        createElement(WikiDiagram, {
          id: "quantization-intuition",
          svg: APPROVED_SVG,
          allowInteractive: true,
        }),
      ),
    );
    const markerIds = [...dualHtml.matchAll(/<marker[^>]*\bid="([^"]+)"/g)].map((m) => m[1]!);
    expect(markerIds).toHaveLength(4);
    expect(new Set(markerIds).size).toBe(4);
    expect(dualHtml).not.toContain('id="quantization-intuition-ah-ink"');
  });

  it("全部 21 张已注册图逐一读取真实 SVG（CRLF→LF 归一）：正式态命中、审阅态返回 null、1 字节改动严格回退静态 SVG", () => {
    const cases = [
      { id: "quantization-intuition", sha: QUANTIZATION_INTUITION_APPROVED_SHA256 },
      { id: "prefix-caching", sha: PREFIX_CACHING_APPROVED_SHA256 },
      { id: "chunked-prefill-fig-budget-game", sha: CHUNKED_PREFILL_BUDGET_GAME_APPROVED_SHA256 },
      { id: "acl-graph-fig-mode-budget", sha: ACL_GRAPH_MODE_BUDGET_APPROVED_SHA256 },
      { id: "rfork-fig-route-and-fallback", sha: RFORK_ROUTE_AND_FALLBACK_APPROVED_SHA256 },
      { id: "request-fig-causal-kv-mlp", sha: REQUEST_FIG_CAUSAL_KV_MLP_APPROVED_SHA256 },
      { id: "token-bpe", sha: TOKEN_BPE_APPROVED_SHA256 },
      { id: "gqa-fig-shared-kv-cost-split", sha: GQA_FIG_SHARED_KV_COST_SPLIT_APPROVED_SHA256 },
      { id: "moe-router-calc-qwen3", sha: MOE_ROUTER_CALC_QWEN3_APPROVED_SHA256 },
      {
        id: "continuous-batching-two-queues-trace",
        sha: CONTINUOUS_BATCHING_TWO_QUEUES_TRACE_APPROVED_SHA256,
      },
      { id: "paged-attention-fig-waste-vs-paging", sha: PAGED_ATTENTION_FIG_WASTE_VS_PAGING_APPROVED_SHA256 },
      { id: "mla-intuition", sha: MLA_INTUITION_APPROVED_SHA256 },
      { id: "speculative-decoding", sha: SPECULATIVE_DECODING_APPROVED_SHA256 },
      { id: "roofline-matmul-intensity", sha: ROOFLINE_MATMUL_INTENSITY_APPROVED_SHA256 },
      { id: "ascend-fa-hbm-vs-tiling", sha: ASCEND_FA_HBM_VS_TILING_APPROVED_SHA256 },
      { id: "eplb-cycle", sha: EPLB_CYCLE_APPROVED_SHA256 },
      { id: "mooncake-connector", sha: MOONCAKE_CONNECTOR_APPROVED_SHA256 },
      { id: "worker-lifecycle", sha: WORKER_LIFECYCLE_APPROVED_SHA256 },
      { id: "mem-prof-fig-qwen3-waterfall", sha: MEM_PROF_FIG_QWEN3_WATERFALL_APPROVED_SHA256 },
      { id: "v030-mig-fig-checklist", sha: V030_MIG_FIG_CHECKLIST_APPROVED_SHA256 },
      { id: "rfork-troubleshooting", sha: RFORK_TROUBLESHOOTING_APPROVED_SHA256 },
      { id: "prefill-fig-compute-vs-bw", sha: PREFILL_FIG_COMPUTE_VS_BW_APPROVED_SHA256 },
      { id: "low-prec-fig-bit-anatomy", sha: LOW_PREC_FIG_BIT_ANATOMY_APPROVED_SHA256 },
      { id: "onboarding-four-gates", sha: ONBOARDING_FOUR_GATES_APPROVED_SHA256 },
      { id: "tensor-layout-fig-nd-nz-cube", sha: TENSOR_LAYOUT_FIG_ND_NZ_CUBE_APPROVED_SHA256 },
      { id: "engram-fig-lookup-flow", sha: ENGRAM_FIG_LOOKUP_FLOW_APPROVED_SHA256 },
      { id: "pd-disaggregation-intuition", sha: PD_DISAGGREGATION_INTUITION_APPROVED_SHA256 },
      { id: "moe-dispatch-fig-state-machine", sha: MOE_DISPATCH_FIG_STATE_MACHINE_APPROVED_SHA256 },
      { id: "coll-comm-fig-hccs-vs-roce", sha: COLL_COMM_FIG_HCCS_VS_ROCE_APPROVED_SHA256 },
      { id: "hccl-buffer-fig-domain-ledger", sha: HCCL_BUFFER_FIG_DOMAIN_LEDGER_APPROVED_SHA256 },
      { id: "tensor-parallel-two-splits", sha: TENSOR_PARALLEL_TWO_SPLITS_APPROVED_SHA256 },
      {
        id: "context-parallel-fig-interleave-slots",
        sha: CONTEXT_PARALLEL_FIG_INTERLEAVE_SLOTS_APPROVED_SHA256,
      },
      { id: "dp-fig-dummy-and-exclusion", sha: DP_FIG_DUMMY_AND_EXCLUSION_APPROVED_SHA256 },
    ] as const;

    for (const item of cases) {
      const svgPath = resolve(process.cwd(), "wiki", "diagrams", `${item.id}.svg`);
      const rawDisk = readFileSync(svgPath, "utf8");
      const lfSvg = rawDisk.replace(/\r\n/g, "\n");
      const crlfSvg = lfSvg.replace(/\n/g, "\r\n");

      expect(sha256Hex(lfSvg), `${item.id} LF sha256`).toBe(item.sha);

      // ① 正式态 allowInteractive: true 命中注册组件并正常挂载渲染
      const hitLf = resolveInteractiveDiagram({ id: item.id, svg: lfSvg, allowInteractive: true });
      const hitCrlf = resolveInteractiveDiagram({ id: item.id, svg: crlfSvg, allowInteractive: true });
      expect(hitLf, `${item.id} hitLf`).not.toBeNull();
      expect(hitCrlf, `${item.id} hitCrlf`).not.toBeNull();

      const formalHtml = renderToStaticMarkup(
        createElement(WikiDiagram, {
          id: item.id,
          svg: crlfSvg,
          allowInteractive: true,
          onOpenEvidence: () => {},
        }),
      );
      expect(formalHtml, `${item.id} formal interactive`).toContain('data-interactive="true"');
      expect(formalHtml, `${item.id} toolbar`).toContain("wiki-diagram-toolbar");
      expect(formalHtml, `${item.id} figcaption`).toContain("<figcaption>");
      expect(formalHtml, `${item.id} evidence btn`).toContain(`data-testid="diagram-evidence-${item.id}"`);

      // ② 审阅态 allowInteractive: false（ReviewPane）严格返回 null 并渲染静态 SVG
      expect(
        resolveInteractiveDiagram({ id: item.id, svg: lfSvg, allowInteractive: false }),
        `${item.id} review false`,
      ).toBeNull();
      expect(resolveInteractiveDiagram({ id: item.id, svg: lfSvg }), `${item.id} review omitted`).toBeNull();
      const reviewHtml = renderToStaticMarkup(
        createElement(WikiDiagram, { id: item.id, svg: lfSvg, allowInteractive: false }),
      );
      expect(reviewHtml, `${item.id} review no interactive`).not.toContain('data-interactive="true"');
      expect(reviewHtml, `${item.id} review no toolbar`).not.toContain("wiki-diagram-toolbar");

      // ③ 当 SVG 内容发生恰好 1 字节改动时，严格返回 null 并回退静态 SVG
      const titleIdx = lfSvg.indexOf("</title>");
      expect(titleIdx).toBeGreaterThan(0);
      const mutatedChar = lfSvg[titleIdx - 1] === "!" ? "?" : "!";
      const oneByteMutatedSvg = `${lfSvg.slice(0, titleIdx - 1)}${mutatedChar}${lfSvg.slice(titleIdx)}`;
      expect(oneByteMutatedSvg.length).toBe(lfSvg.length);
      expect(
        resolveInteractiveDiagram({ id: item.id, svg: oneByteMutatedSvg, allowInteractive: true }),
        `${item.id} 1-byte mutation must return null`,
      ).toBeNull();
      const mutatedHtml = renderToStaticMarkup(
        createElement(WikiDiagram, { id: item.id, svg: oneByteMutatedSvg, allowInteractive: true }),
      );
      expect(mutatedHtml, `${item.id} mutated fallback`).not.toContain('data-interactive="true"');
      expect(mutatedHtml, `${item.id} mutated no toolbar`).not.toContain("wiki-diagram-toolbar");
    }
  });

  it("新增四套 2D 沙盘全状态切换演化、暖矿物色值、字号 >=12px、画布 <=900px 与单 SVG 约束均成立", () => {
    const allowedWarmMineralHex = new Set([
      "#fbfaf6",
      "#ece9df",
      "#d8d8cf",
      "#17211f",
      "#66716d",
      "#e85b32",
      "#087f73",
      "#ddf4ef",
      "#c78300",
      "#fff4cf",
      "#4c65b6",
      "#e8edff",
      "#9a4b86",
      "#f7e7f2",
      "#b54237",
      "#fff0e9",
      "#ffffff",
    ]);

    const assertToolbarButtonsContrast = (label: string, html: string) => {
      const btnMatches = [...html.matchAll(/<button\b[^>]*>/g)];
      expect(btnMatches.length, `${label} has toolbar buttons`).toBeGreaterThanOrEqual(4);
      for (const bm of btnMatches) {
        const tag = bm[0];
        const pressed = /\baria-pressed="true"/.test(tag);
        if (pressed) {
          expect(tag, `${label} pressed btn white text`).toContain("color:#ffffff");
          expect(tag, `${label} pressed btn dark bg`).toMatch(/background:#(087f73|17211f|e85b32|b54237)/);
        } else if (tag.includes('data-testid="acl-apply-remediation"')) {
          expect(tag, `${label} remediation btn white text`).toContain("color:#ffffff");
        } else {
          expect(tag, `${label} idle btn dark text`).toContain("color:#17211f");
          expect(tag, `${label} idle btn light bg`).toContain("background:#ffffff");
        }
      }
    };

    const assertSandboxInvariants = (label: string, html: string) => {
      expect(html, `${label} has unified edu shell`).toContain("wiki-edu-card");
      expect(html, `${label} has collapsible details drawer`).toContain("wiki-edu-details");
      const svgMatches = [...html.matchAll(/<svg\b[^>]*>/g)];
      expect(svgMatches.length, `${label} <= 1 inline <svg>`).toBeLessThanOrEqual(1);
      if (svgMatches[0]) {
        const widthMatch = /\bwidth="(\d+)"/.exec(svgMatches[0][0]);
        expect(Number(widthMatch?.[1]), `${label} width <= 900`).toBeLessThanOrEqual(900);
      }
      for (const fm of html.matchAll(/\bfont-size="([0-9.]+)"/g)) {
        expect(Number(fm[1]), `${label} font-size >= 12`).toBeGreaterThanOrEqual(12);
      }
      for (const hm of html.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
        expect(allowedWarmMineralHex.has(hm[0].toLowerCase()), `${label} hex ${hm[0]}`).toBe(true);
      }
      assertToolbarButtonsContrast(label, html);
    };

    const baseProps = (id: string) => {
      const raw = readFileSync(resolve(process.cwd(), "wiki", "diagrams", `${id}.svg`), "utf8");
      return {
        id,
        safeSvg: sanitizeDiagram(raw, `${id}::test`) ?? "",
        caption: id,
        scrollRef: () => {},
        scrollable: false,
        onScroll: () => {},
      };
    };

    // 0) 默认直接进入交互态（data-mode="sandbox"），且静态图态（mode="svg"）下按钮对比度与返回交互入口均完好
    for (const [Comp, diagramId] of [
      [PrefixCachingInteractive, "prefix-caching"],
      [ChunkedPrefillInteractive, "chunked-prefill-fig-budget-game"],
      [AclGraphModeInteractive, "acl-graph-fig-mode-budget"],
      [RforkFallbackInteractive, "rfork-fig-route-and-fallback"],
    ] as const) {
      const defaultHtml = renderToStaticMarkup(createElement(Comp, baseProps(diagramId)));
      expect(defaultHtml, `${diagramId} defaults to sandbox`).toContain('data-mode="sandbox"');
      const svgModeHtml = renderToStaticMarkup(
        createElement(Comp, { ...baseProps(diagramId), initialMode: "svg" }),
      );
      expect(svgModeHtml, `${diagramId} svg mode`).toContain('data-mode="svg"');
      expect(svgModeHtml, `${diagramId} return btn`).toContain('data-testid="diagram-mode-sandbox"');
      assertToolbarButtonsContrast(`${diagramId}-svg-mode`, svgModeHtml);
    }

    // 1) PrefixCachingInteractive 五步动作切换（区分满块后分配私有尾块与未满/共享块写时复制 CoW 分叉）
    expect(PREFIX_CACHING_STEPS).toHaveLength(5);
    expect(PREFIX_CACHING_STEPS[1]!.savedCellsText).toBe("省 8/10 格（跳过 80% 计算）");
    expect(PREFIX_CACHING_STEPS[2]!.buttonLabel).toBe("③ 请求 B 续写分配私有尾块");
    expect(PREFIX_CACHING_STEPS[2]!.detail).toContain("未写满且 ref_cnt > 1");
    expect(PREFIX_CACHING_STEPS[4]!.buttonLabel).toBe("⑤ 写时复制 CoW 分叉");
    for (const spec of PREFIX_CACHING_STEPS) {
      const html = renderToStaticMarkup(
        createElement(PrefixCachingInteractive, {
          ...baseProps("prefix-caching"),
          initialMode: "sandbox",
          initialStep: spec.step,
        }),
      );
      assertSandboxInvariants(`prefix-step-${spec.step}`, html);
      expect(html).toContain(`data-step="${spec.step}"`);
      expect(html).toContain(spec.savedCellsText);
      if (spec.step === 3) {
        expect(html).toContain("满块零拷贝，续写配空块 B3");
        expect(html).not.toContain("CoW：B0,B1 只读");
      }
      if (spec.step === 5) {
        expect(html).toContain("CoW 拷贝 B3→B4，B3 ref 2→1");
        expect(html).toContain("动作 5 / 5");
        expect(html).toContain("队头 [ B5, B2 ] 队尾");
      }
    }

    // 2) ChunkedPrefillInteractive 预算 × 并发矩阵与跷跷板单调性
    const p512 = computeChunkedPrefillPlan(512, 8);
    const p2048 = computeChunkedPrefillPlan(2048, 8);
    const p4096 = computeChunkedPrefillPlan(4096, 0);
    expect(p2048.slices.map((s) => s.prefillTokens)).toEqual([2040, 2040, 16]);
    expect(p512.chunkCount).toBeGreaterThan(p2048.chunkCount);
    expect(p4096.peakStepUnits).toBeGreaterThan(p512.peakStepUnits);
    expect(p512.totalTtftUnits).toBeGreaterThan(p4096.totalTtftUnits);
    for (const b of CHUNKED_BUDGET_OPTIONS) {
      for (const d of DECODE_CONCURRENCY_OPTIONS) {
        const html = renderToStaticMarkup(
          createElement(ChunkedPrefillInteractive, {
            ...baseProps("chunked-prefill-fig-budget-game"),
            initialMode: "sandbox",
            initialBudget: b,
            initialDecodeConcurrency: d,
          }),
        );
        assertSandboxInvariants(`chunked-${b}-${d}`, html);
      }
    }

    // 3) AclGraphModeInteractive 四档模式、单一玻璃水箱与动态无 OOM 一键处方
    expect(computeAclGraphSandboxState("FULL_AND_PIECEWISE", 0.85).isCaptureOom).toBe(false);
    expect(computeAclGraphSandboxState("FULL_AND_PIECEWISE", 0.92).isCaptureOom).toBe(true);
    expect(computeAclGraphSandboxState("FULL_DECODE_ONLY", 0.92).isCaptureOom).toBe(false);
    const piecewise095 = computeAclGraphSandboxState("PIECEWISE", 0.95);
    expect(piecewise095.isCaptureOom).toBe(true);
    expect(piecewise095.remediation.maxSafeUtilization).toBe(0.94);
    expect(piecewise095.remediation.safeAlternativeModes).toEqual(["NONE"]);
    expect(piecewise095.remediation.summaryText).not.toContain("FULL_DECODE_ONLY");
    expect(piecewise095.remediation.summaryText).not.toContain("PIECEWISE");

    for (const m of ACL_CAPTURE_MODES) {
      for (let uPct = 82; uPct <= 95; uPct += 1) {
        const u = uPct / 100;
        const st = computeAclGraphSandboxState(m, u);
        if (st.isCaptureOom) {
          const rem = computeAclGraphRemediation(m, u);
          if (rem.maxSafeUtilization !== null) {
            expect(computeAclGraphSandboxState(m, rem.maxSafeUtilization).isCaptureOom).toBe(false);
          }
          for (const altMode of rem.safeAlternativeModes) {
            expect(altMode).not.toBe(m);
            expect(computeAclGraphSandboxState(altMode, u).isCaptureOom).toBe(false);
          }
        }
      }
      for (const u of [0.82, 0.9, 0.92, 0.95]) {
        const html = renderToStaticMarkup(
          createElement(AclGraphModeInteractive, {
            ...baseProps("acl-graph-fig-mode-budget"),
            initialMode: "sandbox",
            initialCaptureMode: m,
            initialUtilization: u,
          }),
        );
        assertSandboxInvariants(`acl-${m}-${u}`, html);
        expect(html).toContain("u=0.92 触发示意 OOM");
        expect(html).not.toContain("u=0.90 复现OOM");
        expect(html).toContain("示意 8B");
        expect(html).toContain("非实测");
        if (m === "FULL_AND_PIECEWISE" && u >= 0.9) {
          expect(html).toContain('data-oom="true"');
          expect(html).toContain("示意录图期 OOM 预警");
          expect(html).toContain('data-testid="acl-apply-remediation"');
        }
        if (m === "PIECEWISE" && u === 0.95) {
          expect(html).toContain('data-oom="true"');
          expect(html).toContain("处方：u ≤ 0.94，或切 NONE（需 0.00G）");
        }
      }
    }

    // 4) RforkFallbackInteractive 五种现场状态机分支（含 404/失联/归还400/脏缓冲清理失败阻断）与双实例 marker 隔离
    expect(RFORK_SCENARIOS).toEqual([
      "hit-seed",
      "planner-miss",
      "seed-transfer-drop",
      "lease-reject-400",
      "cleanup-abort",
    ]);
    for (const sc of RFORK_SCENARIOS) {
      const html = renderToStaticMarkup(
        createElement(RforkFallbackInteractive, {
          ...baseProps("rfork-fig-route-and-fallback"),
          initialMode: "sandbox",
          initialScenario: sc,
        }),
      );
      assertSandboxInvariants(`rfork-${sc}`, html);
      expect(html).toContain(`data-scenario="${sc}"`);
      expect(html).toContain("Safetensors");
      expect(html).toContain("② 没人可借 (404)");
      if (sc === "planner-miss") {
        expect(html).toContain("② Planner 404 无可用 Seed");
        expect(html).toContain("404 / 暂无空闲 Seed");
        expect(html).toContain("零中断安全降级本地 Safetensors 加载");
      }
      if (sc === "seed-transfer-drop") {
        expect(html).toContain("Seed 失联 / 传输中断");
        expect(html).toContain("零崩溃退回本地 Safetensors 重载");
      }
      if (sc === "lease-reject-400") {
        expect(html).toContain("归还 400 REJECTED");
        expect(html).toContain("推理服务仍正常可用");
      }
      if (sc === "cleanup-abort") {
        expect(html).toContain("脏缓冲清理失败");
        expect(html).toContain("安全门阻断回退：抛明确 RuntimeError");
      }
    }
    const dualRfork = renderToStaticMarkup(
      createElement(
        "div",
        null,
        createElement(RforkFallbackInteractive, {
          ...baseProps("rfork-fig-route-and-fallback"),
          initialMode: "sandbox",
        }),
        createElement(RforkFallbackInteractive, {
          ...baseProps("rfork-fig-route-and-fallback"),
          initialMode: "sandbox",
        }),
      ),
    );
    const rforkMarkers = [...dualRfork.matchAll(/<marker[^>]*\bid="([^"]+)"/g)].map((m) => m[1]!);
    expect(rforkMarkers).toHaveLength(8);
    expect(new Set(rforkMarkers).size).toBe(8);
  });
});
