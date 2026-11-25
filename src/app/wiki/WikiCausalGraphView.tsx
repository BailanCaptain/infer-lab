import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Network,
  Search,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  ensureWikiGraph,
  getReaderState,
  getWikiGraph,
  type ReaderGraph,
  resolveCanonicalPageId,
  subscribeReader,
  type WikiGraphEdge,
} from "../../content/wiki/index";
import { pageDisplayTitle } from "../../content/wiki/param-display";
import { neighborhood } from "../../content/wiki/relations";
import {
  type Backlink,
  INVERSE_KIND,
  isSymmetric,
  type RegistryEntry,
  type Relation,
} from "../../content/wiki/schema";
import { buildToc, CORE_26_IDS, CORE_26_SET, type TocPart } from "../../content/wiki/toc";
import { computeCore26Progress, togglePageRead, useReadingProgress } from "./readingProgressStore";

export type GraphFilterMode = "all" | "core-26" | "params";

export type CausalFoundationKind = "builds-on" | "variant-of";
export type CausalDependentKind = "enables" | "has-variant";
export type CausalSiblingKind = "conflicts-with" | "alternative-to";

export interface CausalNeighborItem<K extends string = string> {
  readonly id: string;
  readonly kind: K;
  readonly note: string;
}

export interface EnrichedCausalNeighborhood {
  readonly foundations: CausalNeighborItem<CausalFoundationKind>[];
  readonly dependents: CausalNeighborItem<CausalDependentKind>[];
  readonly siblings: CausalNeighborItem<CausalSiblingKind>[];
}

export const PARAM_HUB_IDS: ReadonlySet<string> = new Set([
  "core-cli-params",
  "ascend-env-and-serve",
  "kv-cache-memory-profiling",
  "acl-graph",
  "hccl-buffer",
  "ascend-config-system",
  "npugraph-ex",
  "cpu-binding",
]);

export function isParamBlastRadiusPage(page: Pick<RegistryEntry, "id" | "type">): boolean {
  return page.type === "param" || PARAM_HUB_IDS.has(page.id);
}

const TYPE_LABEL: Record<string, string> = {
  concept: "核心概念",
  feature: "工程特性",
  param: "配置参数",
  source: "源码记录",
  pr: "PR 档案",
};

const CORE_26_STAGES: ReadonlyArray<{
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly ids: readonly string[];
  readonly offset: number;
}> = [
  {
    id: "stage-1",
    title: "第一站 · 起步与模型基础",
    subtitle: "一次请求流转、HF 目录解剖、量化选型与最小起服命令",
    ids: CORE_26_IDS.slice(0, 6),
    offset: 1,
  },
  {
    id: "stage-2",
    title: "第二站 · 单卡注意力与 KV 调度",
    subtitle: "QKV 计算、GQA 降缓存、KV Cache 容量账与分页/连续批调度",
    ids: CORE_26_IDS.slice(6, 13),
    offset: 7,
  },
  {
    id: "stage-3",
    title: "第三站 · 昇腾硬件、算子与通信基座",
    subtitle: "Roofline 瓶颈判读、A2/A3/310P/950 架构、AI Core 与 HCCL 原语",
    ids: CORE_26_IDS.slice(13, 19),
    offset: 14,
  },
  {
    id: "stage-4",
    title: "第四站 · 多卡并行与冷启动调参",
    subtitle: "TP / PP / DP / EP 四维切分、冷启动 7 级显存账与核心 CLI 参数",
    ids: CORE_26_IDS.slice(19, 26),
    offset: 20,
  },
];

const CORE_CARD_VISIBLE_LIMIT = 4;

const CHAPTER_SHORT_LABEL: Readonly<Record<string, string>> = {
  guide: "全景与上线",
  models: "单层与多模态",
  inference: "调度与 KV",
  hardware: "硬件与量化",
  distributed: "并行与通信",
  disaggregation: "PD 与外置 KV",
  architecture: "两仓与图编译",
  performance: "基准与调参",
  cases: "异构全案",
  references: "版本与档案",
  rfork: "RFork 专题",
  params: "参数字典",
};

const QUICK_CHIP_VISIBLE_LIMIT = 8;

interface ParamQuickMeta {
  readonly flag: string;
  readonly tag: string;
  readonly trap: string;
  readonly toolLabel: string;
  readonly toolHref: string;
}

const PARAM_HUB_META: Readonly<Record<string, ParamQuickMeta>> = {
  "kv-cache-memory-profiling": {
    flag: "--gpu-memory-utilization",
    tag: "显存总闸门",
    trap: "⚠️ 910B3 上盲调至 0.95+ 极易在 ACLGraph 录图期挤爆 1−u 余量触发 OOM；预留不足时也会直接卡死单条 max-model-len 准入。",
    toolLabel: "一键带入部署算账台试算 →",
    toolHref: "#/tools?tab=calculator",
  },
  "core-cli-params": {
    flag: "--max-num-batched-tokens / --max-model-len",
    tag: "批预算与并发",
    trap: "⚠️ 昇腾 v0.30.0 未显式传 --max-num-batched-tokens 时按 6 分支规则自动回落（并非固定 2048），照搬 GPU 脚本易致 TTFT/ITL 失衡。",
    toolLabel: "一键去配置体检台排雷 →",
    toolHref: "#/tools?tab=doctor",
  },
  "acl-graph": {
    flag: "ACLGraph / cudagraph_mode",
    tag: "Host 下发加速",
    trap: "⚠️ 若残留旧版 --enforce-eager 会彻底关闭静态图重放导致 Decode 吞吐腰斩；动态算子会触发 PIECEWISE 断图。",
    toolLabel: "一键去配置体检台排雷 →",
    toolHref: "#/tools?tab=doctor",
  },
  "hccl-buffer": {
    flag: "HCCL_BUFFSIZE / hccl_buffer",
    tag: "通信区显存",
    trap: "⚠️ 多卡日志刷屏 EI0006 通信超时往往是次生假象——真正首错常是某张 Rank 先因通信区或录图余量超支 OOM 退出。",
    toolLabel: "一键去在线排障台定位首错 →",
    toolHref: "#/tools?tab=troubleshoot",
  },
  "ascend-config-system": {
    flag: "--additional-config",
    tag: "三层覆盖规则",
    trap: "⚠️ 命令行参数、--additional-config JSON 与环境变量存在覆盖优先级差异；升级 v0.30.0 时残留已删旧键会直接启动硬报错。",
    toolLabel: "一键用版本升级雷达扫描 →",
    toolHref: "#/tools?tab=doctor&fromVer=v0.23.0&ver=v0.30.0",
  },
  "npugraph-ex": {
    flag: "npugraph_ex / 编译图融合",
    tag: "图内算子融合",
    trap: "⚠️ 融合规则受 dtype 与形状约束；在 310P 等不支持 npugraph_ex 的卡型上强开会直接触发启动拦截。",
    toolLabel: "一键去配置体检台排雷 →",
    toolHref: "#/tools?tab=doctor",
  },
  "cpu-binding": {
    flag: "CPU 绑核 / NUMA 亲和",
    tag: "Host 派发延迟",
    trap: "⚠️ 跨 NUMA 远端访存会拖慢 Worker 张量准备与算子下发，在小批 Decode 下直接放大卡间等待空泡。",
    toolLabel: "一键去配置体检台排雷 →",
    toolHref: "#/tools?tab=doctor",
  },
  "ascend-env-and-serve": {
    flag: "ASCEND_RT_VISIBLE_DEVICES / --shm-size",
    tag: "容器起服基线",
    trap: "⚠️ Atlas A3 双 Die 卡须成对映射裸片并调大 --shm-size；容器内存不足触发的 Exit 137 (-9) 常被误判为 NPU OOM。",
    toolLabel: "一键去故障演练场实操 →",
    toolHref: "#/tools?tab=wargame",
  },
};

const GENERIC_TITLE_PREFIXES = new Set(["我们的部署", "问答记录", "源码导读", "PR 档案", "故障复盘"]);

function compactPageTitle(entry: RegistryEntry): string {
  const full = pageDisplayTitle(entry);
  if (entry.type === "param") {
    const dotIdx = full.lastIndexOf(".");
    return dotIdx > 0 && dotIdx < full.length - 2 ? full.slice(dotIdx + 1) : full;
  }
  const colonMatch = /[：:]\s*/.exec(full);
  if (colonMatch && colonMatch.index >= 2) {
    const before = full.slice(0, colonMatch.index).trim();
    const after = full.slice(colonMatch.index + colonMatch[0].length).trim();
    if (GENERIC_TITLE_PREFIXES.has(before) && after.length > 0) {
      return after.length > 22 ? `${after.slice(0, 21)}…` : after;
    }
    if (colonMatch.index <= 24) {
      return before;
    }
  }
  return full.length > 24 ? `${full.slice(0, 23)}…` : full;
}

function deriveParamQuickMeta(entry: RegistryEntry): ParamQuickMeta {
  const hub = PARAM_HUB_META[entry.id];
  if (hub) return hub;

  const s = `${entry.title} ${entry.summary}`;
  const isLegacy = /旧版|已移除|历史回退|v0\.23\.0|曾用于/.test(s);
  const tag = isLegacy
    ? "历史/迁移键"
    : /STAIR|eplb|replica|balance/i.test(s)
      ? "STAIR 专家均衡"
      : /compilation|super_kernel|fuse|graph/i.test(s)
        ? "图编译开关"
        : /kv|offload|pcp|dcp|sfa/i.test(s)
          ? "KV 与长序列"
          : "细粒度开关";
  const trap = isLegacy
    ? `⚠️ 版本迁移风险：${entry.summary.slice(0, 86)}${entry.summary.length > 86 ? "…" : ""}（升级 v0.30.0 请先用迁移雷达核验）。`
    : `⚠️ 调参边界：${entry.summary.slice(0, 92)}${entry.summary.length > 92 ? "…" : ""}`;
  return {
    flag: compactPageTitle(entry),
    tag,
    trap,
    toolLabel: isLegacy ? "一键用版本升级雷达扫描 →" : "一键去配置体检台校验 →",
    toolHref: isLegacy ? "#/tools?tab=doctor&fromVer=v0.23.0&ver=v0.30.0" : "#/tools?tab=doctor",
  };
}

