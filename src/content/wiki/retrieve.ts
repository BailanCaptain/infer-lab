/**
 * 检索的单一入口（F001 AC10）。
 *
 * 聊天层只准调 `retrieve()`，不准自己 grep——换实现时不必重写聊天层。
 * 第一版是 index + 关键词打分，没有向量：参数类问题是按名字精确查表，
 * 语义相似反而会把相近但不同的东西捞进来；概念页几百页规模够用。
 * 换向量的触发条件写在 F003 AC4：实测 issue 语料的命中率不达标才换，
 * 且只换语料那一路，不动 wiki 页。
 *
 * `citationCheck` 是回答侧的把关（F001 AC7）：借 Multi-Agent 的
 * `adaptive-recall/judge-block.ts` 思路——断言式回答却不指向任何 wiki 页时，
 * 不能伪装成知识库结论。教学场景里这比检索本身更要紧。
 */

import { type CorpusDocument, errorFragments, retrieveCorpus } from "./corpus-retrieve";
import { pageDisplayTitle } from "./param-display";
import { buildAdjacency } from "./relations";
import { type ReaderSearchIndex, type Relation, readerSearchIndexSchema } from "./schema";

export interface PageIndex {
  id: string;
  file?: string | undefined;
  legacyIds?: readonly string[] | undefined;
  title: string;
  displayTitle?: string | undefined;
  aliases: string[];
  summary: string;
  chapters: string[];
  evidence: string;
  relations?: Relation[];
  /** 仅兼容旧页，新页统一使用 relations */
  related?: string[];
  /** 正文原文，用于关键词匹配 */
  text: string;
}

export interface Hit {
  id: string;
  title: string;
  summary: string;
  evidence: string;
  score: number;
  /** 命中方式，供上层决定要不要继续追问 */
  how: "exact" | "fuzzy" | "keyword" | "related" | "corpus-exact";
  url?: string;
  excerpt?: string;
  qualification?: string;
  /** Deterministic community provenance; never upgrades its claims to Wiki evidence. */
  provenance?: string;
  /** how 为 related 时，说明是从哪一页牵出来的 */
  via?: string;
}

export interface RetrieveOptions {
  corpus?: CorpusDocument[];
  limit?: number;
  /**
   * 图扩展（AC12）：直接命中之后，按声明关系及派生入边返回二级候选。
   * 只走一跳——两跳之后相关性衰减很快，而 70 条边、64% 密度的图两跳几乎等于全库。
   */
  expand?: boolean;
  /** 扩展候选上限，默认与直接候选 limit 相同 */
  expansionLimit?: number;
}

/** 字段序：0 = 标题（id + title + aliases）、1 = 摘要、2 = 正文 */
type FieldTf = [number, number, number];

