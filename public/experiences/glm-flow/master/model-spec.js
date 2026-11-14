// The whole of GLM-5.3-Flash for one step of generation (the master, since 2026-09-25): the 45 layers and the MTP layer as
// truth-spec.js lists them, and the steps at the two ends, each from the official sources in ../reference/:
//   modeling_glm5_next.py        the HF modeling file: the vocabulary, the 45 layers, hc_head, the final norm, lm_head
//   checkpoint-shapes.json       every tensor's shape in the checkpoint (layer 45 is the MTP layer; there is no second
//                                vocabulary or output head for it)
//   vllm-glm5next/               the official serving code of the MTP layer (the HF file has none): mtp.py,
//                                fused_eh_norm.py, and llm_base_proposer.py (how the MTP's words are shifted)
//   generation_config.json       how the next word is picked
// `src` of a step at the ends: HF line numbers, or "vLLM <file> <lines>".
//
// One step of generation, as drawn: the sentence's words (their ids) → the vocabulary → 4 streams → 45 layers → hc_head
// (the 4 streams averaged) → RMSNorm → the output head, for the last word only → softmax → the next word. Then the MTP
// layer guesses the word after it: the sentence moved on by one word (with the new word at its end) looked up in the
// same vocabulary, and the main model's last hidden states, each normed, side by side → eh_proj → one MLA + MoE layer
// with one stream → RMSNorm → the same output head → the highest score is the draft.
import { layerSpec } from './truth-spec.js';

export const lid = i => 'L' + String(i).padStart(2, '0');

