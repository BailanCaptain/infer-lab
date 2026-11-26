import { Search } from "lucide-react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { retrieve } from "../../content/wiki/index";
import type { Hit, RetrieveOptions } from "../../content/wiki/retrieve";
import type { RegistryEntry } from "../../content/wiki/schema";
import {
  buildHardwareDeployHrefFromCommand,
  matchDeployPresetModelKey,
} from "../model/hardwareDeployOverlay";
import { buildDoctorShareLink, sanitizeDiagnosticText } from "../tools/workbenchHandoff";

const TYPE_LABEL: Record<string, string> = {
  concept: "概念",
  feature: "特性",
  param: "参数",
  source: "来源",
  pr: "PR",
  tool: "工具",
  "3d": "3D",
};

export type QuickSearchStatus = "idle" | "loading" | "ready" | "error";

export interface QuickSearchItem {
  id: string;
  title: string;
  type: string;
  typeLabel: string;
  summary: string;
  evidence: string;
  how: Hit["how"];
  route?: string | undefined;
}

export interface QuickSearchState {
  open: boolean;
  query: string;
  status: QuickSearchStatus;
  items: QuickSearchItem[];
  selectedIndex: number;
  error: string;
}

export interface QuickSearchKeyInput {
  key: string;
  isComposing?: boolean;
  keyCode?: number;
  preventDefault: () => void;
}

export interface QuickSearchDeps {
  search: (query: string, opts?: RetrieveOptions) => Promise<Hit[]>;
  getPages: () => readonly Pick<RegistryEntry, "id" | "type">[];
  onNavigate: (id: string) => void;
  onRestoreFocus?: () => void;
  limit?: number;
}

export const OPEN_QUICK_SEARCH_EVENT = "wiki:open-quick-search";

export interface OpenQuickSearchDetail {
  query?: string | undefined;
  origin?: HTMLElement | null | undefined;
}

export function requestOpenQuickSearch(detail: OpenQuickSearchDetail = {}): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<OpenQuickSearchDetail>(OPEN_QUICK_SEARCH_EVENT, { detail }));
}

export function isQuickSearchShortcut(event: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}): boolean {
  return (
    (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k"
  );
}

const MODAL_TABBABLE_SELECTOR =
  'input:not([disabled]), button:not([disabled]):not([tabindex="-1"]), [href], [tabindex]:not([tabindex="-1"])';

export function getModalTabbableElements(container: ParentNode | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(MODAL_TABBABLE_SELECTOR));
}

export function nextModalFocusIndex(count: number, activeIndex: number, shiftKey: boolean): number {
  if (count <= 0) return -1;
  if (activeIndex < 0 || activeIndex >= count) {
    return shiftKey ? count - 1 : 0;
  }
  return shiftKey ? (activeIndex - 1 + count) % count : (activeIndex + 1) % count;
}

export interface ModalDialogKeyInput {
  key: string;
  shiftKey?: boolean;
  isComposing?: boolean;
  keyCode?: number;
  focusableCount: number;
  activeFocusIndex: number;
  preventDefault: () => void;
  focusAt: (index: number) => void;
  onClose: () => void;
}

export function handleModalDialogKeyDown(event: ModalDialogKeyInput): boolean {
  if (event.isComposing || event.keyCode === 229) return false;
  if (event.key === "Escape") {
    event.preventDefault();
    event.onClose();
    return true;
  }
  if (event.key === "Tab") {
    const nextIdx = nextModalFocusIndex(
      event.focusableCount,
      event.activeFocusIndex,
      Boolean(event.shiftKey),
    );
    if (nextIdx >= 0) {
      event.preventDefault();
      event.focusAt(nextIdx);
      return true;
    }
    return false;
  }
  return false;
}

function makeActionItem(
  id: string,
  kind: "tool" | "3d",
  title: string,
  summary: string,
  route: string,
): QuickSearchItem {
  return {
    id,
    title,
    type: kind,
    typeLabel: kind === "3d" ? "3D" : "工具",
    summary,
    evidence: "",
    how: "exact",
    route,
  };
}

function stripHashPrefix(href: string | null): string | null {
  if (!href) return null;
  return href.startsWith("#") ? href.slice(1) : href;
}