export interface Index {
  pages: PageIndex[];
  /** 归一化后的 id / title / alias → 页 */
  exact: Map<string, PageIndex>;
  /** 去掉全部分隔符的形式 → 页，用于宽松匹配 */
  squashed: Map<string, PageIndex>;
  byId: Map<string, PageIndex>;
  adjacency: Map<string, string[]>;
  /** BM25 倒排表：词 → 页 id → 各字段词频 */
  postings: Map<string, Map<string, FieldTf>>;
  /** 页 id → 各字段词数；avgLen 是全库均值，做长度归一 */
  fieldLen: Map<string, FieldTf>;
  avgLen: FieldTf;
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * 把标识符压成无分隔符的小写形式：`layer_sharding` / `Layer Sharding` /
 * `layer-sharding` 全部压成 `layersharding`。
 *
 * 存在的理由（用户 2026-09-11 指出）：学习者不会照着 id 打字，他会问
 * 「layer share 是什么」。同样地，官方文档里写的是 `Layer sharding.`——
 * 我最初用全词精确匹配去数「哪些参数没文档」，就因此漏掉了
 * `release_notes.md`（2267 行、1137 个 PR 链接）整份文件。
 */
const squash = (s: string) => s.toLowerCase().replace(/[\s_\-.]/g, "");

/** 宽松匹配的最短长度，太短会把一堆页都命中 */
const MIN_FUZZY = 4;

/**
 * 两个压平后的标识符是否算同一个东西。
 * 用公共前缀而不是严格前缀——`layershare` 与 `layersharding` 在第 10 位就分叉，
 * 严格前缀判不出来，但它们显然指同一个东西。
 */
function sameish(a: string, b: string): boolean {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i >= MIN_FUZZY && i >= Math.min(a.length, b.length) * 0.75;
}

function buildLookupMaps(pages: PageIndex[]) {
  const exact = new Map<string, PageIndex>();
  const squashed = new Map<string, PageIndex>();
  for (const p of pages) {
    for (const key of [
      p.id,
      ...(p.legacyIds ?? []),
      ...(p.displayTitle ? [p.displayTitle] : []),
      p.title,
      ...p.aliases,
    ]) {
      const k = norm(key);
      if (k && !exact.has(k)) exact.set(k, p);
      const s = squash(key);
      if (s && !squashed.has(s)) squashed.set(s, p);
    }
    if (p.file) {
      const fileBase = p.file.split("/").pop();
      for (const fileKey of [p.file, ...(fileBase ? [fileBase] : [])]) {
        const k = norm(fileKey);
        if (k && !exact.has(k)) exact.set(k, p);
      }
    }
  }
  return {
    exact,
    squashed,
    byId: new Map(pages.map((p) => [p.id, p])),
    adjacency: buildAdjacency(pages),
  };
}

export function buildIndex(pages: PageIndex[]): Index {
  const postings = new Map<string, Map<string, FieldTf>>();
  const fieldLen = new Map<string, FieldTf>();
  const total: FieldTf = [0, 0, 0];
  for (const p of pages) {
    const titleField = [
      p.id,
      ...(p.legacyIds ?? []),
      p.title,
      ...(p.displayTitle && p.displayTitle !== p.title ? [p.displayTitle] : []),
      ...p.aliases,
    ].join(" ");
    const fields = [titleField, p.summary, p.text];
    const len: FieldTf = [0, 0, 0];
    fields.forEach((text, f) => {
      const ts = terms(text);
      len[f] = ts.length;
      for (const t of ts) {
        let byPage = postings.get(t);
        if (!byPage) {
          byPage = new Map();
          postings.set(t, byPage);
        }
        let tf = byPage.get(p.id);
        if (!tf) {
          tf = [0, 0, 0];
          byPage.set(p.id, tf);
        }
        tf[f] = (tf[f] ?? 0) + 1;
      }
    });
    fieldLen.set(p.id, len);
    total.forEach((_, f) => {
      total[f] = (total[f] ?? 0) + (len[f] ?? 0);
    });
  }
  return {
    pages,
    ...buildLookupMaps(pages),
    postings,
    fieldLen,
    avgLen: total.map((n) => n / Math.max(1, pages.length)) as unknown as FieldTf,
  };
}

/**
 * 把构建期/服务端锁定的 Index 序列化为紧凑载荷：只保留页面元数据与倒排统计，
 * 不携带任何 Markdown 正文、编译 AST、图 SVG 或来源列表。
 */
export function serializeSearchIndex(index: Index, revision: string): ReaderSearchIndex {
  const pageIdxById = new Map(index.pages.map((p, idx) => [p.id, idx]));
  const pages = index.pages.map((p) => ({
    id: p.id,
    ...(p.file ? { file: p.file } : {}),
    ...(p.legacyIds?.length ? { legacyIds: [...p.legacyIds] } : {}),
    title: p.title,
    ...(p.displayTitle ? { displayTitle: p.displayTitle } : {}),
    aliases: [...p.aliases],
    summary: p.summary,
    chapters: [...p.chapters],
    evidence: p.evidence,
    relations: p.relations ?? [],
    related: p.related ?? [],
  }));
  const fieldLen = index.pages.map((p) => {
    const len = index.fieldLen.get(p.id) ?? [0, 0, 0];
    return [len[0], len[1], len[2]] as FieldTf;
  });
  const postings: Record<string, number[]> = {};
  for (const [term, byPage] of index.postings) {
    const flat: number[] = [];
    for (const [pageId, tf] of byPage) {
      const idx = pageIdxById.get(pageId);
      if (idx === undefined) continue;
      flat.push(idx, tf[0], tf[1], tf[2]);
    }
    if (flat.length > 0) postings[term] = flat;
  }
  return readerSearchIndexSchema.parse({
    version: 1,
    revision,
    pages,
    fieldLen,
    avgLen: [index.avgLen[0], index.avgLen[1], index.avgLen[2]],
    postings,
  });
}

/** 从紧凑序列化索引还原内存 Index，浏览器无需重跑全量分词或加载全部页面正文。 */
export function deserializeSearchIndex(input: unknown): Index {
  const parsed = readerSearchIndexSchema.parse(input);
  const pages: PageIndex[] = parsed.pages.map((p) => ({
    id: p.id,
    ...(p.file ? { file: p.file } : {}),
    ...(p.legacyIds ? { legacyIds: p.legacyIds } : {}),
    title: p.title,
    ...(p.displayTitle ? { displayTitle: p.displayTitle } : {}),
    aliases: p.aliases,
    summary: p.summary,
    chapters: p.chapters,
    evidence: p.evidence,
    relations: p.relations,
    related: p.related,
    text: "",
  }));
  const fieldLen = new Map<string, FieldTf>();
  pages.forEach((p, idx) => {
    const len = parsed.fieldLen[idx]!;
    fieldLen.set(p.id, [len[0], len[1], len[2]]);
  });
  const postings = new Map<string, Map<string, FieldTf>>();
  for (const [term, flat] of Object.entries(parsed.postings)) {
    const byPage = new Map<string, FieldTf>();
    for (let i = 0; i < flat.length; i += 4) {
      const page = pages[flat[i]!];
      if (!page) continue;
      byPage.set(page.id, [flat[i + 1]!, flat[i + 2]!, flat[i + 3]!]);
    }
    postings.set(term, byPage);
  }
  return {
    pages,
    ...buildLookupMaps(pages),
    postings,
    fieldLen,
    avgLen: [parsed.avgLen[0], parsed.avgLen[1], parsed.avgLen[2]],
  };
}

function splitAsciiSegment(seg: string): string[] {
  const whole = seg.toLowerCase();
  // 定长窗口匹配多字母驼峰与「全大写缩写 + 驼峰词」边界（严格 O(N) 线性时间，避免在超长无大写串上二次回溯）：
  // 保留 RoPE / LoRA / MoE / ZeRO / ReLU 与 W8A8 / FP8 完整词，不被单小写字母或数字边界切碎；
  // 同时对 AllReduce / PagedAttention / NPUPlatform 同时产出完整复合词与组成词，打通连写与下划线写法。
  const parts =
    /[A-Z]/.test(seg) && seg.length <= 128
      ? seg
          .replace(/([a-z]{2})([A-Z])/g, "$1 $2")
          .replace(/([A-Z])([A-Z][a-z]{2})/g, "$1 $2")
          .replace(/([A-Z][a-z])([A-Z][a-z]{2})/g, "$1 $2")
          .toLowerCase()
          .split(" ")
          .filter(Boolean)
      : [whole];
  const emitted: string[] = [];
  const push = (t: string) => {
    if (t.length >= 2 && !STOP_EN.has(t) && !emitted.includes(t)) emitted.push(t);
  };
  push(whole);
  if (parts.length > 1) {
    for (const p of parts) push(p);
  }
  return emitted;
}

/**
 * 拆成检索词：拉丁/数字复合标识符与中文片段在脚本边界先严格分离（防止「FP8量化」跨界生成
 * 「p8 / 8量」）；拉丁段保留完整缩写与数字精度名（RoPE、W8A8、FP8、-O2），并对驼峰与下划线/
 * 连字符复合词（AllReduce / all_reduce / --enable-chunked-prefill）同步产出分段词与压平复合词；
 * 中文按二元切分。索引与查询共用同一把刀。
 */
export function terms(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/[A-Za-z0-9]+(?:[_-][A-Za-z0-9]+)*|[\u3400-\u9fff]+/g)) {
    const tok = m[0];
    if (/^[\u3400-\u9fff]+$/.test(tok)) {
      for (let i = 0; i + 2 <= tok.length; i++) out.push(tok.slice(i, i + 2));
      continue;
    }
    const segments = tok.split(/[_-]+/).filter(Boolean);
    const perToken = new Set<string>();
    for (const seg of segments) {
      for (const sub of splitAsciiSegment(seg)) perToken.add(sub);
    }
    if (segments.length >= 2) {
      const joined = segments.join("").toLowerCase();
      if (joined.length >= 2 && joined.length <= 32 && !STOP_EN.has(joined)) {
        perToken.add(joined);
      }
    }
    out.push(...perToken);
  }
  return out;
}

