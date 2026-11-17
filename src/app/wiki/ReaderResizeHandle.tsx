import { useLayoutEffect, useRef, useState } from "react";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ResizeSessionOptions {
  readonly side: "directory" | "assistant";
  readonly storageKey: string;
  readonly getStorage?: () => StorageLike | null;
  readonly applyCandidateWidth: (requestedWidth: number) => number | null;
  readonly resetStyleWidth: () => void;
  readonly setResizingClass?: (active: boolean) => void;
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * 分隔条调整会话：仅当方向键或指针拖拽实际改变了列宽时才持久化测量后的真实最终宽度；
 * 无关按键、原地点击、触边未发生宽度变化的操作绝不写入偏好，键盘失焦时自动落盘未提交的有效微调。
 */
export function createResizeSession({
  side,
  storageKey,
  getStorage = defaultStorage,
  applyCandidateWidth,
  resetStyleWidth,
  setResizingClass,
}: ResizeSessionOptions) {
  const direction = side === "directory" ? 1 : -1;
  let drag: {
    startX: number;
    startWidth: number;
    startRounded: number;
    latestRounded: number;
  } | null = null;
  let keyPendingWidth: number | null = null;

  const persistWidth = (value: number) => {
    try {
      getStorage()?.setItem(storageKey, String(value));
    } catch {
      /* Keep the current layout when storage is unavailable. */
    }
  };

  const flushKeySave = () => {
    if (keyPendingWidth === null) return;
    const value = keyPendingWidth;
    keyPendingWidth = null;
    persistWidth(value);
  };

  return {
    pointerDown(button: number, clientX: number, currentWidth: number): boolean {
      if (button !== 0) return false;
      flushKeySave();
      const rounded = Math.round(currentWidth);
      drag = {
        startX: clientX,
        startWidth: currentWidth,
        startRounded: rounded,
        latestRounded: rounded,
      };
      setResizingClass?.(true);
      return true;
    },
    pointerMove(clientX: number): number | null {
      if (!drag) return null;
      const actual = applyCandidateWidth(drag.startWidth + (clientX - drag.startX) * direction);
      if (actual !== null) drag.latestRounded = actual;
      return actual;
    },
    pointerFinish(): void {
      setResizingClass?.(false);
      if (!drag) return;
      const finished = drag;
      drag = null;
      if (finished.latestRounded === finished.startRounded) return;
      persistWidth(finished.latestRounded);
    },
    keyDown(key: string, currentWidth: number): boolean {
      if (key !== "ArrowLeft" && key !== "ArrowRight") return false;
      const before = Math.round(currentWidth);
      const delta = (key === "ArrowRight" ? 16 : -16) * direction;
      const actual = applyCandidateWidth(currentWidth + delta);
      if (actual !== null && actual !== before) {
        keyPendingWidth = actual;
      }
      return true;
    },
    keyUp(key: string): void {
      if (key !== "ArrowLeft" && key !== "ArrowRight") return;
      flushKeySave();
    },
    blur(): void {
      flushKeySave();
    },
    doubleClick(): void {
      drag = null;
      keyPendingWidth = null;
      setResizingClass?.(false);
      resetStyleWidth();
      try {
        getStorage()?.removeItem(storageKey);
      } catch {
        /* Default width still applies. */
      }
    },
  };
}

/** Resize the existing column without remounting the article, chat or 3D canvases. */
export function ReaderResizeHandle({ side }: { side: "directory" | "assistant" }) {
  const handle = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(side === "directory" ? 240 : 540);
  const variable = `--reader-${side}-width`;
  const storageKey = `infra-reader-${side}-width`;
  const columnSelector = side === "directory" ? ".reader-directory" : ".wiki-panel";

  const sessionRef = useRef<ReturnType<typeof createResizeSession> | null>(null);
  if (!sessionRef.current) {
    sessionRef.current = createResizeSession({
      side,
      storageKey,
      applyCandidateWidth(value) {
        const shell = handle.current?.closest<HTMLElement>(".wiki-shell");
        const column = handle.current?.closest<HTMLElement>(columnSelector);
        if (!shell || !column) return null;
        const previousInline = shell.style.getPropertyValue(variable);
        const before = Math.round(column.getBoundingClientRect().width);
        // CSS owns the limits for docked columns versus overlay drawers.
        shell.style.setProperty(variable, `${value}px`);
        const actual = Math.round(column.getBoundingClientRect().width);
        if (actual === before && !previousInline) {
          shell.style.removeProperty(variable);
        } else {
          shell.style.setProperty(variable, `${actual}px`);
        }
        setWidth(actual);
        return actual;
      },
      resetStyleWidth() {
        handle.current?.closest<HTMLElement>(".wiki-shell")?.style.removeProperty(variable);
        const column = handle.current?.closest<HTMLElement>(columnSelector);
        if (column) setWidth(Math.round(column.getBoundingClientRect().width));
      },
      setResizingClass(active) {
        handle.current?.closest(".wiki-shell")?.classList.toggle("is-resizing", active);
      },
    });
  }
  const session = sessionRef.current;

  useLayoutEffect(() => {
    const shell = handle.current?.closest<HTMLElement>(".wiki-shell");
    const column = handle.current?.closest<HTMLElement>(columnSelector);
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
  }, [columnSelector, storageKey, variable]);

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
        const column = event.currentTarget.closest<HTMLElement>(columnSelector);
        if (!column) return;
        if (!session.pointerDown(event.button, event.clientX, column.getBoundingClientRect().width)) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        session.pointerMove(event.clientX);
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        session.pointerFinish();
      }}
      onPointerCancel={() => {
        session.pointerFinish();
      }}
      onDoubleClick={() => {
        session.doubleClick();
      }}
      onKeyDown={(event) => {
        const column = event.currentTarget.closest<HTMLElement>(columnSelector);
        if (!column) return;
        if (session.keyDown(event.key, column.getBoundingClientRect().width)) {
          event.preventDefault();
        }
      }}
      onKeyUp={(event) => {
        session.keyUp(event.key);
      }}
      onBlur={() => {
        session.blur();
      }}
    >
      <span aria-hidden="true" />
    </div>
  );
}
