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

/** 一页的名称词表：词 → 该页内最高字段权重（id/title/displayTitle 首词 1.0、其余 0.58；alias 首词 0.72、其余 0.40）。 */
interface PageNameTokens {
  page: PageIndex;
  tokens: Map<string, number>;
  /** 每个名称（id / title / displayTitle / alias）去全部分隔符后的形式，单复合标识符过滤据此识别等价名称 */
  squashedNames: Set<string>;
}

export interface Index {
  pages: PageIndex[];
  /** 归一化后的 id / title / alias → 页 */
  exact: Map<string, PageIndex>;
  /**
   * 名称词首匹配用的内存词表（只来自页面元数据，构建索引与序列化还原两端由同一函数生成，
   * 不进入倒排 JSON），保证 `buildIndex` 与 `deserializeSearchIndex` 结果一致。
   */
  nameTokens: PageNameTokens[];
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

/** 统一源码/终端/文档里混用的不换行连字符（U+2011 等）与短横线为标准 ASCII `-`。 */
const normDashes = (s: string) => s.replace(/[\u2010-\u2015]/g, "-");

const norm = (s: string) => normDashes(s).trim().toLowerCase();

/** 识别单个标识符查询时额外统一的横线（含减号 U+2212、小横线 U+FE63、全角 U+FF0D）；只用于查询侧判定，不改变分词。 */
const normIdentifierDashes = (s: string) => s.replace(/[\u2010-\u2015\u2212\uFE63\uFF0D]/g, "-");

/**
 * 满库都有的平台短词：永不获得名称或词首前缀奖励，只按普通 BM25 计分，
 * 防止「NPU out of memory…」一类长句、异常堆栈或文件名被短名称劫持。
 */
const GENERIC_SHORT_NAMES = new Set(["npu", "llm", "api", "get", "max", "num"]);

/**
 * 把标识符压成无分隔符的小写形式：`layer_sharding` / `Layer Sharding` /
 * `layer-sharding` 全部压成 `layersharding`。
 *
 * 存在的理由（用户 2026-09-11 指出）：学习者不会照着 id 打字，他会问
 * 「layer share 是什么」。同样地，官方文档里写的是 `Layer sharding.`——
 * 我最初用全词精确匹配去数「哪些参数没文档」，就因此漏掉了
 * `release_notes.md`（2267 行、1137 个 PR 链接）整份文件。
 */
const squash = (s: string) =>
  normDashes(s)
    .toLowerCase()
    .replace(/[\s_\-.]/g, "");

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
  const registerKey = (key: string, page: PageIndex) => {
    const k = norm(key);
    if (k && !exact.has(k)) exact.set(k, page);
    const s = squash(key);
    if (s && !squashed.has(s)) squashed.set(s, page);
  };
  // Pass 1: canonical page identifiers & titles take priority over secondary aliases on other pages
  // (e.g. formal param page `shared_engram` / `runtime_config` wins exact over a concept page alias).
  for (const p of pages) {
    for (const key of [p.id, ...(p.legacyIds ?? []), ...(p.displayTitle ? [p.displayTitle] : []), p.title]) {
      registerKey(key, p);
    }
  }
  // Pass 2: secondary aliases and file paths fill remaining slots.
  for (const p of pages) {
    for (const alias of p.aliases) {
      registerKey(alias, p);
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
    nameTokens: pages.map(buildPageNameTokens),
    byId: new Map(pages.map((p) => [p.id, p])),
    adjacency: buildAdjacency(pages),
  };
}

const PRIMARY_LEAD_WEIGHT = 1;
const PRIMARY_REST_WEIGHT = 0.58;
const ALIAS_LEAD_WEIGHT = 0.72;
const ALIAS_REST_WEIGHT = 0.4;

/**
 * 从 id / title / displayTitle / 每条 alias 提取名称词：按 ASCII 字母数字串切分，复用驼峰分词产出完整词与组成词；
 * 用 `-` / `_` / `.` 连接的多段名（`All-Reduce`、`cpu_binding`）另产出压平完整词，与驼峰写法 `AllReduce` 同权。
 * 每个字段值单独起算「首词」（第一个 ASCII 段或首个连写名）；同一页同一词只保留最高权重。文件路径不参与。
 */
function buildPageNameTokens(page: PageIndex): PageNameTokens {
  const tokens = new Map<string, number>();
  const squashedNames = new Set<string>();
  const put = (token: string, weight: number) => {
    if (weight > (tokens.get(token) ?? 0)) tokens.set(token, weight);
  };
  const collect = (value: string, lead: number, rest: number) => {
    const s = squash(value);
    if (s) squashedNames.add(s);
    let segIdx = 0;
    for (const chunk of normDashes(value).match(/[A-Za-z0-9]+(?:[-_.][A-Za-z0-9]+)*/g) ?? []) {
      const segments = chunk.split(/[-_.]/);
      if (segments.length >= 2) put(segments.join("").toLowerCase(), segIdx === 0 ? lead : rest);
      for (const seg of segments) {
        splitAsciiSegment(seg).forEach((token, k) => {
          put(token, segIdx === 0 && k === 0 ? lead : rest);
        });
        segIdx++;
      }
    }
  };
  for (const value of [page.id, page.title, ...(page.displayTitle ? [page.displayTitle] : [])]) {
    collect(value, PRIMARY_LEAD_WEIGHT, PRIMARY_REST_WEIGHT);
  }
  for (const alias of page.aliases) collect(alias, ALIAS_LEAD_WEIGHT, ALIAS_REST_WEIGHT);
  return { page, tokens, squashedNames };
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
  for (const m of normDashes(text).matchAll(/[A-Za-z0-9]+(?:[_-][A-Za-z0-9]+)*|[\u3400-\u9fff]+/g)) {
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
      // 上限只约束多段压平词：超长环境变量 / 参数 / 函数名（33–96 字符）也要能按完整名精确召回；
      // 单段 ASCII 词不受此限（超长连续串仍产出一个词，见 splitAsciiSegment）。
      if (joined.length >= 2 && joined.length <= MAX_JOINED_TERM_LENGTH && !STOP_EN.has(joined)) {
        perToken.add(joined);
      }
    }
    out.push(...perToken);
  }
  return out;
}

