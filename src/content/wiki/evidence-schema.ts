import { z } from "zod";
import type { RepoRef } from "./schema";

const safePositiveLine = z.number().int().safe().positive();
const safeNonNegativeCount = z.number().int().safe().nonnegative();

export const evidenceLineSchema = z
  .object({
    number: safePositiveLine,
    text: z.string(),
  })
  .strict();
export type EvidenceLine = z.infer<typeof evidenceLineSchema>;

export const repoUnavailableReasonSchema = z.enum([
  "invalid-commit",
  "missing-file",
  "out-of-range",
  "unknown-repo",
]);
export type RepoUnavailableReason = z.infer<typeof repoUnavailableReasonSchema>;

export const rawUnavailableReasonSchema = z.enum([
  "missing-raw",
  "tampered-raw",
  "unpublished-raw",
  "out-of-range",
  "invalid-raw-ref",
]);
export type RawUnavailableReason = z.infer<typeof rawUnavailableReasonSchema>;

const hasValidOptionalRange = (v: { lineStart?: number | undefined; lineEnd?: number | undefined }) =>
  (v.lineStart === undefined) === (v.lineEnd === undefined) &&
  (v.lineStart === undefined || v.lineEnd! >= v.lineStart);

const repoEvidenceOkSchema = z
  .object({
    ref: z.string().min(1),
    kind: z.literal("repo"),
    status: z.literal("ok"),
    repo: z.string().min(1),
    commit: z.string().min(1),
    path: z.string().min(1),
    versionRefs: z.array(z.string()),
    lineStart: safePositiveLine,
    lineEnd: safeNonNegativeCount,
    totalLines: safeNonNegativeCount,
    lines: z.array(evidenceLineSchema),
    externalHref: z.string().nullable(),
  })
  .strict()
  .refine(
    (v) =>
      v.lines.length === 0
        ? v.lineStart === 1 && v.lineEnd === 0
        : v.lineEnd >= v.lineStart && v.lines.length === v.lineEnd - v.lineStart + 1,
    "ok 源码摘录行号范围必须与实际返回行数一致",
  );

const repoEvidenceUnavailableSchema = z
  .object({
    ref: z.string().min(1),
    kind: z.literal("repo"),
    status: z.literal("unavailable"),
    reason: repoUnavailableReasonSchema,
    repo: z.string().min(1),
    commit: z.string().min(1),
    path: z.string().min(1),
    versionRefs: z.array(z.string()),
    lineStart: safePositiveLine.optional(),
    lineEnd: safePositiveLine.optional(),
    totalLines: safeNonNegativeCount.optional(),
    externalHref: z.string().nullable(),
  })
  .strict()
  .refine(hasValidOptionalRange, "不可用条目的有效行范围必须成对且起止有序");

const rawEvidenceOkSchema = z
  .object({
    ref: z.string().min(1),
    kind: z.literal("raw"),
    status: z.literal("ok"),
    path: z.string().min(1),
    lineStart: safePositiveLine,
    lineEnd: safePositiveLine,
    totalLines: safeNonNegativeCount,
    lines: z.array(evidenceLineSchema),
    rawViewerHref: z.string().nullable(),
  })
  .strict()
  .refine(
    (v) => v.lineEnd >= v.lineStart && v.lines.length === v.lineEnd - v.lineStart + 1,
    "ok 原文摘录行号范围必须与实际返回行数一致",
  );

const rawEvidenceUnavailableSchema = z
  .object({
    ref: z.string().min(1),
    kind: z.literal("raw"),
    status: z.literal("unavailable"),
    reason: rawUnavailableReasonSchema,
    path: z.string().optional(),
    lineStart: safePositiveLine.optional(),
    lineEnd: safePositiveLine.optional(),
    totalLines: safeNonNegativeCount.optional(),
    rawViewerHref: z.string().nullable(),
  })
  .strict()
  .refine(hasValidOptionalRange, "不可用条目的有效行范围必须成对且起止有序");

const urlEvidenceSchema = z
  .object({
    ref: z.string().min(1),
    kind: z.literal("url"),
    status: z.literal("external"),
    externalHref: z.string().min(1),
  })
  .strict();

export const evidenceEntrySchema = z.union([
  repoEvidenceOkSchema,
  repoEvidenceUnavailableSchema,
  rawEvidenceOkSchema,
  rawEvidenceUnavailableSchema,
  urlEvidenceSchema,
]);
export type EvidenceEntry = z.infer<typeof evidenceEntrySchema>;

export const diagramPinEvidenceSchema = z
  .object({
    pinIndex: z.number().int().nonnegative(),
    ref: z.string().min(1),
    symbols: z.array(z.string().min(1)).min(1),
  })
  .strict();
export type DiagramPinEvidence = z.infer<typeof diagramPinEvidenceSchema>;

export const diagramEvidenceGroupSchema = z
  .object({
    diagramId: z.string().min(1),
    caption: z.string(),
    pins: z.array(diagramPinEvidenceSchema),
  })
  .strict();
export type DiagramEvidenceGroup = z.infer<typeof diagramEvidenceGroupSchema>;

