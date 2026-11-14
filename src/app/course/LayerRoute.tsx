import { useId } from "react";
import { Link } from "react-router";
import "./LayerRoute.css";

export const CHAPTER03_FOCUS: Record<string, { label: string; path: string; nodes: string[] }> = {
  "two-halves": { label: "先看全局", path: "一份表示，经过两次更新", nodes: [] },
  hidden: { label: "接住输入", path: "上一层 → X", nodes: ["hidden"] },
  residual: { label: "保留原表示", path: "X 留在旁路，支路计算改变量", nodes: ["residual"] },
  rms: { label: "准备支路输入", path: "X → RMSNorm₁ → N₁", nodes: ["rms"] },
  attention: { label: "读取上下文", path: "N₁ → 注意力 → ΔA", nodes: ["attention"] },
  "attention-add": { label: "第一次更新", path: "X + ΔA → X′", nodes: ["attention-add"] },
  ffn: { label: "加工当前位置", path: "X′ → RMSNorm₂ → FFN → ΔF", nodes: ["norm2", "ffn"] },
  "ffn-add": { label: "第二次更新", path: "X′ + ΔF → Y", nodes: ["ffn-add"] },
  "whole-layer": { label: "交给下一层", path: "本层的 Y → 下一层的 X", nodes: ["whole-layer"] },
};

