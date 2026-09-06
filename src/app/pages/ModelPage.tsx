/**
 * `#/model`：一个模型 = 一个 3D 物体。左栏是模型的结构目录（点了镜头飞过去），中间整块是白纸画布。
 * 没有右栏长文：信息只在画面里（名字 + 形状）和悬停条里（元素数、字节）。
 */
import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import { getTokenPreset } from "../../sim/model/presets";
import { analyzeParams, fmtBytes, fmtCount } from "../../sim/modelspec/analyze";
import { getPresetSpec, MODEL_PRESETS } from "../../sim/modelspec/presets";
import { LAB_FOV } from "../../viz3d";
import type { Box3Like } from "../../viz3d/model/frame";
import { type ModelLayout, modelLayout } from "../../viz3d/model/layout";
import { ModelScene, shapeText } from "../../viz3d/model/ModelScene";

type ModelWindow = Window & { __modelReady?: boolean };

const KIND_NAME = {
  act: "激活",
  weight: "权重",
  kv: "KV Cache",
  scores: "注意力分数",
  norm: "归一化权重",
} as const;

/** 取景盒：全览或某一组（第 0 层 = 注意力 + MLP 两组） */
function computeFocus(layout: ModelLayout, view: string): Box3Like {
  const b = layout.bounds;
  const pad = 0.6;
  const box = {
    minX: b.minX - pad,
    maxX: b.maxX + pad,
    minY: 0,
    maxY: b.maxH,
    minZ: b.minZ - pad,
    maxZ: b.maxZ + pad,
  };
  if (view === "all") return box;
  const gs = layout.groups.filter((g) => (view === "L0" ? g.id.startsWith("L0.") : g.id === view));
  if (!gs.length) return box;
  return {
    ...box,
    maxY: view === "deck" ? b.maxH : 0.6,
    minZ: Math.min(...gs.map((g) => g.minZ)) - pad,
    maxZ: Math.max(...gs.map((g) => g.maxZ)) + pad,
  };
}