const STOP_EN = new Set(["is", "the", "a", "an", "of", "to", "in", "on", "what", "how", "why", "and"]);

/** 多段复合词压平后的最大长度（2026-11 由 32 放宽到 96，救回超长参数 / 环境变量 / 函数名）。 */
const MAX_JOINED_TERM_LENGTH = 96;

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

/**
 * 初学者白话 / 一线报错特征短语 → 标准检索词同义扩展（仅在查询侧以折扣权重注入 BM25）：
 * - 只匹配明确的多字白话短语或固定底层特征串，绝不在单个标识符、裸错误码或无关闲聊上触发；
 * - 走同一套 `index.postings` 倒排打分，天然保持服务端 `buildIndex` 与浏览器 `deserializeSearchIndex`
 *   分数与排序 100% 一致，且不硬编码特定页面 ID。
 */
const COLLOQUIAL_EXPANSION_WEIGHT = 0.65;
const COLLOQUIAL_TERM_EXPANSIONS: readonly { pattern: RegExp; phrases: readonly string[] }[] = [
  {
    pattern: /(?:第一个|首个|头一个)\s*(?:字|词|token)|首\s*词/i,
    phrases: ["prefill", "预填充", "首 token 延迟", "首字延迟"],
  },
  {
    pattern: /(?:吐字|蹦字)(?:快|慢|速度|阶段)?/,
    phrases: ["decode", "解码"],
  },
  {
    pattern:
      /(?:温度[^\n]{0,8}0|temperature\s*=\s*0)[^\n]{0,20}(?:差别|不同|不一致|对不上|变了)|(?:凑批|同批|并批)[^\n]{0,14}(?:结果|输出|答案)[^\n]{0,10}(?:差别|不同|不一致)/i,
    phrases: ["批不变性", "batch invariance"],
  },
  {
    pattern: /(?<!同)(?:凑批|攒批|拼批|合批)(?![^\n]{0,12}(?:差别|不同|不一致))/,
    phrases: ["连续批处理", "continuous batching"],
  },
  {
    pattern:
      /预填充[^\n]{0,16}(?:解码|生成|吐字)[^\n]{0,14}(?:拆|分开|分离|两拨|两组|两套|不同卡)|(?:拆成|分成)\s*两(?:拨|组|套)\s*卡[^\n]{0,16}(?:预填充|解码)/,
    phrases: ["pd 分离", "disaggregation"],
  },
  {
    pattern: /(?:哪张卡|哪个卡|哪台|谁先)[^\n]{0,14}(?:罪魁祸首|先挂|先崩|先错|先报错|根因)|罪魁祸首/,
    phrases: ["首错", "ei0006"],
  },
  {
    pattern: /(?:一条请求|一个请求|一次请求)[^\n]{0,22}(?:哪几站|哪几步|几站|几步|全流程|全过程|经历了)/,
    phrases: ["请求鸟瞰", "一条请求的七站", "请求生命周期"],
  },
  {
    pattern:
      /(?<![\d.])60\.96(?![\d])(?=\s*(?:(?:gib|gb)(?!\s*(?:\/|p)\s*s)\b|显存|容量|可见|卡))|(?:显存|容量|hbm|910b3?)[^\n]{0,20}(?<![\d.])60\.96(?![\d])(?!\s*(?:ghz|mhz|khz|hz|(?:gib|gb|mib|mb|tb)\s*(?:\/|p)\s*s)\b)|(?:64\s*(?:gib|gb)(?!\s*(?:\/|p)\s*s)\b|32\s*(?:gib|gb)(?!\s*(?:\/|p)\s*s)\b)[^\n]{0,20}(?:只看到|只有|少了|可见显存|可用显存)/i,
    phrases: ["显存预算", "determine_available_memory", "910b3 实测"],
  },
  {
    pattern: /dest buffer device_id[^\n]{0,40}endpoint count/i,
    phrases: ["adxl", "mooncakeconnectorv1"],
  },
];

