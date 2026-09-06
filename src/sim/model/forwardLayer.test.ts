import { describe, expect, it } from "vitest";
import { analyzeKvPerToken } from "../modelspec/analyze";
import { getPresetSpec } from "../modelspec/presets";
import type { ModelSpec } from "../modelspec/types";
import { at3 } from "../tensor/tensor";
import { Recorder } from "../timeline/recorder";
import type { TensorRecord, Timeline } from "../timeline/types";
import { validateTimeline } from "../timeline/validate";
import { type LazyWeight, lazyWeight, weightAt } from "../weights";
import { FORWARD_CLAIMS } from "./claims";
import { buildLayerTimeline, forwardLayer } from "./forwardLayer";

// ---------- 缩小 spec（H=32）：与 Float64 朴素实现逐元素对拍 ----------

function tinySpec(over: { qkNorm?: boolean; numKvHeads?: number } = {}): ModelSpec {
  const attention = {
    kind: "gqa" as const,
    numHeads: 4,
    numKvHeads: over.numKvHeads ?? 2,
    headDim: 8,
    qkNorm: over.qkNorm ?? true,
    bias: false,
    ropeTheta: 10000,
  };
  return {
    id: "tiny",
    name: "tiny",
    modelType: "qwen3",
    architectures: ["Qwen3ForCausalLM"],
    hidden: 32,
    numLayers: 2,
    vocab: 64,
    tieWordEmbeddings: true,
    rmsNormEps: 1e-6,
    dtype: "float32",
    bytesPerParam: 4,
    initializerRange: 0.02,
    maxPosition: 128,
    layers: [0, 1].map((index) => ({
      index,
      attention,
      mlp: { kind: "dense" as const, intermediate: 48, act: "silu" },
    })),
    numMtpLayers: 0,
    unrecognized: [],
    source: {},
  };
}

type Mat = number[][];
type Heads = number[][][]; // [S][n][d]

