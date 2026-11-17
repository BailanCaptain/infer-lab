import { AlertTriangle, ArrowLeft, Check, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { DropReceipt } from "../../content/wiki/drop";
import { WIKI_REHYPE_PLUGINS, WIKI_REMARK_PLUGINS } from "../../content/wiki/markdown";
import { WikiDiagram } from "../../content/wiki/WikiDiagram";
import { wikiRequest } from "./api";
import { DropReceiptView } from "./DropReceiptView";
import { DropReviewPreview, ReviewMarkdownLink, reviewPageId } from "./DropReviewPreview";
import {
  addedText,
  type DiffFile,
  type DiffLine,
  isContentPage,
  parseReviewDiff,
  splitFrontmatter,
} from "./diff";

export type ReviewState = "pending" | "publishing" | "published" | "rejected";
export interface ReviewSummary {
  id: string;
  state: ReviewState;
  files: string[];
  reason?: string;
  batchable?: boolean;
}
interface Detail {
  review: {
    id: string;
    state: ReviewState;
    reason?: string;
    payload?: {
      drop?: { report: string; receipt?: DropReceipt };
      writes: { path: string; before: string | null; after: string | null }[];
    };
  };
  diff: string;
  placements?: { path: string; before: string; after: string }[];
}

const labels: Record<ReviewState, string> = {
  pending: "待审",
  publishing: "发布待恢复",
  published: "已发布",
  rejected: "已驳回",
};
const kindLabel = { added: "新增", modified: "更新", deleted: "删除" } as const;
/** 待办排前面，其余保持后端顺序 */
const rank: Record<ReviewState, number> = { publishing: 0, pending: 1, published: 2, rejected: 2 };

export function ReviewSvgAssets({
  writes,
}: {
  writes: { path: string; before: string | null; after: string | null }[];
}) {
  const svgWrites = writes.filter((w) => w.path.endsWith(".svg"));
  if (!svgWrites.length) return null;
  return (
    <>
      {svgWrites.map((w) => {
        const fileName = w.path.split("/").at(-1)!;
        const diagramName = reviewPageId(w.path).replace(/\.svg$/, "");
        return (
          <section key={w.path} className="wiki-drop-assets">
            <h3>{diagramName}</h3>
            <div>
              {[
                { key: "before", label: "修改前", svg: w.before },
                { key: "after", label: "修改后", svg: w.after },
              ].map((v) => (
                <div key={v.key}>
                  <p>{v.label}</p>
                  {v.svg ? (
                    <div role="img" aria-label={`${fileName} ${v.label}`}>
                      <WikiDiagram id={`${diagramName}-${v.key}`} svg={v.svg} />
                    </div>
                  ) : (
                    <p>无此图</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

/** 一份审阅包用它改到的正文页来称呼，而不是用哈希 */
function packageTitle(files: string[]): string {
  const pages = files.filter(isContentPage).map(reviewPageId);
  if (!pages.length) return "知识库维护变更";
  return pages.length <= 3 ? pages.join("、") : `${pages.slice(0, 3).join("、")} 等 ${pages.length} 页`;
}

function Line({ line }: { line: DiffLine }) {
  const { text, mark } = line;
  return (
    <tr className={`is-${line.type}`}>
      <td className="wiki-diff-no">{line.oldNo ?? ""}</td>
      <td className="wiki-diff-no">{line.newNo ?? ""}</td>
      <td className="wiki-diff-sign">{line.type === "add" ? "+" : line.type === "del" ? "−" : ""}</td>
      <td className="wiki-diff-text">
        {mark ? (
          <>
            {text.slice(0, mark[0])}
            <mark>{text.slice(mark[0], mark[1])}</mark>
            {text.slice(mark[1])}
          </>
        ) : (
          text || " "
        )}
      </td>
    </tr>
  );
}

export function FileDiff({ file, open }: { file: DiffFile; open: boolean }) {
  // 新增页全是绿色，逐行 diff 没有信息量：默认当成一页正文来读
  const readable = file.kind === "added" && isContentPage(file.path);
  const currentId = reviewPageId(file.path);
  const [mode, setMode] = useState<"read" | "raw">(readable ? "read" : "raw");
  const page = useMemo(() => (readable ? splitFrontmatter(addedText(file)) : undefined), [file, readable]);
  return (
    <details className={`wiki-diff-file is-${file.kind}`} open={open}>
      <summary>
        <ChevronRight size={13} className="wiki-diff-caret" />
        <span className={`wiki-diff-kind is-${file.kind}`}>{kindLabel[file.kind]}</span>
        <code>{file.path.replace(/^wiki\//, "")}</code>
        <span className="wiki-diff-stat">
          {file.added > 0 && <b className="is-add">+{file.added}</b>}
          {file.deleted > 0 && <b className="is-del">−{file.deleted}</b>}
        </span>
      </summary>
      {readable && (
        <fieldset className="wiki-diff-mode" aria-label="查看方式">
          <button type="button" aria-pressed={mode === "read"} onClick={() => setMode("read")}>
            阅读
          </button>
          <button type="button" aria-pressed={mode === "raw"} onClick={() => setMode("raw")}>
            原文
          </button>
        </fieldset>
      )}
      {mode === "read" && page ? (
        <div className="wiki-diff-read">
          {page.frontmatter && (
            <details>
              <summary>页面属性（frontmatter）</summary>
              <pre>{page.frontmatter}</pre>
            </details>
          )}
          <ReactMarkdown
            skipHtml
            remarkPlugins={WIKI_REMARK_PLUGINS}
            rehypePlugins={WIKI_REHYPE_PLUGINS}
            components={{
              a: ({ href, children }) => (
                <ReviewMarkdownLink href={href} currentId={currentId}>
                  {children}
                </ReviewMarkdownLink>
              ),
            }}
          >
            {page.body}
          </ReactMarkdown>
        </div>
      ) : (
        <div className="wiki-diff-scroll">
          <table className="wiki-diff-table">
            <tbody>
              {file.hunks.map((hunk, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: hunks are static per parsed diff
                <HunkRows key={i} header={i > 0 ? hunk.header : undefined} lines={hunk.lines} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}

function HunkRows({ header, lines }: { header: string | undefined; lines: DiffLine[] }) {
  return (
    <>
      {header && (
        <tr className="is-hunk">
          <td colSpan={4}>⋯</td>
        </tr>
      )}
      {lines.map((line, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: lines are static per parsed diff
        <Line key={i} line={line} />
      ))}
    </>
  );
}

export function ReviewPane({
  id,
  hidden,
  reviews,
  listError,
  selected,
  onSelect,
  onChanged,
  onPublished,
}: {
  id: string;
  hidden: boolean;
  reviews: ReviewSummary[];
  listError: string;
  selected: string | undefined;
  onSelect: (id: string | undefined) => void;
  onChanged: (review: { id: string; state: ReviewState; reason?: string }) => void;
  onPublished: () => Promise<void>;
}) {
  const [detail, setDetail] = useState<Detail>();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const [batchResult, setBatchResult] = useState("");
  const selectAll = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    setDetail(undefined);
    setReason("");
    setError("");
    if (selected)
      wikiRequest<Detail>(`reviews/${selected}`)
        .then((data) => {
          if (active) setDetail(data);
        })
        .catch((e) => {
          if (active) setError((e as Error).message);
        });
    return () => {
      active = false;
    };
  }, [selected]);

  const files = useMemo(() => (detail ? parseReviewDiff(detail.diff) : []), [detail]);
  // 新增的整页先读，其次才是对旧页的零星改动
  const content = files
    .filter((f) => isContentPage(f.path))
    .sort((a, b) => Number(b.kind === "added") - Number(a.kind === "added"));
  const derived = files.filter((f) => !isContentPage(f.path));
  const total = files.reduce((t, f) => ({ add: t.add + f.added, del: t.del + f.deleted }), {
    add: 0,
    del: 0,
  });
  const ordered = useMemo(() => [...reviews].sort((a, b) => rank[a.state] - rank[b.state]), [reviews]);
  const eligible = ordered.filter((r) => r.state === "pending" && r.batchable !== false);
  const selectedRevisions = chosen.filter((id) => eligible.some((r) => r.id === id));
  const allSelected = eligible.length > 0 && selectedRevisions.length === eligible.length;

  useEffect(() => {
    if (!selected && selectAll.current)
      selectAll.current.indeterminate = selectedRevisions.length > 0 && !allSelected;
  }, [selected, selectedRevisions.length, allSelected]);

  async function approveBatch() {
    if (busy || !selectedRevisions.length) return;
    const revisions = [...selectedRevisions];
    setBusy(true);
    setError("");
    setBatchResult("");
    try {
      const result = await wikiRequest<{ reviews: { id: string; state: ReviewState }[] }>(
        "reviews/batch/approve",
        { revisions },
      );
      for (const review of result.reviews) onChanged(review);
      setChosen([]);
      setBatchResult(`已批准并发布所选的 ${result.reviews.length} 份变更。`);
      await onPublished();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function decide(action: "approve" | "reject") {
    if (!detail || busy) return;
    const id = detail.review.id;
    setBusy(true);
    setError("");
    try {
      const result = await wikiRequest<Detail["review"]>(`reviews/${id}/${action}`, {
        revision: id,
        ...(action === "reject" ? { reason } : {}),
      });
      setDetail({ ...detail, review: { ...detail.review, ...result } });
      onChanged(result);
      if (action === "approve") await onPublished();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id={id} className="wiki-review" role="tabpanel" aria-label="审阅" hidden={hidden}>
      {!selected ? (
        <div className="wiki-review-list">
          <p className="wiki-review-lead">
            知识库的每次改动都先停在这里。读完、批准，它才进正式库；之后的问答用的就是新版本。
          </p>
          {eligible.length > 0 && (
            <section className="wiki-review-bulk" aria-label="批量审阅">
              <div className="wiki-review-bulk-selection">
                <label className="wiki-review-select-all">
                  <input
                    ref={selectAll}
                    type="checkbox"
                    checked={allSelected}
                    disabled={busy}
                    onChange={() => setChosen(allSelected ? [] : eligible.map((r) => r.id))}
                  />
                  全选待审
                </label>
                <span className="wiki-review-selection-count" aria-live="polite">
                  已选 <strong>{selectedRevisions.length}</strong> / {eligible.length} 份
                </span>
              </div>
              <button
                type="button"
                className="wiki-review-bulk-publish"
                disabled={busy || !selectedRevisions.length}
                onClick={() => void approveBatch()}
              >
                <Check size={16} />
                {busy
                  ? "正在核对并发布…"
                  : selectedRevisions.length
                    ? `批准并发布所选 ${selectedRevisions.length} 份`
                    : "选择变更后批量发布"}
              </button>
            </section>
          )}
          {batchResult && <p role="status">{batchResult}</p>}
          {error && (
            <p role="alert" className="wiki-panel-error">
              {error}
            </p>
          )}
          {listError && (
            <p role="alert" className="wiki-panel-error">
              <AlertTriangle size={13} /> {listError}
            </p>
          )}
          {!listError && !ordered.some((r) => rank[r.state] < 2) && (
            <div className="wiki-review-complete">
              <Check size={20} aria-hidden="true" />
              <div>
                <strong>待审已清空</strong>
                <p>所有变更已处理，可在下方查看历史。</p>
              </div>
            </div>
          )}
          {[
            { title: "待你处理", items: ordered.filter((r) => rank[r.state] < 2) },
            { title: "历史", items: ordered.filter((r) => rank[r.state] === 2) },
          ].map(
            (group) =>
              group.items.length > 0 && (
                <section key={group.title}>
                  <h3>
                    {group.title} · {group.items.length}
                  </h3>
                  <ul>
                    {group.items.map((r) => (
                      <li
                        key={r.id}
                        className={`wiki-review-row${chosen.includes(r.id) ? " is-selected" : ""}`}
                      >
                        {r.state === "pending" && r.batchable !== false && (
                          <label className="wiki-review-select">
                            <input
                              type="checkbox"
                              aria-label={`选择 ${packageTitle(r.files)} ${r.id.slice(0, 10)}`}
                              disabled={busy}
                              checked={chosen.includes(r.id)}
                              onChange={(e) =>
                                setChosen((ids) =>
                                  e.target.checked ? [...ids, r.id] : ids.filter((id) => id !== r.id),
                                )
                              }
                            />
                          </label>
                        )}
                        <button
                          type="button"
                          className={`wiki-review-card is-${r.state}`}
                          disabled={busy}
                          onClick={() => onSelect(r.id)}
                        >
                          <span className={`wiki-review-chip is-${r.state}`}>{labels[r.state]}</span>
                          <strong>{packageTitle(r.files)}</strong>
                          <small>
                            {r.files.filter(isContentPage).length} 个正文页 · 共 {r.files.length} 个文件 ·{" "}
                            <code>{r.id.slice(0, 10)}</code>
                          </small>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ),
          )}
        </div>
      ) : (
        <div className="wiki-review-detail">
          <div className="wiki-review-bar">
            <button
              type="button"
              className="wiki-review-back"
              disabled={busy}
              onClick={() => onSelect(undefined)}
            >
              <ArrowLeft size={13} /> 全部变更
            </button>
            {detail && (
              <span className="wiki-diff-stat">
                {files.length} 个文件 <b className="is-add">+{total.add}</b>{" "}
                <b className="is-del">−{total.del}</b>
              </span>
            )}
          </div>
          {error && (
            <p role="alert" className="wiki-panel-error">
              <AlertTriangle size={13} /> {error}
            </p>
          )}
          {!detail && !error && <p className="wiki-review-empty">读取变更…</p>}
          {detail && (
            <>
              <h2 className="wiki-review-title">{packageTitle(files.map((f) => f.path))}</h2>
              {detail.review.payload?.drop && (
                <details>
                  <summary>本批资料、整合依据与未核范围</summary>
                  <pre className="wiki-drop-report">{detail.review.payload.drop.report}</pre>
                </details>
              )}
              {detail.review.payload?.drop && (
                <DropReviewPreview
                  writes={detail.review.payload.writes}
                  placements={detail.placements ?? []}
                />
              )}
              {detail.review.payload?.drop?.receipt && (
                <DropReceiptView receipt={detail.review.payload.drop.receipt} />
              )}
              {detail.review.payload && <ReviewSvgAssets writes={detail.review.payload.writes} />}
              <p className={`wiki-review-state is-${detail.review.state}`} data-testid="review-state">
                {labels[detail.review.state]} · {detail.review.id}
              </p>
              {detail.review.reason && <p className="wiki-review-reason">驳回原因：{detail.review.reason}</p>}
              <div className="wiki-review-files" data-testid="review-diff">
                {!files.length && <p className="wiki-review-empty">没有文本差异</p>}
                {content.length > 0 && <h3>正文页 · {content.length}</h3>}
                {content.map((f) => (
                  <FileDiff key={f.path} file={f} open />
                ))}
                {derived.length > 0 && (
                  <>
                    <h3>
                      程序派生与清理 · {derived.length}
                      <small>目录、注册表、日志和用掉的草稿，由程序生成，通常不用逐行看</small>
                    </h3>
                    {derived.map((f) => (
                      <FileDiff key={f.path} file={f} open={false} />
                    ))}
                  </>
                )}
              </div>
              {detail.review.state === "publishing" && (
                <p className="wiki-panel-error">发布中断，可恢复本次完整发布；恢复前暂停新问答。</p>
              )}
            </>
          )}
          {detail && ["pending", "publishing"].includes(detail.review.state) && (
            <footer className="wiki-review-actions">
              <label>
                驳回原因
                <textarea
                  rows={1}
                  maxLength={2000}
                  placeholder="要驳回就写明原因；批准不用填"
                  value={reason}
                  disabled={busy}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="is-reject"
                disabled={busy || !reason.trim() || detail.review.state === "publishing"}
                onClick={() => void decide("reject")}
              >
                驳回此版本
              </button>
              <button
                type="button"
                className="is-approve"
                disabled={busy}
                onClick={() => void decide("approve")}
              >
                <Check size={14} />{" "}
                {busy
                  ? "处理中…"
                  : detail.review.state === "publishing"
                    ? "恢复本次完整发布"
                    : "批准此版本并发布"}
              </button>
            </footer>
          )}
        </div>
      )}
    </div>
  );
}
