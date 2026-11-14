import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AttentionSources, AttentionStructure } from "./AttentionStructure";
import { mountAttentionScene } from "./attention-renderer";
import { ComponentRelation, StageCalculation } from "./ConceptRelations";
import { type ChapterLayer, chapterLayer, type LayerScene } from "./chapter-layer";
import { ResidualRelation } from "./LessonRelations";
import {
  columnStages,
  formatLayerValue as format,
  LAYER_DURATION,
  layerFrame,
  layerStepStart,
  SCENE_STEPS,
} from "./layer-calculation";
import { type LayerRenderer, mountLayerScene } from "./layer-renderer";
import { loadMasterParts } from "./matrix-master-source";
import { WORDS } from "./matrix-parts";
import "./LayerPart.css";
import "./MatrixPart.css";

const TITLES: Record<LayerScene, string> = {
  attention: "注意力：按比例取内容，再投影回主路径",
  "residual-attn": "第一次相加：X + ΔA = X′",
  ffn: "第二条计算支路：入口归一化 → FFN → ΔF",
  "residual-ffn": "第二次相加：X′ + ΔF = Y",
};
function description(kind: LayerScene, phase: number, word: number) {
  const token = `「${WORDS[word]}」`;
  if (kind === "attention")
    return [
      `先标出${token}能看见的位置。V 是这些位置提供的内容，每列在这个单头例子中有 8 维。`,
      "每个位置的整列 V 乘自己的混合比例 α。比例决定这份内容放入多少；8 个维度都乘同一个比例，维度和位置保持不变。",
      "按维度累加各列的贡献：第 1 维加到第 1 维，第 2 维加到第 2 维……得到一列 8 维的汇总。",
      "输出投影分三步：用 8 个输入和 Wₒ 的一列算出 ΔA 的一个维度；换用其余 4,095 列系数，算齐 4,096 维；整列写回当前位置。下一幅图才把 ΔA 加回原输入 X。",
    ][phase];
  if (kind === "ffn")
    return [
      `先对更新后的 X′ 做第二次 RMSNorm，得到 N₂。${token}有自己的分母，各位置共用增益参数。`,
      "N₂ 乘第一组权重 W₁：每个中间维度都是原来 4,096 个数的加权和，宽度展开为 8,192。",
      "整列各维经过 ReLU：负数置零，正数保留；8,192 个维度槽位没有删除。",
      "非线性结果乘 W₂，重新组合为 4,096 维的 ΔF。六个位置各算各的，共用这两组权重。 ",
    ][phase];
  const first = kind === "residual-attn";
  return [
    `左侧保留${first ? "最初的 X" : "第一次更新后的 X′"}，中间是${first ? "注意力" : "前馈"}算出的改变量。取出${token}在两边的同一列。`,
    "两列按维度对齐。相加发生在同一个位置、同一个维度，列之间不会混合。",
    "两列的对应维度逐组相加，形成一整列结果。每段包含连续的 256 维，同一高度始终对应同一组维度。图中编号标明抽样数值来自哪一维，其余维度同样参与计算。",
    first
      ? "整列结果回到 X′ 中同一个位置；4,096 个维度保持原来的顺序，整体形状仍是 6 × 4,096。"
      : "整列结果回到 Y 中同一个位置；下一层把 Y 当作自己的输入 X。 ",
  ][phase];
}

