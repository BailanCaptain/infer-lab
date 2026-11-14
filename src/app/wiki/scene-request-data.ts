/** R1 is the symbolic four-position example in one-request.md, not a live model trace. */
export const REQUEST_SECONDS = 28;
export const REQUEST_JOURNEY_STARTS = [0, REQUEST_SECONDS, REQUEST_SECONDS * 2, REQUEST_SECONDS * 3];
// The first return is already shown in section 2; continue with batch 2 instead of rewinding it.
export const REQUEST_JOURNEY_SECONDS = REQUEST_SECONDS * 3.75;
export function requestJourneyPosition(seconds: number) {
  const time = Math.max(0, Math.min(REQUEST_JOURNEY_SECONDS, Number.isFinite(seconds) ? seconds : 0));
  const step = Math.min(3, Math.floor(time / REQUEST_SECONDS));
  return {
    time,
    step,
    progress: (time - REQUEST_JOURNEY_STARTS[step]!) / REQUEST_SECONDS + (step === 3 ? 0.25 : 0),
  };
}
export const REQUEST_INPUT = ["p₀", "p₁", "p₂", "p₃"];
export const REQUEST_SENTENCE = "请用一句话解释 KV cache。";
// Illustrative decoding only: the real tokenizer does not map this sentence to four positions.
export const REQUEST_OUTPUT_BATCHES = [
  { ids: ["y₀"], text: "先" },
  { ids: ["y₁", "y₂"], text: "解释缓存作用。" },
  { ids: ["y₃", "y₄", "y₅", "y₆"], text: "</think>KV cache 复用历史信息，减少重复计算。" },
];
export const REQUEST_BODY = {
  model: "glm",
  messages: [{ role: "user", content: REQUEST_SENTENCE }],
  stream: true,
  max_tokens: 200,
};
export const REQUEST_STRUCTURE = [
  { id: "api", title: "API 接口服务", x: -5.7, y: 5.3 },
  { id: "engine", title: "Engine · 调度", x: -1.9, y: 5.3 },
  { id: "embed", title: "Embedding", x: 1.9, y: 5.3 },
  { id: "layers", title: "45 层主干", x: 5.7, y: 5.3 },
  { id: "client", title: "客户端", x: -5.7, y: 2.3 },
  { id: "cache", title: "历史状态 / 缓存", x: -1.9, y: 2.3 },
  { id: "sample", title: "采样 / 多词预测", x: 1.9, y: 2.3 },
  { id: "head", title: "归一化 / 输出头", x: 5.7, y: 2.3 },
] as const;
export type RequestNode = (typeof REQUEST_STRUCTURE)[number]["id"];
export const REQUEST_EDGES: [RequestNode, RequestNode][] = [
  ["client", "api"],
  ["api", "engine"],
  ["engine", "embed"],
  ["embed", "layers"],
  ["layers", "head"],
  ["head", "sample"],
  ["engine", "api"],
  ["api", "client"],
  ["engine", "cache"],
  ["cache", "layers"],
  ["sample", "engine"],
];
const origins: RequestNode[][] = [
  ["api", "engine", "cache", "embed"],
  ["embed", "layers", "head", "head"],
  ["sample", "sample", "engine", "engine"],
  ["api", "api", "api", "engine"],
];
const locations = [
  ["API · 模板与 tokenizer", "EngineCore · DP0 请求队列", "EngineCore · 缓存分配", "DP0 · TP8 worker 输入"],
  ["模型入口 · Embedding 查表", "主干 · 45 层与历史状态", "主干出口 · 最后位置归约", "输出头 · 投影到词表"],
  ["worker · 采样", "worker · MTP 候选", "Engine → API → 客户端", "Engine · 下一轮输入计划"],
  ["API · 第 1 批输出", "API · 第 2 批输出", "API · 第 3 批输出", "Engine 结束 → API 收尾"],
];
export const requestClamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
export const requestEase = (n: number) => {
  const t = requestClamp(n);
  return t * t * (3 - 2 * t);
};
/** Each seven-second beat gives the input a preview, a flight, and a stationary landing. */
export function requestHandoff(local: number) {
  const t = requestClamp(local);
  return {
    phase: t < 0.055 ? "preview" : t < 0.2 ? "moving" : t < 0.255 ? "settled" : "computing",
    motion: requestEase((t - 0.055) / 0.145),
    work: requestClamp((t - 0.255) / 0.62),
  } as const;
}
export const REQUEST_HANDOFF_LABELS = {
  preview: "输入槽位已点亮",
  moving: "数据正在接入",
  settled: "已就位，准备计算",
  computing: "正在计算",
};
export function requestStreamState(progress: number) {
  const p = requestClamp(progress),
    phase = Math.min(3, Math.floor(p * 4));
  const { work } = requestHandoff(p === 1 ? 1 : p * 4 - phase);
  const batch = REQUEST_OUTPUT_BATCHES[Math.min(2, phase)]!;
  const decoding = phase === 1 || phase === 2;
  const verified = work >= (decoding ? 0.48 : 0.2);
  const confirmed = REQUEST_OUTPUT_BATCHES.slice(0, phase + (verified ? 1 : 0)).flatMap((b) => b.ids);
  const decoded = phase === 3 || work >= (decoding ? 0.65 : 0.4);
  const delivered = phase === 3 || work >= (decoding ? 0.85 : 0.65);
  const generation = decoding
    ? {
        input: phase === 1 ? ["y₀", "d₁?", "d₂?", "d₃?"] : ["y₂", "d₁′?", "d₂′?", "d₃′?"],
        positions: phase === 1 ? [4, 5, 6, 7] : [6, 7, 8, 9],
        layers: Math.floor(requestClamp(work / 0.22) * 45),
        checked: Math.floor(requestClamp((work - 0.22) / 0.26) * (phase === 1 ? 2 : 4)),
        verified,
        computed: work < 0.22 ? (phase === 1 ? 4 : 6) : phase === 1 ? (verified ? 6 : 8) : 10,
      }
    : null;
  const clientText = REQUEST_OUTPUT_BATCHES.slice(0, phase + (delivered ? 1 : 0))
    .map((b) => b.text)
    .join("");
  const cacheReleased = phase === 3 && work >= 0.25;
  const finished = phase === 3 && work >= 0.65;
  const done = phase === 3 && work >= 0.9;
  const sse = done
    ? "data: [DONE]\n\n"
    : finished
      ? 'data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n'
      : delivered
        ? `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: batch.text } }] })}\n\n`
        : phase === 0 && decoded
          ? 'data: {"choices":[{"index":0,"delta":{"role":"assistant","content":""}}]}\n\n'
          : "等待下一段增量文字";
  return {
    phase,
    work,
    generation,
    preparingNext: phase === 1 && work > 0.92,
    confirmed,
    currentIds: verified ? batch.ids : [],
    decoded,
    delivered,
    deltaText: decoded ? batch.text : "",
    clientText,
    sse,
    cacheReleased,
    finished,
    done,
  };
}
export function requestState(section: number, progress: number) {
  const p = requestClamp(progress),
    phase = Math.min(3, Math.floor(p * 4));
  const local = p === 1 ? 1 : p * 4 - phase;
  const handoff = requestHandoff(local);
  const { work } = handoff;
  // Only the initial input unfolds. Subsequent operations inherit the preceding output in place.
  const expansion = section === 0 && phase === 0 ? requestEase(local / 0.15) : 1;
  const stream = section === 3 ? requestStreamState(p) : null;
  const reached = (part: number, at: number, fraction = 1) =>
    section > part || (section === part && (phase > at || (phase === at && work >= fraction)));
  const input = [...REQUEST_INPUT];
  const sampled = reached(2, 0, 0.65),
    appended = reached(2, 2, 0.35);
  const draftCount = section === 2 && phase === 1 ? Math.min(3, Math.floor(work * 3)) : reached(2, 1) ? 3 : 0;
  const layersDone =
    section === 1 && phase === 1
      ? Math.min(45, Math.floor(requestClamp((work - 0.2) / 0.8) * 45))
      : reached(1, 1)
        ? 45
        : 0;
  return {
    section,
    phase,
    local,
    handoff,
    work,
    expansion,
    origin: stream?.preparingNext
      ? ("engine" as RequestNode)
      : stream?.generation && work < 0.62
        ? ((work < 0.22 ? "layers" : "sample") as RequestNode)
        : origins[section]![phase]!,
    location: stream?.preparingNext
      ? "Engine · 下一圈输入准备"
      : stream?.generation && work < 0.62
        ? work < 0.22
          ? "下一轮 · 主干前向与四行分数"
          : "worker · 逐位验证候选"
        : locations[section]![phase]!,
    stream,
    input,
    tokenized: reached(0, 0),
    queued: reached(0, 1, 0.4),
    allocatedBlocks: reached(0, 2) ? 15 : section === 0 && phase === 2 ? Math.floor(work * 15) : 0,
    streams: reached(1, 1, 0.15) ? 4 : 1,
    layersDone,
    cachedPositions: reached(1, 1) ? 4 : section === 1 && phase === 1 ? Math.min(4, Math.floor(work * 5)) : 0,
    selectedPosition: reached(1, 2, 0.1) ? 3 : null,
    sampled,
    drafts: ["d₁?", "d₂?", "d₃?"].slice(0, draftCount),
    draftInput: draftCount === 0 ? "y₀" : draftCount === 1 ? "d₁?" : "d₂?",
    draftHidden: draftCount === 0 ? "h₃" : draftCount === 1 ? "hᴹ₁" : "hᴹ₂",
    confirmed: appended ? [...input, "y₀"] : input,
    computed: stream?.generation?.computed ?? (section === 3 && phase === 3 ? 10 : reached(1, 1) ? 4 : 0),
    returned: reached(2, 2, 0.8) ? ["y₀"] : [],
    nextInput: reached(2, 3, 0.7) ? ["y₀", "d₁?", "d₂?", "d₃?"] : [],
    nextPositions: reached(2, 3, 0.7) ? [4, 5, 6, 7] : [],
  };
}
export type RequestState = ReturnType<typeof requestState>;

