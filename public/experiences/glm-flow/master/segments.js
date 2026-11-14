// The segments of chapter 02 (「模型结构」, CHAPTER-02-SEGMENTS.md: 38 segments), one source for the chapter page's left
// column (titles, text, the shape line, the captions) and for the player on the model (what each beat does). The first
// playable sample is segments 8–11, then the rest of the first kind of layer, 12–19 (09-25 night) (MASTER-DESIGN 第五节第 1 条, 09-25): the layer as a whole, then the four streams made
// one, the RMSNorm, and Q / K / V.
//
// A built segment: {n, id, panel (the 2D panel of arch-draw.js beside it), rows (the rows of the model column it is at),
// title, flow (the shape line, A2 第 3 条), text (paragraphs), more (the official code, folded),
// layer (whose blocks the ids name), poses {name: {ids, dir, pad}}, labels [{id, html, at}], beats}.
// A beat: {say, dur (seconds at 1×), cam (a pose), op}. Ops (the player's rules, not GLM special cases — A8):
//   {dot: 'pick' | 'pull' | 'mul' | 'sum' | 'place' | 'all'}  the segment's `dot` acted out (one number of a result as a
//                                                dot product of a weight's row and a word's column); 'all' = in one beat
//   ({words: …, w0: k} starts after the first k words, those a dot product before computed)
//   {mix: 'pick' | … | 'all'}                    the segment's `mix` acted out as a dot's phases (mHC's collapse: one number
//                                                of the result = the word's streams at that place · the word's pre)
//   ({words: …, trace: [coef, streams, result, name], by: 'mix'} the rest of it, followed)
//   {conv: 'pick' | … | 'all'}                   the segment's `conv` acted out as a dot's phases (a causal conv: one number =
//                                                the channel of the word and the k − 1 before × its k taps, summed, SiLU)
//   ({words: …, trace: [taps, input, result, name], by: 'conv'} the rest of it, followed)
//   {write: 'pick' | 'pull' | 'mul' | 'sum' | 'place'}  the segment's `write` acted out (mHC's write-back: one number of new
//                                                stream s = post_s × the output's + the old streams' × comb[·, s]); its
//                                                sources far above its result come down from the picture's top edge
//   (the camera goes only down the spine, never back up — 10-02, the user: "就不能跟参考一样是一路下来的吗"; a pose is
//   never above the one before it; what a step reads from above comes down from the top edge, the card says where from)
//   {ew: 'pick' | 'pair' | 'place' | 'all'}      the segment's `ew` acted out (SwiGLU: each number from the two at its place)
//   ({words: …, trace: [.., .., result, name], by: 'write' | 'ew'} the rest of either, followed)
//   {kda: 'pick' | 'recall' | 'read' | 'place'}   the segment's `kda` acted out (one read-out of a KDA head: its column of S
//                                                decayed and recalled with k, corrected by δ; then read with q)
//   ({words: …, trace: ['state', 'Q_conv', result, name], by: 'kda'} the rest of it, followed)
//   {norm: 'pick' | 'square' | 'mean' | 'scale' | 'place' | 'all'}  the segment's `norm` acted out (a RMSNorm of one word: its
//                                                numbers squared, averaged, the root taken; each ÷ that × γ; placed)
//   ({words: …, trace: [γ, input, result, name], by: 'norm'} the rest of a RMSNorm after it, followed as a product's)
//   {show: [...], shape: true}                   the sizes of the segment's dot's input and result marked along their edges
//   ({words | heads: …, trace: [weight, input, result, name]} a product computing the rest after a dot acted out: the
//    formula, its lines and its arrow follow the number being computed, fast)
//   {show: ids}                                  these blocks, nothing computed
//   {words: out, ins: [[id, 'col' | 'all']]}     `out` grows word by word (a column a word); an input read a word at a
//                                                time is lit a column at a time ('col'), a weight read whole stays lit
//   {heads: [[weight, out], …], x, from, n, slow} `out` grows head by head, heads from … from + n − 1: the weight's slice
//                                                of that head lit; slow: within a head, word by word (the input lit a
//                                                column at a time), else a head at a time (the input lit whole)
//   {tour: half}                                 every step of that half of the layer in the official order: what it
//                                                writes grows, what it reads is lit (the layer at a glance)
// Everything not named in the beat fades (two steps only, A6); what the segment has computed so far stays.

export const CHAPTER = { n: '02', title: '模型结构', sub: '一句话怎么穿过 GLM-5.3-Flash，变成下一个词' };

// the chapter's parts and all 38 segments (built ones carry their content below)
export const PARTS = [
  ['〇', '开场', [[1, '这个模型、这句话'], [2, '怎么读这个物体']]],
  ['一', '输入', [[3, '分词'], [4, '词嵌入：查表'], [5, '展成四路残差']]],
  ['二', '整个模型', [[6, '45 层，只有 3 种'], [7, '四路残差贯穿始终']]],
  ['三', '第一种层：KDA 线性注意力 + 稠密前馈（L00）', [[8, '层全景：这一层的输入是什么'], [9, '四路合一（mHC）'], [10, '归一化（RMSNorm）'], [11, '投影成 Q / K / V'],
    [12, '因果短卷积，切成 64 个头'], [13, '门控 g 与 β'], [14, '状态更新与读出'], [15, '输出投影'], [16, '写回四路残差'], [17, '再来一遍：四路合一 + 归一化'], [18, '稠密前馈：升维'], [19, '稠密前馈：降维并写回，出层']]],
  ['四', 'KDA + MoE 层：KDA 线性注意力 + MoE（L04）', [[20, '认识 KDA + MoE 层：从四路输入开始'], [21, '连续走过：注意力半层'], [22, '路由：288 个专家里挑 8 个'], [23, '专家前馈'], [24, '合并已加权专家与共享输出'], [25, '写回四路，出层']]],
  ['五', '第三种层：稀疏注意力 + MoE（L03）', [[26, '层全景'], [27, '连续走过：四路合一 + 归一化'], [28, '先压缩：低秩的 q 和 kv'], [29, '再展开成 64 个头'], [30, '索引器粗筛'], [31, '注意力分数与 softmax'], [32, '取回 V，合头，投影'], [33, '连续走过：MoE 半层']]],
  ['六', '输出：下一个词怎么出来', [[34, '四路取平均并归一化'], [35, '只取最后一个词那一行'], [36, '输出头：给每个词打分'], [37, 'softmax 选词'], [38, '接回句尾，开始下一轮']]],
];

// one line a segment (CHAPTER-02-SEGMENTS.md's 输入 → 输出; 1, 2, 6, 7 reworded as the master draws it)
export const IO = {
  1: "整个物体入画；上面 6 张词卡：这句话要从上往下穿过 45 层，出来的是下一个词",
  2: "一块 = 一个张量，按真实大小画；一个词一列；线只画在真分开的地方；正在算的亮，没用到的淡",
  3: "一句话 → 6 个词 ID [6]",
  4: "[6] → 词表 [154880, 4096] 里取 6 行 → [6, 4096]",
  5: "[6, 4096] → [6, 4 路, 4096]",
  6: "镜头拉远，三种层各亮一次：KDA + 稠密 × 3、KDA + MoE × 31、稀疏注意力 + MoE × 11",
  7: "4 路残差从第一层走到最后一层；每层读它、改它、写回它",
  8: "输入 [6, 4, 4096] → 注意力半层 → 写回 → 前馈半层 → 写回 → 输出 [6, 4, 4096]",
  9: "[6, 4, 4096] × 系数 [6, 24] → [6, 4096]",
  10: "[6, 4096] → [6, 4096]（形状不变，尺度拉齐）",
  11: "[6, 4096] × 3 张 [8192, 4096] → Q / K / V 各 [6, 8192]",
  12: "Q / K / V 各 [6, 8192]，卷积核宽 4 → 形状不变，再切成各 [6, 64 头, 128]",
  13: "[6, 4096] → g [6, 64, 128]、β [6, 64]",
  14: "状态 [64, 128, 128]：衰减 → 读出 → 修正 → 写入；读出 [6, 64, 128]",
  15: "[6, 64, 128] × W_o → [6, 4096]",
  16: "[6, 4096] + 旧四路 → [6, 4, 4096]",
  17: "[6, 4, 4096] → [6, 4096]（与 9、10 相同，合成一段）",
  18: "[6, 4096] → [6, 12288]（Gate 决定哪些通道开，Up 给内容）",
  19: "[6, 12288] → [6, 4096] → [6, 4, 4096]",
  20: "认识 L04：4 路 [6, 4, 4096] → 24 个系数 → 合成 1 路 [6, 4096]",
  21: "接第 20 段的一路 [6, 4096] → RMSNorm → KDA → 写回 4 路",
  22: "[6, 4096] × [288, 4096] → 分数 [6, 288] → 选中 [6, 8]",
  23: "每个词进自己的 8 个专家 + 1 个共享专家：[6, 4096] → [6, 8, 2048] → [6, 8, 4096]",
  24: "[6, 8, 4096] + 共享 [6, 4096] → [6, 4096]",
  25: "[6, 4096] → [6, 4, 4096]（与 19 后半相同，停一拍）",
  26: "和KDA + MoE 层相比，只有注意力那半层换了",
  27: "[6, 4, 4096] → [6, 4096]",
  28: "[6, 4096] → q [6, 1536]、kv [6, 512]",
  29: "q → Q [6, 64, 256]；kv → K、V [6, 64, 256]",
  30: "32 个索引头打分 → 位置掩码 [6, 6]",
  31: "Q·K → [64, 6, 6]，只在选中的位置上算，逐行归一",
  32: "[64, 6, 6] × V → [6, 64, 256] → [6, 4096]，写回四路",
  33: "[6, 4, 4096] → … → [6, 4, 4096]",
  34: "[6, 4, 4096] → [6, 4096]",
  35: "[6, 4096] → [1, 4096]（为什么只看最后一行）",
  36: "[1, 4096] × [154880, 4096] → [1, 154880]",
  37: "[1, 154880] → 概率 → 选中 1 个词（**概率为示意值，页面明说**）",
  38: "句子条 6 张卡 → 7 张卡；之后可「快进一轮」",
};

import {REMAINING} from './segments-rest.js';
const FAR = [.5, .42, 1], NEAR = [.32, .3, 1];

