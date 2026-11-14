// One text layer of GLM-5.3-Flash exactly as the official code computes it (reference/modeling_glm5_next.py), derived
// from the config alone. Prototype for the user (2026-09-23), not product code.
//
// The config has three kinds of layer (layer_types × mlp_layer_types):
//   L00–L02                          linear attention (KDA) + dense feed-forward
//   L03, L07, … L43 (every fourth)   sparse attention (MLA with a DSA indexer) + MoE
//   the other 31                     linear attention (KDA) + MoE
//   L45 (num_nextn_predict_layers)   the MTP layer: sparse attention (MLA with its indexer) + MoE, one stream, no mHC
// layerSpec(tc, T, i) lists layer i: the attention half and the feed-forward half are picked from the config; mHC, the
// two norms and the two write-backs are the same in every layer. The MTP layer is not in the HF modeling file: the
// checkpoint holds it as layer 45 (reference/checkpoint-shapes.json: no hc_* weights, MLA + indexer + MoE weights of the
// same shapes), and the official serving code (reference/vllm-glm5next/, vLLM) runs it as a decoder layer without mHC
// (model.py 465–482): a plain residual, the input to input_layernorm, attention, add, post_attention_layernorm, MoE, add.
// Its MLA and MoE compute as the HF lines cited; its own steps cite the vLLM files ("vLLM model.py …").
//
// Every learned parameter of the layer and every tensor a step reads or writes is listed once. Elementwise temporaries
// inside one step (the mean square inside a norm, the clamped gate before SiLU, the flattened streams before `fn` …) are
// not separate blocks; each step names them in `merged` so nothing is silently dropped. `src` = line numbers in the
// official modeling file.
//
// Drawing axes (read by truth-layout.js):
//   rows  {n, unit}  unit 'token' = one word per row; 'dim' = numbers along the weight's input side; 'pool' = n groups
//                    of `size` words (the indexer's compressed keys), drawn across the words they compress
//   cols  n          numbers along the horizontal (features, or any count laid out horizontally); colsUnit 'token' =
//                    n words (an attention matrix: which word looks at which), one word as wide as a word row is high
//   deck  {n, kind}  'head' = split by head (`cols` / `rows` are per head; heads run along the horizontal, or along the
//                    vertical when headAxis is 'y'); 'expert' = one slice per routed expert; 'stream' = one slab per
//                    residual stream; 'pick' = one slab per expert a word picks (its k-th pick, not expert number k)
//   headsCut         (with headsDown) cut into heads already: a seam between the heads where headsDown draws a line (09-29,
//                    the user chose it for the conv's outputs over plates back in depth: "A")
//   headsDown        the heads one under another down the vertical, whatever the layout's rule (a tensor still flat in
//                    the code, where the heads are only where it will be cut)
export function layerSpec(tc, T, li = 0) {
  const mtp = li >= tc.num_hidden_layers;   // the MTP layer (vLLM model.py 303: never KDA; its checkpoint layer has experts)
  const attnKind = mtp ? 'mla' : tc.layer_types[li] === 'linear_attention' ? 'kda' : 'mla', ffnKind = mtp ? 'moe' : tc.mlp_layer_types[li] === 'sparse' ? 'moe' : 'dense';
  const C = tc.hidden_size, S = tc.hc_mult, MIX = (2 + S) * S, lim = tc.swiglu_limit, sk = tc.hc_sinkhorn_iters;
  const tensors = [], steps = [], dims = { C, S, MIX, T };
  const streams = { n: S, kind: 'stream' }, tok = { n: T, unit: 'token' }, dim = n => ({ n, unit: 'dim' });
  const data = (id, name, comp, cols, deck, shape, extra = {}) => tensors.push({ id, name, kind: 'data', comp, rows: tok, cols, deck, shape, ...extra });
  const weight = (id, name, comp, rowsIn, cols, deck, shape, code, extra = {}) => tensors.push({ id, name, kind: 'weight', comp, rows: dim(rowsIn), cols, deck, shape, code, ...extra });
  const vec = (id, name, comp, cols, deck, shape, code, extra = {}) => tensors.push({ id, name, kind: 'weight', comp, rows: dim(1), cols, deck, shape, code, vector: true, ...extra });
  const step = (id, title, half, op, reads, params, writes, src, merged = '') => steps.push({ id, title, half, op, reads, params, writes, src, merged });

  // mHC: the four streams in, 24 mixing numbers per word, one merged stream out (lines 220–297)
  const mhc = (site, half, input, src) => {
    weight(`fn_${site}`, `fn（${site === 'attn' ? '注意力' : '前馈'}处）`, 'resid', C, MIX, streams, [MIX, S * C], `${site}_hc.fn`, { note: '按 4 路拆开画：每路 4096 行' });
    vec(`base_${site}`, 'base', 'resid', MIX, null, [MIX], `${site}_hc.base`);
    vec(`scale_${site}`, 'scale', 'resid', 3, null, [3], `${site}_hc.scale`);
    data(`coef_${site}`, '混合系数 pre / post / comb', 'resid', MIX, null, [T, MIX]);
    data(`collapsed_${site}`, '合成 1 路', 'resid', C, null, [T, C]);
    step(`mix_${site}`, '算 24 个混合系数', half, 'linear', [input], [`fn_${site}`, `base_${site}`, `scale_${site}`], [`coef_${site}`], src.mix,
      `4 路先拼成 ${S}×${C} = ${S * C} 维再做无权重 RMS 归一化；乘 fn 得 24 个数，拆成 pre ${S}、post ${S}、comb ${S}×${S}，各自乘 scale、加 base：pre 过 sigmoid，post 过 2·sigmoid，comb 过 softmax，先按列归一化一次，再做 ${sk - 1} 轮行、列交替归一化（Sinkhorn，283–292 行）`);
    step(`collapse_${site}`, '4 路按 pre 加权合成 1 路', half, 'streams', [input, `coef_${site}`], [], [`collapsed_${site}`], src.collapse);
  };
  const norm = (id, name, input, code, src) => {
    vec(`gamma_${id}`, `γ（${name}）`, 'norm', C, null, [C], `${code}.weight`);
    data(`x_${id}`, `RMSNorm 后`, 'norm', C, null, [T, C]);
    step(`norm_${id}`, 'RMSNorm', id === 'attn' ? 'attn' : 'ffn', 'elementwise', [input], [`gamma_${id}`], [`x_${id}`], src, '每个词先求 4096 维的均方根，除掉，再乘 γ');
  };
  const writeBack = (site, half, out, residual, result, src) => {
    data(result, site === 'attn' ? '写回 4 路（注意力后）' : '写回 4 路（本层输出）', 'resid', C, streams, [T, S, C]);
    step(`write_${site}`, '写回 4 路', half, 'streams', [out, residual, `coef_${site}`], [], [result], src, 'post 把结果分到 4 路，comb（4×4）把原来的 4 路重新混合，两者相加');
  };
  // SwiGLU as the official MLP does it (lines 99–105; the experts, 138–143, the same): gate clamped from above, up clamped both ways
  const swigluNote = `gate 截到 ≤ ${lim}，up 截到 ±${lim}，SiLU(gate) × up`;

  // ---- attention half, linear attention: KDA (lines 586–736)
  const kda = () => {
    const la = tc.linear_attn_config, H = la.num_heads, d = la.head_dim, HD = H * d, K = la.short_conv_kernel_size, lb = la.gate_lower_bound;
    const heads = { n: H, kind: 'head' };
    Object.assign(dims, { H, d, HD, K });
    // q / k / v leave the projection as [T, 8192] (still flat until the split after the conv, 687–694): drawn as a word's
    // 8192 numbers down its column, a line every 128 where the split will cut (headsDown), their weights standing beside
    // them as tall, row R of the weight level with number R (09-28, the user: the 64 heads made one plate lying flat)
    const proj = (id, name, out, code, src) => { weight(`W_${id}`, name, 'kda', C, d, heads, [HD, C], code, { headsDown: true }); data(out, out, 'kda', d, heads, [T, HD], { note: '8192 = 64 头 × 128，卷积之后才按头切开', headsDown: true }); step(`proj_${id}`, `${name} 投影`, 'attn', 'linear', ['x_attn'], [`W_${id}`], [out], src) };
    proj('q', 'W_q', 'Q', 'q_proj', '605 · 644–650');
    proj('k', 'W_k', 'K', 'k_proj', '606 · 644–650');
    proj('v', 'W_v', 'V', 'v_proj', '607 · 644–650');
    weight('W_f_a', 'W_f_a', 'kda', C, d, null, [d, C], 'forget_gate.f_a_proj'); data('f_a', '衰减门 · 低秩', 'kda', d, null, [T, d]);
    step('proj_f_a', '衰减门 · 先压到 128 维', 'attn', 'linear', ['x_attn'], ['W_f_a'], ['f_a'], '313 · 323');
    weight('W_b', 'W_b', 'kda', C, 1, heads, [H, C], 'b_proj', { note: '每头 1 列' }); data('beta', 'β（每头 1 个）', 'kda', 1, heads, [T, H]);
    step('proj_b', 'β：每个头一个写入强度', 'attn', 'linear', ['x_attn'], ['W_b'], ['beta'], '620 · 699', 'sigmoid');
    weight('W_g_a', 'W_g_a', 'kda', C, d, null, [d, C], 'g_a_proj'); data('g_a', '输出门 · 低秩', 'kda', d, null, [T, d]);
    step('proj_g_a', '输出门 · 先压到 128 维', 'attn', 'linear', ['x_attn'], ['W_g_a'], ['g_a'], '622 · 731');
    // short causal conv on q | k | v, one 4-tap kernel per channel (conv1d.weight is one [3·8192, 1, 4] tensor; drawn in its three parts)
    for (const [part, from, to] of [['q', 'Q', 'Q_conv'], ['k', 'K', 'K_conv'], ['v', 'V', 'V_conv']]) {
      tensors.push({ id: `conv_${part}`, name: `卷积核 · ${part}`, kind: 'weight', comp: 'kda', rows: dim(K), cols: d, deck: heads, shape: [HD, 1, K], code: `conv1d.weight[${part} 段]`, taps: true, headsDown: true });   // (channel c level with number c of what it convolves)
      data(to, `${from} 卷积后`, 'kda', d, heads, [T, H, d], { headsDown: true, headsCut: true });   // (beside what it convolves, as tall; cut)
      step(`conv_${part}`, `短卷积 · ${from}`, 'attn', 'conv', [from], [`conv_${part}`], [to], '610–617 · 676–685 · 396–416', `每个通道用自己的 ${K} 个抽头，只看本词和前 ${K - 1} 个词；再过 SiLU`);
    }
    // (09-29, the user chose it for the KDA step too: its [T, 64, 128] results and S down the vertical, a seam between
    // the heads; their weights standing beside them as tall)
    const DOWN = { headsDown: true }, CUT = { headsDown: true, headsCut: true };
    weight('W_f_b', 'W_f_b', 'kda', d, d, heads, [HD, d], 'forget_gate.f_b_proj', DOWN);
    vec('dt_bias', 'dt_bias', 'kda', d, heads, [HD], 'forget_gate.dt_bias', DOWN);
    vec('A_log', 'A_log（每头 1 个）', 'kda', 1, heads, [H], 'forget_gate.A_log');
    data('g', '衰减门 g', 'kda', d, heads, [T, H, d], CUT);
    step('forget_gate', '衰减门 g', 'attn', 'linear', ['f_a'], ['W_f_b', 'dt_bias', 'A_log'], ['g'], '314–318 · 323–330', `g = ${lb} · sigmoid(e^A_log · (f_a·W_f_b + dt_bias))，每个值在 (${lb}, 0) 之间（下限取配置 gate_lower_bound；配置类不在参考代码里，按字段名对应）`);
    weight('W_g_b', 'W_g_b', 'kda', d, d, heads, [HD, d], 'g_b_proj', DOWN); data('gate', '输出门', 'kda', d, heads, [T, H, d], CUT);
    step('proj_g_b', '输出门 · 展开到 64 头', 'attn', 'linear', ['g_a'], ['W_g_b'], ['gate'], '623 · 731');
    tensors.push({ id: 'state', name: '记忆矩阵 S（推理时才有）', kind: 'state', comp: 'kda', rows: dim(d), cols: d, deck: heads, shape: [H, d, d], note: '每读一个词更新一次；画的是读完 6 个词之后的 S（会存进缓存给下一个词用）', ...CUT });
    data('core_out', '注意力核心输出', 'kda', d, heads, [T, H, d], CUT);
    step('kda', 'KDA：逐词更新每个头的记忆 S，再读出', 'attn', 'kda', ['Q_conv', 'K_conv', 'V_conv', 'g', 'beta'], [], ['state', 'core_out'], '705–727 · 430–482',
      'q、k 先按每头 128 维做 L2 归一化，q 再乘 1/√128；每个词：S ← S·e^g，S ← S + k ⊗ β(v − Sᵀk)，输出 Sᵀq');
    vec('gamma_o', 'γ（o_norm，64 头共用）', 'kda', d, null, [d], 'o_norm.weight');
    data('o_normed', '门控归一化后', 'kda', d, heads, [T, H, d], CUT);
    step('o_norm', '门控归一化', 'attn', 'elementwise', ['core_out', 'gate'], ['gamma_o'], ['o_normed'], '624 · 732 · 341–358', '每个头 128 维先做 RMSNorm、乘 γ，再乘 sigmoid(输出门)');
    weight('W_o', 'W_o', 'kda', d, C, heads, [C, HD], 'o_proj', { note: '输入侧 8192 = 64 头 × 128，竖着按头切成 64 段', headAxis: 'y' });
    data('attn_out', '注意力输出', 'kda', C, null, [T, C]);
    step('proj_o', '输出投影：64 头合回 4096 维', 'attn', 'linear', ['o_normed'], ['W_o'], ['attn_out'], '625 · 733');
  };

  // ---- attention half, sparse attention: MLA (lines 1066–1258) with its DSA indexer (738–1026). The text model has no
  // position encoding at all (NoPE, 1484–1485; qk_rope_head_dim = 0), so every "rope" part below is 0 numbers wide.
  const mla = () => {
    const NH = tc.num_attention_heads, rope = tc.qk_rope_head_dim, qk = tc.qk_nope_head_dim + rope, kn = tc.qk_nope_head_dim, vd = tc.v_head_dim, qr = tc.q_lora_rank, kr = tc.kv_lora_rank;
    const IH = tc.index_n_heads, id = tc.index_head_dim, kp = tc.index_kpool, P = Math.floor(T / kp), TOPW = tc.index_topk + (tc.index_kpool_always_select_tail ? kp - 1 : 0);
    if (P < 1) throw new Error(`the indexer needs at least ${kp} words to form a pool`);
    const heads = { n: NH, kind: 'head' }, iheads = { n: IH, kind: 'head' };
    Object.assign(dims, { NH, qk, vd, qr, kr, rope, IH, id, kp, P, TOPW });
    // Q: down to 1536, RMSNorm, up to 64 heads of 256
    weight('W_q_a', 'W_q_a', 'attn', C, qr, null, [qr, C], 'q_a_proj'); data('q_a', 'Q · 先压到 1536 维', 'attn', qr, null, [T, qr]);
    step('proj_q_a', 'Q · 先压到 1536 维', 'attn', 'linear', ['x_attn'], ['W_q_a'], ['q_a'], '1099–1103 · 1169');
    vec('gamma_q_a', 'γ（q_a_layernorm）', 'attn', qr, null, [qr], 'q_a_layernorm.weight'); data('q_resid', 'Q 低秩 · 归一化后', 'attn', qr, null, [T, qr]);
    step('norm_q_a', 'RMSNorm', 'attn', 'elementwise', ['q_a'], ['gamma_q_a'], ['q_resid'], '1104–1106 · 1169 · 67–85', '每个词 1536 维先除均方根，再乘 γ；索引器也读这一块');
    weight('W_q_b', 'W_q_b', 'attn', qr, qk, heads, [NH * qk, qr], 'q_b_proj'); data('Q', 'Q', 'attn', qk, heads, [T, NH, qk], { note: `16384 = 64 头 × ${qk}` });
    step('proj_q_b', 'Q · 展开到 64 头', 'attn', 'linear', ['q_resid'], ['W_q_b'], ['Q'], '1107–1111 · 1170');
    // K and V: one shared 512-number latent per word, RMSNorm, up to 64 heads of (256 K | 256 V)
    weight('W_kv_a', 'W_kv_a', 'attn', C, kr + rope, null, [kr + rope, C], 'kv_a_proj_with_mqa'); data('kv_a', 'K V · 先压到 512 维', 'attn', kr + rope, null, [T, kr + rope]);
    step('proj_kv_a', 'K V · 先压到 512 维', 'attn', 'linear', ['x_attn'], ['W_kv_a'], ['kv_a'], '1113–1117 · 1172–1173', `再切出位置编码部分：qk_rope_head_dim = ${rope}，切出来是空的`);
    vec('gamma_kv_a', 'γ（kv_a_layernorm）', 'attn', kr, null, [kr], 'kv_a_layernorm.weight'); data('c_kv', 'K V 低秩 · 归一化后', 'attn', kr, null, [T, kr]);
    step('norm_kv_a', 'RMSNorm', 'attn', 'elementwise', ['kv_a'], ['gamma_kv_a'], ['c_kv'], '1118 · 1174 · 67–85', '每个词 512 维先除均方根，再乘 γ');
    weight('W_kv_b', 'W_kv_b', 'attn', kr, kn + vd, heads, [NH * (kn + vd), kr], 'kv_b_proj');
    data('KV', 'K | V', 'attn', kn + vd, heads, [T, NH, kn + vd], { split: [kn, vd], note: `每头 ${kn + vd} = K ${kn} | V ${vd}` });
    step('proj_kv_b', 'K V · 展开到 64 头', 'attn', 'linear', ['c_kv'], ['W_kv_b'], ['KV'], '1119–1123 · 1147–1148 · 1177',
      `每头前 ${kn} 维是 K、后 ${vd} 维是 V（1148 行切开）；K 本应再拼上位置编码部分，这里是 ${rope} 维（1152–1154 行）；K、V 存进缓存（1181 行）`);
    // the indexer picks which earlier words each word may look at (every layer's indexer is 'full' in this config)
    weight('W_iq', 'W_iq', 'attn', qr, id, iheads, [IH * id, qr], 'indexer.wq_b'); data('iq', '索引器 Q', 'attn', id, iheads, [T, IH, id], { note: `${IH} 头 × ${id}` });
    step('idx_q', '索引器 Q：32 个头', 'attn', 'linear', ['q_resid'], ['W_iq'], ['iq'], '763 · 799');
    weight('W_ik', 'W_ik', 'attn', C, id, null, [id, C], 'indexer.wk'); data('ik_raw', '索引器 K · 投影', 'attn', id, null, [T, id]);
    step('idx_k', '索引器 K（32 个头共用一个）', 'attn', 'linear', ['x_attn'], ['W_ik'], ['ik_raw'], '764 · 800');
    vec('ln_w', 'k_norm 的 γ', 'attn', id, null, [id], 'indexer.k_norm.weight'); vec('ln_b', 'k_norm 的 β', 'attn', id, null, [id], 'indexer.k_norm.bias');
    data('ik', '索引器 K', 'attn', id, null, [T, id]);
    step('idx_k_norm', 'LayerNorm', 'attn', 'elementwise', ['ik_raw'], ['ln_w', 'ln_b'], ['ik'], '765 · 800', `每个词 ${id} 维减均值、除标准差，再乘 γ、加 β`);
    weight('W_cg', 'W_cg', 'attn', C, id, null, [id, C], 'indexer.index_kpool_compress_gate'); data('cg', '压缩门分数', 'attn', id, null, [T, id]);
    step('idx_gate', '压缩门分数', 'attn', 'linear', ['x_attn'], ['W_cg'], ['cg'], '773 · 802');
    weight('ape', 'ape', 'attn', kp, id, null, [kp, id], 'indexer.index_kpool_compress_ape', { note: `一组 ${kp} 个位置各一行` });
    data('pool_k', `每 ${kp} 个词压成 1 个 K`, 'attn', id, null, [P, id], { rows: { n: P, unit: 'pool', size: kp } });
    step('idx_pool', `每 ${kp} 个词压成 1 个 K`, 'attn', 'pool', ['ik', 'cg'], ['ape'], ['pool_k'], '805 · 826 · 901–974',
      `K、压缩门分数和“有没有这个词”先拼成每个词 ${2 * id + 1} 个数存进缓存（805–812 行）；从第一个词起每 ${kp} 个词一组：压缩门分数加上 ape，在组内 ${kp} 个位置上做 softmax（每个通道各自），按它把 ${kp} 个 K 加权平均；不满 ${kp} 个词的组不算（${T} 个词只有 ${P} 组）`);
    data('iscore', '每个头给每组打分', 'attn', P, iheads, [T, IH, P]);
    step('idx_score', '每个头：Q 点乘每组的 K', 'attn', 'matmul', ['iq', 'pool_k'], [], ['iscore'], '827–828', `× 1/√${id}，再过 relu`);
    weight('W_iw', 'W_iw', 'attn', C, IH, null, [IH, C], 'indexer.weights_proj'); data('iw', '每个头的权重', 'attn', IH, null, [T, IH]);
    step('idx_w', '每个头一个权重', 'attn', 'linear', ['x_attn'], ['W_iw'], ['iw'], '766 · 831', `× 1/√${IH}`);
    data('isum', '每组的总分', 'attn', P, null, [T, P]);
    step('idx_sum', '按头的权重加起来', 'attn', 'matmul', ['iscore', 'iw'], [], ['isum'], '832');
    data('topk', '挑中的词（编号）', 'attn', TOPW, null, [T, TOPW], { note: `最多 ${tc.index_topk} + ${TOPW - tc.index_topk} 个编号，不够的填 −1` });
    step('idx_topk', '挑分数最高的组，加上尾巴', 'attn', 'select', ['isum'], [], ['topk'], '835–879',
      `这个词还看不见的组记最低分；挑前 ${tc.index_topk / kp} 组（${tc.index_topk / kp} × ${kp} = ${tc.index_topk} 个词），再加上最后不满一组的 ≤ ${kp - 1} 个词，不够的位置填 −1。一个词连同它前面的词不超过 ${TOPW} 个时全都看得见（${T} 个词就是这样），从第 ${TOPW + 1} 个词起才真的要挑`);
    data('mask', '能看见哪些词', 'attn', T, null, [T, T], { colsUnit: 'token', causal: true });
    step('mask', '编号 → 遮罩', 'attn', 'scatter', ['topk'], [], ['mask'], '1195–1199 · 1220–1258', '挑中的词记 0（看得见），其余记成这个精度能表示的最小数（1257 行；用 SDPA 时直接是真 / 假）；64 个头共用这一张');
    data('attn_w', '注意力权重', 'attn', T, heads, [NH, T, T], { colsUnit: 'token', causal: true });
    step('attn_w', '每个头：Q·Kᵀ → softmax', 'attn', 'matmul', ['Q', 'KV', 'mask'], [], ['attn_w'], '1205–1214 · 1051–1058', `每个头：Q 点乘每个词的 K（每头 ${kn} 维），× 1/√${qk}，加上遮罩，按行 softmax（用 float32）。eager 路径真的算出并存下这一块（1054–1058 行）；用 SDPA 时在内核里算完就用，不单独存出来`);
    data('attn_o', '注意力核心输出', 'attn', vd, heads, [T, NH, vd]);
    step('attn_v', '按权重把 V 加起来', 'attn', 'matmul', ['attn_w', 'KV'], [], ['attn_o'], '1060–1061');
    weight('W_o', 'W_o', 'attn', vd, C, heads, [C, NH * vd], 'o_proj', { note: `输入侧 16384 = 64 头 × ${vd}，竖着按头切成 64 段`, headAxis: 'y' });
    data('attn_out', '注意力输出', 'attn', C, null, [T, C]);
    step('proj_o', '输出投影：64 头合回 4096 维', 'attn', 'linear', ['attn_o'], ['W_o'], ['attn_out'], '1125–1129 · 1216–1217');
  };

  // ---- feed-forward half, dense SwiGLU (lines 87–105)
  const dense = () => {
    const I = tc.intermediate_size;
    Object.assign(dims, { I });
    weight('W_gate', 'W_gate', 'dense', C, I, null, [I, C], 'mlp.gate_proj'); data('gate_ffn', 'gate', 'dense', I, null, [T, I]);
    step('proj_gate', 'gate 投影', 'ffn', 'linear', ['x_ffn'], ['W_gate'], ['gate_ffn'], '93 · 100');
    weight('W_up', 'W_up', 'dense', C, I, null, [I, C], 'mlp.up_proj'); data('up_ffn', 'up', 'dense', I, null, [T, I]);
    step('proj_up', 'up 投影', 'ffn', 'linear', ['x_ffn'], ['W_up'], ['up_ffn'], '94 · 101');
    data('h_ffn', 'SiLU(gate) × up', 'dense', I, null, [T, I]);
    step('swiglu', '限幅、SiLU、相乘', 'ffn', 'elementwise', ['gate_ffn', 'up_ffn'], [], ['h_ffn'], '102–105', swigluNote);
    weight('W_down', 'W_down', 'dense', I, C, null, [C, I], 'mlp.down_proj'); data('ffn_out', '前馈输出', 'dense', C, null, [T, C]);
    step('proj_down', 'down 投影', 'ffn', 'linear', ['h_ffn'], ['W_down'], ['ffn_out'], '95 · 105');
  };

  // ---- feed-forward half, MoE (lines 187–208): a router, 288 routed experts (8 per word), one shared expert.
  // Which 8 experts a word picks is only known by running the model; the routed data is therefore drawn as the 8 picks
  // of every word (its k-th pick, whichever expert that is), under the stack of all 288 experts' weights.
  const moe = () => {
    const E = tc.n_routed_experts, k = tc.num_experts_per_tok, mi = tc.moe_intermediate_size, si = mi * tc.n_shared_experts, rs = tc.routed_scaling_factor;
    const experts = { n: E, kind: 'expert' }, picks = { n: k, kind: 'pick' };
    Object.assign(dims, { E, k, mi, si });
    weight('W_router', 'W_router', 'router', C, E, null, [E, C], 'mlp.gate.weight'); data('logits', `${E} 个专家的分数`, 'router', E, null, [T, E]);
    step('router', `给 ${E} 个专家打分`, 'ffn', 'linear', ['x_ffn'], ['W_router'], ['logits'], '152 · 160–161', '输入和权重都先转成 float32 再乘（161 行写死；配置里 moe_router_dtype 也是 float32）；专家个数取 n_routed_experts（配置类不在参考代码里，按字段名对应）');
    vec('e_bias', '选专家用的偏置', 'router', E, null, [E], 'mlp.gate.e_score_correction_bias', { standOn: 'logits', note: '缓冲量（nn.Buffer，不是 Parameter），和权重一起存；只影响挑哪 8 个，不进权重' });
    data('topk_i', `挑中的 ${k} 个专家（编号）`, 'router', k, null, [T, k]); data('topk_w', `${k} 个权重`, 'router', k, null, [T, k]);
    step('route', `每个词挑 ${k} 个专家`, 'ffn', 'select', ['logits'], ['e_bias'], ['topk_i', 'topk_w'], '157 · 162–184',
      `分数过 sigmoid；加上偏置后挑前 ${k} 个（n_group = ${tc.n_group}，${E} 个专家就是一组）；权重用不加偏置的分数，${k} 个归一到和为 1，再 × ${rs}`);
    weight('W_gu', '专家的 gate_up', 'expert', C, 2 * mi, experts, [E, 2 * mi, C], 'mlp.experts.gate_up_proj', { routed: true, split: [mi, mi], note: `每个专家 [${2 * mi}, ${C}]：前 ${mi} 行是 gate、后 ${mi} 行是 up` });
    data('e_gu', 'gate | up', 'expert', 2 * mi, picks, [T, k, 2 * mi], { split: [mi, mi], note: `每个词 ${k} 份：第 k 份是它挑中的第 k 个专家算的（k 的顺序就是 topk 给出的顺序，sorted=False，不按分数排）` });
    step('expert_gu', `${k} 个专家各算 gate | up`, 'ffn', 'linear', ['x_ffn', 'topk_i'], ['W_gu'], ['e_gu'], '117 · 128–133', '先按编号把每个词的那一行抄给它挑中的专家（133 行 hidden_states[token_idx]）；每个专家只算抄给它的那几行');
    data('e_h', 'SiLU(gate) × up', 'expert', mi, picks, [T, k, mi]);
    step('expert_swiglu', '限幅、SiLU、相乘', 'ffn', 'elementwise', ['e_gu'], [], ['e_h'], '133 · 138–143', `前一半是 gate、后一半是 up；${swigluNote}`);
    weight('W_dn', '专家的 down', 'expert', mi, C, experts, [E, C, mi], 'mlp.experts.down_proj', { routed: true });
    data('e_out', '× 路由权重', 'expert', C, picks, [T, k, C]);
    step('expert_down', `${k} 个专家各算 down，再乘自己的权重`, 'ffn', 'linear', ['e_h', 'topk_w'], ['W_dn'], ['e_out'], '118 · 134');
    data('routed', `${k} 份相加`, 'expert', C, null, [T, C]);
    step('combine', `每个词把自己的 ${k} 份加起来`, 'ffn', 'sum', ['e_out'], [], ['routed'], '124 · 135 · 206', 'index_add_：按编号加回到每个词的那一行');
    // the shared expert is an ordinary SwiGLU MLP, 2048 wide, that every word goes through (197–199, 207)
    weight('W_s_gate', '共享专家 W_gate', 'expert', C, si, null, [si, C], 'mlp.shared_experts.gate_proj'); data('s_gate', '共享 · gate', 'expert', si, null, [T, si]);
    step('s_gate', '共享专家 · gate 投影', 'ffn', 'linear', ['x_ffn'], ['W_s_gate'], ['s_gate'], '197–199 · 207 · 93 · 100');
    weight('W_s_up', '共享专家 W_up', 'expert', C, si, null, [si, C], 'mlp.shared_experts.up_proj'); data('s_up', '共享 · up', 'expert', si, null, [T, si]);
    step('s_up', '共享专家 · up 投影', 'ffn', 'linear', ['x_ffn'], ['W_s_up'], ['s_up'], '94 · 101');
    data('s_h', '共享 · SiLU(gate) × up', 'expert', si, null, [T, si]);
    step('s_swiglu', '限幅、SiLU、相乘', 'ffn', 'elementwise', ['s_gate', 's_up'], [], ['s_h'], '102–105', swigluNote);
    weight('W_s_down', '共享专家 W_down', 'expert', si, C, null, [C, si], 'mlp.shared_experts.down_proj'); data('s_out', '共享专家输出', 'expert', C, null, [T, C]);
    step('s_down', '共享专家 · down 投影', 'ffn', 'linear', ['s_h'], ['W_s_down'], ['s_out'], '95 · 105');
    data('ffn_out', '前馈输出', 'expert', C, null, [T, C]);
    step('moe_sum', '路由专家 + 共享专家', 'ffn', 'sum', ['routed', 's_out'], [], ['ffn_out'], '207');
  };

  // the MTP layer: one stream, a plain residual (vLLM adds and norms in one kernel; drawn as the add, then the norm)
  const add = (site, half, out, residual, result, src) => {
    data(result, site === 'attn' ? '加回残差（注意力后）' : '加回残差（MTP 层输出）', 'resid', C, null, [T, C]);
    step(`write_${site}`, '加回残差', half, 'sum', [out, residual], [], [result], src, 'MTP 层只有 1 路，没有 mHC：输出直接加到这一半的输入上');
  };
  if (mtp) {
    data('residual_in', 'MTP 层输入（eh_proj 的输出）', 'resid', C, null, [T, C], { note: '只有 1 路：checkpoint 的第 45 层没有 hc_* 权重' });
    norm('attn', 'input_layernorm', 'residual_in', 'input_layernorm', 'vLLM model.py 466–467 · HF 67–85');
    mla();
    add('attn', 'attn', 'attn_out', 'residual_in', 'residual_mid', 'vLLM model.py 473–475');
    norm('ffn', 'post_attention_layernorm', 'residual_mid', 'post_attention_layernorm', 'vLLM model.py 473–475 · HF 67–85');
    moe();
    add('ffn', 'ffn', 'ffn_out', 'residual_mid', 'residual_out', 'vLLM model.py 476–482 · mtp.py 107–110');
  } else {
    data('residual_in', '本层输入 · 4 路残差', 'resid', C, streams, [T, S, C], { note: li === 0 ? '第 0 层的 4 路是同一份词向量复制 4 份（1476 行 expand），之后每层各自不同' : `第 ${li - 1} 层写回的 4 路` });
    mhc('attn', 'attn', 'residual_in', { mix: '279–292', collapse: '295' });
    norm('attn', 'input_layernorm', 'collapsed_attn', 'input_layernorm', '1298 · 67–85');
    if (attnKind === 'kda') kda(); else mla();
    writeBack('attn', 'attn', 'attn_out', 'residual_in', 'residual_mid', '1318–1320');
    mhc('ffn', 'ffn', 'residual_mid', { mix: '279–292', collapse: '295' });
    norm('ffn', 'post_attention_layernorm', 'collapsed_ffn', 'post_attention_layernorm', '1325 · 67–85');
    if (ffnKind === 'dense') dense(); else moe();
    writeBack('ffn', 'ffn', 'ffn_out', 'residual_mid', 'residual_out', '1327–1329');
  }
  const params = tensors.filter(x => x.kind === 'weight').reduce((a, x) => a + x.shape.reduce((p, q) => p * q, 1), 0);
  return { tensors, steps, params, dims, layer: li, attnKind, ffnKind, mhc: !mtp, mtp };
}
export const linearDenseLayer = (tc, T) => layerSpec(tc, T, 0);
