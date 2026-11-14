import { Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { chapterLayer } from "./chapter-layer";
import { LayerModelMap } from "./LayerModelMap";
import {
  JOURNEY_NODES,
  JOURNEY_SECONDS,
  JOURNEY_STEPS,
  journeyFrame,
  journeyProjection,
  journeyTensors,
  journeyValue,
} from "./layer-journey";
import { mountFixedJourney as mountJourney } from "./layer-model-renderer";
import { loadMasterParts } from "./matrix-master-source";
import { type MasterParts, rmsColumn, WORDS } from "./matrix-parts";
import "./LayerJourney.css";

export function LayerJourney({ request }: { request?: { step: number; revision: number } | null }) {
  const root = useRef<HTMLElement>(null),
    host = useRef<HTMLDivElement>(null);
  const view = useRef<ReturnType<typeof mountJourney> | null>(null);
  const position = useRef(0);
  const [source, setSource] = useState<MasterParts | null>(null);
  const [progress, setProgress] = useState(0),
    [playing, setPlaying] = useState(false);
  const [word, setWord] = useState(5),
    [dimension, setDimension] = useState(1023);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const data = useMemo(() => (source ? chapterLayer(source) : null), [source]);
  const tensors = useMemo(() => (data ? journeyTensors(data, word) : null), [data, word]);
  const { step, amount } = journeyFrame(progress);
  const current = JOURNEY_STEPS[step]!;
  const output = tensors ? journeyValue(tensors, current.target, word, dimension) : 0;
  const resultReady = step === 0 || amount >= 0.995;
  const groups = useMemo(
    () => (tensors ? journeyProjection(tensors, step, word, dimension) : []),
    [tensors, step, word, dimension],
  );
  const seek = (value: number) => {
    setPlaying(false);
    position.current = value;
    setProgress(value);
    view.current?.seek(value, word, dimension);
  };
  const choose = (index: number) => seek(Math.max(0, Math.min(15, index)) / 16);
  useEffect(() => {
    if (!request) return;
    setPlaying(false);
    position.current = request.step / 16;
    setProgress(position.current);
  }, [request]);
  useEffect(() => {
    let cancelled = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        void loadMasterParts()
          .then((parts) => {
            if (!cancelled) setSource(parts);
          })
          .catch(() => {
            if (!cancelled) setError("模型数据加载失败，请重试。");
          });
      },
      { rootMargin: "300px" },
    );
    observer.observe(root.current!);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: retry replaces a lost WebGL context.
  useEffect(() => {
    if (!source || !data || !host.current) return;
    setError("");
    try {
      view.current = mountJourney(host.current, source, data, () => {
        setPlaying(false);
        setError("绘图中断，请重新载入。");
      });
      view.current.seek(position.current, word, dimension);
    } catch {
      setError("绘图无法载入，请重试。");
    }
    return () => {
      view.current?.dispose();
      view.current = null;
    };
  }, [source, data, retry]);
  useEffect(() => {
    view.current?.seek(progress, word, dimension);
  }, [word, dimension, progress]);
  useEffect(() => {
    if (!playing) return;
    let frame = 0,
      before = performance.now(),
      last = before;
    const tick = (now: number) => {
      position.current = Math.min(
        1,
        position.current +
          (speed * Math.min(now - before, 100)) / (JOURNEY_STEPS.length * JOURNEY_SECONDS * 1000),
      );
      before = now;
      view.current?.seek(position.current, word, dimension);
      if (now - last > 80 || position.current === 1) {
        setProgress(position.current);
        last = now;
      }
      if (position.current < 1) frame = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, word, dimension, speed]);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", hidden);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) setPlaying(false);
      },
      { rootMargin: "200px" },
    );
    observer.observe(root.current!);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      observer.disconnect();
    };
  }, []);
  const value = (id: "x" | "mid" | "da" | "df" | "n1" | "n2" | "h") =>
    tensors ? journeyValue(tensors, id, word, dimension) : 0;
  const norm =
    source && step === 1
      ? rmsColumn(source.demo, word, source.epsilon).rms
      : (data?.norm2.denominators[word] ?? 1);
  const gamma =
    source && step === 1 ? source.demo.weight("gamma_attn", dimension) : (data?.gamma2[dimension] ?? 1);
  return (
    <section
      className="layer-journey matrix-part"
      id="layer-journey"
      ref={root}
      aria-label="从 X 到 Y 的完整层计算"
      data-step={step}
    >
      <header className="journey-header">
        <div>
          <span>同一份表示 · 两次更新</span>
          <h3>从 X 进入，到 Y 离开</h3>
        </div>
        <span className="journey-step-count">{String(step + 1).padStart(2, "0")} / 16</span>
      </header>
      <div className="journey-model-context">
        词嵌入 / 上一层 → <strong>当前这一层</strong> → 下一层 → 末端归一化、词表投影 → 下一 token
      </div>
      <LayerModelMap step={step} onChoose={choose} />
      <div className="journey-3d-heading">
        <b>02 · 再看完整 3D 模型</b>
        <p>
          所有矩阵同时摆在这里。左侧保留 X 与
          X′；中间是注意力，下面是前馈。播放时只移动取出的列，矩阵本身始终留在原位。
        </p>
      </div>
      <div className="journey-current">
        <strong>{current.title}</strong>
        <span>跟随「{WORDS[word]}」的一整列</span>
      </div>
      <div className="journey-canvas-scroll">
        <div
          className="journey-canvas matrix-part-canvas"
          ref={host}
          role="img"
          aria-label={`完整固定模型 · 第 ${step + 1} 步：${current.title}。所有矩阵同时展示，整列计算后写回。`}
        />
      </div>
      {error && (
        <p role="alert">
          {error}
          <button
            type="button"
            onClick={() => {
              setRetry(retry + 1);
              if (!source)
                void loadMasterParts()
                  .then(setSource)
                  .catch(() => setError("模型数据加载失败，请重试。"));
            }}
          >
            重新载入
          </button>
        </p>
      )}
      <fieldset className="matrix-part-playback journey-playback" aria-label="完整层播放控制">
        <button type="button" aria-label="上一步" disabled={step === 0} onClick={() => choose(step - 1)}>
          <SkipBack size={15} />
        </button>
        <button
          type="button"
          className="matrix-part-toggle"
          disabled={!data || !!error}
          aria-label={playing ? "暂停完整计算" : "播放完整计算"}
          onClick={() => {
            if (position.current === 1) seek(0);
            setPlaying(!playing);
          }}
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.001"
          aria-label="完整计算进度"
          value={progress}
          onChange={(e) => seek(Number(e.target.value))}
        />
        <button type="button" aria-label="下一步" disabled={step === 15} onClick={() => choose(step + 1)}>
          <SkipForward size={15} />
        </button>
        <button type="button" aria-label="复位完整模型视角" onClick={() => view.current?.resetView()}>
          <RotateCcw size={15} />
        </button>
      </fieldset>
      <nav className="journey-substeps" aria-label="本步计算阶段">
        {["取出整列", "逐维运算", "合并结果", "写回并继续"].map((name, i) => (
          <button key={name} type="button" onClick={() => seek((step + [0.12, 0.42, 0.65, 0.92][i]!) / 16)}>
            {name}
          </button>
        ))}
      </nav>
      <div className="journey-selectors">
        <label>
          速度
          <select aria-label="完整计算速度" value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
            <option value={1}>1×</option>
            <option value={2}>2×</option>
            <option value={4}>4×</option>
          </select>
        </label>
        <label>
          步骤
          <select aria-label="完整计算步骤" value={step} onChange={(e) => choose(Number(e.target.value))}>
            {JOURNEY_STEPS.map((s, i) => (
              <option key={s.target} value={i}>
                {i + 1}. {s.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          位置
          <select
            aria-label="完整计算位置"
            value={word}
            onChange={(e) => {
              setPlaying(false);
              setWord(Number(e.target.value));
            }}
          >
            {WORDS.map((w, i) => (
              <option key={w} value={i}>
                {w}
              </option>
            ))}
          </select>
        </label>
        <label>
          核对维度
          <input
            type="number"
            min="1"
            max={data?.width ?? 4096}
            aria-label="完整计算维度"
            value={dimension + 1}
            onChange={(e) => {
              setPlaying(false);
              setDimension(Math.max(0, Math.min((data?.width ?? 4096) - 1, Number(e.target.value) - 1)));
            }}
          />
        </label>
      </div>
      <div className="journey-explanation" aria-live="polite">
        <h4>{current.title}</h4>
        <code>{current.formula}</code>
        <p>{current.why}</p>
        {data && tensors && (
          <div className="journey-equation" data-result={output} data-ready={resultReady}>
            {step === 1 || step === 11 ? (
              <>
                <span>
                  {value(step === 1 ? "x" : "mid").toFixed(4)} ÷ {norm.toFixed(4)} × {gamma.toFixed(4)}
                </span>
                <b>≈</b>
              </>
            ) : null}
            {step === 10 || step === 15 ? (
              <>
                <span data-operand="original">{value(step === 10 ? "x" : "mid").toFixed(4)}</span>
                <b>+</b>
                <span data-operand="delta">{value(step === 10 ? "da" : "df").toFixed(4)}</span>
                <b>≈</b>
              </>
            ) : null}
            {step === 13 ? (
              <>
                <span>max(0, {value("h").toFixed(4)})</span>
                <b>=</b>
              </>
            ) : null}
            {groups.length > 0 ? (
              <>
                <span>全部 {tensors[JOURNEY_STEPS[step]!.sources[0]!].rows.toLocaleString()} 项乘积相加</span>
                <b>≈</b>
              </>
            ) : null}
            <strong>{resultReady ? output.toFixed(4) : "等待本步写入"}</strong>
            <small>
              {JOURNEY_NODES.find((n) => n.id === current.target)!.name} · 第{" "}
              {Math.min(dimension, tensors[current.target].rows - 1) + 1} 维
            </small>
          </div>
        )}
      </div>
      {tensors && (
        <fieldset className="journey-changes" aria-label="同一位置从 X 到 Y 的数值变化">
          {(["x", "mid", "y"] as const).map((id, i) => {
            const ready = i === 0 || step > [0, 10, 15][i]! || (step === [0, 10, 15][i] && resultReady);
            return (
              <div
                key={id}
                data-state={id}
                data-value={journeyValue(tensors, id, word, dimension)}
                data-ready={ready}
              >
                <span>{["进入本层 · X", "注意力之后 · X′", "离开本层 · Y"][i]}</span>
                <strong>{ready ? journeyValue(tensors, id, word, dimension).toFixed(4) : "尚未更新"}</strong>
                <small>
                  「{WORDS[word]}」第 {dimension + 1} 维
                </small>
              </div>
            );
          })}
        </fieldset>
      )}
      {data && tensors && step >= 5 && step <= 8 && (
        <div className="journey-match-table">
          <table>
            <caption>同一个查询「{WORDS[word]}」怎样读取各位置</caption>
            <thead>
              <tr>
                <th>位置</th>
                <th>Q · K / √8</th>
                <th>屏蔽后</th>
                <th>α</th>
                <th>V 第 {Math.min(dimension, 7) + 1} 维</th>
                <th>乘 α 后</th>
              </tr>
            </thead>
            <tbody>
              {WORDS.map((w, j) => {
                const masked = j > word,
                  alpha = tensors.alpha.values[j]!,
                  v = tensors.v.values[j * 8 + Math.min(dimension, 7)]!;
                return (
                  <tr key={w} data-masked={masked}>
                    <th>{w}</th>
                    <td>{tensors.scores.values[j]!.toFixed(3)}</td>
                    <td>{masked ? "−∞" : tensors.scores.values[j]!.toFixed(3)}</td>
                    <td>{(alpha * 100).toFixed(1)}%</td>
                    <td>{v.toFixed(3)}</td>
                    <td data-product={alpha * v}>{(alpha * v).toFixed(3)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {groups.length > 0 && (
        <details className="journey-products">
          <summary>核对这个输出数：全部输入维度都参与了吗？</summary>
          <p>按连续维度分成八组，显示各组内全部乘积的和。把八组相加，就是上面的输出；没有舍弃其余维度。</p>
          <div>
            {groups.map((g) => (
              <span key={g.start} data-sum={g.sum}>
                <small>
                  {g.start + 1}–{g.end} 维
                </small>
                {g.sum.toFixed(5)}
              </span>
            ))}
          </div>
        </details>
      )}
      <p className="journey-footnote">
        这是本章的单头、pre-norm 教学模型。Q/K/V 为 8 维，FFN 使用 ReLU；参数由固定公式生成，未经训练。3D
        格线表示结构；跟随所选位置的一列，其他位置也按同一规则计算。整列分组显示，计算包含全部维度。完整矩阵显示结构与计算预览，高亮列表示当前追踪的路径。投影展示所选输出维的一次完整点积，写回一个数；其余输出维按同一规则计算。下面的数值核对区使用完整计算结果。8
        维头部按放大比例显示，3D 长度不可直接比较参数数量。
      </p>
    </section>
  );
}