/**
 * 针对明确的报错特征码、核心 CLI 参数或预设模型名生成最多 2 条具名直达项（`工具` / `3D`）。
 * 仅作为列表候选项供用户按 Enter 或点击跳转，绝不自动重定向。
 */
export function matchQuickSearchActionItems(rawQuery: string): QuickSearchItem[] {
  const q = rawQuery.trim();
  if (!q) return [];
  const actions: QuickSearchItem[] = [];

  // 1. vllm serve 命令或关键字（严格先经 sanitizeDiagnosticText 脱敏，绝不将密钥/Token/IP 编入 URL）
  if (/\bvllm\s+serve\b/i.test(q)) {
    const isBareKeyword = /^vllm\s+serve$/i.test(q);
    if (isBareKeyword) {
      actions.push(
        makeActionItem(
          "action:doctor-vllm-serve",
          "tool",
          "打开配置体检台：检查 vllm serve 启动参数与耦合陷阱",
          "粘贴完整启动命令即可校验 TP/PP/EP 整除、量化精度与版本兼容",
          "/tools?tab=doctor",
        ),
      );
    } else {
      const { sanitized } = sanitizeDiagnosticText(q);
      const shareRes = buildDoctorShareLink({
        topology: "single",
        hardwareFamily: "A2",
        version: "v0.30.0",
        modelHint: "auto",
        commandText: sanitized,
      });
      const doctorRoute = shareRes.ok ? `/tools?${shareRes.params.toString()}` : "/tools?tab=doctor";
      actions.push(
        makeActionItem(
          "action:doctor-check-cmd",
          "tool",
          "送去配置体检台：体检这条 vllm serve 命令",
          "自动脱敏并带入当前命令，静态检查参数冲突、静默反量化与通信域隐患",
          doctorRoute,
        ),
      );
      const hwHref = stripHashPrefix(buildHardwareDeployHrefFromCommand(sanitized, { hardwareFamily: "A2" }));
      if (hwHref) {
        actions.push(
          makeActionItem(
            "action:hw3d-cmd",
            "3d",
            "在 3D 整机中透视此命令分片（Atlas A2 64G 参考）",
            "按命令中的模型与 TP/PP/DP/EP 展开单卡权重、KV 池与通信角色",
            hwHref,
          ),
        );
      }
    }
    return actions.slice(0, 2);
  }

  // 2. 明确报错特征码（507015 / EI0006 / HCCL / OOM / ACLGraph）
  if (/\b507015\b/i.test(q)) {
    actions.push(
      makeActionItem(
        "action:troubleshoot-507015",
        "tool",
        "故障排查工作台：定位 507015 / Runtime 算子异常首错卡",
        "按多卡时间戳还原真实首错 Rank，剥离次生连坐超时",
        "/tools?tab=troubleshoot&fixture=multi-rank-hccl-rank3-fault",
      ),
    );
  }
  if (/\bei0006\b|notify\s+wait\s+execute\s+timeout/i.test(q)) {
    actions.push(
      makeActionItem(
        "action:troubleshoot-ei0006",
        "tool",
        "故障排查工作台：甄别多卡 EI0006 超时假象与真凶 Rank",
        "自动比对各卡报错时间线，防止误把等待超时的从属卡当成根因",
        "/tools?tab=troubleshoot&fixture=multi-rank-hccl-rank3-fault",
      ),
    );
  }
  if (/(?:^|[^a-z0-9])hccl(?:$|[^a-z0-9_]|_)/i.test(q) && actions.length < 2) {
    actions.push(
      makeActionItem(
        "action:troubleshoot-hccl",
        "tool",
        "故障排查工作台：诊断 HCCL 集合通信超时与通信域显存",
        "排查 EI0006 等待超时、跨机 RoCE 与通信域缓冲开销",
        "/tools?tab=troubleshoot&fixture=pure-hccl-timeout-no-primary",
      ),
      makeActionItem(
        "action:hw3d-hccl",
        "3d",
        "3D 硬件探索：查看昇腾机内 HCCS / 灵衢互联结构",
        "对照 Atlas 800T A2 / 800I A3 物理模组与集合通信分组",
        "/hardware?vendor=ascend&model=atlas-800t-a2&level=2",
      ),
    );
  }
  if (/(?:^|[^a-z0-9])oom(?:$|[^a-z0-9])|out\s+of\s+memory|outofmemoryerror/i.test(q) && actions.length < 2) {
    actions.push(
      makeActionItem(
        "action:troubleshoot-oom",
        "tool",
        "故障排查工作台：拆解权重期 / KV 期 / 录图期 NPU OOM",
        "区分冷启动权重溢出与 1−u 图捕获余量耗尽，给出直接收敛参数",
        "/tools?tab=troubleshoot&fixture=real-910b3-u090-aclgraph-oom",
      ),
      makeActionItem(
        "action:calc-oom",
        "tool",
        "部署算账台：核算权重、KV 池与 1−u 余量防 OOM",
        "调整 TP 档位、量化精度与 gpu_memory_utilization 观察显存水位",
        "/tools?tab=calculator",
      ),
    );
  }
  if (/\b(?:aclgraph|npugraph(?:_ex)?|capture_model)\b/i.test(q) && actions.length < 2) {
    actions.push(
      makeActionItem(
        "action:troubleshoot-aclgraph",
        "tool",
        "故障排查工作台：诊断 ACLGraph 图捕获冲突与余量溢出",
        "定位 capture_model 阶段显存穿透或 FA3 + FULL_DECODE_ONLY 互斥报错",
        "/tools?tab=troubleshoot&fixture=post-kv-aclgraph-oom",
      ),
    );
  }
  if (actions.length > 0) return actions.slice(0, 2);

  // 3. 核心 CLI 参数（--gpu-memory-utilization / --tensor-parallel-size / --max-num-batched-tokens）
  if (/(?:--)?gpu[-_]memory[-_]utilization\b/i.test(q)) {
    return [
      makeActionItem(
        "action:calc-gmu",
        "tool",
        "部署算账台：试算 gpu_memory_utilization (u) 与 1−u 余量",
        "直观查看调高 u 扩增 KV 池与挤占 ACLGraph 图捕获余量的跷跷板边界",
        "/tools?tab=calculator",
      ),
    ];
  }
  if (/(?:--)?tensor[-_]parallel[-_]size\b|^(?:-tp|--tp)(?:\s+\d+|\s*=\s*\d+)?$/i.test(q)) {
    return [
      makeActionItem(
        "action:calc-tp",
        "tool",
        "部署算账台：对比不同 TP 张量并行档位显存与吞吐",
        "核算 QKV/MLP 列切行切、KV 头复制阈值与 HCCL All-Reduce 域开销",
        "/tools?tab=calculator&tp=4",
      ),
      makeActionItem(
        "action:hw3d-tp",
        "3d",
        "3D 硬件透视：查看 TP=4 多卡权重与 KV 头切分",
        "在 Atlas 800T A2 整机上点选任一 Rank 查看单卡分片卡",
        stripHashPrefix(
          buildHardwareDeployHrefFromCommand("vllm serve Qwen/Qwen3-32B -tp 4", { cardId: "a2-64g" }),
        ) ?? "/hardware?vendor=ascend&model=atlas-800t-a2&level=2",
      ),
    ];
  }
  if (/(?:--)?max[-_]num[-_]batched[-_]tokens\b/i.test(q)) {
    return [
      makeActionItem(
        "action:calc-batched-tokens",
        "tool",
        "部署算账台：调节 max_num_batched_tokens 试算激活峰值",
        "评估单步批 token 上限对 profile_run 激活峰值与 Prefill 算力利用率的影响",
        "/tools?tab=calculator",
      ),
    ];
  }

  // 4. 预设模型名（与 hardwareDeployOverlay 共享严格边界匹配，拒绝 Distill / VL / V2 / V4 等混淆变体）
  const matchedPreset = matchDeployPresetModelKey(q, { allowShortMoeAlias: true });
  if (matchedPreset === "qwen3-235b-a22b") {
    const hw235 =
      stripHashPrefix(
        buildHardwareDeployHrefFromCommand(
          "vllm serve Qwen/Qwen3-235B-A22B -tp 8 -pp 2 --enable-expert-parallel --quantization w8a8_dynamic",
          { cardId: "a3-die64g" },
        ),
      ) ?? "/hardware?vendor=ascend&model=atlas-800i-a3&level=2";
    return [
      makeActionItem(
        "action:calc-qwen3-235b",
        "tool",
        "部署算账台：加载 Qwen3-235B-A22B 核算 TP/PP/EP 显存",
        "94 层 128 专家 Top-8 MoE 旗舰在 Atlas A2/A3 上的切分与容量推演",
        "/tools?tab=calculator&preset=qwen3-235b-a22b&card=a3-die64g&precision=w8a8_dynamic&tp=8&pp=2&ep=1",
      ),
      makeActionItem(
        "action:hw3d-qwen3-235b",
        "3d",
        "3D 硬件透视：查看 Qwen3-235B-A22B 在 Atlas A3 16-Die 分片",
        "点选双芯模组任一 Die 查看 PP 层段、KV 头复制与 EP 路由专家分布",
        hw235,
      ),
    ];
  }
  if (matchedPreset === "qwen3-30b-a3b") {
    return [
      makeActionItem(
        "action:calc-qwen3-30b-a3b",
        "tool",
        "部署算账台：加载 Qwen3-30B-A3B (MoE) 算显存与并发",
        "48 层 128 专家 Top-8 稀疏激活模型显存、EP 通信与推荐命令",
        "/tools?tab=calculator&preset=qwen3-30b-a3b&tp=2&ep=1",
      ),
      makeActionItem(
        "action:model3d-qwen3-30b-a3b",
        "3d",
        "3D 模型探索：播放 Qwen3-30B-A3B 专家路由与加权合回",
        "在三维前向舞台直观对照稠密 FFN 与 128 选 8 MoE 计算流",
        "/model?model=qwen3-8b&variant=30b-a3b",
      ),
    ];
  }
  if (matchedPreset === "qwen3-32b") {
    const hw32 =
      stripHashPrefix(
        buildHardwareDeployHrefFromCommand("vllm serve Qwen/Qwen3-32B -tp 2", { cardId: "a2-64g" }),
      ) ?? "/hardware?vendor=ascend&model=atlas-800t-a2&level=2";
    return [
      makeActionItem(
        "action:calc-qwen3-32b",
        "tool",
        "部署算账台：加载 Qwen3-32B 核算双卡/四卡 TP 方案",
        "64 层稠密主力模型在 Atlas A2/310P 上的显存预算与并发容量",
        "/tools?tab=calculator&preset=qwen3-32b&tp=2",
      ),
      makeActionItem(
        "action:hw3d-qwen3-32b",
        "3d",
        "3D 硬件透视：查看 Qwen3-32B 双卡 TP=2 权重与 KV 分片",
        "直观查看 64 层 GQA (64Q/8KV) 在两张 NPU 上的列切行切归属",
        hw32,
      ),
    ];
  }
  if (matchedPreset === "qwen3-8b") {
    return [
      makeActionItem(
        "action:calc-qwen3-8b",
        "tool",
        "部署算账台：加载 Qwen3-8B 试算单卡显存与最大并发",
        "36 层标准 GQA 主线模型显存瀑布、KV 块数与启动命令生成",
        "/tools?tab=calculator&preset=qwen3-8b",
      ),
      makeActionItem(
        "action:model3d-qwen3-8b",
        "3d",
        "3D 模型探索：逐拍播放 Qwen3-8B 完整前向计算",
        "从词表嵌入、QKV 注意力、读写 KV Cache 到采样输出全流程透视",
        "/model?model=qwen3-8b&variant=8b",
      ),
    ];
  }
  if (matchedPreset === "qwen3-0.6b") {
    return [
      makeActionItem(
        "action:calc-qwen3-0.6b",
        "tool",
        "部署算账台：加载 Qwen3-0.6B 试算轻量单卡显存与吞吐",
        "28 层共享词表轻量模型在 Atlas A2 / 310P 上的并发容量推演",
        "/tools?tab=calculator&preset=qwen3-0.6b",
      ),
      makeActionItem(
        "action:model3d-qwen3-0.6b",
        "3d",
        "3D 模型探索：对照 Qwen3 架构前向计算流",
        "逐拍查看词表嵌入、GQA 注意力与 SwiGLU FFN 数据流动",
        "/model?model=qwen3-8b&variant=8b",
      ),
    ];
  }
  if (matchedPreset === "deepseek-v3-mla") {
    const hwDs =
      stripHashPrefix(
        buildHardwareDeployHrefFromCommand(
          "vllm serve deepseek-ai/DeepSeek-V3 -tp 8 -pp 2 --enable-expert-parallel --quantization w8a8_dynamic",
          { cardId: "a3-die64g" },
        ),
      ) ?? "/hardware?vendor=ascend&model=atlas-800i-a3&level=2";
    return [
      makeActionItem(
        "action:calc-deepseek-v3",
        "tool",
        "部署算账台：加载 DeepSeek-V3 MLA 样例核算低秩缓存与 EP",
        "对比 61 层 MLA 潜向量全卡驻留、256 路由专家 + 共享专家显存账本",
        "/tools?tab=calculator&preset=deepseek-v3-mla&card=a3-die64g&precision=w8a8_dynamic&tp=8&pp=2&ep=1",
      ),
      makeActionItem(
        "action:hw3d-deepseek-v3",
        "3d",
        "3D 硬件透视：查看 DeepSeek-V3 在 Atlas A3 16-Die 切分",
        "点选任一 Die 查看 PP 余层分配（31+30 层）、MLA 潜向量与 EP 专家容量",
        hwDs,
      ),
    ];
  }

  return [];
}

