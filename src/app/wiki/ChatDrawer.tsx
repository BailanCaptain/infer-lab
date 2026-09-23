import { ArrowUp, BookOpen } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { rewriteRelativeLink } from "../../content/wiki/index";
import { AnswerSave } from "./AnswerSave";

/** 服务端贴报错时的在线 GitHub 搜索（F003 AC4）；形状见 scripts/wiki/chat-trace.ts 的 publicTrace */
type TraceVersions =
  | {
      status: "found";
      commit: string;
      pins: { ref: string; contains: boolean; sameNumberCommit?: string }[];
      tags: string[];
      moreTags: number;
    }
  | { status: "no-local-clone" | "no-local-commit" | "error"; reason: string };
type TraceView =
  | { status: "searching" }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string }
  | {
      status: "done";
      scope: { repos: string[]; since: string };
      complete: boolean;
      candidates: {
        repo: string;
        number: number;
        kind: "issue" | "pr";
        url: string;
        title: string;
        state: string;
        versions?: TraceVersions;
        linkedPrs?: { number: number; url: string; basis: string; versions: TraceVersions }[];
      }[];
    };

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
    <nav className="wiki-chat-trace" data-testid="chat-trace" aria-label="GitHub 上的相关讨论">
      <strong>GitHub 上的相关讨论</strong>
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
    </nav>
  );
}

/** 服务端 model 事件；形状见 server/chat-route.ts，换手记录见 scripts/wiki/model-use.ts */
interface ModelView {
  requested?: string;
  answeredBy?: string;
  switched: boolean;
  switches: { event: string; from: string; to: string; reason?: string }[];
}
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

interface Msg {
  /** 稳定 key：消息会边流边改，用数组下标当 key 会让 React 复用错行 */
  key: string;
  role: "user" | "agent";
  text: string;
  /** 回答没有引用任何页时给出的提示 */
  uncited?: boolean;
  /** 模型自己声明知识库没有：标「未收录」，不报警 */
  uncovered?: boolean;
  citationReason?: string;
  reading?: string[];
  answerId?: string;
  revision?: string;
  /** 服务端这一轮给了联网工具 */
  online?: boolean;
  versionNotice?: string;
  /** 服务端发现回答说自己联不了网、却一次都没用给它的联网工具 */
  toolNotice?: string;
  /** 实际作答模型；CLI 拒答换模型时 switched 为真 */
  model?: ModelView;
  gapNotice?: string;
  related?: { id: string; title: string; href: string; note: string }[];
  trace?: TraceView;
}

/** 一次 SSE 请求。把帧回调出去，UI 只管渲染。 */
async function streamChat(
  body: { message: string; sessionId?: string },
  on: {
    text: (t: string) => void;
    tool: (target?: string) => void;
    cite: (v: { cited: boolean; selfDeclaredUncovered: boolean; reason?: string }) => void;
    done: (sessionId?: string, answerId?: string) => void;
    related: (pages: NonNullable<Msg["related"]>) => void;
    trace: (v: TraceView) => void;
    error: (m: string) => void;
    knowledge: (v: {
      revision: string;
      sessionId: string;
      resetReason?: string;
      maxTurns?: number;
      online?: boolean;
    }) => void;
    notice: (v: { kind: string; message: string }) => void;
    model: (v: ModelView) => void;
    gap: (v: {
      state: "collecting" | "awaiting-assessment" | "record-failed";
      count?: number;
      threshold?: number;
    }) => void;
  },
  signal: AbortSignal,
): Promise<void> {
  const res = await fetch("/api/wiki/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    on.error(`服务返回 ${res.status}`);
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const frames = buf.split("\n\n");
    buf = frames.pop() ?? "";
    for (const frame of frames) {
      const ev = /^event: (.+)$/m.exec(frame)?.[1];
      const raw = /^data: (.*)$/m.exec(frame)?.[1];
      if (!ev || !raw) continue;
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        continue;
      }
      if (ev === "text") on.text(String(data.text ?? ""));
      else if (ev === "tool") on.tool(data.target as string | undefined);
      else if (ev === "cite") on.cite(data as never);
      else if (ev === "error") on.error(String(data.message ?? "未知错误"));
      else if (ev === "knowledge") on.knowledge(data as never);
      else if (ev === "notice" && typeof data.message === "string") on.notice(data as never);
      else if (ev === "gap") on.gap(data as never);
      else if (ev === "model" && Array.isArray(data.switches)) on.model(data as never);
      else if (ev === "trace" && typeof data.status === "string") on.trace(data as TraceView);
      else if (ev === "related" && Array.isArray(data.pages))
        on.related(data.pages as NonNullable<Msg["related"]>);
      else if (ev === "done")
        on.done(data.sessionId as string | undefined, data.answerId as string | undefined);
    }
  }
}

/** 引导新读者的三个问题：一个名词、一组对比、一个具体时刻 */
const STARTERS = ["KV Cache 是什么", "prefill 和 decode 有什么区别", "那条请求的第 92 步发生了什么"];

