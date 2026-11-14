import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CalcBlock } from "../../content/wiki/CalcBlock";
import type { CalcRow } from "../../content/wiki/calc";
import { loadMasterParts } from "./matrix-master-source";
import {
  channelCount,
  FFN_STEPS,
  type FfnStep,
  inspectPart,
  type MasterParts,
  type MatrixPartKind,
  WORDS,
} from "./matrix-parts";
import { PART_PLAYBACK_SECONDS, partPlayback, RMS_PLAYBACK_SECONDS, rmsProgress } from "./matrix-playback";
import { mountMatrixPart, type PartRenderer } from "./matrix-renderer";
import "./MatrixPart.css";

const value = (number: number | undefined) => number?.toFixed(5) ?? "—";
const equation = (label: string, expression: string, result: number | undefined, note = ""): CalcRow => ({
  kind: "eq",
  label,
  steps: [expression],
  result: value(result),
  resultOp: "≈",
  rel: "",
  note,
});
const titles: Record<MatrixPartKind, string> = {
  rms: "RMSNorm：形状不变，逐词缩放",
  mhc: "mHC 读入：四路合成一路",
  ffn: "门控前馈：跟着一个词走完四步",
};
const rmsSteps = [
  {
    title: "逐项平方",
    text: "先看输入中的一个词：这一列有 4,096 个数。把每个数平方，负数也变成正数，求和时就不会正负抵消。左侧保留原始输入，平方只用来计算这一列的整体尺度。",
  },
  {
    title: "求 RMS",
    text: "把全部 4,096 个平方值相加，再除以 4,096，得到均方。加上很小的 ε 防止分母为零，开方后得到一个 RMS，供这一列共用。图中 16 组只是把求和过程分组展示，分母仍是 4,096。",
  },
  {
    title: "逐维缩放",
    text: "回到原始输入 x：整列的每个数先除以同一个 RMS，保留各维之间的比例与原来的正负号；然后各自乘本维的 γ。γ 是训练得到的一组增益，所以不同维度还可以分别调整大小。",
  },
  {
    title: "写回结果",
    text: "把缩放后的整列写回输出的同一位置。这个词仍有 4,096 维；其他词各算各的 RMS，但共用同一组 γ。输出的形状不变，随后送入注意力或前馈支路。",
  },
];

export function MatrixPart({ kind }: { kind: MatrixPartKind }) {
  const [attempt, setAttempt] = useState(0);
  return <MatrixPartContent key={attempt} kind={kind} onRetry={() => setAttempt((value) => value + 1)} />;
}

