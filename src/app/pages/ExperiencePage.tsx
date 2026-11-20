import { ArrowLeft, Box, Layers, Network, Play } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { findChapter } from "../../content/chapters";
import { CourseDirectory } from "../CourseDirectory";

const MODEL_VIEWS = [
  { id: "play", title: "计算演示", path: "chapter.html", icon: Play },
  { id: "model", title: "整个模型", path: "model.html", icon: Box },
  { id: "layer", title: "单层结构", path: "flow.html", icon: Layers },
  { id: "arch", title: "二维架构", path: "arch.html", icon: Network },
] as const;

interface FrameEntry {
  src: string;
  title: string;
  kind: "model" | "hardware";
  viewId: string;
}

interface ExperienceFrameWindow extends Window {
  __chapter?: { state?: { ready?: boolean }; send?: (msg: { cmd: string }) => void };
  __truth?: { ready?: boolean };
  __arch?: { ready?: boolean };
}

function isExperienceFrameReady(
  win: ExperienceFrameWindow | null | undefined,
  kind: "model" | "hardware",
  viewId: string,
): boolean {
  if (!win) return false;
  if (kind === "hardware") {
    const loading = win.document?.getElementById("loading");
    if (!loading || loading.hidden) return true;
    // Reveal immediately if hardware loading failed and displays the retry button.
    return Boolean(loading.querySelector("button:not([hidden])"));
  }
  if (viewId === "play") return win.__chapter?.state?.ready === true;
  if (viewId === "arch") return win.__arch?.ready === true;
  return win.__truth?.ready === true;
}

function scheduleTwoFrames(
  win: ExperienceFrameWindow | null | undefined,
  viewId: string,
  onDone: () => void,
): () => void {
  let targetWin: Window = window;
  try {
    const innerStage =
      viewId === "play"
        ? (win?.document?.getElementById("stage") as HTMLIFrameElement | null)?.contentWindow
        : null;
    targetWin = innerStage ?? win ?? window;
  } catch {
    targetWin = window;
  }
  let raf1 = 0;
  let raf2 = 0;
  try {
    raf1 = targetWin.requestAnimationFrame(() => {
      try {
        raf2 = targetWin.requestAnimationFrame(onDone);
      } catch {
        onDone();
      }
    });
  } catch {
    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(onDone);
    });
    targetWin = window;
  }
  return () => {
    try {
      if (raf1) targetWin.cancelAnimationFrame(raf1);
      if (raf2) targetWin.cancelAnimationFrame(raf2);
    } catch {
      // Ignore torn-down iframe cancelAnimationFrame errors.
    }
  };
}

