/**
 * 系统 prefers-reduced-motion → store.reducedMotion。与 ?nofx=1 一起由 selectNoMotion 合并。
 */
import { useEffect } from "react";
import { usePlayback } from "./store";

const QUERY = "(prefers-reduced-motion: reduce)";

/** 立即同步一次并监听变化，返回卸载函数。无 matchMedia（如测试环境）时不做事。 */
export function watchReducedMotion(
  win: Pick<Window, "matchMedia"> | undefined = globalThis.window,
): () => void {
  if (!win || typeof win.matchMedia !== "function") return () => {};
  const mq = win.matchMedia(QUERY);
  const apply = () => usePlayback.getState().setReducedMotion(mq.matches);
  apply();
  mq.addEventListener("change", apply);
  return () => mq.removeEventListener("change", apply);
}

export function useReducedMotionWatcher(): void {
  useEffect(() => watchReducedMotion(), []);
}