function MatrixPartContent({ kind, onRetry }: { kind: MatrixPartKind; onRetry: () => void }) {
  const id = useId();
  const host = useRef<HTMLDivElement>(null);
  const slider = useRef<HTMLInputElement>(null);
  const view = useRef<PartRenderer | null>(null);
  const [source, setSource] = useState<MasterParts | null>(null);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);
  const [word, setWord] = useState(5);
  const [channel, setChannel] = useState(1023);
  const [step, setStep] = useState<FfnStep>("gate");
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(kind === "rms" ? 0 : 1);
  const [inspectionOpen, setInspectionOpen] = useState(false);
  const Reading = kind === "rms" ? "details" : "div";
  const progressRef = useRef(kind === "rms" ? 0 : 1);
  const playback = partPlayback(kind, step, progress);
  const seek = (position: number) => {
    setPlaying(false);
    progressRef.current = position;
    setProgress(position);
  };
  const count = channelCount(kind, step);
  const currentChannel = Math.min(channel, count - 1);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    let active = true;
    setError("");
    loadMasterParts().then(
      (loaded) => {
        if (active) setSource(loaded);
      },
      (reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "矩阵数据暂时无法载入。");
      },
    );
    return () => {
      active = false;
    };
  }, [visible]);
  useEffect(() => {
    if (!source || !host.current) return;
    let renderer: PartRenderer | null = null;
    try {
      renderer = mountMatrixPart(
        host.current,
        source,
        kind,
        step,
        (nextWord, nextChannel) => {
          if (kind === "rms") setInspectionOpen(true);
          setPlaying(false);
          if (kind !== "rms") progressRef.current = 1;
          setProgress(progressRef.current);
          setWord(nextWord);
          setChannel(Math.min(nextChannel, channelCount(kind, step) - 1));
        },
        (message) => {
          setError(message);
          setPlaying(false);
        },
      );
      view.current = renderer;
      renderer.seek(progressRef.current);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "当前浏览器无法绘制矩阵。");
    }
    return () => {
      renderer?.dispose();
      view.current = null;
    };
  }, [source, kind, step]);
  useEffect(() => {
    if (source) view.current?.select(word, Math.min(currentChannel, channelCount(kind, step) - 1));
  }, [word, currentChannel, source, kind, step]);
  useEffect(() => {
    if (!playing) {
      if (source) view.current?.seek(progress);
      if (slider.current) slider.current.value = String(progress * 100);
    }
  }, [progress, source, playing]);
  useEffect(() => {
    if (!playing) return;
    const bounds = host.current?.getBoundingClientRect();
    if (bounds && (bounds.top < 0 || bounds.bottom > window.innerHeight))
      host.current?.scrollIntoView({ block: "center", behavior: "instant" });
    let frame = 0;
    const started = performance.now();
    const initial = progressRef.current;
    let lastUi = started;
    const duration = kind === "rms" ? RMS_PLAYBACK_SECONDS : PART_PLAYBACK_SECONDS;
    const tick = (now: number) => {
      progressRef.current = Math.min(1, initial + (now - started) / (duration * 1000));
      view.current?.seek(progressRef.current);
      if (slider.current) slider.current.value = String(progressRef.current * 100);
      // WebGL follows the display clock; prose and accessibility text need only occasional updates.
      if (now - lastUi >= 150 || progressRef.current === 1) {
        lastUi = now;
        setProgress(progressRef.current);
      }
      if (progressRef.current < 1) frame = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    const pause = () => {
      setProgress(progressRef.current);
      setPlaying(false);
    };
    const pauseWhenHidden = () => {
      if (document.hidden) pause();
    };
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) pause();
    });
    if (host.current) observer.observe(host.current);
    document.addEventListener("visibilitychange", pauseWhenHidden);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", pauseWhenHidden);
    };
  }, [playing, kind]);
  const inspection = useMemo(
    () =>
      source
        ? inspectPart(source.demo, kind, step, word, currentChannel, source.epsilon, source.limit)
        : null,
    [source, kind, step, word, currentChannel],
  );
  return (
    <figure
      className="matrix-part"
      data-part={kind}
      data-step={step}
      data-phase={progress < 1 ? playback.phase : "complete"}
      aria-labelledby={`${id}-caption`}
    >
      <figcaption id={`${id}-caption`}>
        {kind === "rms" ? "跟着一列数，完成一次归一化" : titles[kind]}
      </figcaption>
      {kind === "ffn" && (
        <fieldset className="matrix-part-steps" aria-label="选择前馈运算">
          {FFN_STEPS.map((item) => (
            <button
              type="button"
              key={item.id}
              aria-pressed={step === item.id}
              onClick={() => {
                seek(1);
                setStep(item.id);
              }}
            >
              {item.label}
            </button>
          ))}
        </fieldset>
      )}
      <div className="matrix-part-body">
        {kind === "rms" && (
          <fieldset className="matrix-rms-steps" aria-label="RMSNorm 计算步骤">
            {rmsSteps.map((item, index) => (
              <button
                type="button"
                key={item.title}
                aria-pressed={playback.phase === index}
                disabled={!source || !!error}
                onClick={() => {
                  seek(rmsProgress(index, index === 1 ? 0.975 : index === 2 ? 0.93 : 0.82));
                }}
              >
                <span>{index + 1}</span>
                {item.title}
              </button>
            ))}
          </fieldset>
        )}
        <div
          className="matrix-part-canvas"
          data-idle={kind === "rms" && progress === 0 && !playing}
          ref={host}
          role="img"
          aria-label={`${titles[kind]}，当前选择 ${WORDS[word]}，第 ${currentChannel + 1} 个通道。对应数值在图旁的计算说明中。`}
        >
          {!source && !error && <p className="matrix-part-loading">正在载入这一步的矩阵…</p>}
        </div>
        <fieldset className="matrix-part-playback" aria-label="3D 播放控制">
          <button
            className="matrix-part-toggle"
            type="button"
            aria-label={playing ? "暂停计算" : "播放计算"}
            title={playing ? "暂停计算" : "播放当前运算"}
            disabled={!source || !!error}
            onClick={() => {
              if (playing) {
                seek(progressRef.current);
                return;
              }
              if (!playing && progressRef.current >= 1) {
                progressRef.current = 0;
                setProgress(0);
              }
              setPlaying(true);
            }}
          >
            {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
          </button>
          <input
            ref={slider}
            type="range"
            min={0}
            max={100}
            step={0.1}
            defaultValue={kind === "rms" ? 0 : 100}
            aria-label="计算播放进度"
            aria-valuetext={`${Math.round(progress * 100)}%，${playback.caption}`}
            disabled={!source || !!error}
            onChange={(event) => {
              seek(Number(event.target.value) / 100);
            }}
          />
          <button
            type="button"
            className="matrix-part-reset-view"
            onClick={() => view.current?.resetView()}
            disabled={!source || !!error}
          >
            <RotateCcw size={14} aria-hidden="true" />
            复位视角
          </button>
        </fieldset>
        <p className="matrix-part-playback-caption" aria-live="polite">
          {kind === "rms" ? (
            progress === 0 ? (
              "左侧是输入 x，中间是逐维增益 γ，右侧绿色矩阵是输出 y，等待计算后写入。点击播放，下方展开这一列的计算过程。"
            ) : progress === 1 ? (
              `「${WORDS[word]}」的输入与输出已对齐。点播放看计算过程，也可以点上面的步骤单独观察。`
            ) : (
              <>
                {rmsSteps[playback.phase]!.text}
                {playback.phase === 1 && ` 本例 ε = ${source?.epsilon ?? "—"}。`}
              </>
            )
          ) : (
            `「${WORDS[word]}」 · ${playback.caption}`
          )}
        </p>
        {kind !== "rms" && (
          <div className="matrix-part-toolbar">
            <fieldset className="matrix-part-words" aria-label="选择词的位置">
              {WORDS.map((label, index) => (
                <button
                  type="button"
                  key={label}
                  aria-label={`${label}${index + 1}`}
                  aria-pressed={word === index}
                  onClick={() => {
                    seek(1);
                    setWord(index);
                  }}
                >
                  {label}
                </button>
              ))}
            </fieldset>
          </div>
        )}
        <Reading
          className="matrix-part-reading"
          {...(kind === "rms"
            ? {
                open: inspectionOpen,
                onToggle: (event: React.SyntheticEvent<HTMLElement>) => {
                  if (event.currentTarget instanceof HTMLDetailsElement)
                    setInspectionOpen(event.currentTarget.open);
                },
              }
            : {})}
        >
          {kind === "rms" && <summary>核对一个维度的数值</summary>}
          <div className="matrix-part-channel">
            <label htmlFor={`${id}-channel`}>「{WORDS[word]}」的第</label>
            <input
              id={`${id}-channel`}
              type="number"
              min={1}
              max={count}
              value={currentChannel + 1}
              onChange={(event) => {
                seek(kind === "rms" ? progressRef.current : 1);
                const number = Number(event.target.value);
                if (Number.isFinite(number))
                  setChannel(Math.min(count - 1, Math.max(0, Math.floor(number) - 1)));
              }}
              aria-label="选择输出通道"
            />
            <span>
              维 <span className="matrix-part-dimension">/ {count.toLocaleString("en-US")}</span>
            </span>
          </div>
          {inspection && (
            <div
              className="matrix-part-inspection"
              data-word={word}
              data-channel={currentChannel}
              data-calculated={inspection.calculated}
              data-stored={inspection.stored}
            >
              {kind === "rms" ? (
                <>
                  <div
                    className="matrix-part-equation"
                    role="math"
                    aria-label="输入除以本词RMS，乘缩放参数，得到输出"
                  >
                    <span className="matrix-part-operand is-input">
                      <small>输入 x</small>
                      <strong>{inspection.input?.toFixed(4)}</strong>
                    </span>
                    <span className="matrix-part-operation">÷</span>
                    <span className="matrix-part-operand">
                      <small>本词 RMS</small>
                      <strong>{inspection.rms?.toFixed(4)}</strong>
                    </span>
                    <span className="matrix-part-operation">×</span>
                    <span className="matrix-part-operand is-parameter">
                      <small>参数 γ</small>
                      <strong>{inspection.gamma?.toFixed(4)}</strong>
                    </span>
                    <span className="matrix-part-operation">≈</span>
                    <span className="matrix-part-operand is-output">
                      <small>输出 y</small>
                      <strong>{inspection.stored.toFixed(4)}</strong>
                    </span>
                  </div>
                  <p className="matrix-part-hint">
                    这一列的 4,096 个数共用 RMS ≈ {inspection.rms?.toFixed(4)}。换一个词，分母重新计算；γ
                    仍然共用。
                  </p>
                </>
              ) : kind === "ffn" && step === "multiply" ? (
                <>
                  <div className="matrix-part-expression">
                    SiLU({value(inspection.gate)}) × {value(inspection.up)}
                  </div>
                  <div className="matrix-part-numberline is-result">
                    <span>
                      h<sub>{currentChannel + 1}</sub>
                    </span>
                    <span>≈</span>
                    <strong>{value(inspection.stored)}</strong>
                  </div>
                  <p className="matrix-part-hint">
                    两个数来自「{WORDS[word]}」的同一通道。按本模型规则，gate 先截到不大于 {source?.limit}，up
                    先截到 ±{source?.limit}，再做 SiLU 和逐项相乘。
                  </p>
                </>
              ) : kind === "mhc" ? (
                <>
                  <p className="matrix-part-explanation">四路各取这一维，乘各自的读入系数，再相加。</p>
                  <div className="matrix-part-contributions">
                    {inspection.terms.map((term) => (
                      <div
                        className="matrix-part-contribution"
                        key={term.index}
                        data-active={
                          progress < 1 &&
                          playback.phase === 2 &&
                          Math.floor(playback.amount * 4) === term.index
                        }
                      >
                        <span>第 {term.index + 1} 路</span>
                        <span>
                          {value(term.input)} × {value(term.weight)}
                        </span>
                        <strong>= {value(term.input * term.weight)}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="matrix-part-numberline is-result">
                    <span>合成值</span>
                    <span>≈</span>
                    <strong>{value(inspection.stored)}</strong>
                  </div>
                  <p className="matrix-part-hint">
                    四路原值仍留在主干里。这里只合成送入前馈支路的一份，维度仍为 4,096。
                  </p>
                </>
              ) : (
                <>
                  <p className="matrix-part-explanation">一个输出数，来自完整输入与一组权重的点积。</p>
                  <div className="matrix-part-numberline is-result">
                    <span>{inspection.count.toLocaleString("en-US")} 项相加</span>
                    <span>≈</span>
                    <strong>{value(inspection.stored)}</strong>
                  </div>
                  <p className="matrix-part-hint">
                    高亮部分对应「{WORDS[word]}
                    」的输入与所选输出通道。换一个词，使用同一组权重；换一个输出通道，使用另一组权重。
                  </p>
                  <details className="matrix-part-details">
                    <summary>展开这个数的点积</summary>
                    <CalcBlock
                      rows={[
                        ...inspection.terms.flatMap((term, index): CalcRow[] => [
                          ...(index === 3 && inspection.count > 4
                            ? [{ kind: "text" as const, text: `… 中间 ${inspection.count - 4} 项 …` }]
                            : []),
                          equation(
                            `项 ${term.index + 1}`,
                            `${value(term.input)} × ${value(term.weight)}`,
                            term.input * term.weight,
                          ),
                        ]),
                        equation(
                          `输出通道 ${currentChannel + 1}`,
                          `${inspection.count.toLocaleString("en-US")} 个乘积相加`,
                          inspection.stored,
                        ),
                      ]}
                    />
                    <p className="matrix-part-hint">
                      这里只展开首 3 项和最后 1 项，结果包含全部 {inspection.count.toLocaleString("en-US")}{" "}
                      项。
                    </p>
                  </details>
                </>
              )}
            </div>
          )}
        </Reading>
      </div>
      {error && (
        <div className="matrix-part-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={onRetry}>
            重新载入这幅图
          </button>
        </div>
      )}
      <p className="matrix-part-source">
        {kind === "rms"
          ? "拖动旋转 · 点击矩阵取值 · GLM 第 0 层教学数据，计算包含全部 4,096 维"
          : "拖动旋转 · 点击取值 · 播放所选词的计算　/　GLM 第 0 层，教学权重演算"}
      </p>
    </figure>
  );
}
