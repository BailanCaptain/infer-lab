// Four complete teaching channels of one token, after the residual streams diverge.
const input = [
  [1, 2, 3, 4],
  [1, 2, 5, 8],
  [3, 6, 3, 8],
  [3, 6, 5, 12],
];
const pre = [0.25, 0.25, 0.25, 0.25];
const comb = [
  [0.5, 0.5, 0, 0],
  [0, 0.5, 0.5, 0],
  [0, 0, 0.5, 0.5],
  [0.5, 0, 0, 0.5],
];
const post = [0.25, 0.5, 0.75, 1];
const delta = [2, -2, 4, -4];
const merged = input[0]!.map((_, c) => input.reduce((sum, row, r) => sum + row[c]! * pre[r]!, 0));
const rms = Math.sqrt(merged.reduce((sum, n) => sum + n * n, 0) / merged.length);
const mixed = comb.map((weights) =>
  input[0]!.map((_, c) => input.reduce((sum, row, r) => sum + weights[r]! * row[c]!, 0)),
);
const distributed = post.map((w) => delta.map((n) => w * n));
const output = mixed.map((row, r) => row.map((n, c) => n + distributed[r]![c]!));
export const RESIDUAL_EXAMPLE = {
  input,
  pre,
  comb,
  post,
  delta,
  merged,
  rms,
  normalized: merged.map((n) => n / rms),
  mixed,
  distributed,
  output,
};
export const RESIDUAL_SECONDS = 32;
export const residualNumber = (n: number) => String(Number(n.toFixed(3)));
export const residualRoute = (r: number) => `r${"₀₁₂₃"[r]}`;
export const residualEase = (p: number, start: number, end: number) => {
  const t = Math.max(0, Math.min(1, (p - start) / (end - start)));
  return t * t * (3 - 2 * t);
};
export function residualMotion(step: number, progress: number) {
  const p = Math.max(0, Math.min(1, progress));
  if (step === 0) {
    const at = Math.max(0, Math.min(4, ((p - 0.12) / 0.42) * 4));
    const row = Math.min(3, Math.floor(at));
    return {
      p,
      row,
      local: at - row,
      phase: p < 0.12 ? 0 : p < 0.56 ? 1 : p < 0.78 ? 2 : 3,
      written: p >= 0.96 ? 1 : 0,
      contributions: Math.min(4, Math.floor(at)),
      unfold: residualEase(p, 0.01, 0.11),
      write: residualEase(p, 0.86, 0.96),
    };
  }
  const row = Math.min(3, Math.floor(p * 4));
  const local = p * 4 - row;
  return {
    p,
    row,
    local,
    phase: local < 0.15 ? 0 : local < 0.46 ? 1 : local < 0.68 ? 2 : 3,
    written: row + (local >= 0.96 ? 1 : 0),
    contributions: 0,
    unfold: residualEase(local, 0, 0.15),
    write: residualEase(local, 0.84, 0.96),
  };
}
export function residualFrame(step: number, progress: number) {
  const m = residualMotion(step, progress),
    r = m.row,
    id = residualRoute(r);
  const vec = (row: number[]) => `[${row.map(residualNumber).join(", ")}]`;
  const values: Record<string, string[]> = {
    streams: input.flat().map(String),
    coefficients: pre.map(String),
    delta: delta.map(String),
    comb: comb.flat().map(String),
    post: post.map(String),
  };
  let title: string, equation: string, detail: string;
  if (step === 0) {
    values.merge = merged.map((_, c) =>
      residualNumber(input.slice(0, m.contributions).reduce((s, row, i) => s + row[c]! * pre[i]!, 0)),
    );
    values.norm = [m.p >= 0.73 ? residualNumber(rms) : "?"];
    values.out = m.written ? RESIDUAL_EXAMPLE.normalized.map(residualNumber) : merged.map(() => "?");
    title = [
      "同一个 token，四条不同的残差流",
      `${id} 的贡献，按通道加进同一位置`,
      "从合成向量求一个共同的缩放量",
      m.written ? "一路输入已写回，四路旁路仍保留" : "四个通道同除 RMS，再写入子层入口",
    ][m.phase]!;
    const normEq = [
      `2² + 4² + 4² + 8² = ${m.p >= 0.66 ? "100" : "…"}`,
      `均方 = ${m.p >= 0.69 ? "100 / 4 = 25" : m.p >= 0.66 ? "100 / 4 = …" : "…"}`,
      `RMS = ${m.p >= 0.73 ? "√25 = 5" : m.p >= 0.69 ? "√25 = ?" : "?"}`,
    ].join("\n");
    equation = [
      input.map((row, i) => `${residualRoute(i)} ${vec(row)}`).join("\n"),
      `${vec(input[r]!)} × ¼ = ${m.local >= 0.38 ? vec(input[r]!.map((n) => n / 4)) : "[?, ?, ?, ?]"}\n累计 ${m.contributions}/4 路 → [${values.merge.join(", ")}]`,
      normEq,
      `[2, 4, 4, 8] ÷ 5 × γ\nγ = [1, 1, 1, 1]\n→ ${m.p >= 0.84 ? "[0.4, 0.8, 0.8, 1.6]" : "[?, ?, ?, ?]"}`,
    ][m.phase]!;
    detail = [
      "r₀–r₃ 是同一个 token 的四条残差流，用来保留层间传递的信息。每条含四个通道 c0–c3，不是四个 token。pre 是合成系数，决定每路给子层输入贡献多少；问号表示尚未计算。",
      "pre 为每一路指定合成比例，本例四路各取¼；同一通道相加。取出的是计算副本，原始四路沿旁路保留，供出口混合。",
      m.p >= 0.73
        ? "四个通道全部参与平方、求平均和开根号。共同的 RMS=5 同时缩放四格，输入输出始终是 1×4。"
        : "四个通道依次平方、求平均并开根号，算出共同缩放量 RMS 后再同时缩放四格，输入输出始终是 1×4。",
      "RMSNorm 把整行除以均方根 RMS，再乘逐通道增益 γ（本例全为1）。完整四格写回输出槽并交给子层，四条原始向量沿旁路保留。",
    ][m.phase]!;
  } else {
    values.mixed = mixed.flatMap((row, i) =>
      i < r || (i === r && m.local >= 0.44) ? row.map(residualNumber) : row.map(() => "?"),
    );
    values.distributed = distributed.flatMap((row, i) =>
      i < r || (i === r && m.local >= 0.66) ? row.map(residualNumber) : row.map(() => "?"),
    );
    values.out = output.flatMap((row, i) => (i < m.written ? row.map(residualNumber) : row.map(() => "?")));
    const sources = comb[r]!.map((w, i) => (w ? `${w} × ${vec(input[i]!)}` : null))
      .filter(Boolean)
      .join(" + ");
    title =
      m.p === 1
        ? "四路写回完成，交给下一层"
        : [
            `展开 ${id} 的两条计算支路`,
            `${id}：comb 混合旧的四路`,
            `${id}：post 分配子层输出 Δ`,
            `${id}：同通道相加，写回原位`,
          ][m.phase]!;
    const pending = "[?, ?, ?, ?]";
    equation = [
      "r′ = comb × r + post × Δ\n每一路分别得到一条新向量",
      `${sources}\n= ${m.local >= 0.44 ? vec(mixed[r]!) : pending}`,
      `${post[r]} × ${vec(delta)} = ${m.local >= 0.66 ? vec(distributed[r]!) : pending}`,
      `${vec(mixed[r]!)} + ${vec(distributed[r]!)}\n= ${m.local >= 0.82 ? vec(output[r]!) : pending}`,
    ][m.phase]!;
    detail = [
      "r 是原来的四路，Δ 是子层算出的一条输出。comb 决定旧四路怎样混合，post 决定 Δ 向每路写入多少；r′ 是更新后的四路。系数在子层入口计算，本图给定示意值。",
      "图中 comb 的行对应新流、列对应旧流。选中一行，把各旧流按系数混合；同通道相加，通道之间不串位。",
      "Δ 是同一个子层输出。post 的每一项决定给这一路写入多少，负的通道仍保留负号。",
      "旧流的混合结果与分配后的 Δ，按对应通道逐格相加。更新向量返回同色的输出槽，已完成的其他路一直保留。",
    ][m.phase]!;
  }
  return {
    phase: m.phase,
    title,
    equation,
    detail,
    tensors: [],
    values,
    active: {} as Record<string, number[]>,
  };
}