export const readerPageEvidenceSchema = z
  .object({
    version: z.literal(1),
    revision: z.string().regex(/^[a-f0-9]{64}$/),
    pageId: z.string().min(1),
    pageSources: z.array(z.string()),
    diagrams: z.array(diagramEvidenceGroupSchema),
    entries: z.record(z.string(), evidenceEntrySchema),
  })
  .strict();
export type ReaderPageEvidence = z.infer<typeof readerPageEvidenceSchema>;

export type EvidenceTarget =
  | { kind: "source"; sourceIndex: number }
  | { kind: "diagram"; diagramId: string; pinIndex: number }
  | { kind: "ref"; ref: string };

export interface EvidenceViewState {
  open: boolean;
  pageId: string | undefined;
  revision: string | undefined;
  target: EvidenceTarget | undefined;
  status: "idle" | "loading" | "ready" | "error";
  pack: ReaderPageEvidence | undefined;
  error: string | undefined;
}

export function resolveActiveEvidence(state: EvidenceViewState): {
  ref: string | undefined;
  entry: EvidenceEntry | undefined;
  diagramGroup: DiagramEvidenceGroup | undefined;
  selectedPin: DiagramPinEvidence | undefined;
} {
  const { pack, target } = state;
  if (!pack || !target) {
    return { ref: undefined, entry: undefined, diagramGroup: undefined, selectedPin: undefined };
  }
  if (target.kind === "source") {
    const ref = pack.pageSources[target.sourceIndex];
    return {
      ref,
      entry: ref ? pack.entries[ref] : undefined,
      diagramGroup: undefined,
      selectedPin: undefined,
    };
  }
  if (target.kind === "diagram") {
    const diagramGroup = pack.diagrams.find((d) => d.diagramId === target.diagramId);
    const selectedPin = diagramGroup?.pins[target.pinIndex] ?? diagramGroup?.pins[0];
    const ref = selectedPin?.ref;
    return { ref, entry: ref ? pack.entries[ref] : undefined, diagramGroup, selectedPin };
  }
  return {
    ref: target.ref,
    entry: pack.entries[target.ref],
    diagramGroup: undefined,
    selectedPin: undefined,
  };
}

/** 控制器内证据包缓存上限（按最近使用淘汰）；跨 revision 的旧包随使用自然淘汰。 */
const MAX_CONTROLLER_PACKS = 32;

/**
 * 证据面板视图控制器。按 (revision, pageId) 缓存已校验的证据包并合并同键在途请求：
 * hover 预热、点击、切 pin、关闭重开共享一次请求；失败的任务立即移除，retry 会重新请求。
 * loader 收到 (pageId, revision)；只接受 pageId 的旧 loader（如跟随最新版本的 store）同样兼容，
 * 返回包的 revision 以实际返回为准写入状态与缓存键。
 */
