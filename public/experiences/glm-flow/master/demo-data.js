// The made-up numbers of layer 0 (09-26; the user: "我们不需要真正的数字……编造数据演示每个部分怎么算的"): the weights are
// invented by one rule (demo/weights.json), every result is the official formula of the step before (demo/make_l00.py
// computed them into demo/l00.bin). The page shows any weight by making it again from the rule, and any result from the
// file, so a dot product it writes out (dot(this row, this column) = 0.37) is true to the numbers it shows.
const M1 = 0x7feb352d, M2 = 0x846ca68b;
export function lowbias32(x) {
  x = x >>> 0;
  x ^= x >>> 16; x = Math.imul(x, M1) >>> 0;
  x ^= x >>> 15; x = Math.imul(x, M2) >>> 0;
  x ^= x >>> 16;
  return x >>> 0;
}
export function fnv1a(s) {
  let h = 0x811c9dc5;
  for (const b of new TextEncoder().encode(s)) h = Math.imul(h ^ b, 0x01000193) >>> 0;
  return h >>> 0;
}

// load(base): {W (the rule's table), get(id) → {a: Float32Array, shape}, at(id, …ix), weight(name, …ix), row(name, r)}
export async function loadDemo(base = new URL('./demo/continuous/', import.meta.url)) {
  const [W, idx, bin, idx4, bin4, idx3, bin3, endidx, endbin, chain] = await Promise.all([
    fetch(new URL('weights.json', base)).then(r => r.json()),
    fetch(new URL('l00.json', base)).then(r => r.json()),
    fetch(new URL('l00.bin', base)).then(r => r.arrayBuffer()),
    fetch(new URL('l04.json', base)).then(r => r.json()),
    fetch(new URL('l04.bin', base)).then(r => r.arrayBuffer()),
    fetch(new URL('l03.json', base)).then(r => r.json()),
    fetch(new URL('l03.bin', base)).then(r => r.arrayBuffer()),
    fetch(new URL('ends.json', base)).then(r => r.json()),
    fetch(new URL('ends.bin', base)).then(r => r.arrayBuffer()),
    fetch(new URL('chain.json', base)).then(r => {if(!r.ok)throw Error('Missing continuous layer data');return r.json()}),
  ]);
  const demo = makeDemo(W, idx, new Float32Array(bin));
  demo.layers = { 3: makeDemo(idx3.weights, idx3, new Float32Array(bin3)), 4: makeDemo(idx4.weights, idx4, new Float32Array(bin4)) };
  demo.chain = chain;
  demo.ends = makeDemo(endidx.weights, endidx, new Float32Array(endbin));
  return demo;
}
export function makeDemo(W, idx, all) {
  const seeds = new Map();
  const seedOf = name => { if (!seeds.has(name)) seeds.set(name, lowbias32(fnv1a(name))); return seeds.get(name) };
  const flat = (shape, ix) => ix.reduce((a, v, k) => a * shape[k] + v, 0);
  // one weight: element i (row-major in the official shape) = scale × u + add, rounded to float32 as the file's were
  // (rows: some rows' scale × their own factor)
  function weight(name, ...ix) {
    const t = W.tensors[name]; if (!t) throw new Error('no weight ' + name);
    const i = ix.length === 1 ? ix[0] : flat(t.shape, ix), u = (lowbias32((i ^ seedOf(t.seedName||name) ^ (t.hashHigh ? lowbias32(Math.floor(i / 2 ** 32)) : 0)) >>> 0) >>> 8) / 2 ** 23 - 1;
    const k = t.rows ? t.rows[Math.floor(i / t.shape.slice(1).reduce((a, b) => a * b, 1))] ?? 1 : 1;
    return Math.fround(t.scale * k * u + (t.add || 0));
  }
  function row(name, r) { const t = W.tensors[name], n = t.shape.slice(1).reduce((a, b) => a * b, 1), out = new Float32Array(n); for (let c = 0; c < n; c++) out[c] = weight(name, r * n + c); return out }
  function get(id) { const t = idx.tensors[id]; if (!t) throw new Error('no tensor ' + id); const n = t.shape.reduce((a, b) => a * b, 1); return { a: all.subarray(t.off, t.off + n), shape: t.shape } }
  function at(id, ...ix) { const { a, shape } = get(id); return a[flat(shape, ix)] }
  // KDA of head h, word by word (official recurrent_kimi_delta_attention, 430–480; make_l00.py the same): for each word t
  // {q, k (L2-normalised; q × 1/√d), v, eg (e^g), beta, old (S before), dec (S × e^g, row r by eg[r]), mem (what S recalls
  // for k), delta ((v − mem) × β), S (after the write), o (read with q)}; S is [d (k's channels), d (v's)], row-major
  const kdaMemo = new Map();
  function kdaHead(h) {
    if (kdaMemo.has(h)) return kdaMemo.get(h);
    const T = idx.ids.length, H = get('beta').shape[1], d = get('Q_conv').shape[1] / H, out = [];
    const part = (id, t) => Array.from({ length: d }, (_, i) => at(id, t, h * d + i));
    const l2 = a => { const n = Math.sqrt(a.reduce((s, v) => s + v * v, 0) + 1e-6); return a.map(v => v / n) };
    let S = new Float64Array(d * d);
    for (let t = 0; t < T; t++) {
      const q = l2(part('Q_conv', t)).map(v => v / Math.sqrt(d)), k = l2(part('K_conv', t)), v = part('V_conv', t), eg = part('g', t).map(Math.exp), beta = at('beta', t, h);
      const old = S, dec = new Float64Array(d * d);
      for (let r = 0; r < d; r++) for (let c = 0; c < d; c++) dec[r * d + c] = old[r * d + c] * eg[r];
      const mem = Array.from({ length: d }, (_, c) => { let s = 0; for (let r = 0; r < d; r++) s += dec[r * d + c] * k[r]; return s });
      const delta = mem.map((m, c) => (v[c] - m) * beta);
      S = new Float64Array(d * d);
      for (let r = 0; r < d; r++) for (let c = 0; c < d; c++) S[r * d + c] = dec[r * d + c] + k[r] * delta[c];
      const o = Array.from({ length: d }, (_, c) => { let s = 0; for (let r = 0; r < d; r++) s += S[r * d + c] * q[r]; return s });
      out.push({ q, k, v, eg, beta, old, dec, mem, delta, S, o });
    }
    kdaMemo.set(h, out); return out;
  }
  return { W, ids: idx.ids, get, at, weight, row, kdaHead, has: id => !!idx.tensors[id] };
}
