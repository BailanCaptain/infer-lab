import { ArrowLeft, BookOpen } from "lucide-react";
import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { Link, useParams } from "react-router";
import remarkCjkFriendly from "remark-cjk-friendly";
import remarkGfm from "remark-gfm";
import { CHAPTER_TITLES } from "../../content/wiki/chapters";
import { remarkEvidenceMarks } from "../../content/wiki/evidenceMarks";
import { getPage, listPages, rewriteRelativeLink, sourceUrl } from "../../content/wiki/index";
import { Mermaid } from "../../content/wiki/Mermaid";
import { groupRelations } from "../../content/wiki/relations";
import { parseRepoRef, type RegistryEntry } from "../../content/wiki/schema";
import { EVIDENCE_LEVELS_INFO, EvidenceBadge, EvidenceLegend, Term } from "../../content/wiki/Term";
import { ChatDrawer } from "../wiki/ChatDrawer";
import "../../design/wiki.css";

const TYPE_LABEL: Record<string, string> = {
  concept: "术语",
  feature: "特性",
  source: "来源",
  pr: "PR",
};

const EVIDENCE_LETTERS = new Set(EVIDENCE_LEVELS_INFO.map((e) => e.level as string));

type HastNode = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

/** `<pre><code class="language-mermaid">…</code></pre>` → 图的源码；不是图就返回 null */
function mermaidSource(node: unknown): string | null {
  const code = (node as HastNode | undefined)?.children?.[0];
  if (code?.type !== "element" || code.tagName !== "code") return null;
  const cls = code.properties?.className;
  if (!Array.isArray(cls) || !cls.includes("language-mermaid")) return null;
  const text = code.children?.[0];
  return text?.type === "text" && text.value ? text.value.trim() : null;
}