const STOP_EN = new Set(["is", "the", "a", "an", "of", "to", "in", "on", "what", "how", "why", "and"]);

/**
 * BM25F（2026-09-23 换掉手写计分）：字段权重 标题 > 摘要 > 正文，词频做饱和与
 * 长度归一，罕见词靠 idf 自然占权重。此前是标识命中 +8 / 正文命中 +1，宽松命中
 * 直接给 800–900 固定分——「vllm-ascend」这种常见片段一出现就把关键词命中的
 * 正确页压下去（09-23 的 HCCL 病例）。现在宽松命中也走同一套：按「这个片段被
 * 几页认领」算 idf，记作一次标题字段命中，常见片段自然低分。
 */
const BM25_K1 = 1.2;
const BM25_B = 0.75;
const FIELD_WEIGHT: FieldTf = [5, 2.5, 1];
/** 长度 2 的拉丁词（kv、tp、pp）只算标题字段：正文里满地都是，命中是噪声。 */
const SHORT_LATIN_FIELDS = new Set([0]);
/** 只出现在正文、从不出现在任何标题或摘要里的词，idf 封顶在这个值。 */
const BODY_ONLY_IDF_CAP = 0.5;

function idf(pagesTotal: number, df: number): number {
  return Math.log(1 + (pagesTotal - df + 0.5) / (df + 0.5));
}