function isSecondaryReferenceEntry(entry: RegistryEntry | undefined): boolean {
  if (!entry) return false;
  return entry.type === "source" || entry.type === "pr" || entry.origin === "chat";
}

function matchesSearchQuery(entry: RegistryEntry, rawQuery: string): boolean {
  const q = rawQuery.trim().toLocaleLowerCase();
  if (!q) return true;
  const hubMeta = PARAM_HUB_META[entry.id];
  return [
    entry.id,
    entry.title,
    pageDisplayTitle(entry),
    entry.summary,
    ...(hubMeta ? [hubMeta.flag, hubMeta.tag, hubMeta.trap] : []),
    ...entry.aliases,
  ].some((field) => field.toLocaleLowerCase().includes(q));
}

export function resolveAlignedGraphEdges(options: {
  readonly revision: string;
  readonly mode: "build" | "local";
  readonly pages: readonly RegistryEntry[];
  readonly skipped?: ReadonlySet<string> | undefined;
  readonly graph: ReaderGraph | undefined;
}): { readonly ready: boolean; readonly edges: WikiGraphEdge[] } {
  const { revision, mode, pages, skipped, graph } = options;
  const graphMatches = graph?.revision === revision;
  const liveHydratedIds = new Set<string>();
  const rawEdges: WikiGraphEdge[] = [];

  if (mode === "local") {
    for (const page of pages) {
      if (page.relations.length > 0) {
        liveHydratedIds.add(page.id);
        for (const rel of page.relations) {
          rawEdges.push({ from: page.id, to: rel.to, kind: rel.kind, note: rel.note });
        }
      }
    }
  }

  if (graphMatches) {
    for (const edge of graph.edges) {
      if (!liveHydratedIds.has(edge.from)) rawEdges.push(edge);
    }
  } else if (rawEdges.length === 0) {
    return { ready: false, edges: [] };
  }

  const seen = new Set<string>();
  const normalized: WikiGraphEdge[] = [];
  for (const edge of rawEdges) {
    const from = resolveCanonicalPageId(pages, edge.from, skipped);
    const to = resolveCanonicalPageId(pages, edge.to, skipped);
    if (!from || !to || from === to) continue;
    const key = `${from}\0${to}\0${edge.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({ from, to, kind: edge.kind, note: edge.note });
  }
  return {
    ready: Boolean(graphMatches || (mode === "local" && liveHydratedIds.size > 0)),
    edges: normalized,
  };
}

/** 统计单向有向边与去重对称边总数，绝不把声明边与反向边相加重复计数 */
export function countUniqueCausalEdges(edges: readonly WikiGraphEdge[]): number {
  const seen = new Set<string>();
  for (const e of edges) {
    if (isSymmetric(e.kind)) {
      const [a, b] = e.from < e.to ? [e.from, e.to] : [e.to, e.from];
      seen.add(`sym\0${a}\0${b}\0${e.kind}`);
    } else {
      seen.add(`dir\0${e.from}\0${e.to}\0${e.kind}`);
    }
  }
  return seen.size;
}

/**
 * 基于单向声明边列表构造 focusId 的出边与派生入边，直接复用 neighborhood() 生成三栏：
 * 左栏 foundations（builds-on / variant-of）、右栏上半 dependents（enables / has-variant）、
 * 右栏下半 siblings（conflicts-with / alternative-to）。
 */
export function buildCausalNeighborhood(
  focusId: string,
  normalizedEdges: readonly WikiGraphEdge[],
): EnrichedCausalNeighborhood {
  const outRelations: Relation[] = [];
  const inBacklinks: Backlink[] = [];
  const foundationKinds = new Map<string, CausalFoundationKind>();
  const dependentKinds = new Map<string, CausalDependentKind>();
  const siblingKinds = new Map<string, CausalSiblingKind>();

  for (const edge of normalizedEdges) {
    if (edge.from === focusId) {
      outRelations.push({ to: edge.to, kind: edge.kind, note: edge.note });
      if (edge.kind === "builds-on" || edge.kind === "variant-of") {
        if (!foundationKinds.has(edge.to)) foundationKinds.set(edge.to, edge.kind);
      } else if (edge.kind === "conflicts-with" || !siblingKinds.has(edge.to)) {
        siblingKinds.set(edge.to, edge.kind);
      }
    } else if (edge.to === focusId) {
      const inv = INVERSE_KIND[edge.kind];
      inBacklinks.push({ from: edge.from, kind: inv, note: edge.note });
      if (inv === "enables" || inv === "has-variant") {
        if (!dependentKinds.has(edge.from)) dependentKinds.set(edge.from, inv);
      } else if (edge.kind === "conflicts-with" || !siblingKinds.has(edge.from)) {
        siblingKinds.set(edge.from, edge.kind === "conflicts-with" ? "conflicts-with" : "alternative-to");
      }
    }
  }

  const base = neighborhood(outRelations, inBacklinks);
  return {
    foundations: base.foundations.map((item) => ({
      id: item.id,
      kind: foundationKinds.get(item.id) ?? "builds-on",
      note: item.note,
    })),
    dependents: base.dependents.map((item) => ({
      id: item.id,
      kind: dependentKinds.get(item.id) ?? "enables",
      note: item.note,
    })),
    siblings: base.siblings.map((item) => ({
      id: item.id,
      kind: siblingKinds.get(item.id) ?? "alternative-to",
      note: item.note,
    })),
  };
}

export function matchesGraphFilter(page: RegistryEntry, filter: GraphFilterMode): boolean {
  if (filter === "core-26") return CORE_26_SET.has(page.id);
  if (filter === "params") return isParamBlastRadiusPage(page);
  return true;
}

export function resolveGraphFocus(options: {
  readonly requestedFocusId?: string | undefined;
  readonly filter: GraphFilterMode;
  readonly pages: readonly RegistryEntry[];
  readonly toc: readonly TocPart<RegistryEntry>[];
  readonly skipped?: ReadonlySet<string> | undefined;
}): { readonly focusId: string | undefined; readonly missingRequestedId: string | undefined } {
  const { requestedFocusId, filter, pages, toc, skipped } = options;
  const trimmed = requestedFocusId?.trim();
  let filteredOutValidPage = false;
  if (trimmed) {
    const resolved = resolveCanonicalPageId(pages, trimmed, skipped);
    if (resolved) {
      const resolvedEntry = pages.find((p) => p.id === resolved);
      if (filter !== "params" || (resolvedEntry && matchesGraphFilter(resolvedEntry, filter))) {
        return { focusId: resolved, missingRequestedId: undefined };
      }
      filteredOutValidPage = true;
    }
  }
  const ordered = toc.flatMap((part) => part.sections.flatMap((sec) => sec.pages));
  const pool = ordered.length > 0 ? ordered : pages;
  const preferredIds =
    filter === "params"
      ? ["core-cli-params", "acl-graph", "kv-cache-memory-profiling", "ascend-env-and-serve"]
      : ["kv-cache", "request-overview", "paged-attention", "core-cli-params"];
  for (const candidate of preferredIds) {
    const match = pool.find((p) => p.id === candidate);
    if (match && matchesGraphFilter(match, filter)) {
      return {
        focusId: candidate,
        missingRequestedId: filteredOutValidPage ? undefined : trimmed || undefined,
      };
    }
  }
  const firstMatching =
    filter === "all"
      ? (pool.find((p) => matchesGraphFilter(p, filter)) ?? pool[0])
      : pool.find((p) => matchesGraphFilter(p, filter));
  return {
    focusId: firstMatching?.id,
    missingRequestedId: filteredOutValidPage ? undefined : trimmed || undefined,
  };
}

export function WikiViewSwitch({
  activeView,
  focusId,
  mode,
  compact = false,
  onNavigate,
  testId = "wiki-view-switch",
}: {
  activeView: "directory" | "graph";
  focusId?: string | undefined;
  mode?: GraphFilterMode | undefined;
  compact?: boolean | undefined;
  onNavigate?: (() => void) | undefined;
  testId?: string | undefined;
}) {
  const graphParams = new URLSearchParams();
  graphParams.set("view", "graph");
  if (mode) graphParams.set("mode", mode);
  if (focusId) graphParams.set("focus", focusId);
  const graphHref = `/wiki?${graphParams.toString()}`;
  const directoryParams = new URLSearchParams();
  if (mode) {
    directoryParams.set("mode", mode);
    if (focusId) directoryParams.set("focus", focusId);
  }
  const directoryHref = directoryParams.size > 0 ? `/wiki?${directoryParams.toString()}` : "/wiki";
  return (
    <nav
      className={`wiki-graph-view-switch${compact ? " is-compact" : ""}`}
      data-testid={testId}
      aria-label="主章节视图切换"
    >
      <Link
        className={`wiki-graph-view-pill${activeView === "directory" ? " is-active" : ""}`}
        aria-current={activeView === "directory" ? "page" : undefined}
        to={directoryHref}
        onClick={onNavigate}
      >
        <BookOpen size={14} aria-hidden="true" />
        主题目录总览
      </Link>
      <Link
        className={`wiki-graph-view-pill${activeView === "graph" ? " is-active" : ""}`}
        aria-current={activeView === "graph" ? "page" : undefined}
        to={graphHref}
        onClick={onNavigate}
      >
        <Network size={14} aria-hidden="true" />
        因果星图
      </Link>
    </nav>
  );
}

function splitNeighborPriority<K extends string>(
  items: readonly CausalNeighborItem<K>[],
  pagesById: ReadonlyMap<string, RegistryEntry>,
  expanded: boolean,
): {
  readonly shown: readonly CausalNeighborItem<K>[];
  readonly extra: readonly CausalNeighborItem<K>[];
} {
  const primary: CausalNeighborItem<K>[] = [];
  const secondary: CausalNeighborItem<K>[] = [];
  for (const item of items) {
    if (isSecondaryReferenceEntry(pagesById.get(item.id))) {
      secondary.push(item);
    } else {
      primary.push(item);
    }
  }
  const ordered = [...primary, ...secondary];
  if (expanded) return { shown: ordered, extra: [] };

  const shown = primary.slice(0, CORE_CARD_VISIBLE_LIMIT);
  const shownIds = new Set(shown.map((x) => x.id));
  return {
    shown,
    extra: ordered.filter((x) => !shownIds.has(x.id)),
  };
}

function CausalNeighborCard({
  item,
  target,
  isRead,
  tone,
  onSelectFocus,
}: {
  item: CausalNeighborItem;
  target: RegistryEntry | undefined;
  isRead: boolean;
  tone: "foundation" | "dependent" | "sibling";
  onSelectFocus: (id: string) => void;
}) {
  const shortTitle = target ? compactPageTitle(target) : item.id;
  const fullTitle = target ? pageDisplayTitle(target) : item.id;
  const isConflict = item.kind === "conflicts-with";
  return (
    <li
      className={`wiki-graph-card is-${tone}${isConflict ? " is-conflict" : ""}`}
      data-testid={`causal-card-${item.id}`}
      data-relation-kind={item.kind}
      title={fullTitle}
    >
      <div className="wiki-graph-card-head-row">
        <button
          type="button"
          className="wiki-graph-card-focus"
          data-testid={`causal-focus-${item.id}`}
          onClick={() => onSelectFocus(item.id)}
        >
          <span>
            {isConflict ? "⚠️ " : isRead ? "✓ " : ""}
            {shortTitle}
          </span>
        </button>
        <Link className="wiki-graph-open-link" to={`/wiki/${item.id}`} title={`阅读《${fullTitle}》`}>
          正文 <ArrowRight size={11} aria-hidden="true" />
        </Link>
      </div>
      <p className="wiki-graph-note">{item.note}</p>
    </li>
  );
}

interface MeasuredWireSegment {
  readonly id: string;
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

function CausalFlowWiresSvg({
  stageElRef,
  focusId,
  leftIds,
  rightIds,
}: {
  stageElRef: { readonly current: HTMLDivElement | null };
  focusId: string;
  leftIds: readonly string[];
  rightIds: readonly string[];
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const leftMark = `${uid}-arrow-kv`;
  const rightMark = `${uid}-arrow-tok`;
  const [measured, setMeasured] = useState<{
    readonly w: number;
    readonly h: number;
    readonly left: readonly MeasuredWireSegment[];
    readonly right: readonly MeasuredWireSegment[];
  } | null>(null);

  const leftKey = leftIds.join(",");
  const rightKey = rightIds.join(",");

  // biome-ignore lint/correctness/useExhaustiveDependencies: Re-measure DOM rects whenever focus or visible neighbor IDs change.
  useEffect(() => {
    const stage = stageElRef.current;
    if (!stage) return;

    const escapeId = (raw: string) =>
      typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(raw)
        : raw.replace(/[^a-zA-Z0-9_-]/g, "\\$&");

    const compute = () => {
      const stageRect = stage.getBoundingClientRect();
      const focusEl = stage.querySelector<HTMLElement>(
        '[data-testid="causal-col-focus"] .wiki-graph-focus-card',
      );
      if (!focusEl || stageRect.width < 400 || stageRect.height < 80) {
        setMeasured(null);
        return;
      }
      const focusRect = focusEl.getBoundingClientRect();
      // Only draw horizontal inter-column wires when columns are laid out side-by-side
      if (focusRect.left - stageRect.left < 60) {
        setMeasured(null);
        return;
      }

      const focusTop = focusRect.top - stageRect.top;
      const focusHeight = focusRect.height;
      const focusMidY = focusTop + Math.min(focusHeight * 0.46, 170);
      const clampFocusY = (y: number) => Math.max(focusTop + 28, Math.min(focusTop + focusHeight - 28, y));

      const leftSegs: MeasuredWireSegment[] = [];
      const lStep = leftIds.length > 1 ? Math.min(20, (focusHeight * 0.5) / (leftIds.length - 1)) : 0;
      leftIds.forEach((id, idx) => {
        const card = stage.querySelector<HTMLElement>(
          `[data-testid="causal-col-foundations"] [data-testid="causal-card-${escapeId(id)}"]`,
        );
        if (!card) return;
        const r = card.getBoundingClientRect();
        leftSegs.push({
          id,
          x0: r.right - stageRect.left + 1,
          y0: r.top + r.height / 2 - stageRect.top,
          x1: focusRect.left - stageRect.left - 4,
          y1: clampFocusY(focusMidY + (idx - (leftIds.length - 1) / 2) * lStep),
        });
      });

      const rightSegs: MeasuredWireSegment[] = [];
      const rStep = rightIds.length > 1 ? Math.min(18, (focusHeight * 0.56) / (rightIds.length - 1)) : 0;
      rightIds.forEach((id, idx) => {
        const card = stage.querySelector<HTMLElement>(
          `[data-testid="causal-col-downstream"] [data-testid="causal-card-${escapeId(id)}"]`,
        );
        if (!card) return;
        const r = card.getBoundingClientRect();
        rightSegs.push({
          id,
          x0: focusRect.right - stageRect.left + 1,
          y0: clampFocusY(focusMidY + (idx - (rightIds.length - 1) / 2) * rStep),
          x1: r.left - stageRect.left - 4,
          y1: r.top + r.height / 2 - stageRect.top,
        });
      });

      setMeasured({
        w: Math.max(1, Math.round(stageRect.width)),
        h: Math.max(1, Math.round(stageRect.height)),
        left: leftSegs,
        right: rightSegs,
      });
    };

    compute();
    const rafId = requestAnimationFrame(compute);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(compute) : null;
    ro?.observe(stage);
    return () => {
      cancelAnimationFrame(rafId);
      ro?.disconnect();
    };
  }, [stageElRef, focusId, leftKey, rightKey]);

  const leftNodes = leftIds.length;
  const rightNodes = rightIds.length;
  const spanY = (idx: number, count: number) => {
    if (count <= 1) return 145;
    const top = count <= 4 ? 66 : 24;
    const bottom = count <= 4 ? 224 : 266;
    return top + ((bottom - top) * idx) / (count - 1);
  };
  const centerY = (idx: number, count: number) => {
    if (count <= 1) return 135;
    const step = Math.min(10, 96 / (count - 1));
    return 135 + (idx - (count - 1) / 2) * step;
  };

  const fallbackLeft: readonly MeasuredWireSegment[] = leftIds.map((id, i) => ({
    id,
    x0: 301,
    y0: spanY(i, leftNodes),
    x1: 339,
    y1: centerY(i, leftNodes),
  }));
  const fallbackRight: readonly MeasuredWireSegment[] = rightIds.map((id, i) => ({
    id,
    x0: 661,
    y0: centerY(i, rightNodes),
    x1: 699,
    y1: spanY(i, rightNodes),
  }));

  const activeLeft = measured ? measured.left : fallbackLeft;
  const activeRight = measured ? measured.right : fallbackRight;

  return (
    <svg
      className="wiki-causal-wires"
      viewBox={measured ? `0 0 ${measured.w} ${measured.h}` : "0 0 1000 290"}
      preserveAspectRatio={measured ? undefined : "none"}
      aria-hidden="true"
    >
      <defs>
        <marker
          id={leftMark}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M 1 1 L 9 5 L 1 9 z" fill="var(--color-kv)" />
        </marker>
        <marker
          id={rightMark}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M 1 1 L 9 5 L 1 9 z" fill="var(--color-token)" />
        </marker>
      </defs>
      {activeLeft.map((seg) => {
        const dx = Math.max(14, (seg.x1 - seg.x0) * 0.52);
        return (
          <g key={`l-${seg.id}`}>
            <circle cx={seg.x0} cy={seg.y0} r="2.6" fill="var(--color-kv)" opacity="0.78" />
            <path
              d={`M ${seg.x0} ${seg.y0} C ${seg.x0 + dx} ${seg.y0}, ${seg.x1 - dx} ${seg.y1}, ${seg.x1} ${seg.y1}`}
              fill="none"
              stroke="var(--color-kv)"
              strokeWidth="1.9"
              strokeDasharray="4.5 3.5"
              opacity="0.82"
              markerEnd={`url(#${leftMark})`}
            />
          </g>
        );
      })}
      {activeRight.map((seg) => {
        const dx = Math.max(14, (seg.x1 - seg.x0) * 0.52);
        return (
          <g key={`r-${seg.id}`}>
            <circle cx={seg.x0} cy={seg.y0} r="2.6" fill="var(--color-token)" opacity="0.85" />
            <path
              d={`M ${seg.x0} ${seg.y0} C ${seg.x0 + dx} ${seg.y0}, ${seg.x1 - dx} ${seg.y1}, ${seg.x1} ${seg.y1}`}
              fill="none"
              stroke="var(--color-token)"
              strokeWidth="2.0"
              opacity="0.88"
              markerEnd={`url(#${rightMark})`}
            />
          </g>
        );
      })}
    </svg>
  );
}