/** 独立的 Float64 参考实现：直接按 HF 语义用嵌套数组计算，不复用 ops.ts */
function refForward(spec: ModelSpec, ids: number[]) {
  const l = spec.layers[0];
  if (!l) throw new Error("tiny spec 缺层");
  if (l.mlp.kind !== "dense") throw new Error("tiny spec 需为 dense MLP");
  const a = l.attention;
  const H = spec.hidden;
  const nq = a.numHeads;
  const nkv = a.numKvHeads;
  const d = a.headDim;
  const I = l.mlp.intermediate;
  const S = ids.length;
  const eps = spec.rmsNormEps;
  const std = spec.initializerRange;
  const group = nq / nkv;
  const w = (id: string, shape: [number, number]) => lazyWeight(id, shape, ["", ""], std);
  const E = w("model.embed_tokens", [spec.vocab, H]);
  const Wq = w("L0.attn.q_proj", [H, nq * d]);
  const Wk = w("L0.attn.k_proj", [H, nkv * d]);
  const Wv = w("L0.attn.v_proj", [H, nkv * d]);
  const Wo = w("L0.attn.o_proj", [nq * d, H]);
  const Wg = w("L0.mlp.gate_proj", [H, I]);
  const Wu = w("L0.mlp.up_proj", [H, I]);
  const Wd = w("L0.mlp.down_proj", [I, H]);

  const rms = (row: number[]): number[] => {
    let ss = 0;
    for (const v of row) ss += v * v;
    const inv = 1 / Math.sqrt(ss / row.length + eps);
    return row.map((v) => v * inv);
  };
  const matmul = (X: Mat, W: LazyWeight): Mat =>
    X.map((row) => {
      const out: number[] = [];
      for (let j = 0; j < W.shape[1]; j++) {
        let acc = 0;
        for (let i = 0; i < W.shape[0]; i++) acc += (row[i] ?? 0) * weightAt(W, i, j);
        out.push(acc);
      }
      return out;
    });
  const addM = (A: Mat, B: Mat): Mat => A.map((row, i) => row.map((v, j) => v + (B[i]?.[j] ?? 0)));
  const split = (X: Mat, n: number): Heads =>
    X.map((row) => Array.from({ length: n }, (_, h) => row.slice(h * d, (h + 1) * d)));
  const normHeads = (X: Heads): Heads => X.map((hs) => hs.map(rms));
  const rope = (X: Heads): Heads =>
    X.map((hs, pos) =>
      hs.map((vec) => {
        const out = vec.slice();
        const half = d / 2;
        for (let k = 0; k < half; k++) {
          const ang = pos * a.ropeTheta ** (-(2 * k) / d);
          const c = Math.cos(ang);
          const s = Math.sin(ang);
          const x1 = vec[k] ?? 0;
          const x2 = vec[k + half] ?? 0;
          out[k] = x1 * c - x2 * s;
          out[k + half] = x2 * c + x1 * s;
        }
        return out;
      }),
    );
  const dot = (p: number[], q: number[]) => p.reduce((s, v, i) => s + v * (q[i] ?? 0), 0);

  const x: Mat = ids.map((id) => Array.from({ length: H }, (_, j) => weightAt(E, id, j)));
  const ln1 = x.map(rms);
  const q = matmul(ln1, Wq);
  const k = matmul(ln1, Wk);
  const v = matmul(ln1, Wv);
  let qh = split(q, nq);
  let kh = split(k, nkv);
  const vh = split(v, nkv);
  if (a.qkNorm) {
    qh = normHeads(qh);
    kh = normHeads(kh);
  }
  const qr = rope(qh);
  const kr = rope(kh);
  // scores[h][i][j]
  const scores: Heads = Array.from({ length: nq }, (_, h) =>
    Array.from({ length: S }, (_, i) =>
      Array.from(
        { length: S },
        (_, j) => dot(qr[i]?.[h] ?? [], kr[j]?.[Math.floor(h / group)] ?? []) / Math.sqrt(d),
      ),
    ),
  );
  const probs: Heads = scores.map((tab) =>
    tab.map((row, i) => {
      const m = Math.max(...row.slice(0, i + 1));
      const e = row.map((s, j) => (j <= i ? Math.exp(s - m) : 0));
      const sum = e.reduce((p, c) => p + c, 0);
      return e.map((val) => val / sum);
    }),
  );
  // ctx[i][h][t]
  const ctx: Heads = Array.from({ length: S }, (_, i) =>
    Array.from({ length: nq }, (_, h) => {
      const g = Math.floor(h / group);
      const out = new Array<number>(d).fill(0);
      for (let j = 0; j < S; j++) {
        const p = probs[h]?.[i]?.[j] ?? 0;
        for (let t = 0; t < d; t++) out[t] = (out[t] ?? 0) + p * (vh[j]?.[g]?.[t] ?? 0);
      }
      return out;
    }),
  );
  const merged: Mat = ctx.map((hs) => hs.flat());
  const attnOut = matmul(merged, Wo);
  const res1 = addM(x, attnOut);
  const ln2 = res1.map(rms);
  const gate = matmul(ln2, Wg);
  const up = matmul(ln2, Wu);
  const act: Mat = gate.map((row, i) => row.map((g, j) => (g / (1 + Math.exp(-g))) * (up[i]?.[j] ?? 0)));
  const down = matmul(act, Wd);
  const res2 = addM(res1, down);
  return {
    x,
    ln1,
    q,
    k,
    v,
    qh,
    kh,
    qr,
    kr,
    scores,
    probs,
    ctx,
    merged,
    attnOut,
    res1,
    ln2,
    gate,
    up,
    act,
    down,
    res2,
  };
}

const flatten = (a: unknown): number[] => (Array.isArray(a) ? a.flatMap(flatten) : [a as number]);

function maxAbsDiff(rec: TensorRecord | undefined, ref: number[]): number {
  if (!rec?.data) throw new Error(`张量缺失或无数据：${rec?.id}`);
  if (rec.data.length !== ref.length)
    throw new Error(`${rec.id} 长度 ${rec.data.length} ≠ 参考 ${ref.length}`);
  let m = 0;
  for (let i = 0; i < ref.length; i++) m = Math.max(m, Math.abs((rec.data[i] ?? 0) - (ref[i] ?? 0)));
  return m;
}

const TINY_IDS = [3, 17, 42, 0, 63];