/** 一个词对一页的加权词频（含字段长度归一）；saturate 后乘 idf 才是得分。 */
function weightedTf(index: Index, pageId: string, tf: FieldTf, fields?: Set<number>): number {
  const len = index.fieldLen.get(pageId)!;
  let sum = 0;
  for (let f = 0; f < 3; f++) {
    if (fields && !fields.has(f)) continue;
    if (!tf[f]) continue;
    const lenNorm = 1 - BM25_B + (BM25_B * len[f]!) / Math.max(1, index.avgLen[f]!);
    sum += (FIELD_WEIGHT[f]! * tf[f]!) / lenNorm;
  }
  return sum;
}

const saturate = (wtf: number) => wtf / (BM25_K1 + wtf);

/**
 * 口语化症状展开表：仅当查询不含原始异常堆栈且明确命中症状短语时，为至多 2 个标准排查页补充候选分，
 * 权重低于精确标题/参数标识符命中与社区精确报错命中，零误伤正常术语与参数查询。
 */
const SYMPTOM_RULES: readonly { pattern: RegExp; targets: readonly [string, string] }[] = [
  {
    pattern:
      /(?:一卡一卡|一顿一顿|断断续续|流式[^\n，。；？?!！]{0,6}(?:卡|顿|慢|停顿)|(?:回答|输出|生成|吐字|出字)[^\n，。；？?!！]{0,6}(?:一卡|一顿|卡顿|很卡|老卡|变慢|很慢|停顿)|吐字(?:慢|卡))/,
    targets: ["inference-performance-walkthrough", "inference-performance-troubleshooting"],
  },
  {
    pattern:
      /(?:显存(?:莫名|突然|一下|总是|老是|直接)?(?:满了|占满|打满|爆了|撑爆|不够|不足|溢出)|爆显存|\boom\b|out of memory)/i,
    targets: ["kv-cache-memory-profiling", "device-memory"],
  },
  {
    pattern:
      /(?:batch(?:\s*size)?\s*(?:变小|上不去|很小|掉下来|缩水|跑不满)|批(?:处理)?大小(?:变小|上不去|很小)|并发(?:数|量)?(?:上不去|跑不满|提不上来|变小|很低))/,
    targets: ["continuous-batching", "vllm-scheduler"],
  },
  {
    pattern:
      /(?:(?:长|大|超长)\s*(?:prompt|输入|请求|上下文|文本)[^\n]{0,20}(?:抖|卡|慢|堵|阻塞|影响|拖慢|停顿)|(?:抖|卡|慢|阻塞|拖慢)[^\n]{0,12}(?:别的请求|其他请求|别人))/,
    targets: ["chunked-prefill", "inference-performance-walkthrough"],
  },
];