function CausalFlowStage({
  focusPage,
  focusChapterLabel,
  causal,
  pagesById,
  canonicalReadIds,
  onSelectFocus,
  onToggleFocusRead,
}: {
  focusPage: RegistryEntry;
  focusChapterLabel: string | undefined;
  causal: EnrichedCausalNeighborhood;
  pagesById: ReadonlyMap<string, RegistryEntry>;
  canonicalReadIds: ReadonlySet<string>;
  onSelectFocus: (id: string) => void;
  onToggleFocusRead: (id: string) => void;
}) {
  const [showAllLeft, setShowAllLeft] = useState(false);
  const [showAllRight, setShowAllRight] = useState(false);
  const stageElRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Reset secondary expansion whenever user switches focus node.
  useEffect(() => {
    setShowAllLeft(false);
    setShowAllRight(false);
  }, [focusPage.id]);

  const leftSplit = useMemo(
    () => splitNeighborPriority(causal.foundations, pagesById, showAllLeft),
    [causal.foundations, pagesById, showAllLeft],
  );
  const rightSplit = useMemo(
    () => splitNeighborPriority(causal.dependents, pagesById, showAllRight),
    [causal.dependents, pagesById, showAllRight],
  );

  const isFocusRead = canonicalReadIds.has(focusPage.id);
  const isCore = CORE_26_SET.has(focusPage.id);
  const isParamHub = isParamBlastRadiusPage(focusPage);

  return (
    <div className="wiki-causal-flow-wrap">
      <div ref={stageElRef} className="wiki-causal-flow-stage" data-testid="wiki-causal-flow-stage">
        <CausalFlowWiresSvg
          stageElRef={stageElRef}
          focusId={focusPage.id}
          leftIds={leftSplit.shown.map((x) => x.id)}
          rightIds={rightSplit.shown.map((x) => x.id)}
        />
        <div className="wiki-graph-triad" data-testid="wiki-causal-triad">
          <section className="wiki-graph-col is-foundations" data-testid="causal-col-foundations">
            <header className="wiki-graph-col-head">
              <div className="wiki-graph-col-title-row">
                <span className="wiki-graph-col-pill is-foundation">① 看不懂？先补这几篇</span>
                <span className="wiki-graph-col-count">{causal.foundations.length}</span>
              </div>
            </header>
            {leftSplit.shown.length > 0 ? (
              <ul className="wiki-graph-card-list">
                {leftSplit.shown.map((item) => (
                  <CausalNeighborCard
                    key={item.id}
                    item={item}
                    target={pagesById.get(item.id)}
                    isRead={canonicalReadIds.has(item.id)}
                    tone="foundation"
                    onSelectFocus={onSelectFocus}
                  />
                ))}
              </ul>
            ) : (
              <p className="wiki-graph-empty-note">
                {leftSplit.extra.length > 0
                  ? `核心前置概念已无更多依赖；下方保留 ${leftSplit.extra.length} 条源码/PR 档案，需要时可展开查看。`
                  : "当前节点已是最底层起步概念，可直接开读。"}
              </p>
            )}
          </section>

          <section className="wiki-graph-col is-focus" data-testid="causal-col-focus">
            <div className="wiki-graph-focus-card" data-testid={`focus-node-${focusPage.id}`}>
              <div className="wiki-graph-focus-badges">
                <span className="wiki-graph-focus-eyebrow">当前聚焦词条</span>
                {focusChapterLabel && <span className="wiki-graph-chapter-pill">{focusChapterLabel}</span>}
                {isCore && (
                  <span className="wiki-graph-core-badge" data-testid="focus-core26-badge">
                    Core-26
                  </span>
                )}
                {isParamHub && <span className="wiki-graph-param-badge">调参关键页</span>}
              </div>
              <h2 className="wiki-graph-focus-title" title={pageDisplayTitle(focusPage)}>
                {compactPageTitle(focusPage)}
              </h2>
              <p className="wiki-graph-focus-summary">{focusPage.summary}</p>
              <div className="wiki-graph-focus-actions">
                <button
                  type="button"
                  className={`wiki-graph-read-btn${isFocusRead ? " is-read" : ""}`}
                  data-testid="focus-read-toggle"
                  aria-pressed={isFocusRead}
                  onClick={() => onToggleFocusRead(focusPage.id)}
                >
                  {isFocusRead ? (
                    <CheckCircle2 size={13} aria-hidden="true" />
                  ) : (
                    <Circle size={13} aria-hidden="true" />
                  )}
                  {isFocusRead ? "已读" : "标记已读"}
                </button>
                <Link
                  className="wiki-graph-primary-link"
                  data-testid="focus-read-article"
                  to={`/wiki/${focusPage.id}`}
                >
                  阅读正文 <ArrowRight size={13} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </section>

          <section className="wiki-graph-col is-downstream" data-testid="causal-col-downstream">
            <header className="wiki-graph-col-head">
              <div className="wiki-graph-col-title-row">
                <span className="wiki-graph-col-pill is-dependent">② 读懂后，解锁这些进阶</span>
                <span className="wiki-graph-col-count">{causal.dependents.length}</span>
              </div>
            </header>
            {rightSplit.shown.length > 0 ? (
              <ul className="wiki-graph-card-list">
                {rightSplit.shown.map((item) => (
                  <CausalNeighborCard
                    key={item.id}
                    item={item}
                    target={pagesById.get(item.id)}
                    isRead={canonicalReadIds.has(item.id)}
                    tone="dependent"
                    onSelectFocus={onSelectFocus}
                  />
                ))}
              </ul>
            ) : (
              <p className="wiki-graph-empty-note">
                {rightSplit.extra.length > 0
                  ? `当前已无更多核心进阶页；下方保留 ${rightSplit.extra.length} 条源码问答/PR 记录，可展开查看。`
                  : "当前已处于链路终端实践或特化专题页。"}
              </p>
            )}
          </section>
        </div>
      </div>

      <div className="wiki-graph-stage-foot">
        <div className="wiki-graph-stage-foot-left" data-testid="causal-sub-siblings">
          {causal.siblings.length > 0 ? (
            <>
              <span className="wiki-graph-col-pill is-sibling">
                <AlertTriangle size={12} aria-hidden="true" /> 互斥 / 替代（{causal.siblings.length}）
              </span>
              {causal.siblings.map((item) => {
                const target = pagesById.get(item.id);
                const label = target ? compactPageTitle(target) : item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="wiki-param-mech-chip"
                    data-relation-kind={item.kind}
                    onClick={() => onSelectFocus(item.id)}
                    title={item.note}
                  >
                    {item.kind === "conflicts-with" ? "⚠️ " : "⇄ "}
                    {label}：{item.note}
                  </button>
                );
              })}
            </>
          ) : (
            <span>
              默认仅展示核心机制脉络
              {leftSplit.extra.length + rightSplit.extra.length > 0
                ? `（已自动折叠 ${leftSplit.extra.length + rightSplit.extra.length} 条问答/PR 旁支）`
                : "（当前节点无互斥参数冲突）"}
            </span>
          )}
        </div>
        <div className="wiki-graph-stage-foot-right">
          {(leftSplit.extra.length > 0 || showAllLeft) && (
            <button
              type="button"
              className="wiki-graph-more-btn"
              data-testid="toggle-extra-foundations"
              onClick={() => setShowAllLeft((v) => !v)}
            >
              {showAllLeft ? (
                <>
                  <ChevronUp size={12} aria-hidden="true" /> 收起补充前置项
                </>
              ) : (
                <>
                  <ChevronDown size={12} aria-hidden="true" /> 展开其余 {leftSplit.extra.length} 条前置/档案
                </>
              )}
            </button>
          )}
          {(rightSplit.extra.length > 0 || showAllRight) && (
            <button
              type="button"
              className="wiki-graph-more-btn"
              data-testid="toggle-extra-dependents"
              onClick={() => setShowAllRight((v) => !v)}
            >
              {showAllRight ? (
                <>
                  <ChevronUp size={12} aria-hidden="true" /> 收起旁支记录
                </>
              ) : (
                <>
                  <ChevronDown size={12} aria-hidden="true" /> 展开其余 {rightSplit.extra.length}{" "}
                  条进阶/源码问答旁支
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickTopicPicker({
  toc,
  pages,
  focusId,
  nodeQuery,
  canonicalReadIds,
  foundationSet,
  dependentSet,
  onSelectFocus,
  onClearQuery,
}: {
  toc: readonly TocPart<RegistryEntry>[];
  pages: readonly RegistryEntry[];
  focusId: string | undefined;
  nodeQuery: string;
  canonicalReadIds: ReadonlySet<string>;
  foundationSet: ReadonlySet<string>;
  dependentSet: ReadonlySet<string>;
  onSelectFocus: (id: string) => void;
  onClearQuery: () => void;
}) {
  const focusChapterIdx = useMemo(() => {
    if (!focusId) return 0;
    const idx = toc.findIndex((p) => p.sections.some((s) => s.pages.some((entry) => entry.id === focusId)));
    return idx >= 0 ? idx : 0;
  }, [toc, focusId]);

  const [selectedPartId, setSelectedPartId] = useState<string>(
    () => toc[focusChapterIdx]?.id ?? toc[0]?.id ?? "",
  );
  const [expandChapterChips, setExpandChapterChips] = useState(false);
  const chapterTabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (toc[focusChapterIdx]) {
      setSelectedPartId(toc[focusChapterIdx]!.id);
      setExpandChapterChips(false);
    }
  }, [toc, focusChapterIdx]);

  const trimmedQuery = nodeQuery.trim();
  const matchedPages = useMemo(() => {
    if (!trimmedQuery) return [];
    const hits = pages.filter((p) => matchesSearchQuery(p, trimmedQuery));
    hits.sort((a, b) => Number(isSecondaryReferenceEntry(a)) - Number(isSecondaryReferenceEntry(b)));
    return hits;
  }, [pages, trimmedQuery]);

  if (trimmedQuery) {
    return (
      <div className="wiki-graph-picker" data-testid="causal-search-picker">
        <div className="wiki-graph-picker-head">
          <span>
            实时匹配「<strong>{trimmedQuery}</strong>」共 <strong>{matchedPages.length}</strong>{" "}
            个词条（点选直接切换下方因果图）
          </span>
          <button type="button" className="wiki-graph-clear-link" onClick={onClearQuery}>
            清空搜索
          </button>
        </div>
        {matchedPages.length > 0 ? (
          <ul className="wiki-graph-station-list">
            {matchedPages.slice(0, 18).map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  className={`wiki-graph-station${entry.id === focusId ? " is-focused" : ""}${canonicalReadIds.has(entry.id) ? " is-read" : ""}`}
                  title={pageDisplayTitle(entry)}
                  onClick={() => onSelectFocus(entry.id)}
                >
                  <span className="wiki-graph-station-dot" aria-hidden="true" />
                  <span className="wiki-graph-station-name">{compactPageTitle(entry)}</span>
                  <span className="wiki-graph-station-badge">{TYPE_LABEL[entry.type] ?? entry.type}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="wiki-graph-empty-note">全库没有匹配「{trimmedQuery}」的词条，可换个关键词试试。</p>
        )}
      </div>
    );
  }

  const activePart = toc.find((p) => p.id === selectedPartId) ?? toc[0];
  const chapterPages = activePart ? activePart.sections.flatMap((s) => s.pages) : [];
  const visibleChapterPages = expandChapterChips
    ? chapterPages
    : chapterPages.slice(0, QUICK_CHIP_VISIBLE_LIMIT);

  return (
    <div className="wiki-graph-picker" data-testid="causal-chapter-picker">
      <div className="wiki-graph-chapter-tabs" role="tablist" aria-label="按章节速选词条">
        {toc.map((part, idx) => {
          const active = activePart?.id === part.id;
          const shortTitle =
            CHAPTER_SHORT_LABEL[part.id] ?? part.title.split("、")[0]?.slice(0, 8) ?? part.title;
          return (
            <button
              key={part.id}
              id={`causal-part-tab-${part.id}`}
              ref={(el) => {
                chapterTabRefs.current[idx] = el;
              }}
              type="button"
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              aria-controls="causal-chapter-tabpanel"
              className={`wiki-graph-chapter-tab${active ? " is-active" : ""}`}
              onClick={() => {
                setSelectedPartId(part.id);
                setExpandChapterChips(false);
              }}
              onKeyDown={(e) => {
                let targetIdx: number | null = null;
                if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                  targetIdx = (idx + 1) % toc.length;
                } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                  targetIdx = (idx - 1 + toc.length) % toc.length;
                } else if (e.key === "Home") {
                  targetIdx = 0;
                } else if (e.key === "End") {
                  targetIdx = toc.length - 1;
                }
                if (targetIdx === null || !toc[targetIdx]) return;
                e.preventDefault();
                setSelectedPartId(toc[targetIdx]!.id);
                setExpandChapterChips(false);
                chapterTabRefs.current[targetIdx]?.focus();
              }}
            >
              <span>{String(idx + 1).padStart(2, "0")}</span>
              <span>{shortTitle}</span>
            </button>
          );
        })}
      </div>
      {activePart && (
        <div
          id="causal-chapter-tabpanel"
          role="tabpanel"
          aria-labelledby={`causal-part-tab-${activePart.id}`}
        >
          <ul className="wiki-graph-station-list">
            {visibleChapterPages.map((entry) => {
              const isFocused = entry.id === focusId;
              const isRead = canonicalReadIds.has(entry.id);
              const tone = foundationSet.has(entry.id)
                ? "is-foundation"
                : dependentSet.has(entry.id)
                  ? "is-dependent"
                  : "";
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    className={`wiki-graph-station${isFocused ? " is-focused" : ""}${isRead ? " is-read" : ""} ${tone}`.trim()}
                    title={pageDisplayTitle(entry)}
                    onClick={() => onSelectFocus(entry.id)}
                  >
                    <span className="wiki-graph-station-dot" aria-hidden="true" />
                    <span className="wiki-graph-station-name">{compactPageTitle(entry)}</span>
                    {CORE_26_SET.has(entry.id) && (
                      <span className="wiki-graph-station-badge is-core">C26</span>
                    )}
                  </button>
                </li>
              );
            })}
            {chapterPages.length > QUICK_CHIP_VISIBLE_LIMIT && (
              <li>
                <button
                  type="button"
                  className="wiki-graph-clear-link"
                  onClick={() => setExpandChapterChips((v) => !v)}
                >
                  {expandChapterChips
                    ? "收起 ▴"
                    : `其余 ${chapterPages.length - QUICK_CHIP_VISIBLE_LIMIT} 篇 ▾`}
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function SubwayPartitionsMap({
  toc,
  nodeQuery,
  focusId,
  foundationSet,
  dependentSet,
  conflictSet,
  alternativeSet,
  canonicalReadIds,
  onSelectStation,
}: {
  toc: readonly TocPart<RegistryEntry>[];
  nodeQuery: string;
  focusId: string | undefined;
  foundationSet: ReadonlySet<string>;
  dependentSet: ReadonlySet<string>;
  conflictSet: ReadonlySet<string>;
  alternativeSet: ReadonlySet<string>;
  canonicalReadIds: ReadonlySet<string>;
  onSelectStation: (id: string) => void;
}) {
  const visibleParts = toc
    .map((part, partIndex) => {
      const allPartPages = part.sections.flatMap((s) => s.pages);
      const readInPart = allPartPages.filter((p) => canonicalReadIds.has(p.id)).length;
      const sections = part.sections
        .map((section) => ({
          ...section,
          pages: section.pages.filter((p) => matchesSearchQuery(p, nodeQuery)),
        }))
        .filter((section) => section.pages.length > 0);
      return { part, partIndex, sections, totalInPart: allPartPages.length, readInPart };
    })
    .filter((entry) => entry.sections.length > 0);

  if (visibleParts.length === 0) {
    return (
      <p className="wiki-graph-empty-filter" role="status">
        当前搜索关键词没有匹配的章节词条，可清空搜索重试。
      </p>
    );
  }

  return (
    <div className="wiki-graph-partitions-grid" data-testid="wiki-graph-partitions">
      {visibleParts.map(({ part, partIndex, sections, totalInPart, readInPart }) => (
        <section key={part.id} className="wiki-graph-part" data-testid={`graph-part-${part.id}`}>
          <header className="wiki-graph-part-head">
            <span className="wiki-graph-part-num">{String(partIndex + 1).padStart(2, "0")}</span>
            <div className="wiki-graph-part-titles">
              <h3>{part.title}</h3>
              <p>{part.blurb}</p>
            </div>
            <small className="wiki-graph-part-progress">
              已读 {readInPart}/{totalInPart}
            </small>
          </header>
          <div className="wiki-graph-part-tracks">
            {sections.map((section) => (
              <div key={section.title} className="wiki-graph-track">
                <span className="wiki-graph-track-label">{section.title}</span>
                <ul className="wiki-graph-station-list">
                  {section.pages.map((entry) => {
                    const isFocused = entry.id === focusId;
                    const isRead = canonicalReadIds.has(entry.id);
                    const isCore = CORE_26_SET.has(entry.id);
                    const roleTag = foundationSet.has(entry.id)
                      ? "先补"
                      : dependentSet.has(entry.id)
                        ? "解锁"
                        : conflictSet.has(entry.id)
                          ? "互斥"
                          : alternativeSet.has(entry.id)
                            ? "替代"
                            : undefined;
                    const roleTone = foundationSet.has(entry.id)
                      ? "is-foundation"
                      : dependentSet.has(entry.id)
                        ? "is-dependent"
                        : conflictSet.has(entry.id)
                          ? "is-conflict"
                          : alternativeSet.has(entry.id)
                            ? "is-alternative"
                            : "";
                    return (
                      <li key={entry.id}>
                        <button
                          type="button"
                          className={`wiki-graph-station${isFocused ? " is-focused" : ""}${isRead ? " is-read" : ""} ${roleTone}`.trim()}
                          data-testid={`graph-node-${entry.id}`}
                          aria-pressed={isFocused}
                          onClick={() => onSelectStation(entry.id)}
                        >
                          <span className="wiki-graph-station-dot" aria-hidden="true" />
                          <span className="wiki-graph-station-name">{pageDisplayTitle(entry)}</span>
                          {isCore && <span className="wiki-graph-station-badge is-core">C26</span>}
                          {entry.type === "param" && (
                            <span className="wiki-graph-station-badge is-param">参数</span>
                          )}
                          {roleTag && (
                            <span className={`wiki-graph-station-badge ${roleTone}`}>{roleTag}</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Core26RoadmapView({
  pagesById,
  nodeQuery,
  canonicalReadIds,
  onToggleRead,
  onInspectInFlow,
  onClearQuery,
}: {
  pagesById: ReadonlyMap<string, RegistryEntry>;
  nodeQuery: string;
  canonicalReadIds: ReadonlySet<string>;
  onToggleRead: (id: string) => void;
  onInspectInFlow: (id: string) => void;
  onClearQuery: () => void;
}) {
  const recommendedId = CORE_26_IDS.find((id) => pagesById.has(id) && !canonicalReadIds.has(id));
  const trimmed = nodeQuery.trim();
  const visibleCount = useMemo(
    () =>
      CORE_26_IDS.filter((id) => {
        const entry = pagesById.get(id);
        return entry ? matchesSearchQuery(entry, nodeQuery) : false;
      }).length,
    [pagesById, nodeQuery],
  );

  return (
    <section
      className="wiki-roadmap-view"
      data-testid="wiki-core26-roadmap"
      aria-label="Core-26 必读通关路线"
    >
      <div className="wiki-roadmap-bar">
        <p>
          按由浅入深依赖排好 <strong>26 篇核心主线</strong>
          ；点任意卡片的「看因果图」即可展开它的前置与下游关系。
        </p>
        <div className="wiki-roadmap-bar-right">
          <span>
            {trimmed ? `匹配 ${visibleCount} / ${CORE_26_IDS.length} 篇` : `共 ${CORE_26_IDS.length} 篇主干`}
          </span>
          {trimmed && (
            <button type="button" className="wiki-graph-clear-link" onClick={onClearQuery}>
              清空筛选
            </button>
          )}
        </div>
      </div>

      {visibleCount === 0 ? (
        <p className="wiki-graph-empty-filter" role="status">
          Core-26 主线中没有匹配「{trimmed}」的文章，可切换到「12 章全景 + 连线因果图」在全库 185 页中查找。
        </p>
      ) : (
        <div className="wiki-roadmap-grid">
          {CORE_26_STAGES.flatMap((stage) => {
            const stageShort = stage.title.split("·")[1]?.trim() ?? stage.title;
            return stage.ids
              .map((id, idx) => ({ id, orderNum: stage.offset + idx, stageShort, entry: pagesById.get(id) }))
              .filter(
                (item): item is { id: string; orderNum: number; stageShort: string; entry: RegistryEntry } =>
                  Boolean(item.entry && matchesSearchQuery(item.entry, nodeQuery)),
              );
          }).map(({ id, orderNum, stageShort, entry }) => {
            const isRead = canonicalReadIds.has(id);
            const isNext = id === recommendedId;
            return (
              <article
                key={id}
                className={`wiki-roadmap-card${isRead ? " is-read" : ""}${isNext ? " is-next" : ""}`}
                data-testid={`roadmap-node-${id}`}
                title={pageDisplayTitle(entry)}
              >
                <div className="wiki-roadmap-card-top">
                  <span className="wiki-roadmap-step-num">
                    #{String(orderNum).padStart(2, "0")} · {stageShort}
                  </span>
                  <button
                    type="button"
                    className={`wiki-roadmap-status-btn${isRead ? " is-read" : ""}${isNext ? " is-next" : ""}`}
                    onClick={() => onToggleRead(id)}
                    title={isRead ? "点击标为未读" : "点击标为已读"}
                  >
                    {isRead ? "✓ 已读" : isNext ? "▶ 下一篇" : "待读"}
                  </button>
                </div>
                <h4 className="wiki-roadmap-card-title">{compactPageTitle(entry)}</h4>
                <p className="wiki-roadmap-card-summary">{entry.summary}</p>
                <div className="wiki-roadmap-card-actions">
                  <button
                    type="button"
                    className="wiki-roadmap-flow-btn"
                    data-testid={`roadmap-inspect-${id}`}
                    onClick={() => onInspectInFlow(id)}
                  >
                    <Network size={12} aria-hidden="true" />
                    看前后因果
                  </button>
                  <Link className="wiki-graph-open-link" to={`/wiki/${id}`}>
                    读正文 <ArrowRight size={12} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ParamBlastRadiusView({
  pages,
  pagesById,
  focusPage,
  causal,
  nodeQuery,
  onSelectFocus,
  onInspectInFlow,
  onClearQuery,
  detailPaneRef,
}: {
  pages: readonly RegistryEntry[];
  pagesById: ReadonlyMap<string, RegistryEntry>;
  focusPage: RegistryEntry | undefined;
  causal: EnrichedCausalNeighborhood;
  nodeQuery: string;
  canonicalReadIds: ReadonlySet<string>;
  onSelectFocus: (id: string) => void;
  onInspectInFlow: (id: string) => void;
  onClearQuery: () => void;
  detailPaneRef?: ((el: HTMLElement | null) => void) | undefined;
}) {
  const paramItems = useMemo(() => {
    const matched = pages.filter((p) => isParamBlastRadiusPage(p) && matchesSearchQuery(p, nodeQuery));
    const hubs = matched.filter((p) => PARAM_HUB_IDS.has(p.id));
    const leaves = matched.filter((p) => !PARAM_HUB_IDS.has(p.id));
    return { hubs, leaves, total: matched.length };
  }, [pages, nodeQuery]);

  const activeMeta = focusPage ? deriveParamQuickMeta(focusPage) : undefined;
  const linkedMechanisms = useMemo(() => {
    const combined = [...causal.foundations, ...causal.dependents];
    const primary = combined.filter((x) => !isSecondaryReferenceEntry(pagesById.get(x.id)));
    return (primary.length > 0 ? primary : combined).slice(0, 8);
  }, [causal.foundations, causal.dependents, pagesById]);

  return (
    <section
      className="wiki-param-explorer"
      data-testid="wiki-param-explorer"
      aria-label="参数与配置影响速查"
    >
      <div className="wiki-param-list-pane">
        <div className="wiki-param-list-head">
          <strong>点选启动参数 / 开关（{paramItems.total}）</strong>
          {nodeQuery.trim() && (
            <button type="button" className="wiki-graph-clear-link" onClick={onClearQuery}>
              清空
            </button>
          )}
        </div>
        {paramItems.total === 0 ? (
          <p className="wiki-graph-empty-note">未找到匹配该关键词的参数项，请换一个标志位或概念词。</p>
        ) : (
          <div className="wiki-param-groups">
            {paramItems.hubs.length > 0 && (
              <div className="wiki-param-group">
                <span className="wiki-param-group-label">核心调参枢纽（优先排查）</span>
                <ul className="wiki-param-btn-list">
                  {paramItems.hubs.map((entry) => {
                    const selected = entry.id === focusPage?.id;
                    const meta = deriveParamQuickMeta(entry);
                    return (
                      <li key={entry.id}>
                        <button
                          type="button"
                          className={`wiki-param-item-btn${selected ? " is-selected" : ""}`}
                          data-testid={`graph-node-${entry.id}`}
                          aria-pressed={selected}
                          title={pageDisplayTitle(entry)}
                          onClick={() => onSelectFocus(entry.id)}
                        >
                          <code className="wiki-param-item-flag">{meta.flag}</code>
                          <span className="wiki-param-item-tag">{meta.tag}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {paramItems.leaves.length > 0 && (
              <div className="wiki-param-group">
                <span className="wiki-param-group-label">细粒度 CLI / additional_config 参数</span>
                <ul className="wiki-param-btn-list">
                  {paramItems.leaves.map((entry) => {
                    const selected = entry.id === focusPage?.id;
                    const meta = deriveParamQuickMeta(entry);
                    return (
                      <li key={entry.id}>
                        <button
                          type="button"
                          className={`wiki-param-item-btn${selected ? " is-selected" : ""}`}
                          data-testid={`graph-node-${entry.id}`}
                          aria-pressed={selected}
                          title={pageDisplayTitle(entry)}
                          onClick={() => onSelectFocus(entry.id)}
                        >
                          <code className="wiki-param-item-flag">{meta.flag}</code>
                          <span className="wiki-param-item-tag">{meta.tag}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {focusPage && activeMeta && (
        <div
          ref={detailPaneRef}
          className="wiki-param-detail-pane"
          data-testid={`focus-node-${focusPage.id}`}
        >
          <div className="wiki-param-detail-head">
            <code className="wiki-param-flag-code">{activeMeta.flag}</code>
            <div className="wiki-graph-focus-badges">
              <span className="wiki-graph-param-badge">{activeMeta.tag}</span>
              {CORE_26_SET.has(focusPage.id) && (
                <span className="wiki-graph-core-badge" data-testid="focus-core26-badge">
                  Core-26
                </span>
              )}
            </div>
          </div>
          {pageDisplayTitle(focusPage) !== activeMeta.flag && (
            <div className="wiki-graph-lead">{pageDisplayTitle(focusPage)}</div>
          )}

          <div>
            <div className="wiki-param-group-label" style={{ marginBottom: 6 }}>
              直接牵动的底层机制（点选看前后因果）：
            </div>
            {linkedMechanisms.length > 0 ? (
              <>
                <div className="wiki-param-mech-chips">
                  {linkedMechanisms.map((item) => {
                    const target = pagesById.get(item.id);
                    const label = target ? compactPageTitle(target) : item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className="wiki-param-mech-chip"
                        data-testid={`causal-focus-${item.id}`}
                        title={item.note}
                        onClick={() => onInspectInFlow(item.id)}
                      >
                        ⚡ {label}
                      </button>
                    );
                  })}
                </div>
                <ul className="wiki-param-impact-notes">
                  {linkedMechanisms.slice(0, 4).map((item) => {
                    const target = pagesById.get(item.id);
                    return (
                      <li key={`note-${item.id}`}>
                        <strong>{target ? compactPageTitle(target) : item.id}</strong>：{item.note}
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <p className="wiki-graph-empty-note">{focusPage.summary}</p>
            )}
          </div>

          <div className="wiki-param-trap-box" data-testid="causal-sub-siblings">
            <div>{activeMeta.trap}</div>
            {causal.siblings.length > 0 && (
              <div className="wiki-param-mech-chips">
                {causal.siblings.map((item) => {
                  const target = pagesById.get(item.id);
                  const label = target ? compactPageTitle(target) : item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="wiki-param-mech-chip"
                      data-relation-kind={item.kind}
                      onClick={() => onInspectInFlow(item.id)}
                    >
                      {item.kind === "conflicts-with" ? "🚫 互斥 " : "⇄ 替代 "}
                      {label}：{item.note}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="wiki-param-detail-actions">
            <div style={{ display: "inline-flex", flexWrap: "wrap", gap: 8 }}>
              <button
                type="button"
                className="wiki-graph-read-btn"
                onClick={() => onInspectInFlow(focusPage.id)}
              >
                <Network size={13} aria-hidden="true" />
                看连线因果图
              </button>
              <Link className="wiki-graph-open-link" to={`/wiki/${focusPage.id}`}>
                阅读参数正文 <ArrowRight size={13} aria-hidden="true" />
              </Link>
            </div>
            <a className="wiki-graph-primary-link" href={activeMeta.toolHref}>
              <Wrench size={13} aria-hidden="true" />
              {activeMeta.toolLabel}
            </a>
          </div>
        </div>
      )}
    </section>
  );
}

export interface WikiCausalGraphPanelProps {
  readonly pages: readonly RegistryEntry[];
  readonly toc: readonly TocPart<RegistryEntry>[];
  readonly skipped?: ReadonlySet<string> | undefined;
  readonly graphReady: boolean;
  readonly graphError?: string | undefined;
  readonly edges: readonly WikiGraphEdge[];
  readonly requestedFocusId?: string | undefined;
  readonly filter: GraphFilterMode;
  readonly nodeQuery: string;
  readonly roamTrail?: readonly string[] | undefined;
  readonly rawReadIds: Iterable<string>;
  readonly onChangeFilter: (next: GraphFilterMode) => void;
  readonly onChangeNodeQuery: (next: string) => void;
  readonly onSelectFocus: (id: string, scrollStage?: boolean) => void;
  readonly onInspectInFlow?: ((id: string) => void) | undefined;
  readonly onToggleRead: (id: string) => void;
  readonly onRetryGraph?: (() => void) | undefined;
  readonly onFlowStageEl?: ((el: HTMLElement | null) => void) | undefined;
  readonly onParamDetailEl?: ((el: HTMLElement | null) => void) | undefined;
}

export function WikiCausalGraphPanel({
  pages,
  toc,
  skipped,
  graphReady,
  graphError,
  edges,
  requestedFocusId,
  filter,
  nodeQuery,
  roamTrail = [],
  rawReadIds,
  onChangeFilter,
  onChangeNodeQuery,
  onSelectFocus,
  onInspectInFlow,
  onToggleRead,
  onRetryGraph,
  onFlowStageEl,
  onParamDetailEl,
}: WikiCausalGraphPanelProps) {
  const pagesById = useMemo(() => new Map(pages.map((p) => [p.id, p])), [pages]);
  const coreProgress = useMemo(
    () => computeCore26Progress(rawReadIds, pages, skipped),
    [rawReadIds, pages, skipped],
  );
  const { focusId, missingRequestedId } = useMemo(
    () => resolveGraphFocus({ requestedFocusId, filter, pages, toc, skipped }),
    [requestedFocusId, filter, pages, toc, skipped],
  );
  const focusPage = focusId ? pagesById.get(focusId) : undefined;
  const focusChapterLabel = useMemo(() => {
    if (!focusId) return undefined;
    const idx = toc.findIndex((part) => part.sections.some((sec) => sec.pages.some((p) => p.id === focusId)));
    if (idx < 0) return undefined;
    return `第 ${String(idx + 1).padStart(2, "0")} 章 · ${toc[idx]!.title}`;
  }, [focusId, toc]);

  const causal = useMemo(
    () =>
      focusId && graphReady
        ? buildCausalNeighborhood(focusId, edges)
        : { foundations: [], dependents: [], siblings: [] },
    [focusId, graphReady, edges],
  );
  const uniqueEdgeCount = useMemo(() => countUniqueCausalEdges(edges), [edges]);
  const paramHubCount = useMemo(() => pages.filter((p) => isParamBlastRadiusPage(p)).length, [pages]);

  const foundationSet = useMemo(() => new Set(causal.foundations.map((x) => x.id)), [causal.foundations]);
  const dependentSet = useMemo(() => new Set(causal.dependents.map((x) => x.id)), [causal.dependents]);
  const conflictSet = useMemo(
    () => new Set(causal.siblings.filter((x) => x.kind === "conflicts-with").map((x) => x.id)),
    [causal.siblings],
  );
  const alternativeSet = useMemo(
    () => new Set(causal.siblings.filter((x) => x.kind !== "conflicts-with").map((x) => x.id)),
    [causal.siblings],
  );
  const pct = coreProgress.total > 0 ? Math.round((coreProgress.completed / coreProgress.total) * 100) : 0;

  const inspectInFlow = useCallback(
    (id: string) => {
      if (onInspectInFlow) {
        onInspectInFlow(id);
        return;
      }
      onChangeFilter("all");
      onSelectFocus(id, true);
    },
    [onInspectInFlow, onChangeFilter, onSelectFocus],
  );

  const searchPlaceholder =
    filter === "core-26"
      ? "筛选 Core-26 路线词条…"
      : filter === "params"
        ? "搜索参数名或枢纽页…"
        : "输入即搜全库并切换因果图…";

  return (
    <div className="wiki-graph-page" data-testid="wiki-causal-graph-view" data-active-mode={filter}>
      <header className="wiki-graph-header">
        <div className="wiki-graph-header-top">
          <div className="wiki-graph-title-inline">
            <h1>学习路线与知识因果图</h1>
            <div className="wiki-graph-progress-card" data-testid="core26-progress">
              <div className="wiki-graph-progress-head">
                <strong>
                  Core-26 主线已点亮 {coreProgress.completed} / {coreProgress.total}
                </strong>
                <span>
                  全库 {coreProgress.canonicalReadIds.size}/{pages.length}
                  {graphReady ? ` · ${uniqueEdgeCount} 连线` : ""}
                </span>
              </div>
              <div
                className="wiki-graph-progress-track"
                role="progressbar"
                aria-label="Core-26 阅读进度"
                aria-valuemin={0}
                aria-valuemax={coreProgress.total}
                aria-valuenow={coreProgress.completed}
              >
                <span className="wiki-graph-progress-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
          <WikiViewSwitch activeView="graph" focusId={focusId} mode={filter} />
        </div>

        <div className="wiki-graph-controls">
          <fieldset className="wiki-graph-filters" data-testid="wiki-graph-filters" aria-label="视图模式切换">
            <button
              type="button"
              className={`wiki-graph-filter-btn${filter === "core-26" ? " is-active" : ""}`}
              data-testid="graph-filter-core26"
              aria-pressed={filter === "core-26"}
              onClick={() => onChangeFilter("core-26")}
            >
              ① Core-26 必读路线
            </button>
            <button
              type="button"
              className={`wiki-graph-filter-btn${filter === "all" ? " is-active" : ""}`}
              data-testid="graph-filter-all"
              aria-pressed={filter === "all"}
              onClick={() => onChangeFilter("all")}
            >
              ② {toc.length} 章全景 + 连线因果图
            </button>
            <button
              type="button"
              className={`wiki-graph-filter-btn is-param${filter === "params" ? " is-active" : ""}`}
              data-testid="graph-filter-params"
              aria-pressed={filter === "params"}
              onClick={() => onChangeFilter("params")}
            >
              <Zap size={13} aria-hidden="true" /> ③ 调参影响速查 ({paramHubCount})
            </button>
          </fieldset>
          <label className="wiki-graph-search">
            <Search size={13} aria-hidden="true" />
            <input
              type="text"
              aria-label="筛选星图节点"
              placeholder={searchPlaceholder}
              value={nodeQuery}
              onChange={(e) => onChangeNodeQuery(e.target.value)}
            />
            {nodeQuery && (
              <button
                type="button"
                className="wiki-graph-search-clear"
                aria-label="清空筛选词"
                onClick={() => onChangeNodeQuery("")}
              >
                <X size={12} aria-hidden="true" />
              </button>
            )}
          </label>
        </div>
      </header>

      {missingRequestedId && (
        <p className="wiki-graph-notice" role="status">
          未找到节点「{missingRequestedId}」，已自动聚焦核心枢纽节点。
        </p>
      )}

      {filter === "core-26" && (
        <Core26RoadmapView
          pagesById={pagesById}
          nodeQuery={nodeQuery}
          canonicalReadIds={coreProgress.canonicalReadIds}
          onToggleRead={onToggleRead}
          onInspectInFlow={inspectInFlow}
          onClearQuery={() => onChangeNodeQuery("")}
        />
      )}

      {filter === "params" && (
        <div data-testid="wiki-causal-stage">
          {!graphReady && !graphError && (
            <p className="wiki-graph-loading" role="status">
              正在载入当前版本的参数关联图谱…
            </p>
          )}
          {graphError && (
            <div className="wiki-graph-error" role="alert">
              <span>{graphError}</span>
              {onRetryGraph && (
                <button type="button" onClick={onRetryGraph}>
                  重试载入图谱
                </button>
              )}
            </div>
          )}
          {graphReady && (
            <ParamBlastRadiusView
              pages={pages}
              pagesById={pagesById}
              focusPage={focusPage}
              causal={causal}
              nodeQuery={nodeQuery}
              canonicalReadIds={coreProgress.canonicalReadIds}
              onSelectFocus={(id) => onSelectFocus(id, true)}
              onInspectInFlow={inspectInFlow}
              onClearQuery={() => onChangeNodeQuery("")}
              detailPaneRef={onParamDetailEl}
            />
          )}
        </div>
      )}

      {filter === "all" && (
        <>
          <QuickTopicPicker
            toc={toc}
            pages={pages}
            focusId={focusId}
            nodeQuery={nodeQuery}
            canonicalReadIds={coreProgress.canonicalReadIds}
            foundationSet={foundationSet}
            dependentSet={dependentSet}
            onSelectFocus={(id) => onSelectFocus(id, false)}
            onClearQuery={() => onChangeNodeQuery("")}
          />

          {roamTrail.length > 1 && (
            <nav className="wiki-graph-trail" aria-label="因果漫游足迹" data-testid="causal-roam-trail">
              <span className="wiki-graph-trail-label">最近查看：</span>
              {roamTrail.map((trailId, index) => {
                const entry = pagesById.get(trailId);
                if (!entry) return null;
                return (
                  <span key={trailId} className="wiki-graph-trail-step">
                    {index > 0 && <span aria-hidden="true">→</span>}
                    <button
                      type="button"
                      className={trailId === focusId ? "is-current" : undefined}
                      onClick={() => onSelectFocus(trailId)}
                    >
                      {pageDisplayTitle(entry)}
                    </button>
                  </span>
                );
              })}
            </nav>
          )}

          <section
            ref={onFlowStageEl}
            className="wiki-graph-stage"
            data-testid="wiki-causal-stage"
            aria-label="因果流向图"
          >
            {!graphReady && !graphError && (
              <p className="wiki-graph-loading" role="status">
                正在载入当前版本的单向知识图谱…
              </p>
            )}
            {graphError && (
              <div className="wiki-graph-error" role="alert">
                <span>{graphError}</span>
                {onRetryGraph && (
                  <button type="button" onClick={onRetryGraph}>
                    重试载入图谱
                  </button>
                )}
              </div>
            )}
            {graphReady && focusPage && (
              <CausalFlowStage
                focusPage={focusPage}
                focusChapterLabel={focusChapterLabel}
                causal={causal}
                pagesById={pagesById}
                canonicalReadIds={coreProgress.canonicalReadIds}
                onSelectFocus={(id) => onSelectFocus(id, false)}
                onToggleFocusRead={onToggleRead}
              />
            )}
          </section>

          <details
            className="wiki-graph-all12-drawer"
            aria-label="12 章知识分区目录总览"
            open={Boolean(nodeQuery.trim())}
          >
            <summary>
              展开全库 {toc.length} 章 {pages.length} 篇完整分区目录索引（点选任意词条切换上方因果图）
            </summary>
            <SubwayPartitionsMap
              toc={toc}
              nodeQuery={nodeQuery}
              focusId={focusId}
              foundationSet={foundationSet}
              dependentSet={dependentSet}
              conflictSet={conflictSet}
              alternativeSet={alternativeSet}
              canonicalReadIds={coreProgress.canonicalReadIds}
              onSelectStation={(id) => onSelectFocus(id, true)}
            />
          </details>
        </>
      )}
    </div>
  );
}

function parseUrlGraphMode(params: URLSearchParams): GraphFilterMode | null {
  const raw = params.get("mode")?.trim();
  if (raw === "core-26" || raw === "all" || raw === "params") return raw;
  return null;
}

export function resolveUrlGraphMode(
  params: URLSearchParams,
  initialFocusParam?: string | undefined,
): GraphFilterMode {
  const explicitMode = parseUrlGraphMode(params);
  if (explicitMode) return explicitMode;
  const rawFocus = params.get("focus")?.trim() || initialFocusParam?.trim();
  return rawFocus ? "all" : "core-26";
}

export function WikiCausalGraphView({ initialFocusParam }: { initialFocusParam?: string | undefined }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { pages, revision, mode, skipped } = useSyncExternalStore(
    subscribeReader,
    getReaderState,
    getReaderState,
  );
  const graph = useSyncExternalStore(subscribeReader, getWikiGraph, getWikiGraph);
  const rawReadIds = useReadingProgress();

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const urlFocus = searchParams.get("focus") ?? initialFocusParam;

  const [filter, setFilter] = useState<GraphFilterMode>(() =>
    resolveUrlGraphMode(searchParams, initialFocusParam),
  );
  const [nodeQuery, setNodeQuery] = useState("");
  const [graphError, setGraphError] = useState("");
  const [retryTick, setRetryTick] = useState(0);
  const [roamTrail, setRoamTrail] = useState<string[]>([]);
  const flowStageElRef = useRef<HTMLElement | null>(null);
  const paramDetailElRef = useRef<HTMLElement | null>(null);
  const [scrollNonce, setScrollNonce] = useState(0);
  const filterRef = useRef<GraphFilterMode>(filter);
  filterRef.current = filter;
  const lastSelfSyncedSearchRef = useRef<string | null>(null);

  const toc = useMemo(() => buildToc(pages), [pages]);
  const aligned = useMemo(
    () => resolveAlignedGraphEdges({ revision, mode, pages, skipped, graph }),
    [revision, mode, pages, skipped, graph],
  );

  // Sync URL mode/focus on external navigation and browser Back/Forward
  useEffect(() => {
    const cleanSearch = location.search.replace(/^\?/, "");
    if (lastSelfSyncedSearchRef.current !== null && cleanSearch === lastSelfSyncedSearchRef.current) {
      lastSelfSyncedSearchRef.current = null;
      return;
    }
    lastSelfSyncedSearchRef.current = null;
    const nextMode = resolveUrlGraphMode(searchParams, initialFocusParam);
    if (nextMode !== filterRef.current) {
      setFilter(nextMode);
    }
  }, [location.search, searchParams, initialFocusParam]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: retryTick triggers an explicit reload attempt on user retry.
  useEffect(() => {
    setGraphError("");
    if (getWikiGraph()?.revision === revision) return;
    let active = true;
    void ensureWikiGraph().catch((err: Error) => {
      if (active) setGraphError(err.message || "知识图谱载入失败，请重试。");
    });
    return () => {
      active = false;
    };
  }, [revision, retryTick]);

  const effectiveFocus = useMemo(
    () => resolveGraphFocus({ requestedFocusId: urlFocus, filter, pages, toc, skipped }).focusId,
    [urlFocus, filter, pages, toc, skipped],
  );

  useEffect(() => {
    if (!effectiveFocus) return;
    setRoamTrail((prev) => {
      if (prev[prev.length - 1] === effectiveFocus) return prev;
      const withoutDup = prev.filter((id) => id !== effectiveFocus);
      return [...withoutDup.slice(-5), effectiveFocus];
    });
  }, [effectiveFocus]);

  useEffect(() => {
    if (scrollNonce === 0) return;
    const rafId = requestAnimationFrame(() => {
      const target = filterRef.current === "params" ? paramDetailElRef.current : flowStageElRef.current;
      target?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    return () => cancelAnimationFrame(rafId);
  }, [scrollNonce]);

  const navigateGraphParams = useCallback(
    (nextMode: GraphFilterMode, nextFocusId: string | undefined, scrollStage = false, replace = false) => {
      const nextParams = new URLSearchParams(location.search);
      nextParams.set("view", "graph");
      nextParams.set("mode", nextMode);
      if (nextFocusId) nextParams.set("focus", nextFocusId);
      const searchStr = nextParams.toString();
      lastSelfSyncedSearchRef.current = searchStr;
      navigate(
        { pathname: location.pathname, search: `?${searchStr}` },
        { replace, preventScrollReset: true },
      );
      if (scrollStage) {
        setScrollNonce((n) => n + 1);
      }
    },
    [location.pathname, location.search, navigate],
  );

  const updateUrlFocus = useCallback(
    (targetId: string, scrollStage = false) => {
      const canonical = resolveCanonicalPageId(pages, targetId, skipped) ?? targetId;
      navigateGraphParams(filterRef.current, canonical, scrollStage, false);
    },
    [pages, skipped, navigateGraphParams],
  );

  const handleChangeFilter = useCallback(
    (nextFilter: GraphFilterMode) => {
      setFilter(nextFilter);
      let nextFocus = effectiveFocus;
      if (nextFocus) {
        const currentEntry = pages.find((p) => p.id === nextFocus);
        if (currentEntry && !matchesGraphFilter(currentEntry, nextFilter)) {
          nextFocus = resolveGraphFocus({ filter: nextFilter, pages, toc, skipped }).focusId;
        }
      }
      navigateGraphParams(nextFilter, nextFocus, false, true);
    },
    [effectiveFocus, pages, toc, skipped, navigateGraphParams],
  );

  const handleInspectInFlow = useCallback(
    (targetId: string) => {
      const canonical = resolveCanonicalPageId(pages, targetId, skipped) ?? targetId;
      setFilter("all");
      navigateGraphParams("all", canonical, true, false);
    },
    [pages, skipped, navigateGraphParams],
  );

  const handleToggleRead = useCallback(
    (targetId: string) => {
      togglePageRead(targetId, pages, skipped);
    },
    [pages, skipped],
  );

  return (
    <WikiCausalGraphPanel
      pages={pages}
      toc={toc}
      skipped={skipped}
      graphReady={aligned.ready}
      graphError={graphError}
      edges={aligned.edges}
      requestedFocusId={urlFocus}
      filter={filter}
      nodeQuery={nodeQuery}
      roamTrail={roamTrail}
      rawReadIds={rawReadIds}
      onChangeFilter={handleChangeFilter}
      onChangeNodeQuery={setNodeQuery}
      onSelectFocus={updateUrlFocus}
      onInspectInFlow={handleInspectInFlow}
      onToggleRead={handleToggleRead}
      onRetryGraph={() => setRetryTick((n) => n + 1)}
      onFlowStageEl={(el) => {
        flowStageElRef.current = el;
      }}
      onParamDetailEl={(el) => {
        paramDetailElRef.current = el;
      }}
    />
  );
}