describe("forwardLayer 与 Float64 参考实现对拍（H=32，GQA 4/2，qkNorm）", () => {
  const spec = tinySpec();
  const rec = new Recorder(spec.bytesPerParam);
  const out = forwardLayer(spec, 0, TINY_IDS, rec);
  const ref = refForward(spec, TINY_IDS);
  const T = rec.tensors;
  const TOL = 1e-5;
  const cases: [string, unknown][] = [
    ["L0.x_in", ref.x],
    ["L0.ln1.out", ref.ln1],
    ["L0.attn.q", ref.q],
    ["L0.attn.k", ref.k],
    ["L0.attn.v", ref.v],
    ["L0.attn.q_norm", ref.qh],
    ["L0.attn.k_norm", ref.kh],
    ["L0.attn.q_rope", ref.qr],
    ["L0.attn.k_rope", ref.kr],
    ["L0.attn.scores", ref.scores],
    ["L0.attn.probs", ref.probs],
    ["L0.attn.ctx", ref.ctx],
    ["L0.attn.ctx_merged", ref.merged],
    ["L0.attn.out", ref.attnOut],
    ["L0.res1", ref.res1],
    ["L0.ln2.out", ref.ln2],
    ["L0.mlp.gate", ref.gate],
    ["L0.mlp.up", ref.up],
    ["L0.mlp.act", ref.act],
    ["L0.mlp.down", ref.down],
    ["L0.res2", ref.res2],
  ];
  for (const [id, r] of cases) {
    it(`${id} 逐元素误差 < ${TOL}`, () => {
      expect(maxAbsDiff(T[id], flatten(r))).toBeLessThan(TOL);
    });
  }
  it("因果掩码：j>i 为 −1e30，其余等于原分数", () => {
    const m = T["L0.attn.masked"];
    const s = T["L0.attn.scores"];
    if (!m?.data || !s?.data) throw new Error("缺张量");
    const S = TINY_IDS.length;
    for (let h = 0; h < 4; h++)
      for (let i = 0; i < S; i++)
        for (let j = 0; j < S; j++) {
          const idx = (h * S + i) * S + j;
          if (j > i) expect(m.data[idx]).toBe(Math.fround(-1e30));
          else expect(m.data[idx]).toBe(s.data[idx]);
        }
  });
  it("KV block 拼的是 RoPE 后的 K 与原始 V", () => {
    const kv = T["L0.kv.block"];
    if (!kv?.data) throw new Error("缺张量");
    expect(kv.shape).toEqual([5, 2, 2, 8]);
    const per = 2 * 8;
    for (let s = 0; s < 5; s++) {
      expect(Array.from(kv.data.subarray(s * 2 * per, s * 2 * per + per))).toEqual(
        Array.from(out.k.data.subarray(s * per, (s + 1) * per)),
      );
      expect(Array.from(kv.data.subarray(s * 2 * per + per, (s + 1) * 2 * per))).toEqual(
        Array.from(out.v.data.subarray(s * per, (s + 1) * per)),
      );
    }
  });
  it("返回值 x 就是 res2，k/v 形状 [S,n_kv,d_h]", () => {
    expect(out.x.data).toBe(T["L0.res2"]?.data);
    expect(out.k.shape).toEqual([5, 2, 8]);
    expect(out.v.shape).toEqual([5, 2, 8]);
    expect(out.stepIds).toHaveLength(21);
  });
});

describe("forwardLayer 结构变体", () => {
  it("qkNorm=false 时没有 qknorm 步，共 20 步", () => {
    const spec = tinySpec({ qkNorm: false });
    const rec = new Recorder(4);
    const r = forwardLayer(spec, 0, TINY_IDS, rec);
    expect(r.stepIds).toHaveLength(20);
    expect(r.stepIds).not.toContain("L0.attn.qknorm");
    expect(rec.tensors["L0.attn.q_norm"]).toBeUndefined();
  });
  it("MHA（n_kv = n_q）与 Float64 参考一致", () => {
    const spec = tinySpec({ numKvHeads: 4 });
    const rec = new Recorder(4);
    forwardLayer(spec, 0, TINY_IDS, rec);
    const ref = refForward(spec, TINY_IDS);
    expect(maxAbsDiff(rec.tensors["L0.attn.probs"], flatten(ref.probs))).toBeLessThan(1e-5);
    expect(maxAbsDiff(rec.tensors["L0.res2"], flatten(ref.res2))).toBeLessThan(1e-5);
  });
  it("第二层用 xIn 接上第一层输出：不录 embed，x_in 与 L0.res2 同一份数据", () => {
    const spec = tinySpec();
    const rec = new Recorder(4);
    const r0 = forwardLayer(spec, 0, TINY_IDS, rec);
    const r1 = forwardLayer(spec, 1, TINY_IDS, rec, { xIn: r0.x });
    expect(r1.stepIds[0]).toBe("L1.ln1");
    expect(r1.stepIds).toHaveLength(20);
    expect(rec.tensors["L1.x_in"]?.data).toBe(rec.tensors["L0.res2"]?.data);
    expect(rec.tensors["L1.attn.q_proj"]).toBeDefined();
    const tl: Timeline = {
      chapterId: "test",
      modelId: spec.id,
      modelName: spec.name,
      preset: { id: "t", text: "", tokens: [], ids: TINY_IDS },
      layerIndex: 0,
      tensors: rec.tensors,
      steps: rec.steps,
      buildMs: 0,
    };
    expect(validateTimeline(tl)).toEqual([]);
  });
  it("MoE 层、越界 token、错误层号都抛出明确错误", () => {
    const moe = getPresetSpec("qwen3-30b-a3b");
    expect(() => forwardLayer(moe, 0, [1, 2], new Recorder(2))).toThrow(/MoE/);
    const spec = tinySpec();
    expect(() => forwardLayer(spec, 0, [1, 64], new Recorder(4))).toThrow(/越界/);
    expect(() => forwardLayer(spec, 5, [1], new Recorder(4))).toThrow(/不存在/);
    expect(() => forwardLayer(spec, 0, [], new Recorder(4))).toThrow(/为空/);
  });
});

