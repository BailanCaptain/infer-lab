/**
 * `#/model`："塔"的第一段——第 0 层注意力块的格子体（静帧，等用户批准后再垒整座塔、再加动效）。
 * 左栏是块目录（点了镜头飞过去），中间整块是白卡片画布；没有右栏长文，细节在悬停条。
 */
import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import { buildLayerTimeline } from "../../sim/model/forwardLayer";
import { getTokenPreset } from "../../sim/model/presets";
import { fmtBytes, fmtCount } from "../../sim/modelspec/analyze";
import { getPresetSpec } from "../../sim/modelspec/presets";
import { LAB_FOV } from "../../viz3d";
import type { Box3Like } from "../../viz3d/model/frame";
import { type AttentionLayout, attentionLayout, type Volume } from "../../viz3d/tower/attentionLayout";
import { instanceCount } from "../../viz3d/tower/CellVolume";
import { shapeText, TowerScene } from "../../viz3d/tower/TowerScene";

type ModelWindow = Window & { __modelReady?: boolean };
const MODEL_ID = "qwen3-0.6b";
const KIND_NAME = { act: "激活", weight: "权重", kv: "KV Cache", scores: "注意力概率" } as const;

/** 取景盒：全览或某一块（留边给左侧标签） */
function focusOf(layout: AttentionLayout, id: string | null): Box3Like {
  const b = layout.bounds;
  if (id) {
    const v = layout.volumes.find((x) => x.id === id);
    if (v) {
      const pad = Math.max(60, v.h * 0.15);
      return {
        minX: v.x - pad - 600,
        maxX: v.x + v.w + pad,
        minY: v.y - pad,
        maxY: v.y + v.h + pad,
        minZ: v.z - v.d,
        maxZ: v.z,
      };
    }
  }
  return {
    minX: b.minX - 700,
    maxX: b.maxX + 100,
    minY: b.minY - 60,
    maxY: b.maxY + 60,
    minZ: b.minZ,
    maxZ: b.maxZ,
  };
}

export function ModelPage() {
  const preset = getTokenPreset();
  const spec = useMemo(() => getPresetSpec(MODEL_ID), []);
  const timeline = useMemo(
    () =>
      buildLayerTimeline(spec, { id: preset.id, text: preset.text, tokens: preset.tokens, ids: preset.ids }),
    [spec, preset],
  );
  const layout = useMemo(() => attentionLayout(timeline), [timeline]);
  const cells = useMemo(() => layout.volumes.reduce((a, v) => a + instanceCount(v), 0), [layout]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [view, setView] = useState<string | null>(null);
  const [focus, setFocus] = useState<Box3Like>(() => focusOf(layout, null));
  const fly = (id: string | null) => {
    setView(id);
    setFocus(focusOf(layout, id));
  };
  useEffect(() => {
    (window as ModelWindow).__modelReady = true;
  }, []);

  const hov: Volume | undefined = hovered ? layout.volumes.find((v) => v.id === hovered) : undefined;

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
        <p className="mono mt-6 mb-1 px-1 text-micro text-rail-muted tracking-[0.08em]">
          LAYER 0 · ATTENTION
        </p>
        <ol className="min-h-0 flex-1 space-y-0.5 overflow-y-auto" data-testid="volume-list">
          {layout.volumes.map((v, i) => {
            const on = view === v.id;
            return (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => fly(v.id)}
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
                  <span className="truncate font-medium">{v.name}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="mt-3 space-y-1 px-1 text-caption text-rail-muted">
          <p>
            句子 <span className="text-rail-text">{preset.text}</span>
          </p>
          <p>
            画了 <span className="mono text-rail-text">{fmtCount(cells)}</span> 个格子
          </p>
        </div>
      </aside>

      <div className="grid min-h-0 grid-rows-[54px_minmax(0,1fr)]">
        <header className="flex items-center gap-3 border-line border-b bg-canvas/90 px-5 backdrop-blur">
          <span className="text-caption text-ink-muted">推理系统</span>
          <span className="text-ink-faint">/</span>
          <span className="text-caption font-semibold text-ink">模型结构</span>
          <span className="mono ml-auto text-caption text-ink-muted">{spec.name}</span>
        </header>

        <section className="flex min-h-0 flex-col gap-3 px-5 pt-4 pb-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">MODEL · {spec.name} · 第 0 层注意力</p>
              <h1 className="display mt-1 text-display">每一格都是一个数</h1>
            </div>
            <div className="flex items-center gap-1.5" data-testid="views">
              <button
                type="button"
                onClick={() => fly(null)}
                className={`h-8 rounded-field border px-3 text-compact ${
                  view === null
                    ? "border-accent bg-accent text-ink-inverse"
                    : "border-line bg-surface-elevated text-ink hover:border-line-strong"
                }`}
              >
                全览
              </button>
            </div>
          </div>

          <div
            className="relative min-h-0 flex-1 overflow-hidden rounded-panel border border-line bg-scene shadow-card"
            data-testid="canvas"
          >
            <div className="absolute inset-0">
              <Canvas
                camera={{ position: [0, 2000, 9000], fov: LAB_FOV, near: 1, far: 100_000 }}
                dpr={[1, 2]}
                flat
              >
                <TowerScene layout={layout} hovered={hovered} onHover={setHovered} focus={focus} />
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
              <span className="text-ink-faint">
                1 格 = 1 个数（大矩阵按标注合并）；颜色深 = 正值大，浅 = 负值大
              </span>
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
                  {shapeText(hov)} · {fmtCount(hov.shape.reduce((a, b) => a * b, 1))} 元素 ·{" "}
                  {fmtBytes(hov.record.bytes)}
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
