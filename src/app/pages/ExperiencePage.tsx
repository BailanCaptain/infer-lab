import { ArrowLeft, Box, Layers, Network, Play, RotateCw } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { findChapter } from "../../content/chapters";
import { CourseDirectory } from "../CourseDirectory";
import {
  buildExperienceIframeSrc,
  buildModelSwitchTo,
  buildModelTabTo,
  type ModelViewId,
  parseHardwareLevel,
  parseLegacyGlmSegment,
  resolveExperienceBackTarget,
  resolveModelEdition,
  resolveQwenVariant,
  safeCheckExperienceFrameReady,
} from "../model/qwen-frame";

const MODEL_VIEWS = [
  { id: "play", title: "计算演示", icon: Play },
  { id: "model", title: "整个模型", icon: Box },
  { id: "layer", title: "单层结构", icon: Layers },
  { id: "arch", title: "二维架构", icon: Network },
] as const;

interface FrameEntry {
  key: string;
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
  const viewId: ModelViewId | "hardware" = kind === "model" ? view.id : "hardware";

  const edition = resolveModelEdition(params);
  const qwenVariant = resolveQwenVariant(params);
  const legacySegment = parseLegacyGlmSegment(params);

  // Both hardware entrances use the accepted whole-machine master, including its NPU module.
  const hardwareModule = params.get("view") === "npu";
  const vendor = params.get("vendor") === "nvidia" ? "nvidia" : "ascend";
  const hardwareModel = params.get("model");
  const modelParam = hardwareModel && /^[a-z0-9-]+$/.test(hardwareModel) ? `&model=${hardwareModel}` : "";
  const level = parseHardwareLevel(params, hardwareModule);

  const src =
    kind === "model"
      ? buildExperienceIframeSrc({
          baseUrl: import.meta.env.BASE_URL,
          edition,
          variant: qwenVariant,
          viewId: view.id,
          segment: legacySegment,
        })
      : `${import.meta.env.BASE_URL}experiences/whole/index.html?site=1&vendor=${vendor}&level=${level}${modelParam}`;

  const title =
    kind === "model"
      ? edition === "glm-5-3-flash"
        ? "GLM-5.3-Flash 模型计算"
        : "Qwen3 模型计算"
      : "硬件 3D";
  const viewTitle = kind === "model" ? view.title : "机柜与整机";
  const frameTitle = `${title} · ${viewTitle}`;
  const base = id ? `/chapters/${id}` : `/${kind}`;
  const backTarget = resolveExperienceBackTarget(params, chapter);

  const [reloadNonce, setReloadNonce] = useState(0);
  const frameKey = reloadNonce > 0 ? `${src}#reload=${reloadNonce}` : src;
  const activeEntry: FrameEntry = { key: frameKey, src, title: frameTitle, kind, viewId };

  // Keep a stable-order list of at most 2 frames ([outgoing, active] during handoff, [active] at rest)
  // keyed strictly by `entry.key`. Updating state during render guarantees the outgoing iframe DOM node
  // is never unmounted or moved (which would reload it), eliminating white flashes on tab switches.
  const [targetKey, setTargetKey] = useState<string>(frameKey);
  const [rendered, setRendered] = useState<FrameEntry[]>([activeEntry]);
  const [readyKeys, setReadyKeys] = useState<string[]>([]);
  const [timedOutKey, setTimedOutKey] = useState<string | null>(null);

  if (targetKey !== frameKey) {
    setTargetKey(frameKey);
    setTimedOutKey(null);
    const alreadyMounted = rendered.find((item) => item.key === frameKey);
    if (alreadyMounted) {
      setRendered([{ ...alreadyMounted, title: frameTitle }]);
      setReadyKeys((prev) => prev.filter((item) => item === frameKey));
    } else {
      const readySet = new Set(readyKeys);
      const keeper = [...rendered].reverse().find((item) => readySet.has(item.key));
      if (keeper) {
        setRendered([keeper, activeEntry]);
        setReadyKeys([keeper.key]);
      } else {
        setRendered([activeEntry]);
        setReadyKeys([]);
      }
    }
  }