export function modelSpec(tc, T) {
  const N = tc.num_hidden_layers, M = tc.num_nextn_predict_layers, C = tc.hidden_size, V = tc.vocab_size, S = tc.hc_mult;
  const layers = Array.from({ length: N + M }, (_, i) => layerSpec(tc, T, i));
  const tensors = [], steps = [], at = (i, id) => `${lid(i)}:${id}`;
  const words = n => ({ n, unit: 'token' }), dim = n => ({ n, unit: 'dim' });
  const data = (id, name, comp, n, cols, shape, extra = {}) => tensors.push({ id, name, kind: 'data', comp, rows: words(n), cols, deck: null, shape, ...extra });
  const weight = (id, name, comp, rowsIn, cols, shape, code, extra = {}) => tensors.push({ id, name, kind: 'weight', comp, rows: dim(rowsIn), cols, deck: null, shape, code, ...extra });
  const vec = (id, name, comp, cols, code) => tensors.push({ id, name, kind: 'weight', comp, rows: dim(1), cols, deck: null, shape: [cols], code, vector: true });
  const step = (id, title, part, op, reads, params, writes, src, merged = '') => steps.push({ id, title, part, op, reads, params, writes, src, merged });

  // ---- in: the words → the vocabulary → 4 streams into layer 0
  data('ids', '句子里的词（编号）', 'embed', T, 1, [T], { note: '每个词一个编号（官方 tokenizer.json）' });
  weight('W_embed', '词表', 'embed', V, C, [V, C], 'embed_tokens.weight', { note: `${V} 个词，每个词一行 ${C} 个数；和输出头不共用（tie_word_embeddings = false）` });
  data('x0', '词向量', 'embed', T, C, [T, C]);
  step('embed', '按编号查词表', 'in', 'gather', ['ids'], ['W_embed'], ['x0'], '1416 · 1447', '每个词取词表里自己那一行');
  step('expand', '复制成 4 路', 'in', 'streams', ['x0'], [], [at(0, 'residual_in')], '1476', `同一份词向量复制 ${S} 份，进第 0 层`);

  // ---- out: the 4 streams of the last layer → one → RMSNorm → the output head (last word) → softmax → the next word
  data('h_mean', '4 路取平均', 'resid', T, C, [T, C]);
  step('hc_head', '4 路取平均', 'out', 'streams', [at(N - 1, 'residual_out')], [], ['h_mean'], '299–303 · 1492', '没有权重，4 路直接取平均（代码注释：和 DeepSeek-V4 不同）');
  vec('gamma_final', 'γ（最后的 norm）', 'norm', C, 'norm.weight');
  data('h_final', '最后的隐藏状态', 'norm', T, C, [T, C]);
  step('norm_final', 'RMSNorm', 'out', 'elementwise', ['h_mean'], ['gamma_final'], ['h_final'], '1420 · 1492 · 67–85', '每个词先除均方根，再乘 γ');
  weight('W_head', '输出头', 'embed', C, V, [V, C], 'lm_head.weight', { note: `${V} 个词各一行；MTP 也用它（checkpoint 里只有这一份）` });
  data('logits', '每个词的分数（最后一个词）', 'embed', 1, V, [1, V]);
  step('head', '输出头：给词表里每个词打分', 'out', 'linear', ['h_final'], ['W_head'], ['logits'], '2115 · 2219–2221', '生成时只算最后一个词：2220 行只取最后 logits_to_keep 行；forward 默认是 0（全要，2165 行），transformers 的 generate 传 1');
  data('probs', '概率', 'embed', 1, V, [1, V]);
  step('softmax', 'softmax 成概率', 'out', 'elementwise', ['logits'], [], ['probs'], 'generation_config.json', `temperature 1.0：分数不缩放；softmax 后 ${V} 个概率加起来是 1`);
  data('next_id', '选出的下一个词', 'embed', 1, 1, [1]);
  step('sample', '选出下一个词', 'out', 'select', ['probs'], [], ['next_id'], 'generation_config.json', '官方 generation_config 给的默认采样是 temperature 1.0、top_p 0.95：留下概率从高到低、加起来刚到 95% 的最少那些词，重新归一，再按概率抽一个（vLLM 这类服务拿它当默认；HF generate 不设 do_sample 时是直接取最高分）；接到句子末尾');

  // ---- MTP: the word after next (layer 45 of the checkpoint)
  const K = N;   // the MTP layer's index
  vec('gamma_h', 'γ（hnorm）', 'norm', C, `layers.${K}.hnorm.weight`);
  data('h_n', '隐藏状态 · 归一化', 'norm', T, C, [T, C]);
  step('hnorm', 'RMSNorm（主模型的隐藏状态）', 'mtp', 'elementwise', ['h_final'], ['gamma_h'], ['h_n'], 'vLLM mtp.py 95 · fused_eh_norm.py', '每个词都用：主模型最后的隐藏状态（已过最后的 norm）');
  data('e_mtp', '往后挪一个词的词向量', 'embed', T, C, [T, C]);
  step('mtp_embed', '句子往后挪一个词，查同一张词表', 'mtp', 'gather', ['ids', 'next_id'], ['W_embed'], ['e_mtp'], 'vLLM llm_base_proposer.py 844–847 · 1466–1468 · 1498–1501 · mtp.py 171',
    '第 t 个位置放第 t+1 个词，最后一个位置放刚选出的词；词表就是主模型那一张（vLLM 直接共用，checkpoint 里 MTP 没有自己的词表）');
  vec('gamma_e', 'γ（enorm）', 'norm', C, `layers.${K}.enorm.weight`);
  data('e_n', '词向量 · 归一化', 'norm', T, C, [T, C]);
  step('enorm', 'RMSNorm（词向量）', 'mtp', 'elementwise', ['e_mtp'], ['gamma_e'], ['e_n'], 'vLLM mtp.py 95 · fused_eh_norm.py', '句子第 0 个位置的词向量先置 0，再归一化');
  weight('W_eh', 'eh_proj', 'mtp', 2 * C, C, [C, 2 * C], `layers.${K}.eh_proj.weight`, { split: [C, C], note: `输入 ${2 * C} = 词向量 ${C} | 隐藏状态 ${C}` });
  step('eh_proj', '拼起来，压回 4096 维', 'mtp', 'linear', ['e_n', 'h_n'], ['W_eh'], [at(K, 'residual_in')], 'vLLM mtp.py 95–103 · fused_eh_norm.py', `两块并排拼成 ${2 * C} 维（词向量在前），乘 eh_proj`);
  vec('gamma_sh', 'γ（shared_head.norm）', 'norm', C, `layers.${K}.shared_head.norm.weight`);
  data('h_mtp', 'MTP 的隐藏状态', 'norm', T, C, [T, C]);
  step('shared_norm', 'RMSNorm', 'mtp', 'elementwise', [at(K, 'residual_out')], ['gamma_sh'], ['h_mtp'], 'vLLM mtp.py 107–110', '（vLLM 把 MTP 层最后的加回残差和这一步合成一个核）');
  data('logits_mtp', 'MTP：每个词的分数（最后一个词）', 'embed', 1, V, [1, V]);
  step('mtp_head', '同一个输出头打分', 'mtp', 'linear', ['h_mtp'], ['W_head'], ['logits_mtp'], 'vLLM mtp.py 181–191 · llm_base_proposer.py 1546–1571 · 615', '只算最后一个词；输出头就是主模型的 lm_head（shared_head.head 不另存）');
  data('draft_id', '草稿：再下一个词', 'embed', 1, 1, [1]);
  step('draft', '取分数最高的词当草稿', 'mtp', 'select', ['logits_mtp'], [], ['draft_id'], 'vLLM llm_base_proposer.py 438–448 · 478–484', '不开 probabilistic 草稿采样时取最高分（258–261、483–484）；下一步主模型一起验证它');

  // layer i's input is layer i−1's output: the loop hands hidden_states on (1478–1490)
  const alias = {}; for (let i = 1; i < N; i++) alias[at(i, 'residual_in')] = at(i - 1, 'residual_out');
  const MTP_OWN = ['gamma_h', 'gamma_e', 'W_eh', 'gamma_sh'];
  const own = tensors.filter(t => t.kind === 'weight' && !MTP_OWN.includes(t.id)).reduce((a, t) => a + t.shape.reduce((p, q) => p * q, 1), 0);
  const params = { layers: layers.slice(0, N).reduce((a, l) => a + l.params, 0), mtp: layers.slice(N).reduce((a, l) => a + l.params, 0) + MTP_OWN.reduce((a, id) => a + tensors.find(t => t.id === id).shape.reduce((p, q) => p * q, 1), 0), ends: own };
  return { layers, ends: { tensors, steps }, alias, params, dims: { N, M, C, V, T, S } };
}
