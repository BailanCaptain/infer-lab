import { type ChapterLayer, HEAD } from "./chapter-layer";
import { formatLayerValue as format, layerFrame } from "./layer-calculation";
import { WORDS } from "./matrix-parts";
import "./AttentionStructure.css";

export function AttentionStructure({ phase, word }: { phase: number; word: number }) {
  return (
    <figure className="component-map attention-structure" aria-label="注意力在完整模型中的位置">
      <figcaption>从整台模型，定位到「{WORDS[word]}」的这一次更新</figcaption>
      <div className="attention-model-route">
        <span>文字 → 分词、嵌入</span>
        <span>
          → 多层 Transformer · <strong>当前这一层 ↓</strong>
        </span>
        <span>→ 末端归一化、词表投影 → 概率 → 下一 token</span>
      </div>
      <svg
        viewBox="0 0 760 300"
        role="img"
        aria-label="X 留在旁路；RMSNorm 得到 N₁。N₁ 乘 Wq、Wk、Wv 得到 Q、K、V；QK 匹配经 softmax 得到 α，α 乘 V 求和得到 8 维汇总，经 Wₒ 得到 4096 维 ΔA，再加回 X。"
      >
        <defs>
          <marker
            id="attention-structure-arrow"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M1 1L7 4L1 7" />
          </marker>
        </defs>
        <g className="attention-connections">
          <path d="M56 135H84M186 135H216" />
          <path d="M242 135V55Q242 43 254 43H314M252 135H314M242 145V208Q242 220 254 220H314" />
          <path d="M360 43H382Q394 43 394 55V84H418M360 135H382Q394 135 394 123V106H418" />
          <path d="M504 122V148Q504 160 516 160H530V200" />
          <path d="M360 220H474M582 220H640M676 241V260" />
          <path className="attention-bypass" d="M42 151V267Q42 279 54 279H657" />
        </g>
        <text x="42" y="140" className="attention-symbol">
          X
        </text>
        <text x="42" y="118" className="attention-small">
          4,096
        </text>
        <rect className="attention-box" x="84" y="115" width="102" height="40" rx="4" />
        <text x="135" y="140">
          RMSNorm₁
        </text>
        <text x="234" y="140" className="attention-symbol">
          N₁
        </text>
        {[
          { y: 43, w: "Wq", symbol: "Q", role: `「${WORDS[word]}」用来匹配` },
          { y: 135, w: "Wk", symbol: "K", role: "各位置供它匹配" },
          { y: 220, w: "Wv", symbol: "V", role: "各位置提供的内容" },
        ].map(({ y, w, symbol, role }) => (
          <g key={w}>
            <text x="278" y={y - 12} className="attention-parameter">
              × {w}
            </text>
            <text x="339" y={y + 6} className="attention-symbol">
              {symbol}
            </text>
            <text x="339" y={y + 29} className="attention-small">
              {role}
            </text>
          </g>
        ))}
        <g className="attention-focus" data-active={phase === 0}>
          <rect className="attention-box" x="418" y="56" width="173" height="66" rx="4" />
          <text x="504" y="80">
            Q · K / √8
          </text>
          <text x="504" y="104">
            因果屏蔽 → softmax
          </text>
        </g>
        <text x="563" y="158" className="attention-symbol">
          α
        </text>
        <text x="590" y="178" className="attention-small">
          决定各取多少
        </text>
        <g className="attention-focus" data-active={phase === 1 || phase === 2}>
          <rect className="attention-box" x="474" y="200" width="108" height="41" rx="4" />
          <text x="528" y="226">
            Σ α × V
          </text>
        </g>
        <text x="528" y="261" className="attention-small">
          8 维汇总
        </text>
        <text x="612" y="206" className="attention-parameter">
          × Wₒ
        </text>
        <g className="attention-focus" data-active={phase === 3}>
          <rect className="attention-box" x="640" y="200" width="72" height="41" rx="4" />
          <text x="676" y="226">
            ΔA
          </text>
        </g>
        <text x="704" y="182" className="attention-small">
          4,096 维
        </text>
        <text x="166" y="269" className="attention-bypass-label">
          保留原输入 X
        </text>
        <circle className="attention-add" cx="676" cy="279" r="18" />
        <text x="676" y="285" className="attention-symbol">
          +
        </text>
        <text x="730" y="284" className="attention-symbol">
          X′
        </text>
        <path className="attention-exit" d="M695 279H710" />
      </svg>
      <div className="attention-model-tail">
        <strong>X′</strong> → RMSNorm₂ → FFN → ΔF → 加回 X′ → <strong>Y</strong> → 下一层
      </div>
      <p className="attention-structure-note">
        Wq、Wk、Wv、Wₒ 是训练学得、推理时固定的参数；α 是当前输入算出的比例，这些比例作用在对应位置的 V
        上。本例为单头教学结构，Q、K、V 各 8
        维，省略位置编码与偏置；数值由固定公式生成，未经训练，不用于解释词义。
      </p>
    </figure>
  );
}

export function AttentionSources({
  data,
  word,
  channel,
  progress,
  onInspect,
}: {
  data: ChapterLayer;
  word: number;
  channel: number;
  progress: number;
  onInspect: (index: number) => void;
}) {
  const { phase, amount } = layerFrame("attention", progress);
  const current = phase < 3 && progress > 0 ? Math.min(word, Math.floor(amount * (word + 1))) : -1;
  const dimension = Math.min(channel, HEAD - 1);
  return (
    <section className="attention-sources" aria-label="从匹配分数追踪到内容贡献">
      <div className="attention-source-heading">
        <strong>「{WORDS[word]}」怎样读这六个位置</strong>
        <span>点击一列，跟进它的 3D 运算 ↓</span>
      </div>
      <div className="attention-source-table">
        <div className="attention-source-axis">
          <span>来源位置</span>
          <span>Q · K / √8</span>
          <span>softmax → α</span>
          <span>V 的第 {dimension + 1} 维</span>
          <span>乘 α 后的贡献</span>
        </div>
        {WORDS.map((text, index) => {
          const masked = index > word;
          const score = data.attention.scores[word * data.count + index]!;
          const alpha = data.attention.weights[word * data.count + index]!;
          const value = data.attention.v[index * HEAD + dimension]!;
          return (
            <button
              className="attention-source-choice"
              type="button"
              key={text}
              disabled={masked}
              data-masked={masked}
              aria-label={`追踪「${text}」的贡献`}
              aria-pressed={current === index}
              data-alpha={alpha}
              data-value={value}
              data-product={alpha * value}
              onClick={() => onInspect(index)}
            >
              <strong>{text}</strong>
              <span>{masked ? "屏蔽" : format(score)}</span>
              <span className="attention-source-proportion">
                <i style={{ width: `${alpha * 100}%` }} />
                {masked ? "不可见" : `${(alpha * 100).toFixed(1)}%`}
              </span>
              <span>{format(value)}</span>
              <span className="attention-source-product">{masked ? "—" : format(alpha * value)}</span>
            </button>
          );
        })}
      </div>
      <p className="attention-source-conclusion">
        每列的比例乘到它的整份 V 上；上面抽取同一个维度作对照。把这 {word + 1} 份贡献相加，汇总第{" "}
        {dimension + 1} 维 ≈ <strong>{format(data.attention.mixed[word * HEAD + dimension]!)}</strong>。其余 7
        维同样计算。
      </p>
    </section>
  );
}
