import { ArrowUp, BookOpen, Check, Copy, RotateCcw, Sparkles, Square, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { QUALITY_LABELS } from "../../content/wiki/answer-quality";
import { findByAlias } from "../../content/wiki/index";
import { pageDisplayTitle } from "../../content/wiki/param-display";
import { AnswerSave } from "./AnswerSave";
import {
  type BackendAvailability,
  getBackendAvailability,
  SERVICE_DOWN_CHAT_HINT,
  STATIC_OFFLINE_HINT,
  subscribeBackendAvailability,
} from "./api";
import { ChatMarkdown } from "./ChatMarkdown";
import type { ChatState, PendingChatAttachment } from "./chat-controller";
import type { Msg, TraceVersions, TraceView } from "./chat-history";
import { WikiContentLink } from "./WikiLink";

export {
  bindPageHideFlush,
  type ChatAnalysisPayload,
  type ChatControllerDeps,
  type ChatState,
  createChatController,
  type PendingChatAttachment,
  useChat,
} from "./chat-controller";

export function handleChatFormSubmit(
  e: { preventDefault: () => void },
  isOffline: boolean,
  send: () => void,
): void {
  e.preventDefault();
  if (isOffline) return;
  send();
}

export function handleChatInputKeyDown(
  e: { key: string; shiftKey: boolean; nativeEvent: { isComposing: boolean }; preventDefault: () => void },
  isOffline: boolean,
  send: () => void,
): void {
  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
    e.preventDefault();
    if (isOffline) return;
    send();
  }
}

