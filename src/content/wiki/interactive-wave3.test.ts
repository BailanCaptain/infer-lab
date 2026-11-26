import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement, type KeyboardEvent, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { decodeXmlEntities, sanitizeDiagram } from "./diagram-sanitize";
import {
  computeEngramStepMetrics,
  ENGRAM_FIG_LOOKUP_FLOW_APPROVED_SHA256,
  ENGRAM_LOOKUP_FLOW_APPROVED_SHA256,
  ENGRAM_PLACEMENT_MODES,
  ENGRAM_STEPS,
  EngramLookupFlowInteractive,
} from "./EngramLookupFlowInteractive";
import { shouldPassKeyToRangeInput } from "./GqaSharedKvInteractive";
import { resolveInteractiveDiagram, sha256Hex } from "./interactive-diagrams";
import {
  computeLowPrecState,
  LOW_PREC_BIT_ANATOMY_APPROVED_SHA256,
  LOW_PREC_FIG_BIT_ANATOMY_APPROVED_SHA256,
  LOW_PREC_FORMATS,
  LOW_PREC_META,
  LOW_PREC_OUTLIER_STOPS,
  LowPrecisionBitInteractive,
} from "./LowPrecisionBitInteractive";
import {
  ModelOnboardingGatesInteractive,
  ONBOARDING_FOUR_GATES_APPROVED_SHA256,
  ONBOARDING_GATES,
} from "./ModelOnboardingGatesInteractive";
import {
  computePdDisaggState,
  PD_DISAGGREGATION_INTUITION_APPROVED_SHA256,
  PD_PRESETS,
  PD_PROMPT_STOPS,
  PdDisaggIntuitionInteractive,
} from "./PdDisaggIntuitionInteractive";
import {
  computePrefillComputeBwState,
  PREFILL_COMPUTE_VS_BW_APPROVED_SHA256,
  PREFILL_FIG_COMPUTE_VS_BW_APPROVED_SHA256,
  PREFILL_M_STOPS,
  PREFILL_PRESETS,
  PrefillComputeBwInteractive,
  stepStopLeft,
  stepStopRight,
} from "./PrefillComputeBwInteractive";
import {
  computeNzPaddingBytes,
  getTensorFocusSpec,
  ND_MEMORY_ORDER,
  NZ_MEMORY_ORDER,
  ndOffset4x4,
  nzOffset4x4,
  TENSOR_FOCUS_MODES,
  TENSOR_LAYOUT_FIG_ND_NZ_CUBE_APPROVED_SHA256,
  TENSOR_LAYOUT_ND_NZ_CUBE_APPROVED_SHA256,
  TensorLayoutNdNzInteractive,
} from "./TensorLayoutNdNzInteractive";
import { WikiDiagram } from "./WikiDiagram";
import { isTextEntryTarget, WikiEduSandboxShell } from "./WikiEduSandboxShell";

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
      expect(tag, `${label} pressed btn high-contrast dark/teal bg`).toMatch(/background:#(087f73|17211f)/);
    } else {
      expect(tag, `${label} idle btn dark text`).toContain("color:#17211f");
      expect(tag, `${label} idle btn light bg`).toContain("background:#ffffff");
    }
  }
}

function assertSvgTextsNonOverlapping(label: string, html: string) {
  const texts = [...html.matchAll(/<text\b([^>]*)>([^<]+)<\/text>/g)].map((tm) => {
    const attrs = tm[1]!;
    const content = tm[2]!;
    const x = Number(/\bx="([0-9.]+)"/.exec(attrs)?.[1]);
    const y = Number(/\by="([0-9.]+)"/.exec(attrs)?.[1]);
    const anchor = /\btext-anchor="([^"]+)"/.exec(attrs)?.[1] ?? "start";
    const estW = content.length * 8;
    const x0 = anchor === "end" ? x - estW : anchor === "middle" ? x - estW / 2 : x;
    return { content, x0, x1: x0 + estW, y0: y - 11, y1: y + 2 };
  });
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i]!;
      const b = texts[j]!;
      const overlap = a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
      expect(overlap, `${label} SVG text overlap: "${a.content}" vs "${b.content}"`).toBe(false);
    }
  }
}

