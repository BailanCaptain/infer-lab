/**
 * 3D 场景取色：唯一来源是 design/tokens.css 的 CSS 变量，组件里禁写裸色。
 * 读一次缓存起来（切主题时调 resetVizTheme）。
 */
import { Color } from "three";

const KEYS = {
  canvas: "--color-canvas",
  surface: "--color-surface",
  ink: "--color-ink",
  inkMuted: "--color-ink-muted",
  inkFaint: "--color-ink-faint",
  line: "--color-line",
  lineStrong: "--color-line-strong",
  accent: "--color-accent",
  token: "--color-token",
  weight: "--color-weight",
  kv: "--color-kv",
  danger: "--color-danger",
  neg: "--color-viz-neg",
  pos: "--color-viz-pos",
  zero: "--color-viz-zero",
  mask: "--color-viz-mask",
  grid: "--color-viz-grid",
} as const;

export type VizColorName = keyof typeof KEYS;

/** CSS 缺失时的兜底（与 tokens.css 保持一致），保证无样式环境也能渲染 */
const FALLBACK: Record<VizColorName, string> = {
  canvas: "#0b0f14",
  surface: "#121820",
  ink: "#e6edf5",
  inkMuted: "#9aa8ba",
  inkFaint: "#64728a",
  line: "#263242",
  lineStrong: "#34435a",
  accent: "#f28c38",
  token: "#38d6d0",
  weight: "#e2b25a",
  kv: "#5b8def",
  danger: "#ef5a5a",
  neg: "#38d6d0",
  pos: "#f0a94a",
  zero: "#0d1219",
  mask: "#2b3546",
  grid: "#1d2634",
};

export type VizTheme = Record<VizColorName, Color>;

let cache: VizTheme | undefined;

function readVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function vizTheme(): VizTheme {
  if (cache) return cache;
  const out = {} as VizTheme;
  for (const k of Object.keys(KEYS) as VizColorName[]) {
    out[k] = new Color(readVar(KEYS[k], FALLBACK[k]));
  }
  cache = out;
  return out;
}

export function resetVizTheme(): void {
  cache = undefined;
}
