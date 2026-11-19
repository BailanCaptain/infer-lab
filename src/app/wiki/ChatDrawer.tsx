import { ArrowUp, BookOpen, Square } from "lucide-react";
import { useEffect, useRef } from "react";
import { QUALITY_LABELS } from "../../content/wiki/answer-quality";
import { AnswerSave } from "./AnswerSave";
import { ChatMarkdown } from "./ChatMarkdown";
import type { ChatState } from "./chat-controller";
import type { Msg, TraceVersions, TraceView } from "./chat-history";
import { WikiContentLink } from "./WikiLink";

export {
  bindPageHideFlush,
  type ChatControllerDeps,
  type ChatState,
  createChatController,
  useChat,
} from "./chat-controller";

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

/** 引导新读者的三个问题：一个名词、一组对比、一个具体时刻 */
const STARTERS = ["KV Cache 是什么", "prefill 和 decode 有什么区别", "序列并行省下了哪些显存"];

export function ChatPane({
  id,
  chat,
  currentId,
  hidden,
  onReview,
}: {
  id: string;
  chat: ChatState;
  currentId?: string | undefined;
  hidden: boolean;
  onReview: (id: string) => void;
}) {
  const { msgs, input, setInput, busy, send, stop, storageError } = chat;
  const log = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  useEffect(() => {
    if (hidden || !msgs.length || !follow.current || !log.current) return;
    log.current.scrollTop = log.current.scrollHeight;
  }, [msgs, hidden]);
  return (
    <div id={id} className="wiki-chat" role="tabpanel" aria-label="问答" hidden={hidden}>
      <div className="wiki-chat-heading">
        <span>
          <BookOpen size={16} /> 知识库问答
        </span>
        <small role="status">{storageError || "对话保存在此浏览器"}</small>
      </div>
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
            <span className="wiki-chat-eyebrow">从一个问题开始</span>
            <strong>
              把概念问清楚，
              <br />
              把报错查明白。
            </strong>
            <p className="wiki-chat-hint">查知识库、对照来源，也可以贴出异常，追踪 GitHub 上的相关讨论。</p>
            <ul>
              {STARTERS.map((q) => (
                <li key={q}>
                  <button type="button" disabled={busy} onClick={() => void send(q)}>
                    {q}
                  </button>
                </li>
              ))}
            </ul>
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
                    {m.model.provider === "codex"
                      ? " · Codex 账户额度"
                      : m.model.provider && m.model.provider !== "claude"
                        ? ` · ${m.model.provider}`
                        : null}
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
              ) : m.status !== "interrupted" ? (
                <p className="wiki-chat-thinking" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </p>
              ) : null
            ) : (
              m.text
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
                    : "wiki-chat-reading"
                }
                data-testid="chat-quality"
              >
                {m.quality.status === "checking"
                  ? "正在独立核对回答与知识库材料…"
                  : m.quality.status === "unavailable"
                    ? "独立核对未完成，本回答尚未经质量判定。"
                    : `独立核对：${QUALITY_LABELS[m.quality.decision.classification]}。${m.quality.decision.reason}（模型判断，仅限所查材料）`}
              </p>
            )}
            {m.answerId && <AnswerSave answerId={m.answerId} onReview={onReview} />}
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
      </div>

      <form
        className="wiki-chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          value={input}
          aria-label="输入问题"
          data-testid="chat-input"
          placeholder={busy ? "回答中…" : "问一个概念，或粘贴异常 / traceback"}
          rows={2}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <div className="wiki-chat-compose-foot">
          <small>Enter 发送 · Shift + Enter 换行</small>
          {busy ? (
            <button type="button" aria-label="停止回答" onClick={stop}>
              <Square size={16} />
            </button>
          ) : (
            <button type="submit" data-testid="chat-send" aria-label="发送" disabled={!input.trim()}>
              <ArrowUp size={18} />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