  const frameRefs = useRef<Map<string, HTMLIFrameElement>>(new Map());
  const activeKeyRef = useRef<string>(frameKey);
  const switchSeqRef = useRef<number>(0);
  const pollCleanupRef = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    activeKeyRef.current = frameKey;
    switchSeqRef.current += 1;
    return () => {
      pollCleanupRef.current?.();
      pollCleanupRef.current = null;
    };
  }, [frameKey]);

  const isReady = readyKeys.includes(frameKey);
  const isTimedOut = !isReady && timedOutKey === frameKey;
  const outgoing = rendered.find((item) => item.key !== frameKey) ?? null;

  useEffect(() => {
    document.title = `${kind === "model" ? "模型探索" : "硬件探索"} · AI Infra`;
  }, [kind]);

  // Pause an outgoing computation player so it stops stepping while the incoming tab loads.
  useEffect(() => {
    if (!outgoing) return;
    try {
      const outWin = frameRefs.current.get(outgoing.key)?.contentWindow as ExperienceFrameWindow | null;
      outWin?.__chapter?.send?.({ cmd: "pause" });
    } catch {
      // Ignore cross-origin or detached iframe pause errors.
    }
  }, [outgoing]);

  // Release the outgoing iframe right after the crossfade completes so only one WebGL context stays mounted.
  useEffect(() => {
    if (!isReady || rendered.length <= 1) return;
    const seq = switchSeqRef.current;
    const timer = window.setTimeout(() => {
      if (switchSeqRef.current !== seq || activeKeyRef.current !== frameKey) return;
      setRendered((prev) => prev.filter((item) => item.key === frameKey));
      setReadyKeys((prev) => prev.filter((item) => item === frameKey));
    }, 240);
    return () => window.clearTimeout(timer);
  }, [isReady, rendered.length, frameKey]);

  // Safety ceiling: if the incoming frame fails to become ready within 4.5s, surface a gentle retry
  // control instead of falsely marking an unready iframe as `ready` (which would poison the next keeper).
  useEffect(() => {
    if (isReady) return;
    const seq = switchSeqRef.current;
    const ceiling = window.setTimeout(() => {
      if (switchSeqRef.current !== seq || activeKeyRef.current !== frameKey) return;
      setTimedOutKey(frameKey);
    }, 4500);
    return () => window.clearTimeout(ceiling);
  }, [frameKey, isReady]);

  const probeEntryReady = useCallback((entry: FrameEntry) => {
    pollCleanupRef.current?.();
    const expectedSeq = switchSeqRef.current;
    let cancelled = false;
    let timer = 0;
    let cancelFrames: (() => void) | null = null;

    const isStale = () =>
      cancelled || activeKeyRef.current !== entry.key || switchSeqRef.current !== expectedSeq;

    const commitReady = (win: ExperienceFrameWindow | null | undefined) => {
      if (isStale()) return;
      cancelFrames = scheduleTwoFrames(win, entry.viewId, () => {
        if (isStale()) return;
        setTimedOutKey((prev) => (prev === entry.key ? null : prev));
        setReadyKeys((prev) => (prev.includes(entry.key) ? prev : [...prev, entry.key]));
      });
    };

    const check = () => {
      if (isStale()) return true;
      const probe = safeCheckExperienceFrameReady(
        () => frameRefs.current.get(entry.key)?.contentWindow as ExperienceFrameWindow | null,
        entry.kind,
        entry.viewId,
      );
      if (probe.ready) {
        commitReady(probe.win as ExperienceFrameWindow);
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
      if (readyKeys.includes(entry.key)) return;
      probeEntryReady(entry);
    },
    [probeEntryReady, readyKeys],
  );

  const handleRetryActive = useCallback(() => {
    setTimedOutKey(null);
    setReloadNonce((n) => n + 1);
  }, []);

  return (
    <div className={id ? "course-layout experience-layout" : "reader-experience"}>
      {id && chapter && <CourseDirectory current={chapter.id} />}
      <main className={`experience-page experience-${kind}`} id="main-content" tabIndex={-1}>
        <header className="experience-toolbar">
          <div className="experience-heading">
            <Link to={backTarget.to}>
              <ArrowLeft size={14} />
              {backTarget.label}
            </Link>
            <h1>{id && chapter ? chapter.title : kind === "model" ? "模型探索" : "硬件探索"}</h1>
          </div>
          {!isReady && outgoing && !isTimedOut && (
            <span className="experience-switch-pill" role="status" aria-live="polite">
              <span className="experience-loading-dot" aria-hidden="true" />
              正在切换至「{viewTitle}」…
            </span>
          )}
          {kind === "model" && (
            <div className="experience-toolbar-controls">
              <nav className="experience-model-switch" aria-label="模型架构切换">
                <Link
                  aria-current={edition === "qwen3-8b" ? "page" : undefined}
                  to={buildModelSwitchTo({
                    base,
                    targetEdition: "qwen3-8b",
                    viewId: view.id,
                    params,
                    chapterId: chapter?.id,
                    routeId: id,
                  })}
                >
                  标准基座：Qwen3-8B
                </Link>
                <Link
                  aria-current={edition === "glm-5-3-flash" ? "page" : undefined}
                  to={buildModelSwitchTo({
                    base,
                    targetEdition: "glm-5-3-flash",
                    viewId: view.id,
                    params,
                    chapterId: chapter?.id,
                    routeId: id,
                  })}
                >
                  异构旗舰：GLM-5.3-Flash
                </Link>
              </nav>
              <nav className="experience-tabs" aria-label="演示视图">
                {MODEL_VIEWS.map((item) => (
                  <Link
                    key={item.id}
                    aria-current={view.id === item.id ? "page" : undefined}
                    to={buildModelTabTo({
                      base,
                      viewId: item.id,
                      edition,
                      params,
                      chapterId: chapter?.id,
                      routeId: id,
                    })}
                  >
                    <item.icon size={16} strokeWidth={1.6} aria-hidden="true" />
                    <span>{item.title}</span>
                  </Link>
                ))}
              </nav>
            </div>
          )}
        </header>
        <div
          className="experience-viewport"
          data-loading={!isReady ? "true" : undefined}
          data-handoff={outgoing ? "true" : undefined}
          data-timeout={isTimedOut ? "true" : undefined}
        >
          {rendered.map((entry) => {
            const isActive = entry.key === frameKey;
            return (
              <iframe
                key={entry.key}
                ref={(el) => {
                  if (el) frameRefs.current.set(entry.key, el);
                  else frameRefs.current.delete(entry.key);
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
              className={
                isTimedOut
                  ? "experience-loading-veil experience-loading-veil-interactive"
                  : outgoing
                    ? "experience-transition-bar"
                    : "experience-loading-veil"
              }
              role={outgoing && !isTimedOut ? undefined : "status"}
              aria-live={outgoing && !isTimedOut ? undefined : "polite"}
              aria-hidden={outgoing && !isTimedOut ? true : undefined}
            >
              {!isTimedOut && (
                <div className="experience-progress-track" aria-hidden="true">
                  <span className="experience-progress-fill" />
                </div>
              )}
              {isTimedOut ? (
                <div className="experience-retry-pill">
                  <span>舞台响应较慢</span>
                  <button type="button" className="experience-retry-btn" onClick={handleRetryActive}>
                    <RotateCw size={14} aria-hidden="true" />
                    <span>重新加载</span>
                  </button>
                </div>
              ) : (
                !outgoing && (
                  <span className="experience-loading-pill">
                    <span className="experience-loading-dot" aria-hidden="true" />
                    {kind === "model" ? `正在准备「${viewTitle}」…` : "正在载入硬件三维舞台…"}
                  </span>
                )
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
