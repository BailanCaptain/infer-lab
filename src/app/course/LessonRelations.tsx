import { WORDS } from "./matrix-parts";

function Matrix({
  x,
  y,
  width,
  height,
  cell = false,
  tone = "input",
  word = 5,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  cell?: boolean;
  tone?: "input" | "delta" | "output";
  word?: number;
}) {
  return (
    <g className="relation-matrix" data-tone={tone} data-selected-column={word}>
      <rect x={x} y={y} width={width} height={height} />
      <rect
        className="relation-selected"
        x={x + (width * word) / 6}
        y={y}
        width={width / 6}
        height={height}
      />
      {[1, 2, 3, 4, 5].map((i) => (
        <path key={i} d={`M${x + (width * i) / 6} ${y}v${height}`} />
      ))}
      <path
        d={Array.from({ length: 11 }, (_, i) => `M${x} ${y + (height * (i + 1)) / 12}h${width}`).join(" ")}
      />
      {cell && (
        <rect
          className="relation-cell"
          x={x + (width * word) / 6}
          y={y + height / 2}
          width={width / 6}
          height={height / 12}
        />
      )}
    </g>
  );
}

export function RepresentationRelation() {
  return (
    <figure className="lesson-relation representation-relation" aria-label="位置与隐藏维度的二维对应">
      <figcaption>一列，保存一个位置的完整表示</figcaption>
      {[false, true].map((compact) => {
        const x = compact ? 62 : 104,
          width = compact ? 264 : 372;
        return (
          <svg
            key={String(compact)}
            className={compact ? "relation-narrow" : "relation-wide"}
            viewBox={compact ? "0 0 340 230" : "0 0 580 250"}
            role="img"
            aria-label="六个位置组成输入X，最后一列开了包含4096个维度"
          >
            <Matrix x={x} y={55} width={width} height={138} />
            {WORDS.map((word, i) => (
              <text
                key={word}
                x={x + ((i + 0.5) * width) / 6}
                y="35"
                className={i === 5 ? "relation-accent" : ""}
              >
                {word}
              </text>
            ))}
            <path className="relation-wire" d={`M${x - 10} 55h-6v138h6`} />
            <text x={compact ? 21 : 44} y="113">
              4,096
            </text>
            <text x={compact ? 21 : 44} y="135">
              维
            </text>
            <text x={x + width / 2} y="224">
              6 个位置 · X [6, 4096]
            </text>
          </svg>
        );
      })}
      <p>高亮的「开了」是后面一直追踪的那一列。格线示意维度排列，不代表只有六个数。</p>
    </figure>
  );
}

export function ResidualRelation({ second = false, word = 5 }: { second?: boolean; word?: number }) {
  const input = second ? "X′" : "X",
    delta = second ? "ΔF" : "ΔA",
    output = second ? "Y" : "X′";
  return (
    <figure
      className="lesson-relation residual-relation"
      aria-label={`${input}与${delta}按同一位置「${WORDS[word]}」同一维度相加`}
    >
      <figcaption>同一个位置，同一个维度，逐项相加</figcaption>
      {[false, true].map((compact) => {
        const width = compact ? 64 : 98,
          gap = compact ? 110 : 220,
          left = compact ? 8 : 31;
        return (
          <svg
            key={String(compact)}
            className={compact ? "relation-narrow" : "relation-wide"}
            viewBox={compact ? "0 0 300 292" : "0 0 600 302"}
            role="img"
            aria-label={`${input}、${delta}、${output}各为六列，高亮「${WORDS[word]}」这一列逐维相加，形状不变`}
          >
            {[
              { name: input, label: second ? "第一次更新后保留" : "从本层入口保留", tone: "input" as const },
              { name: delta, label: second ? "来自前馈支路" : "来自上段注意力", tone: "delta" as const },
              { name: output, label: second ? "交给下一层" : "交给第二条支路", tone: "output" as const },
            ].map(({ name, label, tone }, i) => {
              const x = left + i * gap;
              return (
                <g key={name}>
                  <text className="relation-variable" x={x + width / 2} y="30">
                    {name}
                  </text>
                  <Matrix x={x} y={52} width={width} height={112} cell tone={tone} word={word} />
                  <text className="relation-role" x={x + width / 2} y="190">
                    {label}
                  </text>
                  <text className="relation-dimension" x={x + width / 2} y="212">
                    6 × 4,096
                  </text>
                  <text className="relation-scalar" x={x + width / 2} y="256">
                    {i === 0 ? "aᵢ" : i === 1 ? "bᵢ" : "aᵢ + bᵢ"}
                  </text>
                </g>
              );
            })}
            <text className="relation-sign" x={compact ? 95 : 190} y="115">
              +
            </text>
            <text className="relation-sign" x={compact ? 205 : 410} y="115">
              =
            </text>
            <text className="relation-dimension" x={compact ? 150 : 300} y="289">
              深色单元格：同一列 t 中的同一维 i
            </text>
          </svg>
        );
      })}
      <div className="relation-rule">
        <span>逐维对应</span>
        <code>
          {output}[t, i] = {input}[t, i] + {delta}[t, i]
        </code>
      </div>
      <p>
        t 是位置编号，彩色列都对应「{WORDS[word]}」；i 是维度编号，深色格标出这一维。每一对 aᵢ、bᵢ
        都写入结果列的原位；其余维度重复同样的操作。
      </p>
    </figure>
  );
}
