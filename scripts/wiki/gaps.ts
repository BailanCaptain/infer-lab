import type { WikiPage } from "./pages";

/**
 * 漏洞扫描：正文反复引用、但知识库里没有页的概念。
 *
 * 这是 2026-09-11 用户点出来的缺口。当时 11 页里 attention 出现 234 次、
 * connector 71 次、MLA 33 次、GQA 20 次、DCP 10 次——没有一个有页面，而系统
 * 对此一无所知。「识别到交叉和漏洞」里的交叉勉强有（整合 agent 报矛盾），
 * 漏洞是零。
 *
 * 判据不是「出现过」而是「被当成读者已经懂的东西反复用」：
 *   - 至少在 MIN_PAGES 页里出现（只在一页里出现多半是那页的局部话题）
 *   - 总次数至少 MIN_HITS
 * 两条都满足，才值得单开一页。
 */

export interface Gap {
  term: string;
  hits: number;
  /** 出现在哪些页，用来判断它属于哪个章节 */
  pages: string[];
}

export interface GapOptions {
  minHits?: number;
  minPages?: number;
  /** 已知不需要单开页的词（太泛、或本来就是别的页的标题） */
  ignore?: Iterable<string>;
}

const DEFAULTS = { minHits: 8, minPages: 3 };

/**
 * 候选词：反引号里的标识符，以及连续的大写缩写（MLA、GQA、DCP、HCCL）。
 * 中文词不扫——中文的分词在这里不可靠，宁可漏也不要制造一堆噪声。
 */
const BACKTICK_RE = /`([A-Za-z_][A-Za-z0-9_.]{2,})`/g;
const ACRONYM_RE = /\b([A-Z]{2,6})\b/g;

/** 语言关键字、类型名一类，出现再多也不是「知识点」 */
const STOPWORDS = new Set([
  "TODO",
  "NOTE",
  "FIXME",
  "API",
  "CPU",
  "GPU",
  "NPU",
  "HBM",
  "KV",
  "PR",
  "URL",
  "JSON",
  "YAML",
  "MB",
  "GB",
  "KB",
  "KIB",
  "MIB",
  "GIB",
  "int",
  "float",
  "bool",
  "str",
  "None",
  "True",
  "False",
  "self",
  "def",
  "class",
  "import",
  "return",
  "assert",
  "if",
  "else",
  "for",
  "while",
]);

function candidates(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(BACKTICK_RE)) if (m[1]) out.push(m[1]);
  for (const m of text.matchAll(ACRONYM_RE)) if (m[1]) out.push(m[1]);
  return out;
}

/** 概念名 → 可能的页 id，用来判断「这个概念是不是已经有页了」 */
export function toId(term: string): string {
  return (
    term
      // KVPool → KV-Pool：缩写开头的驼峰要先断，否则会归一成 kvpool 对不上 kv-pool
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .replace(/[_.\s]+/g, "-")
      .toLowerCase()
  );
}

export function findGaps(pages: WikiPage[], opts: GapOptions = {}): Gap[] {
  const minHits = opts.minHits ?? DEFAULTS.minHits;
  const minPages = opts.minPages ?? DEFAULTS.minPages;
  // 已有页的 id 与别名都算「已覆盖」
  const covered = new Set<string>();
  for (const p of pages) {
    covered.add(p.fm.id);
    covered.add(toId(p.fm.title));
    for (const a of p.fm.aliases) covered.add(toId(a));
  }
  for (const x of opts.ignore ?? []) covered.add(toId(x));

  const hits = new Map<string, { n: number; pages: Set<string> }>();
  for (const p of pages) {
    for (const term of candidates(p.body)) {
      if (STOPWORDS.has(term)) continue;
      const id = toId(term);
      if (covered.has(id)) continue;
      const rec = hits.get(term) ?? { n: 0, pages: new Set<string>() };
      rec.n++;
      rec.pages.add(p.fm.id);
      hits.set(term, rec);
    }
  }

  const out: Gap[] = [];
  for (const [term, rec] of hits) {
    if (rec.n < minHits || rec.pages.size < minPages) continue;
    out.push({ term, hits: rec.n, pages: [...rec.pages].sort() });
  }
  return out.sort((a, b) => b.hits - a.hits || a.term.localeCompare(b.term));
}

/** 断掉的 relations：指向不存在的页。它们是最确定的漏洞——有人已经说要连过去了。 */
export function danglingRelations(pages: WikiPage[]): { from: string; to: string; note: string }[] {
  const ids = new Set(pages.map((p) => p.fm.id));
  const out: { from: string; to: string; note: string }[] = [];
  for (const p of pages) {
    for (const r of p.fm.relations) {
      if (!ids.has(r.to)) out.push({ from: p.fm.id, to: r.to, note: r.note });
    }
  }
  return out.sort((a, b) => a.to.localeCompare(b.to) || a.from.localeCompare(b.from));
}
