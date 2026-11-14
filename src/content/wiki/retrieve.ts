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

import { type CorpusDocument, retrieveCorpus } from "./corpus-retrieve";
import { buildAdjacency } from "./relations";
import type { Relation } from "./schema";

export interface PageIndex {
  id: string;
  title: string;
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

export function buildIndex(pages: PageIndex[]): Index {
  const exact = new Map<string, PageIndex>();
  for (const p of pages) {
    for (const key of [p.id, p.title, ...p.aliases]) {
      const k = norm(key);
      if (k && !exact.has(k)) exact.set(k, p);
    }
  }
  const squashed = new Map<string, PageIndex>();
  for (const p of pages) {
    for (const key of [p.id, p.title, ...p.aliases]) {
      const k = squash(key);
      if (k && !squashed.has(k)) squashed.set(k, p);
    }
  }
  const postings = new Map<string, Map<string, FieldTf>>();
  const fieldLen = new Map<string, FieldTf>();
  const total: FieldTf = [0, 0, 0];
  for (const p of pages) {
    const fields = [`${p.id} ${p.title} ${p.aliases.join(" ")}`, p.summary, p.text];
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
    exact,
    squashed,
    byId: new Map(pages.map((p) => [p.id, p])),
    adjacency: buildAdjacency(pages),
    postings,
    fieldLen,
    avgLen: total.map((n) => n / Math.max(1, pages.length)) as unknown as FieldTf,
  };
}

/**
 * 拆成检索词：拉丁串先按驼峰切开（`PagedAttention` → paged attention），再按
 * 非字母数字切（下划线也切开，`hccl_buffer_size` 与「hccl buffer size」得到同一组词）；
 * 中文按二元切分（"块表是干嘛的" → 块表 / 表是 / …）。索引与查询用同一把刀。
 */
export function terms(text: string): string[] {
  const raw = text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9一-鿿]+/)
    .filter(Boolean);
  const out: string[] = [];
  for (const t of raw) {
    if (/^[a-z0-9]+$/.test(t)) {
      if (t.length >= 2 && !STOP_EN.has(t)) out.push(t);
      // 单字符片段留不住任何信息，丢弃
    } else {
      if (t.length === 1) continue;
      for (let i = 0; i + 2 <= t.length; i++) out.push(t.slice(i, i + 2));
    }
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
      if (!/^[a-z0-9][a-z0-9_./ -]+$/.test(name) && !/^[一-鿿]{4,}$/.test(name)) continue;
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`(?<![a-z0-9_])${escaped}(?![a-z0-9_])`).test(q)) named.set(page.id, page);
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
    for (const frag of q.match(/[a-z0-9_\-. ]{4,}/g) ?? []) {
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
    // 长度 2 的拉丁词（kv、tp、pp）只算标题字段命中，正文里的出现是噪声
    const fields = t.length < 3 && /^[a-z0-9]+$/.test(t) ? SHORT_LATIN_FIELDS : undefined;
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
  for (const entry of scored.values())
    if (entry.how !== "exact") entry.score = Math.round(entry.score * 1000) / 1000;

  const direct = [...scored.values()]
    .sort((a, b) => b.score - a.score || a.page.id.localeCompare(b.page.id))
    .slice(0, limit);

  const toHit = ({ page, score, how }: { page: PageIndex; score: number; how: Hit["how"] }): Hit => ({
    id: page.id,
    title: page.title,
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
