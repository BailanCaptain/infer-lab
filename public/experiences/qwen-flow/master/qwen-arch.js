// Interactive 2D mineral-palette SVG architecture blueprint for Qwen3-8B and Qwen3-30B-A3B.
import { ACCENTS, PALETTES, mix } from '../../glm-flow/master/flow-colors.js';
import { QWEN_MODELS, getQwenVariant } from './qwen-spec.js';

function nodesFor(spec) {
  const H = spec.hidden;
  const isMoe = spec.ffnKind === 'moe';
  const base = [
    {
      id: 'embed', comp: 'embed', role: 'wt', x: 28, y: 112, w: 196, h: 92,
      title: '词嵌入表 E', sub: `[151,936 × ${H}] · 独立`,
      formula: `X₀ = E[ids] → [S, ${H}]，tie_word_embeddings=false（与输出头不共享权重）`,
    },
    {
      id: 'resid_in', comp: 'resid', role: 'act', x: 28, y: 244, w: 196, h: 72,
      title: '单路残差主干 X₀', sub: `[S, ${H}]`,
      formula: '标准 1 路残差主干贯通全部同构层（对比 GLM-5.3-Flash 的 4 路 mHC）',
    },
    {
      id: 'norm1', comp: 'norm', role: 'act', x: 270, y: 84, w: 186, h: 66,
      title: 'Pre-RMSNorm ①', sub: `γ₁ [${H}]`,
      formula: `X_n = X₀ / √(mean(X₀²)+ε) ⊙ γ₁，保留主干原值旁路`,
    },
    {
      id: 'gqa', comp: 'attn', role: 'wt', x: 270, y: 174, w: 186, h: 86,
      title: `GQA ${spec.gqaRatio}:1 投影`, sub: `32Q : ${spec.numKvHeads}KV · d_h=128`,
      formula: `W_q[${H},4096], W_k/W_v[${H},${spec.kvDim}] → Q[S,32,128], K/V[S,${spec.numKvHeads},128]`,
    },
    {
      id: 'qknorm', comp: 'norm', role: 'act', x: 496, y: 84, w: 204, h: 72,
      title: '逐头 QK-Norm', sub: 'q_norm / k_norm [128]',
      formula: 'Qwen3 标志设计：RoPE 前对每个 Q/K 头 128 维单独 RMSNorm，V 不参与',
    },
    {
      id: 'rope', comp: 'attn', role: 'act', x: 496, y: 180, w: 204, h: 80,
      title: 'RoPE 64 对旋转', sub: 'θ = 1,000,000',
      formula: '每头 128 维配 64 对二维旋转，赋予相对位置感知；仅作用于 Q/K',
    },
    {
      id: 'kvcache', comp: 'attn', role: 'act', x: 496, y: 284, w: 204, h: 84,
      title: 'KV Cache & GQA 注意力', sub: `${spec.kvBytesPerTokenLayer} B/层 · ${spec.kvKiBPerTokenTotal} KiB/tok`,
      formula: `2×${spec.numKvHeads}×128×2B=${spec.kvBytesPerTokenLayer}B/tok/层；全模型 ${spec.numLayers} 层共 ${spec.kvKiBPerTokenTotal} KiB/tok`,
    },
    {
      id: 'wo', comp: 'attn', role: 'wt', x: 496, y: 392, w: 204, h: 66,
      title: 'W_o 输出投影 + 残差①', sub: `[4096 × ${H}] → res₁`,
      formula: `res₁ = X₀ + Concat(P·V)·W_o[4096, ${H}]`,
    },
    {
      id: 'norm2', comp: 'norm', role: 'act', x: 742, y: 84, w: 208, h: 66,
      title: 'Pre-RMSNorm ②', sub: `γ₂ [${H}]`,
      formula: `X_ffn = RMSNorm(res₁, γ₂[${H}])，res₁ 继续旁路向下`,
    },
    isMoe
      ? {
          id: 'router', comp: 'router', role: 'act', x: 742, y: 174, w: 208, h: 86,
          title: 'FP32 Softmax 路由', sub: '128 选 8 重归一 (Σw=1.0)',
          formula: 'w = Top8(Softmax_FP32(x·W_router)) / Σw，严格 0 共享专家（num_shared_experts=0）',
        }
      : {
          id: 'swiglu_up', comp: 'dense', role: 'wt', x: 742, y: 174, w: 208, h: 86,
          title: 'SwiGLU 门控升维', sub: `W_gate / W_up [${H}→12288]`,
          formula: 'h = SiLU(X_ffn·W_gate) ⊙ (X_ffn·W_up) → [S, 12288]',
        },
    isMoe
      ? {
          id: 'experts', comp: 'expert', role: 'wt', x: 742, y: 284, w: 208, h: 90,
          title: '8 个激活 SwiGLU 专家', sub: 'I_moe=768 · 无共享专家',
          formula: '仅计算命中的 8/128 专家并按重归一权重求和：FFN = Σ_{k=1..8} w_k·E_k(X_ffn)',
        }
      : {
          id: 'swiglu_down', comp: 'dense', role: 'wt', x: 742, y: 284, w: 208, h: 90,
          title: 'W_down 下投影', sub: `[12288 × 4096]`,
          formula: 'FFN_out = h · W_down[12288, 4096] → [S, 4096]',
        },
    {
      id: 'resid_out', comp: 'resid', role: 'act', x: 742, y: 398, w: 208, h: 60,
      title: '残差相加② X₁', sub: `res₁ + FFN → [S, ${H}]`,
      formula: `同构重复 ×${spec.numLayers} 层（L00..L${spec.numLayers - 1}），每层独立参数与 KV Cache`,
    },
    {
      id: 'final_norm', comp: 'norm', role: 'act', x: 1004, y: 120, w: 204, h: 72,
      title: '末层 RMSNorm', sub: `X_${spec.numLayers} [S, ${H}]`,
      formula: `经过 ${spec.numLayers} 层同构堆叠后对最终隐藏状态做归一化`,
    },
    {
      id: 'lm_head', comp: 'embed', role: 'wt', x: 1004, y: 228, w: 204, h: 88,
      title: '独立 LM Head', sub: `[${H} × 151,936] 非绑定`,
      formula: `logits = X_norm[-1] · W_head[${H}, 151936]（tie_word_embeddings=false）`,
    },
    {
      id: 'next_tok', comp: 'embed', role: 'act', x: 1004, y: 350, w: 204, h: 74,
      title: 'Softmax & 选词', sub: 'Argmax / 采样 → 下一 token',
      formula: '选出下一 token 后进入增量 Decode，仅输入 1 个新词并复用全部层 KV Cache',
    },
  ];
  return base;
}