export function WikiPage() {
  const { id } = useParams();
  const pages = useMemo(() => listPages(), []);
  const groups = useMemo(() => groupByChapter(pages), [pages]);
  const page = id ? getPage(id) : undefined;

  return (
    <div className="wiki-shell">
      <nav className="wiki-toc" data-testid="wiki-toc" aria-label="知识库目录">
        <Link className="wiki-toc-home" to="/">
          <ArrowLeft size={12} /> 返回首页
        </Link>
        <div className="wiki-toc-head">
          <span className="eyebrow">KNOWLEDGE BASE</span>
          <strong>知识库</strong>
          <small>{pages.length} 页 · 来自钉住 commit 的源码</small>
        </div>
        {groups.map(([chapter, list]) => (
          <section key={chapter} className="wiki-toc-group">
            <h2>
              <span className="wiki-toc-chapter">{chapter}</span>
              {CHAPTER_TITLES[chapter] ?? "未归章"}
            </h2>
            <ul>
              {list.map((p) => (
                <li key={p.id}>
                  <Link className={p.id === id ? "is-active" : undefined} to={`/wiki/${p.id}`}>
                    {p.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>

      <main className="wiki-main">
        {!id && <Landing count={pages.length} />}
        {id && !page && (
          <div className="wiki-empty" data-testid="wiki-notfound">
            <BookOpen size={28} />
            <strong>知识库里还没有「{id}」这一页</strong>
            <p>可以从左侧目录挑一页读，或让灌种流程补上这个词条。</p>
          </div>
        )}
        {page && <Article page={page.fm} body={page.body} />}
      </main>

      <ChatDrawer />
    </div>
  );
}

function Landing({ count }: { count: number }) {
  return (
    <div className="wiki-landing">
      <span className="eyebrow">KNOWLEDGE BASE</span>
      <h1 className="display">知识库</h1>
      <p>
        每一页都由 agent 读钉住 commit 的源码写成，正文里的每条结论都能追到具体文件与行号。 目前 {count}{" "}
        页，从左侧目录开始读。
      </p>

      <section className="wiki-legend-block">
        <h2>每页角上的字母是什么</h2>
        <p>
          它标的是这一页的结论<strong>可信到什么程度</strong>。同样一句话，来自源码和来自推断，
          分量完全不同——这里不把两者混为一谈。
        </p>
        <EvidenceLegend />
      </section>
    </div>
  );
}

function Article({ page, body }: { page: RegistryEntry; body: string }) {
  return (
    <article className="wiki-article">
      <header className="wiki-article-head">
        <div className="wiki-article-meta">
          <span className="wiki-type">{TYPE_LABEL[page.type] ?? page.type}</span>
          {page.chapters.map((c) => (
            <span key={c} className="wiki-chip">
              {c} · {CHAPTER_TITLES[c] ?? "未归章"}
            </span>
          ))}
          <EvidenceBadge level={page.evidence} variant="full" />
        </div>
        <h1 className="display">{page.title}</h1>
        <p className="wiki-summary">{page.summary}</p>
        {page.aliases.length > 0 && <p className="wiki-aliases">也叫：{page.aliases.join("、")}</p>}
      </header>

      <div className="wiki-body" data-testid="wiki-body">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkCjkFriendly, remarkEvidenceMarks]}
          components={{
            // ```mermaid 块渲染成图。HANDBOOK 要求讲结构关系时必须画图，
            // 不接这一段图就会以源码形式显示。在 pre 而不是 code 上拦，
            // 否则 <figure> 会落进 <pre> 里。
            pre: ({ children, node }) => {
              const chart = mermaidSource(node);
              return chart ? <Mermaid chart={chart} /> : <pre>{children}</pre>;
            },
            // 事实表比正文列宽，不包一层会溢出到侧栏底下，把「来源」整列裁掉
            table: ({ children }) => (
              <div className="wiki-table-scroll">
                <table>{children}</table>
              </div>
            ),
            // remarkEvidenceMarks 把内联的 [C3] 变成 <abbr data-source="3">C</abbr>。
            // markdown 本身没有 abbr 语法，所以单字母的 abbr 一定是它产的。
            abbr: ({ children, node, ...rest }) => {
              const level = String(children);
              if (!EVIDENCE_LETTERS.has(level)) return <abbr {...rest}>{children}</abbr>;
              const idx = Number((node as HastNode | undefined)?.properties?.["data-source"] ?? 0);
              const src = idx >= 1 && idx <= page.sources.length ? page.sources[idx - 1] : undefined;
              const href = src ? hrefOfSource(src) : null;
              // 带编号的角标能点进去看那一行源码——不能点的角标对读者没用
              return href ? (
                <a
                  className="wiki-mark-link"
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  title={`来源 ${idx}`}
                >
                  <EvidenceBadge level={level} />
                </a>
              ) : (
                <EvidenceBadge level={level} />
              );
            },
            a: ({ href, children }) => {
              const to = rewriteRelativeLink(href ?? "");
              const external = /^https?:/i.test(to);
              return (
                <a href={to} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
                  {children}
                </a>
              );
            },
          }}
        >
          {body}
        </ReactMarkdown>

        <WhatsNext page={page} />
      </div>

      <aside className="wiki-side">
        <section data-testid="wiki-sources">
          <h2>来源 · {page.sources.length} 条</h2>
          <ol>
            {page.sources.map((s, i) => (
              <SourceItem key={s} index={i + 1} ref_={s} />
            ))}
          </ol>
        </section>

        {page.contradicts.length > 0 && (
          <section className="wiki-contradicts">
            <h2>待人审的矛盾</h2>
            <ul>
              {page.contradicts.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </section>
        )}

        <p className="wiki-updated">更新于 {page.updated}</p>
      </aside>
    </article>
  );
}

/** 来源引用 → 可点的 URL（源码引用指向钉住 commit 的 GitHub 行号） */
function hrefOfSource(ref: string): string | null {
  const parsed = parseRepoRef(ref);
  if (parsed) return sourceUrl(parsed);
  return ref.startsWith("http") ? ref : null;
}

/**
 * 「接着看」由 relations 生成，不再让 agent 手写。
 *
 * 以前它在正文里手写一遍、侧栏的「相关词条」又列一遍无理由的 id，两份对不上，
 * 而且侧栏那份更差（没有理由、没有排序）。现在只有一份真相：每条边的 note。
 */
function WhatsNext({ page }: { page: RegistryEntry }) {
  const groups = groupRelations(page.relations, page.backlinks);
  if (groups.length === 0) return null;
  return (
    <section className="wiki-next" data-testid="wiki-next">
      <h2>接着看</h2>
      {groups.map((g) => (
        <div key={g.title} className="wiki-next-group">
          <h3>
            {g.title}
            <span className="wiki-next-hint">{g.hint}</span>
          </h3>
          <ul>
            {g.items.map((it) => (
              <li key={it.id}>
                <Term id={it.id} />
                <span className="wiki-next-note">{it.note}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function SourceItem({ index, ref_ }: { index: number; ref_: string }) {
  const parsed = parseRepoRef(ref_);
  const url = hrefOfSource(ref_);
  const label = parsed
    ? `${parsed.path}${parsed.lineStart ? `#L${parsed.lineStart}${parsed.lineEnd ? `-L${parsed.lineEnd}` : ""}` : ""}`
    : ref_;
  return (
    <li>
      <span className="wiki-source-index">{index}</span>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" title={ref_}>
          {label}
        </a>
      ) : (
        <span title={ref_}>{label}</span>
      )}
    </li>
  );
}

/** 按章节分组；一页可属多章，会在每章都出现。无章节的归到「未归章」。 */
function groupByChapter(pages: RegistryEntry[]): [string, RegistryEntry[]][] {
  const map = new Map<string, RegistryEntry[]>();
  for (const p of pages) {
    const keys = p.chapters.length > 0 ? p.chapters : ["--"];
    for (const k of keys) {
      const list = map.get(k) ?? [];
      list.push(p);
      map.set(k, list);
    }
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}
