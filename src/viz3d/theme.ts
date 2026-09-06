/**
 * 3D 场景取色：唯一来源是 design/tokens.css 的 CSS 变量，组件里禁写裸色。
 * 读一次缓存起来（切主题时调 resetVizTheme）。
 */
import { Color } from "three";

const KEYS = {
  /* 3D 画布读 scene-*（白卡片），身份色与页面共用 */
  canvas: "--color-scene",
  surface: "--color-scene-panel",
  ink: "--color-scene-text",
  inkMuted: "--color-scene-muted",
  inkFaint: "--color-scene-muted",
  line: "--color-scene-line",
  lineStrong: "--color-scene-line",
  accent: "--color-accent",
  token: "--color-token",
  weight: "--color-weight",
  kv: "--color-kv",
  tokenSoft: "--color-token-soft",
  weightSoft: "--color-weight-soft",
  kvSoft: "--color-kv-soft",
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
  canvas: "#ffffff",
  surface: "#f5f2ea",
  ink: "#17211f",
  inkMuted: "#66716d",
  inkFaint: "#66716d",
  line: "#d8d8cf",
  lineStrong: "#d8d8cf",
  accent: "#e85b32",
  token: "#087f73",
  weight: "#c78300",
  kv: "#4c65b6",
  tokenSoft: "#ddf4ef",
  weightSoft: "#fff4cf",
  kvSoft: "#e8edff",
  danger: "#b54237",
  neg: "#4fd1c5",
  pos: "#f2a94a",
  zero: "#121c2c",
  mask: "#33415a",
  grid: "#1c2a3f",
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
