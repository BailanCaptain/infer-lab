import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ASCEND_FA_HBM_VS_TILING_APPROVED_SHA256,
  ASCEND_FA_STEPS,
  AscendFaTilingInteractive,
} from "./AscendFaTilingInteractive";
import { decodeXmlEntities, sanitizeDiagram } from "./diagram-sanitize";
import { EPLB_CYCLE_APPROVED_SHA256, EPLB_CYCLE_STEPS, EplbCycleInteractive } from "./EplbCycleInteractive";
import { sha256Hex } from "./interactive-diagrams";
import {
  computeMemProfWaterfallState,
  MEM_PROF_FIG_QWEN3_WATERFALL_APPROVED_SHA256,
  MEM_PROF_QWEN3_WATERFALL_APPROVED_SHA256,
  MEM_PROF_TP_OPTIONS,
  MemProfWaterfallInteractive,
} from "./MemProfWaterfallInteractive";
import {
  MOONCAKE_CONNECTOR_APPROVED_SHA256,
  MOONCAKE_CONNECTOR_STEPS,
  MooncakeConnectorInteractive,
} from "./MooncakeConnectorInteractive";
import {
  RFORK_DIAG_STEPS,
  RFORK_TROUBLESHOOTING_APPROVED_SHA256,
  RforkTroubleshootingInteractive,
} from "./RforkTroubleshootingInteractive";
import {
  computeRooflineMatmulState,
  ROOFLINE_M_STOPS,
  ROOFLINE_MATMUL_INTENSITY_APPROVED_SHA256,
  ROOFLINE_PRECISIONS,
  RooflineMatmulInteractive,
} from "./RooflineMatmulInteractive";
import {
  V030_MIG_CHECKLIST_APPROVED_SHA256,
  V030_MIG_FIG_CHECKLIST_APPROVED_SHA256,
  V030_MIG_GATES,
  V030MigChecklistInteractive,
} from "./V030MigChecklistInteractive";
import {
  COLD_START_SIX_CARDS,
  WORKER_LIFECYCLE_APPROVED_SHA256,
  WORKER_LIFECYCLE_STAGES,
  WORKER_LIFECYCLE_STEPS,
  WorkerLifecycleInteractive,
} from "./WorkerLifecycleInteractive";

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
const ALLOWED_WARM_MINERAL_HEX = new Set([
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

function assertToolbarButtonsContrast(label: string, html: string) {
  const btnMatches = [...html.matchAll(/<button\b[^>]*>/g)];
  expect(btnMatches.length, `${label} has toolbar buttons`).toBeGreaterThanOrEqual(4);
  for (const bm of btnMatches) {
    const tag = bm[0];
    const pressed = /\baria-pressed="true"/.test(tag);
    if (pressed) {
      expect(tag, `${label} pressed btn white text`).toContain("color:#ffffff");
      // WCAG AA >= 4.5:1: pressed buttons use dark (#17211f) or teal (#087f73)
      expect(tag, `${label} pressed btn high-contrast dark/teal bg`).toMatch(/background:#(087f73|17211f)/);
    } else {
      expect(tag, `${label} idle btn dark text`).toContain("color:#17211f");
      expect(tag, `${label} idle btn light bg`).toContain("background:#ffffff");
    }
  }
}

function assertSandboxInvariants(label: string, html: string) {
  expect(html, `${label} has unified edu shell`).toContain("wiki-edu-card");
  expect(html, `${label} has collapsible details drawer`).toContain("wiki-edu-details");
  const svgMatches = [...html.matchAll(/<svg\b[^>]*>/g)];
  expect(svgMatches.length, `${label} <= 1 inline <svg>`).toBeLessThanOrEqual(1);
  if (svgMatches[0]) {
    const widthMatch = /\bwidth="(\d+)"/.exec(svgMatches[0][0]);
    expect(Number(widthMatch?.[1]), `${label} width <= 900`).toBeLessThanOrEqual(900);
    expect(Number(widthMatch?.[1]), `${label} width > 0`).toBeGreaterThan(0);
  }
  for (const fm of html.matchAll(/\bfont-size="([0-9.]+)"/g)) {
    expect(Number(fm[1]), `${label} font-size >= 12`).toBeGreaterThanOrEqual(12);
  }
  for (const hm of html.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
    expect(ALLOWED_WARM_MINERAL_HEX.has(hm[0].toLowerCase()), `${label} hex ${hm[0]}`).toBe(true);
  }
  assertToolbarButtonsContrast(label, html);

  // 三秒原则：画布与控制区（不含 <details> 工程抽屉）不堆砌源码标识符与复合布尔表达式
  const withoutDetails = html.replace(/<details class="wiki-edu-details">[\s\S]*?<\/details>/, "");
  for (const rawCodeLeak of [
    "prepare_for_fallback",
    "service_stopped",
    "determine_available_memory",
    "npu_fused_infer_attention_score",
    "batch_transfer_sync_read",
    "_HCCL_PG_REGISTRY",
    "_init_kv_zero_meta",
  ]) {
    expect(withoutDetails, `${label} canvas hides ${rawCodeLeak}`).not.toContain(rawCodeLeak);
  }
}

function baseProps(id: string) {
  const raw = readFileSync(resolve(process.cwd(), "wiki", "diagrams", `${id}.svg`), "utf8");
  return {
    id,
    safeSvg: sanitizeDiagram(raw, `${id}::test`) ?? "",
    caption: id,
    scrollRef: () => {},
    scrollable: false,
    onScroll: () => {},
  };
}

describe("Wave 2B（#9–#16）教学 2D 交互沙盘：SVG 指纹锁定、四段式契约与领域算式核验", () => {
  const wave2bRegistrySpec = [
    {
      id: "roofline-matmul-intensity",
      sha: ROOFLINE_MATMUL_INTENSITY_APPROVED_SHA256,
      Comp: RooflineMatmulInteractive,
    },
    {
      id: "ascend-fa-hbm-vs-tiling",
      sha: ASCEND_FA_HBM_VS_TILING_APPROVED_SHA256,
      Comp: AscendFaTilingInteractive,
    },
    { id: "eplb-cycle", sha: EPLB_CYCLE_APPROVED_SHA256, Comp: EplbCycleInteractive },
    { id: "mooncake-connector", sha: MOONCAKE_CONNECTOR_APPROVED_SHA256, Comp: MooncakeConnectorInteractive },
    { id: "worker-lifecycle", sha: WORKER_LIFECYCLE_APPROVED_SHA256, Comp: WorkerLifecycleInteractive },
    {
      id: "mem-prof-fig-qwen3-waterfall",
      sha: MEM_PROF_QWEN3_WATERFALL_APPROVED_SHA256,
      Comp: MemProfWaterfallInteractive,
    },
    {
      id: "v030-mig-fig-checklist",
      sha: V030_MIG_CHECKLIST_APPROVED_SHA256,
      Comp: V030MigChecklistInteractive,
    },
    {
      id: "rfork-troubleshooting",
      sha: RFORK_TROUBLESHOOTING_APPROVED_SHA256,
      Comp: RforkTroubleshootingInteractive,
    },
  ] as const;

  it("全部 8 张静态 SVG（CRLF→LF 归一）精确匹配导出 SHA-256 常量，默认进入 sandbox、支持切换 svg 与同页双实例 marker 隔离", () => {
    expect(MEM_PROF_FIG_QWEN3_WATERFALL_APPROVED_SHA256).toBe(MEM_PROF_QWEN3_WATERFALL_APPROVED_SHA256);
    expect(V030_MIG_FIG_CHECKLIST_APPROVED_SHA256).toBe(V030_MIG_CHECKLIST_APPROVED_SHA256);

    for (const item of wave2bRegistrySpec) {
      const rawDisk = readFileSync(resolve(process.cwd(), "wiki", "diagrams", `${item.id}.svg`), "utf8");
      const lfSvg = rawDisk.replace(/\r\n/g, "\n");
      expect(sha256Hex(lfSvg), `${item.id} LF sha256`).toBe(item.sha);

      const defaultHtml = renderToStaticMarkup(createElement(item.Comp, baseProps(item.id)));
      expect(defaultHtml, `${item.id} default sandbox`).toContain('data-mode="sandbox"');
      assertSandboxInvariants(`${item.id}-default`, defaultHtml);

      const svgHtml = renderToStaticMarkup(
        createElement(item.Comp, { ...baseProps(item.id), initialMode: "svg" }),
      );
      expect(svgHtml, `${item.id} svg mode`).toContain('data-mode="svg"');
      expect(svgHtml, `${item.id} return sandbox btn`).toContain('data-testid="diagram-mode-sandbox"');
      assertToolbarButtonsContrast(`${item.id}-svg-mode`, svgHtml);

      // 同页双实例渲染时：含内联 SVG 的组件内部 <marker id> 100% 独立无冲突；纯响应式 HTML 组件为 0 个内联 SVG
      const dualHtml = renderToStaticMarkup(
        createElement(
          "div",
          null,
          createElement(item.Comp, baseProps(item.id)),
          createElement(item.Comp, baseProps(item.id)),
        ),
      );
      const markerIds = [...dualHtml.matchAll(/<marker[^>]*\bid="([^"]+)"/g)].map((m) => m[1]!);
      if (markerIds.length > 0) {
        expect(markerIds.length, `${item.id} has dual markers`).toBeGreaterThanOrEqual(2);
        expect(new Set(markerIds).size, `${item.id} unique markers`).toBe(markerIds.length);
      }
    }
  });

  it("9. RooflineMatmulInteractive：对齐四档工况表、M=222..234 分水岭（BF16 登顶而 W8A8 仍在斜坡）及 SVG 文本零重叠", () => {
    const s1Bf16 = computeRooflineMatmulState(1, "BF16");
    const s1W8a8 = computeRooflineMatmulState(1, "W8A8");
    const s16Bf16 = computeRooflineMatmulState(16, "BF16");
    const s16W8a8 = computeRooflineMatmulState(16, "W8A8");
    const s228Bf16 = computeRooflineMatmulState(228, "BF16");
    const s228W8a8 = computeRooflineMatmulState(228, "W8A8");
    const s235W8a8 = computeRooflineMatmulState(235, "W8A8");
    const s512Bf16 = computeRooflineMatmulState(512, "BF16");

    expect(s1Bf16.totalMiB).toBe(32.02);
    expect(s1Bf16.weightSharePct).toBe(99.95);
    expect(s1Bf16.intensity).toBe(1.0);
    expect(s1Bf16.ceilingUtilizationPct).toBe(0.5);
    expect(s1Bf16.isComputeBound).toBe(false);

    expect(s1W8a8.totalMiB).toBe(16.01);
    expect(s1W8a8.intensity).toBe(2.0);
    expect(s16Bf16.totalMiB).toBe(32.25);
    expect(s16Bf16.intensity).toBe(15.88);
    expect(s16W8a8.intensity).toBe(31.63);

    // 分水岭区间 M=228：BF16 已越过脊点 200 登顶，而 W8A8 因屋顶抬升至 640 TOP/s（脊点 400）仍处带宽斜坡；M=235 越过 400
    expect(ROOFLINE_M_STOPS).toContain(228);
    expect(s228Bf16.isComputeBound).toBe(true);
    expect(s228W8a8.isComputeBound).toBe(false);
    expect(s235W8a8.isComputeBound).toBe(true);

    expect(s512Bf16.totalMiB).toBe(40.0);
    expect(s512Bf16.intensity).toBe(409.6);
    expect(s512Bf16.isComputeBound).toBe(true);

    for (const prec of ROOFLINE_PRECISIONS) {
      let prevI = 0;
      for (const m of [1, 4, 16, 64, 128, 222, 228, 235, 256, 512]) {
        const st = computeRooflineMatmulState(m, prec);
        expect(st.intensity).toBeGreaterThan(prevI);
        prevI = st.intensity;
        const html = renderToStaticMarkup(
          createElement(RooflineMatmulInteractive, {
            ...baseProps("roofline-matmul-intensity"),
            initialMRows: m,
            initialPrecision: prec,
          }),
        );
        assertSandboxInvariants(`roofline-${prec}-M${m}`, html);
        expect(html).toContain("理想吞吐上限");

        // 校验 SVG 内 4 个 <text> 包围盒两两不重叠
        const texts = [...html.matchAll(/<text\b([^>]*)>([^<]+)<\/text>/g)].map((tm) => {
          const attrs = tm[1]!;
          const content = tm[2]!;
          const x = Number(/\bx="([0-9.]+)"/.exec(attrs)?.[1]);
          const y = Number(/\by="([0-9.]+)"/.exec(attrs)?.[1]);
          const anchor = /\btext-anchor="([^"]+)"/.exec(attrs)?.[1] ?? "start";
          const estW = content.length * 8;
          const x0 = anchor === "end" ? x - estW : anchor === "middle" ? x - estW / 2 : x;
          return { content, x0, x1: x0 + estW, y0: y - 12, y1: y + 2 };
        });
        expect(texts).toHaveLength(4);
        for (let i = 0; i < texts.length; i++) {
          for (let j = i + 1; j < texts.length; j++) {
            const a = texts[i]!;
            const b = texts[j]!;
            const overlap = a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
            expect(overlap, `SVG text overlap at ${prec} M=${m}: "${a.content}" vs "${b.content}"`).toBe(
              false,
            );
          }
        }
      }
    }
  });

  it("10–13. AscendFaTiling / EplbCycle / MooncakeConnector / WorkerLifecycle 五钮以内分步与源码口径核验", () => {
    expect(ASCEND_FA_STEPS).toHaveLength(4);
    for (const item of ASCEND_FA_STEPS) {
      const html = renderToStaticMarkup(
        createElement(AscendFaTilingInteractive, {
          ...baseProps("ascend-fa-hbm-vs-tiling"),
          initialStep: item.step,
        }),
      );
      assertSandboxInvariants(`ascend-fa-step-${item.step}`, html);
      expect(html).toContain(`data-step="${item.step}"`);
      if (item.step === 1) expect(html).toContain("64 GiB");
      if (item.step === 2) expect(html).toContain("s=[1, 2]");
      if (item.step === 4) {
        expect(html).toContain("35.196059");
        expect(html).toContain("enforce_eager");
        expect(html).not.toContain("结果一字不差");
      }
    }

    expect(EPLB_CYCLE_STEPS).toHaveLength(5);
    for (const item of EPLB_CYCLE_STEPS) {
      const html = renderToStaticMarkup(
        createElement(EplbCycleInteractive, { ...baseProps("eplb-cycle"), initialStep: item.step }),
      );
      assertSandboxInvariants(`eplb-step-${item.step}`, html);
      expect(html).toContain(`峰均比 ${item.imbalanceRatio}`);
      expect(html).not.toContain("忙碌 80%");
      if (item.step === 1) {
        expect(html).toContain("配对占 80%");
        expect(html).toContain("配对占 20%");
      }
      if (item.step === 2) expect(html).toContain("daemon=True");
    }

    expect(MOONCAKE_CONNECTOR_STEPS).toHaveLength(4);
    for (const item of MOONCAKE_CONNECTOR_STEPS) {
      const html = renderToStaticMarkup(
        createElement(MooncakeConnectorInteractive, {
          ...baseProps("mooncake-connector"),
          initialStep: item.step,
        }),
      );
      assertSandboxInvariants(`mooncake-step-${item.step}`, html);
      expect(html).toContain(item.kpi);
      if (item.step === 3) {
        expect(html).toContain("回可调度态");
        expect(html).toContain("收齐全部预期 D 卡");
      }
    }

    expect(COLD_START_SIX_CARDS).toHaveLength(6);
    expect(WORKER_LIFECYCLE_STAGES).toHaveLength(5);
    expect(WORKER_LIFECYCLE_STEPS).toHaveLength(5);
    for (const item of WORKER_LIFECYCLE_STAGES) {
      const html = renderToStaticMarkup(
        createElement(WorkerLifecycleInteractive, {
          ...baseProps("worker-lifecycle"),
          initialStep: item.stage,
        }),
      );
      assertSandboxInvariants(`worker-stage-${item.stage}`, html);
      expect(html).toContain(`data-barrier="${item.hasCrossCardBarrier ? "true" : "false"}"`);
      if (item.stage === 3) expect(html).toContain("BF16 权重保持原 ND");
      if (item.stage === 5) expect(html).toContain("enforce-eager");
    }
  });

  it("14–16. MemProfWaterfall 三档余量区分、V030MigChecklist 五关、RforkTroubleshooting 404/400 分流核验", () => {
    const mpTp1Default = computeMemProfWaterfallState(0.92, 1);
    expect(mpTp1Default.budgetGiB).toBe(58.88);
    expect(mpTp1Default.headroomGiB).toBe(5.12);
    expect(mpTp1Default.kvPoolGiB).toBe(40.88);
    expect(mpTp1Default.totalBlocks).toBe(2325);
    expect(mpTp1Default.usableBlocks).toBe(2324);
    expect(mpTp1Default.tokenSlots).toBe(297472);
    expect(mpTp1Default.headroomStatus).toBe("safe");

    // TP=4, u=0.95 -> 留白 3.20 GiB >= 图显存 3.10 GiB，但低于 3.25 GiB (150MB 建议余量) -> margin-warn 而非 oom-risk!
    const mpTp4Warn = computeMemProfWaterfallState(0.95, 4);
    expect(mpTp4Warn.headroomGiB).toBe(3.2);
    expect(mpTp4Warn.isCaptureOomRisk).toBe(false);
    expect(mpTp4Warn.isBelowRecommendMargin).toBe(true);
    expect(mpTp4Warn.headroomStatus).toBe("margin-warn");

    // TP=4, u=0.96 -> 留白 2.56 GiB < 图显存 3.10 GiB -> oom-risk
    const mpTp4Oom = computeMemProfWaterfallState(0.96, 4);
    expect(mpTp4Oom.isCaptureOomRisk).toBe(true);
    expect(mpTp4Oom.headroomStatus).toBe("oom-risk");

    let prevGraph = 0;
    for (const tp of MEM_PROF_TP_OPTIONS) {
      const st = computeMemProfWaterfallState(0.92, tp);
      expect(st.graphGiB).toBeGreaterThan(prevGraph);
      prevGraph = st.graphGiB;
      for (const u of [0.9, 0.92, 0.95, 0.96]) {
        const html = renderToStaticMarkup(
          createElement(MemProfWaterfallInteractive, {
            ...baseProps("mem-prof-fig-qwen3-waterfall"),
            initialTpSize: tp,
            initialUtilization: u,
          }),
        );
        assertSandboxInvariants(`memprof-tp${tp}-u${u}`, html);
        expect(html).toContain("_HCCL_PG_REGISTRY");
      }
    }

    expect(V030_MIG_GATES).toHaveLength(5);
    for (const item of V030_MIG_GATES) {
      const html = renderToStaticMarkup(
        createElement(V030MigChecklistInteractive, {
          ...baseProps("v030-mig-fig-checklist"),
          initialStep: item.step,
        }),
      );
      assertSandboxInvariants(`v030-step-${item.step}`, html);
      expect(html).toContain(item.kpi);
      if (item.step === 1) {
        expect(html).toContain("Unknown vLLM environment variable detected");
        expect(html).toContain("quantized_all_reduce_config");
      }
      if (item.step === 4) expect(html).toContain("model_dtype");
    }

    expect(RFORK_DIAG_STEPS).toHaveLength(5);
    for (const item of RFORK_DIAG_STEPS) {
      const html = renderToStaticMarkup(
        createElement(RforkTroubleshootingInteractive, {
          ...baseProps("rfork-troubleshooting"),
          initialStep: item.step,
        }),
      );
      assertSandboxInvariants(`rfork-diag-${item.step}`, html);
      expect(html).toContain(escapeXml(item.kpi));
      expect(html).not.toContain("逐字节清零");
      if (item.step === 4) {
        expect(html).toContain("批 1–6 已写入");
        expect(html).toContain("停服并注销后回退");
      }
      if (item.step === 5) {
        expect(html).toContain("404 清租可发源");
        expect(html).toContain("400 停试禁发源");
        expect(html).toContain("无时钟跳变");
      }
    }
  });
});
