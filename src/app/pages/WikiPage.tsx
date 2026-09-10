import { ArrowLeft, BookOpen, Link2 } from "lucide-react";
import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { Link, useParams } from "react-router";
import remarkGfm from "remark-gfm";
import { CHAPTER_TITLES } from "../../content/wiki/chapters";
import { getPage, listPages, rewriteRelativeLink, sourceUrl } from "../../content/wiki/index";
import { parseRepoRef, type RegistryEntry } from "../../content/wiki/schema";
import { EvidenceBadge, EvidenceLegend, Term } from "../../content/wiki/Term";
import { ChatDrawer } from "../wiki/ChatDrawer";
import "../../design/wiki.css";

const TYPE_LABEL: Record<string, string> = {
  concept: "术语",
  feature: "特性",
  source: "来源",
  pr: "PR",
};

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
          remarkPlugins={[remarkGfm]}
          components={{
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
      </div>

      <aside className="wiki-side">
        {page.related.length > 0 && (
          <section data-testid="wiki-related">
            <h2>
              <Link2 size={12} /> 相关词条
            </h2>
            <ul>
              {page.related.map((r) => (
                <li key={r}>
                  <Term id={r} />
                </li>
              ))}
            </ul>
          </section>
        )}

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

function SourceItem({ index, ref_ }: { index: number; ref_: string }) {
  const parsed = parseRepoRef(ref_);
  const url = parsed ? sourceUrl(parsed) : ref_.startsWith("http") ? ref_ : null;
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
