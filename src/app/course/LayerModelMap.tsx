import { JOURNEY_STEPS } from "./layer-journey";

const nodes = [
  [0, 54, 45, "X", "6 个位置 × 4,096 维"],
  [1, 300, 45, "RMSNorm₁", "逐列归一化 · γ₁"],
  [2, 165, 139, "Q = N₁ Wq", "查询 · 8 维"],
  [3, 300, 139, "K = N₁ Wk", "键 · 8 维"],
  [4, 465, 139, "V = N₁ Wv", "内容 · 8 维"],
  [5, 232, 235, "QKᵀ / √8", "每个查询对各位置打分"],
  [6, 232, 327, "mask → softmax", "α：每个查询的比例和为 1"],
  [7, 465, 327, "α × V", "一列的全部维度乘同一比例"],
  [8, 465, 420, "同维求和", "汇总仍为 8 维"],
  [9, 232, 420, "汇总 × Wₒ", "ΔA · 回到 4,096 维"],
  [10, 54, 420, "X′ = X + ΔA", "第一次更新"],
  [11, 54, 535, "RMSNorm₂", "从 X′ 出发 · γ₂"],
  [12, 275, 535, "H = N₂ W₁", "展开到 8,192 维"],
  [13, 475, 535, "ReLU(H)", "逐维保留正值"],
  [14, 275, 640, "H₊ W₂ → ΔF", "收回到 4,096 维"],
  [15, 54, 640, "Y = X′ + ΔF", "第二次更新 · 交给下一层"],
] as const;
const paths = [
  "M112 45H238",
  "M300 73V93H165V111",
  "M300 73V111",
  "M300 93H465V111",
  "M232 189V207",
  "M232 263V299",
  "M294 327H403",
  "M465 167V299",
  "M465 355V392",
  "M403 420H294",
  "M170 420H116",
  "M54 73V392",
  "M54 448V507",
  "M116 535H213",
  "M337 535H413",
  "M475 563V628Q475 640 463 640H337",
  "M213 640H116",
  "M0 420H-25V640H-8",
];

export function LayerModelMap({ step, onChoose }: { step: number; onChoose: (step: number) => void }) {
  return (
    <figure className="journey-model-map">
      <figcaption>
        <b>01 · 先看结构</b>
        <span>沿箭头读完一层；左侧长线保留原表示，支路只提供改变量。</span>
      </figcaption>
      <div className="journey-map-scroll">
        {/* biome-ignore lint/a11y/useSemanticElements: an SVG diagram groups keyboard-accessible calculation nodes. */}
        <svg viewBox="-50 0 610 705" role="group" aria-label="完整层路径">
          <title>完整 Transformer 层的二维计算图</title>
          <defs>
            <marker id="model-map-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <path d="M0 0L7 3.5L0 7" fill="currentColor" />
            </marker>
          </defs>
          <g className="journey-map-edges">
            <path d="M165 167V177Q165 189 177 189H232" />
            <path d="M300 167V177Q300 189 288 189H232" />
            {paths.map((d) => (
              <path key={d} d={d} markerEnd="url(#model-map-arrow)" />
            ))}
          </g>
          <text x="74" y="282" className="journey-map-note">
            保留 X
          </text>
          <text x="-35" y="579" className="journey-map-note" transform="rotate(-90 -35 579)">
            保留 X′
          </text>
          {nodes.map(([i, x, y, name, note]) => (
            // biome-ignore lint/a11y/useSemanticElements: keyboard-accessible node inside an SVG, where HTML buttons are invalid.
            <g
              key={i}
              transform={`translate(${x},${y})`}
              role="button"
              tabIndex={0}
              aria-label={`${i + 1}. ${JOURNEY_STEPS[i]!.title}`}
              aria-current={step === i ? "step" : undefined}
              onClick={() => onChoose(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onChoose(i);
                }
              }}
              className={`journey-map-node${step === i ? " is-current" : ""}`}
            >
              <rect x="-62" y="-28" width="124" height="56" rx="6" />
              <text y="-3">{name}</text>
              <text y="16" className="journey-map-small">
                {note}
              </text>
            </g>
          ))}
          <text x="250" y="694" textAnchor="middle" className="journey-map-note">
            W 与 γ 是参数；Q、K、V、α 和各次输出由当前输入计算。
          </text>
        </svg>
      </div>
    </figure>
  );
}