export function requestStatus(s: RequestState) {
  return s.stream?.done
    ? "回答已返回，流程结束"
    : s.work === 1
      ? "本步已完成"
      : REQUEST_HANDOFF_LABELS[s.handoff.phase];
}

export function requestPreviousState(s: RequestState) {
  const index = s.section === 3 && s.phase === 1 ? 11 : s.section * 4 + s.phase - 1;
  return index < 0 ? undefined : requestState(Math.floor(index / 4), ((index % 4) + 0.99999) / 4);
}

/** Guides and ports share the data's playback clock, including seeking and pausing. */
export function requestBinding(s: RequestState) {
  if (s.stream?.generation) {
    const start = s.stream.preparingNext ? 0.92 : s.work >= 0.62 ? 0.62 : s.work >= 0.22 ? 0.22 : null;
    if (start !== null) {
      const from: RequestNode = start === 0.92 ? "api" : start === 0.62 ? "sample" : "layers";
      const mix = requestEase((s.work - start) / 0.08);
      return { from, to: s.origin, mix, output: mix };
    }
  }
  const previous = requestPreviousState(s);
  return {
    from: previous?.origin ?? s.origin,
    to: s.origin,
    mix: previous ? s.handoff.motion : 1,
    output: previous ? requestEase((s.local - 0.2) / 0.055) : 1,
  };
}

