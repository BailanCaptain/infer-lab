/**
 * 活母版：章节页三栏壳（DESIGN.md「Layout」）+ 真实的一层前向 21 步。
 * 顶栏：章节 / 模型 / 句子 / 硬件；左：课程轨道（步骤列表）；中：3D 画布 + 播放条；右：解读栏。
 * 3D 与 DOM 只通过 timeline store 的 step id 联动，播放期 DOM 不重渲染。
 */
import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import { TOKEN_PRESETS } from "../../sim/model/presets";
import { fmtBytes } from "../../sim/modelspec/analyze";
import { MODEL_PRESETS } from "../../sim/modelspec/presets";
import { planeView } from "../../sim/timeline/plane";
import type { Location, Step, Timeline } from "../../sim/timeline/types";
import {
  createDefaultTimelineClient,
  installPlaybackKeys,
  loadTimelineIntoStore,
  selectStep,
  useLabUrlSync,
  usePlayback,
  useReducedMotionWatcher,
} from "../../timeline";
import { CameraDirector, Clock, displayNotes, getSceneLayout, LAB_FOV, StepScene } from "../../viz3d";
import { PlaybackBar } from "../PlaybackBar";

const CHAPTER = { id: "03", title: "Transformer 层的双层数据流", eyebrow: "CH.03 · MODEL LAYER" };
const HARDWARE = "Atlas 800I A2 · 昇腾 910B（概念剖面）";
type LabWindow = Window & { __labReady?: boolean };

/** 步骤分组（课程轨道的小标题） */
function groupOf(id: string): string {
  if (id.startsWith("embed")) return "词嵌入";
  if (id.endsWith(".ln1") || id.includes(".attn.")) return "注意力";
  if (id.endsWith(".ln2") || id.includes(".mlp.")) return "MLP";
  if (id.includes(".kv.")) return "KV Cache";
  return "残差";
}

const EV_CLASS: Record<string, string> = {
  S: "text-ev-official border-ev-official/40",
  C: "text-ev-source border-ev-source/40",
  D: "text-ev-derived border-ev-derived/40",
  A: "text-ev-assumption border-ev-assumption/40",
  I: "text-ev-inference border-ev-inference/40",
  M: "text-ev-measured border-ev-measured/40",
};
const EV_NAME: Record<string, string> = { S: "官方", C: "源码", D: "推导", A: "假设", I: "推断", M: "实测" };
function evKind(id: string): string {
  return /([SCDAIM])\d+$/.exec(id)?.[1] ?? "A";
}

function locName(l: Location): string {
  switch (l.k) {
    case "hostDram":
      return "Host DRAM";
    case "hbm":
      return `HBM${l.slot} ${l.region === "weight" ? "权重区" : l.region === "kv" ? "KV 区" : "激活区"}`;
    case "link":
      return `${l.from}→${l.to}`;
    case "cube":
      return "Cube";
    case "vector":
      return "Vector";
    default:
      return l.k.toUpperCase();
  }
}

const UNIT_NAME: Record<string, string> = {
  cube: "Cube",
  vector: "Vector",
  hbm: "HBM",
  l2: "L2",
  hccs: "HCCS",
  host: "Host",
  mte1: "MTE1",
  mte2: "MTE2",
  mte3: "MTE3",
  fixpipe: "FixPipe",
};

/** matmul 步：当前高亮格的乘加展开（前几项 + 总和），DOM 里放长文案 */
function cellDerivation(step: Step, tl: Timeline): { text: string; terms: string[]; total: string } | null {
  const op = step.model.op;
  if (op?.kind !== "matmul" || !op.b) return null;
  const a = tl.tensors[op.a];
  const b = tl.tensors[op.b];
  const out = tl.tensors[op.out];
  const cell = step.model.highlight.find((h) => h.tensor === op.out)?.cells?.[0];
  if (!a || !b || !out || !cell) return null;
  const [r, c] = cell;
  const A = planeView(a);
  const B = planeView(b);
  const O = planeView(out);
  const K = A.cols;
  const terms = [0, 1, 2].map((k) => `${A.at(r, k).toFixed(3)}×${B.at(k, c).toFixed(3)}`);
  return {
    text: `${out.name.split("（")[0]}[${r},${c}] = Σₖ ${a.name.split("（")[0]}[${r},k]·${b.name.split("（")[0]}[k,${c}]，K=${K}`,
    terms,
    total: O.at(r, c).toFixed(4),
  };
}