export function ExperiencePage({ kind }: { kind: "model" | "hardware" }) {
  const { id } = useParams();
  const [params] = useSearchParams();
  const chapter = findChapter(id ?? params.get("chapter") ?? undefined);
  const view = MODEL_VIEWS.find((item) => item.id === params.get("view")) ?? MODEL_VIEWS[0];
  // Both entrances use the accepted whole-machine master, including its NPU module.
  const hardwareModule = params.get("view") === "npu";
  const segment = Number(params.get("segment"));
  const modelEntry = Number.isInteger(segment) && segment >= 1 && segment <= 40 ? `&segment=${segment}` : "";
  const vendor = params.get("vendor") === "nvidia" ? "nvidia" : "ascend";
  const hardwareModel = params.get("model");
  const modelParam = hardwareModel && /^[a-z0-9-]+$/.test(hardwareModel) ? `&model=${hardwareModel}` : "";
  const level = params.has("level")
    ? Math.max(0, Math.min(4, Number(params.get("level")) || 0))
    : hardwareModule
      ? 3
      : 0;
  const path =
    kind === "model"
      ? `glm-flow/master/${view.path}?site=1${view.id === "play" ? modelEntry : ""}`
      : `whole/index.html?site=1&vendor=${vendor}&level=${level}${modelParam}`;
  const src = `${import.meta.env.BASE_URL}experiences/${path}`;
  const title = kind === "model" ? "GLM 模型计算" : "硬件 3D";
  const viewTitle = kind === "model" ? view.title : "机柜与整机";
  const frameTitle = `${title} · ${viewTitle}`;
  const viewId = kind === "model" ? view.id : "hardware";
  const base = id ? `/chapters/${id}` : `/${kind}`;

  const activeEntry: FrameEntry = { src, title: frameTitle, kind, viewId };

  // Keep a stable-order list of at most 2 frames ([outgoing, active] during handoff, [active] at rest)
  // keyed strictly by `entry.src`. Updating state during render guarantees the outgoing iframe DOM node
  // is never unmounted or moved (which would reload it), eliminating white flashes on tab switches.
  const [targetSrc, setTargetSrc] = useState<string>(src);
  const [rendered, setRendered] = useState<FrameEntry[]>([activeEntry]);
  const [readySrcs, setReadySrcs] = useState<string[]>([]);

  if (targetSrc !== src) {
    setTargetSrc(src);
    const alreadyMounted = rendered.find((item) => item.src === src);
    if (alreadyMounted) {
      setRendered([{ ...alreadyMounted, title: frameTitle }]);
      setReadySrcs((prev) => prev.filter((item) => item === src));
    } else {
      const readySet = new Set(readySrcs);
      const keeper = [...rendered].reverse().find((item) => readySet.has(item.src));
      if (keeper) {
        setRendered([keeper, activeEntry]);
        setReadySrcs([keeper.src]);
      } else {
        setRendered([activeEntry]);
        setReadySrcs([]);
      }
    }
  }

  const frameRefs = useRef<Map<string, HTMLIFrameElement>>(new Map());
  const activeSrcRef = useRef<string>(src);
  const pollCleanupRef = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    activeSrcRef.current = src;
    return () => {
      pollCleanupRef.current?.();
      pollCleanupRef.current = null;
    };
  }, [src]);

  const isReady = readySrcs.includes(src);
  const outgoing = rendered.find((item) => item.src !== src) ?? null;

  useEffect(() => {
    document.title = `${kind === "model" ? "模型探索" : "硬件探索"} · AI Infra`;
  }, [kind]);

  // Pause an outgoing computation player so it stops stepping while the incoming tab loads.
  useEffect(() => {
    if (!outgoing) return;
    try {
      const outWin = frameRefs.current.get(outgoing.src)?.contentWindow as ExperienceFrameWindow | null;
      outWin?.__chapter?.send?.({ cmd: "pause" });
    } catch {
      // Ignore cross-origin or detached iframe pause errors.
    }
  }, [outgoing]);

  // Release the outgoing iframe right after the crossfade completes so only one WebGL context stays mounted.
  useEffect(() => {
    if (!isReady || rendered.length <= 1) return;
    const timer = window.setTimeout(() => {
      setRendered((prev) => prev.filter((item) => item.src === src));
      setReadySrcs((prev) => prev.filter((item) => item === src));
    }, 240);
    return () => window.clearTimeout(timer);
  }, [isReady, rendered.length, src]);

  // Safety ceiling so the incoming frame is always revealed even if an internal script signals late.
  useEffect(() => {
    if (isReady) return;
    const ceiling = window.setTimeout(() => {
      setReadySrcs((prev) => (prev.includes(src) ? prev : [...prev, src]));
    }, 4500);
    return () => window.clearTimeout(ceiling);
  }, [src, isReady]);

  const probeEntryReady = useCallback((entry: FrameEntry) => {
    pollCleanupRef.current?.();
    let cancelled = false;
    let timer = 0;
    let cancelFrames: (() => void) | null = null;

    const commitReady = (win: ExperienceFrameWindow | null | undefined) => {
      if (cancelled || activeSrcRef.current !== entry.src) return;
      cancelFrames = scheduleTwoFrames(win, entry.viewId, () => {
        if (cancelled || activeSrcRef.current !== entry.src) return;
        setReadySrcs((prev) => (prev.includes(entry.src) ? prev : [...prev, entry.src]));
      });
    };

    const check = () => {
      if (cancelled || activeSrcRef.current !== entry.src) return true;
      try {
        const win = frameRefs.current.get(entry.src)?.contentWindow as ExperienceFrameWindow | null;
        if (isExperienceFrameReady(win, entry.kind, entry.viewId)) {
          commitReady(win);
          return true;
        }
      } catch {
        commitReady(null);
        return true;
      }
      return false;
    };

    if (!check()) {
      timer = window.setInterval(() => {
        if (check()) {
          window.clearInterval(timer);
          timer = 0;
        }
      }, 32);
    }

    pollCleanupRef.current = () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      cancelFrames?.();
    };
  }, []);

  const handleActiveLoad = useCallback(
    (entry: FrameEntry) => {
      if (readySrcs.includes(entry.src)) return;
      probeEntryReady(entry);
    },
    [probeEntryReady, readySrcs],
  );

  return (
    <div className={id ? "course-layout experience-layout" : "reader-experience"}>
      {id && chapter && <CourseDirectory current={chapter.id} />}
      <main className={`experience-page experience-${kind}`} id="main-content" tabIndex={-1}>
        <header className="experience-toolbar">
          <div className="experience-heading">
            <Link to={chapter ? `/chapters/${chapter.id}` : "/wiki"}>
              <ArrowLeft size={14} />
              {chapter ? `返回第 ${chapter.id} 章` : "返回主章节"}
            </Link>
            <h1>{id && chapter ? chapter.title : kind === "model" ? "模型探索" : "硬件探索"}</h1>
          </div>
          {!isReady && outgoing && (
            <span className="experience-switch-pill" role="status" aria-live="polite">
              <span className="experience-loading-dot" aria-hidden="true" />
              正在切换至「{viewTitle}」…
            </span>
          )}
          {kind === "model" && (
            <nav className="experience-tabs" aria-label="演示视图">
              {MODEL_VIEWS.map((item) => (
                <Link
                  key={item.id}
                  aria-current={view.id === item.id ? "page" : undefined}
                  to={`${base}?${new URLSearchParams({ view: item.id, ...(id ? { experience: "1" } : chapter ? { chapter: chapter.id } : {}), ...(modelEntry ? { segment: String(segment) } : {}) })}`}
                >
                  <item.icon size={16} strokeWidth={1.6} aria-hidden="true" />
                  <span>{item.title}</span>
                </Link>
              ))}
            </nav>
          )}
        </header>
        <div
          className="experience-viewport"
          data-loading={!isReady ? "true" : undefined}
          data-handoff={outgoing ? "true" : undefined}
        >
          {rendered.map((entry) => {
            const isActive = entry.src === src;
            return (
              <iframe
                key={entry.src}
                ref={(el) => {
                  if (el) frameRefs.current.set(entry.src, el);
                  else frameRefs.current.delete(entry.src);
                }}
                className={isActive ? "experience-frame" : "experience-frame-outgoing"}
                data-ready={isActive && isReady ? "true" : undefined}
                src={entry.src}
                title={entry.title}
                aria-hidden={isActive ? undefined : true}
                tabIndex={isActive ? undefined : -1}
                onLoad={isActive ? () => handleActiveLoad(entry) : undefined}
                allow={isActive ? "fullscreen" : undefined}
                allowFullScreen={isActive || undefined}
              />
            );
          })}
          {!isReady && (
            <div
              className={outgoing ? "experience-transition-bar" : "experience-loading-veil"}
              role={outgoing ? undefined : "status"}
              aria-live={outgoing ? undefined : "polite"}
              aria-hidden={outgoing ? true : undefined}
            >
              <div className="experience-progress-track" aria-hidden="true">
                <span className="experience-progress-fill" />
              </div>
              {!outgoing && (
                <span className="experience-loading-pill">
                  <span className="experience-loading-dot" aria-hidden="true" />
                  {kind === "model" ? `正在准备「${viewTitle}」…` : "正在载入硬件三维舞台…"}
                </span>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