export const SEGMENTS = [
  {
    n: 8, id: 's08', panel: null, rows: ['mhc', 'norm', 'attn-kda', 'write', 'mhc2', 'norm2', 'ffn-dense', 'write2'],
    title: '层全景：这一层的输入是什么', layer: 0,
    flow: ['本层输入 [6, 4 路, 4096]', '注意力半层', '前馈半层', '本层输出 [6, 4 路, 4096]'],
    text: [
      '这一层的输入是右上角那块紫色：6 个词，每个词 4 份、每份 4096 个数，叫 <b>4 路残差</b>。第 0 层的 4 路是同一份词向量复制出来的，从第 1 层起就各不相同了。',
      '一层分上下两半，两半是同一个套路：从 4 路读出 1 路 → 归一化 → 算（上半是 KDA 线性注意力，下半是稠密前馈）→ 把结果写回 4 路。所以出来的还是 [6, 4 路, 4096]，形状不变，交给下一层。',
      'L00、L01、L02 三层都长这样。按 ▶ 从上往下走一遍：每一步算出来的块，按官方代码的顺序依次长出来。',
    ],
    more: '顺序取自官方 <code>modeling_glm5_next.py</code> 的解码层（1282–1331 行）：attn_hc → input_layernorm → self_attn → 写回；ffn_hc → post_attention_layernorm → mlp → 写回。',
    poses: { layer: { all: true, dir: FAR, pad: 4 } },
    labels: [
      { id: 'residual_in', html: '<b>本层输入</b> <i>[6, 4 路, 4096]</i>', at: 'r' },
      { id: 'residual_mid', html: '<b>写回 4 路</b> <i>注意力半层的结果</i>', at: 'r' },
      { id: 'residual_out', html: '<b>本层输出</b> <i>[6, 4 路, 4096]</i>', at: 'r' },
      { id: 'Q', html: '<b>注意力半层</b> <i>KDA</i>', at: 'l' },
      { id: 'W_up', html: '<b>前馈半层</b> <i>稠密</i>', at: 'l' },
    ],
    beats: [
      { say: '输入：6 个词 × 4 路 × 4096 个数', dur: 2.2, cam: 'layer', op: { show: ['residual_in'] } },
      { say: '上半层：合成 1 路 → RMSNorm → KDA 线性注意力 → 写回 4 路', dur: 11, cam: 'layer', op: { tour: 'attn' } },
      { say: '下半层：合成 1 路 → RMSNorm → 稠密前馈 → 写回 4 路', dur: 6, cam: 'layer', op: { tour: 'ffn' } },
      { say: '输出：形状和输入一样，[6, 4 路, 4096]，交给第 1 层', dur: 2.2, cam: 'layer', op: { show: ['residual_out'] } },
    ],
  },
  {
    n: 9, id: 's09', panel: 'mhc', rows: ['mhc'],
    title: '四路合一（mHC）', layer: 0,
    flow: ['本层输入 [6, 4 路, 4096]', '× fn → 24 个系数 [6, 24]', '按 pre 加权相加', '合成 1 路 [6, 4096]'],
    text: [
      '普通的 Transformer 只有一条残差：每层读它，再把结果加回去。GLM-5.3-Flash 用的是 <b>mHC</b>（流形约束超连接），把这一条换成 <b>4 条并排的"路"</b>。注意力和前馈每次只吃 1 份输入，所以每半层开头，先把 4 路合成 1 路。',
      '合成不是简单平均，每个词先算出自己的 <b>24 个系数</b>：把这个词的 4 路拼成 16384 个数，除以它们的均方根，再乘权重 fn [24, 16384]。24 个数分三组：pre 4 个、post 4 个、comb 4×4 个；各自乘一个可学的 scale、加一个可学的 base。pre 再过 sigmoid，就是每一路取多少（各在 0 到 1 之间，4 个加起来不一定是 1）；post 和 comb 这里先不用，留到写回（第 16 段）。',
      '然后每个词按自己的 pre 把 4 路加起来：<b>合成 1 路 = pre₁ × 第 1 路 + pre₂ × 第 2 路 + pre₃ × 第 3 路 + pre₄ × 第 4 路</b>，得到 [6, 4096]。',
      '所以合成 1 路里的<b>每一个数</b>，都是 4 对数相乘再相加：这个词 4 路在同一位置上的 4 个数，各乘这个词的 4 个 pre。播放时先把「春天」的第 1 个数完整算一遍，再快进算完其余的。',
    ],
    more: '官方 <code>modeling_glm5_next.py</code>：<code>Glm5NextTextHyperConnection</code>（220–297 行）；解码层 1296 行先调它。拼起来之后的归一化不乘 γ（<code>UnweightedRMSNorm</code>）；pre = sigmoid(pre × scale₀ + base) + 10⁻⁶（hc_eps）。comb 先过 softmax，再做 20 轮行、列交替归一化（Sinkhorn，286–291 行），写回时再讲。',
    poses: { mhc: { ids: ['residual_in', 'fn_attn', 'coef_attn', 'collapsed_attn', 'base_attn'], dir: NEAR, pad: 2 },
      mix: { ids: ['residual_in', 'coef_attn', 'collapsed_attn'], dir: NEAR, pad: 2 },
      coef: { ids: ['fn_attn', 'scale_attn', 'base_attn', 'coef_attn', 'residual_in'], dir: [.1, .75, 1], pad: 2, shift: [0, .35] } },
    words: 'collapsed_attn',
    // the number acted out: number R of word `word` of the collapse
    mix: { w: 'coef_attn', x: 'residual_in', out: 'collapsed_attn', R: 0, word: 0, tag: '合成 1 路 · 春天 · 第 1 个数' },
    // the coefficient acted out: number R of word `word` of the 24 (eps: rms_norm_eps; hcEps: hc_eps — the config's)
    coef: { w: 'fn_attn', x: 'residual_in', out: 'coef_attn', scale: 'scale_attn', base: 'base_attn', R: 0, word: 0, eps: 1e-5, hcEps: 1e-6, tag: '24 个系数 · 春天 · pre₁' },
    labels: [
      { id: 'residual_in', html: '<b>本层输入</b> <i>[6, 4 路, 4096]</i>', at: 'r' },
      { id: 'fn_attn', html: '<b>fn</b> <i>[24, 4 × 4096]，按 4 路拆开画</i>', at: 'l' },
      { id: 'coef_attn', html: '<b>24 个系数</b> <i>[6, 24]</i>', at: 'tr' },
      { id: 'collapsed_attn', html: '<b>合成 1 路</b> <i>[6, 4096]</i>', at: 'l' },
    ],
    beats: [
      { say: '输入：每个词 4 路，每路 4096 个数', dur: 2.4, cam: 'mhc', op: { show: ['residual_in'] } },
      { say: '先算 24 个系数。挑一个：「春天」的 pre₁。它用到春天 4 路的全部 16384 个数、fn 的第 1 行，和 scale、base 各一个数', dur: 5, cam: 'coef', op: { coef: 'pick' } },
      { say: '春天的 4 路连成 16384 个数，先除以它们的均方根；再和 fn 第 1 行的 16384 个数一对一对排好', dur: 5, cam: 'coef', op: { coef: 'pull' } },
      { say: '每一对相乘', dur: 3, cam: 'coef', op: { coef: 'mul' } },
      { say: '16384 个乘积加起来；× scale、+ base，再过 sigmoid，就是 pre₁', dur: 5, cam: 'coef', op: { coef: 'sum' } },
      { say: '放进 24 个系数里它自己的位置', dur: 2, cam: 'coef', op: { coef: 'place' } },
      { say: '其余的系数一样，每个一次点积：pre 过 sigmoid，post 过 2·sigmoid，comb 每行 4 个一起 softmax，4×4 再做 Sinkhorn', dur: 7, cam: 'coef', op: { words: 'coef_attn', ins: [['residual_in', 'col'], ['fn_attn', 'all'], ['scale_attn', 'all'], ['base_attn', 'all']], trace: ['fn_attn', 'residual_in', 'coef_attn', '24 个系数'], by: 'coef' } },
      { say: '挑合成 1 路里的一个数：「春天」的第 1 个数。它只用到春天 4 路里各自的第 1 个数，和春天的 4 个 pre', dur: 4, cam: 'mix', op: { mix: 'pick' } },
      { say: '把它们抽出来，一对一对排好：第 1 路的数和 pre₁，第 2 路的数和 pre₂……一共 4 对', dur: 4.5, cam: 'mix', op: { mix: 'pull' } },
      { say: '每一对相乘', dur: 3, cam: 'mix', op: { mix: 'mul' } },
      { say: '4 个乘积加起来，就是这个数', dur: 3, cam: 'mix', op: { mix: 'sum' } },
      { say: '放回合成 1 路里它自己的位置', dur: 2, cam: 'mix', op: { mix: 'place' } },
      { say: '其余的数一样：每个词、每个位置，4 路的数各乘这个词的 pre，再相加', dur: 7, cam: 'mix', op: { words: 'collapsed_attn', ins: [['residual_in', 'col'], ['coef_attn', 'col']], trace: ['coef_attn', 'residual_in', 'collapsed_attn', '合成 1 路'], by: 'mix' } },
    ],
  },
  {
    n: 10, id: 's10', panel: null, rows: ['norm'],
    title: '归一化（RMSNorm）', layer: 0,
    flow: ['合成 1 路 [6, 4096]', '除以均方根，乘 γ', 'RMSNorm 后 [6, 4096]'],
    text: [
      '合成出来的 4096 个数，有的词整体偏大、有的偏小。<b>RMSNorm</b> 把每个词单独拉到同一个尺度：先算这 4096 个数的均方根（平方、求平均、开根号），每个数都除以它；再逐个乘上 <b>γ</b>——4096 个可学的数，每一维一个。',
      '每个词只看自己，不看别的词；形状不变，还是 [6, 4096]。这就是注意力的输入。',
      '写成算式：rms = √(x₁² + x₂² + … + x₄₀₉₆² 的平均 + ε)，第 i 个数变成 x_i ÷ rms × γ_i。rms 是一个词一个数，这个词的 4096 个数共用它；γ 是整层一份，6 个词共用。播放时先把「春天」这个词完整算一遍，再快进算完其余 5 个词。',
    ],
    more: '官方 <code>modeling_glm5_next.py</code>：<code>Glm5NextTextRMSNorm</code>（67–85 行），x × rsqrt(mean(x²) + ε) × γ，ε = 10⁻⁵（config 的 rms_norm_eps）；解码层 1298 行（input_layernorm）。',
    poses: { norm: { ids: ['collapsed_attn', 'x_attn', 'gamma_attn'], dir: NEAR, pad: 2 } },
    words: 'collapsed_attn',
    // the word acted out (eps: config rms_norm_eps)
    norm: { x: 'collapsed_attn', g: 'gamma_attn', out: 'x_attn', word: 0, eps: 1e-5, tag: 'RMSNorm · 春天' },
    labels: [
      { id: 'collapsed_attn', html: '<b>合成 1 路</b> <i>[6, 4096]</i>', at: 'r' },
      { id: 'gamma_attn', html: '<b>γ</b> <i>[4096]</i>', at: 'l' },
      { id: 'x_attn', html: '<b>RMSNorm 后</b> <i>[6, 4096]</i>', at: 'r' },
    ],
    beats: [
      { say: '输入：合成 1 路，每个词 4096 个数', dur: 2, cam: 'norm', op: { show: ['collapsed_attn'] } },
      { say: '挑一个词：「春天」。RMSNorm 只看这个词自己的 4096 个数', dur: 3.5, cam: 'norm', op: { norm: 'pick' } },
      { say: '每个数先平方（这里只摆出前 6 个和最后 1 个）', dur: 5, cam: 'norm', op: { norm: 'square' } },
      { say: '4096 个平方求平均，再开根号：这个词的均方根 rms，只有 1 个数', dur: 4.5, cam: 'norm', op: { norm: 'mean' } },
      { say: '每个数除以 rms，再乘 γ 里同一位置的数', dur: 5, cam: 'norm', op: { norm: 'scale' } },
      { say: '放回去：这个词的 4096 个数都这样算，共用同一个 rms，各乘自己的 γ', dur: 4, cam: 'norm', op: { norm: 'place' } },
      { say: '其余 5 个词一样：各算自己的 rms，再逐个除以它、乘 γ', dur: 8, cam: 'norm', op: { words: 'x_attn', w0: 1, ins: [['collapsed_attn', 'col'], ['gamma_attn', 'all']], trace: ['gamma_attn', 'collapsed_attn', 'x_attn', 'RMSNorm 后'], by: 'norm' } },
    ],
  },
  {
    n: 11, id: 's11', panel: 'kda', rows: ['attn-kda'],
    title: '投影成 Q / K / V', layer: 0,
    flow: ['RMSNorm 后 [6, 4096]', '× W_q / W_k / W_v（各 [8192, 4096]）', 'Q / K / V 各 [6, 8192]', '另算输出门 [6, 64 头, 128]'],
    text: [
      '注意力要给每个词准备三样东西：<b>Q</b>（拿去问别的词）、<b>K</b>（被问时拿来对照）、<b>V</b>（被取走的内容）。三样都是同一个输入各乘一张权重：每个词的 4096 个数乘 W_q，得到 8192 个数；K、V 一样。',
      '8192 = <b>64 个头 × 128</b>，但这一步头还没切开：Q 是每个词一整列 8192 个数。图上每 128 个数画一道线，第 12 段卷积之后就按这些线切成 64 个头。W_q 第 h 组的 128 行，产出的正是将来第 h 个头的 128 个数。',
      '<b>形状怎么读</b>：[6, 4096] 先写词数，6 个词、每个词 4096 个数，官方代码里就是一行一个词。W_q 存成 [8192, 4096]（PyTorch 的 Linear 按 [输出, 输入] 存），所以算式是 Q = x · W_qᵀ：[6, 4096] × [4096, 8192] = <b>[6, 8192]</b>。反过来算 W_q · xᵀ 会得到 [8192, 6]：同一批数，只是行和列对调。代码把词数放在前面，因为后面的步骤大多是一个词一个词地算（只有第 12 段的短卷积要沿着词滑动，代码临时转成 [通道, 词]，算完再转回来）。',
      '图上一个词画成<b>竖着的一列</b>，它的数从上往下排：输入每列 4096 个，Q 每列 8192 个；第几列就是第几个词。W_q 立在 Q 左边、和 Q 一样高，第几行就对着 Q 的第几个数。',
      'Q 里的<b>每一个数</b>都是一次<b>点积</b>：W_q 的一行（4096 个数）和一个词的那一列（4096 个数）一对一对相乘，再全部加起来。播放时先把一个数完整地算一遍，再快进算完其余的。',
      '算量：一个词的一个头是 128 × 4096 ≈ 52 万次乘加；整个 Q 是 6 × 8192 × 4096 ≈ 2 亿次；Q、K、V 合起来约 6 亿次。',
      '同一个输入还要乘第 4 组权重，算<b>输出门</b>：先乘 W_g_a [128, 4096] 压到 128 个数，再乘 W_g_b [8192, 128] 展开到 64 个头 × 128。它在图上是这一组最上面的一行，算好先放着，要到注意力读出之后才用（第 15 段）。',
    ],
    more: '官方 <code>modeling_glm5_next.py</code>：q_proj / k_proj / v_proj 都是 [8192, 4096]、没有偏置（605–607 行），前向 644–650 行。代码里 Q、K、V 的 8192 个数先拼在一起过短卷积（第 12 段），之后才按头切开（687–694 行）。同一个 RMSNorm 输出还喂给输出门、衰减门和 β（第 13 段）。',
    poses: {
      dot: { ids: ['x_attn', 'W_q', 'Q'], dir: [-.12, .2, 1], pad: 1.5, margin: .8 },
      shape: { ids: ['x_attn', 'W_q', 'Q'], dir: [-.3, .3, 1], pad: 1, margin: .85 },
      qkv: { ids: ['x_attn', 'W_q', 'Q', 'W_k', 'K', 'W_v', 'V'], dir: [-.3, .35, 1], pad: 3 },
      gate: { ids: ['x_attn', 'W_g_a', 'g_a', 'W_g_b', 'gate', 'W_q', 'Q'], dir: [-.3, .35, 1], pad: 3 },
    },
    words: 'Q',
    // the number acted out: number R of word `word` of the result (its official order: head after head) = row R of the weight
    dot: { w: 'W_q', x: 'x_attn', out: 'Q', R: 0, word: 0, tag: 'Q · 春天 · 第 1 个数' },
    labels: [
      { id: 'x_attn', html: '<b>RMSNorm 后</b> <i>[6, 4096]</i>', at: 'r' },
      { id: 'W_q', html: '<b>W_q</b> <i>[8192, 4096]</i>', at: 'tl' },
      { id: 'Q', html: '<b>Q</b> <i>[6, 8192]</i>', at: 'r' },
      { id: 'W_k', html: '<b>W_k</b>', at: 'tl' }, { id: 'K', html: '<b>K</b> <i>[6, 8192]</i>', at: 'tr' },
      { id: 'W_v', html: '<b>W_v</b>', at: 'tl' }, { id: 'V', html: '<b>V</b> <i>[6, 8192]</i>', at: 'tr' },
      { id: 'W_g_a', html: '<b>W_g_a</b> <i>[128, 4096]</i>', at: 'tl' }, { id: 'g_a', html: '<b>输出门 · 低秩</b> <i>[6, 128]</i>', at: 'b' },
      { id: 'W_g_b', html: '<b>W_g_b</b> <i>[8192, 128]</i>', at: 'tl' }, { id: 'gate', html: '<b>输出门</b> <i>[6, 64 头, 128]</i>', at: 'r' },
    ],
    beats: [
      { say: '输入：RMSNorm 后的 [6, 4096]，要各乘三张权重', dur: 2.6, cam: 'qkv', op: { show: ['x_attn', 'W_q', 'W_k', 'W_v'] } },
      { say: '挑 Q 里的一个数：「春天」的第 1 个数。它只用到两串数：W_q 的第 1 行，和「春天」那一列', dur: 4, cam: 'dot', op: { dot: 'pick' } },
      { say: '把这两串数抽出来，一对一对排好：第 1 对、第 2 对……一共 4096 对（这里只摆出前 6 对和最后 1 对）', dur: 5, cam: 'dot', op: { dot: 'pull' } },
      { say: '每一对相乘', dur: 3.5, cam: 'dot', op: { dot: 'mul' } },
      { say: '4096 个乘积加起来，就是这个数', dur: 3.5, cam: 'dot', op: { dot: 'sum' } },
      { say: '放回 Q 里它自己的位置', dur: 2, cam: 'dot', op: { dot: 'place' } },
      { say: '其余的数一样：W_q 的每一行，和每个词的那一列做点积。一个词一列，8192 个数从上往下', dur: 9, cam: 'dot', op: { words: 'Q', ins: [['x_attn', 'col'], ['W_q', 'all']], trace: ['W_q', 'x_attn', 'Q', 'Q'] } },
      { say: 'K、V 一样算：各乘自己的权重', dur: 5, cam: 'qkv', op: { words: ['K', 'V'], ins: [['x_attn', 'col'], ['W_k', 'all'], ['W_v', 'all']], trace: ['W_k', 'x_attn', 'K', 'K'] } },
      { say: '回头看形状：输入每个词 4096 个数，画成竖着的一列，6 个词横着排；Q 也是每个词一列，8192 个数。所以 Q 写作 [6, 8192]：先写有几个词，再写每个词有几个数', dur: 7, cam: 'shape', op: { show: ['x_attn', 'W_q', 'Q'], shape: true } },
      { say: '同一个输入还要乘第 4 组权重，算输出门：先乘 W_g_a，压到 128 个数', dur: 3.5, cam: 'gate', op: { words: 'g_a', ins: [['x_attn', 'col'], ['W_g_a', 'all']] } },
      { say: '再乘 W_g_b 展开到 64 个头 × 128，每个数也是一次点积。先放着，注意力读出之后才用（第 15 段）', dur: 6, cam: 'gate', op: { words: 'gate', ins: [['g_a', 'col'], ['W_g_b', 'all']], trace: ['W_g_b', 'g_a', 'gate', '输出门'] } },
    ],
  },
  {
    n: 12, id: 's12', panel: 'kda', rows: ['attn-kda'],
    title: '因果短卷积，切成 64 个头', layer: 0,
    flow: ['Q / K / V 各 [6, 8192]', '每个通道 4 个抽头：本词和前 3 个词', 'SiLU', '切成各 [6, 64 头, 128]'],
    text: [
      'Q、K、V 算出来之后，先各过一个<b>因果短卷积</b>：每一个通道（Q、K、V 合起来 3 × 8192 = 24576 个）有自己的 4 个数（抽头），把本词和前 3 个词在这个通道上的值加权相加，再过 SiLU。',
      '"因果"是说只往前看、不看后面的词：第 1 个词前面没有词，就当成 0。这样每个词进记忆之前，已经带上了前 3 个词的一点信息。卷积不改形状。',
      '卷积完，每个词的 8192 个数按每 128 个一组切开，就是 <b>64 个头</b>：[6, 64 头, 128]。切开不做计算，只是分组；图上卷积后的块，64 个头一片一片往后叠。',
      '写成算式：花儿在第 c 个通道上的数 = SiLU(抽头₁ × 春天 + 抽头₂ × 来了 + 抽头₃ × 「，」 + 抽头₄ × 花儿)，这 4 个词都取第 c 个通道上的数；SiLU(x) = x × sigmoid(x)。所以卷积后的<b>每一个数</b>都是 4 对数相乘、相加，再过 SiLU。播放时先把「花儿」的第 1 个数完整算一遍（它前面 3 个词都在），再快进算完其余的。',
    ],
    more: '官方 <code>modeling_glm5_next.py</code>：conv1d 的输入、输出都是 24576 个通道，groups = 24576（每个通道单独一组），卷积核宽 4（配置里是 short_conv_kernel_size = 4，代码的字段名不同，配置类不在参考代码里，按名字对应），没有偏置（610–617 行）；前向 676–685 行，参考实现 396–416 行。Q、K、V 拼在一起过卷积，之后才按头切开（687 行起），所以图上三组各用自己那一段卷积核。',
    poses: { conv: { ids: ['Q', 'conv_q', 'Q_conv', 'K', 'K_conv', 'V', 'V_conv'], dir: [-.12, .55, 1], pad: 2 },
      convq: { ids: ['Q', 'conv_q', 'Q_conv'], dir: [-.15, .3, 1], pad: 1.5, shift: [-.3, 0] } },
    words: 'Q_conv',
    // the number acted out: channel R of word `word` (the 4th: its 3 words before are all there); the taps are rows
    // off … of the made-up conv1d [24576, 4] (Q's 8192 first, as the official conv takes Q, K, V together)
    conv: { w: 'conv_q', x: 'Q', out: 'Q_conv', src: ['conv1d', 0], k: 4, R: 0, word: 3, tag: 'Q 卷积后 · 花儿 · 第 1 个数' },
    labels: [
      { id: 'Q', html: '<b>Q</b> <i>[6, 8192]</i>', at: 'tl' }, { id: 'Q_conv', html: '<b>Q 卷积后，切成 64 头</b> <i>[6, 64 头, 128]</i>', at: 'r' },
      { id: 'K', html: '<b>K</b>', at: 'tl' }, { id: 'K_conv', html: '<b>K 卷积后</b>', at: 'r' },
      { id: 'V', html: '<b>V</b>', at: 'tl' }, { id: 'V_conv', html: '<b>V 卷积后</b>', at: 'r' },
      { id: 'conv_q', html: '<i>卷积核：每个通道 4 个数</i>', at: 'b' },
    ],
    beats: [
      { say: '挑一个数：「花儿」卷积后的第 1 个数。它只用到 Q 的第 1 个通道上，花儿和它前面 3 个词的 4 个数，和这个通道的 4 个抽头', dur: 4.5, cam: 'convq', op: { conv: 'pick' } },
      { say: '抽出来一对一对排好：抽头 1 × 春天，抽头 2 × 来了，抽头 3 × 「，」，抽头 4 × 花儿', dur: 4.5, cam: 'convq', op: { conv: 'pull' } },
      { say: '每一对相乘', dur: 3, cam: 'convq', op: { conv: 'mul' } },
      { say: '4 个乘积加起来，再过 SiLU（x × sigmoid(x)），就是这个数', dur: 4, cam: 'convq', op: { conv: 'sum' } },
      { say: '放回：卷积后第 1 个头的第 1 个数', dur: 2, cam: 'convq', op: { conv: 'place' } },
      { say: '其余的数一样：每个词、每个通道 = 本词和前 3 个词 × 这个通道的 4 个抽头，再 SiLU。第 1 个词前面没有词，缺的当成 0', dur: 8, cam: 'convq', op: { words: 'Q_conv', ins: [['Q', 'win', 4], ['conv_q', 'all']], trace: ['conv_q', 'Q', 'Q_conv', 'Q 卷积后'], by: 'conv' } },
      { say: 'K、V 一样，各用自己那一段卷积核', dur: 5, cam: 'conv', op: { words: ['K_conv', 'V_conv'], ins: [['K', 'win', 4], ['V', 'win', 4], ['conv_k', 'all'], ['conv_v', 'all']], trace: ['conv_k', 'K', 'K_conv', 'K 卷积后'], by: 'conv' } },
    ],
  },
  {
    n: 13, id: 's13', panel: 'kda', rows: ['attn-kda'],
    title: '门控 g 与 β', layer: 0,
    flow: ['RMSNorm 后 [6, 4096]', '衰减门 g [6, 64 头, 128]', 'β [6, 64]'],
    text: [
      'KDA 的记忆每读一个词要更新一次，更新时要知道两件事：旧的记忆留多少（<b>衰减门 g</b>），新的内容写多重（<b>β</b>）。两样都从同一个 RMSNorm 输出算出来（和 Q、K、V、输出门一样）。',
      '衰减门：先乘 W_f_a 压到 128 个数，再乘 W_f_b 展开到 64 个头 × 128，加上 dt_bias，乘 e^A_log（每个头一个数），过 sigmoid，再乘 −5。所以每个值都在 −5 到 0 之间；用的时候取 e^g，就是约 0.007 到 1 之间的"保留比例"——每个头、每个通道各不相同。',
      'β：乘 W_b [64, 4096]，每个头得 1 个数，过 sigmoid，在 0 到 1 之间。',
    ],
    more: '官方 <code>modeling_glm5_next.py</code>：<code>Glm5NextTextForgetGate</code>（306–330 行），g = 下限 × sigmoid(e^A_log × (f_a · W_f_b + dt_bias))，下限取 config 的 gate_lower_bound = −5（代码里的字段名是 linear_lower_bound，配置类不在参考代码里，按名字对应）；β：b_proj 再 sigmoid（620、699 行）。',
    poses: {
      fgate: { ids: ['W_f_a', 'f_a', 'W_f_b', 'g', 'dt_bias', 'A_log'], dir: [-.4, .45, 1], pad: 2, shift: [0, -.4] },
      bw: { ids: ['W_b', 'beta'], dir: [-.1, .6, 1], pad: 3, shift: [0, -.4] },
      fg: { ids: ['f_a', 'W_f_b', 'dt_bias'], dir: [-.15, .2, 1], pad: 2, band: ['W_f_b', .8, 1], shift: [0, -.5] },
      fgall: { ids: ['f_a', 'W_f_b', 'dt_bias', 'g'], dir: [-.15, .2, 1], pad: 2, shift: [0, .3] },
    },
    labels: [
      { id: 'W_f_a', html: '<b>W_f_a</b> <i>[128, 4096]</i>', at: 'tl' }, { id: 'f_a', html: '<b>衰减门 · 低秩</b> <i>[6, 128]</i>', at: 'b' },
      { id: 'g', html: '<b>衰减门 g</b> <i>[6, 64 头, 128]</i>', at: 'tr' }, { id: 'W_f_b', html: '<b>W_f_b</b> <i>[8192, 128]</i>', at: 'tl' },
      { id: 'x_attn', html: '<b>RMSNorm 后</b> <i>[6, 4096]</i>', at: 'l' },
      { id: 'W_b', html: '<b>W_b</b> <i>[64, 4096]</i>', at: 'tl' }, { id: 'beta', html: '<b>β</b> <i>[6, 64]</i>', at: 'r' },
    ],
    // the forget gate acted out: number R of word `word` of g (lb: the config's gate_lower_bound)
    // β acted out: head R of word `word`
    beta: { w: 'W_b', x: 'x_attn', out: 'beta', R: 0, word: 0, tag: 'β · 第 1 个头 · 春天' },
    fg: { w: 'W_f_b', x: 'f_a', out: 'g', bias: 'dt_bias', rate: 'A_log', lb: -5, R: 85, word: 0, tag: '衰减门 g · 第 1 个头 · 春天 · 第 86 个数' },
    beats: [
      { say: '衰减门：先乘 W_f_a，压到 128 个数', dur: 3.5, cam: 'fgate', op: { words: 'f_a', ins: [['x_attn', 'col'], ['W_f_a', 'all']] } },
      { say: '再展开到 64 个头。挑一个数：「春天」第 1 个头的第 86 个数。它用到春天压好的 128 个数、W_f_b 的第 86 行，和 dt_bias、A_log 各一个数', dur: 5, cam: 'fg', op: { fg: 'pick' } },
      { say: '把 128 个数和 W_f_b 第 86 行的 128 个数一对一对排好', dur: 4, cam: 'fg', op: { fg: 'pull' } },
      { say: '每一对相乘', dur: 2.5, cam: 'fg', op: { fg: 'mul' } },
      { say: '128 个乘积加起来；加 dt_bias，乘这个头的 e^A_log，过 sigmoid，再 × (−5)：落在 −5 到 0 之间。用的时候取 e^g：这个通道的旧记忆留下 28%', dur: 6.5, cam: 'fg', op: { fg: 'sum' } },
      { say: '放回 g 里它的位置', dur: 2, cam: 'fg', op: { fg: 'place' } },
      { say: '其余的数一样：一个头一个头往下，每个头里每个词的每个数', dur: 5, cam: 'fgall', op: { words: 'g', ins: [['f_a', 'col'], ['W_f_b', 'all'], ['dt_bias', 'all'], ['A_log', 'all']], trace: ['W_f_b', 'f_a', 'g', '衰减门 g'], by: 'fg' } },
      { say: 'β：挑「春天」第 1 个头的 β。它要用 RMSNorm 后春天的 4096 个数（在上面，第 10 段算的），和 W_b 的第 1 行', dur: 4.5, cam: 'bw', op: { beta: 'pick' } },
      { say: '春天的 4096 个数从上面下来，和 W_b 第 1 行的 4096 个数一对一对排好', dur: 4.5, cam: 'bw', op: { beta: 'pull' } },
      { say: '每一对相乘', dur: 2.5, cam: 'bw', op: { beta: 'mul' } },
      { say: '4096 个乘积加起来，再过 sigmoid：落在 0 到 1 之间，就是这个头写入的强度', dur: 4.5, cam: 'bw', op: { beta: 'sum' } },
      { say: '放进 β 里它的位置', dur: 2, cam: 'bw', op: { beta: 'place' } },
      { say: '其余的一样：每个词、64 个头各一个数', dur: 4, cam: 'bw', op: { words: 'beta', ins: [['x_attn', 'col'], ['W_b', 'all']], trace: ['W_b', 'x_attn', 'beta', 'β'], by: 'beta' } },
    ],
  },
  {
    n: 14, id: 's14', panel: 'kda', rows: ['attn-kda'],
    title: '状态更新与读出', layer: 0,
    flow: ['Q K V（卷积后）· g · β，逐词', '记忆 S [64, 128, 128]', '读出 [6, 64 头, 128]'],
    text: [
      'KDA 不像普通注意力那样，把每个词和前面所有词两两比一遍；它给每个头一个<b>记忆矩阵 S</b>（128 × 128），一个词一个词地往里写、从里面读。读完 6 个词，S 还是 128 × 128——这就是"线性"注意力：句子再长，记忆也不变大。',
      '每读一个词，每个头做四步：① <b>衰减</b>：S 的每一行乘 e^g，旧的记忆淡一点；② <b>对照</b>：拿这个词的 k 去问 S，看它现在记得的 v 是什么；③ <b>修正写入</b>：把"真正的 v − 记得的 v"乘 β，按 k 的方向写进 S；④ <b>读出</b>：拿 q 去问更新后的 S，得到这个词、这个头的 128 个数。',
      'q、k 先各自除以自己的长度（L2 归一化），q 再乘 1/√128。第 1 个词进来时 S 全是 0。读完最后一个词的 S 会存下来，生成下一个词时接着用（KV Cache 那一章会讲）。',
    ],
    more: '官方 <code>modeling_glm5_next.py</code>：<code>recurrent_kimi_delta_attention</code>（430–482 行）是一次读一个词的写法；整句一起算时用分块的 <code>chunk_kimi_delta_attention</code>，结果相同；调用在 703–724 行，use_qk_l2norm_in_kernel=True。图上的 S 画的是读完 6 个词之后的样子。',
    poses: { kda: { ids: ['Q_conv', 'K_conv', 'V_conv', 'g', 'beta', 'state', 'core_out'], dir: [-.3, .5, 1], pad: 3 },
      col: { ids: ['Q_conv', 'K_conv', 'V_conv', 'g', 'beta', 'state', 'core_out'], dir: [-.12, .12, 1], pad: 3, shift: [-.25, 0], narrowShift: [.72, 0] } },
    words: 'core_out',
    // the number acted out: number c of head `head` of word `word` (the 2nd: its S has the 1st word in it)
    kda: { out: 'core_out', word: 1, head: 0, c: 0, tag: '读出 · 第 1 个头 · 来了 · 第 1 个数' },
    labels: [
      { id: 'Q_conv', html: '<b>q</b>', at: 'r' }, { id: 'K_conv', html: '<b>k</b>', at: 'r' }, { id: 'V_conv', html: '<b>v</b>', at: 'r' },
      { id: 'g', html: '<b>g</b>', at: 'r' }, { id: 'beta', html: '<b>β</b>', at: 'l' },
      { id: 'state', html: '<b>记忆 S</b> <i>[64, 128, 128]</i>', at: 'l' }, { id: 'core_out', html: '<b>读出</b> <i>[6, 64 头, 128]</i>', at: 'r' },
    ],
    beats: [
      { say: '记忆 S：64 个头，每头 128 × 128，开头全是 0', dur: 3, cam: 'kda', op: { show: ['state'] } },
      { say: '挑一个数：「来了」第 1 个头读出的第 1 个数。这时 S 里已经写进了「春天」。它只用到第 1 个头 S 的第 1 列，和来了第 1 个头的 q、k、v、g、β', dur: 5, cam: 'col', op: { kda: 'pick' } },
      { say: '先改 S：这一列每个数乘 e^g（衰减），再和 k 一对一对相乘、相加，得到 S 现在记得的 v；δ =（真正的 v − 记得的）× β', dur: 10, cam: 'col', op: { kda: 'recall' } },
      { say: '修正写入：这一列每个数加上 k × δ。再读出：改好的这一列和 q 一对一对相乘、相加，就是这个数', dur: 10, cam: 'col', op: { kda: 'read' } },
      { say: '放回读出里它的位置', dur: 2.5, cam: 'col', op: { kda: 'place' } },
      { say: '其余的数一样：一个头一个头往下，每个头里一个词一个词地先改 S、再用 q 读', dur: 9, cam: 'col', op: { words: 'core_out', ins: [['Q_conv', 'col'], ['K_conv', 'col'], ['V_conv', 'col'], ['g', 'col'], ['beta', 'col']], trace: ['state', 'Q_conv', 'core_out', '读出'], by: 'kda' } },
    ],
  },
  {
    n: 15, id: 's15', panel: 'kda', rows: ['attn-kda'],
    title: '输出投影', layer: 0,
    flow: ['读出 [6, 64 头, 128]', '门控归一化', '× W_o [4096, 8192]', '注意力输出 [6, 4096]'],
    text: [
      '读出来的数先做<b>门控归一化</b>：每个头的 128 个数单独做 RMSNorm、乘 γ（128 个，64 个头共用），再逐个乘 sigmoid(输出门)——输出门决定每个通道放多少出去。',
      '然后 64 个头的 8192 个数排成一行，乘 <b>W_o</b> [4096, 8192]，合回 4096 个数。W_o 的输入边按头切成 64 段（图上横着排的 64 块），每段只接自己那个头。',
    ],
    more: '官方 <code>modeling_glm5_next.py</code>：o_norm 是 <code>Glm5NextTextRMSNormGated</code>（341–358 行；调用 624、732 行），ε = 10⁻⁵；o_proj（625、733 行），没有偏置。',
    poses: { out: { ids: ['core_out', 'o_normed', 'gamma_o', 'W_o', 'attn_out'], dir: [-.4, .4, 1], pad: 2 },
      gnorm: { ids: ['core_out', 'o_normed', 'gamma_o'], dir: [-.15, .2, 1], pad: 8, sideCard: true, narrowShift: [.7, 0] } },
    words: 'attn_out',
    labels: [
      { id: 'core_out', html: '<b>读出</b>', at: 'r' }, { id: 'o_normed', html: '<b>门控归一化后</b> <i>[6, 64 头, 128]</i>', at: 'r' },
      { id: 'W_o', html: '<b>W_o</b> <i>[4096, 8192]：64 段</i>', at: 'tl' }, { id: 'gate', html: '<b>输出门</b> <i>第 11 段算的</i>', at: 'r' }, { id: 'attn_out', html: '<b>注意力输出</b> <i>[6, 4096]</i>', at: 'r' },
    ],
    dot: { w: 'W_o', x: 'o_normed', out: 'attn_out', R: 0, word: 0, tag: '注意力输出 · 春天 · 第 1 个数' },
    // the gated norm acted out: head `head` of word `word` (eps: the config's rms_norm_eps, official 603)
    gn: { x: 'core_out', g: 'gamma_o', gate: 'gate', out: 'o_normed', word: 0, head: 0, eps: 1e-5, tag: '门控归一化 · 第 1 个头 · 春天' },
    beats: [
      { say: '门控归一化，挑「春天」的第 1 个头。它要用到输出门同一位置的数（第 11 段算好的，在上面）：先把这个头的 128 个取下来，每个过 sigmoid', dur: 6, cam: 'gnorm', op: { gn: 'gate' } },
      { say: '这个头读出的 128 个数，每个平方', dur: 4, cam: 'gnorm', op: { gn: 'square' } },
      { say: '求平均，加 ε 开根号：这个头的 rms', dur: 3.5, cam: 'gnorm', op: { gn: 'mean' } },
      { say: '每个数 ÷ rms × γ × sigmoid(输出门)', dur: 5, cam: 'gnorm', op: { gn: 'scale' } },
      { say: '放回：第 1 个头的 128 个数', dur: 3, cam: 'gnorm', op: { gn: 'place' } },
      { say: '其余的一样：每个词、每个头各算自己的 rms', dur: 5, cam: 'gnorm', op: { words: 'o_normed', ins: [['core_out', 'col'], ['gate', 'col'], ['gamma_o', 'all']], trace: ['gamma_o', 'core_out', 'o_normed', '门控归一化后'], by: 'gn' } },
      { say: '拿注意力输出的一个数看怎么算：W_o 的第 1 行和「春天」64 个头的 8192 个数，一对一对相乘再加起来', dur: 7, cam: 'out', op: { dot: 'all' } },
      { say: '其余的数一样：64 个头 × 128 个数 → 4096 个数', dur: 4, cam: 'out', op: { words: 'attn_out', ins: [['o_normed', 'col'], ['W_o', 'all']], trace: ['W_o', 'o_normed', 'attn_out', '注意力输出'] } },
    ],
  },
  {
    n: 16, id: 's16', panel: 'mhc', rows: ['write'],
    title: '写回四路残差', layer: 0,
    flow: ['注意力输出 [6, 4096]', '+ 旧 4 路 [6, 4 路, 4096]', '用 post、comb', '新 4 路 [6, 4 路, 4096]'],
    text: [
      '注意力的结果只有 1 份，要写回 4 路。用的是第 9 段算好、一直留着的另外两组系数：<b>post</b>（4 个）和 <b>comb</b>（4 × 4）。',
      '<b>新的第 s 路 = post_s × 注意力输出 + 旧的 4 路按 comb 第 s 列加权相加</b>。post 决定这次的结果往每一路放多少（0 到 2 之间）；comb 把旧的 4 路重新混一遍，它每行、每列加起来都约等于 1（Sinkhorn 归一化出来的），所以混来混去，4 路的总和大致不变。',
      '所以新 4 路里的<b>每一个数</b>都是 5 对数相乘再相加：post_s × 注意力输出在这个位置的数，加上旧 4 路在这个位置的 4 个数各乘 comb 第 s 列的 4 个数。旧 4 路和系数在层的最上面，注意力输出和新 4 路在下面。',
    ],
    more: '官方 <code>modeling_glm5_next.py</code> 解码层 1318–1320 行：post · 输出 + combᵀ @ 残差（残差就是本层输入）。',
    poses: {
      write: { ids: ['attn_out', 'residual_mid', 'W_o'], dir: [.32, .3, 1], pad: 3 },
    },
    words: 'residual_mid',
    // the number acted out: number R of stream s of word `word` of the new streams
    write: { w: 'coef_attn', x: 'residual_in', y: 'attn_out', out: 'residual_mid', s: 0, R: 0, word: 0, tag: '新的第 1 路 · 春天 · 第 1 个数' },
    labels: [
      { id: 'residual_in', html: '<b>旧的 4 路</b> <i>本层输入</i>', at: 'r' }, { id: 'coef_attn', html: '<b>post、comb</b> <i>在 24 个系数里</i>', at: 'tr' },
      { id: 'attn_out', html: '<b>注意力输出</b>', at: 'l' }, { id: 'residual_mid', html: '<b>新的 4 路</b> <i>[6, 4 路, 4096]</i>', at: 'r' },
    ],
    beats: [
      { say: '挑新的第 1 路里的一个数：「春天」的第 1 个数。它用到 5 对数：post₁ 和注意力输出的第 1 个数；comb 第 1 列的 4 个数和旧 4 路各自的第 1 个数。旧 4 路和系数都在上面（第 9 段）', dur: 5, cam: 'write', op: { write: 'pick' } },
      { say: '从上面取下来：comb 第 1 列的 4 个数和旧 4 路里春天各自的第 1 个数，排成 4 对；post₁ 和这里的注意力输出第 1 个数是第 5 对', dur: 5.5, cam: 'write', op: { write: 'pull' } },
      { say: '每一对相乘', dur: 3, cam: 'write', op: { write: 'mul' } },
      { say: '5 个乘积加起来，就是这个数', dur: 3.5, cam: 'write', op: { write: 'sum' } },
      { say: '放进新的 4 路：第 1 路、春天、第 1 个数', dur: 2.5, cam: 'write', op: { write: 'place' } },
      { say: '其余的数一样：每个词、每一路、每个位置，5 对相乘再相加', dur: 8, cam: 'write', op: { words: 'residual_mid', ins: [['attn_out', 'col'], ['residual_in', 'col'], ['coef_attn', 'col']], trace: ['coef_attn', 'residual_in', 'residual_mid', '新的 4 路'], by: 'write' } },
    ],
  },
  {
    n: 17, id: 's17', panel: 'mhc', rows: ['mhc2', 'norm2'],
    title: '再来一遍：四路合一 + 归一化', layer: 0,
    flow: ['[6, 4 路, 4096]', '24 个系数', '合成 1 路', 'RMSNorm', '[6, 4096]'],
    text: [
      '前馈半层的开头和注意力半层一样：用它自己的一套 fn、base、scale 算 24 个系数，按 pre 合成 1 路，再 RMSNorm（这次的 γ 是 post_attention_layernorm 的）。算法和第 9、10 段完全相同，这里连着走一遍。',
    ],
    more: '官方 <code>modeling_glm5_next.py</code> 解码层 1323、1325 行：ffn_hc、post_attention_layernorm。',
    poses: { mhc2: { ids: ['residual_mid', 'fn_ffn', 'coef_ffn', 'collapsed_ffn', 'x_ffn', 'gamma_ffn'], dir: [.32, .3, 1], pad: 2 },
      coef2: { ids: ['fn_ffn', 'scale_ffn', 'base_ffn', 'coef_ffn', 'residual_mid'], dir: [.1, .75, 1], pad: 2, shift: [0, -.35] },
      mix2: { ids: ['residual_mid', 'coef_ffn', 'collapsed_ffn'], dir: NEAR, pad: 2 },
      norm2: { ids: ['collapsed_ffn', 'x_ffn', 'gamma_ffn'], dir: NEAR, pad: 2 } },
    words: 'collapsed_ffn',
    coef: { w: 'fn_ffn', x: 'residual_mid', out: 'coef_ffn', scale: 'scale_ffn', base: 'base_ffn', R: 0, word: 0, eps: 1e-5, hcEps: 1e-6, tag: '24 个系数 · 春天 · pre₁' },
    mix: { w: 'coef_ffn', x: 'residual_mid', out: 'collapsed_ffn', R: 0, word: 0, tag: '合成 1 路 · 春天 · 第 1 个数' },
    norm: { x: 'collapsed_ffn', g: 'gamma_ffn', out: 'x_ffn', word: 0, eps: 1e-5, tag: 'RMSNorm · 春天' },
    labels: [
      { id: 'residual_mid', html: '<b>4 路</b> <i>注意力半层写回的</i>', at: 'r' }, { id: 'fn_ffn', html: '<b>fn</b>（前馈处）', at: 'l' }, { id: 'coef_ffn', html: '<b>24 个系数</b> <i>[6, 24]</i>', at: 'tr' },
      { id: 'collapsed_ffn', html: '<b>合成 1 路</b>', at: 'l' }, { id: 'x_ffn', html: '<b>RMSNorm 后</b> <i>[6, 4096]</i>', at: 'l' },
    ],
    beats: [
      { say: '24 个系数：「春天」的 pre₁ = 4 路连成的 16384 个数 ÷ rms，和 fn 第 1 行点积，× scale、+ base，过 sigmoid', dur: 7, cam: 'coef2', op: { coef: 'all' } },
      { say: '其余的系数一样', dur: 4, cam: 'coef2', op: { words: 'coef_ffn', ins: [['residual_mid', 'col'], ['fn_ffn', 'all'], ['scale_ffn', 'all'], ['base_ffn', 'all']], trace: ['fn_ffn', 'residual_mid', 'coef_ffn', '24 个系数'], by: 'coef' } },
      { say: '按 pre 合成 1 路：「春天」第 1 个数 = 4 路各自的第 1 个数 × 各自的 pre，再相加', dur: 6, cam: 'mix2', op: { mix: 'all' } },
      { say: '其余的数一样', dur: 4, cam: 'mix2', op: { words: 'collapsed_ffn', ins: [['residual_mid', 'col'], ['coef_ffn', 'col']], trace: ['coef_ffn', 'residual_mid', 'collapsed_ffn', '合成 1 路'], by: 'mix' } },
      { say: 'RMSNorm：「春天」的 4096 个数平方、平均、开根号得 rms；每个数 ÷ rms × γ', dur: 7, cam: 'norm2', op: { norm: 'all' } },
      { say: '其余 5 个词一样，各用自己的 rms', dur: 4, cam: 'norm2', op: { words: 'x_ffn', w0: 1, ins: [['collapsed_ffn', 'col'], ['gamma_ffn', 'all']], trace: ['gamma_ffn', 'collapsed_ffn', 'x_ffn', 'RMSNorm 后'], by: 'norm' } },
    ],
  },
  {
    n: 18, id: 's18', panel: 'dense', rows: ['ffn-dense'],
    title: '稠密前馈：升维', layer: 0,
    flow: ['[6, 4096]', '× W_gate、W_up（各 [12288, 4096]）', 'gate、up 各 [6, 12288]', 'SiLU(gate) × up'],
    text: [
      'L00–L02 的前馈是<b>稠密</b>的：所有词都用同一套权重。每个词的 4096 个数分别乘 W_gate 和 W_up（各 [12288, 4096]），变成两个 12288 维的向量——升到 3 倍宽。',
      '图上这两块转了个方向：一个词一行，12288 个数横着排，权重在它上面、和它一样宽。',
      '然后逐个相乘：<b>h = SiLU(gate) × up</b>。gate 过 SiLU 以后像一个开关（负得多的接近 0，正得多的接近原值），决定每个通道开多少；up 给内容。GLM-5.3-Flash 还先把 gate 截到不超过 10、up 截到 −10 到 10 之间（swiglu_limit = 10）。',
    ],
    more: '官方 <code>modeling_glm5_next.py</code>：<code>Glm5NextTextMLP</code>（87–105 行），gate_proj、up_proj、down_proj 都没有偏置；截断在 103–104 行。',
    poses: { up: { ids: ['x_ffn', 'W_gate', 'W_up', 'gate_ffn', 'up_ffn', 'h_ffn'], dir: [-.2, .35, 1], pad: 2 },
      glu: { ids: ['gate_ffn', 'up_ffn', 'h_ffn'], dir: [-.2, .35, 1], pad: 2 } },
    // SwiGLU acted out on a word (lim: config swiglu_limit)
    ew: { a: 'gate_ffn', b: 'up_ffn', out: 'h_ffn', word: 0, lim: 10, tag: 'SiLU(gate) × up · 春天' },
    labels: [
      { id: 'x_ffn', html: '<b>RMSNorm 后</b>', at: 'r' },
      { id: 'W_gate', html: '<b>W_gate</b> <i>[12288, 4096]</i>', at: 'tl' }, { id: 'W_up', html: '<b>W_up</b> <i>[12288, 4096]</i>', at: 'tl' },
      { id: 'gate_ffn', html: '<b>gate</b> <i>[6, 12288]</i>', at: 'r' }, { id: 'up_ffn', html: '<b>up</b> <i>[6, 12288]</i>', at: 'l' },
      { id: 'h_ffn', html: '<b>SiLU(gate) × up</b> <i>[6, 12288]</i>', at: 'r' },
    ],
    dot: { w: 'W_gate', x: 'x_ffn', out: 'gate_ffn', R: 0, word: 0, tag: 'gate · 春天 · 第 1 个数' },
    beats: [
      { say: '接上一步归一化输入，先认 gate、up 两组权重；它们各把一个词升到 12288 维', dur: 5, cam: 'up', op: { show: ['x_ffn','W_gate','W_up'] } },
      { say: '拿 gate 的一个数看怎么算：W_gate 的第 1 行（图上是竖着的一列）和「春天」的 4096 个数，一对一对相乘再加起来', dur: 7, cam: 'up', op: { dot: 'all' } },
      { say: 'gate 其余的数一样：每个词乘 W_gate → 一行 12288 个数', dur: 3.5, cam: 'up', op: { words: 'gate_ffn', ins: [['x_ffn', 'col'], ['W_gate', 'all']], trace: ['W_gate', 'x_ffn', 'gate_ffn', 'gate'] } },
      { say: 'up 一样：每个词乘 W_up → 一行 12288 个数', dur: 3.5, cam: 'up', op: { words: 'up_ffn', ins: [['x_ffn', 'col'], ['W_up', 'all']], trace: ['W_up', 'x_ffn', 'up_ffn', 'up'] } },
      { say: '逐个相乘：挑「春天」。它的第 1 个数只用 gate 和 up 各自的第 1 个数', dur: 3, cam: 'glu', op: { ew: 'pick' } },
      { say: '同一位置的两个数一对：SiLU(gate) × up（这里摆出前 6 对和最后 1 对）', dur: 5, cam: 'glu', op: { ew: 'pair' } },
      { say: '放回：春天的 12288 个数都这样一对一对算', dur: 3.5, cam: 'glu', op: { ew: 'place' } },
      { say: '其余 5 个词一样', dur: 4, cam: 'glu', op: { words: 'h_ffn', w0: 1, ins: [['gate_ffn', 'col'], ['up_ffn', 'col']], trace: ['gate_ffn', 'up_ffn', 'h_ffn', 'h'], by: 'ew' } },
    ],
  },
  {
    n: 19, id: 's19', panel: 'dense', rows: ['ffn-dense', 'write2'],
    title: '稠密前馈：降维并写回，出层', layer: 0,
    flow: ['h [6, 12288]', '× W_down [4096, 12288]', '[6, 4096]', '写回 4 路', '本层输出 [6, 4 路, 4096]'],
    text: [
      '再乘 <b>W_down</b> [4096, 12288]，从 12288 维降回 4096 维：一个词一行进去，一个词一列出来。',
      '最后和注意力半层一样写回 4 路：新的第 s 路 = post_s × 前馈输出 + 旧的 4 路按 comb 加权相加（这次的旧 4 路，是注意力半层写回的那一块）。得到本层输出 [6, 4 路, 4096]，交给 L01。',
      '一层走完。L01、L02 的结构和它一模一样（权重各自不同）；从 L03 起前馈换成 MoE（第四、五部分）。',
    ],
    more: '官方 <code>modeling_glm5_next.py</code>：down_proj（95、105 行）；解码层 1327–1329 行写回。',
    poses: {
      down: { ids: ['h_ffn', 'W_down', 'ffn_out'], dir: [-.2, .35, 1], pad: 2 },
      write: { ids: ['W_down', 'ffn_out', 'residual_out'], dir: [.32, .3, 1], pad: 3 },
    },
    words: 'ffn_out',
    write: { w: 'coef_ffn', x: 'residual_mid', y: 'ffn_out', out: 'residual_out', s: 0, R: 0, word: 0, tag: '本层输出第 1 路 · 春天 · 第 1 个数' },
    labels: [
      { id: 'h_ffn', html: '<b>h</b> <i>[6, 12288]</i>', at: 'r' }, { id: 'W_down', html: '<b>W_down</b> <i>[4096, 12288]</i>', at: 'l' },
      { id: 'ffn_out', html: '<b>前馈输出</b> <i>[6, 4096]</i>', at: 'b' }, { id: 'residual_out', html: '<b>本层输出</b> <i>[6, 4 路, 4096] → L01</i>', at: 'r' },
      { id: 'residual_mid', html: '<b>旧的 4 路</b> <i>注意力半层写回的</i>', at: 'r' }, { id: 'coef_ffn', html: '<b>post、comb</b> <i>在前馈处的 24 个系数里</i>', at: 'tr' },
    ],
    dot: { w: 'W_down', x: 'h_ffn', out: 'ffn_out', R: 0, word: 0, tag: '前馈输出 · 春天 · 第 1 个数' },
    beats: [
      { say: '拿前馈输出的一个数看怎么算：W_down 的第 1 行和「春天」那一行 12288 个数，一对一对相乘再加起来', dur: 7, cam: 'down', op: { dot: 'all' } },
      { say: '其余的数一样：每个词 12288 个数乘 W_down → 4096 个数', dur: 3.5, cam: 'down', op: { words: 'ffn_out', ins: [['h_ffn', 'col'], ['W_down', 'all']], trace: ['W_down', 'h_ffn', 'ffn_out', '前馈输出'] } },
      { say: '写回 4 路，和第 16 段一样：本层输出第 1 路「春天」的第 1 个数用 5 对数——post₁ × 前馈输出，comb × 旧 4 路（注意力半层写回的那一块）', dur: 3, cam: 'write', op: { write: 'pick' } },
      { say: '从上面取下来 comb × 旧 4 路那 4 对；post₁ × 前馈输出的第 1 个数是第 5 对', dur: 4, cam: 'write', op: { write: 'pull' } },
      { say: '相乘', dur: 2, cam: 'write', op: { write: 'mul' } },
      { say: '相加', dur: 2.5, cam: 'write', op: { write: 'sum' } },
      { say: '放进本层输出', dur: 2, cam: 'write', op: { write: 'place' } },
      { say: '其余的数一样', dur: 4, cam: 'write', op: { words: 'residual_out', ins: [['ffn_out', 'col'], ['residual_mid', 'col'], ['coef_ffn', 'col']], trace: ['coef_ffn', 'residual_mid', 'residual_out', '本层输出'], by: 'write' } },
      { say: '本层输出 [6, 4 路, 4096]，交给 L01', dur: 2.5, cam: 'write', op: { show: ['residual_out'] } },
    ],
  },
  {
    n: 20, id: 's20', panel: 'mhc', rows: ['mhc'],
    title: '认识 KDA + MoE 层：从四路输入开始', layer: 4,
    incoming: ['residual_in'],
    flow: ['L03 送来的 4 路 [6, 4, 4096]', 'fn [24, 16384] → 24 个系数', 'pre 加权合成 [6, 4096]', '第 21 段继续'],
    text: [
      '这一段先把KDA + MoE 层的入口讲明白：注意力一次只接收一路，所以先用 mHC 把 4 路合成 1 路。<b>fn [24, 16384]</b> 读取一个词四路拼起来的 16384 个数，产生 pre、post、comb 共 24 个系数，再用 pre 合成一路。这里直接接收上一段 L03 算出的四路，不另造输入。',
      '前面已依次算完 L00–L03，现在沿主干进入 <b>L04</b>。它直接读取 L03 输出的每词四路；注意力使用已讲过的 KDA，前馈使用刚讲过的 MoE。',
      '这是第 4 层（L04）。上半层和 L00 一模一样：合成 1 路 → RMSNorm → KDA 线性注意力 → 写回 4 路。变的只有下半层：稠密前馈换成了 <b>MoE</b>（Mixture of Experts，混合专家）。',
      'L00 的稠密前馈只有一套权重，每个词都过它。MoE 准备了 <b>288 个专家</b>（expert），每个专家都是一个小前馈；每个词只挑其中 <b>8 个</b>来算，另外还有 <b>1 个共享专家</b>（shared expert），所有词都过。所以权重总量大得多，但每个词实际只用到一小部分。',
      '下半层的顺序是：先给 288 个专家打分（router），每个词挑分数最高的 8 个；这 8 个专家各算一遍，按各自的权重加起来；再加上共享专家的结果，写回 4 路。',
      '45 层里，L00–L02 是第一种层；L03、L07 … L43 这 11 层的注意力换成了稀疏注意力；剩下的 31 层都长这一样。按 ▶ 先看入口：认输入和权重，再把一个系数、一个合成结果完整算出来。后面的组件交给第 21、22 段。',
    ],
    more: '官方 <code>modeling_glm5_next.py</code>：解码层（1282–1331 行）和 L00 相同，只是 mlp 换成 <code>Glm5NextTextMoE</code>（187–209 行）：打分和挑选在 <code>Glm5NextTextTopkRouter</code>（146–185 行），288 个专家在 <code>Glm5NextTextExperts</code>（109–144 行），共享专家是普通的 <code>Glm5NextTextMLP</code>。哪层用 MoE 看配置的 <code>mlp_layer_types</code>（只有 0–2 是 dense）。',
    coef: { w: 'fn_attn', x: 'residual_in', out: 'coef_attn', scale: 'scale_attn', base: 'base_attn', R: 0, word: 0, eps: 1e-5, hcEps: 1e-6, tag: '24 个系数 · 春天 · pre₁' },
    mix: { w: 'coef_attn', x: 'residual_in', out: 'collapsed_attn', R: 0, word: 0, tag: '合成 1 路 · 春天 · 第 1 个数' },
    poses: {
      entry: { ids: ['fn_attn', 'scale_attn', 'base_attn', 'coef_attn'], dir: [.1, .75, 1], pad: 3, sideCard: true, narrowShift: [.6, -.65] },
      mix: { ids: ['coef_attn', 'collapsed_attn'], dir: NEAR, pad: 3, sideCard: true, shift: [.35, 0], narrowShift: [.6, -.65] },
    },
    labels: [
      { id: 'fn_attn', html: '<b>fn</b> <i>[24, 16384]</i>', at: 'b' },
      { id: 'coef_attn', html: '<b>24 个系数</b> <i>[6, 24]</i>', at: 'b' },
      { id: 'collapsed_attn', html: '<b>合成 1 路</b> <i>[6, 4096]</i>', at: 'r' },
    ],
    beats: [
      { say: '先认输入：L03 送来 6 个词，每词 4 路、每路 4096 个数。上一层的块在画面外，算例中的数从上沿送入', dur: 5, cam: 'entry', op: { show: ['fn_attn'] } },
      { say: 'fn 的一行读取一个词的四路；24 行算出 24 个系数，决定怎样读出和写回', dur: 6, cam: 'entry', op: { show: ['fn_attn', 'scale_attn', 'base_attn'] } },
      { say: '先算 24 个系数。挑一个：「春天」的 pre₁。它用到春天 4 路的全部 16384 个数、fn 的第 1 行，和 scale、base 各一个数', dur: 5, cam: 'entry', op: { coef: 'pick' } },
      { say: '春天的 4 路连成 16384 个数，先除以它们的均方根；再和 fn 第 1 行的 16384 个数一对一对排好', dur: 5, cam: 'entry', op: { coef: 'pull' } },
      { say: '每一对相乘', dur: 3, cam: 'entry', op: { coef: 'mul' } },
      { say: '16384 个乘积加起来；× scale、+ base，再过 sigmoid，就是 pre₁', dur: 5, cam: 'entry', op: { coef: 'sum' } },
      { say: '放进 24 个系数里它自己的位置', dur: 2, cam: 'entry', op: { coef: 'place' } },
      { say: '其余系数按三组各自的规则算好；现在只用 pre，post 和 comb 留到写回', dur: 7, cam: 'entry', op: { words: 'coef_attn', ins: [['residual_in', 'col'], ['fn_attn', 'all'], ['scale_attn', 'all'], ['base_attn', 'all']], trace: ['fn_attn', 'residual_in', 'coef_attn', '24 个系数'], by: 'coef' } },
      { say: '挑合成 1 路里的一个数：「春天」的第 1 个数。它只用到春天 4 路里各自的第 1 个数，和春天的 4 个 pre', dur: 4, cam: 'mix', op: { mix: 'pick' } },
      { say: '把它们抽出来，一对一对排好：第 1 路的数和 pre₁，第 2 路的数和 pre₂……一共 4 对', dur: 4.5, cam: 'mix', op: { mix: 'pull' } },
      { say: '每一对相乘', dur: 3, cam: 'mix', op: { mix: 'mul' } },
      { say: '4 个乘积加起来，就是这个数', dur: 3, cam: 'mix', op: { mix: 'sum' } },
      { say: '放回合成 1 路里它自己的位置', dur: 2, cam: 'mix', op: { mix: 'place' } },
      { say: '其余的数一样：每个词、每个位置，4 路的数各乘这个词的 pre，再相加', dur: 7, cam: 'mix', op: { words: 'collapsed_attn', ins: [['residual_in', 'col'], ['coef_attn', 'col']], trace: ['coef_attn', 'residual_in', 'collapsed_attn', '合成 1 路'], by: 'mix' } },
      { say: '一路输入已就位。第 21 段接着算注意力，第 22 段再进入 MoE 前馈', dur: 5, cam: 'mix', op: { show: ['collapsed_attn'] } },
    ],
  },
  {
    "n": 21,
    "id": "s21",
    "panel": "kda",
    "rows": ["norm", "attn-kda", "write"],
    "title": "连续走过：注意力半层",
    "layer": 4,
    "flow": ["第 20 段合成的 1 路 [6, 4096]", "RMSNorm [6, 4096]", "KDA 线性注意力", "写回 4 路 [6, 4 路, 4096]"],
    "text": [
      "接住第 20 段合成好的 <b>[6, 4096]</b>，这一段把 L04 的注意力半层连续算完。算法和第 10–16 段一样，但这里用 L04 自己的示例权重与当前输入；每步先指出输入、权重和用途，再沿线取数、计算、写回。",
      "先做 <b>RMSNorm</b>：每个词的 4096 个数平方、求平均、开根号，再逐个除以 rms、乘 γ。接着同一份输入交给输出门和 Q、K、V 的投影；输出门先存着，读出以后再用。每个投影输出数都是一行权重与输入的点积。",
      "Q、K、V 各有 8192 个数，先做<b>因果短卷积</b>：同一通道的本词和前 3 个词，乘 4 个抽头、求和、过 SiLU；缺的词补 0。随后每 128 个数分成一组，共 64 个头，分组不改变数值。",
      "再算 <b>g 和 β</b>：g 控制旧记忆保留多少，β 控制新内容写入多少。KDA 对每个词、每个头依次做衰减、回忆、修正写入、读出。播放用第二个词「来了」举例，此时记忆里已经有「春天」，能看清新旧内容怎样结合。",
      "读出先按每头 128 个数做<b>门控归一化</b>，再乘前面保存的 sigmoid(输出门)。64 个头合计 8192 个数，经 W_o 投影回 4096；最后使用第 20 段保留的 post、comb，把这一份注意力输出和旧 4 路合成新的 <b>[6, 4, 4096]</b>。",
      "第 22 段直接读取这里算出的新 4 路，再进入路由与专家。20–25 是同一份连续的 L04 局部算例；输入和权重是编造的教学数据，中间结果按公式计算，不代表真实训练权重，本层输入已由 L00–L03 连续计算得到。",
    ],
    "more": "官方 <code>modeling_glm5_next.py</code>：解码层 1296–1310 行；KDA 在 <code>Glm5NextTextLinearAttention</code>（586–736 行）。每一步的出处见第 9–16 段。",
    poses: {
      "norm": {"ids": ["collapsed_attn", "x_attn", "gamma_attn"], "dir": [0.32, 0.3, 1], "pad": 2, "sideCard": true, "narrowShift": [0.7, 0]},
      "gate": {"ids": ["W_g_a", "g_a", "W_g_b", "gate"], "dir": [-0.3, 0.35, 1], "pad": 3, "sideCard": true, "narrowShift": [0.7, 0]},
      "qkv": {"ids": ["W_q", "Q", "W_k", "K", "W_v", "V"], "dir": [-0.3, 0.35, 1], "pad": 3, "sideCard": true, "narrowShift": [0.7, 0]},
      "conv": {"ids": ["Q", "conv_q", "Q_conv", "K", "K_conv", "V", "V_conv"], "dir": [-0.12, 0.55, 1], "pad": 2, "sideCard": true, "narrowShift": [0.7, 0]},
      "fgate": {"ids": ["W_f_a", "f_a", "W_f_b", "g", "dt_bias", "A_log"], "dir": [-0.4, 0.45, 1], "pad": 2, "sideCard": true, "narrowShift": [0.7, 0]},
      "bw": {"ids": ["W_b", "beta"], "dir": [-0.1, 0.6, 1], "pad": 3, "sideCard": true, "narrowShift": [0.7, 0]},
      "kda": {"ids": ["state", "core_out"], "dir": [-0.3, 0.5, 1], "pad": 3, "sideCard": true, "autoCard": true, "shift": [0.35, 0], "narrowShift": [0.7, 0]},
      "gnorm": {"ids": ["core_out", "o_normed", "gamma_o"], "dir": [-0.15, 0.2, 1], "pad": 6, "sideCard": true, "narrowShift": [0.7, 0]},
      "out": {"ids": ["o_normed", "W_o", "attn_out"], "dir": [-0.4, 0.4, 1], "pad": 2, "sideCard": true, "narrowShift": [0.7, 0]},
      "write": {"ids": ["attn_out", "residual_mid", "W_o"], "dir": [0.32, 0.3, 1], "pad": 3, "sideCard": true, "narrowShift": [0.7, 0]},
    },
    "labels": [
      {"id": "coef_attn", "html": "<b>24 个系数</b><br><i>[6, 24]</i>", "at": "tr"},
      {"id": "collapsed_attn", "html": "<b>合成 1 路</b><br><i>[6, 4096]</i>", "at": "r"},
      {"id": "x_attn", "html": "<b>RMSNorm 后</b><br><i>[6, 4096]</i>", "at": "l"},
      {"id": "gate", "html": "<b>输出门</b><br><i>[6, 64 头, 128]</i>", "at": "b"},
      {"id": "Q", "html": "<b>Q</b><br><i>[6, 8192]</i>", "at": "b"},
      {"id": "K", "html": "<b>K</b>", "at": "tl"},
      {"id": "V", "html": "<b>V</b>", "at": "tl"},
      {"id": "Q_conv", "html": "<b>q、k、v</b><br><i>各 [6, 64 头, 128]</i>", "at": "r"},
      {"id": "g", "html": "<b>衰减门 g</b><br><i>[6, 64 头, 128]</i>", "at": "tr"},
      {"id": "beta", "html": "<b>β</b><br><i>[6, 64]</i>", "at": "r"},
      {"id": "state", "html": "<b>记忆 S</b><br><i>[64, 128, 128]</i>", "at": "b"},
      {"id": "core_out", "html": "<b>读出</b><br><i>[6, 64 头, 128]</i>", "at": "b"},
      {"id": "o_normed", "html": "<b>门控归一化后</b><br><i>[6, 64 头, 128]</i>", "at": "b"},
      {"id": "attn_out", "html": "<b>注意力输出</b><br><i>[6, 4096]</i>", "at": "b"},
      {"id": "residual_mid", "html": "<b>新的 4 路</b><br><i>[6, 4 路, 4096]</i>", "at": "b"},
      {"id": "gamma_attn", "html": "<b>γ</b><br><i>[4096]</i>", "at": "l"},
      {"id": "W_q", "html": "<b>W_q</b><br><i>[8192, 4096]</i>", "at": "tl"},
      {"id": "W_k", "html": "<b>W_k</b>", "at": "tl"},
      {"id": "W_v", "html": "<b>W_v</b>", "at": "tl"},
      {"id": "W_g_a", "html": "<b>W_g_a</b><br><i>[128, 4096]</i>", "at": "tl"},
      {"id": "g_a", "html": "<b>输出门 · 低秩</b><br><i>[6, 128]</i>", "at": "b"},
      {"id": "W_g_b", "html": "<b>W_g_b</b><br><i>[8192, 128]</i>", "at": "tl"},
      {"id": "K_conv", "html": "<b>K 卷积后</b>", "at": "r"},
      {"id": "V_conv", "html": "<b>V 卷积后</b>", "at": "r"},
      {"id": "conv_q", "html": "<i>卷积核：每个通道 4 个数</i>", "at": "b"},
      {"id": "W_f_a", "html": "<b>W_f_a</b><br><i>[128, 4096]</i>", "at": "tl"},
      {"id": "f_a", "html": "<b>衰减门 · 低秩</b><br><i>[6, 128]</i>", "at": "b"},
      {"id": "W_f_b", "html": "<b>W_f_b</b><br><i>[8192, 128]</i>", "at": "tl"},
      {"id": "W_b", "html": "<b>W_b</b><br><i>[64, 4096]</i>", "at": "tl"},
      {"id": "W_o", "html": "<b>W_o</b><br><i>[4096, 8192]：64 段</i>", "at": "tl"},
    ],
    "beats": [
      {"say": "接第 20 段：合成的一路是输入，γ 是本层权重；先统一每个词的尺度", "dur": 3, "cam": "norm", "op": {"show": ["collapsed_attn", "gamma_attn"]}},
      {"say": "挑一个词：「春天」。RMSNorm 只看这个词自己的 4096 个数", "dur": 3.5, "cam": "norm", "op": {"norm": "pick"}},
      {"say": "每个数先平方（这里只摆出前 6 个和最后 1 个）", "dur": 5, "cam": "norm", "op": {"norm": "square"}},
      {"say": "4096 个平方求平均，再开根号：这个词的均方根 rms，只有 1 个数", "dur": 4.5, "cam": "norm", "op": {"norm": "mean"}},
      {"say": "每个数除以 rms，再乘 γ 里同一位置的数", "dur": 5, "cam": "norm", "op": {"norm": "scale"}},
      {"say": "放回去：这个词的 4096 个数都这样算，共用同一个 rms，各乘自己的 γ", "dur": 4, "cam": "norm", "op": {"norm": "place"}},
      {"say": "其余 5 个词一样：各算自己的 rms，再逐个除以它、乘 γ", "dur": 8, "cam": "norm", "op": {"words": "x_attn", "w0": 1, "ins": [["collapsed_attn", "col"], ["gamma_attn", "all"]], "trace": ["gamma_attn", "collapsed_attn", "x_attn", "RMSNorm 后"], "by": "norm"}},
      {"say": "先算输出门：同一份输入经过 W_g_a、W_g_b，控制稍后的注意力读出", "dur": 3, "cam": "gate", "op": {"show": ["x_attn", "W_g_a", "W_g_b"]}},
      {"say": "输出门低秩：4096 对数相乘求和，得到 128 个数", "dur": 4, "cam": "gate", "op": {"words": "g_a", "ins": [["x_attn", "col"], ["W_g_a", "all"]], "trace": ["W_g_a", "x_attn", "g_a", "输出门低秩"]}},
      {"say": "输出门：128 对数相乘求和，展开到 64 头 × 128，先保留", "dur": 4, "cam": "gate", "op": {"words": "gate", "ins": [["g_a", "col"], ["W_g_b", "all"]], "trace": ["W_g_b", "g_a", "gate", "输出门"]}},
      {"say": "Q、K、V：同一份归一化输入分别乘三套权重，用来查询、对照和写入内容", "dur": 3, "cam": "qkv", "op": {"show": ["x_attn", "W_q", "W_k", "W_v"]}},
      {"say": "挑 Q 里的一个数：「春天」的第 1 个数。它只用到两串数：W_q 的第 1 行，和「春天」那一列", "dur": 4, "cam": "qkv", "op": {"dot": "pick"}},
      {"say": "把这两串数抽出来，一对一对排好：第 1 对、第 2 对……一共 4096 对（这里只摆出前 6 对和最后 1 对）", "dur": 5, "cam": "qkv", "op": {"dot": "pull"}},
      {"say": "每一对相乘", "dur": 3.5, "cam": "qkv", "op": {"dot": "mul"}},
      {"say": "4096 个乘积加起来，就是这个数", "dur": 3.5, "cam": "qkv", "op": {"dot": "sum"}},
      {"say": "放回 Q 里它自己的位置", "dur": 2, "cam": "qkv", "op": {"dot": "place"}},
      {"say": "Q：各个位置按各自的权重逐数计算", "dur": 4, "cam": "qkv", "op": {"words": "Q", "ins": [["x_attn", "col"], ["W_q", "all"]], "trace": ["W_q", "x_attn", "Q", "Q"]}},
      {"say": "K：各个位置按各自的权重逐数计算", "dur": 4, "cam": "qkv", "op": {"words": "K", "ins": [["x_attn", "col"], ["W_k", "all"]], "trace": ["W_k", "x_attn", "K", "K"]}},
      {"say": "V：各个位置按各自的权重逐数计算", "dur": 4, "cam": "qkv", "op": {"words": "V", "ins": [["x_attn", "col"], ["W_v", "all"]], "trace": ["W_v", "x_attn", "V", "V"]}},
      {"say": "短卷积：每个通道读本词和前 3 个词，配上自己的 4 个抽头", "dur": 3, "cam": "conv", "op": {"show": ["Q", "conv_q", "K", "conv_k", "V", "conv_v"]}},
      {"say": "用花儿的一个通道演示：沿线取 4 对数，相乘、求和、过 SiLU，再写回", "dur": 9, "cam": "conv", "op": {"conv": "all"}},
      {"say": "Q 卷积：逐通道完成；前面缺词补 0，再按 128 个数分为 64 头", "dur": 4, "cam": "conv", "op": {"words": "Q_conv", "ins": [["Q", "win", 4], ["conv_q", "all"]], "trace": ["conv_q", "Q", "Q_conv", "Q 卷积"], "by": "conv"}},
      {"say": "K 卷积：逐通道完成；前面缺词补 0，再按 128 个数分为 64 头", "dur": 4, "cam": "conv", "op": {"words": "K_conv", "ins": [["K", "win", 4], ["conv_k", "all"]], "trace": ["conv_k", "K", "K_conv", "K 卷积"], "by": "conv"}},
      {"say": "V 卷积：逐通道完成；前面缺词补 0，再按 128 个数分为 64 头", "dur": 4, "cam": "conv", "op": {"words": "V_conv", "ins": [["V", "win", 4], ["conv_v", "all"]], "trace": ["conv_v", "V", "V_conv", "V 卷积"], "by": "conv"}},
      {"say": "现在从同一份输入算衰减门 g，决定每个头、每个通道保留多少旧记忆", "dur": 5, "cam": "fgate", "op": {"show": ["W_f_a", "W_f_b", "dt_bias", "A_log"]}},
      {"say": "衰减门低秩：从上方取本词输入，与 W_f_a 点积", "dur": 4, "cam": "fgate", "op": {"words": "f_a", "ins": [["x_attn", "col"], ["W_f_a", "all"]], "trace": ["W_f_a", "x_attn", "f_a", "衰减门低秩"]}},
      {"say": "演示一个 g：128 对相乘求和，再做偏置和门控变换，沿线写回", "dur": 10, "cam": "fgate", "op": {"fg": "all"}},
      {"say": "衰减门 g：每个词、每个头的其他通道也这样计算", "dur": 4, "cam": "fgate", "op": {"words": "g", "ins": [["f_a", "col"], ["W_f_b", "all"], ["dt_bias", "all"], ["A_log", "all"]], "trace": ["W_f_b", "f_a", "g", "衰减门 g"], "by": "fg"}},
      {"say": "β：本词 4096 个输入与 W_b 对应行点积，再过 sigmoid，决定新内容写多重", "dur": 3, "cam": "bw", "op": {"show": ["W_b", "x_attn"]}},
      {"say": "沿线取数、相乘求和、过 sigmoid，再写入春天第 1 个头的 β", "dur": 9, "cam": "bw", "op": {"beta": "all"}},
      {"say": "β：其余词、其余头逐个算完", "dur": 4, "cam": "bw", "op": {"words": "beta", "ins": [["x_attn", "col"], ["W_b", "all"]], "trace": ["W_b", "x_attn", "beta", "β"], "by": "beta"}},
      {"say": "KDA：q、k、v、g、β 一起更新记忆 S，再从更新后的 S 读出", "dur": 3, "cam": "kda", "op": {"show": ["Q_conv", "K_conv", "V_conv", "g", "beta", "state"]}},
      {"say": "看「来了」的第一个读出数：记忆里已有「春天」，先更新这一列，再用 q 读出", "dur": 6, "cam": "kda", "op": {"kda": "pick"}},
      {"say": "先改 S：这一列每个数乘 e^g（衰减），再和 k 一对一对相乘、相加，得到 S 现在记得的 v；δ =（真正的 v − 记得的）× β", "dur": 10, "cam": "kda", "op": {"kda": "recall"}},
      {"say": "修正写入：这一列每个数加上 k × δ。再读出：改好的这一列和 q 一对一对相乘、相加，就是这个数", "dur": 10, "cam": "kda", "op": {"kda": "read"}},
      {"say": "放回读出里它的位置", "dur": 2.5, "cam": "kda", "op": {"kda": "place"}},
      {"say": "其余的数一样：一个头一个头往下，每个头里一个词一个词地先改 S、再用 q 读", "dur": 9, "cam": "kda", "op": {"words": "core_out", "ins": [["Q_conv", "col"], ["K_conv", "col"], ["V_conv", "col"], ["g", "col"], ["beta", "col"]], "trace": ["state", "Q_conv", "core_out", "读出"], "by": "kda"}},
      {"say": "门控归一化：读出除以本头 rms、乘 γ，再乘 sigmoid(输出门)", "dur": 5, "cam": "gnorm", "op": {"show": ["core_out", "gamma_o", "gate"]}},
      {"say": "门控归一化，挑「春天」的第 1 个头。它要用到输出门同一位置的数（本段前面算好的，在上面）：先把这个头的 128 个取下来，每个过 sigmoid", "dur": 6, "cam": "gnorm", "op": {"gn": "gate"}},
      {"say": "这个头读出的 128 个数，每个平方", "dur": 4, "cam": "gnorm", "op": {"gn": "square"}},
      {"say": "求平均，加 ε 开根号：这个头的 rms", "dur": 3.5, "cam": "gnorm", "op": {"gn": "mean"}},
      {"say": "每个数 ÷ rms × γ × sigmoid(输出门)", "dur": 5, "cam": "gnorm", "op": {"gn": "scale"}},
      {"say": "放回：第 1 个头的 128 个数", "dur": 3, "cam": "gnorm", "op": {"gn": "place"}},
      {"say": "其余的一样：每个词、每个头各算自己的 rms", "dur": 5, "cam": "gnorm", "op": {"words": "o_normed", "ins": [["core_out", "col"], ["gate", "col"], ["gamma_o", "all"]], "trace": ["gamma_o", "core_out", "o_normed", "门控归一化后"], "by": "gn"}},
      {"say": "输出投影：64 个头共 8192 个数，W_o 把它们合回 4096 个", "dur": 3, "cam": "out", "op": {"show": ["o_normed", "W_o"]}},
      {"say": "沿线取 8192 对数，相乘求和，写进注意力输出的一个位置", "dur": 9, "cam": "out", "op": {"dot": "all"}, "dot": {"w": "W_o", "x": "o_normed", "out": "attn_out", "R": 0, "word": 0, "tag": "注意力输出 · 春天 · 第 1 个数"}},
      {"say": "注意力输出：其余行也做完整点积并写回", "dur": 4, "cam": "out", "op": {"words": "attn_out", "ins": [["o_normed", "col"], ["W_o", "all"]], "trace": ["W_o", "o_normed", "attn_out", "注意力输出"]}},
      {"say": "写回四路：读取第 20 段的 post、comb 和旧四路，与刚算好的注意力输出合成", "dur": 3, "cam": "write", "op": {"show": ["attn_out", "coef_attn", "residual_in"]}},
      {"say": "演示新第 1 路的第 1 个数：post × 输出，加上 comb 对旧四路的 4 个乘积，沿箭头放回", "dur": 10, "cam": "write", "op": {"write": "all"}},
      {"say": "新的四路：逐词、逐路完成；第 22 段直接读取这份结果", "dur": 4, "cam": "write", "op": {"words": "residual_mid", "ins": [["attn_out", "col"], ["residual_in", "col"], ["coef_attn", "col"]], "trace": ["coef_attn", "residual_in", "residual_mid", "新的四路"], "by": "write"}},
    ],
    "norm": {"x": "collapsed_attn", "g": "gamma_attn", "out": "x_attn", "word": 0, "eps": 1e-05, "tag": "RMSNorm · 春天"},
    "dot": {"w": "W_q", "x": "x_attn", "out": "Q", "R": 0, "word": 0, "tag": "Q · 春天 · 第 1 个数"},
    "conv": {"w": "conv_q", "x": "Q", "out": "Q_conv", "src": ["conv1d", 0], "k": 4, "R": 0, "word": 3, "tag": "Q 卷积后 · 花儿 · 第 1 个数"},
    "fg": {"w": "W_f_b", "x": "f_a", "out": "g", "bias": "dt_bias", "rate": "A_log", "lb": -5, "R": 85, "word": 0, "tag": "衰减门 g · 第 1 个头 · 春天 · 第 86 个数"},
    "beta": {"w": "W_b", "x": "x_attn", "out": "beta", "R": 0, "word": 0, "tag": "β · 第 1 个头 · 春天"},
    "kda": {"out": "core_out", "word": 1, "head": 0, "c": 0, "tag": "读出 · 第 1 个头 · 来了 · 第 1 个数"},
    "gn": {"x": "core_out", "g": "gamma_o", "gate": "gate", "out": "o_normed", "word": 0, "head": 0, "eps": 1e-05, "tag": "门控归一化 · 第 1 个头 · 春天"},
    "write": {"w": "coef_attn", "x": "residual_in", "y": "attn_out", "out": "residual_mid", "s": 0, "R": 0, "word": 0, "tag": "新的第 1 路 · 春天 · 第 1 个数"},
    "focusLabels": true,
  },
  {
    n: 22, id: 's22', panel: 'moe', rows: ['mhc2', 'norm2', 'ffn-expert'],
    title: '路由：288 个专家里挑 8 个', layer: 4,
    flow: ['4 路 [6, 4, 4096]', '合成、RMSNorm [6, 4096]', '打分 [6, 288]', '每个词的专家编号与权重，各 [6, 8]'],
    text: [
      '第 21 段把注意力结果写回了主干，现在沿主干来到<b>前馈半层</b>。第 18 段是所有词共用一套稠密前馈；这里有 288 套专家，所以计算前先要回答：<b>这个词交给谁，各占多少？</b>这就是路由器的工作。',
      '先接上第 21 段交下来的 4 路：和第 17 段一样，算 24 个系数、合成 1 路，再做 RMSNorm，得到每个词的 4096 个数。<b>下面是 L04 下半层的局部算例</b>：直接读取第 21 段算出的四路输入，后续数值都按公式计算。',
      '路由权重 W_router 是 [288, 4096]。每一行对应一个专家；这一行与一个词的 4096 个数点积，得到该词给这个专家的原始分数 logit。六个词各得 288 个数，合起来是 [6, 288]。',
      '每个 logit 先过 <b>sigmoid</b>，得到 0 到 1 之间的分数 s。<b>选谁</b>用 s + 偏置：偏置是每个专家自己的校正量，按加过偏置的分数挑最高的 8 个。这里不是 softmax，288 个 s 的和不要求等于 1。',
      '<b>各占多少</b>则取回这 8 个专家原来的 s，不加偏置：每个 s 除以这 8 个 s 的和，再乘 2.5。因此 8 个合并权重的和是 2.5。共享专家不参加这次挑选，后面单独算。',
      '播放时先演「春天」给一个专家打分，再看挑选边界（第 8 和第 9 名）以及 8 个合并权重，最后快进其余词。卡片中的专家编号从 0 开始；每个词挑的人和权重都可能不同。',
    ],
    more: '官方 <code>modeling_glm5_next.py</code> 160–183 行：F.linear → sigmoid → 加 e_score_correction_bias 用于选择 → topk → 从未加偏置的 scores 取回 → 归一化 → routed_scaling_factor。配置 n_group = topk_group = 1，只有一组，不额外排除专家。官方 topk 的 sorted=False 不保证顺序；这里为讲解按选择分排列同一组专家，编号与权重保持配对。前馈入口见 1323–1326 行。示例输入与权重并非训练后的 GLM 数值。',
    coef: { w: 'fn_ffn', x: 'residual_mid', out: 'coef_ffn', scale: 'scale_ffn', base: 'base_ffn', R: 0, word: 0, eps: 1e-5, hcEps: 1e-6, tag: '24 个系数 · 春天 · pre₁' },
    mix: { w: 'coef_ffn', x: 'residual_mid', out: 'collapsed_ffn', R: 0, word: 0, tag: '合成 1 路 · 春天 · 第 1 个数' },
    norm: { x: 'collapsed_ffn', g: 'gamma_ffn', out: 'x_ffn', word: 0, eps: 1e-5, tag: 'RMSNorm · 春天' },
    dot: { w: 'W_router', x: 'x_ffn', out: 'logits', R: 0, word: 0, tag: '春天给专家 #0 打分' },
    route: { x: 'logits', bias: 'e_bias', indices: 'topk_i', weights: 'topk_w', k: 8, scale: 2.5 },
    poses: {
      entry: { ids: ['fn_ffn', 'scale_ffn', 'base_ffn', 'coef_ffn', 'residual_mid'], dir: [.1, .75, 1], pad: 2, shift: [0, -.35], sideCard: true },
      coef2: { ids: ['fn_ffn', 'scale_ffn', 'base_ffn', 'coef_ffn', 'residual_mid'], dir: [.1, .75, 1], pad: 2, shift: [0, -.35], sideCard: true },
      mix2: { ids: ['residual_mid', 'coef_ffn', 'collapsed_ffn'], dir: NEAR, pad: 2, sideCard: true },
      norm2: { ids: ['collapsed_ffn', 'x_ffn', 'gamma_ffn'], dir: NEAR, pad: 2, sideCard: true },
      dot: { ids: ['x_ffn', 'W_router', 'logits'], dir: [-.2, .3, 1], pad: 4, sideCard: true },
      route: { ids: ['logits', 'e_bias', 'topk_i', 'topk_w'], dir: [-.12, .3, 1], pad: 6, sideCard: true },
    },
    labels: [
      { id: 'residual_mid', html: '<b>注意力写回的 4 路</b> <i>[6, 4, 4096]</i>', at: 'b' },
      { id: 'fn_ffn', html: '<b>fn</b> <i>前馈入口的权重</i>', at: 'l' },
      { id: 'coef_ffn', html: '<b>24 个系数</b> <i>[6, 24]</i>', at: 'l' },
      { id: 'collapsed_ffn', html: '<b>合成 1 路</b> <i>[6, 4096]</i>', at: 'r' },
      { id: 'x_ffn', html: '<b>RMSNorm 后</b> <i>[6, 4096]</i>', at: 'r' },
      { id: 'W_router', html: '<b>W_router</b> <i>[288, 4096]</i>', at: 'l' },
      { id: 'logits', html: '<b>原始分数</b> <i>[6, 288]</i>', at: 'r' },
      { id: 'e_bias', html: '<b>选专家的偏置</b> <i>[288]</i>', at: 'l' },
      { id: 'topk_i', html: '<b>专家编号</b> <i>[6, 8]</i>', at: 'l' },
      { id: 'topk_w', html: '<b>合并权重</b> <i>[6, 8]</i>', at: 'r' },
    ],
    beats: [
      { say: '先认输入：把注意力写回的 4 路合成并归一化，再由路由决定每词交给哪 8 个专家', dur: 5, cam: 'entry', op: { show: ['residual_mid'] } },
      { say: '接注意力写回的四路，用前馈自己的 fn、scale、base 算 pre；先看春天这一项', dur: 7, cam: 'coef2', op: { coef: 'all' } },
      { say: '其余的系数一样', dur: 4, cam: 'coef2', op: { words: 'coef_ffn', ins: [['residual_mid', 'col'], ['fn_ffn', 'all'], ['scale_ffn', 'all'], ['base_ffn', 'all']], trace: ['fn_ffn', 'residual_mid', 'coef_ffn', '24 个系数'], by: 'coef' } },
      { say: '按 pre 合成 1 路：「春天」第 1 个数 = 4 路各自的第 1 个数 × 各自的 pre，再相加', dur: 6, cam: 'mix2', op: { mix: 'all' } },
      { say: '其余的数一样', dur: 4, cam: 'mix2', op: { words: 'collapsed_ffn', ins: [['residual_mid', 'col'], ['coef_ffn', 'col']], trace: ['coef_ffn', 'residual_mid', 'collapsed_ffn', '合成 1 路'], by: 'mix' } },
      { say: 'RMSNorm：「春天」的 4096 个数平方、平均、开根号得 rms；每个数 ÷ rms × γ', dur: 7, cam: 'norm2', op: { norm: 'all' } },
      { say: '其余 5 个词一样，各用自己的 rms', dur: 4, cam: 'norm2', op: { words: 'x_ffn', w0: 1, ins: [['collapsed_ffn', 'col'], ['gamma_ffn', 'all']], trace: ['gamma_ffn', 'collapsed_ffn', 'x_ffn', 'RMSNorm 后'], by: 'norm' } },
      { say: '每行代表一个专家；每词与 288 行各做点积得到打分，再选 8 个。接下来推近看一个数怎么算', dur: 5, cam: 'dot', op: { show: ['x_ffn', 'W_router'], shape: true } },
      { say: '挑一个分数：「春天」与 W_router 的第 1 行，给专家 #0 打分', dur: 3, cam: 'dot', op: { dot: 'pick' } },
      { say: '取这个词的 4096 个数，和权重行一对一对排好', dur: 4, cam: 'dot', op: { dot: 'pull' } },
      { say: '每对相乘', dur: 2.5, cam: 'dot', op: { dot: 'mul' } },
      { say: '4096 个乘积加起来，得到原始分数 logit', dur: 3.5, cam: 'dot', op: { dot: 'sum' } },
      { say: '放回 [6, 288] 中「春天、专家 #0」的位置', dur: 2, cam: 'dot', op: { dot: 'place' } },
      { say: '其余分数一样算：每个词与 288 行各做一次点积', dur: 5, cam: 'dot', op: { words: 'logits', ins: [['W_router', 'all'], ['x_ffn', 'col']], trace: ['W_router', 'x_ffn', 'logits', '原始分数'] } },
      { say: '原始分数过 sigmoid，得到 0 到 1 之间的 s；每个分数都这样变换', dur: 5, cam: 'route', op: { route: 'sigmoid' } },
      { say: 's 加上每个专家的偏置，挑最高的 8 个；第 9 名落在边界外', dur: 7, cam: 'route', op: { route: 'choose' } },
      { say: '合并权重取未加偏置的 s：除以这 8 个 s 的和，再乘 2.5', dur: 7, cam: 'route', op: { route: 'weights' } },
      { say: '把 8 个权重逐个放回，和同一位置的专家编号一一对应', dur: 4, cam: 'route', op: { route: 'place' } },
      { say: '其他 5 个词各自挑 8 个、各自计算权重，交给下一段的专家', dur: 8, cam: 'route', op: { route: 'rest' } },
    ],
  },
  {
    n:23,id:'s23',panel:'moe',rows:['ffn-expert'],title:'专家前馈',layer:4,
    flow:['接 22：每词的 8 个编号及权重','Gate / Up 各 [6, 8, 2048]','SiLU × Up [6, 8, 2048]','Down × 路由权重 [6, 8, 4096]','另有共享输出 [6, 4096]'],
    text:[
      '第 22 段已经决定了<b>交给哪 8 个专家、各占多少</b>。现在继续使用同一份输入、同一组编号和权重：每个词把 RMSNorm 后的 4096 个数交给它选中的专家。每个专家是一套前馈权重，算法和第 18、19 段相同，内部宽度从 12288 换成 <b>2048</b>。',
      '先认权重：W_gu 是 <b>[288, 4096, 4096]</b>，每一片属于一个专家。这一片的前 2048 行算 gate、后 2048 行算 up；它们读同一个词的 4096 个输入。编号决定从 288 片里用哪一片，不能把“第 1 个选中项”当成“专家 #0”。播放先逐一指出春天选出的 8 个，再演第一个专家的一个 gate 数。',
      '每词每个专家算出的 gate 和 up 各有 2048 个数，拼在同一块 <b>[6, 8, 4096]</b> 中。这里的 8 是<b>每个词自己的 8 个选中位置</b>；不同词在同一个位置上的专家编号可能不同。gate 截到不超过 10，up 截到 −10 到 10，再逐位置做 SiLU(gate) × up，得到 <b>[6, 8, 2048]</b>。',
      '接着读同一个专家的 W_dn <b>[4096, 2048]</b>：2048 对相乘、求和，降回 4096 个数。官方实现随即乘这个专家的路由权重；模型中的“× 路由权重”块 <b>[6, 8, 4096]</b> 已包含这次乘法。第 24 段只把这 8 份相加，不能再乘一次。',
      '<b>共享专家</b>是另一套宽度为 2048 的普通前馈，所有词都会走。它不参加 288 选 8，也不乘那 8 个路由权重。画面依次展示它的 gate、up、SiLU 相乘、down，得到独立的 <b>[6, 4096]</b>，留给第 24 段与路由分支合并。',
      '这里沿用第 22 段的局部示例数据，48 个选中分支和共享分支均按相同公式计算。权重为编造的演示权重；快进时连线跟着当前词、当前选中位置和真实专家编号移动。',
    ],
    more:'官方 modeling_glm5_next.py 109–143 行：按 top_k_index 找专家与 token，gate_up_proj → 拆成 gate/up → 限幅 → SiLU(gate) × up → down_proj → 乘配对的 top_k_weights。187–208 行：所有词另算 shared_experts，再与路由专家和相加。共享分支采用 87–105 行的普通 MLP。',
    expert:{indices:'topk_i',weights:'topk_w',k:8,limit:10,stages:{
      gu:{w:'W_gu',x:'x_ffn',out:'e_gu',name:'专家 Gate / Up'},
      hidden:{w:'e_gu',x:'e_gu',out:'e_h',name:'专家 SiLU × Up',kind:'activation'},
      down:{w:'W_dn',x:'e_h',out:'e_out',name:'专家 Down × 路由权重',weighted:true},
      sg:{w:'W_s_gate',x:'x_ffn',out:'s_gate',name:'共享 Gate'},
      su:{w:'W_s_up',x:'x_ffn',out:'s_up',name:'共享 Up'},
      sh:{w:'s_gate',x:'s_up',out:'s_h',name:'共享 SiLU × Up',kind:'activation'},
      sd:{w:'W_s_down',x:'s_h',out:'s_out',name:'共享 Down'},
    }},
    poses:{
      entry:{ids:['x_ffn','W_gu','topk_i','e_gu'],dir:[-.1,.45,1],pad:3,sideCard:true,narrowShift:[.6,-.5]},
      gu:{ids:['W_gu','e_gu','topk_i'],dir:[-.1,.45,1],pad:3,sideCard:true,narrowShift:[.6,-.5]},
      shared:{ids:['W_s_gate','W_s_up','s_gate','s_up','s_h'],dir:[-.1,.45,1],pad:3,sideCard:true,narrowShift:[.6,-.5]},
      hidden:{ids:['e_gu','e_h','s_gate','s_up','s_h'],dir:[-.1,.45,1],pad:4,sideCard:true,narrowShift:[.6,-.5]},
      down:{ids:['e_h','W_dn','e_out','topk_w'],dir:[-.1,.35,1],pad:4,sideCard:true,narrowShift:[.6,-.5]},
      sharedDown:{ids:['s_h','W_s_down','s_out'],dir:[-.1,.35,1],pad:4,sideCard:true,narrowShift:[.6,-.5]},
    },
    labels:[
      {id:'x_ffn',html:'<b>第 22 段的输入</b> <i>[6, 4096]</i>',at:'r'},
      {id:'topk_i',html:'<b>选中的专家编号</b> <i>[6, 8]</i>',at:'r'},
      {id:'W_gu',html:'<b>288 套 Gate / Up</b> <i>每套 [4096, 4096]</i>',at:'tl'},
      {id:'e_gu',html:'<b>gate | up</b> <i>[6, 8, 4096]</i>',at:'b'},
      {id:'e_h',html:'<b>SiLU × Up</b> <i>[6, 8, 2048]</i>',at:'b'},
      {id:'W_dn',html:'<b>288 套 Down</b> <i>每套 [4096, 2048]</i>',at:'l'},
      {id:'topk_w',html:'<b>配对的路由权重</b> <i>[6, 8]</i>',at:'r'},
      {id:'e_out',html:'<b>已乘路由权重</b> <i>[6, 8, 4096]</i>',at:'r'},
      {id:'W_s_gate',html:'<b>共享 Gate</b> <i>[2048, 4096]</i>',at:'tl'},
      {id:'W_s_up',html:'<b>共享 Up</b> <i>[2048, 4096]</i>',at:'tl'},
      {id:'s_h',html:'<b>共享 SiLU × Up</b> <i>[6, 2048]</i>',at:'b'},
      {id:'W_s_down',html:'<b>共享 Down</b> <i>[4096, 2048]</i>',at:'l'},
      {id:'s_out',html:'<b>共享输出</b> <i>[6, 4096]</i>',at:'r'},
    ],
    beats:[
      {say:'接第 22 段：输入仍是每词 4096 个数，编号决定交给哪 8 套专家权重',dur:5,cam:'entry',op:{show:['x_ffn','topk_i','W_gu']}},
      {say:'逐个指出春天选中的专家；每个编号对应权重堆里自己的那一片',dur:5,cam:'gu',op:{expert:'select'}},
      {say:'挑第 1 个选中专家的第 1 个 gate 数：输入 4096 个数与该专家的第一行点积',dur:3,cam:'gu',op:{expert:'gu',phase:'pick'}},
      {say:'沿线取出输入和这一行权重，一对一对排好',dur:4,cam:'gu',op:{expert:'gu',phase:'pull'}},
      {say:'每对相乘',dur:2.5,cam:'gu',op:{expert:'gu',phase:'mul'}},
      {say:'4096 个乘积求和，得到这一个 gate 数',dur:3,cam:'gu',op:{expert:'gu',phase:'sum'}},
      {say:'写入「春天、第一个选中位置」的 gate 格；专家编号与这个位置对应',dur:4,cam:'gu',op:{expert:'gu',phase:'place'}},
      {say:'其余 gate / up 一样；换词时读取这个词自己的专家编号，依次写完 6 × 8 份',dur:6,cam:'gu',op:{expert:'gu',phase:'trace'}},
      {say:'同一份输入还交给共享专家；所有词都经过这一套 Gate 和 Up，不参加挑选',dur:3,cam:'shared',op:{show:['x_ffn','W_s_gate','W_s_up']}},
      {say:'共享 Gate：每词 4096 个输入，与 2048 行各做点积',dur:4,cam:'shared',op:{expert:'sg',phase:'trace'}},
      {say:'共享 Up：另一套权重，同样得到每词 2048 个数',dur:4,cam:'shared',op:{expert:'su',phase:'trace'}},
      {say:'专家的 gate 和 up 已算好；接下来每个位置相配，得到 2048 个隐藏数',dur:3,cam:'hidden',op:{show:['e_gu','s_gate','s_up']}},
      {say:'先限幅，再 SiLU(gate) × up；演示一个数，并沿箭头写入隐藏结果',dur:7,cam:'hidden',op:{expert:'hidden',phase:'all'}},
      {say:'8 个选中专家的其他位置和其他词都一样',dur:5,cam:'hidden',op:{expert:'hidden',phase:'trace'}},
      {say:'共享分支也做相同的限幅与相乘，得到 [6, 2048]',dur:4,cam:'hidden',op:{expert:'sh',phase:'trace'}},
      {say:'读回同一个专家的 Down：2048 个隐藏数降回 4096；配对的路由权重在旁边等着',dur:3,cam:'down',op:{show:['e_h','W_dn','topk_w']}},
      {say:'2048 对相乘、求和，再乘这一份的路由权重，写进已加权输出',dur:9,cam:'down',op:{expert:'down',phase:'all'}},
      {say:'把每个词的 8 份加权输出逐数算完；权重始终与专家编号配对',dur:6,cam:'down',op:{expert:'down',phase:'trace'}},
      {say:'最后是共享 Down：共享隐藏数降回 4096，不乘路由权重',dur:3,cam:'sharedDown',op:{show:['s_h','W_s_down']}},
      {say:'共享专家为每个词算出一份 [4096] 输出',dur:5,cam:'sharedDown',op:{expert:'sd',phase:'trace'}},
      {say:'8 份已加权输出和 1 份共享输出都已就位；第 24 段接着把它们合起来',dur:4,cam:'sharedDown',op:{show:['e_out','s_out']}},
    ],
  },
  {
    n:24,id:'s24',panel:'moe',rows:['ffn-expert'],title:'合并已加权专家与共享输出',layer:4,focusLabels:true,
    flow:['8 份已加权输出 [6, 8, 4096]','逐位置相加 [6, 4096]','+ 共享输出 [6, 4096]','前馈输出 [6, 4096]'],
    text:[
      '第 23 段已经得到两种结果：每个词挑中的 <b>8 份专家输出</b>，和所有词都经过的 <b>1 份共享专家输出</b>。现在把这些分支收回成每个词的一条 4096 维向量。',
      '先看「春天」的第 1 个数：从 8 个选中位置各取同一通道的值，<b>只做相加</b>，写到“8 份相加”的第 1 个位置。这里的每份已经乘过自己的路由权重，不能再乘一次，也不除以 8。连线依次指向实际专家切片，编号沿用这个词在第 22 段挑出的结果。',
      '随后，把这份路由合计与共享专家输出<b>同词、同位置相加</b>。6 个词的 4096 个位置都这样得到，最终仍是 <b>[6, 4096]</b>。这还不是出层的四路残差；第 25 段再用 post / comb 写回四路。',
    ],
    more:'官方 <code>modeling_glm5_next.py</code> 第 134 行已乘路由权重，第 135 行 <code>index_add_</code> 按词相加，第 206–207 行把路由结果与共享专家相加。沿用第 20–23 段的同一份 L04 教学算例；数值由编造权重按公式计算。',
    merge:{routed:{ins:['e_out'],out:'routed'},shared:{ins:['routed','s_out'],out:'ffn_out'}},
    poses:{
      gather:{ids:['e_out','routed'],dir:[-.1,.4,1],pad:4,sideCard:true,narrowShift:[.6,-.3]},
      shared:{ids:['routed','ffn_out'],labels:['s_out'],dir:[-.1,.35,1],pad:4,sideCard:true,narrowShift:[.6,-.3]},
    },
    labels:[
      {id:'e_out',html:'<b>8 份已加权输出</b><br><i>[6, 8, 4096]</i>',at:'b'},
      {id:'routed',html:'<b>8 份相加</b><br><i>[6, 4096]</i>',at:'b'},
      {id:'s_out',html:'<b>共享专家输出</b><br><i>[6, 4096]</i>',at:'b'},
      {id:'ffn_out',html:'<b>前馈输出</b><br><i>[6, 4096]</i>',at:'b'},
    ],
    beats:[
      {say:'接第 23 段：8 份专家输出已各自乘过路由权重。先看它们在模型里的位置，再合成一份',dur:4,cam:'gather',op:{show:['e_out']}},
      {say:'挑「春天」第 1 个数：8 份都取这个词、这个通道；下方标记是合计要写入的位置',dur:4,cam:'gather',op:{merge:'routed',phase:'pick'}},
      {say:'沿线依次取出 8 个数；切片按选中位置移动，旁边标出对应的实际专家编号',dur:12,cam:'gather',op:{merge:'routed',phase:'pull'}},
      {say:'这 8 个已加权数直接相加。没有第二次乘路由权重，也不取平均',dur:4,cam:'gather',op:{merge:'routed',phase:'sum'}},
      {say:'合计沿箭头写入「春天」第 1 个位置',dur:3,cam:'gather',op:{merge:'routed',phase:'place'}},
      {say:'其余通道和其余词一样；逐位置写完 6 × 4096 个路由合计',dur:7,cam:'gather',op:{merge:'routed',phase:'trace'}},
      {say:'往下接共享分支：8 份合计已经就位，共享输出来自第 23 段。现在只把这两份相加',dur:4,cam:'shared',op:{show:['routed','s_out']}},
      {say:'仍看「春天」第 1 个位置：两条输入线分别连到路由合计和共享输出',dur:4,cam:'shared',op:{merge:'shared',phase:'pick'}},
      {say:'分别取出两个同位置的数；共享分支不乘路由权重',dur:4,cam:'shared',op:{merge:'shared',phase:'pull'}},
      {say:'路由合计 + 共享输出，得到前馈输出的这一个数',dur:3,cam:'shared',op:{merge:'shared',phase:'sum'}},
      {say:'沿箭头写入前馈输出的对应格子',dur:3,cam:'shared',op:{merge:'shared',phase:'place'}},
      {say:'依次完成 6 个词、每词 4096 个数；每次都读取两份结果的同一位置',dur:7,cam:'shared',op:{merge:'shared',phase:'trace'}},
      {say:'前馈输出 [6, 4096] 已合成；下一段再把它写回四路残差，完成 L04',dur:4,cam:'shared',op:{show:['routed','s_out','ffn_out']}},
    ],
  },
  {
    n:25,id:'s25',panel:'mhc',rows:['write2'],title:'写回四路，出层',layer:4,focusLabels:true,
    flow:['前馈输出 [6, 4096]','post × 输出 + combᵀ × 旧四路','新四路 [6, 4, 4096]','交给 L05'],
    text:[
      '第 24 段把专家分支合成了每个词的一份 <b>[4096]</b> 前馈输出。现在把它写回四路，完成 L04；这一步与第 16 段的注意力写回、第 19 段的稠密前馈写回相同。',
      '要用的 <b>post [6, 4]</b> 和 <b>comb [6, 4, 4]</b>，已经在第 22 段的前馈入口算好，存放在 <b>coef_ffn [6, 24]</b> 中。旧四路是第 21 段注意力半层写回的 <b>residual_mid</b>。它们都在模型上方，镜头继续向下，通过标明来源的入口取数。',
      '<b>新第 s 路 = post_s × 前馈输出 + 旧四路按 comb 第 s 列加权相加。</b>挑「春天」第 1 路的第 1 个数：1 对 post 与前馈输出，加上 4 对 comb 与旧四路；5 对分别相乘，再把 5 个乘积相加，沿箭头写进对应格子。这里读的是 comb 的<b>第 s 列</b>，不是第 s 行。',
      '所有词、所有路、所有位置都这样写完，得到 <b>[6, 4, 4096]</b>，交给下一层 L05。四路始终保留各自内容，并不是把前馈输出简单复制四份。到这里，L04 的注意力与 MoE 前馈都走完了。',
    ],
    more:'官方 <code>modeling_glm5_next.py</code> 第 1322–1329 行：保留前馈前的四路残差，使用 ffn_hc 的 post / comb；前馈后计算 <code>post × 输出 + comb.transpose(-1, -2) @ residual</code>。同一份 L04 教学算例接着第 20–24 段计算，不代表真实训练权重的推理。',
    poses:{write:{ids:['ffn_out','residual_out'],dir:[.32,.3,1],pad:3,sideCard:true,narrowShift:[.7,0]}},
    write:{w:'coef_ffn',x:'residual_mid',y:'ffn_out',out:'residual_out',s:0,R:0,word:0,tag:'L04 新第 1 路 · 春天 · 第 1 个数'},
    labels:[
      {id:'ffn_out',html:'<b>前馈输出</b><br><i>第 24 段 · [6, 4096]</i>',at:'b'},
      {id:'residual_out',html:'<b>L04 新四路 → L05</b><br><i>[6, 4 路, 4096]</i>',at:'b'},
    ],
    beats:[
      {say:'接第 24 段：前馈输出已经合成一份，现在把它写回四路；下方是 L04 出层的位置',dur:4,cam:'write',op:{show:['ffn_out']}},
      {say:'旧四路来自第 21 段，post / comb 来自第 22 段，都在上方。取新第 1 路「春天」第 1 个数所需的 5 对',dur:5,cam:'write',op:{write:'pick'}},
      {say:'沿线取下 5 对数：post₁ 配前馈输出；comb 第 1 列的 4 个系数分别配旧 4 路的同一位置',dur:7,cam:'write',op:{write:'pull'}},
      {say:'每对相乘：前馈贡献 1 项，旧四路贡献 4 项',dur:4,cam:'write',op:{write:'mul'}},
      {say:'5 个乘积相加，就是新第 1 路的这一个数',dur:4,cam:'write',op:{write:'sum'}},
      {say:'跟着箭头，写到第 1 路、「春天」、第 1 个数；写入位置始终标在目标格子上',dur:3,cam:'write',op:{write:'place'}},
      {say:'逐词、逐路、逐位置写完；换到第 s 路就读 post_s 和 comb 第 s 列，前馈输出取同一词的同一位置',dur:12,cam:'write',op:{words:'residual_out',ins:[['ffn_out','col'],['residual_mid','col'],['coef_ffn','col']],trace:['coef_ffn','residual_mid','residual_out','L04 新四路'],by:'write'}},
      {say:'L04 完成：6 个词 × 4 路 × 4096 个数，交给 L05；接下来继续逐层经过 L05–L44',dur:4,cam:'write',op:{show:['ffn_out','residual_out']}},
    ],
  },
];

