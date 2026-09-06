/**
 * Spike C（计划 §2.10 #3）+ Spike D 浏览器版：
 * - Worker 内 buildHardwareTimeline 并计时（buildMs / transferMs）；
 * - Canvas 内唯一 <Clock/> 推进瞬态 progress.t，图元在 useFrame 里读 t，播放期零 React commit；
 * - 播放条、快捷键、URL ?step=&layer=&nofx=1、reduced-motion 全部走 timeline 层。
 * 计数器挂在 window.__spikeC 供 Playwright 读取；读计数不触发渲染。
 */
import { Canvas, useFrame } from "@react-three/fiber";
import { RotateCcw } from "lucide-react";
import { memo, Profiler, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Group, Mesh } from "three";
import { TOKEN_PRESETS } from "../../../sim/model/presets";
import { MODEL_PRESETS } from "../../../sim/modelspec/presets";
import {
  createDefaultTimelineClient,
  installPlaybackKeys,
  loadTimelineIntoStore,
  progress,
  selectNoMotion,
  selectStep,
  selectStepCount,
  useLabUrlSync,
  usePlayback,
  useReducedMotionWatcher,
} from "../../../timeline";
import { Clock } from "../../../viz3d";
import { PlaybackBar } from "../../PlaybackBar";

const counters = { pageCommits: 0, barRenders: 0, frames: 0, stepChanges: 0, progress };
type SpikeWindow = Window & { __spikeC?: typeof counters; __labReady?: boolean };

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#ffffff";
}