// ---------- 真实尺寸（Qwen3-0.6B）不变量 ----------

/** [A] 占位 token id（在词表范围内），不代表某句话的真实分词；真实预设句由 tokenizer 离线生成后替换 */
const PLACEHOLDER_IDS = [151644, 872, 198, 108386, 3837, 151645];

it("token id 的逻辑存储使用 int32，不随模型 bf16 改为两字节", () => {
  const ids = [1, 2];
  const tl = buildLayerTimeline(getPresetSpec("qwen3-0.6b"), {
    id: "id-bytes",
    text: "占位",
    tokens: ids.map(String),
    ids,
  });
  expect(tl.tensors.ids!.bytes).toBe(ids.length * 4);
});
const PRESET: Timeline["preset"] = {
  id: "placeholder",
  text: "（占位）",
  tokens: PLACEHOLDER_IDS.map(String),
  ids: PLACEHOLDER_IDS,
};

const EXPECTED_STEPS = [
  "embed.gather",
  "L0.ln1",
  "L0.attn.q",
  "L0.attn.k",
  "L0.attn.v",
  "L0.attn.qknorm",
  "L0.attn.rope",
  "L0.attn.scores",
  "L0.attn.mask",
  "L0.attn.softmax",
  "L0.attn.pv",
  "L0.attn.merge",
  "L0.attn.o",
  "L0.res1",
  "L0.ln2",
  "L0.mlp.gate",
  "L0.mlp.up",
  "L0.mlp.act",
  "L0.mlp.down",
  "L0.res2",
  "L0.kv.write",
];

