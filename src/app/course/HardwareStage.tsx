import { useEffect, useRef, useState } from "react";
import { mountHardwareStage } from "./hardware-stage-renderer";

export type ParallelLayout = "tp" | "pp" | "dp";
export function HardwareStage({
  kind,
  focus = "host",
  layout = "tp",
  selected = 0,
  onSelect,
}: {
  kind: "request" | "parallel";
  focus?: string;
  layout?: ParallelLayout;
  selected?: number;
  onSelect?: (rank: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<Awaited<ReturnType<typeof mountHardwareStage>> | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const latest = useRef({ focus, layout, selected, onSelect });
  latest.current = { focus, layout, selected, onSelect };
  // biome-ignore lint/correctness/useExhaustiveDependencies: retry remounts a failed model load.
  useEffect(() => {
    let stopped = false;
    setError("");
    setReady(false);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        void mountHardwareStage(host.current!, kind, (rank) => latest.current.onSelect?.(rank))
          .then((result) => {
            if (stopped) {
              result.dispose();
              return;
            }
            view.current = result;
            result.update(latest.current.focus, latest.current.layout, latest.current.selected);
            setReady(true);
          })
          .catch(() => {
            if (!stopped) setError("硬件模型加载失败，请重试。");
          });
      },
      { rootMargin: "350px" },
    );
    observer.observe(host.current!);
    return () => {
      stopped = true;
      observer.disconnect();
      view.current?.dispose();
      view.current = null;
    };
  }, [kind, retry]);
  useEffect(() => {
    view.current?.update(focus, layout, selected);
  }, [focus, layout, selected]);
  return (
    <div
      className="course-hardware-stage"
      data-kind={kind}
      data-ready={ready}
      data-focus={focus}
      data-layout={layout}
    >
      {/* biome-ignore lint/a11y/useSemanticElements: an interactive 3D scene is a group of spatial buttons, not a form fieldset. */}
      <div
        ref={host}
        className="course-hardware-canvas"
        role="group"
        aria-label={
          kind === "request"
            ? "Atlas 800T A2 真实母版部件，定位请求执行位置"
            : "两台服务器的十六个 NPU 模组，按 rank 对应并行分工"
        }
      />
      {!ready && !error && <p className="hardware-loading">载入硬件母版…</p>}
      {error && (
        <p role="alert">
          {error}
          <button type="button" onClick={() => setRetry(retry + 1)}>
            重试
          </button>
        </p>
      )}
      <div className="hardware-view-controls">
        <span>拖动旋转 · 标签随部件定位</span>
        <button type="button" onClick={() => view.current?.reset()}>
          复位硬件视角
        </button>
      </div>
    </div>
  );
}
