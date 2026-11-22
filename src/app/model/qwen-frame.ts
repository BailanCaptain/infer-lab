import { findByAlias, resolvePageId } from "../../content/wiki/index";
import { pageDisplayTitle } from "../../content/wiki/param-display";

export type ModelEdition = "qwen3-8b" | "glm-5-3-flash";
export type QwenVariant = "8b" | "30b-a3b";
export type ModelViewId = "play" | "model" | "layer" | "arch";

export const GLM_VIEW_PATHS: Record<ModelViewId, string> = {
  play: "chapter.html",
  model: "model.html",
  layer: "flow.html",
  arch: "arch.html",
};

/** 合法的 GLM 旧深链段号（1..40 整数） */
export function parseLegacyGlmSegment(params: URLSearchParams): number | null {
  const raw = params.get("segment")?.trim();
  if (!raw || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 40 ? n : null;
}

/**
 * 解析当前 `/model` 路由的模型版本：
 * 1. 显式 `model=glm-5-3-flash` → `"glm-5-3-flash"`
 * 2. 未显式传 `model`，但带合法旧深链 `segment`（1..40 整数）→ `"glm-5-3-flash"`（100% 兼容历史 Wiki 深链）
 * 3. 其余默认 → `"qwen3-8b"`
 */
export function resolveModelEdition(params: URLSearchParams): ModelEdition {
  const explicit = params.get("model");
  if (explicit === "glm-5-3-flash") return "glm-5-3-flash";
  if (explicit === "qwen3-8b") return "qwen3-8b";
  if (!params.has("model") && parseLegacyGlmSegment(params) !== null) {
    return "glm-5-3-flash";
  }
  return "qwen3-8b";
}

/** 解析 Qwen3 内部规格变体（稠密 8B 或 30B-A3B MoE 对照） */
export function resolveQwenVariant(params: URLSearchParams): QwenVariant {
  return params.get("variant") === "30b-a3b" ? "30b-a3b" : "8b";
}

/**
 * 严格整数校验硬件 3D 的 `level` 参数（0..4）：
 * 若传入小数、负数、越界或 NaN 一律回退 0，杜绝脏参数穿透进 `whole/index.html`。
 */
export function parseHardwareLevel(params: URLSearchParams, hardwareModule: boolean): number {
  if (!params.has("level")) return hardwareModule ? 3 : 0;
  const raw = params.get("level")?.trim();
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 4 ? n : 0;
}

/** 清洗锚点字符串：剥离首部 `#` 与 ASCII 控制字符 */
export function sanitizeAnchor(raw: string | null | undefined): string {
  if (!raw) return "";
  let cleaned = "";
  for (const ch of raw) {
    const code = ch.charCodeAt(0);
    if (code >= 0x20 && code !== 0x7f) cleaned += ch;
  }
  return cleaned.trim().replace(/^#+/, "").trim();
}

export interface ExperienceBackTarget {
  to: string;
  label: string;
}

/**
 * 解析顶栏「原路返回」目标：
 * 1. 若处于课程章节上下文 → 返回对应章节
 * 2. 若携带经知识库索引验证的 `fromPage`（及可选 `fromAnchor`）→ 返回该 Wiki 页面对应位置
 * 3. 否则兜底回 `/wiki` 主章节
 */
export function resolveExperienceBackTarget(
  params: URLSearchParams,
  chapter?: { id: string } | null,
): ExperienceBackTarget {
  if (chapter) {
    return {
      to: `/chapters/${chapter.id}`,
      label: `返回第 ${chapter.id} 章`,
    };
  }
  const fromPageRaw = params.get("fromPage")?.trim();
  if (fromPageRaw) {
    const canonical = resolvePageId(fromPageRaw) ?? fromPageRaw;
    const page = findByAlias(canonical);
    if (page) {
      const anchor = sanitizeAnchor(params.get("fromAnchor"));
      return {
        to: `/wiki/${page.id}${anchor ? `#${anchor}` : ""}`,
        label: `返回「${pageDisplayTitle(page)}」`,
      };
    }
  }
  return { to: "/wiki", label: "返回主章节" };
}

/**
 * 为 Wiki 正文内指向 `/model` 或 `/hardware` 的站内路由自动附加 `fromPage=${currentId}`，
 * 完整保留原有 query 参数顺序（如 `view=play&segment=28`）与锚点。
 */
export function appendFromPageToExperienceRoute(route: string, currentId?: string): string {
  if (!currentId) return route;
  const hashIdx = route.indexOf("#");
  const withoutHash = hashIdx >= 0 ? route.slice(0, hashIdx) : route;
  const hashPart = hashIdx >= 0 ? route.slice(hashIdx) : "";
  const queryIdx = withoutHash.indexOf("?");
  const pathname = queryIdx >= 0 ? withoutHash.slice(0, queryIdx) : withoutHash;
  const queryPart = queryIdx >= 0 ? withoutHash.slice(queryIdx + 1) : "";

  if (pathname !== "/model" && pathname !== "/hardware") return route;
  const sp = new URLSearchParams(queryPart);
  if (sp.has("fromPage")) return route;

  const suffix = `fromPage=${encodeURIComponent(currentId)}`;
  const nextQuery = queryPart ? `${queryPart}&${suffix}` : suffix;
  return `${pathname}?${nextQuery}${hashPart}`;
}

export function buildExperienceIframeSrc({
  baseUrl,
  edition,
  variant,
  viewId,
  segment,
}: {
  baseUrl: string;
  edition: ModelEdition;
  variant: QwenVariant;
  viewId: ModelViewId;
  segment?: number | null;
}): string {
  if (edition === "glm-5-3-flash") {
    const file = GLM_VIEW_PATHS[viewId];
    const segQuery = viewId === "play" && segment ? `&segment=${segment}` : "";
    return `${baseUrl}experiences/glm-flow/master/${file}?site=1${segQuery}`;
  }
  return `${baseUrl}experiences/qwen-flow/master/index.html?view=${viewId}&site=1&variant=${variant}`;
}

function preserveContextParams(
  target: URLSearchParams,
  params: URLSearchParams,
  chapterId?: string | undefined,
  routeId?: string | undefined,
): void {
  if (routeId) {
    target.set("experience", "1");
  } else if (chapterId) {
    target.set("chapter", chapterId);
  }
  const fromPage = params.get("fromPage")?.trim();
  if (fromPage) target.set("fromPage", fromPage);
  const fromAnchor = sanitizeAnchor(params.get("fromAnchor"));
  if (fromAnchor) target.set("fromAnchor", fromAnchor);
}

/** 构造演示视图 Tab 链接，完整保留模型、变体、GLM 段号与 Wiki 原路返回参数 */
export function buildModelTabTo({
  base,
  viewId,
  edition,
  params,
  chapterId,
  routeId,
}: {
  base: string;
  viewId: ModelViewId;
  edition: ModelEdition;
  params: URLSearchParams;
  chapterId?: string | undefined;
  routeId?: string | undefined;
}): string {
  const next = new URLSearchParams();
  next.set("view", viewId);
  if (edition === "glm-5-3-flash") {
    next.set("model", "glm-5-3-flash");
    const seg = parseLegacyGlmSegment(params);
    if (seg !== null) next.set("segment", String(seg));
  } else {
    if (params.get("model") === "qwen3-8b") next.set("model", "qwen3-8b");
    const variant = resolveQwenVariant(params);
    if (variant !== "8b" || params.has("variant")) next.set("variant", variant);
  }
  preserveContextParams(next, params, chapterId, routeId);
  return `${base}?${next.toString()}`;
}

/** 构造顶栏模型架构切换链接，完整保留当前视图与 Wiki 原路返回参数 */
export function buildModelSwitchTo({
  base,
  targetEdition,
  viewId,
  params,
  chapterId,
  routeId,
}: {
  base: string;
  targetEdition: ModelEdition;
  viewId: ModelViewId;
  params: URLSearchParams;
  chapterId?: string | undefined;
  routeId?: string | undefined;
}): string {
  const next = new URLSearchParams();
  next.set("view", viewId);
  if (targetEdition === "glm-5-3-flash") {
    next.set("model", "glm-5-3-flash");
    const seg = parseLegacyGlmSegment(params);
    if (seg !== null) next.set("segment", String(seg));
  } else {
    const variant = resolveQwenVariant(params);
    if (variant !== "8b") next.set("variant", variant);
  }
  preserveContextParams(next, params, chapterId, routeId);
  return `${base}?${next.toString()}`;
}

export interface ExperienceLoadingElementLike {
  hidden?: boolean;
  querySelector?: (selectors: string) => unknown;
}

export interface ExperienceFrameWindowLike {
  document?: {
    getElementById?: (id: string) => ExperienceLoadingElementLike | null;
  } | null;
  __chapter?: { state?: { ready?: boolean }; send?: (msg: { cmd: string }) => void };
  __truth?: { ready?: boolean };
  __arch?: { ready?: boolean };
}

/**
 * 判断 3D 体验 iframe 是否真实就绪：
 * - 硬件页（whole/index.html）必含 `#loading` 节点；若缺失（如 SPA 回退页或错误 HTML）必须返回 false，
 *   仅当 `#loading` 已隐藏或渲染了可见重试按钮时返回 true；
 * - 模型页分别检查 `__chapter.state.ready` / `__arch.ready` / `__truth.ready`。
 */
export function isExperienceFrameReady(
  win: ExperienceFrameWindowLike | null | undefined,
  kind: "model" | "hardware",
  viewId: string,
): boolean {
  if (!win) return false;
  if (kind === "hardware") {
    const loading = win.document?.getElementById?.("loading");
    if (!loading) return false;
    if (loading.hidden) return true;
    // Reveal immediately if hardware loading failed and displays the retry button.
    return Boolean(loading.querySelector?.("button:not([hidden])"));
  }
  if (viewId === "play") return win.__chapter?.state?.ready === true;
  if (viewId === "arch") return win.__arch?.ready === true;
  return win.__truth?.ready === true;
}

/**
 * 安全探测 iframe 就绪态：读取 contentWindow / document 抛出异常（如跨域或尚未同源就绪）时
 * 一律返回 `{ ready: false }`，绝不将异常帧误标为 ready。
 */
export function safeCheckExperienceFrameReady(
  getWindow: () => ExperienceFrameWindowLike | null | undefined,
  kind: "model" | "hardware",
  viewId: string,
): { ready: true; win: ExperienceFrameWindowLike } | { ready: false } {
  try {
    const win = getWindow();
    if (win && isExperienceFrameReady(win, kind, viewId)) {
      return { ready: true, win };
    }
  } catch {
    return { ready: false };
  }
  return { ready: false };
}