export function retrieve(query: string, index: Index, opts: RetrieveOptions = {}): Hit[] {
  const limit = opts.limit ?? 5;
  const q = norm(query);
  if (!q) return [];

  const scored = new Map<string, { page: PageIndex; score: number; how: Hit["how"] }>();
  const add = (page: PageIndex, points: number, how: Hit["how"]) => {
    const prev = scored.get(page.id);
    if (prev) prev.score += points;
    else scored.set(page.id, { page, score: points, how });
  };

  const hit = index.exact.get(q);
  if (hit) scored.set(hit.id, { page: hit, score: 1000, how: "exact" });

  // A named topic inside a question is still a title hit. Long alias lists must not
  // dilute exact names beneath generic context. Chinese phrases need at least
  // four characters here; shorter words remain ordinary BM25 terms.
  if (!hit) {
    const named = new Map<string, PageIndex>();
    for (const [name, page] of index.exact) {
      if (!/^(?:--?)?[a-z0-9][a-z0-9_./ -]+$/.test(name) && !/^[\u3400-\u9fff]{4,}$/.test(name)) continue;
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`(?<![a-z0-9_-])${escaped}(?![a-z0-9_])`).test(q)) named.set(page.id, page);
    }
    for (const page of named.values())
      add(page, FIELD_WEIGHT[0] * idf(index.pages.length, named.size), "keyword");
  }

  // 宽松匹配：把查询里的每个连续拉丁片段压成无分隔符形式，与页面标识符互为前缀即算
  // 命中。「layer share 是什么意思」→「layershare」是「layersharding」的前缀 → 命中。
  // 得分不再是固定 800–900：按「这个片段被几页认领」算 idf，记作一次标题字段命中——
  // 「hccl_buffsize」只有一页认领，分高；「vllm-ascend」满库都沾边，自然低分。
  // 不再先试整句、命中了就跳过片段：问题以标识符开头时（09-23 的 HCCL 病例），
  // 整句压平后恰好前缀命中总览页，逐片段那一步被跳过，真正的高分标识符就丢了。
  if (!hit) {
    const patterns = new Set<string>();
    const candidates = [
      ...(q.match(/[a-z0-9_\-. ]{4,}/g) ?? []),
      ...(q.match(/--?[a-z0-9][a-z0-9_.-]{2,}|[a-z0-9]+(?:[_.-][a-z0-9]+)+/g) ?? []),
    ];
    for (const frag of candidates) {
      const f = squash(frag);
      if (f.length >= MIN_FUZZY) patterns.add(f);
    }
    for (const pattern of patterns) {
      // closeness：片段占名字的比例。「prefill」对别名 Prefill Context Parallel 只占
      // 开头一小截（7/22），认领要打折，否则长别名页把本词页挤下去（prefill/decode 病例）。
      const matched = new Map<string, { page: PageIndex; closeness: number }>();
      for (const [key, page] of index.squashed) {
        if (!sameish(key, pattern)) continue;
        const closeness = Math.min(key.length, pattern.length) / Math.max(key.length, pattern.length);
        const prev = matched.get(page.id);
        if (!prev || closeness > prev.closeness) matched.set(page.id, { page, closeness });
      }
      if (!matched.size) continue;
      const patternIdf = idf(index.pages.length, matched.size);
      for (const { page, closeness } of matched.values()) {
        add(page, patternIdf * closeness * saturate(weightedTf(index, page.id, [1, 0, 0])), "fuzzy");
      }
    }
  }

  const ts = [...new Set(terms(query))];
  for (const t of ts) {
    const byPage = index.postings.get(t);
    if (!byPage) continue;
    // 纯双字母拉丁词（kv、tp、pp）只算标题字段命中，正文里的出现是噪声；带数字的 o2 / a2 仍查全文
    const fields = t.length < 3 && /^[a-z]+$/.test(t) ? SHORT_LATIN_FIELDS : undefined;
    const df = fields ? [...byPage.entries()].filter(([, tf]) => tf[0]! > 0).length : byPage.size;
    if (!df) continue;
    // 全库任何标题、摘要里都没有的词多半是切分噪声（「什么是」切出的「么是」全库只在
    // 六页正文里出现，罕见反而成了大权重）。这类词的 idf 封顶，不让它决定排序。
    const anchored = [...byPage.values()].some((tf) => tf[0]! > 0 || tf[1]! > 0);
    const termIdf = anchored
      ? idf(index.pages.length, df)
      : Math.min(idf(index.pages.length, df), BODY_ONLY_IDF_CAP);
    for (const [pageId, tf] of byPage) {
      const wtf = weightedTf(index, pageId, tf, fields);
      if (wtf > 0) add(index.byId.get(pageId)!, termIdf * saturate(wtf), "keyword");
    }
  }

  if (errorFragments(query).length === 0) {
    const symptomBase = idf(index.pages.length, Math.min(2, Math.max(1, index.pages.length)));
    let symptomAdded = 0;
    const seenTargets = new Set<string>();
    for (const rule of SYMPTOM_RULES) {
      if (!rule.pattern.test(q)) continue;
      for (const [rank, targetId] of rule.targets.entries()) {
        if (symptomAdded >= 2) break;
        if (seenTargets.has(targetId)) continue;
        const page = index.byId.get(targetId);
        if (!page) continue;
        seenTargets.add(targetId);
        symptomAdded++;
        const floor = (rank === 0 ? 2.1 : 1.9) * symptomBase;
        const prev = scored.get(page.id);
        if (prev) prev.score = Math.max(prev.score, floor);
        else scored.set(page.id, { page, score: floor, how: "keyword" });
      }
      if (symptomAdded >= 2) break;
    }
  }

  for (const entry of scored.values())
    if (entry.how !== "exact") entry.score = Math.round(entry.score * 1000) / 1000;

  const direct = [...scored.values()]
    .sort((a, b) => b.score - a.score || a.page.id.localeCompare(b.page.id))
    .slice(0, limit);

  const toHit = ({ page, score, how }: { page: PageIndex; score: number; how: Hit["how"] }): Hit => ({
    id: page.id,
    title: pageDisplayTitle(page),
    summary: page.summary,
    evidence: page.evidence,
    score,
    how,
  });

  const corpus = retrieveCorpus(query, opts.corpus ?? [], limit);
  const primary = [...corpus, ...direct.map(toHit)].slice(0, limit);
  if (!opts.expand || direct.length === 0) return primary;

  // 一跳内按邻居自身与问题的匹配排序，避免第一条命中的字母序邻居占满额度。
  const seen = new Set(direct.map((d) => d.page.id));
  const expanded: Hit[] = [];
  for (const d of direct) {
    for (const rid of index.adjacency.get(d.page.id) ?? []) {
      if (seen.has(rid)) continue;
      const page = index.byId.get(rid);
      if (!page) continue;
      seen.add(rid);
      expanded.push({
        ...toHit({ page, score: scored.get(rid)?.score ?? 0, how: "related" }),
        via: d.page.id,
      });
    }
  }
  expanded.sort((a, b) => b.score - a.score);
  return [...primary, ...expanded.slice(0, Math.max(0, opts.expansionLimit ?? limit))];
}