/**
 * 双语术语 → 完整倒排键的定向扩展（只查完整 posting key，不再交给 `terms()` 切碎）：
 * - 直接写 `task_queue_enable` 作短语会连带注入 task / queue / enable 噪声，这里只认完整键 `taskqueueenable`；
 * - 每条规则对每页只取其键中最强的一次贡献，去重、只加一次；键在库里不存在时贡献为零（零误伤）；
 * - 只在无精确命中、查询不含原始异常片段时生效；不同义改写有歧义的裸词（如单独的「大页」「块」「草稿」）。
 */
/**
 * 定向术语扩展按一个完整查询词计分（权重 1，不打口语折扣）：触发短语就是该术语的标准中文/英文说法，
 * 且每条规则每页只计一次、只查完整键，不会像口语扩展那样把子词噪声一起注入。
 */
const TERM_KEY_EXPANSION_WEIGHT = 1;
const TERM_KEY_EXPANSIONS: readonly { pattern: RegExp; unless?: RegExp; keys: readonly string[] }[] = [
  {
    // 昇腾 torch_npu 的「二级流水」即 TASK_QUEUE_ENABLE 控制的算子异步下发队列优化
    pattern: /二级流水|(?:算子|任务)(?:异步)?下发队列|\btask[\s_-]*queue\b/i,
    keys: ["taskqueueenable"],
  },
  {
    // 块扩散草稿（DFlash）：别名归属页会区分 DFlash 与 DSpark，命中只做导航，不宣称二者同义
    pattern: /块扩散|\bblock[\s_-]*diffusion\b/i,
    keys: ["dflash"],
  },
  {
    pattern: /绑\s*(?:cpu\s*)?核|(?:\bcpu|\bnuma|线程)\s*(?:亲和|绑定)/i,
    keys: ["cpubinding"],
  },
  {
    // Linux 静态大页（hugetlbfs / nr_hugepages）；与透明大页、KV 物理页、设备大页区分，不把它们互相映射
    pattern: /静态大页|大页内存|hugetlb|nr_hugepages|\bhuge[\s_-]*pages\b/i,
    unless: /透明大页|transparent[\s_-]*huge|\bthp\b|madv_hugepage/i,
    keys: ["hugetlb", "hugetlbfs", "nrhugepages", "hugepages"],
  },
  {
    pattern: /透明大页|\btransparent[\s_-]*huge[\s_-]*pages?\b|\bthp\b/i,
    keys: ["madvhugepage", "hugepage"],
  },
];

