import { ArrowLeft, BookOpen, Box, Layers, Network, Play, RotateCw } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router";
import { findChapter } from "../../content/chapters";
import { CourseDirectory } from "../CourseDirectory";
import {
  buildExperienceIframeSrc,
  buildHardwareExperienceIframeSrc,
  buildModelSwitchTo,
  buildModelTabTo,
  createExperienceReadyProbe,
  type ExperienceReadyProbeHandle,
  type InPlaceVariantSyncState,
  type ModelViewId,
  parseExperienceFrameMessage,
  parseLegacyGlmSegment,
  type QwenVariant,
  resolveExperienceBackTarget,
  resolveExperienceWikiContextLink,
  resolveInPlaceVariantSync,
  resolveModelEdition,
  resolveQwenVariant,
  safeCheckExperienceFrameReady,
  syncQwenVariantSearchParams,
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
  __wholeReady?: boolean;
  __viewer?: { dispose?: () => void };
  __qwenVariant?: QwenVariant;
  __setQwenVariant?: (next: QwenVariant) => void;
  __disposeQwenExperience?: () => void;
}

function notifyIframeDispose(el: HTMLIFrameElement | null | undefined): void {
  if (!el) return;
  try {
    const win = el.contentWindow as ExperienceFrameWindow | null;
    win?.postMessage({ source: "infer-lab-experience", type: "dispose" }, "*");
    win?.__disposeQwenExperience?.();
    win?.__viewer?.dispose?.();
  } catch {
    // Ignore cross-origin or detached iframe teardown errors.
  }
}

