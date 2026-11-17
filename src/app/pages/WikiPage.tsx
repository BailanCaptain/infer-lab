import { ArrowLeft, ArrowRight, BookOpen, ChevronDown, ListTree, Search } from "lucide-react";
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { alignCalcLabels, CalcBlock } from "../../content/wiki/CalcBlock";
import { parseCalcFence, textFenceAsCalc } from "../../content/wiki/calc";
import {
  createEvidenceViewController,
  ensurePage,
  ensurePageEvidence,
  findByAlias,
  getPage,
  getReaderState,
  sourceUrl,
  subscribeReader,
} from "../../content/wiki/index";
import {
  createWikiRehypePlugins,
  plainFenceCode,
  textOf,
  WIKI_REMARK_PLUGINS,
} from "../../content/wiki/markdown";
import { pageDisplayTitle } from "../../content/wiki/param-display";
import { groupRelations, prerequisiteRelations } from "../../content/wiki/relations";
import {
  type CompiledNode,
  parseRepoRef,
  type RegistryEntry,
  rawSourceHref,
  resolveCanonicalPageId,
} from "../../content/wiki/schema";
import { EVIDENCE_LEVELS_INFO, EvidenceBadge, EvidenceLegend, Term } from "../../content/wiki/Term";
import { buildToc, type TocPart } from "../../content/wiki/toc";
import { WikiDiagram } from "../../content/wiki/WikiDiagram";
import { useWikiAssistant } from "../wiki/assistant-context";
import { hasPageToc, type PageHeading, PageTocFab, PageTocSide, readHeadings } from "../wiki/PageToc";
import { ReaderResizeHandle } from "../wiki/ReaderResizeHandle";
import { isSceneLessonId, sceneAnchorIds } from "../wiki/scene-lessons";
import {
  canonicalWikiRedirectTarget,
  expandAncestorDetails,
  isPlainPrimaryLinkClick,
  scrollToWikiFragment,
  WikiContentLink,
} from "../wiki/WikiLink";
import { WikiScene } from "../wiki/WikiScene";
import { WikiToolBlock } from "../wiki/WikiToolBlock";
import "katex/dist/katex.min.css";
import "../../design/wiki.css";

export { canonicalWikiRedirectTarget } from "../wiki/WikiLink";