export interface CitationVerdict {
  cited: boolean;
  /** agent 自己声明「未收录」，属于诚实回答，不判违规 */
  selfDeclaredUncovered: boolean;
  reason?: string;
}

/** 指向 wiki 页的链接：相对 md 链接或 hash 路由。 */
const PAGE_LINK =
  /\]\((?:#\/wiki\/[a-z0-9-]+|(?:\.\.\/)?(?:concepts|sources|params)\/[a-z0-9-]+\.md)(?:#[^\s)]*)?\)/i;
export function citedPageLinks(answer: string): string[] {
  return [...citationProse(answer).matchAll(new RegExp(PAGE_LINK.source, "gi"))].map((m) =>
    m[0].slice(2, -1),
  );
}
/** Shared exclusion of fenced / inline code examples from answer citation checks. */
export function citationProse(text: string): string {
  return text.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm, "").replace(/`[^`\n]*`/g, "");
}

export function matchesCitedPage(href: string, file: string): boolean {
  const fragment = href.indexOf("#", 1); // Preserve the leading hash of a Wiki route.
  const page = fragment < 0 ? href : href.slice(0, fragment);
  return page === file || page === `../${file}` || page === `#/wiki/${file.split("/").at(-1)!.slice(0, -3)}`;
}

/** agent 明确声明知识库没有这一条 */
const UNCOVERED = /（未收录）|\(未收录\)|知识库里?还没有|知识库[中内]没有|尚未收录/;
/** 断言式表述：陈述事实而非提问或澄清 */
const ASSERTION = /[。．.!！]/;

export function citationCheck(answer: string): CitationVerdict {
  const text = answer.trim();
  if (!text) return { cited: false, selfDeclaredUncovered: false, reason: "回答为空" };

  if (UNCOVERED.test(text)) return { cited: true, selfDeclaredUncovered: true };
  if (citedPageLinks(text).length) return { cited: true, selfDeclaredUncovered: false };

  // 全是疑问句（反问、澄清）不构成断言，不要求引用
  const hasAssertion = ASSERTION.test(text.replace(/[^。．.!！?？]/g, "").replace(/[?？]/g, ""));
  if (!hasAssertion) return { cited: true, selfDeclaredUncovered: false };

  return {
    cited: false,
    selfDeclaredUncovered: false,
    reason: "回答里有断言但没有引用任何知识库页面",
  };
}