function syncIframeQwenVariant(el: HTMLIFrameElement | null | undefined, variant: QwenVariant): void {
  if (!el) return;
  try {
    const win = el.contentWindow as ExperienceFrameWindow | null;
    if (!win) return;
    if (typeof win.__setQwenVariant === "function") {
      win.__setQwenVariant(variant);
    } else {
      win.postMessage({ source: "infer-lab-experience", type: "set-variant", variant }, "*");
    }
  } catch {
    // Ignore cross-origin or uninitialized iframe errors.
  }
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
  const location = useLocation();
  const [params, setSearchParams] = useSearchParams();
  const chapter = findChapter(id ?? params.get("chapter") ?? undefined);
  const view = MODEL_VIEWS.find((item) => item.id === params.get("view")) ?? MODEL_VIEWS[0];
  const viewId: ModelViewId | "hardware" = kind === "model" ? view.id : "hardware";

  const edition = resolveModelEdition(params);
  const qwenVariant = resolveQwenVariant(params);
  const legacySegment = parseLegacyGlmSegment(params);

  const computedSrc =
    kind === "model"
      ? buildExperienceIframeSrc({
          baseUrl: import.meta.env.BASE_URL,
          edition,
          variant: qwenVariant,
          viewId: view.id,
          segment: legacySegment,
        })
      : buildHardwareExperienceIframeSrc({
          baseUrl: import.meta.env.BASE_URL,
          params,
        });

  const title =
    kind === "model" ? (edition === "glm-5-3-flash" ? "GLM 模型计算" : "Qwen3 模型计算") : "硬件 3D";
  const viewTitle = kind === "model" ? view.title : "机柜与整机";
  const frameTitle = `${title} · ${viewTitle}`;
  const base = id ? `/chapters/${id}` : `/${kind}`;
  const backTarget = resolveExperienceBackTarget(params, chapter);
  const wikiContextLink = resolveExperienceWikiContextLink({ kind, params, backTarget });

  const [reloadNonce, setReloadNonce] = useState(0);
  const baseIdentity = `${kind}:${edition}:${viewId}:${reloadNonce}`;
  const defaultFrameKey = reloadNonce > 0 ? `${computedSrc}#reload=${reloadNonce}` : computedSrc;

  // Keep a stable-order list of at most 2 frames ([outgoing, active] during handoff, [active] at rest)
  // keyed strictly by `entry.key`. Updating state during render guarantees the outgoing iframe DOM node
  // is never unmounted or moved (which would reload it), eliminating white flashes on tab switches.
  const [rendered, setRendered] = useState<FrameEntry[]>(() => [
    { key: defaultFrameKey, src: computedSrc, title: frameTitle, kind, viewId },
  ]);
  const [inPlaceSync, setInPlaceSync] = useState<InPlaceVariantSyncState | null>(null);
  const pendingChildVariantRef = useRef<QwenVariant | null>(null);

  const resolvedSync = resolveInPlaceVariantSync({
    state: inPlaceSync,
    kind,
    edition,
    baseIdentity,
    qwenVariant,
    locationKey: location.key,
    mountedKeys: rendered.map((item) => item.key),
    computedSrc,
    defaultFrameKey,
  });

  if (resolvedSync.syncChildVariant !== undefined) {
    pendingChildVariantRef.current = resolvedSync.syncChildVariant;
  }

  if (resolvedSync.nextState !== inPlaceSync) {
    setInPlaceSync(resolvedSync.nextState);
  }

  const src = resolvedSync.src;
  const frameKey = resolvedSync.frameKey;
  const activeEntry: FrameEntry = { key: frameKey, src, title: frameTitle, kind, viewId };

  const [targetKey, setTargetKey] = useState<string>(frameKey);
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
  // Retain live iframe DOM references independently of React's `ref(null)` detachment so unmount cleanup always disposes WebGL!
  const liveIframesRef = useRef<Set<HTMLIFrameElement>>(new Set());
  const activeKeyRef = useRef<string>(frameKey);
  const activeSrcRef = useRef<string>(src);
  const baseIdentityRef = useRef<string>(baseIdentity);
  const locationKeyRef = useRef<string>(location.key);
  const switchSeqRef = useRef<number>(0);
  const probeRef = useRef<ExperienceReadyProbeHandle | null>(null);
  const cancelFramesRef = useRef<(() => void) | null>(null);

  baseIdentityRef.current = baseIdentity;
  activeSrcRef.current = src;
  locationKeyRef.current = location.key;

  useLayoutEffect(() => {
    activeKeyRef.current = frameKey;
    switchSeqRef.current += 1;
    return () => {
      probeRef.current?.dispose();
      probeRef.current = null;
      cancelFramesRef.current?.();
      cancelFramesRef.current = null;
    };
  }, [frameKey]);

  // Prune and dispose any unready iframe dropped early during rapid A -> B -> C tab switches while ExperiencePage stays mounted.
  useLayoutEffect(() => {
    const activeMountedEls = new Set<HTMLIFrameElement>();
    for (const entry of rendered) {
      const el = frameRefs.current.get(entry.key);
      if (el) activeMountedEls.add(el);
    }
    for (const el of liveIframesRef.current) {
      if (!activeMountedEls.has(el)) {
        notifyIframeDispose(el);
        liveIframesRef.current.delete(el);
      }
    }
  }, [rendered]);

  // Synchronously dispose all mounted child iframes in layout phase BEFORE React removes `<iframe>` from DOM.
  useLayoutEffect(
    () => () => {
      for (const el of liveIframesRef.current) {
        notifyIframeDispose(el);
      }
      liveIframesRef.current.clear();
    },
    [],
  );

  const isReady = readyKeys.includes(frameKey);
  const isTimedOut = !isReady && timedOutKey === frameKey;
  const outgoing = rendered.find((item) => item.key !== frameKey) ?? null;

  // Keep reused Qwen child iframe synchronized when navigating back to default `/#/model` (no `?variant=`) or Back/Forward.
  useEffect(() => {
    if (kind !== "model" || edition !== "qwen3-8b") return;
    if (resolvedSync.nextState !== null && !resolvedSync.nextState.urlSynced) return;
    const activeFrame = frameRefs.current.get(frameKey);
    if (!activeFrame) return;
    const forced = pendingChildVariantRef.current;
    if (!isReady && forced === null && !location.key) return;
    pendingChildVariantRef.current = null;
    let childVariant: QwenVariant | undefined;
    try {
      childVariant = (activeFrame.contentWindow as ExperienceFrameWindow | null)?.__qwenVariant;
    } catch {
      childVariant = undefined;
    }
    if (forced !== null || (childVariant !== undefined && childVariant !== qwenVariant)) {
      syncIframeQwenVariant(activeFrame, forced ?? qwenVariant);
    }
  }, [kind, edition, frameKey, qwenVariant, location.key, isReady, resolvedSync.nextState]);

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
      for (const [key, el] of frameRefs.current.entries()) {
        if (key !== frameKey) {
          notifyIframeDispose(el);
          liveIframesRef.current.delete(el);
        }
      }
      setRendered((prev) => prev.filter((item) => item.key === frameKey));
      setReadyKeys((prev) => prev.filter((item) => item === frameKey));
    }, 240);
    return () => window.clearTimeout(timer);
  }, [isReady, rendered.length, frameKey]);

  const startReadyProbe = useCallback(
    (entryKey: string, entryKind: "model" | "hardware", entryViewId: string) => {
      probeRef.current?.dispose();
      cancelFramesRef.current?.();
      const expectedSeq = switchSeqRef.current;
      let latestWin: ExperienceFrameWindow | null = null;

      const isStale = () => activeKeyRef.current !== entryKey || switchSeqRef.current !== expectedSeq;

      probeRef.current = createExperienceReadyProbe({
        expectedSeq,
        getCurrentSeq: () => switchSeqRef.current,
        isActiveTarget: () => activeKeyRef.current === entryKey,
        checkReady: () => {
          const res = safeCheckExperienceFrameReady(
            () => frameRefs.current.get(entryKey)?.contentWindow as ExperienceFrameWindow | null,
            entryKind,
            entryViewId,
          );
          if (res.ready) {
            latestWin = res.win as ExperienceFrameWindow;
            return true;
          }
          return false;
        },
        onReady: () => {
          if (isStale()) return;
          cancelFramesRef.current = scheduleTwoFrames(latestWin, entryViewId, () => {
            if (isStale()) return;
            setTimedOutKey((prev) => (prev === entryKey ? null : prev));
            setReadyKeys((prev) => (prev.includes(entryKey) ? prev : [...prev, entryKey]));
          });
        },
        onTimeout: () => {
          if (isStale()) return;
          setTimedOutKey(entryKey);
        },
        pollIntervalMs: 32,
        slowPollIntervalMs: 500,
        timeoutMs: 4500,
      });
    },
    [],
  );

  // Start unified 32ms ready-poll + 4.5s timeout ceiling (polling stops immediately on timeout,
  // while late `postMessage` ready notifications for the same switch sequence still commit).
  useEffect(() => {
    if (isReady) return;
    startReadyProbe(frameKey, kind, viewId);
    return () => {
      probeRef.current?.dispose();
      probeRef.current = null;
    };
  }, [frameKey, isReady, kind, viewId, startReadyProbe]);

  // Listen for child iframe `variant-change` (sync URL without remounting) and late `ready` messages.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin && event.origin !== window.location.origin) return;
      const activeFrame = frameRefs.current.get(activeKeyRef.current);
      if (!activeFrame || event.source !== activeFrame.contentWindow) return;
      const parsed = parseExperienceFrameMessage(event.data);
      if (!parsed) return;

      if (parsed.type === "variant-change" && kind === "model") {
        const domKey = activeKeyRef.current;
        const initialSrc = activeSrcRef.current;
        const currentIdentity = baseIdentityRef.current;
        setInPlaceSync({
          baseIdentity: currentIdentity,
          variant: parsed.variant,
          domKey,
          initialSrc,
          urlSynced: false,
          originLocationKey: locationKeyRef.current,
        });
        setSearchParams((prev) => syncQwenVariantSearchParams(prev, parsed.variant), { replace: true });
      } else if (parsed.type === "ready") {
        probeRef.current?.notifyMessageReady(switchSeqRef.current);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [kind, setSearchParams]);

  const handleActiveLoad = useCallback(
    (entry: FrameEntry) => {
      if (readyKeys.includes(entry.key)) return;
      if (probeRef.current && activeKeyRef.current === entry.key) {
        probeRef.current.notifyMessageReady(switchSeqRef.current);
      } else {
        startReadyProbe(entry.key, entry.kind, entry.viewId);
      }
    },
    [readyKeys, startReadyProbe],
  );

  const handleRetryActive = useCallback(() => {
    setInPlaceSync(null);
    setTimedOutKey(null);
    setReloadNonce((n) => n + 1);
  }, []);

  return (
    <div className={id ? "course-layout experience-layout" : "reader-experience"}>
      {id && chapter && <CourseDirectory current={chapter.id} />}
      <main className={`experience-page experience-${kind}`} id="main-content" tabIndex={-1}>
        <header className="experience-toolbar">
          <div className="experience-heading">
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 14px" }}>
              <Link to={backTarget.to} data-testid="experience-back-link">
                <ArrowLeft size={14} />
                {backTarget.label}
              </Link>
              {backTarget.secondary && (
                <Link
                  to={backTarget.secondary.to}
                  data-testid="experience-back-secondary"
                  style={{ fontSize: 13, color: "var(--color-ink-muted)" }}
                >
                  {backTarget.secondary.label}
                </Link>
              )}
              {wikiContextLink && (
                <Link
                  to={wikiContextLink.to}
                  data-testid="experience-wiki-context-link"
                  style={{ fontSize: 13, color: "var(--color-reader-accent, var(--color-accent))" }}
                >
                  <BookOpen size={13} aria-hidden="true" />
                  <span>{wikiContextLink.label}</span>
                </Link>
              )}
            </div>
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
                  if (el) {
                    frameRefs.current.set(entry.key, el);
                    liveIframesRef.current.add(el);
                  } else {
                    frameRefs.current.delete(entry.key);
                  }
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
