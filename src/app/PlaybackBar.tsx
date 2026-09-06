/**
 * 播放条：章节页与各 dev 页共用的唯一一份。只读 timeline store 的离散状态，
 * 不碰 progress.t（步内进度由画面元素自己每帧读），所以播放期不会重渲染。
 *
 * Tailwind v4 的冲突类按样式表顺序取胜，基础类不带背景色，变体各自加。
 */
import { ChevronFirst, ChevronLast, Crosshair, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { useEffect, useRef } from "react";
import { progress, SPEED_STEPS, selectStep, selectStepCount, usePlayback } from "../timeline";

/** 节拍条：直接改 DOM，不走 React 状态，播放期零 commit */
function BeatStrip({ beats }: { beats: { at: number; label: string }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = ref.current;
      if (el) {
        const t = progress.t;
        let active = -1;
        beats.forEach((b, i) => {
          if (t >= b.at) active = i;
        });
        el.childNodes.forEach((n, i) => {
          (n as HTMLElement).dataset.active = i === active ? "1" : "0";
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [beats]);
  return (
    <div ref={ref} className="flex shrink-0 gap-1" data-testid="beats">
      {beats.map((b) => (
        <span
          key={b.label}
          className="shrink-0 whitespace-nowrap rounded-field border border-line px-1.5 text-caption text-ink-faint data-[active=1]:border-accent data-[active=1]:text-accent"
        >
          {b.label}
        </span>
      ))}
    </div>
  );
}

const btnBase =
  "inline-flex h-8 w-8 items-center justify-center rounded-field border active:scale-[0.97] disabled:opacity-40";
export const btnGhost = `${btnBase} border-line bg-surface-elevated text-ink hover:border-line-strong`;
export const btnPrimary = `${btnBase} border-accent bg-accent text-ink-inverse hover:bg-accent-hover`;

export function PlaybackBar({ variant = "overlay" }: { variant?: "overlay" | "bar" }) {
  const playing = usePlayback((s) => s.playing);
  const stepIndex = usePlayback((s) => s.stepIndex);
  const count = usePlayback(selectStepCount);
  const speed = usePlayback((s) => s.speed);
  const step = usePlayback(selectStep);
  const a = usePlayback.getState();
  return (
    <div
      className={
        variant === "bar"
          ? "flex h-14 items-center gap-2 rounded-card border border-line bg-surface-elevated px-3 shadow-card"
          : "absolute inset-x-0 bottom-0 flex h-14 items-center gap-2 border-line border-t bg-surface/95 px-3"
      }
    >
      <button type="button" className={btnGhost} data-testid="first" onClick={a.first} aria-label="第一步">
        <ChevronFirst size={16} />
      </button>
      <button type="button" className={btnGhost} data-testid="prev" onClick={a.prev} aria-label="上一步">
        <SkipBack size={16} />
      </button>
      <button
        type="button"
        className={btnPrimary}
        data-testid={playing ? "pause" : "play"}
        onClick={a.toggle}
        aria-label={playing ? "暂停" : "播放"}
      >
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <button type="button" className={btnGhost} data-testid="next" onClick={a.next} aria-label="下一步">
        <SkipForward size={16} />
      </button>
      <button type="button" className={btnGhost} data-testid="last" onClick={a.last} aria-label="最后一步">
        <ChevronLast size={16} />
      </button>
      <div className="relative mx-2 flex-1">
        <input
          type="range"
          className="w-full accent-accent"
          min={0}
          max={Math.max(0, count - 1)}
          value={stepIndex}
          onChange={(e) => a.seek(Number(e.target.value))}
          aria-label="步骤进度"
          data-testid="scrubber"
        />
        <div className="-bottom-1 pointer-events-none absolute inset-x-2 h-1">
          {Array.from({ length: count }, (_, i) => (
            <span
              key={String(i)}
              className={`absolute top-0 h-1 w-px ${i <= stepIndex ? "bg-accent/70" : "bg-line-strong"}`}
              style={{ left: `${count > 1 ? (i / (count - 1)) * 100 : 0}%` }}
            />
          ))}
        </div>
      </div>
      {step?.beats && <BeatStrip beats={step.beats} />}
      <span className="mono w-14 text-label text-ink-muted">
        {stepIndex + 1}/{count}
      </span>
      <select
        className="mono h-8 rounded-field border border-line bg-surface-elevated px-2 text-label"
        value={speed}
        onChange={(e) => a.setSpeed(Number(e.target.value))}
        aria-label="倍速"
        data-testid="speed"
      >
        {SPEED_STEPS.map((v) => (
          <option key={v} value={v}>
            {v}×
          </option>
        ))}
      </select>
      <span className="ml-2 truncate text-compact" data-testid="step-title">
        {step?.title ?? "—"}
      </span>
      <button
        type="button"
        className={btnGhost}
        onClick={a.resetCamera}
        aria-label="重置视角（Esc）"
        title="重置视角（Esc）"
      >
        <Crosshair size={16} />
      </button>
    </div>
  );
}