SEGMENTS.push(...REMAINING);
// Keep stable internal ids for saved links and QA; display numbers follow the actual forward order.
const bridge=(n,first,last)=>{
 const tag=l=>'L'+String(l).padStart(2,'0');
 const s={n,id:'s'+n,global:true,layer:last,lessonData:true,focusLabels:true,panel:null,rows:[],
 title:`继续经过 ${tag(first)}–${tag(last)}`,text:['接住上一层的四路，逐层执行注意力、前馈和写回。这里加快播放重复结构，所有层都已经按各自教学权重完整计算。','画面跟随同一条主干；每层显示「春天 · 第一路 · 第一个数」的输入和输出，下一层直接读取上一层结果。'],
 flow:[`${tag(first-1)} 输出`,`逐层计算 ${tag(first)}–${tag(last)}`,`${tag(last)} 输出`],poses:{},labels:[],beats:[],more:'依据 modeling_glm5_next.py 1476–1492：四路依次通过全部主模型层，再交给 hc_head。数值由 make_continuous.py 完整生成，逐元素核对层间输入输出。'};
 for(let l=first;l<=last;l++){
  const source=`${tag(l)}:residual_in`,out=`${tag(l)}:residual_out`,cam=tag(l);
  const entry=`${tag(l)}:x_attn`;
  s.poses[cam]={ids:[entry,out],dir:[.32,.3,1],pad:8,topReserve:180};
  s.labels.push({id:entry,html:'<b>经本层 mHC 合为一路</b><br><i>[6, 4096]</i>',at:'b'},{id:out,html:`<b>${tag(l)} 输出 → ${l===44?'最终归一化':tag(l+1)}</b><br><i>[6, 4, 4096]</i>`,at:'b'});
  s.beats.push({say:`${tag(l)}：接上一层四路，按本层权重计算，再写回四路。`,dur:4,cam,op:{transit:l,show:[source,out]}});
 }
 return s;
};
SEGMENTS.push(bridge(39,1,2),bridge(40,5,44));
IO[39]="L00 输出 → L01 → L02 → L03 输入";IO[40]="L04 输出 → L05–L44 → 最终归一化";
export const ORDER=[...Array.from({length:19},(_,i)=>i+1),39,...Array.from({length:8},(_,i)=>i+26),...Array.from({length:6},(_,i)=>i+20),40,...Array.from({length:5},(_,i)=>i+34)];
const rank=n=>ORDER.indexOf(n)+1;
SEGMENTS.sort((a,b)=>rank(a.n)-rank(b.n));
const kda=PARTS[4],mla=PARTS[5];
PARTS[4]=['四','继续 L01–L02，进入稀疏注意力 + MoE（L03）',[[39,'继续经过 L01–L02'],...mla[2]]];
PARTS[5]=['五','接着进入 KDA + MoE（L04）',kda[2]];
PARTS[6][2].unshift([40,'继续经过 L05–L44']);
const renumber=text=>text.replace(/第\s*(\d+)、(\d+)\s*段/g,(_,a,b)=>`第 ${rank(+a)}、${rank(+b)} 段`).replace(/第\s*(\d+)\s*段/g,(_,n)=>`第 ${rank(+n)} 段`).replace(/(\d+)[–—](\d+)(\s*段| 是同一份)/g,(_,a,b,end)=>`${rank(+a)}–${rank(+b)}${end}`);
for(const s of SEGMENTS){
 s.displayNumber=rank(s.n);
 s.text=s.text.map(renumber);s.flow=s.flow.map(renumber);s.more=renumber(s.more||'');
 for(const b of s.beats)b.say=renumber(b.say);
 for(const l of s.labels||[])l.html=renumber(l.html);
}
export const segmentOf = n => SEGMENTS.find(s => s.n === n);
export const durationOf = s => s.beats.reduce((a, b) => a + b.dur, 0);