/** 进度条：每帧读 progress.t 写 scale，不经过 React。 */
function TweenBar() {
  counters.barRenders++;
  const ref = useRef<Mesh>(null);
  const color = useMemo(() => cssVar("--color-token"), []);
  useFrame(() => {
    counters.frames++;
    const m = ref.current;
    if (!m) return;
    const t = Math.max(0.001, progress.t);
    m.scale.x = t;
    m.position.x = -3 + 3 * t;
  });
  return (
    <mesh ref={ref} position={[-3, 0.9, 0]}>
      <boxGeometry args={[6, 0.35, 0.35]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

const MemoTweenBar = memo(TweenBar);

/** 步骤标记：换步时在 useLayoutEffect 里一次性改缩放与颜色，播放期不动。 */
function StepMarkers() {
  const count = usePlayback(selectStepCount);
  const stepIndex = usePlayback((s) => s.stepIndex);
  const group = useRef<Group>(null);
  const accent = useMemo(() => cssVar("--color-accent"), []);
  const idle = useMemo(() => cssVar("--color-line-strong"), []);
  useLayoutEffect(() => {
    counters.stepChanges++;
    const g = group.current;
    if (!g) return;
    g.children.forEach((child, i) => {
      const m = child as Mesh & { material: { color: { set(c: string): void } } };
      const on = i === stepIndex;
      m.scale.setScalar(on ? 1.5 : 0.78);
      m.material.color.set(on ? accent : idle);
    });
  }, [stepIndex, accent, idle]);
  const n = Math.max(count, 1);
  const w = 6 / n;
  return (
    <group ref={group}>
      {Array.from({ length: count }, (_, i) => (
        <mesh key={String(i)} position={[-3 + w * (i + 0.5), -0.6, 0]}>
          <boxGeometry args={[w * 0.6, 0.4, 0.4]} />
          <meshStandardMaterial color={idle} />
        </mesh>
      ))}
    </group>
  );
}

const DEFAULT_MODEL = "qwen3-0.6b";
const DEFAULT_PRESET = "kv-cache";

export function SpikeCPage() {
  useLabUrlSync("spike-c");
  useReducedMotionWatcher();
  useEffect(() => installPlaybackKeys(), []);
  const client = useMemo(createDefaultTimelineClient, []);
  useEffect(() => () => client.dispose(), [client]);

  const [modelId, setModelId] = useState(DEFAULT_MODEL);
  const [presetId, setPresetId] = useState(DEFAULT_PRESET);
  const status = usePlayback((s) => s.status);
  const error = usePlayback((s) => s.error);
  const loadMeta = usePlayback((s) => s.loadMeta);
  const layer = usePlayback((s) => s.layer);
  const noMotion = usePlayback(selectNoMotion);
  const step = usePlayback(selectStep);
  const timeline = usePlayback((s) => s.timeline);
  const [snap, setSnap] = useState(() => ({ ...counters }));

  useEffect(() => {
    (window as SpikeWindow).__spikeC = counters;
  }, []);
  useEffect(() => {
    (window as SpikeWindow).__labReady = status === "ready";
  }, [status]);
  useEffect(() => {
    void loadTimelineIntoStore(client, { modelId, presetId, chapterId: "spike-c" });
  }, [client, modelId, presetId]);

  const select = "mono h-8 rounded-field border border-line bg-surface-elevated px-2 text-label text-ink";
  return (
    <Profiler
      id="spike-c"
      onRender={() => {
        counters.pageCommits++;
      }}
    >
      <main className="mx-auto max-w-5xl space-y-4 px-6 py-10">
        <header>
          <p className="mono text-label text-ink-muted">dev · Spike C / D</p>
          <h1 className="mt-1 text-title font-semibold">播放引擎与 Worker 计时</h1>
        </header>

        <div className="flex flex-wrap items-center gap-3">
          <select
            className={select}
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            data-testid="model"
          >
            {MODEL_PRESETS.filter((m) => m.id !== "qwen3-30b-a3b").map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <select
            className={select}
            value={presetId}
            onChange={(e) => setPresetId(e.target.value)}
            data-testid="preset"
          >
            {TOKEN_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.text}（S={p.ids.length}）
              </option>
            ))}
          </select>
          <div className="ml-auto flex gap-1">
            {(["model", "hardware", "both"] as const).map((l) => (
              <button
                type="button"
                key={l}
                data-testid={`layer-${l}`}
                onClick={() => usePlayback.getState().setLayer(l)}
                className={`h-8 rounded-field border px-3 text-label ${
                  layer === l
                    ? "border-accent bg-accent-soft text-ink"
                    : "border-line bg-surface-elevated text-ink-muted"
                }`}
              >
                {l === "model" ? "模型层" : l === "hardware" ? "硬件层" : "双层"}
              </button>
            ))}
          </div>
        </div>

        <p
          className="mono text-label text-ink-muted"
          data-testid="status"
          data-status={status}
          data-build-ms={loadMeta?.buildMs ?? ""}
          data-transfer-ms={loadMeta?.transferMs ?? ""}
        >
          {status === "loading" && "Worker 构建中…"}
          {status === "error" && <span className="text-danger">错误：{error}</span>}
          {status === "ready" && loadMeta && timeline && (
            <>
              {timeline.modelName} · {timeline.preset.text} · {timeline.steps.length} 步 · Worker 构建{" "}
              {loadMeta.buildMs.toFixed(0)} ms · 传输 {loadMeta.transferMs.toFixed(0)} ms
              {loadMeta.cached ? " · 缓存" : ""}
              {noMotion ? " · 无动效" : ""}
            </>
          )}
        </p>

        <div
          className="relative aspect-[16/7] overflow-hidden rounded-panel border border-line bg-surface"
          data-testid="canvas"
          data-step-id={step?.id ?? ""}
        >
          <Canvas camera={{ position: [0, 0, 7], fov: 40 }} dpr={1} frameloop="always">
            <ambientLight intensity={1.2} />
            <directionalLight position={[3, 5, 6]} intensity={1.5} />
            <Clock />
            {timeline && (
              <>
                <MemoTweenBar />
                <StepMarkers />
              </>
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

        <section className="rounded-card border border-line bg-surface p-4">
          <div className="flex items-center gap-3">
            <h2 className="text-compact font-medium">Spike C 计数</h2>
            <button
              type="button"
              className="ml-auto inline-flex h-8 items-center gap-1 rounded-field border border-line bg-surface-elevated px-3 text-label"
              onClick={() => setSnap({ ...counters })}
              data-testid="snapshot"
            >
              <RotateCcw size={14} /> 刷新
            </button>
          </div>
          <dl className="mono mt-2 grid grid-cols-4 gap-2 text-label text-ink-muted">
            <dt>页面 commit</dt>
            <dd className="text-ink">{snap.pageCommits}</dd>
            <dt>TweenBar 渲染</dt>
            <dd className="text-ink">{snap.barRenders}</dd>
            <dt>帧数</dt>
            <dd className="text-ink">{snap.frames}</dd>
            <dt>换步次数</dt>
            <dd className="text-ink">{snap.stepChanges}</dd>
          </dl>
          <p className="mt-2 text-caption text-ink-faint">
            验收：播放期间 commit 与渲染只随换步增加，帧数独立增长。快捷键 Space / ← → / Home End / [ ]。
          </p>
        </section>
      </main>
    </Profiler>
  );
}
