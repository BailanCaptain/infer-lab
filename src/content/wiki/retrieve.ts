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

export interface PageIndex {
  id: string;
  title: string;
  aliases: string[];
  summary: string;
  chapters: string[];
  evidence: string;
  /** 双向 related（HANDBOOK「整合」保证对称），图扩展靠它 */
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
  how: "exact" | "keyword" | "related";
  /** how 为 related 时，说明是从哪一页牵出来的 */
  via?: string;
}

export interface RetrieveOptions {
  limit?: number;
  /**
   * 图扩展（AC12）：直接命中之后，把命中页的 `related` 也带出来当二级候选。
   * 只走一跳——两跳之后相关性衰减很快，而 70 条边、64% 密度的图两跳几乎等于全库。
   */
  expand?: boolean;
}

export interface Index {
  pages: PageIndex[];
  /** 归一化后的 id / title / alias → 页 */
  exact: Map<string, PageIndex>;
  byId: Map<string, PageIndex>;
}

const norm = (s: string) => s.trim().toLowerCase();

export function buildIndex(pages: PageIndex[]): Index {
  const exact = new Map<string, PageIndex>();
  for (const p of pages) {
    for (const key of [p.id, p.title, ...p.aliases]) {
      const k = norm(key);
      if (k && !exact.has(k)) exact.set(k, p);
    }
  }
  return { pages, exact, byId: new Map(pages.map((p) => [p.id, p])) };
}

/** 拆成检索词：按非字母数字与 CJK 边界切，去掉太短的噪声词。 */
function terms(query: string): string[] {
  const raw = query
    .toLowerCase()
    .split(/[^a-z0-9_一-鿿]+/)
    .filter(Boolean);
  const out: string[] = [];
  for (const t of raw) {
    if (/^[a-z0-9_]+$/.test(t)) {
      if (t.length >= 2 && !STOP_EN.has(t)) out.push(t);
    } else {
      // 中文按二元切分，"块表是干嘛的" → 块表 / 表是 / ...
      if (t.length === 1) continue;
      for (let i = 0; i + 2 <= t.length; i++) out.push(t.slice(i, i + 2));
    }
  }
  return out;
}

const STOP_EN = new Set(["is", "the", "a", "an", "of", "to", "in", "on", "what", "how", "why", "and"]);

export function retrieve(query: string, index: Index, opts: RetrieveOptions = {}): Hit[] {
  const limit = opts.limit ?? 5;
  const q = norm(query);
  if (!q) return [];

  const scored = new Map<string, { page: PageIndex; score: number; how: Hit["how"] }>();

  const hit = index.exact.get(q);
  if (hit) scored.set(hit.id, { page: hit, score: 1000, how: "exact" });

  const ts = terms(query);
  if (ts.length > 0) {
    for (const p of index.pages) {
      const idText = norm(`${p.id} ${p.title} ${p.aliases.join(" ")}`);
      const body = norm(`${p.summary}\n${p.text}`);
      let score = 0;
      for (const t of ts) {
        if (idText.includes(t)) score += 8;
        if (body.includes(t)) score += 1;
      }
      if (score === 0) continue;
      const prev = scored.get(p.id);
      if (prev) prev.score += score;
      else scored.set(p.id, { page: p, score, how: "keyword" });
    }
  }

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

  if (!opts.expand || direct.length === 0) return direct.map(toHit);

  // 一跳扩展：按牵出它的那页的分数排序，且排在全部直接命中之后
  const seen = new Set(direct.map((d) => d.page.id));
  const expanded: Hit[] = [];
  for (const d of direct) {
    for (const rid of d.page.related ?? []) {
      if (seen.has(rid)) continue;
      const page = index.byId.get(rid);
      if (!page) continue;
      seen.add(rid);
      expanded.push({ ...toHit({ page, score: d.score / 2, how: "related" }), via: d.page.id });
    }
  }
  return [...direct.map(toHit), ...expanded].slice(0, limit + expanded.length);
}

export interface CitationVerdict {
  cited: boolean;
  /** agent 自己声明「未收录」，属于诚实回答，不判违规 */
  selfDeclaredUncovered: boolean;
  reason?: string;
}

/** 指向 wiki 页的链接：相对 md 链接或 hash 路由。 */
const PAGE_LINK = /\]\((?:#\/wiki\/[a-z0-9-]+|(?:\.\.\/)?(?:concepts|sources|params)\/[a-z0-9-]+\.md)\)/i;
/** agent 明确声明知识库没有这一条 */
const UNCOVERED = /（未收录）|\(未收录\)|知识库里?还没有|知识库中没有|尚未收录/;
/** 断言式表述：陈述事实而非提问或澄清 */
const ASSERTION = /[。．.!！]/;

export function citationCheck(answer: string): CitationVerdict {
  const text = answer.trim();
  if (!text) return { cited: false, selfDeclaredUncovered: false, reason: "回答为空" };

  if (UNCOVERED.test(text)) return { cited: true, selfDeclaredUncovered: true };
  if (PAGE_LINK.test(text)) return { cited: true, selfDeclaredUncovered: false };

  // 全是疑问句（反问、澄清）不构成断言，不要求引用
  const hasAssertion = ASSERTION.test(text.replace(/[^。．.!！?？]/g, "").replace(/[?？]/g, ""));
  if (!hasAssertion) return { cited: true, selfDeclaredUncovered: false };

  return {
    cited: false,
    selfDeclaredUncovered: false,
    reason: "回答里有断言但没有引用任何知识库页面",
  };
}