function residualCalculation(data: ChapterLayer, kind: LayerScene, word: number, channel: number) {
  const i = word * data.width + channel;
  const first = kind === "residual-attn";
  const a = (first ? data.input : data.mid)[i]!;
  const b = (first ? data.attention.delta : data.ffn.delta)[i]!;
  const c = (first ? data.mid : data.output)[i]!;
  return `${format(a)} + (${format(b)}) ≈ ${format(c)}`;
}
export function LayerPart({ kind }: { kind: LayerScene }) {
  const root = useRef<HTMLElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const playback = useRef<HTMLFieldSetElement>(null);
  const view = useRef<LayerRenderer | null>(null);
  const position = useRef(0);
  const [activated, setActivated] = useState(false);
  const [data, setData] = useState<ChapterLayer | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [word, setWord] = useState(5);
  const [channel, setChannel] = useState(1023);
  const { phase } = layerFrame(kind, progress);
  const dimensionCount = useMemo(
    () =>
      data
        ? columnStages(data, kind, word)[kind.startsWith("residual") ? 0 : phase]!.outputs[0]!.values.length
        : 4096,
    [data, kind, phase, word],
  );
  const inspectedChannel = Math.min(channel, dimensionCount - 1);
  const numbers = useMemo(
    () =>
      data && kind.startsWith("residual") ? residualCalculation(data, kind, word, inspectedChannel) : "",
    [data, kind, word, inspectedChannel],
  );
  useEffect(() => {
    const element = host.current!;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          (entry.target as HTMLElement).dataset.inView = String(entry.isIntersecting);
      },
      { rootMargin: "150px 0px 0px" },
    );
    observer.observe(element);
    if (kind === "attention") observer.observe(root.current!);
    return () => observer.disconnect();
  }, [kind]);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Load on first approach; reading/scrolling away pauses without destroying the scene.
        if (entry!.isIntersecting) setActivated(true);
        if (!entry!.isIntersecting) setPlaying(false);
      },
      { rootMargin: "350px" },
    );
    observer.observe(root.current!);
    return () => observer.disconnect();
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: retry explicitly remounts a lost WebGL context.
  useEffect(() => {
    if (!activated) return;
    let cancelled = false;
    setError("");
    void loadMasterParts()
      .then((source) => {
        if (cancelled || !host.current) return;
        const layer = chapterLayer(source);
        setData(layer);
        const onError = () => {
          setPlaying(false);
          setError("绘图已中断，请重新载入这幅图。");
        };
        view.current =
          kind === "attention"
            ? mountAttentionScene(host.current, source, layer, onError)
            : mountLayerScene(host.current, source, kind, layer, onError);
        view.current.seek(position.current, word, channel);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "暂时无法加载演示。");
      });
    return () => {
      cancelled = true;
      view.current?.dispose();
      view.current = null;
    };
  }, [activated, kind, retry, word, channel]);
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let before = performance.now();
    let lastReadout = before;
    const tick = (now: number) => {
      position.current = Math.min(
        1,
        position.current + Math.max(0, Math.min(now - before, 100)) / LAYER_DURATION[kind],
      );
      before = now;
      view.current?.seek(position.current, word, channel);
      if (now - lastReadout > 100 || position.current === 1) {
        setProgress(position.current);
        lastReadout = now;
      }
      if (position.current < 1) frame = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, word, channel, kind]);
  useEffect(() => {
    if (playing) {
      if (kind === "attention") host.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      else playback.current?.scrollIntoView({ block: "end", behavior: "smooth" });
    }
  }, [playing, kind]);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", hidden);
    return () => document.removeEventListener("visibilitychange", hidden);
  }, []);
  const seek = (value: number) => {
    setPlaying(false);
    position.current = value;
    setProgress(value);
    view.current?.seek(value, word, channel);
  };
  return (
    <figure
      className="layer-part matrix-part"
      data-layer-scene={kind}
      data-phase={progress === 1 ? "complete" : phase}
      ref={root}
    >
      <figcaption>{TITLES[kind]}</figcaption>
      {kind === "residual-attn" && <ResidualRelation word={word} />}
      {kind === "ffn" && <ComponentRelation kind={kind} phase={phase} data={data} word={word} />}
      {kind === "attention" && <AttentionStructure phase={phase} word={word} />}
      {kind === "ffn" && (
        <p className="layer-source">
          金色 γ₂、W₁、W₂ 是各位置共用的固定参数；模型训练时学习它们，推理时读入。本演示使用教学系数，W₁、W₂
          由固定公式生成，未经训练。绿色矩阵则是本次输入逐步算出的结果。
        </p>
      )}
      <div className="layer-stage">
        <div className="layer-scene-toolbar">
          <fieldset
            className="matrix-rms-steps layer-scene-steps"
            aria-label="计算步骤"
            style={{ gridTemplateColumns: `repeat(${SCENE_STEPS[kind].length}, minmax(0, 1fr))` }}
          >
            {SCENE_STEPS[kind].map((text, index) => (
              <button
                type="button"
                key={text}
                aria-pressed={phase === index}
                onClick={() => seek(layerStepStart(kind, index) + 0.001)}
              >
                <span>{index + 1}</span>
                {text}
              </button>
            ))}
          </fieldset>
        </div>
        <div className={kind === "attention" ? "attention-scene-scroll" : undefined}>
          <div
            className="layer-scene"
            data-idle={progress === 0 && !playing}
            data-complete={progress === 1}
            ref={host}
            role="img"
            aria-label={`${TITLES[kind]}，拖动旋转，使用图下控件播放`}
          />
        </div>
        {kind !== "attention" && (progress === 0 || progress === 1) && (
          <p className="layer-scene-cue">
            {progress === 1
              ? kind === "residual-ffn"
                ? "Y 已写回。下一层从这份表示继续。"
                : "结果已写回。可以重播，或继续阅读下一段。"
              : kind === "ffn"
                ? "播放时跟踪同一位置：归一化 → 全维组合 → 负数归零 → 全维组合。"
                : "播放时跟踪同一位置的两列：对应维相加，结果写回原位。"}
          </p>
        )}
        <fieldset ref={playback} className="matrix-part-playback" aria-label="3D 播放控制">
          <button
            type="button"
            className="matrix-part-toggle"
            aria-label={playing ? "暂停计算" : "播放计算"}
            disabled={!data || !!error}
            onClick={() => {
              if (position.current === 1) seek(0);
              setPlaying(!playing);
            }}
          >
            {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
          </button>
          <input
            type="range"
            aria-label="计算进度"
            min="0"
            max="1"
            step="0.001"
            value={progress}
            onChange={(event) => seek(Number(event.target.value))}
          />
          <button type="button" className="matrix-part-reset-view" onClick={() => view.current?.resetView()}>
            <RotateCcw size={14} aria-hidden="true" />
            复位视角
          </button>
        </fieldset>
      </div>
      {error && (
        <p role="alert">
          {error}{" "}
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            重新载入
          </button>
        </p>
      )}
      <p className="layer-caption">
        {progress === 1 && kind === "attention"
          ? "4,096 维的 ΔA 已写回当前位置。注意力支路到这里结束；下一幅图执行 X + ΔA = X′，使用的是保留下来的原输入 X。"
          : description(kind, phase, word)}
      </p>
      {data && (
        <details className="layer-inspection">
          <summary>沿同一份数据核对数值</summary>
          <div className="layer-fields">
            <label>
              位置{" "}
              <select
                aria-label="核对位置"
                value={word}
                onChange={(event) => {
                  setPlaying(false);
                  setWord(Number(event.target.value));
                }}
              >
                {WORDS.map((text, index) => (
                  <option key={text} value={index}>
                    {index + 1} · {text}
                  </option>
                ))}
              </select>
            </label>
            <label>
              维度{" "}
              <input
                type="number"
                aria-label="核对维度"
                min="1"
                max={dimensionCount}
                value={inspectedChannel + 1}
                onChange={(event) =>
                  setChannel(Math.max(0, Math.min(dimensionCount - 1, Number(event.target.value) - 1)))
                }
              />
            </label>
          </div>
          {kind === "attention" && data && (
            <AttentionSources
              data={data}
              word={word}
              channel={channel}
              progress={progress}
              onInspect={(index) => {
                const start = layerStepStart(kind, 1);
                const end = layerStepStart(kind, 2);
                seek(start + ((index + 0.5) / (word + 1)) * (end - start));
                host.current?.scrollIntoView({ block: "start", behavior: "smooth" });
              }}
            />
          )}
          {kind === "attention" || kind === "ffn" ? (
            <StageCalculation kind={kind} phase={phase} data={data} word={word} channel={inspectedChannel} />
          ) : (
            <p className="layer-numbers">{numbers}</p>
          )}
          {kind === "attention" && (
            <p className="layer-scores">
              Q·K / √8 的可见位置分数：
              {Array.from(
                data.attention.scores.subarray(word * data.count, word * data.count + word + 1),
                format,
              ).join("，")}
              。对这些分数取 softmax，得到图上的 α；未来位置不参加归一化。
            </p>
          )}
          <p>
            当前阶段共有 {dimensionCount.toLocaleString()}{" "}
            个可核对维度。矩阵细纹表示结构，数值来自同一条计算链；小数已舍入，≈ 表示近似相等。
          </p>
        </details>
      )}
    </figure>
  );
}
