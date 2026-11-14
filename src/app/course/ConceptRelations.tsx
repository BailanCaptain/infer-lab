import { useMemo } from "react";
import { type ChapterLayer, HEAD } from "./chapter-layer";
import {
  columnStages,
  formatLayerValue as format,
  projectionGroups,
  projectionTerms,
} from "./layer-calculation";
import { WORDS } from "./matrix-parts";
import "./ConceptRelations.css";

/** Flat silhouettes explain shape and correspondence; the scene shows the full computation. */
function Vector({
  x,
  top,
  height,
  rows,
  values,
  scale = 1,
  tone = "data",
  muted = false,
  cellWidth = 22,
}: {
  x: number;
  top: number;
  height: number;
  rows: number;
  values?: ArrayLike<number> | undefined;
  scale?: number;
  tone?: "data" | "input" | "output";
  muted?: boolean;
  cellWidth?: number;
}) {
  return (
    <g className={`component-vector is-${tone}`} opacity={muted ? 0.16 : 1}>
      {Array.from({ length: rows }, (_, row) => row).map((row) => {
        const value = values?.[Math.floor((row * values.length) / rows)];
        const zero = value === 0;
        return (
          <rect
            key={row}
            x={x}
            y={top + (row * height) / rows}
            width={cellWidth}
            height={height / rows - 2}
            data-zero={zero}
            style={{
              fillOpacity:
                value === undefined ? 0.56 : zero ? 1 : 0.28 + Math.min(1, Math.abs(value) / scale) * 0.65,
            }}
          />
        );
      })}
    </g>
  );
}

function Arrow({ x, end, title, active }: { x: number; end: number; title: string; active: boolean }) {
  return (
    <g className="component-operation" data-active={active}>
      <text x={(x + end) / 2} y="101">
        {title}
      </text>
      <path d={`M${x} 124H${end}m-6-5 6 5-6 5`} />
    </g>
  );
}