/** 与 scripts/wiki/build.ts 的显示名保持一致；漏一个页型会把原始字符串印在页面上 */
/** seeds 里的分支名 → 页头上给读者看的版本名：`releases/v0.26.0rc` → `v0.26.0rc` */
const versionLabel = (ref: string) =>
  ref === "rfork:main" ? "RFork 工作版" : ref.replace(/^releases\//, "");
/** 发布分支按版本号从旧到新，开发主线 main 放最后 */
const versionOrder = (refs: string[]) =>
  [...refs].sort(
    (a, b) => Number(a === "main") - Number(b === "main") || a.localeCompare(b, "en", { numeric: true }),
  );

const TYPE_LABEL: Record<string, string> = {
  concept: "概念",
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

function hasFenceLanguage(node: unknown, language: string): boolean {
  const code = (node as HastNode | undefined)?.children?.[0];
  if (code?.type !== "element" || code.tagName !== "code") return false;
  const cls = code.properties?.className;
  return Array.isArray(cls) && cls.includes(`language-${language}`);
}

/** 不标语言或标 text 的代码块正文；算式块识别只看这两种。字已被 rehypeTextGrid 分进字格，按拼起来的原文认 */
function plainFenceSource(node: unknown): string | null {
  const code = plainFenceCode(node as HastNode | undefined);
  const text = code ? textOf(code) : "";
  return text ? text.replace(/\n$/, "") : null;
}

/** ```wiki-diagram 围栏里的 `file:` 就是 wiki/diagrams/<id>.yaml 的 id */
function diagramId(node: unknown): string | null {
  const body = fenceSource(node, "wiki-diagram");
  if (!body) return null;
  const file = /^\s*file:\s*(\S+)\s*$/m.exec(body)?.[1];
  return file ? file.replace(/\.(ya?ml|svg)$/, "") : null;
}

const desktopDirectory = () => window.matchMedia("(min-width: 1025px)").matches;
function subscribeDirectory(listener: () => void) {
  const media = window.matchMedia("(min-width: 1025px)");
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

/**
 * 窄窗目录抽屉状态机：跨过桌面断点（进入或离开桌面常驻栏）时清零窄窗临时展开态，
 * 保证 1440 → 1000 手动展开 → 1440 → 1000 回到收起，且不触碰目录内分组的手动展开集合。
 */
export function resolveDirectoryDrawerState(
  prev: { readonly desktop: boolean; readonly directoryOpen: boolean },
  nextDesktop: boolean,
): { readonly desktop: boolean; readonly directoryOpen: boolean } {
  if (prev.desktop === nextDesktop) return prev;
  return { desktop: nextDesktop, directoryOpen: false };
}

export function WikiPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { pages, revision, mode, diagrams, skipped } = useSyncExternalStore(
    subscribeReader,
    getReaderState,
    getReaderState,
  );
  const canonicalId = id ? resolveCanonicalPageId(pages, id, skipped) : undefined;
  const activeId = canonicalId ?? id;
  useLayoutEffect(() => {
    const target = canonicalWikiRedirectTarget(id, canonicalId, location);
    if (target) navigate(target, { replace: true });
  }, [id, canonicalId, location, navigate]);
  const assistant = useWikiAssistant();
  const { panel, snapshotError, openEvidence, registerWikiHost } = assistant;
  const evidenceController = useMemo(
    () => createEvidenceViewController({ loadPageEvidence: ensurePageEvidence }),
    [],
  );
  useEffect(() => {
    evidenceController.syncContext(activeId, revision);
  }, [activeId, revision, evidenceController]);
  const openSourceEvidence = useCallback(
    (sourceIndex: number, trigger: HTMLElement | null) => {
      if (!activeId) return;
      openEvidence(trigger);
      void evidenceController.openForSource(activeId, revision, sourceIndex);
    },
    [activeId, revision, evidenceController, openEvidence],
  );
  const openDiagramRef = useRef<(diagramId: string, trigger: HTMLElement | null) => void>(() => {});
  openDiagramRef.current = (diagramId: string, trigger: HTMLElement | null) => {
    if (!activeId) return;
    openEvidence(trigger);
    void evidenceController.openForDiagram(activeId, revision, diagramId, 0);
  };
  const openDiagramEvidence = useCallback((diagramId: string, trigger: HTMLElement | null) => {
    openDiagramRef.current(diagramId, trigger);
  }, []);
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [pageError, setPageError] = useState("");
  useLayoutEffect(
    () =>
      registerWikiHost({
        currentId: activeId,
        evidenceController,
        onQuickSearchNavigate: () => setDirectoryOpen(false),
      }),
    [activeId, evidenceController, registerWikiHost],
  );
  const desktop = useSyncExternalStore(subscribeDirectory, desktopDirectory, () => true);
  const [prevDesktop, setPrevDesktop] = useState(desktop);
  if (desktop !== prevDesktop) {
    const nextDrawer = resolveDirectoryDrawerState({ desktop: prevDesktop, directoryOpen }, desktop);
    setPrevDesktop(nextDrawer.desktop);
    if (nextDrawer.directoryOpen !== directoryOpen) {
      setDirectoryOpen(nextDrawer.directoryOpen);
    }
  }
  const toc = useMemo(() => buildToc(pages), [pages]);
  const query = directoryQuery.trim().toLocaleLowerCase();
  const matchingIds = new Set(
    pages
      .filter((p) =>
        [p.id, p.file, p.title, pageDisplayTitle(p), ...(p.legacyIds ?? []), ...p.aliases].some((name) =>
          name.toLocaleLowerCase().includes(query),
        ),
      )
      .map((p) => p.id),
  );
  const page = activeId ? getPage(activeId) : undefined;
  const knownPage = Boolean(canonicalId);
  // biome-ignore lint/correctness/useExhaustiveDependencies: A new snapshot must retry the external page loader.
  useEffect(() => {
    setPageError("");
    if (!activeId) return;
    let live = true;
    void ensurePage(activeId).catch((error: Error) => {
      if (live) setPageError(error.message);
    });
    return () => {
      live = false;
    };
  }, [activeId, revision]);
  const activePart = toc.find((part) =>
    part.sections.some((section) => section.pages.some((p) => p.id === activeId)),
  );
  const activeSection = activePart?.sections.find((section) => section.pages.some((p) => p.id === activeId));
  const orderedPages = toc.flatMap((part) => part.sections.flatMap((section) => section.pages));
  const currentIndex = orderedPages.findIndex((p) => p.id === activeId);

  // 左侧目录各分组的展开状态放在这一层：换页不重挂目录，读者手动展开/收起的分组都保留。
  // 每换到一页（或目录数据到位），当前页所在分组补成展开；首页展开「指南」。
  const autoGroup = activePart?.id ?? (activeId ? undefined : "guide");
  const [expandedGroups, setExpandedGroups] = useState<ReadonlySet<string>>(() => new Set());
  const [autoOpenedFor, setAutoOpenedFor] = useState<string>();
  const autoKey = `${activeId ?? ""}|${autoGroup ?? ""}`;
  if (autoKey !== autoOpenedFor) {
    setAutoOpenedFor(autoKey);
    if (autoGroup && !expandedGroups.has(autoGroup))
      setExpandedGroups(new Set(expandedGroups).add(autoGroup));
  }
  const setGroupOpen = (groupId: string, open: boolean) =>
    setExpandedGroups((groups) => {
      if (groups.has(groupId) === open) return groups;
      const next = new Set(groups);
      if (open) next.add(groupId);
      else next.delete(groupId);
      return next;
    });

  // 换页后：目录里的当前项滚进目录的可视范围，焦点移到正文（首次进入不抢焦点）
  const tocNav = useRef<HTMLElement>(null);
  const shownId = useRef(activeId);
  useEffect(() => {
    tocNav.current?.querySelector(".wiki-toc a.is-active")?.scrollIntoView({ block: "nearest" });
    if (shownId.current === activeId) return;
    shownId.current = activeId;
    document.getElementById("main-content")?.focus({ preventScroll: true });
  }, [activeId]);

  const activeDisplayTitle = page ? pageDisplayTitle(page.fm) : undefined;
  useEffect(() => {
    document.title = `${activeDisplayTitle ?? "大模型推理"} · AI Infra`;
  }, [activeDisplayTitle]);

  return (
    <div className="reader-content">
      <div className={`wiki-shell is-panel-${panel}`}>
        <details
          className="reader-directory"
          open={desktop || directoryOpen}
          onToggle={(event) => {
            if (!desktop) setDirectoryOpen(event.currentTarget.open);
          }}
        >
          <summary>
            <ListTree size={17} aria-hidden="true" />
            主题目录
            <ChevronDown size={15} aria-hidden="true" />
          </summary>
          <nav ref={tocNav} className="wiki-toc" data-testid="wiki-toc" aria-label="知识库目录">
            <div className="wiki-toc-head">
              <Link className="reader-overview" to="/wiki" onClick={() => setDirectoryOpen(false)}>
                全部主题 <span>{pages.length} 篇</span>
              </Link>
            </div>
            <div className="wiki-toc-search">
              <label className="reader-search">
                <Search size={15} aria-hidden="true" />
                <input
                  type="search"
                  aria-label="搜索知识库目录"
                  placeholder="搜索概念、别名或参数"
                  value={directoryQuery}
                  onChange={(event) => setDirectoryQuery(event.target.value)}
                />
              </label>
              {directoryQuery && (
                <button type="button" onClick={() => setDirectoryQuery("")}>
                  清除搜索
                </button>
              )}
              {query && (
                <small role="status">
                  {matchingIds.size ? `${matchingIds.size} 个匹配页面` : "没有匹配的页面，可换个名称搜索。"}
                </small>
              )}
            </div>
            {toc.map((part, i) => {
              const sections = part.sections
                .map((section) => ({ ...section, pages: section.pages.filter((p) => matchingIds.has(p.id)) }))
                .filter((section) => section.pages.length);
              const count = sections.reduce((n, s) => n + s.pages.length, 0);
              if (!count) return null;
              const body = sections.map((section) => (
                <section key={section.title} className="wiki-toc-group">
                  {section.title && <h3 className="wiki-toc-section">{section.title}</h3>}
                  <ul>
                    {section.pages.map((p) => (
                      <li key={p.id}>
                        <Link
                          className={p.id === activeId ? "is-active" : undefined}
                          aria-current={p.id === activeId ? "page" : undefined}
                          to={`/wiki/${p.id}`}
                          onClick={() => setDirectoryOpen(false)}
                        >
                          {pageDisplayTitle(p)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ));
              const head = (
                <>
                  <span className="wiki-toc-chapter">{String(i + 1).padStart(2, "0")}</span>
                  <span className="wiki-toc-title">{part.title}</span>
                  <small className="wiki-toc-count">{count}</small>
                </>
              );
              return (
                <details
                  // 搜索时全部展开；进出搜索重挂一次，让 DOM 回到受控的展开状态
                  key={`${part.id}-${!!query}`}
                  className="wiki-toc-part"
                  data-testid={`toc-${part.id}`}
                  open={!!query || expandedGroups.has(part.id)}
                  onToggle={(event) => {
                    if (!query) setGroupOpen(part.id, event.currentTarget.open);
                  }}
                >
                  <summary className="wiki-toc-part-head" title={part.blurb}>
                    {head}
                  </summary>
                  {body}
                </details>
              );
            })}
            <details className="reader-build-info">
              <summary>内容与版本</summary>
              <small data-testid="reader-version" title={revision}>
                {`${mode === "build" ? "构建版本" : "知识版本"} ${revision.slice(0, 12)}`}
              </small>
              <p>结论的适用版本与来源列在各篇正文中。</p>
              {snapshotError && <small role="status">{snapshotError}</small>}
            </details>
          </nav>
          <ReaderResizeHandle side="directory" />
        </details>

        <main className="wiki-main" id="main-content" tabIndex={-1}>
          {!id && (
            <Landing count={pages.length} guide={pages.find((entry) => entry.id === GUIDE_ID)} toc={toc} />
          )}
          {id && !page && !knownPage && <MissingPage id={id} skipped={skipped} />}
          {id && !page && knownPage && (
            <p className="reader-loading" role="status">
              {pageError || "正在载入正文…"}
              {/* A failed module import is cached by the browser until the document reloads. */}
              {pageError && (
                <button type="button" onClick={() => window.location.reload()}>
                  重试
                </button>
              )}
            </p>
          )}
          {page && (
            <>
              <nav className="reader-breadcrumb" aria-label="当前位置">
                <Link to="/wiki">主章节</Link>
                <span>/</span>
                <span>{activePart?.title}</span>
                {activeSection?.title && (
                  <>
                    <span>/</span>
                    <span>{activeSection.title}</span>
                  </>
                )}
                <span>/</span>
                <span aria-current="page">{pageDisplayTitle(page.fm)}</span>
              </nav>
              <Article
                key={page.fm.id}
                page={page.fm}
                body={page.body}
                compiled={page.compiled}
                diagrams={diagrams}
                onOpenSource={openSourceEvidence}
                onOpenDiagram={openDiagramEvidence}
              />
              <nav className="reader-pagination" aria-label="章节翻页">
                {orderedPages[currentIndex - 1] ? (
                  <Link to={`/wiki/${orderedPages[currentIndex - 1]!.id}`}>
                    <small>
                      <ArrowLeft size={14} /> 上一节
                    </small>
                    <span>{pageDisplayTitle(orderedPages[currentIndex - 1]!)}</span>
                  </Link>
                ) : (
                  <span />
                )}
                {orderedPages[currentIndex + 1] && (
                  <Link to={`/wiki/${orderedPages[currentIndex + 1]!.id}`}>
                    <small>
                      下一节 <ArrowRight size={14} />
                    </small>
                    <span>{pageDisplayTitle(orderedPages[currentIndex + 1]!)}</span>
                  </Link>
                )}
              </nav>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

/**
 * 路由指向的页不在快照里。被跳过的坏页（写手存了半页、校验没过）只说「暂不可用」，
 * 校验细节在 console 里给写手看，不堆给读者；快照里根本没有的页才说「还没有」。
 */
export function MissingPage({ id, skipped }: { id: string; skipped: ReadonlySet<string> }) {
  return skipped.has(id) ? (
    <div className="wiki-empty" data-testid="wiki-unavailable">
      <BookOpen size={28} />
      <strong>{id}</strong>
      <p>该页暂不可用</p>
    </div>
  ) : (
    <div className="wiki-empty" data-testid="wiki-notfound">
      <BookOpen size={28} />
      <strong>知识库里还没有「{id}」这一页</strong>
      <p>可以从左侧目录挑一页读，或让灌种流程补上这个词条。</p>
    </div>
  );
}

/** 首页「从这里开始」的入口页：标题与导语都取它的 frontmatter，不在这里复写一遍 */
const GUIDE_ID = "learning-guide";

function Landing({
  count,
  guide,
  toc,
}: {
  count: number;
  guide: RegistryEntry | undefined;
  toc: TocPart<RegistryEntry>[];
}) {
  return (
    <div className="wiki-landing">
      <header className="reader-intro">
        <span className="eyebrow">THE INFERENCE HANDBOOK</span>
        <h1 className="display">大模型推理</h1>
        <p>从模型计算到系统执行，按主题读懂推理的每一部分。</p>
        <span className="reader-collection-note">
          {toc.length} 个主题 · {count} 篇内容
        </span>
      </header>

      {guide && (
        <section className="wiki-start" data-testid="wiki-start">
          <div>
            <span className="eyebrow">START HERE</span>
            <h2>第一次来，从阅读指南开始</h2>
          </div>
          <Link className="wiki-start-link" to={`/wiki/${GUIDE_ID}`}>
            {pageDisplayTitle(guide)} <ArrowRight size={14} />
          </Link>
          <p>{guide.summary}</p>
        </section>
      )}

      <div className="reader-topics" data-testid="knowledge-topics">
        {toc.map((part, index) => {
          const entries = part.sections.flatMap((section) => section.pages);
          return (
            <section key={part.id} className="reader-topic">
              <header>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h2>{part.title}</h2>
                <small>{entries.length} 篇</small>
              </header>
              <p>{part.blurb}</p>
              <ul>
                {entries.slice(0, 4).map((entry) => (
                  <li key={entry.id}>
                    <Link to={`/wiki/${entry.id}`}>
                      {pageDisplayTitle(entry)}
                      <ArrowRight size={13} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
              {entries.length > 4 && (
                <details className="reader-topic-more">
                  <summary>
                    展开其余 {entries.length - 4} 篇 <ChevronDown size={14} />
                  </summary>
                  <ul>
                    {entries.slice(4).map((entry) => (
                      <li key={entry.id}>
                        <Link to={`/wiki/${entry.id}`}>
                          {pageDisplayTitle(entry)}
                          <ArrowRight size={13} aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </section>
          );
        })}
      </div>
      <details className="reader-evidence-guide">
        <summary>如何理解内容的证据等级</summary>
        <EvidenceLegend />
      </details>
    </div>
  );
}

const DiagramSnapshot = createContext(new Map<string, string>());
const DiagramPageContext = createContext("");
const DiagramEvidenceContext = createContext<
  ((diagramId: string, trigger: HTMLElement | null) => void) | undefined
>(undefined);

// A stable fence type preserves live scene playback when article data or its hash changes.
const WikiFence: Components["pre"] = ({ children, node }) => {
  const diagrams = useContext(DiagramSnapshot);
  const pageId = useContext(DiagramPageContext);
  const onOpenDiagram = useContext(DiagramEvidenceContext);
  const scene = fenceSource(node, "wiki-scene");
  if (scene) {
    const [id, part] = scene.split(":");
    const section = part === undefined ? undefined : Number(part);
    if (id && isSceneLessonId(id) && sceneAnchorIds(scene).length > 0)
      return <WikiScene key={scene} id={id} section={section} />;
  }
  const diagram = diagramId(node);
  if (diagram)
    return (
      <WikiDiagram
        key={`${pageId}:${diagram}`}
        id={diagram}
        svg={diagrams.get(diagram)}
        allowInteractive
        onOpenEvidence={onOpenDiagram}
      />
    );
  if (hasFenceLanguage(node, "wiki-tool")) {
    return <WikiToolBlock source={fenceSource(node, "wiki-tool") ?? ""} />;
  }
  // 算式块（calc.ts / CalcBlock.tsx）：```calc 围栏，和每行都是「标签 = …」的纯文本块。
  // 现有页面的 ```text 算式块不用改写就能认出来；认不出的照旧是代码块
  const source = fenceSource(node, "calc");
  if (source) {
    const { title, rows } = parseCalcFence(source);
    return <CalcBlock rows={rows} title={title} />;
  }
  const plain = plainFenceSource(node);
  const rows = plain ? textFenceAsCalc(plain) : null;
  return rows ? <CalcBlock rows={rows} /> : <pre>{children}</pre>;
};

export const Article = memo(function Article({
  page,
  body,
  compiled,
  diagrams,
  onOpenSource,
  onOpenDiagram,
}: {
  page: RegistryEntry;
  body: string;
  compiled?: CompiledNode | undefined;
  /** 图跟着同一份知识快照传下来，不另起一次订阅 */
  diagrams: Map<string, string>;
  onOpenSource?: ((sourceIndex: number, trigger: HTMLElement | null) => void) | undefined;
  onOpenDiagram?: ((diagramId: string, trigger: HTMLElement | null) => void) | undefined;
}) {
  // hash 路由下 `#/wiki/<id>#锚点` 的锚点在 location.hash。跨页链接、页内链接、直接打开
  // 带锚点的地址都走这里；换页时新正文和标题 id 已在同一次提交里渲染好。
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash || !page.id) return;
    scrollToWikiFragment(hash);
    // 直接打开时中文字体的子集随后才下载完，重排会把标题挤出视口：字体就绪后再对一次
    let live = true;
    void document.fonts?.ready.then(() => live && scrollToWikiFragment(hash));
    return () => {
      live = false;
    };
  }, [hash, page.id]);
  // 本页目录的条目从渲染好的正文里读（id 由 anchors.ts 生成），在绘制前拿到，不闪一下
  const bodyRef = useRef<HTMLDivElement>(null);
  const [headings, setHeadings] = useState<PageHeading[]>([]);
  useLayoutEffect(() => {
    const el = bodyRef.current;
    setHeadings(el && body ? readHeadings(el) : []);
  }, [body]);
  // 页内查找命中默认收起的「对照源码」等折叠区内部节点时，响应 beforematch 自动展开
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const onBeforeMatch = (event: Event) => {
      if (event.target instanceof Element) expandAncestorDetails(event.target);
    };
    el.addEventListener("beforematch", onBeforeMatch);
    return () => el.removeEventListener("beforematch", onBeforeMatch);
  }, []);
  // 整页的算式块标签栏对齐（CalcBlock.tsx）：换页、正文变宽变窄、字体就绪后各量一次
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el || !body || !el.querySelector(".wiki-calc-label")) return;
    let width = -1;
    const align = () => {
      width = el.clientWidth;
      alignCalcLabels(el);
    };
    align();
    // 只跟宽度走：对齐本身会改变正文高度，按高度触发会自己追自己
    const observer = new ResizeObserver(() => {
      if (el.clientWidth !== width) align();
    });
    observer.observe(el);
    let live = true;
    if (document.fonts?.status === "loading") void document.fonts.ready.then(() => live && align());
    return () => {
      live = false;
      observer.disconnect();
    };
  }, [body]);
  // TOC state and hash navigation must not parse or remount the article again.
  const markdown = useMemo(
    () => (
      <ReactMarkdown
        remarkPlugins={compiled ? [] : WIKI_REMARK_PLUGINS}
        rehypePlugins={
          compiled
            ? [() => () => structuredClone(compiled) as never]
            : createWikiRehypePlugins(page.legacyAnchors)
        }
        components={{
          // 图的围栏渲染成图。HANDBOOK 要求讲结构关系时必须画图，不接这一段
          // 就会以源码形式显示。在 pre 而不是 code 上拦，否则 <figure> 会落进
          // <pre> 里。静态图用 wiki-diagram，正文中的母版交互图用 wiki-scene。
          pre: WikiFence,
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
            if (!src) return <EvidenceBadge level={level} />;
            const href = hrefOfSource(src);
            // 带编号的角标能点进去看那一行源码；未知仓库即使没有外部 URL 也能在右侧证据面板打开不可用说明
            return href ? (
              <a
                className="wiki-mark-link"
                href={href}
                target="_blank"
                rel="noreferrer"
                title={`来源 ${idx}`}
                data-source={idx}
                onClick={(event) => {
                  if (!onOpenSource || !isPlainPrimaryLinkClick(event)) return;
                  event.preventDefault();
                  onOpenSource(idx - 1, event.currentTarget);
                }}
              >
                <EvidenceBadge level={level} />
              </a>
            ) : (
              <button
                type="button"
                className="wiki-mark-btn"
                title={`来源 ${idx}`}
                data-source={idx}
                onClick={(event) => onOpenSource?.(idx - 1, event.currentTarget)}
              >
                <EvidenceBadge level={level} />
              </button>
            );
          },
          a: ({ href, children }) => (
            <WikiContentLink href={href} currentId={page.id}>
              {children}
            </WikiContentLink>
          ),
        }}
      >
        {compiled ? "" : body}
      </ReactMarkdown>
    ),
    [body, compiled, onOpenSource, page.id, page.legacyAnchors, page.sources],
  );
  // 只给长页（H2 ≥ 4）；短页一屏半就读完，导航只是噪音
  const withToc = hasPageToc(headings);
  const tocProps = { pageId: page.id, headings, scrollTo: scrollToWikiFragment };
  const article = (
    <article className="wiki-article">
      <header className="wiki-article-head">
        <div className="wiki-article-meta">
          <span className="wiki-type">{TYPE_LABEL[page.type] ?? page.type}</span>
          <EvidenceBadge level={page.evidence} variant="full" />
          {page.verified.length > 0 && (
            <span
              className="wiki-chip wiki-versions"
              data-testid="wiki-versions"
              title="这页已经对着这些版本的源码核过；没列出的版本还没人对过，不代表不成立"
            >
              已核对 {versionOrder(page.verified).map(versionLabel).join(" · ")}
            </span>
          )}
          <span
            className={`wiki-chip wiki-origin is-${page.origin}`}
            data-testid="wiki-origin"
            title="生产入口，与事实证据等级分开记录"
          >
            {
              {
                seed: "源码提取",
                drop: "资料投喂",
                chat: "问答沉淀",
                pr: "PR 整理",
                gap: "缺口补充",
                direct: "直接撰写",
              }[page.origin]
            }
          </span>
          <span className="wiki-updated">更新于 {page.updated}</span>
        </div>
        <h1 className="display">{pageDisplayTitle(page)}</h1>
        <p className="wiki-summary">{page.summary}</p>
        {page.aliases.length > 0 && (
          <details className="wiki-aliases" key={page.id}>
            <summary>别名与参数名（{page.aliases.length}）</summary>
            <p>{page.aliases.join("、")}</p>
          </details>
        )}
        <PrerequisiteBar page={page} />
      </header>

      <div className="wiki-body" data-testid="wiki-body" ref={bodyRef}>
        <DiagramPageContext.Provider value={page.id}>
          <DiagramEvidenceContext.Provider value={onOpenDiagram}>
            <DiagramSnapshot.Provider value={diagrams}>{markdown}</DiagramSnapshot.Provider>
          </DiagramEvidenceContext.Provider>
        </DiagramPageContext.Provider>

        <WhatsNext page={page} />
        <details className="wiki-sources" data-testid="wiki-sources">
          <summary>查看来源（{page.sources.length}）</summary>
          <p>来源供你核对原文；有来源不代表本页结论已经验证。</p>
          <ol>
            {page.sources.map((source, i) => {
              const href = hrefOfSource(source);
              return (
                <li key={source} className="wiki-source-item">
                  <span className="wiki-source-row">
                    <button
                      type="button"
                      className="wiki-source-open"
                      data-testid={`source-item-open-${i + 1}`}
                      onClick={(event) => onOpenSource?.(i, event.currentTarget)}
                    >
                      {source}
                    </button>
                    {href && (
                      <a
                        className="wiki-source-ext"
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`在新窗口打开来源 ${i + 1}`}
                      >
                        {source.startsWith("raw:") ? "原文页 ↗" : "外链 ↗"}
                      </a>
                    )}
                  </span>
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
  // 正文与右侧导航并排；放不下时（wiki.css 的容器查询）导航收起、改用右下角按钮。
  // 外框短页也套着：长短页结构相同，量完标题后加上导航时正文不会被卸载重挂
  return (
    <div className="wiki-reading-frame">
      <div className="wiki-reading" data-page-toc={withToc || undefined}>
        {article}
        {withToc && <PageTocSide {...tocProps} />}
      </div>
      {withToc && <PageTocFab {...tocProps} />}
    </div>
  );
});

/** 来源引用 → 可点的 URL（源码引用指向钉住 commit 的 GitHub 行号） */
function hrefOfSource(ref: string): string | null {
  const rawHref = rawSourceHref(ref);
  if (rawHref) return rawHref;
  const parsed = parseRepoRef(ref);
  if (parsed) return sourceUrl(parsed);
  return ref.startsWith("http") ? ref : null;
}

/**
 * 页头紧凑前置阅读（`builds-on`）导览条：
 * 从同一份 `page.relations` 读取直接前置概念，复用 `<Term>` 保留悬停/聚焦卡片与关系 `note`；无前置关系时不占位。
 */
export function PrerequisiteBar({ page }: { page: RegistryEntry }) {
  const items = prerequisiteRelations(page.relations).filter((item) => Boolean(findByAlias(item.id)));
  if (items.length === 0) return null;
  return (
    <nav className="wiki-prereq-bar" data-testid="wiki-prereq-bar" aria-label="前置概念">
      <span className="wiki-prereq-label">先读基础</span>
      <ul className="wiki-prereq-list">
        {items.map((item) => (
          <li key={item.id} className="wiki-prereq-item">
            <Term id={item.id} title={item.note} note={item.note} />
          </li>
        ))}
      </ul>
    </nav>
  );
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