const transfers = [
  ["客户端 → API", "一句话先套对话模板，再得到输入 ID。"],
  ["输入 ID → 请求队列", "保留 p₀…p₃ 的编号与位置，随 R1 进入 DP0。"],
  ["同一请求 → 缓存分配", "输入不变；按位置需求预留容量，还没有新的计算结果。"],
  ["输入计划 → 8 个 worker", "缓存已经预留，同一份 ID 与位置交给 TP8。"],
  ["worker 输入 → Embedding", "上一阶段的 p₀…p₃，直接作为查表的行索引。"],
  ["Embedding 输出 → 主干输入", "刚查出的 H 保持四个位置的对应关系，再展开四路残差。"],
  ["主干输出 → 最后位置归约", "沿用四路隐藏表示；取最后位置，合并残差并归一化。"],
  ["归一化结果 → 输出头", "同一个最后位置向量，参与下一步的权重投影。"],
  ["logits → 采样", "传递的是候选分数；采样之后才得到新的 token ID。"],
  ["y₀ → 多词预测 MTP", "MTP 先猜后续 token：确认的 y₀ 先查嵌入，与最后隐藏表示一起参与草拟。"],
  ["确认 y₀ → Engine", "只有 y₀ 进入确认列表；d₁…d₃ 仍是 worker 中的候选。"],
  ["y₀ + 候选 → 下一轮输入", "y₀ 自身尚未前向；它与三个候选一起送回主模型。"],
  ["确认 ID → 增量文字", "沿用同一请求的反分词状态。"],
  ["下一轮输入 → 主模型验证", "本圈先算四个位置，再验证候选；确认后才能反分词返回。"],
  ["回退后输入 → 再次验证", "从位置 6 续算；y₂ 与新候选进入下一圈，客户端已有文字保留。"],
  ["保留回答 → 结束请求", "回答留在客户端；假设随后生成结束标记 EOS，再释放请求缓存、关闭流。"],
] as const;
export function requestTransfer(section: number, phase: number) {
  const [title, detail] = transfers[section * 4 + phase]!;
  return { title, detail };
}