const EDGES = [
  ['embed', 'resid_in'], ['resid_in', 'norm1'], ['norm1', 'gqa'], ['gqa', 'qknorm'],
  ['qknorm', 'rope'], ['rope', 'kvcache'], ['kvcache', 'wo'], ['wo', 'norm2'],
  ['norm2', 'swiglu_up'], ['norm2', 'router'], ['swiglu_up', 'swiglu_down'],
  ['router', 'experts'], ['swiglu_down', 'resid_out'], ['experts', 'resid_out'],
  ['resid_out', 'final_norm'], ['final_norm', 'lm_head'], ['lm_head', 'next_tok'],
];

function edgePath(a, b) {
  const sameCol = Math.abs(a.x - b.x) < 20;
  if (sameCol) {
    const x = a.x + a.w / 2;
    return `M ${x} ${a.y + a.h} L ${x} ${b.y}`;
  }
  const x1 = a.x + a.w;
  const y1 = a.y + a.h / 2;
  const x2 = b.x;
  const y2 = b.y + b.h / 2;
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} L ${mx} ${y1} L ${mx} ${y2} L ${x2} ${y2}`;
}

export function renderQwenArch(host, { variant: rawVariant = '8b', onVariantChange } = {}) {
  const variant = getQwenVariant(rawVariant);
  const spec = QWEN_MODELS[variant];
  const P = PALETTES.user;
  const nodes = nodesFor(spec);
  const byId = new Map(nodes.map((n) => [n.id, n]));

  host.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'qwen-arch-shell';

  const header = document.createElement('div');
  header.className = 'qwen-arch-head';
  header.innerHTML = `
    <div id="title"><b>${spec.name}</b> 二维架构蓝图<i>${spec.tagline}</i></div>
    <div id="views">
      <div>
        <button type="button" class="vbtn ${variant === '8b' ? 'on' : ''}" data-variant="8b">Qwen3-8B (Dense)</button>
        <button type="button" class="vbtn ${variant === '30b-a3b' ? 'on' : ''}" data-variant="30b-a3b">Qwen3-30B-A3B (MoE)</button>
      </div>
    </div>
  `;
  wrap.append(header);

  const stage = document.createElement('div');
  stage.className = 'qwen-arch-canvas';
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 1236 510');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${spec.name} 二维计算架构图`);

  const defs = document.createElementNS(NS, 'defs');
  defs.innerHTML = `<marker id="qarr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 1 1 L 9 5 L 1 9 z" fill="#6f7d75"/></marker>`;
  svg.append(defs);

  // Layer enclosure banner
  const frame = document.createElementNS(NS, 'rect');
  frame.setAttribute('x', '248'); frame.setAttribute('y', '42');
  frame.setAttribute('width', '724'); frame.setAttribute('height', '440');
  frame.setAttribute('rx', '14'); frame.setAttribute('fill', '#f4f6f2');
  frame.setAttribute('stroke', '#c9d2c7'); frame.setAttribute('stroke-dasharray', '6 5');
  svg.append(frame);

  const frameLbl = document.createElementNS(NS, 'text');
  frameLbl.setAttribute('x', '266'); frameLbl.setAttribute('y', '66');
  frameLbl.setAttribute('class', 'arch-group-title');
  frameLbl.textContent = `同构 Decoder Layer × ${spec.numLayers}（单路残差 · GQA ${spec.gqaRatio}:1 · QK-Norm · ${spec.ffnKind === 'moe' ? '128选8 MoE · 0共享' : 'SwiGLU 稠密'}）`;
  svg.append(frameLbl);

  // Single-stream residual bypass rail
  const rail = document.createElementNS(NS, 'path');
  rail.setAttribute('d', 'M 126 316 L 126 468 L 846 468 L 846 458');
  rail.setAttribute('fill', 'none'); rail.setAttribute('stroke', '#8d7b94');
  rail.setAttribute('stroke-width', '2.4'); rail.setAttribute('stroke-dasharray', '5 4');
  rail.setAttribute('data-comp', 'resid');
  svg.append(rail);

  for (const [fid, tid] of EDGES) {
    const a = byId.get(fid); const b = byId.get(tid);
    if (!a || !b) continue;
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', edgePath(a, b));
    path.setAttribute('fill', 'none'); path.setAttribute('stroke', '#7c8b83');
    path.setAttribute('stroke-width', '1.8'); path.setAttribute('marker-end', 'url(#qarr)');
    svg.append(path);
  }

  const inspector = document.createElement('div');
  inspector.className = 'qwen-arch-inspect';
  const showNode = (node) => {
    for (const g of svg.querySelectorAll('.box')) g.classList.toggle('sel', g.dataset.node === node.id);
    inspector.innerHTML = `
      <span class="ins-tag" style="background:${mix(P[node.comp][0], '#ffffff', 0.35)};border-color:${ACCENTS[node.comp]}">${node.title}</span>
      <code class="ins-shape">${node.sub}</code>
      <span class="ins-formula">${node.formula}</span>
    `;
  };

  for (const node of nodes) {
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'box');
    g.dataset.comp = node.comp;
    g.dataset.node = node.id;
    const fill = node.role === 'wt' ? P[node.comp][1] : P[node.comp][0];
    const stroke = ACCENTS[node.comp] || '#4a5852';
    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', String(node.x)); rect.setAttribute('y', String(node.y));
    rect.setAttribute('width', String(node.w)); rect.setAttribute('height', String(node.h));
    rect.setAttribute('rx', '9'); rect.setAttribute('fill', fill);
    rect.setAttribute('stroke', stroke); rect.setAttribute('stroke-width', '1.6');
    rect.dataset.role = node.role;
    const t1 = document.createElementNS(NS, 'text');
    t1.setAttribute('x', String(node.x + node.w / 2)); t1.setAttribute('y', String(node.y + node.h / 2 - 5));
    t1.setAttribute('text-anchor', 'middle'); t1.setAttribute('class', 'box-title');
    t1.textContent = node.title;
    const t2 = document.createElementNS(NS, 'text');
    t2.setAttribute('x', String(node.x + node.w / 2)); t2.setAttribute('y', String(node.y + node.h / 2 + 15));
    t2.setAttribute('text-anchor', 'middle'); t2.setAttribute('class', 'box-sub');
    t2.textContent = node.sub;
    g.append(rect, t1, t2);
    g.addEventListener('click', () => showNode(node));
    svg.append(g);
  }

  stage.append(svg);
  wrap.append(stage, inspector);
  host.append(wrap);
  showNode(nodes[4]); // Default highlight QK-Norm

  header.querySelectorAll('button[data-variant]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.variant;
      if (next && next !== variant && onVariantChange) onVariantChange(next);
    });
  });

  requestAnimationFrame(() => {
    window.__arch = { ready: true, variant };
  });
}