export function ModelPage() {
  const [modelId, setModelId] = useState("qwen3-0.6b");
  const preset = getTokenPreset();
  const spec = useMemo(() => getPresetSpec(modelId), [modelId]);
  const layout = useMemo(() => modelLayout(spec, preset.ids.length), [spec, preset.ids.length]);
  const params = useMemo(() => analyzeParams(spec), [spec]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [view, setView] = useState<string>("all");
  const [focus, setFocus] = useState<Box3Like>(() => computeFocus(layout, "all"));
  const fly = (id: string) => {
    setView(id);
    setFocus(computeFocus(layout, id));
  };
  useEffect(() => {
    (window as ModelWindow).__modelReady = true;
  }, []);

  const hov = hovered ? layout.blocks.find((b) => b.id === hovered) : undefined;
  const views: [string, string][] = [
    ["all", "全览"],
    ["embed", "词嵌入"],
    ["L0", "第 0 层"],
    ["head", "输出"],
  ];

  return (
    <div className="grid h-dvh grid-cols-1 bg-canvas text-ink lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="hidden min-h-0 flex-col bg-rail px-3.5 py-4 text-rail-text lg:flex">
        <a href="#/" className="flex items-center gap-2.5 px-1 text-ink-inverse no-underline">
          <span className="mono grid h-8 w-8 place-items-center rounded-[10px] bg-accent text-micro font-extrabold">
            IL
          </span>
          <span className="flex flex-col">
            <b className="text-compact">infer-lab</b>
            <small className="text-micro text-rail-muted tracking-wide">推理系统学习图谱</small>
          </span>
        </a>
        <p className="mono mt-6 mb-1 px-1 text-micro text-rail-muted tracking-[0.08em]">MODEL STRUCTURE</p>
        <ol className="space-y-0.5" data-testid="group-list">
          {layout.groups.map((g, i) => {
            const on = view === g.id || (view === "L0" && g.id.startsWith("L0."));
            return (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => fly(g.id.startsWith("L0.") ? "L0" : g.id)}
                  className={`flex w-full items-center gap-2.5 rounded-field px-1.5 py-1.5 text-left text-compact ${
                    on
                      ? "bg-rail-active text-ink-inverse"
                      : "text-rail-text hover:bg-rail-hover hover:text-ink-inverse"
                  }`}
                >
                  <span
                    className={`mono grid h-6 w-6 shrink-0 place-items-center rounded-[7px] border text-micro font-semibold ${
                      on ? "border-accent bg-accent text-ink-inverse" : "border-rail-line text-rail-text"
                    }`}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="truncate font-medium">{g.name}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="mt-auto space-y-1 px-1 text-caption text-rail-muted">
          <p>
            总参数 <span className="mono text-rail-text">{fmtCount(params.total)}</span>
          </p>
          <p>
            权重 <span className="mono text-rail-text">{fmtBytes(params.total * spec.bytesPerParam)}</span>
            <span className="mono"> {spec.dtype}</span>
          </p>
        </div>
      </aside>

      <div className="grid min-h-0 grid-rows-[54px_minmax(0,1fr)]">
        <header className="flex items-center gap-3 border-line border-b bg-canvas/90 px-5 backdrop-blur">
          <span className="text-caption text-ink-muted">推理系统</span>
          <span className="text-ink-faint">/</span>
          <span className="text-caption font-semibold text-ink">模型结构</span>
          <div className="ml-auto flex items-center gap-2">
            <select
              className="mono h-8 rounded-field border border-line bg-surface-elevated px-2 text-label text-ink"
              value={modelId}
              onChange={(e) => {
                setModelId(e.target.value);
                setFocus(computeFocus(modelLayout(getPresetSpec(e.target.value), preset.ids.length), view));
              }}
              aria-label="模型"
              data-testid="model"
            >
              {MODEL_PRESETS.filter((m) => m.id !== "qwen3-30b-a3b").map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </header>

        <section className="flex min-h-0 flex-col gap-3 px-5 pt-4 pb-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">MODEL · {spec.name}</p>
              <h1 className="display mt-1 text-display">一个模型，一个物体</h1>
            </div>
            <div className="flex items-center gap-1.5" data-testid="views">
              {views.map(([id, name]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => fly(id)}
                  className={`h-8 rounded-field border px-3 text-compact ${
                    view === id
                      ? "border-accent bg-accent text-ink-inverse"
                      : "border-line bg-surface-elevated text-ink hover:border-line-strong"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          <div
            className="relative min-h-0 flex-1 overflow-hidden rounded-panel border border-line bg-scene shadow-card"
            data-testid="canvas"
          >
            <div className="absolute inset-0">
              <Canvas camera={{ position: [0, 30, 60], fov: LAB_FOV, near: 0.1, far: 500 }} dpr={[1, 2]} flat>
                <ModelScene layout={layout} hovered={hovered} onHover={setHovered} focus={focus} />
              </Canvas>
            </div>
            <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-3 rounded-field bg-scene-panel/90 px-3 py-1.5 text-caption text-ink-muted">
              <span className="flex items-center gap-1.5">
                <i className="inline-block h-2.5 w-2.5 rounded-[3px] border border-token bg-token-soft" />
                激活
              </span>
              <span className="flex items-center gap-1.5">
                <i className="inline-block h-2.5 w-2.5 rounded-[3px] border border-weight bg-weight-soft" />
                权重
              </span>
              <span className="flex items-center gap-1.5">
                <i className="inline-block h-2.5 w-2.5 rounded-[3px] border border-kv bg-kv-soft" />
                KV Cache
              </span>
              <span className="text-ink-faint">块的边长 ∝ √元素数；句长 S = {preset.ids.length}</span>
            </div>
            {hov && (
              <div
                className="pointer-events-none absolute right-3 bottom-3 rounded-field bg-surface-elevated px-3 py-2 text-compact shadow-card"
                data-testid="hover"
              >
                <p className="font-semibold text-ink">
                  {hov.name} <span className="text-caption text-ink-muted">{KIND_NAME[hov.kind]}</span>
                </p>
                <p className="mono text-ink-muted">
                  {shapeText(hov)} · {fmtCount(hov.elements)} 元素 ·{" "}
                  {fmtBytes(hov.elements * spec.bytesPerParam)}
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