export function createQuickSearchController(deps: QuickSearchDeps) {
  let state: QuickSearchState = {
    open: false,
    query: "",
    status: "idle",
    items: [],
    selectedIndex: 0,
    error: "",
  };
  let requestSeq = 0;
  const listeners = new Set<() => void>();
  const emit = (patch: Partial<QuickSearchState>) => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  };

  const runQuery = async (rawQuery: string): Promise<void> => {
    const trimmed = rawQuery.trim();
    const seq = ++requestSeq;
    if (!trimmed) {
      emit({ query: rawQuery, status: "idle", items: [], selectedIndex: 0, error: "" });
      return;
    }
    emit({ query: rawQuery, status: "loading", items: [], selectedIndex: 0, error: "" });
    try {
      const hits = await deps.search(trimmed, { limit: deps.limit ?? 8 });
      if (seq !== requestSeq || !state.open) return;
      const typeById = new Map(deps.getPages().map((p) => [p.id, p.type]));
      const wikiItems: QuickSearchItem[] = hits.map((h) => {
        const type = typeById.get(h.id) ?? "concept";
        return {
          id: h.id,
          title: h.title,
          type,
          typeLabel: TYPE_LABEL[type] ?? type,
          summary: h.summary,
          evidence: h.evidence,
          how: h.how,
        };
      });
      const actionItems = matchQuickSearchActionItems(trimmed);
      const isLiteralServeCmd = /^vllm\s+serve\s+\S/i.test(trimmed);
      const isBareErrorCodeWithoutTitleHit =
        /^(?:507015|ei0006)$/i.test(trimmed) && wikiItems[0]?.how !== "exact";
      let items: QuickSearchItem[];
      if (actionItems.length === 0) {
        items = wikiItems;
      } else if (wikiItems.length === 0 || isLiteralServeCmd || isBareErrorCodeWithoutTitleHit) {
        items = [...actionItems, ...wikiItems];
      } else {
        items = [...wikiItems, ...actionItems];
      }
      emit({ status: "ready", items, selectedIndex: 0, error: "" });
    } catch (error) {
      if (seq !== requestSeq || !state.open) return;
      emit({
        status: "error",
        items: [],
        selectedIndex: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const openSearch = (initialQuery = "") => {
    requestSeq++;
    const trimmed = initialQuery.trim();
    emit({ open: true, query: initialQuery, status: "idle", items: [], selectedIndex: 0, error: "" });
    if (trimmed) {
      void runQuery(initialQuery);
    }
  };

  const closeSearch = ({ restoreFocus = true }: { restoreFocus?: boolean } = {}) => {
    if (!state.open) return;
    requestSeq++;
    emit({ open: false, status: "idle", items: [], selectedIndex: 0, error: "" });
    if (restoreFocus) deps.onRestoreFocus?.();
  };

  const pickItem = (index: number) => {
    if (!state.open || state.status !== "ready") return;
    const item = state.items[index];
    if (!item) return;
    closeSearch({ restoreFocus: false });
    deps.onNavigate(item.route ?? item.id);
  };

  return {
    getState: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    openSearch,
    closeSearch,
    setQuery: (nextQuery: string) => runQuery(nextQuery),
    selectIndex: (index: number) => {
      if (state.status !== "ready") return;
      if (index >= 0 && index < state.items.length && index !== state.selectedIndex) {
        emit({ selectedIndex: index });
      }
    },
    pickItem,
    retry: () => runQuery(state.query),
    onSnapshotChanged: () => {
      if (state.open && state.query.trim()) void runQuery(state.query);
    },
    handleKeyDown: (event: QuickSearchKeyInput): boolean => {
      if (!state.open || event.isComposing || event.keyCode === 229) return false;
      if (event.key === "ArrowDown") {
        if (state.status !== "ready" || !state.items.length) return false;
        event.preventDefault();
        emit({ selectedIndex: (state.selectedIndex + 1) % state.items.length });
        return true;
      }
      if (event.key === "ArrowUp") {
        if (state.status !== "ready" || !state.items.length) return false;
        event.preventDefault();
        emit({ selectedIndex: (state.selectedIndex - 1 + state.items.length) % state.items.length });
        return true;
      }
      if (event.key === "Enter") {
        if (state.status === "error" && state.query.trim()) {
          event.preventDefault();
          void runQuery(state.query);
          return true;
        }
        if (state.status === "ready" && state.items.length > 0 && state.items[state.selectedIndex]) {
          event.preventDefault();
          pickItem(state.selectedIndex);
          return true;
        }
        return false;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closeSearch({ restoreFocus: true });
        return true;
      }
      return false;
    },
  };
}

export interface QuickSearchDialogProps {
  state: QuickSearchState;
  dialogRef?: React.RefObject<HTMLDivElement | null>;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  listRef?: React.RefObject<HTMLDivElement | null>;
  onQueryChange: (query: string) => void;
  onSelectIndex: (index: number) => void;
  onPickItem: (index: number) => void;
  onRetry: () => void;
  onClose: () => void;
  onInputKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
}

export function QuickSearchDialog({
  state,
  dialogRef,
  inputRef,
  listRef,
  onQueryChange,
  onSelectIndex,
  onPickItem,
  onRetry,
  onClose,
  onInputKeyDown,
}: QuickSearchDialogProps) {
  const hasReadyItems = state.status === "ready" && state.items.length > 0;
  const activeOptionId =
    hasReadyItems && state.items[state.selectedIndex]
      ? `wiki-quick-search-option-${state.items[state.selectedIndex]!.id}`
      : undefined;

  return (
    <div className="wiki-quick-search-backdrop" data-testid="wiki-quick-search-backdrop">
      <button
        type="button"
        tabIndex={-1}
        className="wiki-quick-search-backdrop-scrim"
        data-testid="wiki-quick-search-scrim"
        aria-label="关闭全库快捷搜索"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        className="wiki-quick-search-dialog"
        data-testid="wiki-quick-search-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="全库快捷搜索"
        onKeyDown={(event) => {
          const native = event.nativeEvent;
          const controls = getModalTabbableElements(event.currentTarget);
          const active =
            typeof document !== "undefined" && document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
          handleModalDialogKeyDown({
            key: event.key,
            shiftKey: event.shiftKey,
            isComposing: native.isComposing,
            keyCode: native.keyCode,
            focusableCount: controls.length,
            activeFocusIndex: active ? controls.indexOf(active) : -1,
            preventDefault: () => event.preventDefault(),
            focusAt: (idx) => controls[idx]?.focus({ preventScroll: true }),
            onClose,
          });
        }}
      >
        <div className="wiki-quick-search-bar">
          <Search size={18} aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            className="wiki-quick-search-input"
            role="combobox"
            aria-expanded={hasReadyItems}
            aria-controls="wiki-quick-search-listbox"
            aria-activedescendant={activeOptionId}
            aria-autocomplete="list"
            aria-label="搜索知识库全文"
            data-testid="wiki-quick-search-input"
            placeholder="搜索概念、参数、CLI 开关或正文关键词…"
            value={state.query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={onInputKeyDown}
          />
          <button type="button" className="wiki-quick-search-esc" onClick={onClose} aria-label="关闭快捷搜索">
            Esc
          </button>
        </div>

        <div className="wiki-quick-search-body">
          {state.status === "idle" && (
            <p className="wiki-quick-search-hint">
              输入关键词检索全库标题、别名、摘要与正文（如{" "}
              <code className="wiki-quick-search-code">RoPE</code>、
              <code className="wiki-quick-search-code">W8A8</code>、
              <code className="wiki-quick-search-code">AllReduce</code>、
              <code className="wiki-quick-search-code">--enforce-eager</code>）。
            </p>
          )}

          {state.status === "loading" && (
            <p className="wiki-quick-search-hint" role="status">
              正在载入检索索引并匹配…
            </p>
          )}

          {state.status === "error" && (
            <div className="wiki-quick-search-error" role="alert">
              <p className="wiki-quick-search-error-msg">{state.error || "检索索引加载失败，请重试。"}</p>
              <button
                type="button"
                className="wiki-quick-search-retry-btn"
                data-testid="wiki-quick-search-retry"
                onClick={onRetry}
              >
                重试加载
              </button>
            </div>
          )}

          {state.status === "ready" && state.items.length === 0 && (
            <p className="wiki-quick-search-hint" role="status">
              {`未找到与「${state.query.trim()}」匹配的页面，可尝试缩写、参数名或相近术语。`}
            </p>
          )}

          {hasReadyItems && (
            <div
              ref={listRef}
              id="wiki-quick-search-listbox"
              className="wiki-quick-search-list"
              role="listbox"
              aria-label="搜索结果"
            >
              {state.items.map((item, idx) => {
                const selected = idx === state.selectedIndex;
                return (
                  <button
                    key={item.id}
                    id={`wiki-quick-search-option-${item.id}`}
                    type="button"
                    tabIndex={-1}
                    role="option"
                    aria-selected={selected}
                    data-testid="wiki-quick-search-item"
                    className={`wiki-quick-search-item${selected ? " is-selected" : ""}`}
                    onMouseEnter={() => onSelectIndex(idx)}
                    onClick={() => onPickItem(idx)}
                  >
                    <span className="wiki-quick-search-item-head">
                      <strong className="wiki-quick-search-title">{item.title}</strong>
                      <span className="wiki-quick-search-badges">
                        <span
                          className={`wiki-quick-search-type${
                            item.type === "tool" ? " is-tool" : item.type === "3d" ? " is-3d" : ""
                          }`}
                          data-testid={
                            item.type === "tool" || item.type === "3d"
                              ? "wiki-quick-search-action-badge"
                              : undefined
                          }
                        >
                          {item.typeLabel}
                        </span>
                        {item.evidence ? (
                          <span className="wiki-quick-search-ev">{`[${item.evidence}]`}</span>
                        ) : null}
                      </span>
                    </span>
                    {item.summary && <span className="wiki-quick-search-summary">{item.summary}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <footer className="wiki-quick-search-foot" aria-hidden="true">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> 选择
          </span>
          <span>
            <kbd>↵</kbd> 打开页面
          </span>
          <span>
            <kbd>Esc</kbd> 关闭
          </span>
        </footer>
      </div>
    </div>
  );
}

export function WikiQuickSearch({
  pages,
  revision,
  slot,
  onAfterNavigate,
}: {
  pages: readonly RegistryEntry[];
  revision: string;
  slot?: HTMLElement | null | undefined;
  onAfterNavigate?: (() => void) | undefined;
}) {
  const navigate = useNavigate();
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  const afterNavRef = useRef(onAfterNavigate);
  afterNavRef.current = onAfterNavigate;

  const returnFocusRef = useRef<HTMLElement | null>(null);
  const triggerBtnRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);

  const [controller] = useState(() =>
    createQuickSearchController({
      search: (q, opts) => retrieve(q, opts),
      getPages: () => pagesRef.current,
      onNavigate: (target) => {
        afterNavRef.current?.();
        navigate(target.startsWith("/") ? target : `/wiki/${target}`);
      },
      onRestoreFocus: () => {
        const target =
          returnFocusRef.current && document.contains(returnFocusRef.current)
            ? returnFocusRef.current
            : triggerBtnRef.current;
        returnFocusRef.current = null;
        requestAnimationFrame(() => {
          target?.focus({ preventScroll: true });
        });
      },
    }),
  );

  const [state, setState] = useState<QuickSearchState>(() => controller.getState());
  useEffect(() => controller.subscribe(() => setState(controller.getState())), [controller]);

  // Re-run active query cleanly if a live snapshot publication updates the revision while modal is open
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision intentionally triggers re-query on snapshot swap.
  useEffect(() => {
    controller.onSnapshotChanged();
  }, [controller, revision]);

  useLayoutEffect(() => {
    setHeaderSlot(slot ?? document.getElementById("reader-quick-search-slot"));
  }, [slot]);

  const openFromTrigger = (origin?: HTMLElement | null, initialQuery = "") => {
    returnFocusRef.current =
      origin ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : triggerBtnRef.current);
    controller.openSearch(initialQuery);
  };

  useEffect(() => {
    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.keyCode === 229) return;
      if (isQuickSearchShortcut(event)) {
        event.preventDefault();
        if (controller.getState().open) {
          controller.closeSearch({ restoreFocus: true });
        } else {
          openFromTrigger(document.activeElement instanceof HTMLElement ? document.activeElement : null);
        }
        return;
      }
      if (controller.getState().open && !event.defaultPrevented) {
        const controls = getModalTabbableElements(dialogRef.current);
        const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        handleModalDialogKeyDown({
          key: event.key,
          shiftKey: event.shiftKey,
          isComposing: event.isComposing,
          keyCode: event.keyCode,
          focusableCount: controls.length,
          activeFocusIndex: active ? controls.indexOf(active) : -1,
          preventDefault: () => event.preventDefault(),
          focusAt: (idx) => controls[idx]?.focus({ preventScroll: true }),
          onClose: () => controller.closeSearch({ restoreFocus: true }),
        });
      }
    };
    const onOpenCustom = (event: Event) => {
      const detail = (event as CustomEvent<OpenQuickSearchDetail>).detail;
      openFromTrigger(detail?.origin ?? null, typeof detail?.query === "string" ? detail.query.trim() : "");
    };
    window.addEventListener("keydown", onWindowKeyDown);
    window.addEventListener(OPEN_QUICK_SEARCH_EVENT, onOpenCustom);
    return () => {
      window.removeEventListener("keydown", onWindowKeyDown);
      window.removeEventListener(OPEN_QUICK_SEARCH_EVENT, onOpenCustom);
    };
  });

  useEffect(() => {
    if (!state.open) return;
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [state.open]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: status transitions (e.g. retry button unmounting) must keep focus inside modal.
  useLayoutEffect(() => {
    if (!state.open) return;
    const active = document.activeElement;
    if (!active || active === document.body || !dialogRef.current?.contains(active)) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [state.open, state.status]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: selectedIndex scroll sync runs when active option moves.
  useEffect(() => {
    if (!state.open) return;
    listRef.current
      ?.querySelector<HTMLElement>('[role="option"][aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [state.open, state.selectedIndex]);

  const shortcutHint =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)
      ? "⌘K"
      : "Ctrl K";

  const triggerButton = (
    <button
      ref={triggerBtnRef}
      type="button"
      className="reader-quick-search-trigger"
      data-testid="wiki-quick-search-trigger"
      aria-label="打开全库快捷搜索"
      aria-haspopup="dialog"
      aria-expanded={state.open}
      onClick={(event) => openFromTrigger(event.currentTarget)}
    >
      <Search size={15} aria-hidden="true" />
      <span>搜索全文</span>
      <kbd>{shortcutHint}</kbd>
    </button>
  );

  return (
    <>
      {headerSlot ? createPortal(triggerButton, headerSlot) : triggerButton}
      {state.open &&
        typeof document !== "undefined" &&
        createPortal(
          <QuickSearchDialog
            state={state}
            dialogRef={dialogRef}
            inputRef={inputRef}
            listRef={listRef}
            onQueryChange={(q) => void controller.setQuery(q)}
            onSelectIndex={(idx) => controller.selectIndex(idx)}
            onPickItem={(idx) => controller.pickItem(idx)}
            onRetry={() => {
              inputRef.current?.focus({ preventScroll: true });
              void controller.retry();
            }}
            onClose={() => controller.closeSearch({ restoreFocus: true })}
            onInputKeyDown={(event) => {
              const native = event.nativeEvent;
              controller.handleKeyDown({
                key: event.key,
                isComposing: native.isComposing,
                keyCode: native.keyCode,
                preventDefault: () => event.preventDefault(),
              });
            }}
          />,
          document.body,
        )}
    </>
  );
}