/** 原始异常堆栈 / Python traceback：不触发任何新增的定向扩展。 */
function looksLikeRawTrace(query: string): boolean {
  return (
    errorFragments(query).length > 0 ||
    /traceback \(most recent call last\)|^\s*file\s+["'][^"'\n]+["'],\s*line\s+\d+|\b[a-z_][\w.]*(?:error|exception|fault)\s*:/im.test(
      query,
    )
  );
}

/** 命中且至少一个完整键在库中存在的定向扩展规则。 */
function matchedTermKeyRules(index: Index, q: string) {
  return TERM_KEY_EXPANSIONS.filter(
    (rule) =>
      rule.pattern.test(q) && !rule.unless?.test(q) && rule.keys.some((k) => index.postings.get(k)?.size),
  );
}

type ScoredEntry = { page: PageIndex; score: number; how: Hit["how"] };

/** 定向术语扩展：每条命中的规则对每页只取其完整键中最强的一次贡献。 */
function scoreTermKeyExpansions(
  index: Index,
  rules: ReturnType<typeof matchedTermKeyRules>,
  explicit: ReadonlySet<string>,
  add: (page: PageIndex, points: number, how: Hit["how"]) => void,
): void {
  for (const rule of rules) {
    const best = new Map<string, number>();
    for (const key of new Set(rule.keys)) {
      if (explicit.has(key)) continue;
      const byPage = index.postings.get(key);
      if (!byPage?.size) continue;
      const keyIdf = idf(index.pages.length, byPage.size);
      for (const [pageId, tf] of byPage) {
        const points = TERM_KEY_EXPANSION_WEIGHT * keyIdf * saturate(weightedTf(index, pageId, tf));
        if (points > (best.get(pageId) ?? 0)) best.set(pageId, points);
      }
    }
    for (const [pageId, points] of best) {
      const page = index.byId.get(pageId);
      if (page) add(page, points, "keyword");
    }
  }
}

/**
 * 名称词首匹配只接受「整个输入就是一个 ≥3 字母的拉丁词」：长句、带路径的日志、CLI 命令与
 * traceback 从这条规则得到的分数恒为零；驼峰复合词（DSpark）、泛化平台短词与英文停用词不进入。
 */
function namePrefixQuery(query: string): string | undefined {
  const raw = normDashes(query).trim();
  if (!/^[A-Za-z]{3,}$/.test(raw)) return undefined;
  if (splitAsciiSegment(raw).length > 1) return undefined;
  const q = raw.toLowerCase();
  if (GENERIC_SHORT_NAMES.has(q) || STOP_EN.has(q)) return undefined;
  return q;
}

/** 3 字母前缀认领页超过扇出上限、但查询别无任何命中时，最多为这么多页给出低置信度保底（逐字输入不至于零结果）。 */
const PREFIX_RESCUE_MAX_PAGES = 8;

/**
 * 短查询的名称词首保底分（DSP / dspa → dspark，moon → mooncake-connector，dfl → DFlash 别名所属页）：
 * 按页取最强名称词，按「认领页数」算 idf；认领页超过扇出上限（3 字母 ≈1.5% 库、4+ 字母 ≈8% 库）时不加分，
 * 只在保底分高于已有分数时替换（并保留原分 5% 作同分时的证据次序），精确命中页保持原分与 how。
 */
function applyNamePrefixFloor(index: Index, query: string, scored: Map<string, ScoredEntry>): void {
  const q = namePrefixQuery(query);
  if (!q) return;
  const strength = new Map<string, { page: PageIndex; value: number }>();
  for (const { page, tokens } of index.nameTokens) {
    let best = 0;
    for (const [token, weight] of tokens) {
      if (!token.startsWith(q)) continue;
      const value = weight * (0.65 + (0.35 * q.length) / token.length);
      if (value > best) best = value;
    }
    if (best > 0) strength.set(page.id, { page, value: best });
  }
  const total = index.pages.length;
  const fanout =
    q.length === 3 ? Math.max(2, Math.floor(0.015 * total)) : Math.max(8, Math.floor(0.08 * total));
  if (strength.size === 0) return;
  let base: number;
  if (strength.size <= fanout) base = FIELD_WEIGHT[0] * idf(total, strength.size);
  else if (scored.size === 0 && strength.size <= PREFIX_RESCUE_MAX_PAGES) base = FIELD_WEIGHT[0] * 0.1;
  else return;
  for (const { page, value } of strength.values()) {
    const floor = base * value;
    const prev = scored.get(page.id);
    if (!prev) scored.set(page.id, { page, score: floor, how: "fuzzy" });
    else if (prev.how !== "exact" && floor > prev.score) {
      prev.score = floor + prev.score * 0.05;
      prev.how = "fuzzy";
    }
  }
}