export function createEvidenceViewController(deps: {
  loadPageEvidence: (pageId: string, revision: string) => Promise<ReaderPageEvidence>;
}) {
  let state: EvidenceViewState = {
    open: false,
    pageId: undefined,
    revision: undefined,
    target: undefined,
    status: "idle",
    pack: undefined,
    error: undefined,
  };
  let requestSeq = 0;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };

  const packKey = (revision: string, pageId: string) => `${revision}\n${pageId}`;
  const readyPacks = new Map<string, ReaderPageEvidence>();
  const inflight = new Map<string, Promise<ReaderPageEvidence>>();

  const remember = (requestedPageId: string, pack: ReaderPageEvidence) => {
    for (const id of new Set([requestedPageId, pack.pageId])) {
      const key = packKey(pack.revision, id);
      readyPacks.delete(key);
      readyPacks.set(key, pack);
    }
    while (readyPacks.size > MAX_CONTROLLER_PACKS) readyPacks.delete(readyPacks.keys().next().value!);
  };

  const peek = (pageId: string, revision: string): ReaderPageEvidence | undefined => {
    const key = packKey(revision, pageId);
    const hit = readyPacks.get(key);
    if (hit) {
      readyPacks.delete(key);
      readyPacks.set(key, hit);
    }
    return hit;
  };

  const load = (pageId: string, revision: string): Promise<ReaderPageEvidence> => {
    const key = packKey(revision, pageId);
    const existing = inflight.get(key);
    if (existing) return existing;
    let request: Promise<ReaderPageEvidence>;
    try {
      request = Promise.resolve(deps.loadPageEvidence(pageId, revision));
    } catch (error) {
      request = Promise.reject(error);
    }
    const task = request.then((input) => {
      const parsed = readerPageEvidenceSchema.parse(input);
      remember(pageId, parsed);
      return parsed;
    });
    inflight.set(key, task);
    const cleanup = () => {
      // 只删除仍指向本任务的登记，旧任务不能删掉 retry 发起的新任务。
      if (inflight.get(key) === task) inflight.delete(key);
    };
    task.then(cleanup, cleanup);
    return task;
  };

  const openTarget = async (pageId: string, revision: string, target: EvidenceTarget): Promise<void> => {
    // 缓存命中也递增序号：让更早发起、尚未返回的打开请求全部失效。
    const seq = ++requestSeq;
    const cached = peek(pageId, revision);
    if (cached) {
      state = {
        open: true,
        pageId,
        revision: cached.revision,
        target,
        status: "ready",
        pack: cached,
        error: undefined,
      };
      notify();
      return;
    }
    state = { open: true, pageId, revision, target, status: "loading", pack: undefined, error: undefined };
    notify();
    try {
      const loaded = await load(pageId, revision);
      if (seq !== requestSeq || !state.open) return;
      // 保留加载期间用户最后选择的 pin / source（state.target）。
      state = { ...state, revision: loaded.revision, status: "ready", pack: loaded, error: undefined };
      notify();
    } catch (error) {
      if (seq !== requestSeq || !state.open) return;
      state = {
        ...state,
        status: "error",
        pack: undefined,
        error: error instanceof Error ? error.message : String(error),
      };
      notify();
    }
  };

  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** 预热（如 hover）：只填缓存，不改变面板状态；失败静默，留给真正打开时重试。 */
    prefetch(pageId: string, revision: string): Promise<void> {
      if (peek(pageId, revision)) return Promise.resolve();
      return load(pageId, revision).then(
        () => undefined,
        () => undefined,
      );
    },
    openForSource: (pageId: string, revision: string, sourceIndex: number) =>
      openTarget(pageId, revision, { kind: "source", sourceIndex }),
    openForDiagram: (pageId: string, revision: string, diagramId: string, pinIndex = 0) =>
      openTarget(pageId, revision, { kind: "diagram", diagramId, pinIndex }),
    openForRef: (pageId: string, revision: string, ref: string) =>
      openTarget(pageId, revision, { kind: "ref", ref }),
    selectPin(pinIndex: number) {
      if (!state.open || state.target?.kind !== "diagram") return;
      state = { ...state, target: { ...state.target, pinIndex } };
      notify();
    },
    selectSource(sourceIndex: number) {
      if (!state.open) return;
      state = { ...state, target: { kind: "source", sourceIndex } };
      notify();
    },
    syncContext(pageId: string | undefined, revision: string) {
      if (!state.open) return;
      if (!pageId || state.pageId !== pageId) {
        requestSeq++;
        state = {
          open: false,
          pageId: undefined,
          revision: undefined,
          target: undefined,
          status: "idle",
          pack: undefined,
          error: undefined,
        };
        notify();
        return;
      }
      if (state.revision !== revision && state.target) {
        void openTarget(pageId, revision, state.target);
      }
    },
    retry(): Promise<void> {
      if (!state.pageId || !state.revision || !state.target) return Promise.resolve();
      return openTarget(state.pageId, state.revision, state.target);
    },
    close() {
      requestSeq++;
      state = { ...state, open: false, status: "idle", error: undefined };
      notify();
    },
  };
}

export type NormalizedLineRange =
  | { kind: "none" }
  | { kind: "valid"; lineStart: number; lineEnd: number }
  | { kind: "invalid" };

/**
 * 单一范围归一化入口：只有 1-based 安全整数且 lineEnd >= lineStart 的区间才算可表示的有效行范围。
 * 零起、零止、反序或超出安全整数范围统一判为 "invalid"，保留原始 ref 与错误归因，不伪造行号。
 */
export function normalizeRequestedLineRange(lineStart?: number, lineEnd?: number): NormalizedLineRange {
  if (lineStart === undefined) return { kind: "none" };
  const end = lineEnd ?? lineStart;
  if (!Number.isSafeInteger(lineStart) || !Number.isSafeInteger(end) || lineStart < 1 || end < lineStart) {
    return { kind: "invalid" };
  }
  return { kind: "valid", lineStart, lineEnd: end };
}

/** 仓库名 → GitHub 仓库路径。未列出的仓库不猜 URL（单一真相源）。 */
export const REPO_GITHUB: Record<string, string> = {
  "vllm-ascend": "vllm-project/vllm-ascend",
  vllm: "vllm-project/vllm",
  rfork: "yangsonglin13/vllm-ascend",
};

export function repoSourceUrl(ref: RepoRef): string | null {
  const slug = REPO_GITHUB[ref.repo];
  if (!slug) return null;
  const base = `https://github.com/${slug}/blob/${ref.commit}/${ref.path}`;
  const range = normalizeRequestedLineRange(ref.lineStart, ref.lineEnd);
  if (range.kind !== "valid") return base;
  return ref.lineEnd === undefined
    ? `${base}#L${range.lineStart}`
    : `${base}#L${range.lineStart}-L${range.lineEnd}`;
}

export function formatSeedVersionLabel(repo: string, ref: string): string {
  if (ref === "rfork:main" || (repo === "rfork" && ref === "main")) return "RFork 工作版";
  return ref.replace(/^releases\//, "");
}

export function sortVersionLabels(refs: string[]): string[] {
  return [...new Set(refs)].sort(
    (a, b) => Number(a === "main") - Number(b === "main") || a.localeCompare(b, "en", { numeric: true }),
  );
}