describe("buildLayerTimeline（Qwen3-0.6B 真实尺寸，S=6）", () => {
  const spec = getPresetSpec("qwen3-0.6b");
  const tl = buildLayerTimeline(spec, PRESET);
  const S = PLACEHOLDER_IDS.length;
  const T = tl.tensors;

  it("步骤顺序与 HANDOFF 约定一致，validateTimeline 无 issue", () => {
    expect(tl.steps.map((s) => s.id)).toEqual(EXPECTED_STEPS);
    expect(validateTimeline(tl)).toEqual([]);
    console.info(`Qwen3-0.6B 单层 S=${S} 生成耗时 ${tl.buildMs.toFixed(0)} ms`);
  });
  it("每步 evidence 非空且都在注册表内；每步都有 lineage 与 tensors", () => {
    for (const s of tl.steps) {
      expect(s.evidence.length).toBeGreaterThan(0);
      for (const e of s.evidence) expect(FORWARD_CLAIMS[e], `${s.id} 引用 ${e}`).toBeDefined();
      expect(s.model.lineage.length).toBeGreaterThan(0);
      expect(s.model.tensors.length).toBeGreaterThan(0);
      expect(s.narration.detail.length).toBeGreaterThan(20);
    }
  });
  it("形状链与 ModelSpec 一致", () => {
    expect(T["L0.x_in"]?.shape).toEqual([S, 1024]);
    expect(T["L0.attn.q_proj"]?.shape).toEqual([1024, 2048]);
    expect(T["L0.attn.q"]?.shape).toEqual([S, 2048]);
    expect(T["L0.attn.k"]?.shape).toEqual([S, 1024]);
    expect(T["L0.attn.v"]?.shape).toEqual([S, 1024]);
    expect(T["L0.attn.q_rope"]?.shape).toEqual([S, 16, 128]);
    expect(T["L0.attn.k_rope"]?.shape).toEqual([S, 8, 128]);
    expect(T["L0.attn.scores"]?.shape).toEqual([16, S, S]);
    expect(T["L0.attn.ctx_merged"]?.shape).toEqual([S, 2048]);
    expect(T["L0.attn.o_proj"]?.shape).toEqual([2048, 1024]);
    expect(T["L0.mlp.gate"]?.shape).toEqual([S, 3072]);
    expect(T["L0.mlp.down_proj"]?.shape).toEqual([3072, 1024]);
    expect(T["L0.res1"]?.shape).toEqual(T["L0.x_in"]?.shape);
    expect(T["L0.res2"]?.shape).toEqual(T["L0.x_in"]?.shape);
    expect(T["model.embed_tokens"]?.shape).toEqual([151936, 1024]);
    expect(T["model.embed_tokens"]?.thumb?.rows).toBe(96);
  });
  it("KV block 字节数 = analyzeKvPerToken 的每层每 token 字节 × S", () => {
    const kv = T["L0.kv.block"];
    expect(kv?.shape).toEqual([S, 2, 8, 128]);
    expect(kv?.bytes).toBe((analyzeKvPerToken(spec).perLayer[0]?.bytes ?? 0) * S);
    expect(kv?.bytes).toBe(4096 * S);
  });
  it("softmax 每行和为 1，被掩码处为 0", () => {
    const p = T["L0.attn.probs"];
    if (!p) throw new Error("缺张量");
    for (let h = 0; h < 16; h++)
      for (let i = 0; i < S; i++) {
        let sum = 0;
        for (let j = 0; j < S; j++) {
          const v = at3({ shape: p.shape, dims: p.dims, data: p.data ?? new Float32Array() }, h, i, j);
          if (j > i) expect(v).toBe(0);
          sum += v;
        }
        expect(Math.abs(sum - 1)).toBeLessThan(1e-5);
      }
  });
  it("RMSNorm：输出行 RMS = sqrt(ms/(ms+ε))（w=1），且与 1 相差 < 0.5%", () => {
    for (const [inId, outId] of [
      ["L0.x_in", "L0.ln1.out"],
      ["L0.res1", "L0.ln2.out"],
    ]) {
      const tin = T[inId ?? ""];
      const tout = T[outId ?? ""];
      if (!tin?.data || !tout?.data) throw new Error("缺张量");
      const H = tout.shape[1] ?? 0;
      for (let s = 0; s < S; s++) {
        let msIn = 0;
        let msOut = 0;
        for (let h = 0; h < H; h++) {
          msIn += (tin.data[s * H + h] ?? 0) ** 2;
          msOut += (tout.data[s * H + h] ?? 0) ** 2;
        }
        msIn /= H;
        const rmsOut = Math.sqrt(msOut / H);
        expect(Math.abs(rmsOut - Math.sqrt(msIn / (msIn + spec.rmsNormEps)))).toBeLessThan(1e-5);
        expect(Math.abs(rmsOut - 1)).toBeLessThan(5e-3);
      }
    }
  });
  it("GQA：Q 头 h 的分数由 K 头 ⌊h/2⌋ 算出（16 个 Q 头共享 8 个 K 头）", () => {
    const q = T["L0.attn.q_rope"];
    const k = T["L0.attn.k_rope"];
    const sc = T["L0.attn.scores"];
    if (!q?.data || !k?.data || !sc?.data) throw new Error("缺张量");
    const d = 128;
    const asT = (r: TensorRecord) => ({ shape: r.shape, dims: r.dims, data: r.data ?? new Float32Array() });
    for (let h = 0; h < 16; h++) {
      const g = Math.floor(h / 2);
      for (let i = 0; i < S; i++)
        for (let j = 0; j < S; j++) {
          let dot = 0;
          for (let t = 0; t < d; t++) dot += at3(asT(q), i, h, t) * at3(asT(k), j, g, t);
          expect(Math.abs(at3(asT(sc), h, i, j) - dot / Math.sqrt(d))).toBeLessThan(1e-4);
        }
    }
  });
  it("确定性：重复生成得到完全相同的数值", () => {
    const again = buildLayerTimeline(spec, PRESET);
    expect(again.tensors["L0.res2"]?.data).toEqual(T["L0.res2"]?.data);
    expect(again.tensors["L0.attn.probs"]?.data).toEqual(T["L0.attn.probs"]?.data);
  });
  it("title ≤ 14 字、brief ≤ 40 字（由 validateTimeline 兜底，这里显式列出最长的）", () => {
    const longestTitle = Math.max(...tl.steps.map((s) => s.title.length));
    const longestBrief = Math.max(...tl.steps.map((s) => s.narration.brief.length));
    expect(longestTitle).toBeLessThanOrEqual(14);
    expect(longestBrief).toBeLessThanOrEqual(40);
  });
});