/**
 * 整个查询是单个 snake / kebab / --CLI / 驼峰（含 `--enableChunkedPrefill`、`__torch_dispatch__`）复合标识符时，
 * 返回压平完整词、去重组成词，以及组成词能否核验全部数字段（单字符数字段不进倒排，无法靠子词核验版本号）。
 */
function singleCompoundQuery(
  query: string,
): { whole: string; parts: string[]; unverifiableDigits: boolean } | undefined {
  const raw = normIdentifierDashes(query.trim());
  const core = raw.replace(/^(?:--?|_+)/, "").replace(/_+$/, "");
  let segments: string[];
  if (/^[A-Za-z0-9]+(?:[_-][A-Za-z0-9]+)+$/.test(core)) segments = core.split(/[_-]/);
  else if (/^[A-Za-z0-9]+$/.test(core) && splitAsciiSegment(core).length > 1) segments = [core];
  else return undefined;
  const whole = segments.join("").toLowerCase();
  const parts = [...new Set(terms(core))].filter((t) => t !== whole);
  const unverifiableDigits = segments.some((s) => /\d/.test(s) && !parts.includes(s.toLowerCase()));
  return { whole, parts, unverifiableDigits };
}

/**
 * 单复合标识符的可返回页集合（名称命中页与名称压平后恰为该标识符的页始终保留）：
 * - 完整词有 posting 时，只再保留完整词所在页（完整词证据优先，高重合不能把 4/5 子词的干扰页带回来）；
 * - 完整词缺席时，某字段内组成词命中数 ≥ ⌈0.8n⌉、命中 IDF ≥ 0.8 × 全部 IDF、最高 IDF 词与全部含数字的词都命中
 *   的页才保留（两字母纯拉丁词仍只认标题字段）；
 * - 完整词缺席且含无法核验或无人达标的数字段（`enable_cache_v3`、`engine_level_3`）时，只保留名称命中，不拿别的版本凑数；
 * - 其余无人达标的情形返回 undefined，沿用原宽松行为。
 */
function compoundIdentifierAllowedPages(
  index: Index,
  query: string,
  scored: Map<string, ScoredEntry>,
  nameMatched: ReadonlySet<string>,
): Set<string> | undefined {
  const compound = singleCompoundQuery(query);
  if (!compound) return undefined;
  const allowed = new Set(nameMatched);
  for (const { page, squashedNames } of index.nameTokens) {
    if (squashedNames.has(compound.whole)) allowed.add(page.id);
  }
  const wholePosting = index.postings.get(compound.whole);
  if (wholePosting?.size) {
    for (const id of wholePosting.keys()) allowed.add(id);
    return allowed;
  }
  if (compound.unverifiableDigits) return allowed;
  const { parts } = compound;
  const digitParts = parts.flatMap((p, i) => (/\d/.test(p) ? [i] : []));
  if (parts.length < 2) return digitParts.length ? allowed : undefined;
  const total = index.pages.length;
  const partIdf = parts.map((p) => idf(total, index.postings.get(p)?.size ?? 0));
  const totalIdf = partIdf.reduce((s, v) => s + v, 0);
  let top = 0;
  partIdf.forEach((v, i) => {
    if (v > partIdf[top]!) top = i;
  });
  const need = Math.ceil(0.8 * parts.length);
  let covered = false;
  for (const id of scored.keys()) {
    for (let f = 0; f < 3; f++) {
      const hitIdx: number[] = [];
      parts.forEach((p, i) => {
        if (f !== 0 && p.length < 3 && /^[a-z]+$/.test(p)) return;
        if ((index.postings.get(p)?.get(id)?.[f] ?? 0) > 0) hitIdx.push(i);
      });
      if (hitIdx.length < need || !hitIdx.includes(top)) continue;
      if (!digitParts.every((i) => hitIdx.includes(i))) continue;
      const hitIdf = hitIdx.reduce((s, i) => s + partIdf[i]!, 0);
      if (hitIdf < 0.8 * totalIdf) continue;
      allowed.add(id);
      covered = true;
      break;
    }
  }
  if (covered || digitParts.length) return allowed;
  return undefined;
}

