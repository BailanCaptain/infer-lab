/**
 * Spike A（标签清晰度）+ Spike B（真实尺寸张量渲染）验收页。
 *
 * Spike A：场景内中文标签用 troika SDF + 子集字体 + 深色描边，四个机位下都清晰、不重叠、不出视口；
 *          `window.__labels()` 给出每个标签的屏幕 AABB 供 Playwright 断言。
 * Spike B：真实形状（[6,1024] 极扁带、[1024,3072] 大块、词表 [151936,1024]）走全幅纹理平面，
 *          高亮区域走 InstancedMesh 放大窗口；压力模式 64×80 = 5120 格；
 *          换步只重写实例缓冲，耗时记在 `window.__spikeAB.maxCostMs`（目标 < 2 ms）。
 */
import { Canvas, useFrame } from "@react-three/fiber";
import { Profiler, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { planeView } from "../../../sim/timeline/plane";
import type { Highlight, TensorRecord } from "../../../sim/timeline/types";
import {
  createDefaultTimelineClient,
  installPlaybackKeys,
  loadTimelineIntoStore,
  selectNoMotion,
  selectStep,
  useLabUrlSync,
  usePlayback,
  useReducedMotionWatcher,
} from "../../../timeline";
import { type CameraPose, CameraRig, Clock, LabelProbe, TensorGrid } from "../../../viz3d";
import { frameDistance, gridLayout } from "../../../viz3d/primitives/layout";
import { DEFAULT_BOX } from "../../../viz3d/primitives/TensorGrid";
import { PlaybackBar } from "../../PlaybackBar";

const counters = { frames: 0, stepChanges: 0, lastCostMs: 0, maxCostMs: 0, pageCommits: 0 };
type SpikeWindow = Window & { __spikeAB?: typeof counters; __labReady?: boolean };

const FOV = 22;
const ASPECT = 16 / 9;

/** 四个机位（单位方向）：正面用于读标签，其余三个检验描边与不遮挡。距离由图元包围盒算出。 */
const VIEWS: { id: string; name: string; dir: [number, number, number] }[] = [
  { id: "front", name: "正面", dir: [0, 0, 1] },
  { id: "tilt", name: "斜视", dir: [0.42, 0.26, 0.87] },
  { id: "side", name: "侧视", dir: [0.6, 0.05, 0.8] },
  { id: "top", name: "俯视", dir: [0, 0.5, 0.87] },
];

const MODES = {
  default: { name: "默认窗口 6×12", window: { rows: 6, cols: 12 }, cellSize: 0.17, values: false },
  values: { name: "值模式 8×8", window: { rows: 8, cols: 8 }, cellSize: 0.44, values: true },
  stress: { name: "压力 64×80（5120 格）", window: { rows: 64, cols: 80 }, cellSize: 0.045, values: false },
} as const;
type ModeId = keyof typeof MODES;

function FrameCounter() {
  useFrame(() => {
    counters.frames++;
  });
  return null;
}

const chip = "h-8 rounded-field border px-3 text-label";
const chipOn = `${chip} border-accent bg-accent-soft text-ink`;
const chipOff = `${chip} border-line bg-surface-elevated text-ink-muted`;

export function SpikeABPage() {
  useLabUrlSync("spike-ab");
  useReducedMotionWatcher();
  useEffect(() => installPlaybackKeys(), []);
  const client = useMemo(createDefaultTimelineClient, []);
  useEffect(() => () => client.dispose(), [client]);
  useEffect(() => {
    void loadTimelineIntoStore(client, {
      modelId: "qwen3-0.6b",
      presetId: "kv-cache",
      chapterId: "spike-ab",
    });
  }, [client]);
  useEffect(() => {
    (window as SpikeWindow).__spikeAB = counters;
  }, []);

  const status = usePlayback((s) => s.status);
  const error = usePlayback((s) => s.error);
  const timeline = usePlayback((s) => s.timeline);
  const step = usePlayback(selectStep);
  const stepIndex = usePlayback((s) => s.stepIndex);
  const noMotion = usePlayback(selectNoMotion);
  useEffect(() => {
    (window as SpikeWindow).__labReady = status === "ready";
  }, [status]);

  const [viewId, setViewId] = useState("front");
  const [mode, setMode] = useState<ModeId>("default");
  const [slot, setSlot] = useState<"out" | "a" | "b">("out");

  // 当前步要展示的张量：默认输出，可切到输入 / 权重
  const tensorId = useMemo(() => {
    if (!step) return undefined;
    const op = step.model.op;
    const pick = slot === "out" ? op?.out : slot === "a" ? op?.a : op?.b;
    return pick ?? op?.out ?? step.model.tensors[step.model.tensors.length - 1];
  }, [step, slot]);

  const record: TensorRecord | undefined = tensorId ? timeline?.tensors[tensorId] : undefined;
  const highlight: Highlight | undefined = step?.model.highlight.find((h) => h.tensor === tensorId);

  // 上一步显示的张量：形状一致时 TensorGrid 会做 from→to 插值
  const prevRef = useRef<{ rec: TensorRecord; hl: Highlight | undefined } | null>(null);
  const prev = prevRef.current;
  useEffect(() => {
    prevRef.current = record ? { rec: record, hl: highlight } : null;
  }, [record, highlight]);
  useEffect(() => {
    if (stepIndex >= 0) counters.stepChanges++;
  }, [stepIndex]);

  const onCost = useCallback((ms: number) => {
    counters.lastCostMs = ms;
    counters.maxCostMs = Math.max(counters.maxCostMs, ms);
  }, []);

  const m = MODES[mode];
  const win = useMemo(() => ({ ...m.window }), [m]);
  // 相机取景来自图元自己的布局：同一份 gridLayout，图元长高了相机一定跟上
  const pose = useMemo<CameraPose>(() => {
    const v = VIEWS.find((x) => x.id === viewId) ?? VIEWS[0]!;
    const view = record ? planeView(record, { head: highlight?.head ?? 0 }) : { rows: 6, cols: 1024 };
    const layout = gridLayout(view, highlight, DEFAULT_BOX, win, m.cellSize);
    const d = frameDistance(layout, FOV, ASPECT);
    const len = Math.hypot(...v.dir);
    return {
      pos: [(v.dir[0] / len) * d, layout.centerY + (v.dir[1] / len) * d, (v.dir[2] / len) * d],
      target: [0, layout.centerY, 0],
    };
  }, [viewId, m, win, record, highlight]);

  return (
    <Profiler
      id="spike-ab"
      onRender={() => {
        counters.pageCommits++;
      }}
    >
      <main className="mx-auto max-w-6xl space-y-4 px-6 py-8">
        <header>
          <p className="mono text-label text-ink-muted">dev · Spike A / B</p>
          <h1 className="mt-1 text-title font-semibold">标签清晰度与真实尺寸张量渲染</h1>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          {VIEWS.map((v) => (
            <button
              type="button"
              key={v.id}
              data-testid={`view-${v.id}`}
              className={viewId === v.id ? chipOn : chipOff}
              onClick={() => setViewId(v.id)}
            >
              {v.name}
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-line" />
          {(Object.keys(MODES) as ModeId[]).map((k) => (
            <button
              type="button"
              key={k}
              data-testid={`mode-${k}`}
              className={mode === k ? chipOn : chipOff}
              onClick={() => setMode(k)}
            >
              {MODES[k].name}
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-line" />
          {(["a", "b", "out"] as const).map((s) => (
            <button
              type="button"
              key={s}
              data-testid={`slot-${s}`}
              className={slot === s ? chipOn : chipOff}
              onClick={() => setSlot(s)}
            >
              {s === "a" ? "输入 A" : s === "b" ? "权重 B" : "输出"}
            </button>
          ))}
        </div>

        <p
          className="mono text-label text-ink-muted"
          data-testid="status"
          data-status={status}
          data-tensor-id={record?.id ?? ""}
        >
          {status === "loading" && "Worker 构建中…"}
          {status === "error" && <span className="text-danger">错误：{error}</span>}
          {status === "ready" && timeline && (
            <>
              {timeline.modelName} · {timeline.preset.text} · 张量 {record?.id ?? "—"} ·{" "}
              {record ? `[${record.shape.join("×")}]` : ""} · 窗口 {win.rows}×{win.cols}
              {noMotion ? " · 无动效" : ""}
            </>
          )}
        </p>

        <div
          className="relative aspect-[16/9] overflow-hidden rounded-panel border border-line bg-canvas"
          data-testid="canvas"
          data-step-id={step?.id ?? ""}
        >
          <Canvas camera={{ position: [0, 0.6, 16], fov: FOV }} dpr={[1, 2]} frameloop="always">
            <ambientLight intensity={1.1} />
            <directionalLight position={[3, 6, 8]} intensity={1.2} />
            <Clock />
            <FrameCounter />
            <CameraRig pose={pose} instant={noMotion} />
            <LabelProbe />
            {record && (
              <TensorGrid
                key={mode}
                record={record}
                prev={prev?.rec ?? null}
                highlight={highlight}
                prevHighlight={prev?.hl}
                window={win}
                cellSize={m.cellSize}
                showValues={m.values}
                onCost={onCost}
                position={[0, 0, 0]}
                labelKey="tg"
              />
            )}
          </Canvas>
          <PlaybackBar />
        </div>

        {step && (
          <section className="rounded-card border border-line bg-surface p-4">
            <h2 className="text-lead font-medium" data-testid="narration-title">
              {step.title}
            </h2>
            <p className="mt-1 text-body text-ink-muted">{step.narration.brief}</p>
            {step.narration.formula && (
              <code className="mt-2 block text-compact">{step.narration.formula}</code>
            )}
          </section>
        )}
      </main>
    </Profiler>
  );
}
