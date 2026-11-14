import { ArrowLeft, ArrowRight, Maximize2, Minimize2, Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { CollectiveReadout } from "./CollectiveReadout";
import { CPReadout } from "./CPReadout";
import { HardwareReadout } from "./HardwareReadout";
import { InferenceReadout } from "./InferenceReadout";
import { RequestReadout } from "./RequestReadout";
import { SPReadout } from "./SPReadout";
import { StableSceneText } from "./StableSceneContent";
import { collectiveFrame, collectiveSeconds, collectiveTeaching } from "./scene-collective";
import {
  computePhase,
  matmulTimeline,
  SPATIAL_COMPUTE_SECONDS,
  SWIGLU_SECONDS,
  swigluTimeline,
} from "./scene-compute-data";
import { dpRequestFrame } from "./scene-hardware-story";
import { INFERENCE_LESSONS, inferenceFrame, inferenceTeaching } from "./scene-inference";
import { SCENE_LESSONS, type SceneLessonId, sceneAnchorIds } from "./scene-lessons";
import {
  cpReadFrame,
  MECHANISM_GUIDES,
  MECHANISM_READING_KEYS,
  mechanismChapters,
  mechanismCue,
  mechanismFrame,
  mechanismSeconds,
  mechanismTeaching,
  spNormalization,
  spProjection,
} from "./scene-parallel-mechanisms";
import {
  clipPosition,
  expertAssignments,
  parallelPhase,
  parallelSeconds,
  phaseAt,
  SCENE_STEP_SECONDS,
  TP_DOWN_WEIGHT,
} from "./scene-playback";
import {
  REQUEST_JOURNEY_SECONDS,
  REQUEST_JOURNEY_STARTS,
  REQUEST_SECONDS,
  requestJourneyPosition,
  requestState,
} from "./scene-request-data";
import { RESIDUAL_SECONDS, residualMotion } from "./scene-residual-data";
import { modelTeaching, parallelTeaching, requestTeaching, spatialTeaching } from "./scene-teaching";
import "./WikiScene.css";
import "./WikiRequestScene.css";
import "./WikiInferenceScene.css";
import "./WikiCollectiveScene.css";

type View = {
  update(step: number, rank: number): void;
  animate(progress: number): void;
  reset(): void;
  dispose(): void;
};

export function WikiScene({ id, section }: { id: SceneLessonId; section?: number | undefined }) {
  const lesson = SCENE_LESSONS[id];
  const { hash } = useLocation();
  const journey = id === "token-flow" && section === undefined;
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const position = useRef(0);
  const hardware = id === "parallel-strategy";
  const mechanism = id === "parallel-mechanism";
  const inference = id === "inference-mechanism";
  const cache = inference && section === 1;
  const spatialInference = inference && (section === 1 || section === 3);
  const collective = id === "collective-communication";
  const [mode, setMode] = useState(section ?? 0);
  const fixedStep = section ?? (hardware || collective ? mode : undefined);
  const spatial = id === "model-compute" && (section === 1 || section === 2);
  const residual = id === "model-compute" && (section === 0 || section === 3);
  const total = collective
    ? collectiveSeconds(fixedStep ?? 0)
    : inference
      ? INFERENCE_LESSONS[section ?? 0]!.seconds
      : journey
        ? REQUEST_JOURNEY_SECONDS
        : mechanism
          ? mechanismSeconds(section ?? 0)
          : hardware
            ? parallelSeconds(fixedStep ?? 0)
            : fixedStep === undefined
              ? lesson.steps.length * SCENE_STEP_SECONDS
              : spatial
                ? section === 2
                  ? SWIGLU_SECONDS
                  : SPATIAL_COMPUTE_SECONDS
                : residual
                  ? RESIDUAL_SECONDS
                  : id === "token-flow"
                    ? REQUEST_SECONDS
                    : SCENE_STEP_SECONDS;
  const playback = journey
    ? requestJourneyPosition(time)
    : clipPosition(time, lesson.steps.length, fixedStep, hardware, total);
  const { step, progress } = playback;
  const [rank, setRank] = useState(0);
  const [status, setStatus] = useState("waiting");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!spatialInference) return;
    const narrow = window.matchMedia("(max-width: 650px)");
    const resize = () => setAttempt((value) => value + 1);
    narrow.addEventListener("change", resize);
    return () => narrow.removeEventListener("change", resize);
  }, [spatialInference]);
  const [reloadModule, setReloadModule] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const workbench = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const readingHost = useRef<HTMLDivElement>(null);
  const view = useRef<View | null>(null);
  useEffect(() => {
    if (!expanded) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const figure = workbench.current?.closest("figure");
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = overflow;
      figure?.style.removeProperty("min-height");
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [expanded]);
  const latest = useRef({ rank, fixedStep });
  latest.current = { rank, fixedStep };
  const locate = (seconds: number) => {
    return journey
      ? requestJourneyPosition(seconds)
      : clipPosition(seconds, lesson.steps.length, latest.current.fixedStep, hardware, total);
  };
  const seek = (seconds: number) => {
    const next = locate(seconds);
    position.current = next.time;
    setTime(next.time);
    if (next.time === total) setPlaying(false);
    view.current?.update(next.step, latest.current.rank);
    view.current?.animate(next.progress);
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: chapter links seek once; playback must not re-seek on every frame.
  useEffect(() => {
    if (!journey) return;
    const match = /^#scene-token-flow(?:-([0-3]))?$/.exec(hash);
    if (match) {
      seek(REQUEST_JOURNEY_STARTS[Number(match[1] ?? 0)]!);
      setPlaying(false);
    }
  }, [hash, journey]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt intentionally retries failed dynamic imports and WebGL.
  useEffect(() => {
    const element = host.current!;
    const abort = new AbortController();
    const lost = (event: Event) => {
      event.preventDefault();
      setStatus("error");
    };
    element.addEventListener("webglcontextlost", lost, true);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        setStatus("loading");
        let imported = false;
        const mount = async (): Promise<View | null> => {
          if (collective) {
            const { mountCollectiveScene } = await import("./wiki-collective-renderer");
            imported = true;
            return mountCollectiveScene(element, abort.signal);
          }
          if (inference) {
            if ((section ?? 0) >= 4) {
              const { mountOptimizationScene } = await import("./wiki-optimization-renderer");
              imported = true;
              return mountOptimizationScene(element, section! - 4, abort.signal);
            }
            const { mountInferenceScene } = await import("./wiki-inference-renderer");
            imported = true;
            return mountInferenceScene(element, section ?? 0, abort.signal);
          }
          if (id === "parallel-strategy") {
            const { mountParallelScene } = await import("./wiki-hardware-renderer");
            imported = true;
            return mountParallelScene(element, setRank, abort.signal);
          }
          if (mechanism) {
            const { mountParallelMechanism } = await import("./wiki-parallel-mechanism-renderer");
            imported = true;
            return mountParallelMechanism(element, section ?? 0, abort.signal);
          }
          if (id === "token-flow") {
            const { mountRequestScene } = await import("./wiki-request-renderer");
            imported = true;
            return mountRequestScene(element, abort.signal);
          }
          if (residual) {
            const { mountResidualScene } = await import("./wiki-residual-renderer");
            imported = true;
            return mountResidualScene(element, section!, abort.signal);
          }
          if (id === "model-compute" && (section === 1 || section === 2)) {
            const { mountWikiModel } = await import("./wiki-scene-renderer");
            const result = await mountWikiModel(element, abort.signal, readingHost.current!, (p) =>
              seek(p * total),
            );
            // Native modules also cache failed imports until the document reloads.
            imported = true;
            return result;
          }
          const { mountDataScene } = await import("./wiki-data-renderer");
          imported = true;
          return mountDataScene(element, id, abort.signal);
        };
        void mount()
          .then((result) => {
            if (!result) return;
            if (abort.signal.aborted) {
              result.dispose();
              return;
            }
            view.current = result;
            const next = locate(position.current);
            result.update(next.step, latest.current.rank);
            result.animate(next.progress);
            setStatus("ready");
          })
          .catch(() => {
            if (!abort.signal.aborted) {
              setReloadModule(!imported);
              setStatus("error");
            }
          });
      },
      { rootMargin: "100px" },
    );
    observer.observe(element);
    return () => {
      abort.abort();
      observer.disconnect();
      element.removeEventListener("webglcontextlost", lost, true);
      view.current?.dispose();
      view.current = null;
    };
  }, [id, attempt, section]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: locate uses the current section ref; time is advanced independently by the player.
  useEffect(() => {
    view.current?.update(step, rank);
    view.current?.animate(locate(position.current).progress);
  }, [step, rank, lesson.steps.length, hardware, total]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: locate reads the latest fixed section without restarting the animation loop.
  useEffect(() => {
    if (!playing || status !== "ready") return;
    let frame = 0,
      last = 0,
      published = 0,
      publishedRead = "",
      visible = false;
    const frameTimes: number[] = [];
    const tick = (now: number) => {
      frame = 0;
      if (!visible || document.hidden) {
        last = 0;
        return;
      }
      if (!last) last = now;
      // Keep wall-clock speed on slow frames; visibility changes reset last separately.
      if (now > last) {
        frameTimes.push(now - last);
        if (frameTimes.length > 120) frameTimes.shift();
        position.current = Math.min(total, position.current + ((now - last) / 1000) * speed);
        last = now;
        const next = locate(position.current);
        view.current?.update(next.step, latest.current.rank);
        view.current?.animate(next.progress);
        // Publish semantic read transitions immediately; a throttled caption must
        // not name the previous K/V row after the 3D cursor has moved on.
        let readKey =
          mechanism && next.step >= 2 && next.step <= 4
            ? [0, 1]
                .map((card) => {
                  const read = cpReadFrame(next.step, next.progress, card);
                  return `${read.phase}:${read.position}:${read.consumed}:${read.scored}:${read.weighted}`;
                })
                .join("|")
            : "";
        if (collective) {
          const f = collectiveFrame(next.step, next.progress);
          readKey = `${f.action}:${f.arrived}:${f.applied}`;
        }
        if (inference) {
          const f = inferenceFrame(next.step, next.progress);
          readKey = `${f.phase}:${f.landed}:${f.settled}:${Math.floor(f.local * 8)}`;
        }
        if (mechanism && next.step === 1) {
          const norm = spNormalization(next.progress),
            projection = spProjection(next.progress);
          readKey = `${mechanismFrame(1, next.progress).phase}:${norm.rows[0]}:${norm.landed === 1}:${norm.divided === 1}:${projection.row}`;
        }
        if (spatial) {
          const calculation = next.step === 1 ? matmulTimeline(next.progress) : swigluTimeline(next.progress);
          readKey = `${calculation.phase}:${calculation.active}:${calculation.made}:${calculation.added}`;
        }
        if (id === "token-flow") {
          const request = requestState(next.step, next.progress);
          readKey = [
            request.section,
            request.phase,
            request.handoff.phase,
            request.work === 1,
            request.stream?.done,
            request.stream?.generation?.layers,
            request.stream?.generation?.checked,
          ].join(":");
        }
        if (now - published > 120 || readKey !== publishedRead || next.time === total) {
          if (host.current && frameTimes.length > 10) {
            const average = frameTimes.reduce((sum, value) => sum + value, 0) / frameTimes.length;
            host.current.dataset.playbackFps = (1000 / average).toFixed(1);
            host.current.dataset.playbackP95 = [...frameTimes]
              .sort((a, b) => a - b)
              [Math.floor(frameTimes.length * 0.95)]!.toFixed(1);
          }
          setTime(next.time);
          published = now;
          publishedRead = readKey;
        }
        if (next.time === total) {
          setPlaying(false);
          return;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    const resume = () => {
      if (visible && !document.hidden && !frame) frame = requestAnimationFrame(tick);
      else if (!visible || document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
        last = 0;
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
      resume();
    });
    observer.observe(host.current!);
    document.addEventListener("visibilitychange", resume);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", resume);
    };
  }, [playing, speed, status, total, lesson.steps.length, hardware]);
  const current = lesson.steps[step]!;
  const textSizes = useMemo(() => {
    const frames = Array.from({ length: 101 }, (_, i) => i / 100).flatMap((p) =>
      collective
        ? [collectiveTeaching(step, p)]
        : inference
          ? [inferenceTeaching(step, p)]
          : mechanism
            ? [mechanismTeaching(step, p)]
            : hardware
              ? [parallelTeaching(step, rank, p)]
              : id === "model-compute"
                ? [spatial ? spatialTeaching(step, p) : modelTeaching(step, p)]
                : [0, 1, 2, 3].map((part) => requestTeaching(part, p)),
    );
    const cues = mechanism ? Array.from({ length: 101 }, (_, i) => mechanismCue(step, i / 100)) : [];
    return {
      title: [...new Set(frames.map((f) => f.title))],
      equation: [...new Set(frames.map((f) => f.equation))],
      detail: [...new Set(frames.map((f) => f.detail))],
      cueTitle: [...new Set(cues.map((f) => f.title))],
      cueDetail: [...new Set(cues.map((f) => f.detail))],
    };
  }, [collective, inference, mechanism, hardware, id, spatial, step, rank]);
  const teaching = collective
    ? collectiveTeaching(step, progress)
    : inference
      ? inferenceTeaching(step, progress)
      : mechanism
        ? mechanismTeaching(step, progress)
        : hardware
          ? parallelTeaching(step, rank, progress)
          : id === "model-compute"
            ? section === 1 || section === 2
              ? spatialTeaching(step, progress)
              : modelTeaching(step, progress)
            : requestTeaching(step, progress);
  const phase = collective
    ? collectiveFrame(step, progress).action
    : inference
      ? inferenceFrame(step, progress).phase
      : mechanism
        ? mechanismFrame(step, progress).phase
        : hardware
          ? step === 1
            ? dpRequestFrame(progress).stage
            : parallelPhase(progress, step === 2).phase
          : id === "model-compute" && (section === 1 || section === 2)
            ? computePhase(step, progress)
            : residual
              ? residualMotion(step, progress).phase
              : phaseAt(progress);
  const anchor = `scene-${id}${section === undefined ? "" : `-${section}`}`;
  const request = id === "token-flow" ? requestState(step, progress) : null;
  const cue = mechanism ? mechanismCue(step, progress) : null;
  const guide = mechanism ? MECHANISM_GUIDES[step]! : null;
  return (
    <figure
      className="wiki-scene"
      id={anchor}
      data-testid={anchor}
      data-ready={status === "ready"}
      data-playing={playing && status === "ready"}
      data-kind={id}
      data-cache={cache || undefined}
      data-journey={journey || undefined}
      data-spatial={spatial || undefined}
      data-matmul={(spatial && section === 1) || undefined}
      data-residual={residual || undefined}
    >
      <figcaption>
        {journey &&
          sceneAnchorIds(id)
            .slice(1)
            .map((alias) => <span key={alias} id={alias} className="wiki-request-anchor" />)}
        <span className="wiki-scene-kicker">
          交互图解 ·{" "}
          {hardware || mechanism || collective
            ? "硬件与分工"
            : inference && step > 0
              ? step === 7
                ? "调度与时间"
                : step === 3
                  ? "计算与硬件"
                  : step === 4 || step === 5
                    ? "数据与计算"
                    : "缓存与硬件"
              : id === "token-flow"
                ? "请求与数据"
                : "模型内部"}
        </span>
        <h3>{section === undefined ? lesson.title : current.title}</h3>
        {guide && <p>{guide.purpose}</p>}
        {section === undefined && <p>{lesson.intro}</p>}
      </figcaption>
      <div ref={workbench} className="wiki-scene-workbench" data-expanded={expanded || undefined}>
        {section === undefined && (
          <nav
            className={journey ? "wiki-request-chapters" : "wiki-scene-steps"}
            aria-label={journey ? "请求全程阶段" : "图解步骤"}
          >
            {lesson.steps.map((item, index) => (
              <button
                type="button"
                key={item.label}
                aria-pressed={step === index}
                onClick={() => {
                  if (hardware || collective) {
                    latest.current.fixedStep = index;
                    setMode(index);
                    seek(0);
                    setPlaying(true);
                  } else seek(journey ? REQUEST_JOURNEY_STARTS[index]! : index * SCENE_STEP_SECONDS);
                }}
              >
                {!hardware && !collective && <span>{String(index + 1).padStart(2, "0")}</span>}
                {item.label}
              </button>
            ))}
          </nav>
        )}
        <div className="wiki-scene-player">
          <button
            type="button"
            className="wiki-scene-play"
            disabled={status !== "ready"}
            onClick={(event) => {
              if (position.current >= total) seek(0);
              if (!playing)
                event.currentTarget
                  .closest(journey ? ".wiki-scene-workbench" : ".wiki-scene-player")
                  ?.scrollIntoView({ block: "start", behavior: "instant" });
              setPlaying(!playing);
            }}
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}
            {playing ? "暂停" : time >= total ? "重新播放" : "连续播放"}
          </button>
          <input
            type="range"
            min={0}
            max={total}
            step={0.05}
            value={time}
            aria-label="图解播放进度"
            aria-valuetext={`${current.label}，${Math.round(progress * 100)}%`}
            onChange={(event) => seek(Number(event.target.value))}
          />
          <span className="wiki-scene-time">
            {Math.floor(time)} / {total}s
          </span>
          <select
            aria-label="播放速度"
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
          >
            <option value={0.5}>0.5×</option>
            <option value={1}>1×</option>
            <option value={2}>2×</option>
          </select>
          {(mechanism || hardware || inference || collective) && (
            <button
              type="button"
              className="wiki-scene-expand"
              aria-label={expanded ? "退出放大观看" : "放大观看图解"}
              onClick={() => {
                if (expanded) {
                  setExpanded(false);
                } else {
                  const figure = workbench.current?.closest("figure");
                  if (figure) figure.style.minHeight = `${figure.offsetHeight}px`;
                  setExpanded(true);
                }
              }}
            >
              {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              {expanded ? "退出放大" : "放大观看"}
            </button>
          )}
        </div>
        {cue && (
          <div className="wiki-mechanism-live">
            <strong>
              <StableSceneText text={cue.title} alternatives={textSizes.cueTitle} />
            </strong>
            <span>
              <StableSceneText text={cue.detail} alternatives={textSizes.cueDetail} />
            </span>
          </div>
        )}
        {hardware && (
          <section className="wiki-hardware-live" aria-label="当前动作与原因">
            <strong>
              <StableSceneText text={teaching.title} alternatives={textSizes.title} />
            </strong>
            <span>
              <StableSceneText text={teaching.detail} alternatives={textSizes.detail} />
            </span>
          </section>
        )}
        <div className="wiki-scene-layout">
          <div className="wiki-scene-visual">
            {id === "parallel-strategy" && (
              <aside className="wiki-scene-legend" aria-label="权重与数据图例">
                <span className="weight">权重 · 留在显存</span>
                <span className="activation">token 输入</span>
                <span className="result">计算结果</span>
                {step === 2 && <small>一串小格 = 一份向量 · 一组三层 = 一位专家</small>}
              </aside>
            )}
            <div className="wiki-scene-canvas-viewport" tabIndex={mechanism ? 0 : undefined}>
              {/* biome-ignore lint/a11y/useSemanticElements: this group contains spatial controls rather than form fields. */}
              <div
                ref={host}
                className="wiki-scene-canvas"
                role="group"
                aria-label={
                  inference && step === 7 ? "多请求调度时间轴" : `${lesson.title} 可拖动旋转的三维图`
                }
              />
            </div>
            {status !== "ready" && (
              <div className="wiki-scene-loading" role="status">
                <span>{status === "error" ? "图解暂未载入，步骤讲解仍可阅读。" : "正在准备交互图解…"}</span>
                {status === "error" && (
                  <button
                    type="button"
                    onClick={() => {
                      // Browsers cache rejected ES module imports until the document reloads.
                      if (reloadModule) {
                        location.reload();
                        return;
                      }
                      setStatus("loading");
                      setAttempt(attempt + 1);
                    }}
                  >
                    重新加载
                  </button>
                )}
              </div>
            )}
            <div className="wiki-scene-tools">
              <span>
                {inference && step === 7
                  ? "按调度步观察 · 等宽格不表示等长耗时"
                  : inference || collective
                    ? inference && section === 1
                      ? "拖动旋转 · 同一张 NPU，同一处缓存"
                      : inference && section === 3
                        ? "拖动旋转 · 底座同一张 NPU，上方展开 GM 与 AIC / AIV 片上通路"
                        : "上方看卡内数据与收发 · 下方展开同一份内容 · 可拖动旋转"
                    : hardware
                      ? step === 2
                        ? `源卡 ${rank} · 点卡号换源卡 · 全程自动播放`
                        : `选中卡 ${rank} · 点卡号查看常驻权重`
                      : id === "token-flow"
                        ? "拖动轻转视角 · 当前步骤从所属模块展开"
                        : spatial && (section === 1 || section === 2)
                          ? "拖动旋转 · 点输出或选择通道，追踪计算关系"
                          : "拖动旋转 · 观察数据形状与计算结果"}
              </span>
              <button
                hidden={inference && step === 7}
                type="button"
                onClick={() => view.current?.reset()}
                aria-label="复位图解视角"
              >
                <RotateCcw size={13} />
                复位
              </button>
            </div>
          </div>
          <div className="wiki-scene-explanation">
            {collective && (
              <CollectiveReadout
                kind={step}
                progress={progress}
                onSeek={(p) => {
                  setPlaying(false);
                  seek(p * total);
                }}
              />
            )}
            {inference && (
              <InferenceReadout
                kind={step}
                progress={progress}
                onSeek={(p) => {
                  setPlaying(false);
                  seek(p * total);
                }}
              />
            )}
            {hardware && (
              <section className="wiki-hardware-current" aria-label="当前步骤讲解">
                <strong className="wiki-hardware-current-title">{teaching.title}</strong>
                <p className="wiki-hardware-current-detail">{teaching.detail}</p>
              </section>
            )}
            {hardware && (
              <HardwareReadout
                step={step}
                rank={rank}
                progress={progress}
                onSeek={(seconds) => {
                  setPlaying(false);
                  seek(seconds);
                }}
              />
            )}
            {guide && cue && (
              <>
                <nav className="wiki-mechanism-chapters" aria-label="并行图解阶段">
                  {mechanismChapters(step).map((chapter, i) => (
                    <button
                      key={chapter.label}
                      type="button"
                      aria-pressed={i === cue.chapter}
                      onClick={() => {
                        setPlaying(false);
                        seek(chapter.start + 0.001);
                      }}
                    >
                      <span>{i + 1}</span>
                      {chapter.label}
                    </button>
                  ))}
                </nav>
                {step === 1 ? (
                  <SPReadout progress={progress} />
                ) : step >= 2 && step <= 4 ? (
                  <CPReadout kind={step} progress={progress} />
                ) : (
                  <aside className="wiki-mechanism-object" aria-label="先认清图中对象">
                    <strong>这张图在分什么</strong>
                    <p>{guide.object}</p>
                    <dl>
                      <div>
                        <dt>留在卡里</dt>
                        <dd>{guide.fixed}</dd>
                      </div>
                      <div>
                        <dt>跨卡传递</dt>
                        <dd>{guide.moving}</dd>
                      </div>
                    </dl>
                  </aside>
                )}
              </>
            )}
            {hardware && (
              <div className="wiki-scene-resident-summary">
                <strong>权重：训练好的模型参数</strong>
                <span>加载后留在卡的显存中，供不同 token 反复使用。</span>
                {step === 2 && (
                  <span>16 张卡都有权重。每卡存有本层的 18 位专家，当前未选中的专家也留在显存中。</span>
                )}
                <span>{step === 2 ? "每卡 18 位专家 × 3 套权重" : "每组 W0–W7 · 每卡一片"}</span>
                {step === 2 && (
                  <span>本次只用 8 位专家（6 张卡）；“选 0/18”表示 18 位中本次选中 0 位，权重仍在。</span>
                )}
              </div>
            )}
            <span className="wiki-compute-step" hidden={mechanism || hardware || inference || collective}>
              {journey && <span className="wiki-request-current">{current.label} · </span>}
              {String(
                spatial && section === 2 ? (phase === 0 ? 1 : phase === 3 ? 3 : 2) : phase + 1,
              ).padStart(2, "0")}{" "}
              / {hardware ? (step === 1 ? "08" : "06") : spatial && section === 2 ? "03" : "04"} ·{" "}
              {spatial && section === 2 ? "当前结构区" : "当前步骤"}
            </span>
            {section === undefined && !collective && (
              <span className="wiki-scene-count">
                {String(step + 1).padStart(2, "0")} / {String(lesson.steps.length).padStart(2, "0")}
              </span>
            )}
            <h4 data-phase={phase} hidden={hardware || inference || collective}>
              <StableSceneText
                text={cue?.title ?? teaching.title}
                alternatives={cue ? textSizes.cueTitle : textSizes.title}
              />
            </h4>
            {cue && (
              <p className="wiki-mechanism-action">
                <StableSceneText text={cue.detail} alternatives={textSizes.cueDetail} />
              </p>
            )}
            {request && <RequestReadout state={request} />}
            {spatial && <div ref={readingHost} className="wiki-compute-reading" />}
            {(spatial || mechanism) && teaching ? (
              <details className="wiki-compute-reference" open={status === "error" ? true : undefined}>
                <summary>{mechanism ? "数值、编号与实现说明" : "计算规则与维度"}</summary>
                {mechanism && (
                  <>
                    <strong>{MECHANISM_READING_KEYS[step]!.sample}</strong>
                    <p>
                      {MECHANISM_READING_KEYS[step]!.meaning} {MECHANISM_READING_KEYS[step]!.labels}
                    </p>
                  </>
                )}
                <div className="wiki-scene-equation" data-testid="scene-equation">
                  <StableSceneText text={teaching.equation} alternatives={textSizes.equation} />
                </div>
                <p>{teaching.detail}</p>
                {mechanism && <p>{MECHANISM_READING_KEYS[step]!.example}</p>}
                <div className="wiki-scene-shape">{current.shape}</div>
              </details>
            ) : (
              teaching &&
              !inference &&
              !collective && (
                <div className="wiki-scene-equation" data-testid="scene-equation">
                  <StableSceneText text={teaching.equation} alternatives={textSizes.equation} />
                </div>
              )
            )}
            {!spatial && !mechanism && !hardware && !inference && !collective && (
              <p>
                <StableSceneText text={teaching?.detail ?? current.text} alternatives={textSizes.detail} />
              </p>
            )}
            {guide && (
              <p className="wiki-mechanism-outcome">
                <strong>这样分工得到什么</strong>
                {guide.outcome}
              </p>
            )}
            {residual && (
              <p className="wiki-residual-example-note">
                本图每路为一个 token 的完整四通道示例向量；实际每路宽 4096。这里示意四路已不同的某层，第 0
                层入口的四路是同一词向量的副本。 pre、comb、post 为给定教学系数；实际由入口计算。γ = 1，忽略
                ε。
              </p>
            )}
            {hardware && (
              <details className="wiki-compute-reference wiki-scene-hardware-reference">
                <summary>本卡权重与部署</summary>
                <p>{current.text}</p>
                {id === "parallel-strategy" && (
                  <section
                    className="wiki-scene-routing wiki-scene-residency"
                    aria-label={`rank ${rank} 的常驻权重`}
                  >
                    <strong>卡{rank} 存的权重</strong>
                    <span>
                      {step === 2
                        ? `E${rank * 18}–E${rank * 18 + 17} · 18 位完整专家 / MoE 层 · 每位 3 个矩阵`
                        : `W${rank % 8} · ${TP_DOWN_WEIGHT.input / TP_DOWN_WEIGHT.shards} × ${TP_DOWN_WEIGHT.output} · 完整 W_down 的 1/8`}
                    </span>
                    <small>
                      {step === 2
                        ? "每位专家的 gate / up / down 权重共 24 MiB；18 位共 432 MiB（INT8 矩阵，不含缩放系数）。"
                        : `输入维 ${(rank % 8) * (TP_DOWN_WEIGHT.input / TP_DOWN_WEIGHT.shards)}–${((rank % 8) + 1) * (TP_DOWN_WEIGHT.input / TP_DOWN_WEIGHT.shards) - 1}；卡${rank < 8 ? rank + 8 : rank - 8} 持有相同分片。每片 6 MiB（INT8 矩阵，不含缩放系数）。`}
                    </small>
                  </section>
                )}
                {id === "parallel-strategy" && step === 2 && (
                  <div className="wiki-scene-routing">
                    <strong>本次路由示意 · 源卡 {rank}</strong>
                    <span>
                      {expertAssignments(rank)
                        .map((item) => `E${item.expert} → 卡${item.rank}`)
                        .join("　")}
                    </span>
                  </div>
                )}
              </details>
            )}
            {!spatial && <div className="wiki-scene-shape">{current.shape}</div>}
            {section === undefined && !hardware && !journey && !collective && (
              <div className="wiki-scene-paging">
                <button
                  type="button"
                  disabled={step === 0}
                  onClick={() => seek((step - 1) * SCENE_STEP_SECONDS)}
                  aria-label="上一步"
                >
                  <ArrowLeft size={16} />
                </button>
                <button
                  type="button"
                  disabled={step === lesson.steps.length - 1}
                  onClick={() => seek((step + 1) * SCENE_STEP_SECONDS)}
                >
                  下一步
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <p className="wiki-scene-note">
        {id === "model-compute"
          ? section === 2
            ? "使用正文注明的 4→6→4 教学算例，逐步保留两位小数；空间展开表示数学依赖，不表示芯片的物理布局或执行时序。"
            : "使用正文注明的教学算例；空间展开表示数学依赖，不表示芯片的物理布局或执行时序。"
          : (current.note ?? lesson.note)}
      </p>
      {collective && (
        <div className="wiki-scene-related">
          <span>在推理中使用</span>
          {[
            ["tensor-parallel", "TP：加齐部分和"],
            ["sequence-parallel", "SP：分片与收集"],
            ["expert-parallel", "EP：分发与回收"],
          ].map(([page, label]) => (
            <Link key={page} to={`/wiki/${page}`}>
              {label}
              <ArrowRight size={12} />
            </Link>
          ))}
        </div>
      )}
      {section === undefined && !journey && !collective && (
        <div className="wiki-scene-related">
          <span>继续观察</span>
          {(
            [
              ["model-compute", "模型计算"],
              ["parallel-strategy", "并行策略"],
              ["token-flow", "一个 token 的流动"],
            ] as const
          )
            .filter(([key]) => key !== id)
            .map(([key, label]) => (
              <Link key={key} to={`/wiki/${SCENE_LESSONS[key].page}#scene-${key}`}>
                {label}
                <ArrowRight size={12} />
              </Link>
            ))}
        </div>
      )}
    </figure>
  );
}
