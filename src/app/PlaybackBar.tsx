/**
 * 播放条：章节页与各 dev 页共用的唯一一份。只读 timeline store 的离散状态，
 * 不碰 progress.t（步内进度由 Canvas 内的图元自己读），所以播放期不会重渲染。
 *
 * Tailwind v4 的冲突类按样式表顺序取胜，基础类不带背景色，变体各自加。
 */
import { ChevronFirst, ChevronLast, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { SPEED_STEPS, selectStep, selectStepCount, usePlayback } from "../timeline";

const btnBase =
  "inline-flex h-8 w-8 items-center justify-center rounded-field border active:scale-[0.97] disabled:opacity-40";
export const btnGhost = `${btnBase} border-line bg-surface-elevated text-ink hover:border-line-strong`;
export const btnPrimary = `${btnBase} border-accent bg-accent text-ink-inverse hover:bg-accent-hover`;

export function PlaybackBar() {
  const playing = usePlayback((s) => s.playing);
  const stepIndex = usePlayback((s) => s.stepIndex);
  const count = usePlayback(selectStepCount);
  const speed = usePlayback((s) => s.speed);
  const step = usePlayback(selectStep);
  const a = usePlayback.getState();
  return (
    <div className="absolute inset-x-0 bottom-0 flex h-14 items-center gap-2 border-line border-t bg-surface/95 px-3">
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
      <input
        type="range"
        className="mx-2 flex-1 accent-accent"
        min={0}
        max={Math.max(0, count - 1)}
        value={stepIndex}
        onChange={(e) => a.seek(Number(e.target.value))}
        aria-label="步骤进度"
        data-testid="scrubber"
      />
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
    </div>
  );
}
