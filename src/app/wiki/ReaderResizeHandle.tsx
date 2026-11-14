import { useLayoutEffect, useRef, useState } from "react";

/** Resize the existing column without remounting the article, chat or 3D canvases. */
export function ReaderResizeHandle({ side }: { side: "directory" | "assistant" }) {
  const handle = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; width: number } | null>(null);
  const [width, setWidth] = useState(side === "directory" ? 240 : 540);
  const variable = `--reader-${side}-width`;
  const storageKey = `infra-reader-${side}-width`;
  const apply = (value: number) => {
    const shell = handle.current?.closest<HTMLElement>(".wiki-shell");
    if (!shell) return;
    // CSS owns the limits for docked columns versus overlay drawers.
    shell.style.setProperty(variable, `${value}px`);
    const column = handle.current?.closest(side === "directory" ? ".reader-directory" : ".wiki-panel");
    const actual = Math.round(column?.getBoundingClientRect().width ?? value);
    shell.style.setProperty(variable, `${actual}px`);
    setWidth(actual);
  };
  useLayoutEffect(() => {
    const shell = handle.current?.closest<HTMLElement>(".wiki-shell");
    const column = handle.current?.closest(side === "directory" ? ".reader-directory" : ".wiki-panel");
    if (!shell || !column) return;
    try {
      const saved = Number(localStorage.getItem(storageKey));
      // The panel announces its grid column after mounting; do not measure that intermediate layout.
      if (saved > 0 && Number.isFinite(saved)) shell.style.setProperty(variable, `${saved}px`);
    } catch {
      /* Storage can be unavailable in private browsing. */
    }
    const observer = new ResizeObserver(() => setWidth(Math.round(column.getBoundingClientRect().width)));
    observer.observe(column);
    return () => {
      observer.disconnect();
      shell.classList.remove("is-resizing");
    };
  }, [side, storageKey, variable]);
  const finish = () => {
    drag.current = null;
    handle.current?.closest(".wiki-shell")?.classList.remove("is-resizing");
    try {
      localStorage.setItem(storageKey, String(width));
    } catch {
      /* Keep the current layout. */
    }
  };
  return (
    // biome-ignore lint/a11y/useSemanticElements: an adjustable separator needs value and keyboard interaction.
    <div
      ref={handle}
      className={`reader-resize-handle is-${side}`}
      role="separator"
      tabIndex={0}
      aria-label={side === "directory" ? "调整目录与正文宽度" : "调整问答与正文宽度"}
      aria-orientation="vertical"
      aria-valuenow={width}
      aria-valuemin={side === "directory" ? 180 : 320}
      aria-valuemax={side === "directory" ? 420 : 1100}
      title="左右拖动调整宽度 · 方向键微调 · 双击复位"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        const column = event.currentTarget.closest(
          side === "directory" ? ".reader-directory" : ".wiki-panel",
        )!;
        drag.current = { x: event.clientX, width: column.getBoundingClientRect().width };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.closest(".wiki-shell")?.classList.add("is-resizing");
      }}
      onPointerMove={(event) => {
        if (drag.current)
          apply(drag.current.width + (event.clientX - drag.current.x) * (side === "directory" ? 1 : -1));
      }}
      onPointerUp={(event) => {
        event.currentTarget.releasePointerCapture(event.pointerId);
        finish();
      }}
      onPointerCancel={finish}
      onDoubleClick={() => {
        handle.current?.closest<HTMLElement>(".wiki-shell")?.style.removeProperty(variable);
        try {
          localStorage.removeItem(storageKey);
        } catch {
          /* Default width still applies. */
        }
        const column = handle.current?.closest(side === "directory" ? ".reader-directory" : ".wiki-panel");
        if (column) setWidth(Math.round(column.getBoundingClientRect().width));
      }}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const column = event.currentTarget.closest(
          side === "directory" ? ".reader-directory" : ".wiki-panel",
        )!;
        apply(
          column.getBoundingClientRect().width +
            (event.key === "ArrowRight" ? 16 : -16) * (side === "directory" ? 1 : -1),
        );
      }}
      onKeyUp={finish}
    >
      <span aria-hidden="true" />
    </div>
  );
}