export function LayerRoute({
  active = "two-halves",
  onNavigate,
}: {
  active?: string;
  onNavigate: (id: string) => void;
}) {
  const arrow = useId();
  const focus = CHAPTER03_FOCUS[active] ?? CHAPTER03_FOCUS["whole-layer"]!;
  const picked = (id: string) => focus.nodes.includes(id);
  const link = (id: string) => ({
    to: { pathname: "/chapters/03", hash: `#${id}` },
    onClick: () => onNavigate(id),
  });
  return (
    <figure className="layer-map" aria-label="一层的两条计算支路与残差连接">
      <section className="layer-model-context" aria-label="这一层在整个模型中的位置">
        <span>
          输入文字
          <br />
          <small>分词、嵌入</small>
        </span>
        <i>→</i>
        <strong>
          多层 Transformer
          <br />
          <small>本章展开其中一层 ↓</small>
        </strong>
        <i>→</i>
        <span>
          末端归一化、词表投影
          <br />
          <small>得到分数，再选下一个 token</small>
        </span>
      </section>
      <figcaption>
        <strong className="layer-map-title">一份表示，经过两次更新</strong>
        <span className="layer-map-path">X → X′ → Y</span>
      </figcaption>
      <div className="layer-map-legend">
        <span>保留并更新已有表示</span>
        <span>支路计算改变量</span>
      </div>
      {/* biome-ignore lint/a11y/useSemanticElements: An interactive SVG groups navigable nodes; a fieldset cannot contain SVG drawing elements. */}
      <svg
        className="layer-route-graphic"
        viewBox="0 0 760 630"
        role="group"
        aria-label="X经RMSNorm₁和注意力生成ΔA，加回保留的X得到X′；X′经RMSNorm₂和前馈生成ΔF，加回保留的X′得到Y。归一化位于支路，Y交给下一层。"
      >
        <defs>
          <marker
            id={arrow}
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M1 1L7 4L1 7" fill="none" stroke="context-stroke" strokeWidth="1.4" />
          </marker>
        </defs>
        <path className="layer-route-divider" d="M74 271H655" />
        <g className="layer-route-preserved" fill="none" markerEnd={`url(#${arrow})`}>
          <path d="M144 56V224" />
          <path d="M144 260V283" />
          <path d="M144 323V492" />
          <path d="M144 528V555" />
        </g>
        <g className="layer-route-branch" fill="none" markerEnd={`url(#${arrow})`}>
          <path d="M144 82H358" />
          <path d="M484 109V169" />
          <path d="M484 225V242H164" />
          <path d="M144 350H358" />
          <path d="M484 377V437" />
          <path d="M484 493V510H164" />
        </g>
        <circle className="layer-route-junction" cx="144" cy="82" r="4" />
        <circle className="layer-route-junction" cx="144" cy="350" r="4" />
        <text className="layer-route-half" x="358" y="30">
          01 · 读取上下文
        </text>
        <text className="layer-route-half" x="358" y="298">
          02 · 加工当前位置
        </text>
        <Link
          {...link("hidden")}
          className="layer-route-node is-state"
          data-node="hidden"
          data-active={picked("hidden")}
          aria-label="输入X：查看隐藏表示"
        >
          <rect x="108" y="16" width="72" height="40" rx="6" />
          <text x="144" y="43">
            X
          </text>
        </Link>
        <text className="layer-route-annotation" x="198" y="42">
          本层输入
        </text>
        <Link
          {...link("residual")}
          className="layer-route-bypass-link"
          data-node="residual"
          data-active={picked("residual")}
          aria-label="旁路保留X：查看残差连接"
        >
          <rect x="168" y="139" width="116" height="52" rx="5" fill="transparent" />
          <text x="180" y="160">
            保留 X
          </text>
          <text className="layer-route-small" x="180" y="182">
            原值直达相加处
          </text>
        </Link>
        <text className="layer-route-annotation" x="180" y="428">
          保留 X′
        </text>
        <text className="layer-route-small" x="180" y="451">
          接着保留更新后的表示
        </text>
        {[
          { id: "rms", target: "rms", y: 55, title: "RMSNorm₁", detail: "准备支路的数值尺度" },
          {
            id: "attention",
            target: "attention",
            y: 169,
            title: "注意力 Attention",
            detail: "从可见位置汇集内容",
          },
          { id: "norm2", target: "ffn", y: 323, title: "RMSNorm₂", detail: "用 X′ 重新准备支路输入" },
          { id: "ffn", target: "ffn", y: 437, title: "前馈 FFN", detail: "加工当前位置的维度组合" },
        ].map((node) => (
          <Link
            key={node.id}
            {...link(node.target)}
            className="layer-route-node is-operation"
            data-node={node.id}
            data-active={picked(node.id)}
            aria-label={`${node.title}：${node.detail}`}
          >
            <rect x="358" y={node.y} width="252" height="54" rx="7" />
            <text x="484" y={node.y + 23}>
              {node.title}
            </text>
            <text className="layer-route-small" x="484" y={node.y + 43}>
              {node.detail}
            </text>
          </Link>
        ))}
        <text className="layer-route-intermediate" x="505" y="145">
          N₁ · 归一化结果
        </text>
        <text className="layer-route-intermediate" x="505" y="413">
          N₂ · 归一化结果
        </text>
        <text className="layer-route-delta" x="285" y="263">
          ΔA · 注意力改变量
        </text>
        <text className="layer-route-delta" x="285" y="531">
          ΔF · 前馈改变量
        </text>
        {[
          { id: "attention-add", y: 242, equation: "X + ΔA → X′" },
          { id: "ffn-add", y: 510, equation: "X′ + ΔF → Y" },
        ].map((node) => (
          <Link
            key={node.id}
            {...link(node.id)}
            className="layer-route-node is-add"
            data-node={node.id}
            data-active={picked(node.id)}
            aria-label={`残差相加：${node.equation}`}
          >
            <circle cx="144" cy={node.y} r="18" />
            <text x="144" y={node.y + 7}>
              +
            </text>
          </Link>
        ))}
        <g className="layer-route-node is-state">
          <rect x="108" y="283" width="72" height="40" rx="6" />
          <text x="144" y="310">
            X′
          </text>
        </g>
        <text className="layer-route-annotation" x="198" y="310">
          第一次更新后
        </text>
        <Link
          {...link("whole-layer")}
          className="layer-route-node is-state"
          data-node="whole-layer"
          data-active={picked("whole-layer")}
          aria-label="本层输出Y：回看完整计算链"
        >
          <rect x="108" y="555" width="72" height="40" rx="6" />
          <text x="144" y="582">
            Y
          </text>
        </Link>
        <text className="layer-route-annotation" x="198" y="580">
          本层输出 → 下一层的输入
        </text>
        <text className="layer-route-foot" x="358" y="615">
          X、X′、Y 形状相同：6 个位置 × 4,096 维
        </text>
      </svg>
      <p className="layer-map-caption">
        沿左侧看 X 怎样更新为
        Y，沿右侧看每次改变量从哪里来。点击部件可定位正文；本章采用先归一化、后支路计算的 pre-norm 结构。
      </p>
    </figure>
  );
}
