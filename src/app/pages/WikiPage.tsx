import { ArrowLeft, ArrowRight, BookOpen } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import ReactMarkdown from "react-markdown";
import { Link, useParams } from "react-router";
import remarkCjkFriendly from "remark-cjk-friendly";
import remarkGfm from "remark-gfm";
import { CHAPTER_TITLES } from "../../content/wiki/chapters";
import { remarkEvidenceMarks } from "../../content/wiki/evidenceMarks";
import {
  getPage,
  getReaderState,
  refreshReaderSnapshot,
  rewriteRelativeLink,
  sourceUrl,
  subscribeReader,
} from "../../content/wiki/index";
import { Mermaid } from "../../content/wiki/Mermaid";
import { groupRelations } from "../../content/wiki/relations";
import { parseRepoRef, type RegistryEntry, rawSourceHref } from "../../content/wiki/schema";
import { EVIDENCE_LEVELS_INFO, EvidenceBadge, EvidenceLegend, Term } from "../../content/wiki/Term";
import { WikiDiagram } from "../../content/wiki/WikiDiagram";
import { wikiRequest } from "../wiki/api";
import { WikiPanel } from "../wiki/WikiPanel";
import "../../design/wiki.css";

/** 与 scripts/wiki/build.ts 的显示名保持一致；漏一个页型会把原始字符串印在页面上 */
const TYPE_LABEL: Record<string, string> = {
  concept: "术语",
  feature: "特性",
  param: "参数",
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

/** `<pre><code class="language-X">…</code></pre>` 的正文；不是这个语言就返回 null */
function fenceSource(node: unknown, language: string): string | null {
  const code = (node as HastNode | undefined)?.children?.[0];
  if (code?.type !== "element" || code.tagName !== "code") return null;
  const cls = code.properties?.className;
  if (!Array.isArray(cls) || !cls.includes(`language-${language}`)) return null;
  const text = code.children?.[0];
  return text?.type === "text" && text.value ? text.value.trim() : null;
}

/** ```wiki-diagram 围栏里的 `file:` 就是 wiki/diagrams/<id>.yaml 的 id */
function diagramId(node: unknown): string | null {
  const body = fenceSource(node, "wiki-diagram");
  if (!body) return null;
  const file = /^\s*file:\s*(\S+)\s*$/m.exec(body)?.[1];
  return file ? file.replace(/\.(ya?ml|svg)$/, "") : null;
}

export function WikiPage() {
  const { id } = useParams();
  const { pages, revision, mode, diagrams } = useSyncExternalStore(subscribeReader, getReaderState);
  const [panel, setPanel] = useState<"closed" | "chat" | "review">("closed");
  const [snapshotError, setSnapshotError] = useState("");
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const updated = await refreshReaderSnapshot(() => wikiRequest("pages"), signal);
    if (updated) setSnapshotError("");
    return updated;
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal).catch(() =>
      setSnapshotError("未能更新，仍显示以上版本。连接问答服务后可重试刷新。"),
    );
    return () => controller.abort();
  }, [refresh]);
  // dev 下 wiki 文件变了（手改，或一次发布）：就地换数据，不整页重载；问答服务不在才退回重载
  useEffect(() => {
    const onChanged = () => void refresh().catch(() => window.location.reload());
    import.meta.hot?.on("wiki:changed", onChanged);
    return () => import.meta.hot?.off("wiki:changed", onChanged);
  }, [refresh]);
  const groups = useMemo(() => groupByChapter(pages), [pages]);
  const page = id ? getPage(id) : undefined;

  return (
    <div className={`wiki-shell is-panel-${panel}`}>
      <nav className="wiki-toc" data-testid="wiki-toc" aria-label="知识库目录">
        <Link className="wiki-toc-home" to="/">
          <ArrowLeft size={12} /> 返回首页
        </Link>
        <div className="wiki-toc-head">
          <span className="eyebrow">KNOWLEDGE BASE</span>
          <strong>知识库</strong>
          <small>{pages.length} 页 · 源码、资料与有引用的推断</small>
          <small data-testid="reader-version" title={revision}>
            {`${mode === "build" ? "构建版本" : "知识版本"} ${revision.slice(0, 12)}`}
          </small>
          {snapshotError && <small role="status">{snapshotError}</small>}
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
        {page && <Article page={page.fm} body={page.body} diagrams={diagrams} />}
      </main>

      <WikiPanel
        revision={revision}
        mode={mode}
        onLayout={setPanel}
        onRefresh={async () => {
          try {
            return await refresh();
          } catch (error) {
            setSnapshotError("未能更新，仍显示以上版本。连接问答服务后可重试刷新。");
            throw error;
          }
        }}
      />
    </div>
  );
}