/** 聊天状态放在面板外层：切页签、收起面板都不丢对话 */
export function useChat() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const sessionId = useRef<string | undefined>(undefined);
  const abort = useRef<AbortController | null>(null);

  const send = useCallback(
    async (preset?: string) => {
      const message = (preset ?? input).trim();
      if (!message || busy) return;
      setInput("");
      setBusy(true);
      const turn = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setMsgs((m) => [
        ...m,
        { key: `${turn}-u`, role: "user", text: message },
        { key: `${turn}-a`, role: "agent", text: "", reading: [] },
      ]);

      const patch = (fn: (last: Msg) => Msg) =>
        setMsgs((m) => m.map((item) => (item.key === `${turn}-a` ? fn(item) : item)));

      abort.current = new AbortController();
      try {
        await streamChat(
          { message, ...(sessionId.current ? { sessionId: sessionId.current } : {}) },
          {
            text: (t) => patch((l) => ({ ...l, text: l.text + t })),
            related: (pages) => patch((l) => ({ ...l, related: pages })),
            trace: (v) => patch((l) => ({ ...l, trace: v })),
            tool: (target) =>
              patch((l) => {
                if (!target) return l;
                const name = target.split(/[\\/]/).pop() ?? target;
                return l.reading?.includes(name) ? l : { ...l, reading: [...(l.reading ?? []), name] };
              }),
            cite: (v) =>
              patch((l) => ({
                ...l,
                uncited: !v.cited && !v.selfDeclaredUncovered,
                uncovered: v.selfDeclaredUncovered,
                citationReason: v.reason ?? "没有可核对的知识库引用",
              })),
            gap: (v) =>
              patch((l) => ({
                ...l,
                gapNotice:
                  v.state === "record-failed"
                    ? "缺口信号未能保存；本次回答仍保留，请稍后重试。"
                    : v.state === "awaiting-assessment"
                      ? `缺口信号已记录（${v.count} 次），已排进补写队列。夜间任务要在自动补写打开后才处理，还要先写好复测计划才会生成待审草稿。`
                      : `缺口信号已记录（${v.count}/${v.threshold}）；尚未确认知识缺失，也未启动补写。`,
              })),
            notice: (v) => patch((l) => ({ ...l, toolNotice: v.message })),
            model: (v) => patch((l) => ({ ...l, model: v })),
            knowledge: (v) => {
              sessionId.current = v.sessionId;
              patch((l) => ({
                ...l,
                revision: v.revision,
                ...(v.online !== undefined ? { online: v.online } : {}),
                ...(v.resetReason
                  ? {
                      versionNotice:
                        v.resetReason === "knowledge-updated"
                          ? "知识库已更新，本轮重新检索；旧回答仅保留显示。"
                          : v.resetReason === "turn-limit"
                            ? `这段对话已答满 ${v.maxTurns ?? 3} 轮，本轮开新会话重新检索（续得越长每轮越贵）；此前的问题只用来理解指代。`
                            : "原会话不可用，本轮重新检索。",
                    }
                  : {}),
              }));
            },
            error: (m) => patch((l) => ({ ...l, text: `${l.text}\n\n**出错了**：${m}` })),
            done: (sid, answerId) => {
              if (sid) sessionId.current = sid;
              if (answerId) patch((l) => ({ ...l, answerId }));
            },
          },
          abort.current.signal,
        );
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          patch((l) => ({ ...l, text: `${l.text}\n\n**连接失败**：${String(err)}` }));
        }
      } finally {
        setBusy(false);
        abort.current = null;
      }
    },
    [input, busy],
  );

  const stop = useCallback(() => abort.current?.abort(), []);
  return { msgs, input, setInput, busy, send, stop };
}

export function ChatPane({
  chat,
  hidden,
  onReview,
}: {
  chat: ReturnType<typeof useChat>;
  hidden: boolean;
  onReview: (id: string) => void;
}) {
  const { msgs, input, setInput, busy, send } = chat;
  return (
    <div className="wiki-chat" role="tabpanel" aria-label="问答" hidden={hidden}>
      <div className="wiki-chat-log" data-testid="chat-log">
        {msgs.length === 0 && (
          <div className="wiki-chat-empty">
            <BookOpen size={20} />
            <strong>问这个知识库</strong>
            <p className="wiki-chat-hint">回答只基于库里的页面，每条结论都带引用；库里没有的会明说。</p>
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
            {(m.revision || !!m.reading?.length || m.model) && (
              <div className="wiki-chat-meta">
                {m.revision && (
                  <p className="wiki-chat-reading" data-testid="chat-version">
                    知识版本 {m.revision.slice(0, 12)}
                    {m.online && <span data-testid="chat-online"> · 本轮可联网</span>}
                  </p>
                )}
                {m.reading && m.reading.length > 0 && (
                  <p className="wiki-chat-reading">正在读：{m.reading.join("、")}</p>
                )}
                {m.model?.answeredBy && (
                  <p className="wiki-chat-reading" data-testid="chat-model">
                    作答模型 {m.model.answeredBy}
                  </p>
                )}
              </div>
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
                <ReactMarkdown
                  skipHtml
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ href, children }) => <a href={rewriteRelativeLink(href ?? "")}>{children}</a>,
                  }}
                >
                  {m.text}
                </ReactMarkdown>
              ) : (
                <p className="wiki-chat-thinking" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </p>
              )
            ) : (
              m.text
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
            {m.answerId && <AnswerSave answerId={m.answerId} onReview={onReview} />}
            {!!m.related?.length && (
              <nav data-testid="chat-related" aria-label="接着可以看">
                <strong>接着可以看</strong>
                <ul>
                  {m.related.map((page) => (
                    <li key={page.id}>
                      <a href={page.href} title={page.note}>
                        {page.title}
                      </a>
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
          data-testid="chat-input"
          placeholder={busy ? "回答中…" : "问一个名词或一段报错"}
          rows={2}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button type="submit" data-testid="chat-send" aria-label="发送" disabled={busy || !input.trim()}>
          <ArrowUp size={15} />
        </button>
      </form>
    </div>
  );
}