function assertSandboxInvariants(label: string, html: string) {
  expect(html, `${label} has unified edu shell`).toContain("wiki-edu-card");
  expect(html, `${label} has toolbar landmark`).toContain('role="toolbar"');
  expect(html, `${label} has live readout`).toContain('aria-live="polite"');
  expect(html, `${label} has collapsible details drawer`).toContain("wiki-edu-details");

  const svgMatches = [...html.matchAll(/<svg\b[^>]*>/g)];
  expect(svgMatches.length, `${label} <= 1 inline <svg>`).toBeLessThanOrEqual(1);
  if (svgMatches[0]) {
    const widthMatch = /\bwidth="(\d+)"/.exec(svgMatches[0][0]);
    const svgWidth = Number(widthMatch?.[1]);
    expect(svgWidth, `${label} width <= 900`).toBeLessThanOrEqual(900);
    expect(svgWidth, `${label} width > 0`).toBeGreaterThan(0);
    assertSvgTextsNonOverlapping(label, html);
  }
  for (const fm of html.matchAll(/\bfont-size="([0-9.]+)"/g)) {
    expect(Number(fm[1]), `${label} font-size >= 12`).toBeGreaterThanOrEqual(12);
  }
  for (const hm of html.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
    expect(ALLOWED_WARM_MINERAL_HEX.has(hm[0].toLowerCase()), `${label} hex ${hm[0]}`).toBe(true);
  }
  assertToolbarButtonsContrast(label, html);

  // <summary> 标题不得泄露源码函数名、内部字段名或裸配置文件名
  const summaryText = /<summary>([\s\S]*?)<\/summary>/.exec(html)?.[1] ?? "";
  expect(summaryText.length, `${label} has non-empty summary`).toBeGreaterThan(4);
  for (const summaryForbidden of [
    "q_proj",
    "o_proj",
    "logits_indices",
    "ModelRegistry",
    "weight_nz_mode",
    "dp_shared_memory",
    "quant_model_description.json",
    "config.json",
    "MooncakeConnectorV1",
  ]) {
    expect(summaryText, `${label} <summary> hides ${summaryForbidden}`).not.toContain(summaryForbidden);
  }

  // 三秒原则：画布与工具栏（不含 <details> 抽屉正文）不泄露底层源码函数名或裸配置文件名
  const withoutDetails = html.replace(/<details class="wiki-edu-details">[\s\S]*?<\/details>/, "");
  for (const rawCodeLeak of [
    "prepare_for_fallback",
    "check_ascend_device_type",
    "maybe_auto_detect_quantization",
    "resolve_block_scales",
    "_should_trans_nz",
    "gather_dequantize_host_uva",
    "AscendNgramHashState",
    "batch_transfer_sync_read",
    "_get_group_transfer_info",
    "quant_model_description.json",
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

describe("Wave 3（#17–#22）精品教学 2D 交互沙盘：SVG 指纹、篡改回退、响应式无障碍与领域算式核验", () => {
  const wave3RegistrySpec = [
    {
      id: "prefill-fig-compute-vs-bw",
      sha: PREFILL_FIG_COMPUTE_VS_BW_APPROVED_SHA256,
      Comp: PrefillComputeBwInteractive,
    },
    {
      id: "low-prec-fig-bit-anatomy",
      sha: LOW_PREC_FIG_BIT_ANATOMY_APPROVED_SHA256,
      Comp: LowPrecisionBitInteractive,
    },
    {
      id: "onboarding-four-gates",
      sha: ONBOARDING_FOUR_GATES_APPROVED_SHA256,
      Comp: ModelOnboardingGatesInteractive,
    },
    {
      id: "tensor-layout-fig-nd-nz-cube",
      sha: TENSOR_LAYOUT_FIG_ND_NZ_CUBE_APPROVED_SHA256,
      Comp: TensorLayoutNdNzInteractive,
    },
    {
      id: "engram-fig-lookup-flow",
      sha: ENGRAM_FIG_LOOKUP_FLOW_APPROVED_SHA256,
      Comp: EngramLookupFlowInteractive,
    },
    {
      id: "pd-disaggregation-intuition",
      sha: PD_DISAGGREGATION_INTUITION_APPROVED_SHA256,
      Comp: PdDisaggIntuitionInteractive,
    },
  ] as const;

  it("全部 6 张静态 SVG 指纹匹配、篡改回退、全卡 <summary>/按钮 0·Escape 回退、SSR 双实例 marker 隔离与 <=820px 契约", () => {
    expect(PREFILL_FIG_COMPUTE_VS_BW_APPROVED_SHA256).toBe(PREFILL_COMPUTE_VS_BW_APPROVED_SHA256);
    expect(LOW_PREC_FIG_BIT_ANATOMY_APPROVED_SHA256).toBe(LOW_PREC_BIT_ANATOMY_APPROVED_SHA256);
    expect(TENSOR_LAYOUT_FIG_ND_NZ_CUBE_APPROVED_SHA256).toBe(TENSOR_LAYOUT_ND_NZ_CUBE_APPROVED_SHA256);
    expect(ENGRAM_FIG_LOOKUP_FLOW_APPROVED_SHA256).toBe(ENGRAM_LOOKUP_FLOW_APPROVED_SHA256);

    const wikiCss = readFileSync(resolve(process.cwd(), "src", "design", "wiki.css"), "utf8");
    expect(wikiCss).toContain("@container reader-main (max-width: 820px)");
    expect(wikiCss).toContain("@media (max-width: 820px)");
    expect(wikiCss).toContain(".wiki-edu-gates-rail");
    expect(wikiCss).toContain(".wiki-edu-gates-cards");

    // 焦点位于 <summary> 或画布按钮时，按 0 / Escape 仍可经根容器切回静态图；文本输入框则放行不拦截
    expect(isTextEntryTarget({ tagName: "SUMMARY" })).toBe(false);
    expect(isTextEntryTarget({ tagName: "BUTTON" })).toBe(false);
    expect(isTextEntryTarget({ tagName: "INPUT", type: "range" })).toBe(false);
    expect(isTextEntryTarget({ tagName: "INPUT", type: "text" })).toBe(true);
    expect(isTextEntryTarget({ tagName: "TEXTAREA" })).toBe(true);

    const toggledModes: string[] = [];
    let rootKeyDown: ((event: KeyboardEvent<HTMLElement>) => void) | undefined;
    function ShellKeyProbe() {
      const el = WikiEduSandboxShell({
        id: "probe",
        caption: "probe",
        safeSvg: "<svg></svg>",
        mode: "sandbox",
        onToggleMode: (next) => toggledModes.push(next),
        scrollRef: () => {},
        scrollable: false,
        onScroll: () => {},
        kickerTag: "T",
        kickerTitle: "Title",
        question: "Q",
        toolbarLabel: "L",
        toolbar: null,
        children: null,
        takeawayBadge: "B",
        takeaway: "A",
        kpi: "K",
        detailsSummary: "查看工程与源码细节",
        detailsContent: "D",
      }) as ReactElement<{ onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void }>;
      rootKeyDown = el.props.onKeyDown;
      return el;
    }
    const probeHtml = renderToStaticMarkup(createElement(ShellKeyProbe));
    expect(probeHtml.startsWith("<section ")).toBe(true);
    expect(probeHtml).toContain('aria-label="Title"');
    expect(rootKeyDown).toBeTypeOf("function");

    let preventedCount = 0;
    const makeKeyEvt = (key: string, target: unknown, defaultPrevented = false) =>
      ({
        key,
        target,
        defaultPrevented,
        metaKey: false,
        ctrlKey: false,
        altKey: false,
        preventDefault: () => {
          preventedCount += 1;
        },
      }) as unknown as KeyboardEvent<HTMLElement>;

    rootKeyDown!(makeKeyEvt("0", { tagName: "SUMMARY" }));
    rootKeyDown!(makeKeyEvt("Escape", { tagName: "SUMMARY" }));
    expect(toggledModes).toEqual(["svg", "svg"]);
    expect(preventedCount).toBe(2);

    // 文本输入框按 0 或已被内层 toolbar 处理过的事件不重复触发
    rootKeyDown!(makeKeyEvt("0", { tagName: "INPUT", type: "text" }));
    rootKeyDown!(makeKeyEvt("0", { tagName: "BUTTON" }, true));
    expect(toggledModes).toEqual(["svg", "svg"]);

    const fakeRange = { tagName: "INPUT" };
    expect(shouldPassKeyToRangeInput(fakeRange, "ArrowLeft")).toBe(true);
    expect(shouldPassKeyToRangeInput(fakeRange, "ArrowRight")).toBe(true);
    expect(shouldPassKeyToRangeInput(fakeRange, "0")).toBe(false);
    expect(shouldPassKeyToRangeInput(fakeRange, "Escape")).toBe(false);

    for (const item of wave3RegistrySpec) {
      const rawDisk = readFileSync(resolve(process.cwd(), "wiki", "diagrams", `${item.id}.svg`), "utf8");
      const lfSvg = rawDisk.replace(/\r\n/g, "\n");
      const crlfSvg = lfSvg.replace(/\n/g, "\r\n");
      expect(sha256Hex(lfSvg), `${item.id} LF sha256`).toBe(item.sha);

      expect(resolveInteractiveDiagram({ id: item.id, svg: lfSvg, allowInteractive: true })).not.toBeNull();
      expect(resolveInteractiveDiagram({ id: item.id, svg: crlfSvg, allowInteractive: true })).not.toBeNull();
      expect(resolveInteractiveDiagram({ id: item.id, svg: lfSvg, allowInteractive: false })).toBeNull();

      const titleIdx = lfSvg.indexOf("</title>");
      const mutChar = titleIdx > 0 && lfSvg[titleIdx - 1] === "!" ? "?" : "!";
      const fallbackMutatedSvg =
        titleIdx > 0
          ? `${lfSvg.slice(0, titleIdx - 1)}${mutChar}${lfSvg.slice(titleIdx)}`
          : `${lfSvg}\n<!-- mutated -->`;
      expect(
        resolveInteractiveDiagram({ id: item.id, svg: fallbackMutatedSvg, allowInteractive: true }),
      ).toBeNull();
      const mutatedHtml = renderToStaticMarkup(
        createElement(WikiDiagram, { id: item.id, svg: fallbackMutatedSvg, allowInteractive: true }),
      );
      expect(mutatedHtml, `${item.id} mutated fallback`).not.toContain('data-interactive="true"');

      const defaultHtml = renderToStaticMarkup(createElement(item.Comp, baseProps(item.id)));
      expect(defaultHtml, `${item.id} default sandbox`).toContain('data-mode="sandbox"');
      expect(
        defaultHtml.includes("wiki-edu-dual-grid") || defaultHtml.includes("wiki-edu-gates-rail"),
        `${item.id} uses <=820px single-column responsive layout container`,
      ).toBe(true);
      assertSandboxInvariants(`${item.id}-default`, defaultHtml);

      const svgHtml = renderToStaticMarkup(
        createElement(item.Comp, { ...baseProps(item.id), initialMode: "svg" }),
      );
      expect(svgHtml, `${item.id} svg mode`).toContain('data-mode="svg"');
      expect(svgHtml, `${item.id} return sandbox btn`).toContain('data-testid="diagram-mode-sandbox"');
      assertToolbarButtonsContrast(`${item.id}-svg-mode`, svgHtml);

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
        expect(markerIds.length, `${item.id} dual markers`).toBeGreaterThanOrEqual(2);
        expect(new Set(markerIds).size, `${item.id} unique markers`).toBe(markerIds.length);
      }
    }
  });

  it("17–18. PrefillComputeBw（2036预算分界/分块开关不改题/M=65斜坡与节省量）与 LowPrecisionBit（E4M3 16MiB/BF16精算4.6914/窄屏字号）核验", () => {
    expect(PREFILL_PRESETS.map((p) => p.mRows)).toEqual([1, 12, 2048, 6000]);
    expect(PREFILL_M_STOPS).toContain(2036);
    expect(stepStopLeft(PREFILL_M_STOPS, 65)).toBe(64);
    expect(stepStopRight(PREFILL_M_STOPS, 65)).toBe(256);

    const pf1 = computePrefillComputeBwState(1);
    const pf12 = computePrefillComputeBwState(12);
    const pf65 = computePrefillComputeBwState(65);
    const pf2036 = computePrefillComputeBwState(2036);
    const pf2037 = computePrefillComputeBwState(2037);
    const pf2048Raw = computePrefillComputeBwState(2048, false);
    const pf2048Chunked = computePrefillComputeBwState(2048, true);
    const pf6000Chunked = computePrefillComputeBwState(6000, true);

    expect(pf1.intensityFlopPerB).toBe(1.0);
    expect(pf1.slicedLogitsText).toBe("0.58 MiB");
    expect(pf12.intensityFlopPerB).toBe(11.93);
    expect(pf12.slicedLogitsText).toBe("6.96 MiB");

    // M=65: 未越过脊点 200，处于带宽斜坡爬升段；省掉前 64 行共 37.09 MiB（非全量 37.67 MiB）
    expect(pf65.isComputeBound).toBe(false);
    expect(pf65.stageKind).toBe("prefill-ramp");
    expect(pf65.naiveLogitsMiB).toBe(37.67);
    expect(pf65.savedLogitsMiB).toBe(37.09);
    const html65 = renderToStaticMarkup(
      createElement(PrefillComputeBwInteractive, {
        ...baseProps("prefill-fig-compute-vs-bw"),
        initialMRows: 65,
      }),
    );
    expect(html65).toContain("仍在带宽斜坡爬升");
    expect(html65).not.toContain("稳居屋顶");

    // 2036 + 12 = 2048 刚好不超预算；2037 与 2048（2060 > 2048）均触发分块开关
    expect(pf2036.unchunkedCoRunningTokens).toBe(2048);
    expect(pf2036.needsChunkPrescription).toBe(false);
    expect(pf2037.unchunkedCoRunningTokens).toBe(2049);
    expect(pf2037.needsChunkPrescription).toBe(true);

    expect(pf2048Raw.intensityFlopPerB).toBe(1024.0);
    expect(pf2048Raw.naiveLogitsText).toBe("1.16 GiB");
    expect(pf2048Raw.slicedLogitsText).toBe("0.58 MiB");
    expect(pf2048Raw.kvTrafficMiB).toBe(288.0);
    expect(pf2048Raw.needsChunkPrescription).toBe(true);
    expect(pf2048Raw.chunkFormulaText).toBe("2036+12");

    // 开启分块不篡改原 mRows，单步混入预填充封顶 2036、单步总宽封顶 2048，并精确累计多步末行投影
    expect(pf2048Chunked.mRows).toBe(2048);
    expect(pf2048Chunked.activeStepPrefillTokens).toBe(2036);
    expect(pf2048Chunked.coRunningStepTokens).toBe(2048);
    expect(pf2048Chunked.totalSlicedRows).toBe(2);
    expect(pf2048Chunked.totalSlicedText).toBe("1.16 MiB");
    expect(pf6000Chunked.mRows).toBe(6000);
    expect(pf6000Chunked.coRunningStepTokens).toBe(2048);
    expect(pf6000Chunked.chunkFormulaText).toBe("2036+2036+1928");
    expect(pf6000Chunked.totalSlicedRows).toBe(3);
    expect(pf6000Chunked.totalSlicedText).toBe("1.74 MiB");
    expect(pf6000Chunked.totalSavedText).toBe("3.39 GiB");

    const html12 = renderToStaticMarkup(
      createElement(PrefillComputeBwInteractive, {
        ...baseProps("prefill-fig-compute-vs-bw"),
        initialMRows: 12,
      }),
    );
    expect(html12).toContain("纯解码批（12 条请求各推进 1 个新词）");
    expect(html12).toContain("FULL_DECODE_ONLY");
    expect(html12).not.toContain("混合批会打破");
    expect(html12).not.toContain("省去");

    const html6000Ch = renderToStaticMarkup(
      createElement(PrefillComputeBwInteractive, {
        ...baseProps("prefill-fig-compute-vs-bw"),
        initialMRows: 6000,
        initialChunkedEnabled: true,
      }),
    );
    expect(html6000Ch).toContain("3 步共投影 1.74 MiB，省 3.39 GiB");

    const html6000Raw = renderToStaticMarkup(
      createElement(PrefillComputeBwInteractive, {
        ...baseProps("prefill-fig-compute-vs-bw"),
        initialMRows: 6000,
        initialChunkedEnabled: false,
      }),
    );
    expect(html6000Raw).toContain("全请求仅切末 1 行 = 0.58 MiB");
    expect(html6000Raw).not.toContain("全请求共投 3 行");

    let prevIntensity = 0;
    for (const m of PREFILL_M_STOPS) {
      const st = computePrefillComputeBwState(m);
      expect(st.intensityFlopPerB).toBeGreaterThan(prevIntensity);
      prevIntensity = st.intensityFlopPerB;
      for (const ch of [false, true]) {
        const html = renderToStaticMarkup(
          createElement(PrefillComputeBwInteractive, {
            ...baseProps("prefill-fig-compute-vs-bw"),
            initialMRows: m,
            initialChunkedEnabled: ch,
          }),
        );
        assertSandboxInvariants(`prefill-M${m}-ch${ch}`, html);
        if (m >= 2037) {
          expect(html).toContain('data-testid="prefill-apply-chunk-budget"');
          if (m === 2048) expect(html).toContain("2036+12");
        }
      }
    }

    // LowPrecisionBit：纯 E4M3 o_proj 16.00 MiB、BF16 点积精算 4.6914、动态错配尺度文案与 375px 窄屏字号
    expect(LOW_PREC_META.FP8_E4M3.qwen3OProjMiB).toBe(16.0);
    expect(LOW_PREC_META.MXFP4.qwen3OProjMiB).toBe(8.5);
    expect(computeLowPrecState("BF16", 2.8, false).dotHat).toBe(4.6914);

    const mxNormal = computeLowPrecState("MXFP4", 2.8, false);
    expect(mxNormal.codes).toEqual([0.5, 2, 6]);
    expect(mxNormal.readback).toEqual([0.25, 1, 3]);
    expect(mxNormal.dotHat).toBe(5.25);
    expect(mxNormal.mismatchTargetScale).toBe(4);

    const mxOutlier24 = computeLowPrecState("MXFP4", 24, false);
    expect(mxOutlier24.writeScale).toBe(4);
    expect(mxOutlier24.mismatchTargetScale).toBe(0.5);
    expect(mxOutlier24.codes).toEqual([0, 0.5, 0.5]);
    expect(mxOutlier24.readback).toEqual([0, 2, 2]);
    expect(mxOutlier24.dotHat).toBe(2.0);
    const htmlOut24 = renderToStaticMarkup(
      createElement(LowPrecisionBitInteractive, {
        ...baseProps("low-prec-fig-bit-anatomy"),
        initialFormat: "MXFP4",
        initialOutlier: 24,
        initialScaleMismatch: false,
      }),
    );
    expect(htmlOut24).toContain("错配 scale=0.5");

    const mxMismatch = computeLowPrecState("MXFP4", 2.8, true);
    expect(mxMismatch.readback).toEqual([2, 8, 24]);
    expect(mxMismatch.dotHat).toBe(42.0);

    expect(computeLowPrecState("FP8_E4M3", 600, false).isOutlierClipped).toBe(true);
    expect(computeLowPrecState("FP8_E4M3", 600, false).outlierReadback).toBe(448);
    expect(computeLowPrecState("FP8_E4M3", 600, false).overflowKind).toBe("e4m3fn-sat-or-nan");
    expect(computeLowPrecState("FP8_E5M2", 600, false).isOutlierClipped).toBe(false);
    expect(computeLowPrecState("FP8_E5M2", 70000, false).overflowKind).toBe("ieee-inf");
    expect(computeLowPrecState("FP8_E5M2", 70000, false).outlierReadback).toBe(Number.POSITIVE_INFINITY);
    expect(computeLowPrecState("FP16", 70000, false).isOutlierClipped).toBe(true);
    expect(computeLowPrecState("FP16", 70000, false).overflowKind).toBe("ieee-inf");
    expect(computeLowPrecState("FP16", 70000, false).outlierReadback).toBe(Number.POSITIVE_INFINITY);
    expect(computeLowPrecState("BF16", 70000, false).isOutlierClipped).toBe(false);
    expect(computeLowPrecState("BF16", 70000, false).overflowKind).toBe("none");
    expect(computeLowPrecState("BF16", 70000, false).outlierReadback).toBe(70144);

    const htmlFp16Inf = renderToStaticMarkup(
      createElement(LowPrecisionBitInteractive, {
        ...baseProps("low-prec-fig-bit-anatomy"),
        initialFormat: "FP16",
        initialOutlier: 70000,
        initialScaleMismatch: false,
      }),
    );
    expect(htmlFp16Inf).toContain("上溢为 Inf");
    expect(htmlFp16Inf).toContain("仅饱和转换截断于 65,504");

    for (const fmt of LOW_PREC_FORMATS) {
      for (const out of LOW_PREC_OUTLIER_STOPS) {
        for (const mm of [false, true]) {
          const html = renderToStaticMarkup(
            createElement(LowPrecisionBitInteractive, {
              ...baseProps("low-prec-fig-bit-anatomy"),
              initialFormat: fmt,
              initialOutlier: out,
              initialScaleMismatch: mm,
            }),
          );
          assertSandboxInvariants(`lowprec-${fmt}-${out}-${mm}`, html);
          const svgW = Number(/\bwidth="(\d+)"/.exec(html)?.[1]);
          for (const fm of html.matchAll(/\bfont-size="([0-9.]+)"/g)) {
            const renderedAt375 = (Number(fm[1]) * 305) / svgW;
            expect(
              renderedAt375,
              `lowprec ${fmt} rendered font >= 12px on 375px viewport`,
            ).toBeGreaterThanOrEqual(12);
          }
        }
      }
    }
  });

  it("19–22. Onboarding 四道关、TensorLayout 步进按钮、Engram 107.3/80.5GiB 与 PdDisagg 有效/整块 KV 对账", () => {
    // 19. Onboarding 严格四道关（1..4），画布零裸 .json 文件名，通关冒烟写入第 4 关
    expect(ONBOARDING_GATES).toHaveLength(4);
    for (const g of ONBOARDING_GATES) {
      const html = renderToStaticMarkup(
        createElement(ModelOnboardingGatesInteractive, {
          ...baseProps("onboarding-four-gates"),
          initialStep: g.step,
        }),
      );
      assertSandboxInvariants(`onboarding-step-${g.step}`, html);
      expect(html).toContain(`data-step="${g.step}"`);
      expect(html).toContain("wiki-edu-gates-rail");
      expect(html).toContain("wiki-edu-gates-cards");
      if (g.step === 2) {
        expect(html).toContain("25 活跃");
        expect(html).toContain("27 停服桩");
        expect(html).toContain("GLM-5.1");
      }
      if (g.step === 3) {
        expect(html).toContain("昇腾专有与同名覆写优先");
        expect(html).toContain("直接覆盖同名上游");
      }
      if (g.step === 4) {
        expect(html).toContain("双接口冒烟");
        expect(html).toContain("/v1/models");
        expect(html).toContain("temperature: 0");
      }
    }

    // 20. TensorLayoutNdNz：◀ 上一步 / 下一步 ▶ 按钮与 4×4 大 N 小 z 序列
    expect(ND_MEMORY_ORDER.map((c) => c.value)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
    ]);
    expect(NZ_MEMORY_ORDER.map((c) => c.value)).toEqual([
      1, 2, 5, 6, 9, 10, 13, 14, 3, 4, 7, 8, 11, 12, 15, 16,
    ]);
    expect(ndOffset4x4(1, 0)).toBe(4);
    expect(nzOffset4x4(1, 0)).toBe(2);
    expect(computeNzPaddingBytes(17, 17, 16, 16, 2)).toEqual({
      rows: 17,
      cols: 17,
      paddedRows: 32,
      paddedCols: 32,
      validBytes: 578,
      totalBytes: 2048,
      extraPadBytes: 1470,
      padSharePct: 71.8,
    });

    for (const fm of TENSOR_FOCUS_MODES) {
      const sp = getTensorFocusSpec(fm);
      expect(sp.nzContiguous).toBe(fm.startsWith("block-"));
      const html = renderToStaticMarkup(
        createElement(TensorLayoutNdNzInteractive, {
          ...baseProps("tensor-layout-fig-nd-nz-cube"),
          initialFocus: fm,
        }),
      );
      assertSandboxInvariants(`tensor-layout-${fm}`, html);
      expect(html).toContain('data-testid="tensor-nz-prev"');
      expect(html).toContain('data-testid="tensor-nz-next"');
    }

    // 21. EngramLookupFlow：三档互斥放置模式（独立107.3G·0通信 / EDP分片26.8G·2通信 / 共享26.8G·0通信）与 9 KiB
    expect(ENGRAM_STEPS).toHaveLength(4);
    expect(ENGRAM_PLACEMENT_MODES).toEqual(["independent", "edp-sharded", "shared-mem"]);

    const egIndep = computeEngramStepMetrics(2, "independent");
    const egEdp = computeEngramStepMetrics(2, "edp-sharded");
    const egShared = computeEngramStepMetrics(2, "shared-mem");

    expect(egIndep.totalFootprintGiB).toBe(107.3);
    expect(egIndep.perReplicaGiB).toBe(26.8);
    expect(egIndep.savedVsIndependentGiB).toBe(0);
    expect(egIndep.edpCollectiveOpsPerStep).toBe(0);
    expect(egIndep.head24DivisibleOn16Cards).toBe(true);

    expect(egEdp.totalFootprintGiB).toBe(26.8);
    expect(egEdp.perReplicaGiB).toBe(6.7);
    expect(egEdp.savedVsIndependentGiB).toBe(80.5);
    expect(egEdp.edpCollectiveOpsPerStep).toBe(2);
    expect(egEdp.head24DivisibleOn16Cards).toBe(false);

    expect(egShared.singleCopyGiB).toBe(26.8);
    expect(egShared.stepReadBytes).toBe(9216);
    expect(egShared.transientHbmKiB).toBe(16);
    expect(egShared.totalFootprintGiB).toBe(26.8);
    expect(egShared.perReplicaGiB).toBe(26.8);
    expect(egShared.savedVsIndependentGiB).toBe(80.5);
    expect(egShared.edpCollectiveOpsPerStep).toBe(0);
    expect(egShared.head24DivisibleOn16Cards).toBe(true);

    expect(computeEngramStepMetrics(2, true).placement).toBe("shared-mem");
    expect(computeEngramStepMetrics(2, false).placement).toBe("edp-sharded");

    for (const item of ENGRAM_STEPS) {
      for (const pm of ENGRAM_PLACEMENT_MODES) {
        const html = renderToStaticMarkup(
          createElement(EngramLookupFlowInteractive, {
            ...baseProps("engram-fig-lookup-flow"),
            initialStep: item.step,
            initialPlacement: pm,
          }),
        );
        assertSandboxInvariants(`engram-step-${item.step}-${pm}`, html);
        expect(html).toContain("读 9 KiB");
        expect(html).toContain("24 头/16 卡反例");
      }
    }

    // 22. PdDisaggIntuition：位置数宽度比、交接前 2词/步 vs 并入后 3词/步与有效/整块 KV 对账
    expect(PD_PRESETS.map((p) => p.promptTokens)).toEqual([4, 262, 2048, 6000]);
    expect(stepStopRight(PD_PROMPT_STOPS, 261)).toBe(262);
    expect(stepStopLeft(PD_PROMPT_STOPS, 263)).toBe(262);

    const pd4 = computePdDisaggState(4);
    const pd262 = computePdDisaggState(262);
    const pd2048 = computePdDisaggState(2048);
    const pd6000 = computePdDisaggState(6000);

    expect(pd4.colocatedUnchunkedTokens).toBe(6);
    expect(pd262.logicalKvMiB).toBe(36.84);
    expect(pd262.blocks128Count).toBe(3);
    expect(pd262.tp2PerRankBlockMiB).toBe(27);
    expect(pd262.blockAlignedTotalKvMiB).toBe(54);

    expect(pd2048.logicalKvMiB).toBe(288);
    expect(pd2048.blockAlignedTotalKvMiB).toBe(288);
    expect(pd6000.colocatedUnchunkedTokens).toBe(6002);
    expect(pd6000.colocatedChunkSteps).toBe(3);
    expect(pd6000.logicalKvMiB).toBe(843.75);
    expect(pd6000.blocks128Count).toBe(47);
    expect(pd6000.blockAlignedTotalKvMiB).toBe(846);

    for (const pt of PD_PROMPT_STOPS) {
      const html = renderToStaticMarkup(
        createElement(PdDisaggIntuitionInteractive, {
          ...baseProps("pd-disaggregation-intuition"),
          initialPromptTokens: pt,
        }),
      );
      assertSandboxInvariants(`pd-prompt-${pt}`, html);
      expect(html).not.toContain("吐字间隔飙红");
      expect(html).not.toContain("恒 2 词/步");
      expect(html).not.toContain("恒定每步只算 2 词");
      expect(html).toContain("交接前 2词/步");
      expect(html).toContain("并入后 3词/步");
      expect(html).toContain("MiB/卡");
      expect(html).toContain("6.07×");
      if (pt > 512) {
        expect(html).toContain("拆池本身已隔离长 Prefill");
        expect(html).toContain("消除逐词 Eager 下发开销");
      }
    }
  });
});