export function retrieve(query: string, index: Index, opts: RetrieveOptions = {}): Hit[] {
  const limit = opts.limit ?? 5;
  // 查询侧把减号 / 小横线 / 全角横线也统一为 `-`（`torch－dispatch` ≡ `torch-dispatch`），精确、宽松与分词三路同口径
  const q = norm(normIdentifierDashes(query));
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
  // Ubiquitous 2–3 letter platform words (e.g. "npu" appearing in >40% of a full wiki)
  // stay on BM25 so tracebacks like "NPU out of memory during capture_model" don't get hijacked.
  // 名称证据（named / fuzzy / exact）单独记下：单复合标识符过滤时，名称命中始终保留。
  const nameMatched = new Set<string>();
  if (hit) nameMatched.add(hit.id);
  if (!hit) {
    const named = new Map<string, PageIndex>();
    for (const [name, page] of index.exact) {
      if (!/^(?:--?)?[a-z0-9][a-z0-9_./ -]+$/.test(name) && !/^[\u3400-\u9fff]{4,}$/.test(name)) continue;
      // 泛化短词无论库大小、文档频率或是否为 canonical ID，都不获得名称奖励
      if (GENERIC_SHORT_NAMES.has(name)) continue;
      if (
        name !== page.id.toLowerCase() &&
        /^[a-z]{2,3}$/.test(name) &&
        index.pages.length >= 20 &&
        (index.postings.get(name)?.size ?? 0) > index.pages.length * 0.65
      ) {
        continue;
      }
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const leftGuard = /^[a-z]{2,3}$/.test(name) ? "(?<![a-z0-9_.-])" : "(?<![a-z0-9_-])";
      if (new RegExp(`${leftGuard}${escaped}(?![a-z0-9_])`).test(q)) named.set(page.id, page);
    }
    for (const page of named.values()) {
      nameMatched.add(page.id);
      add(page, FIELD_WEIGHT[0] * idf(index.pages.length, named.size), "keyword");
    }
  }

  // 宽松匹配：把查询里的每个连续拉丁片段压成无分隔符形式，与页面标识符互为前缀即算
  // 命中。「layer share 是什么意思」→「layershare」是「layersharding」的前缀 → 命中。
  // 得分不再是固定 800–900：按「这个片段被几页认领」算 idf，记作一次标题字段命中——
  // 「hccl_buffsize」只有一页认领，分高；「vllm-ascend」满库都沾边，自然低分。
  // 不再先试整句、命中了就跳过片段：问题以标识符开头时（09-23 的 HCCL 病例），
  // 整句压平后恰好前缀命中总览页，逐片段那一步被跳过，真正的高分标识符就丢了。
  let hasFuzzyMatch = false;
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
      hasFuzzyMatch = true;
      const patternIdf = idf(index.pages.length, matched.size);
      for (const { page, closeness } of matched.values()) {
        nameMatched.add(page.id);
        add(page, patternIdf * closeness * saturate(weightedTf(index, page.id, [1, 0, 0])), "fuzzy");
      }
    }
  }

  const ts = [...new Set(terms(normIdentifierDashes(query)))];
  const termKeyRules = !hit && !looksLikeRawTrace(query) ? matchedTermKeyRules(index, q) : [];

  // Guard against hallucinated / nonexistent single compound identifiers (e.g. `UnseenHallucinatedParam_999`
  // or `--imaginary-hyperdrive-flag-xyz`): when the entire query is a single ASCII identifier with neither
  // exact, fuzzy, nor whole-token posting match, and at least one alphabetic sub-word (>=3 chars)
  // does not exist anywhere in the index, do not return unrelated pages matched solely by generic suffixes
  // like `_param`, `_config`, `_flag`, or bare line numbers.
  const trimmedAsciiDashes = normIdentifierDashes(query.trim());
  const isSingleCompoundIdentifier =
    /^(?:--?)?[a-z0-9]+(?:[_.-][a-z0-9]+)*$/i.test(trimmedAsciiDashes) &&
    (ts.length > 1 || /[_.-]/.test(trimmedAsciiDashes));
  const squashedWholeQuery = squash(q.replace(/^--?/, ""));
  const rejectHallucinatedCompound =
    !hit &&
    !hasFuzzyMatch &&
    termKeyRules.length === 0 &&
    isSingleCompoundIdentifier &&
    !index.postings.has(squashedWholeQuery) &&
    ts.some((t) => t.length >= 3 && /[a-z]/.test(t) && t !== squashedWholeQuery && !index.postings.has(t));

  const scorePostingTerms = (queryTerms: Iterable<string>, weight: number) => {
    for (const t of queryTerms) {
      const byPage = index.postings.get(t);
      if (!byPage) continue;
      // 纯双字母拉丁词（kv、tp、pp）只算标题字段命中，正文里的出现是噪声；带数字的 o2 / a2 仍查全文
      const fields = t.length < 3 && /^[a-z]+$/.test(t) ? SHORT_LATIN_FIELDS : undefined;
      const df = fields ? [...byPage.entries()].filter(([, tf]) => tf[0]! > 0).length : byPage.size;
      if (!df) continue;
      // 中文二元切分噪声（「什么是」切出的「么是」）与纯数字行号在全库标题/摘要中均未出现时，idf 封顶，
      // 但完整拉丁/字母数字技术标识符（如 zmqerror、capturemodel、235b）保留真实 idf。
      const anchored = [...byPage.values()].some((tf) => tf[0]! > 0 || tf[1]! > 0);
      const capUnanchoredNoise = !anchored && (/^[\u3400-\u9fff]{2}$/.test(t) || /^\d+$/.test(t));
      const termIdf = capUnanchoredNoise
        ? Math.min(idf(index.pages.length, df), BODY_ONLY_IDF_CAP)
        : idf(index.pages.length, df);
      for (const [pageId, tf] of byPage) {
        const wtf = weightedTf(index, pageId, tf, fields);
        if (wtf > 0) add(index.byId.get(pageId)!, weight * termIdf * saturate(wtf), "keyword");
      }
    }
  };

  if (!rejectHallucinatedCompound) {
    scorePostingTerms(ts, 1);
    if (!hit) {
      const explicitSet = new Set(ts);
      const expandedTerms = new Set<string>();
      for (const rule of COLLOQUIAL_TERM_EXPANSIONS) {
        if (!rule.pattern.test(q)) continue;
        for (const phrase of rule.phrases) {
          for (const et of terms(phrase)) {
            if (!explicitSet.has(et)) expandedTerms.add(et);
          }
        }
      }
      if (expandedTerms.size > 0) {
        scorePostingTerms(expandedTerms, COLLOQUIAL_EXPANSION_WEIGHT);
      }
      scoreTermKeyExpansions(index, termKeyRules, explicitSet, add);
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

  applyNamePrefixFloor(index, query, scored);

  // 单复合标识符（initial_verify_budget_per_req / --enable-chunked-prefill / AllReduce）：
  // 先确定可返回的页面集合，再 round / sort / slice，避免只靠零散子词蹭分的无关文章占满结果。
  if (!rejectHallucinatedCompound) {
    const allowed = compoundIdentifierAllowedPages(index, query, scored, nameMatched);
    if (allowed) {
      for (const id of [...scored.keys()]) if (!allowed.has(id)) scored.delete(id);
    }
  }

  for (const entry of scored.values())
    if (entry.how !== "exact") entry.score = Math.round(entry.score * 1000) / 1000;

  // 同分按代码单元序（不依赖运行环境 locale），保证不同引擎 / 默认语言下排序一致
  const direct = [...scored.values()]
    .sort((a, b) => b.score - a.score || (a.page.id < b.page.id ? -1 : a.page.id > b.page.id ? 1 : 0))
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