export function ComponentRelation({
  kind,
  phase,
  data,
  word,
}: {
  kind: "attention" | "ffn";
  phase: number;
  data: ChapterLayer | null;
  word: number;
}) {
  const ffn = kind === "ffn";
  const width = data?.width ?? 4096;
  const source = data?.attention.v;
  const scale = source ? Math.max(...source.map(Math.abs), 0.01) : 1;
  const column = (values: Float32Array | undefined, count: number) =>
    values?.subarray(word * count, (word + 1) * count);
  return (
    <div className="component-explanation" data-component={kind}>
      <figure
        className="component-map"
        aria-label={ffn ? "前馈在本层第二次更新中的位置" : "本节展开注意力的哪一部分"}
      >
        <div className="component-context">
          <div>
            <small>{ffn ? "入口准备" : "来自上一段"}</small>
            <span>{ffn ? "X′ → RMSNorm₂ → N₂" : "N₁ 生成 V 与混合比例"}</span>
          </div>
          <div className="component-context-focus">
            <small>{ffn ? "本图展开 FFN" : "本图展开注意力的后半段"}</small>
            <span>{ffn ? "N₂ → H → H₊ → ΔF" : "V → 加权 → 汇总 → ΔA"}</span>
          </div>
          <div>
            <small>下一段相加</small>
            <span>{ffn ? "ΔF + X′ → Y" : "ΔA + X → X′"}</span>
          </div>
        </div>
        <svg
          viewBox="0 0 760 272"
          role="img"
          aria-label={
            ffn
              ? "FFN只加工同一个位置：N₂乘W₁从4096维展开为8192维的H，ReLU逐维把负数置零，W₂将H₊组合回4096维的ΔF。入口归一化在前，残差相加在后。"
              : "V和加权内容都保留各自的来源位置；各列乘自己的混合比例，再按相同维度相加，形成当前位置的一列8维汇总，乘Wₒ得到4096维ΔA。"
          }
        >
          {ffn ? (
            <>
              <text className="component-step-title" x="167" y="33">
                展开
              </text>
              <text className="component-step-title" x="380" y="33">
                逐维处理
              </text>
              <text className="component-step-title" x="589" y="33">
                收回
              </text>
              <Vector x={48} top={92} height={88} rows={8} values={column(data?.norm2.output, width)} />
              <Vector x={258} top={60} height={120} rows={16} values={column(data?.ffn.expanded, 8192)} />
              <Vector x={468} top={60} height={120} rows={16} values={column(data?.ffn.activated, 8192)} />
              <Vector
                x={678}
                top={92}
                height={88}
                rows={8}
                values={column(data?.ffn.delta, width)}
                tone="output"
              />
              <Arrow x={90} end={237} title="× W₁" active={phase === 1} />
              <Arrow x={300} end={447} title="ReLU" active={phase === 2} />
              <Arrow x={510} end={657} title="× W₂" active={phase === 3} />
              {[
                { x: 59, name: "N₂", dim: "4,096 维" },
                { x: 269, name: "H", dim: "8,192 维" },
                { x: 479, name: "H₊", dim: "8,192 维" },
                { x: 689, name: "ΔF", dim: "4,096 维" },
              ].map((item) => (
                <g key={item.name}>
                  <text className="component-symbol" x={item.x} y="211">
                    {item.name}
                  </text>
                  <text className="component-dimension" x={item.x} y="236">
                    {item.dim}
                  </text>
                </g>
              ))}
              <text className="component-explain" x="164" y="157">
                全部输入维度参与组合
              </text>
              <text className="component-explain" x="377" y="157">
                负数置零，槽位保留
              </text>
              <text className="component-explain" x="587" y="157">
                恢复可与 X′ 相加的维数
              </text>
            </>
          ) : (
            <>
              {WORDS.map((name, index) => {
                const values = source?.subarray(index * HEAD, (index + 1) * HEAD);
                const weight = data?.attention.weights[word * data.count + index] ?? 0;
                return (
                  <g key={name}>
                    <Vector
                      x={23 + index * 16}
                      cellWidth={12}
                      tone="input"
                      top={85}
                      height={96}
                      rows={8}
                      values={values}
                      scale={scale}
                      muted={index > word}
                    />
                    <Vector
                      x={233 + index * 16}
                      cellWidth={12}
                      top={85}
                      height={96}
                      rows={8}
                      values={values?.map((value) => value * weight)}
                      scale={scale}
                      muted={index > word}
                    />
                  </g>
                );
              })}
              <Vector
                x={468}
                top={85}
                height={96}
                rows={8}
                values={column(data?.attention.mixed, HEAD)}
                scale={scale}
              />
              <Vector
                x={678}
                top={60}
                height={120}
                rows={16}
                values={column(data?.attention.delta, width)}
                tone="output"
              />
              <Arrow x={129} end={208} title="乘比例" active={phase < 2} />
              <Arrow x={339} end={447} title="逐维相加" active={phase === 2} />
              <Arrow x={510} end={657} title="× Wₒ" active={phase === 3} />
              <text className="component-step-title" x="69" y="40">
                各位置的内容
              </text>
              <text className="component-step-title" x="279" y="40">
                各位置的贡献
              </text>
              <text className="component-step-title" x="479" y="40">
                当前位置的汇总
              </text>
              <text className="component-step-title" x="689" y="40">
                改变量
              </text>
              {[
                { x: 69, name: "V", dim: `可见 ${word + 1} 列 · 8 维` },
                { x: 279, name: "加权内容", dim: `可见 ${word + 1} 列 · 8 维` },
                { x: 479, name: "汇总内容", dim: "1 列 × 8 维" },
                { x: 689, name: "ΔA", dim: "1 列 × 4,096 维" },
              ].map((item) => (
                <g key={item.name}>
                  <text className="component-symbol" x={item.x} y="211">
                    {item.name}
                  </text>
                  <text className="component-dimension" x={item.x} y="236">
                    {item.dim}
                  </text>
                </g>
              ))}
              <path className="component-collection" d="M233 188v6h92v-6" />
            </>
          )}
        </svg>
        <div className="component-reading-note">
          <p>
            {ffn
              ? `始终加工「${WORDS[word]}」这一列：位置不变，中间增加的是维度。下方 3D 还会演示入口的第二次归一化。`
              : `「${WORDS[word]}」读取 ${word + 1} 个可见位置：乘比例时保留各列，逐维相加后才汇成一列。下方 3D 展开同一段计算。`}
          </p>
          {!ffn && word < WORDS.length - 1 && (
            <p>淡出的列来自当前位置之后，不参与这次汇总；淡色表示不可见，不表示数值为零。</p>
          )}
        </div>
      </figure>
    </div>
  );
}
export function StageCalculation({
  kind,
  phase,
  data,
  word,
  channel,
}: {
  kind: "attention" | "ffn";
  phase: number;
  data: ChapterLayer | null;
  word: number;
  channel: number;
}) {
  const stage = useMemo(
    () => (data ? columnStages(data, kind, word)[phase]! : null),
    [data, kind, phase, word],
  );
  const pieces = useMemo(() => {
    if (stage?.mode !== "project") return [];
    return stage.inputs[0]!.values.length > 16
      ? projectionGroups(stage, channel).map((group) => ({
          label: `${group.start + 1}–${group.end}`,
          value: group.sum,
        }))
      : projectionTerms(stage, channel).map((term, index) => ({
          label: `第 ${index + 1} 维`,
          value: term.product,
        }));
  }, [stage, channel]);
  if (!data || !stage) return <p className="component-loading">正在载入与 3D 相同的教学数据…</p>;
  const token = `「${WORDS[word]}」`;
  const j = channel + 1;
  const isTaking = kind === "attention" && phase < 2;
  const isMix = kind === "attention" && phase === 2;
  const visibleColumns = isTaking
    ? Array.from({ length: word + 1 }, (_, index) => ({
        name: WORDS[index]!,
        value: data.attention.v[index * HEAD + channel]!,
        weight: data.attention.weights[word * data.count + index]!,
      }))
    : [];
  const result = isMix ? data.attention.mixed[word * HEAD + channel]! : stage.outputs[0]!.values[channel]!;
  const outputName = isTaking
    ? phase === 0
      ? "内容 V"
      : "加权内容"
    : isMix
      ? "汇总内容"
      : kind === "attention"
        ? "ΔA"
        : ["N₂", "H", "H₊", "ΔF"][phase]!;
  let explanation: string;
  let equation: string;
  if (isTaking) {
    explanation =
      phase === 0
        ? `当前位置${token}读取能看见的 ${word + 1} 列 V。下面只核对每列的第 ${j} 维，3D 依次标出完整的 8 维列。`
        : `每个位置提供的整列 V 都乘自己的混合比例。下面核对第 ${j} 维；另外 7 维也乘这一列的同一个比例，列之间暂时不相加。`;
    equation = "";
  } else if (isMix) {
    explanation = `将刚才各位置的加权内容按第 ${j} 维相加，写入${token}汇总列的第 ${j} 维。`;
    equation = Array.from(
      { length: word + 1 },
      (_, index) =>
        `(${format(data.attention.v[index * HEAD + channel]! * data.attention.weights[word * data.count + index]!)})`,
    ).join(" + ");
  } else if (stage.mode === "project") {
    explanation = `输入整列的 ${stage.inputs[0]!.values.length.toLocaleString()} 个数，与${kind === "attention" ? " Wₒ" : phase === 1 ? " W₁" : " W₂"} 第 ${j} 列的系数对应相乘、全部求和，写入 ${outputName} 第 ${j} 维。`;
    equation = pieces.map((piece) => format(piece.value)).join(" + ");
  } else if (stage.mode === "norm") {
    explanation = `N₂ 的这个数来自 X′ 的同一位置、同一维；分母由${token}全部 ${data.width.toLocaleString()} 维计算。`;
    equation = `${format(stage.inputs[0]!.values[channel]!)} ÷ ${format(stage.coefficients![0]!)} × ${format(stage.inputs[1]!.values[channel]!)}`;
  } else {
    explanation = `H 的第 ${j} 维写进 H₊ 的同一维：负数变零，正数保持。H₊ 仍有 8192 维，随后全部交给 W₂。`;
    equation = `max(0, ${format(stage.inputs[0]!.values[channel]!)})`;
  }
  return (
    <div
      className="component-calculation layer-numbers"
      data-stage={phase}
      data-output={outputName}
      data-dimension={j}
      data-value={isTaking ? undefined : result}
    >
      <div className="component-calculation-heading">
        <strong>
          {isTaking
            ? `${token}读取的各位置 · ${outputName}第 ${j} 维`
            : `${token} · ${outputName}的第 ${j} 维`}
        </strong>
        <span>与 3D 共用数据 · 当前步骤的运算</span>
      </div>
      <p>{explanation}</p>
      {isTaking ? (
        <div
          className="component-contributions"
          style={{ gridTemplateColumns: `repeat(${visibleColumns.length}, 1fr)` }}
        >
          {visibleColumns.map((column) => (
            <div key={column.name}>
              <small>{column.name}</small>
              <span>{format(column.value)}</span>
              {phase === 1 && (
                <>
                  <span>× {format(column.weight)}</span>
                  <strong>≈ {format(column.value * column.weight)}</strong>
                </>
              )}
            </div>
          ))}
        </div>
      ) : pieces.length > 0 ? (
        <>
          <div className="component-sums-label">
            {stage.inputs[0]!.values.length > 16
              ? "3D 下方“各段乘积和”的八个数"
              : "汇入所选输出维度的八项乘积"}{" "}
            → 相加得到一个输出数
          </div>
          {kind === "attention" && (
            <table className="attention-products">
              <thead>
                <tr>
                  <th>输入维度</th>
                  <th>汇总值</th>
                  <th>Wₒ 系数</th>
                  <th>乘积</th>
                </tr>
              </thead>
              <tbody>
                {projectionTerms(stage, channel).map((term, index) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: each row owns a fixed input dimension.
                  <tr key={`dimension-${index + 1}`}>
                    <td>{index + 1}</td>
                    <td>{format(term.input)}</td>
                    <td>{format(term.weight)}</td>
                    <td>{format(term.product)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="component-sums">
            {pieces.map((piece) => (
              <div key={piece.label}>
                <small>{piece.label}</small>
                <span>{format(piece.value)}</span>
              </div>
            ))}
          </div>
          <div className="component-result">
            合计 ≈ <strong>{format(result)}</strong> → {outputName}[{word + 1}, {j}]
          </div>
        </>
      ) : (
        <div className="component-equation">
          {equation} ≈ <strong>{format(result)}</strong>
        </div>
      )}
      <p className="component-correspondence">
        {isTaking
          ? phase === 0
            ? "各列仍对应原来的位置。下一步，每列分别乘它的混合比例。"
            : "各列贡献分别写入“加权内容”的同一位置；下一步才按维度累加为一列汇总。"
          : isMix
            ? `其他 7 个维度重复同样的汇总，形成${token}完整的 8 维列，再进入输出投影。`
            : stage.mode === "project"
              ? `这只算出结果列的一个数。其余 ${stage.outputs[0]!.values.length - 1} 维各用一列系数，形成整列，再写回 ${outputName} 中${token}的位置。`
              : `这里核对一个数；3D 展示${token}的整列变化。改变上方“位置／维度”，两处会一起更新。`}
      </p>
    </div>
  );
}