function StepList({ timeline }: { timeline: Timeline }) {
  const stepIndex = usePlayback((s) => s.stepIndex);
  const seek = usePlayback.getState().seek;
  let lastGroup = "";
  return (
    <ol className="space-y-0.5" data-testid="step-list">
      {timeline.steps.map((s, i) => {
        const g = groupOf(s.id);
        const header = g !== lastGroup;
        lastGroup = g;
        const on = i === stepIndex;
        return (
          <li key={s.id}>
            {header && (
              <p className="mono mt-4 mb-1 px-2 text-micro text-rail-muted uppercase tracking-[0.12em]">
                {g}
              </p>
            )}
            <button
              type="button"
              onClick={() => seek(i)}
              className={`flex w-full items-center gap-2.5 rounded-field px-1.5 py-1.5 text-left text-compact ${
                on
                  ? "bg-rail-active text-ink-inverse"
                  : "text-rail-text hover:bg-rail-hover hover:text-ink-inverse"
              }`}
              aria-current={on ? "step" : undefined}
            >
              <span
                className={`mono grid h-6 w-6 shrink-0 place-items-center rounded-[7px] border text-micro font-semibold ${
                  on ? "border-accent bg-accent text-ink-inverse" : "border-rail-line text-rail-text"
                }`}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="truncate font-medium">{s.title}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function Reading({ step, timeline, index }: { step: Step; timeline: Timeline; index: number }) {
  const deriv = useMemo(() => cellDerivation(step, timeline), [step, timeline]);
  const notes = useMemo(
    () =>
      getSceneLayout(step, timeline).slots.flatMap((s) =>
        displayNotes(s.record, { head: s.highlight?.head }).map((n) => `${s.role} ${s.record.id}：${n}`),
      ),
    [step, timeline],
  );
  const hw = step.hardware;
  return (
    <div className="space-y-5" data-testid="reading">
      <header>
        <p className="mono text-caption text-ink-faint">
          第 {index + 1} / {timeline.steps.length} 步 · {step.id}
        </p>
        <h2 className="display mt-1 text-title" data-testid="narration-title">
          {step.title}
        </h2>
        <p className="mt-2 text-lead text-ink">{step.narration.brief}</p>
      </header>

      <details className="group rounded-card border border-line bg-surface-elevated px-4 py-3">
        <summary className="cursor-pointer select-none text-compact font-semibold text-ink">详细解释</summary>
        <p className="mt-2 text-body text-ink-muted">{step.narration.detail}</p>
      </details>

      {step.narration.formula && (
        <section>
          <h3 className="text-label font-medium text-ink-muted">公式</h3>
          <code className="mt-1 block rounded-field bg-surface-sunken px-3 py-2 text-compact text-ink">
            {step.narration.formula}
          </code>
        </section>
      )}

      <section>
        <h3 className="text-label font-medium text-ink-muted">形状变化</h3>
        <ul className="mt-1 space-y-1">
          {step.model.lineage.map((l) => (
            <li key={l.out} className="mono text-compact text-ink">
              {l.expr}
            </li>
          ))}
        </ul>
      </section>

      {deriv && (
        <section>
          <h3 className="text-label font-medium text-ink-muted">这一格怎么算</h3>
          <p className="mono mt-1 text-compact text-ink">{deriv.text}</p>
          <p className="mono mt-1 text-compact text-ink-muted">
            = {deriv.terms.join(" + ")} + ⋯ = <span className="text-accent">{deriv.total}</span>
          </p>
          <p className="mt-1 text-caption text-ink-faint">
            权重按固定种子生成，形状是真实模型，数值只用于观察机制 [A01]。
          </p>
        </section>
      )}

      {notes.length > 0 && (
        <section>
          <h3 className="text-label font-medium text-ink-muted">画面里的显示约定</h3>
          <ul className="mt-1 space-y-0.5">
            {notes.map((n) => (
              <li key={n} className="text-caption text-ink-faint">
                {n}
              </li>
            ))}
          </ul>
        </section>
      )}

      <details className="rounded-card border border-line bg-surface-elevated px-4 py-3">
        <summary className="cursor-pointer select-none text-compact font-semibold text-ink">
          硬件层（单 NPU）
        </summary>
        <div className="mt-1 flex flex-wrap gap-1">
          {hw.active.map((u) => (
            <span
              key={u}
              className="rounded-field border border-line bg-surface-elevated px-2 py-0.5 text-caption"
            >
              {UNIT_NAME[u] ?? u}
            </span>
          ))}
        </div>
        {hw.transfers.length > 0 && (
          <ul className="mt-2 space-y-1">
            {hw.transfers.map((t) => (
              <li
                key={`${t.tensor}-${locName(t.from)}-${locName(t.to)}`}
                className="text-caption text-ink-muted"
              >
                <span className="mono text-ink">{t.tensor}</span> {locName(t.from)} → {locName(t.to)} ·{" "}
                <span className="mono">{fmtBytes(t.bytes)}</span> · {t.reason}
              </li>
            ))}
          </ul>
        )}
        {hw.explanation && <p className="mt-2 text-caption text-ink-faint">{hw.explanation}</p>}
      </details>

      <details className="rounded-card border border-line bg-surface-elevated px-4 py-3">
        <summary className="cursor-pointer select-none text-compact font-semibold text-ink">
          证据来源 <span className="mono text-caption text-ink-faint">{step.evidence.length}</span>
        </summary>
        <div className="mt-2 flex flex-wrap gap-1">
          {step.evidence.map((e) => {
            const k = evKind(e);
            return (
              <span
                key={e}
                className={`mono rounded-field border px-2 py-0.5 text-caption ${EV_CLASS[k] ?? EV_CLASS.A}`}
                title={EV_NAME[k]}
              >
                [{e}] {EV_NAME[k]}
              </span>
            );
          })}
        </div>
      </details>
    </div>
  );
}

const select = "mono h-8 rounded-field border border-line bg-surface-elevated px-2 text-label text-ink";

export function LabPage() {
  useLabUrlSync(CHAPTER.id);
  useReducedMotionWatcher();
  useEffect(() => installPlaybackKeys(), []);
  const client = useMemo(createDefaultTimelineClient, []);
  useEffect(() => () => client.dispose(), [client]);

  const [modelId, setModelId] = useState("qwen3-0.6b");
  const [presetId, setPresetId] = useState("kv-cache");
  useEffect(() => {
    void loadTimelineIntoStore(client, { modelId, presetId, chapterId: CHAPTER.id });
  }, [client, modelId, presetId]);

  const status = usePlayback((s) => s.status);
  const error = usePlayback((s) => s.error);
  const timeline = usePlayback((s) => s.timeline);
  const step = usePlayback(selectStep);
  const stepIndex = usePlayback((s) => s.stepIndex);
  useEffect(() => {
    (window as LabWindow).__labReady = status === "ready";
  }, [status]);

  return (
    <div className="grid h-dvh grid-cols-1 bg-canvas text-ink lg:grid-cols-[248px_minmax(0,1fr)]">
      {/* 课程轨道：深色固定栏 */}
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
        <div className="mono mt-6 mb-1 flex justify-between px-1 text-micro text-rail-muted tracking-[0.08em]">
          <span>LEARNING PATH</span>
          <span>
            {String(stepIndex + 1).padStart(2, "0")} / {timeline?.steps.length ?? 21}
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{timeline && <StepList timeline={timeline} />}</div>
      </aside>

      <div className="grid min-h-0 grid-rows-[54px_minmax(0,1fr)]">
        <header className="flex items-center gap-3 border-line border-b bg-canvas/90 px-5 backdrop-blur">
          <span className="text-caption text-ink-muted">推理系统</span>
          <span className="text-ink-faint">/</span>
          <span className="text-caption font-semibold text-ink">{CHAPTER.title}</span>
          <div className="ml-auto flex items-center gap-2">
            <select
              className={select}
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              aria-label="模型"
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
              aria-label="输入句子"
              data-testid="preset"
            >
              {TOKEN_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.text}
                </option>
              ))}
            </select>
            <span className="hidden text-caption text-ink-muted xl:inline">{HARDWARE}</span>
          </div>
        </header>

        <div className="grid min-h-0 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="flex min-h-0 flex-col gap-3 overflow-y-auto px-5 pt-4 pb-5">
            <div>
              <p className="eyebrow">{CHAPTER.eyebrow}</p>
              <h1 className="display mt-1 text-display">{CHAPTER.title}</h1>
            </div>
            <PlaybackBar variant="bar" />
            <div
              className="relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-panel bg-scene text-scene-text"
              data-testid="canvas"
              data-step-id={step?.id ?? ""}
            >
              <div className="absolute inset-0">
                <Canvas camera={{ position: [0, 0.5, 16], fov: LAB_FOV }} dpr={[1, 2]} frameloop="always">
                  <ambientLight intensity={1.1} />
                  <directionalLight position={[3, 6, 8]} intensity={1.2} />
                  <Clock />
                  <CameraDirector />
                  {timeline && <StepScene />}
                </Canvas>
              </div>
              {status === "loading" && (
                <div className="absolute inset-0 flex items-center justify-center text-compact text-scene-muted">
                  Worker 正在计算这一层的 21 步…
                </div>
              )}
              {status === "error" && (
                <div className="absolute inset-0 flex items-center justify-center text-compact text-danger">
                  错误：{error}
                </div>
              )}
              {step && (
                <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 rounded-field bg-scene-panel/90 px-3 py-1.5 text-compact">
                  <span className="mono text-accent">{stepIndex + 1}</span>
                  <span className="mono text-scene-muted">/{timeline?.steps.length ?? 0}</span>
                  <span>{step.narration.brief}</span>
                </div>
              )}
            </div>
          </section>

          <aside className="min-h-0 overflow-y-auto border-line border-t bg-surface px-5 py-4 xl:border-t-0 xl:border-l">
            {step && timeline ? (
              <Reading step={step} timeline={timeline} index={stepIndex} />
            ) : (
              <p className="text-compact text-ink-muted">加载中…</p>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
