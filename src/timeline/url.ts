/**
 * URL 同步（计划 §2.3）：?ch=<章节 id>&step=<step id>&layer=model|hardware|both&nofx=1
 * 用 step id 不用序号；写回用 history.replaceState + 150ms 节流，不经过 react-router，
 * 因此换步写 URL 不会引发任何 React 重渲染（Spike C 实测 useSearchParams 会让整页多 commit 一次）。
 * 站点用 HashRouter，查询串在 hash 里：#/path?step=…
 */
import { useEffect, useRef } from "react";
import { type LayerView, usePlayback } from "./store";

export const URL_THROTTLE_MS = 150;
const LAYERS: readonly LayerView[] = ["model", "hardware", "both"];

export interface LabQuery {
  ch?: string;
  step?: string;
  layer?: LayerView;
  nofx: boolean;
}

export function parseLabQuery(input: string | URLSearchParams): LabQuery {
  const p = typeof input === "string" ? new URLSearchParams(input) : input;
  const q: LabQuery = { nofx: false };
  const ch = p.get("ch");
  if (ch) q.ch = ch;
  const step = p.get("step");
  if (step) q.step = step;
  const layer = p.get("layer");
  if (layer && (LAYERS as readonly string[]).includes(layer)) q.layer = layer as LayerView;
  const nofx = p.get("nofx");
  q.nofx = nofx === "1" || nofx === "true";
  return q;
}

/** 在 base 基础上覆盖播放相关参数；nofx 为 false 时删除该键。 */
export function formatLabQuery(q: LabQuery, base?: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams(base);
  const setOrDelete = (k: string, v: string | undefined) => (v ? out.set(k, v) : out.delete(k));
  setOrDelete("ch", q.ch);
  setOrDelete("step", q.step);
  setOrDelete("layer", q.layer);
  setOrDelete("nofx", q.nofx ? "1" : undefined);
  return out;
}

/** 从 "#/path?a=1" 取查询串。 */
export function readHashQuery(hash: string): URLSearchParams {
  const i = hash.indexOf("?");
  return new URLSearchParams(i < 0 ? "" : hash.slice(i + 1));
}

/** 保留 hash 路径，替换查询串；返回新的 hash（含 #）。 */
export function withHashQuery(hash: string, params: URLSearchParams): string {
  const i = hash.indexOf("?");
  const path = i < 0 ? hash : hash.slice(0, i);
  const qs = params.toString();
  return `${path || "#/"}${qs ? `?${qs}` : ""}`;
}

interface HistoryLike {
  location: { pathname: string; search: string; hash: string };
  history: { state: unknown; replaceState(state: unknown, unused: string, url: string): void };
}

/** 写回地址栏（replace）；hash 未变化时不动。 */
export function replaceHashQuery(params: URLSearchParams, win: HistoryLike = window): void {
  const { pathname, search, hash } = win.location;
  const next = withHashQuery(hash, params);
  if (next === hash) return;
  win.history.replaceState(win.history.state, "", `${pathname}${search}${next}`);
}

/**
 * 章节页/实验页挂载一次：
 * 1. 首次读 URL → layer、nofx 立即生效，step 等时间线载入后 seek；
 * 2. 之后 store 的 stepIndex / layer / nofx 变化 → 节流写回 URL（replace，不重渲染）。
 */
export function useLabUrlSync(chapterId: string): void {
  const pendingStep = useRef<string | null>(null);
  const timeline = usePlayback((s) => s.timeline);

  useEffect(() => {
    const q = parseLabQuery(readHashQuery(window.location.hash));
    const a = usePlayback.getState();
    if (q.layer) a.setLayer(q.layer);
    a.setNofx(q.nofx);
    if (q.step) pendingStep.current = q.step;
  }, []);

  useEffect(() => {
    if (!timeline || !pendingStep.current) return;
    usePlayback.getState().seek(pendingStep.current);
    pendingStep.current = null;
  }, [timeline]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const write = () => {
      timer = null;
      const s = usePlayback.getState();
      const step = s.timeline?.steps[s.stepIndex];
      if (!step) return;
      const base = readHashQuery(window.location.hash);
      replaceHashQuery(formatLabQuery({ ch: chapterId, step: step.id, layer: s.layer, nofx: s.nofx }, base));
    };
    const unsub = usePlayback.subscribe((s, p) => {
      const changed =
        s.stepIndex !== p.stepIndex || s.layer !== p.layer || s.nofx !== p.nofx || s.timeline !== p.timeline;
      if (changed && !timer) timer = setTimeout(write, URL_THROTTLE_MS);
    });
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, [chapterId]);
}