function Landing({ count }: { count: number }) {
  return (
    <div className="wiki-landing">
      <span className="eyebrow">KNOWLEDGE BASE</span>
      <h1 className="display">知识库</h1>
      <p>知识来自钉住版本的源码、归档资料与有引用的推断；证据等级帮助你区分它们。目前 {count} 页。</p>

      <section className="wiki-start">
        <h2>从这里开始</h2>
        <p>
          全库只跟<strong>一条</strong>请求：Qwen3-0.6B、单卡昇腾、37 个 token 的问题、200 个 token
          的回答。每一页都是「这条请求走到某一刻，发生了什么」。
          先读它，它底下那张行程表会把你送到其余每一页。
        </p>
        <Link className="wiki-start-link" to="/wiki/one-request">
          贯穿全书的那条请求 <ArrowRight size={14} />
        </Link>
        <p className="wiki-start-hint">
          左侧目录里，<strong>章号只说这页属于哪个主题</strong>，<strong>章内从上到下就是该读的顺序</strong>
          ——这两件事是分开的。
        </p>
      </section>

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

function Article({
  page,
  body,
  diagrams,
}: {
  page: RegistryEntry;
  body: string;
  /** 图跟着同一份知识快照传下来，不另起一次订阅 */
  diagrams: Map<string, string>;
}) {
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
          <span
            className={`wiki-chip wiki-origin is-${page.origin}`}
            data-testid="wiki-origin"
            title="生产入口，与事实证据等级分开记录"
          >
            {
              { seed: "源码提取", drop: "资料投喂", chat: "问答沉淀", pr: "PR 整理", gap: "缺口补充" }[
                page.origin
              ]
            }
          </span>
          <span className="wiki-updated">更新于 {page.updated}</span>
        </div>
        <h1 className="display">{page.title}</h1>
        <p className="wiki-summary">{page.summary}</p>
        {page.aliases.length > 0 && <p className="wiki-aliases">也叫：{page.aliases.join("、")}</p>}
      </header>

      <div className="wiki-body" data-testid="wiki-body">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkCjkFriendly, remarkEvidenceMarks]}
          components={{
            // 图的围栏渲染成图。HANDBOOK 要求讲结构关系时必须画图，不接这一段
            // 就会以源码形式显示。在 pre 而不是 code 上拦，否则 <figure> 会落进
            // <pre> 里。wiki-diagram 是现行载体，mermaid 是旧 18 张图的存量。
            pre: ({ children, node }) => {
              const diagram = diagramId(node);
              if (diagram) return <WikiDiagram id={diagram} svg={diagrams.get(diagram)} />;
              const chart = fenceSource(node, "mermaid");
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
        <details className="wiki-sources" data-testid="wiki-sources">
          <summary>查看来源（{page.sources.length}）</summary>
          <p>来源供你核对原文；有来源不代表本页结论已经验证。</p>
          <ol>
            {page.sources.map((source) => {
              const href = hrefOfSource(source);
              return (
                <li key={source}>
                  {href ? (
                    <a href={href} target="_blank" rel="noreferrer">
                      {source}
                    </a>
                  ) : (
                    source
                  )}
                </li>
              );
            })}
          </ol>
        </details>
      </div>

      {page.contradicts.length > 0 && (
        <section className="wiki-contradicts" data-testid="wiki-contradicts">
          <h2>这页里有还没定论的地方</h2>
          <ul>
            {page.contradicts.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

/** 来源引用 → 可点的 URL（源码引用指向钉住 commit 的 GitHub 行号） */
function hrefOfSource(ref: string): string | null {
  const rawHref = rawSourceHref(ref);
  if (rawHref) return rawHref;
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
  // 章内按 order 排，没写 order 的落在中间；同 order 再按标题，保证顺序是稳定的
  for (const list of map.values())
    list.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "zh"));
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}