const repoName = (repo: string) => repo.split("/").pop() ?? repo;
const refName = (ref: string) => ref.replace(/^releases\//, "");
/** 「main 含 · v0.23.0 不含原提交，有同号提交」：一眼看出修复进了哪些钉住的版本 */
function versionText(v: TraceVersions): string {
  if (v.status !== "found") return `本地核对：${v.reason}`;
  const pins = v.pins.map(
    (p) => `${refName(p.ref)} ${p.contains ? "含" : p.sameNumberCommit ? "不含原提交，有同号提交" : "不含"}`,
  );
  const tags = v.tags.length
    ? [`tag：${v.tags.join("、")}${v.moreTags ? ` 等 ${v.tags.length + v.moreTags} 个` : ""}`]
    : [];
  return `本地核对：${[...pins, ...tags].join(" · ")}`;
}

function TraceResult({ trace }: { trace: TraceView }) {
  if (trace.status === "searching")
    return (
      <p role="status" className="wiki-chat-reading" data-testid="chat-trace-status">
        正在 GitHub 上搜这段报错…
      </p>
    );
  if (trace.status === "failed")
    return (
      <p role="status" className="wiki-chat-uncited" data-testid="chat-trace-status">
        GitHub 在线搜索失败：{trace.reason}。回答不会把它说成「没有相关 issue」。
      </p>
    );
  if (trace.status === "skipped")
    return (
      <p className="wiki-chat-reading" data-testid="chat-trace-status">
        没有在线搜索：{trace.reason}
      </p>
    );
  const where = `${trace.scope.repos.map(repoName).join("、")}，${trace.scope.since} 以来`;
  return (
    <details className="wiki-chat-trace" data-testid="chat-trace">
      <summary>GitHub 上的相关讨论 · {trace.candidates.length} 条候选</summary>
      <small className="wiki-chat-trace-note">
        在线搜索候选（{where}），不是已确认的修复{trace.complete ? "" : "；本轮搜索不完整"}
      </small>
      {trace.candidates.length === 0 ? (
        <p>没有搜到匹配的讨论。零命中不代表社区里没有。</p>
      ) : (
        <ul className="wiki-chat-trace-list">
          {trace.candidates.map((c) => (
            <li key={c.url} className="wiki-chat-trace-item">
              <a href={c.url} target="_blank" rel="noreferrer">
                {repoName(c.repo)} {c.kind === "pr" ? "PR" : "issue"} #{c.number}
              </a>{" "}
              {c.title}
              <span> · {c.state === "closed" ? "已关闭" : c.state === "open" ? "未关闭" : c.state}</span>
              {c.versions && <small className="wiki-chat-trace-meta">{versionText(c.versions)}</small>}
              {c.docs?.map((doc) => (
                <small key={doc.url} className="wiki-chat-trace-meta">
                  文档{" "}
                  <a href={doc.url} target="_blank" rel="noreferrer">
                    {doc.version}
                  </a>
                  ：
                  {doc.reason ??
                    (doc.mappings.some((m) => m.localPath)
                      ? `已定位源码；${
                          doc.mappings.some((m) => m.matchesPinned)
                            ? `匹配 ${doc.mappings
                                .filter((m) => m.matchesPinned)
                                .map((m) => refName(m.pinnedRef ?? ""))
                                .join("、")}`
                            : "与当前 Wiki 钉点不同"
                        }`
                      : (doc.mappings[0]?.reason ?? "本地尚未核实"))}
                </small>
              ))}
              {c.linkedPrs?.map((l) => (
                <small key={l.url} className="wiki-chat-trace-meta">
                  关联{" "}
                  <a href={l.url} target="_blank" rel="noreferrer">
                    PR #{l.number}
                  </a>
                  ：{versionText(l.versions)}
                </small>
              ))}
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

type ModelView = NonNullable<Msg["model"]>;
const SWITCH_LABEL: Record<string, string> = {
  model_refusal_fallback: "拒答",
  model_fallback: "不可用",
  model_consent_fallback: "没通过额度确认",
};
/** 「claude-opus-5-5[1m] 拒答（frontier_llm），改由 claude-opus-5 作答」 */
function modelNotice(m: ModelView): string {
  const hops = m.switches.map(
    (s) => `${s.from} ${SWITCH_LABEL[s.event] ?? "换了模型"}${s.reason ? `（${s.reason}）` : ""}`,
  );
  const lead = hops.length ? hops.join("；") : `请求的是 ${m.requested ?? "默认模型"}`;
  return `本轮换了模型：${lead}，改由 ${m.answeredBy ?? "另一个模型"} 作答。`;
}

function PendingAttachmentCard({
  attachment,
  onDismiss,
}: {
  attachment: PendingChatAttachment;
  onDismiss?: (() => void) | undefined;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const payload = `${attachment.title}\n${attachment.summary}\n\n${attachment.sanitizedBlock}`;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(payload).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      });
    }
  };

  return (
    <div className="wiki-chat-attachment" data-testid="chat-pending-attachment">
      <div className="wiki-chat-attachment-head">
        <div className="wiki-chat-attachment-meta">
          <strong>{attachment.title}</strong>
          <small>
            {attachment.summary}
            {attachment.redactionCount && attachment.redactionCount > 0
              ? ` · 已脱敏 ${attachment.redactionCount} 处敏感凭据/内网地址`
              : " · 仅驻留内存，发送前不写本机存储"}
          </small>
        </div>
        <div className="wiki-chat-attachment-actions">
          <button
            type="button"
            className="wiki-chat-attachment-btn"
            data-testid="chat-copy-attachment"
            onClick={handleCopy}
          >
            {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
            <span>{copied ? "已复制" : "复制诊断摘要"}</span>
          </button>
          {onDismiss && (
            <button
              type="button"
              className="wiki-chat-attachment-dismiss"
              data-testid="chat-dismiss-attachment"
              aria-label="移除诊断附件"
              title="移除诊断附件（保留已敲草稿）"
              onClick={onDismiss}
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      <details className="wiki-chat-attachment-preview">
        <summary>预览待附带的脱敏快照</summary>
        <pre>{attachment.sanitizedBlock}</pre>
      </details>
    </div>
  );
}

/** 引导新读者的三个默认问题：一个核心机制、一组瓶颈对比、一个实战排障 */
export const DEFAULT_STARTERS: readonly string[] = [
  "KV Cache 是什么，为什么 decode 阶段最吃显存带宽？",
  "Prefill 和 Decode 在昇腾 NPU 上各自受限于什么？",
  "遇到 NPU OOM 或 HCCL EI0006 超时该按什么顺序排查？",
];

function buildContextualPool(
  entry?: (Parameters<typeof pageDisplayTitle>[0] & { type?: string | undefined }) | undefined,
): readonly string[] {
  if (!entry) return DEFAULT_STARTERS;
  const fullTitle = pageDisplayTitle(entry);
  if (entry.type === "param") {
    return [
      `${fullTitle} 的默认行为与调参边界是什么？`,
      `在昇腾上调整 ${fullTitle} 会怎样影响显存与吞吐？`,
      `${fullTitle} 与哪些启动参数存在耦合或互斥风险？`,
      `线上排查时怎样确认 ${fullTitle} 已按预期生效？`,
    ];
  }
  const shortTitle = fullTitle.split(/[：:]/)[0]?.trim() || fullTitle;
  if (entry.type === "feature") {
    return [
      `用通俗的话讲清「${shortTitle}」省下了什么开销、有什么代价`,
      `在昇腾部署中开启「${shortTitle}」有哪些前置条件或版本限制？`,
      `如果「${shortTitle}」触发回退或性能退化，线上该先查哪里？`,
      `「${shortTitle}」与相邻调度或缓存特性叠加时要注意什么？`,
    ];
  }
  return [
    `用通俗的话总结「${shortTitle}」的核心机制与算账逻辑`,
    `「${shortTitle}」在 vLLM 与昇腾源码里是怎么落地的？`,
    `围绕「${shortTitle}」，实际部署最容易踩的坑有哪些？`,
    `「${shortTitle}」和它的上下游机制是怎么协同配合的？`,
  ];
}

export function buildContextualStarters(
  entry?: (Parameters<typeof pageDisplayTitle>[0] & { type?: string | undefined }) | undefined,
): readonly string[] {
  return buildContextualPool(entry).slice(0, 3);
}

function CopyReplyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="wiki-chat-copy-reply"
      data-testid="chat-copy-reply"
      onClick={() => {
        if (typeof navigator !== "undefined" && navigator.clipboard) {
          void navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          });
        }
      }}
    >
      {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
      <span>{copied ? "已复制" : "复制回答"}</span>
    </button>
  );
}

export function ChatPane({
  id,
  chat,
  backendAvailable: backendAvailableProp,
  currentId,
  hidden,
  onReview,
}: {
  id: string;
  chat: ChatState;
  backendAvailable?: BackendAvailability | undefined;
  currentId?: string | undefined;
  hidden: boolean;
  onReview: (id: string) => void;
}) {
  const storeBackendAvailable = useSyncExternalStore(
    subscribeBackendAvailability,
    getBackendAvailability,
    getBackendAvailability,
  );
  const effectiveBackend = backendAvailableProp ?? storeBackendAvailable;
  const isOffline = effectiveBackend === "offline";
  const isServiceDown = effectiveBackend === "service-down";
  const isBackendUnavailable = isOffline || isServiceDown;

  const {
    msgs,
    input,
    setInput,
    pendingAttachment,
    setPendingAttachment,
    retryFailedMessage,
    clear,
    busy,
    send,
    stop,
    storageError,
  } = chat;
  const currentEntry = useMemo(() => (currentId ? findByAlias(currentId) : undefined), [currentId]);
  const currentTitle = currentEntry ? pageDisplayTitle(currentEntry) : undefined;
  const shortCurrentTitle = currentTitle ? currentTitle.split(/[：:]/)[0]?.trim() || currentTitle : undefined;
  const starters = useMemo(() => buildContextualStarters(currentEntry), [currentEntry]);
  const followups = useMemo(() => {
    const asked = new Set(msgs.filter((m) => m.role === "user").map((m) => m.text.trim()));
    const pool = [...buildContextualPool(currentEntry), ...DEFAULT_STARTERS];
    const fresh = pool.filter((q, idx) => pool.indexOf(q) === idx && !asked.has(q));
    return (fresh.length >= 3 ? fresh : pool).slice(0, 3);
  }, [currentEntry, msgs]);
  const showFollowupPills =
    Boolean(currentEntry) &&
    msgs.length > 0 &&
    !busy &&
    !isBackendUnavailable &&
    msgs.at(-1)?.role === "agent" &&
    msgs.at(-1)?.status === "complete";
  const log = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  useEffect(() => {
    if (hidden || !msgs.length || !follow.current || !log.current) return;
    log.current.scrollTop = log.current.scrollHeight;
  }, [msgs, hidden]);
  return (
    <div id={id} className="wiki-chat" role="tabpanel" aria-label="问答" hidden={hidden}>
      <div className="wiki-chat-heading">
        <span
          className="wiki-chat-context-pill"
          data-testid="chat-context-pill"
          title={currentTitle ?? "全站知识库检索与问答"}
        >
          <BookOpen size={13} aria-hidden="true" />
          <span>{shortCurrentTitle ? `当前阅读：${shortCurrentTitle}` : "全库知识问答"}</span>
        </span>
        <div className="wiki-chat-heading-actions">
          {storageError && <small role="status">{storageError}</small>}
          {msgs.length > 0 && clear && (
            <button
              type="button"
              className="wiki-chat-clear-btn"
              data-testid="chat-clear"
              disabled={busy}
              title="清空当前对话记录并开启新话题"
              onClick={() => clear()}
            >
              <RotateCcw size={12} aria-hidden="true" />
              <span>新对话</span>
            </button>
          )}
        </div>
      </div>
      {isOffline && (
        <p className="wiki-chat-offline-banner" role="status" data-testid="chat-static-offline-notice">
          {STATIC_OFFLINE_HINT}
        </p>
      )}
      {isServiceDown && (
        <p className="wiki-chat-offline-banner" role="status" data-testid="chat-service-down-notice">
          {SERVICE_DOWN_CHAT_HINT}
        </p>
      )}
      <div
        className="wiki-chat-log"
        data-testid="chat-log"
        ref={log}
        onScroll={() => {
          const el = log.current;
          if (el) follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
      >
        {msgs.length === 0 && (
          <div className="wiki-chat-empty">
            <span className="wiki-chat-eyebrow">
              <Sparkles size={13} aria-hidden="true" /> 对照源码与已核实词条
            </span>
            <strong>
              把机制问透彻，
              <br />
              把报错查到底。
            </strong>
            <p className="wiki-chat-hint">
              每一条结论均对照已核实页面与固定版本源码；也可直接粘贴异常堆栈，自动关联社区讨论。
            </p>
            {!isBackendUnavailable && (
              <ul data-testid="chat-starter-list">
                {starters.map((q) => (
                  <li key={q}>
                    <button type="button" disabled={busy} onClick={() => void send(q)}>
                      {q}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {msgs.map((m) => (
          <div key={m.key} className={`wiki-chat-msg is-${m.role}`}>
            {m.role === "agent" && <div className="wiki-chat-author">知识库助手</div>}
            {(m.revision || !!m.reading?.length || m.model) && (
              <details className="wiki-chat-meta">
                <summary>来源与检索过程</summary>
                {m.revision && (
                  <p className="wiki-chat-reading" data-testid="chat-version">
                    知识版本 {m.revision.slice(0, 12)}
                    {m.online && <span data-testid="chat-online"> · 本轮可联网</span>}
                  </p>
                )}
                {m.reading && m.reading.length > 0 && (
                  <p className="wiki-chat-reading">
                    {m.status === "pending" ? "正在读" : "已读取"}：{m.reading.join("、")}
                  </p>
                )}
                {(m.model?.answeredBy || m.model?.requested) && (
                  <p className="wiki-chat-reading" data-testid="chat-model">
                    {m.model.answeredBy
                      ? `作答模型 ${m.model.answeredBy}`
                      : `请求模型 ${m.model.requested}（CLI 未返回实际模型回执）`}
                  </p>
                )}
              </details>
            )}
            {m.versionNotice && (
              <p role="status" className="wiki-chat-uncited" data-testid="chat-version-notice">
                {m.versionNotice}
              </p>
            )}
            {m.model?.switched && (
              <p role="status" className="wiki-chat-uncited" data-testid="chat-model-notice">
                {modelNotice(m.model)}
              </p>
            )}
            {m.toolNotice && (
              <p role="status" className="wiki-chat-uncited" data-testid="chat-tool-notice">
                {m.toolNotice}
              </p>
            )}
            {m.trace && <TraceResult trace={m.trace} />}
            {m.role === "agent" ? (
              m.text ? (
                <ChatMarkdown text={m.text} currentId={currentId} />
              ) : m.status !== "interrupted" && m.status !== "failed" ? (
                <p className="wiki-chat-thinking" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </p>
              ) : null
            ) : (
              m.text
            )}
            {m.role === "agent" &&
              (m.status === "failed" || m.status === "interrupted") &&
              (m.retryAttachment !== undefined || m.rawDraft !== undefined) &&
              retryFailedMessage && (
                <div className="wiki-chat-attachment-actions">
                  <button
                    type="button"
                    className="wiki-chat-attachment-btn"
                    data-testid="chat-retry-failed"
                    disabled={busy || isBackendUnavailable}
                    onClick={() => void retryFailedMessage(m.key)}
                  >
                    重试发送
                  </button>
                </div>
              )}
            {m.status === "interrupted" && (
              <p className="wiki-chat-uncited" role="status">
                回答已中断，已收到的内容保留在这里。可以重新提问。
              </p>
            )}
            {m.uncited && (
              <p className="wiki-chat-uncited" data-testid="chat-uncited">
                引用检查未通过：{m.citationReason ?? "没有可核对的知识库引用"}
                。这段回答未经本库核对，暂不能存进 Wiki。
              </p>
            )}
            {m.uncovered && (
              <p className="wiki-chat-uncovered" data-testid="chat-uncovered">
                未收录：模型说知识库里没有这部分内容。回答里没带页面引用的说法来自模型自身知识，未经本库核对。
              </p>
            )}
            {m.gapNotice && (
              <p role="status" className="wiki-chat-reading" data-testid="chat-gap">
                {m.gapNotice}
              </p>
            )}
            {m.quality && (
              <p
                role="status"
                className={
                  m.quality.status === "unavailable" ||
                  (m.quality.status === "checked" && m.quality.decision.satisfied !== true)
                    ? "wiki-chat-uncited"
                    : "wiki-chat-reading wiki-chat-quality-ok"
                }
                data-testid="chat-quality"
              >
                {m.quality.status === "checking"
                  ? "正在独立核对回答与知识库材料…"
                  : m.quality.status === "unavailable"
                    ? "独立核对未完成，本回答尚未经质量判定。"
                    : `独立核对：${QUALITY_LABELS[m.quality.decision.classification] ?? "已完成核对"}。${m.quality.decision.reason}（模型判断，仅限所查材料）`}
              </p>
            )}
            {m.role === "agent" && (m.status === "complete" || Boolean(m.answerId)) && (
              <div className="wiki-chat-msg-actions" data-testid="chat-msg-actions">
                {m.text && <CopyReplyButton text={m.text} />}
                {!isBackendUnavailable && m.answerId && (
                  <AnswerSave answerId={m.answerId} onReview={onReview} />
                )}
              </div>
            )}
            {!!m.related?.length && (
              <nav data-testid="chat-related" aria-label="接着可以看">
                <strong>接着可以看</strong>
                <ul>
                  {m.related.map((page) => (
                    <li key={page.id}>
                      <WikiContentLink href={page.href} currentId={currentId} title={page.note}>
                        {page.title}
                      </WikiContentLink>
                      <span> · {page.note}</span>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </div>
        ))}
        {showFollowupPills && (
          <div className="wiki-chat-followups" data-testid="chat-followups">
            <span className="wiki-chat-followups-label">
              <Sparkles size={12} aria-hidden="true" /> 追问当前篇章
            </span>
            <div className="wiki-chat-followups-list">
              {followups.map((q) => (
                <button key={q} type="button" disabled={busy} onClick={() => void send(q)}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {pendingAttachment && (
        <PendingAttachmentCard
          attachment={pendingAttachment}
          onDismiss={setPendingAttachment ? () => setPendingAttachment(null) : undefined}
        />
      )}

      <form
        className="wiki-chat-input"
        onSubmit={(e) => handleChatFormSubmit(e, isBackendUnavailable, () => void send())}
      >
        <textarea
          value={input}
          aria-label="输入问题"
          data-testid="chat-input"
          placeholder={
            isOffline
              ? "当前为静态离线模式，请按 Ctrl+K 检索或复制上方诊断摘要"
              : isServiceDown
                ? SERVICE_DOWN_CHAT_HINT
                : busy
                  ? "回答中…"
                  : "问一个概念，或粘贴异常 / traceback"
          }
          rows={2}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => handleChatInputKeyDown(e, isBackendUnavailable, () => void send())}
        />
        <div className="wiki-chat-compose-foot">
          <small>
            {isOffline
              ? "可使用 Ctrl+K 全站检索知识库"
              : isServiceDown
                ? "启动服务后点上方「重新连接」，已敲草稿与诊断附件会自动保留"
                : "Enter 发送 · Shift + Enter 换行"}
          </small>
          {busy ? (
            <button type="button" aria-label="停止回答" onClick={stop}>
              <Square size={16} />
            </button>
          ) : (
            <button
              type="submit"
              data-testid="chat-send"
              aria-label="发送"
              disabled={isBackendUnavailable || (!input.trim() && !pendingAttachment)}
            >
              <ArrowUp size={18} />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
