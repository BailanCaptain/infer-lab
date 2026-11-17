import { ArrowUp, BookOpen, Square } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { type AnswerQuality, QUALITY_LABELS } from "../../content/wiki/answer-quality";
import { AnswerSave } from "./AnswerSave";
import { ChatMarkdown } from "./ChatMarkdown";
import {
  chatHttpError,
  interruptMessage,
  type Msg,
  readChatHistory,
  settleCompletedMessage,
  type TraceVersions,
  type TraceView,
  writeChatHistory,
} from "./chat-history";
import { textBatch } from "./text-batch";
import { WikiContentLink } from "./WikiLink";

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

/** 一次 SSE 请求。把帧回调出去，UI 只管渲染。 */
async function streamChat(
  body: { message: string; sessionId?: string },
  on: {
    text: (t: string) => void;
    tool: (target?: string) => void;
    cite: (v: { cited: boolean; selfDeclaredUncovered: boolean; reason?: string }) => void;
    persisted: (v: { sessionId?: string; revision?: string }) => void;
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
    quality: (v: AnswerQuality) => void;
    model: (v: ModelView) => void;
    gap: (v: {
      state: "collecting" | "awaiting-assessment" | "closed" | "record-failed";
      count?: number;
      threshold?: number;
    }) => void;
  },
  signal: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const res = await fetchImpl("/api/wiki/chat", {
    method: "POST",
    headers: { "content-type": "application/json", "x-wiki-review": "1" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    on.error(chatHttpError(res.status, await res.text().catch(() => "")));
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
      else if (ev === "persisted") {
        const payload: { sessionId?: string; revision?: string } = {};
        if (typeof data.sessionId === "string") payload.sessionId = data.sessionId;
        if (typeof data.revision === "string") payload.revision = data.revision;
        on.persisted(payload);
      } else if (ev === "error") on.error(String(data.message ?? "未知错误"));
      else if (ev === "knowledge") on.knowledge(data as never);
      else if (ev === "notice" && typeof data.message === "string") on.notice(data as never);
      else if (ev === "gap") on.gap(data as never);
      else if (ev === "quality") on.quality(data as AnswerQuality);
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
const STARTERS = ["KV Cache 是什么", "prefill 和 decode 有什么区别", "序列并行省下了哪些显存"];
const SAVE_ERROR = "本机保存失败，刷新可能丢失记录；请先复制需要的回答。";

export interface ChatState {
  msgs: Msg[];
  input: string;
  setInput: (value: string) => void;
  busy: boolean;
  send: (preset?: string) => Promise<void>;
  stop: () => void;
  storageError: string;
}

export interface ChatControllerDeps {
  storage?: Pick<Storage, "getItem" | "setItem">;
  fetchImpl?: typeof fetch;
}

interface ActiveTurn {
  abort: AbortController;
  persisted: boolean;
  settled: boolean;
  flushText: () => void;
  settle: () => void;
}

export function createChatController(deps: ChatControllerDeps = {}) {
  const storage = deps.storage ?? (typeof localStorage !== "undefined" ? localStorage : undefined);
  const fetchImpl = deps.fetchImpl ?? fetch;

  let msgs: Msg[] = [];
  let input = "";
  let sessionId: string | undefined;
  let storageError = "";
  let busy = false;
  let dirty = false;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let activeTurn: ActiveTurn | null = null;
  const listeners = new Set<() => void>();

  if (storage) {
    try {
      const initial = readChatHistory(storage);
      msgs = initial.msgs;
      input = initial.input;
      sessionId = initial.sessionId;
    } catch {
      storageError = "无法读取本机记录；本次对话仍可使用。";
    }
  }

  const notify = () => {
    for (const listener of listeners) listener();
  };

  let snapshot: ChatState = {
    msgs,
    input,
    setInput,
    busy,
    send,
    stop,
    storageError,
  };

  const syncSnapshot = () => {
    snapshot = {
      msgs,
      input,
      setInput,
      busy,
      send,
      stop,
      storageError,
    };
  };

  const flushSave = () => {
    if (saveTimer !== undefined) {
      clearTimeout(saveTimer);
      saveTimer = undefined;
    }
    if (!dirty || !storage) return;
    dirty = false;
    try {
      writeChatHistory(storage, {
        version: 1,
        msgs,
        input,
        ...(sessionId !== undefined ? { sessionId } : {}),
      });
      if (storageError === SAVE_ERROR) {
        storageError = "";
        syncSnapshot();
      }
    } catch {
      if (storageError !== SAVE_ERROR) {
        storageError = SAVE_ERROR;
        syncSnapshot();
      }
    }
  };

  const scheduleSave = () => {
    dirty = true;
    if (saveTimer !== undefined) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = undefined;
      flushSave();
      notify();
    }, 200);
  };

  function setInput(value: string) {
    if (input === value) return;
    input = value;
    syncSnapshot();
    scheduleSave();
    notify();
  }

  function stop() {
    activeTurn?.abort.abort();
  }

  async function send(preset?: string): Promise<void> {
    const message = (preset ?? input).trim();
    if (!message || busy || activeTurn) return;
    input = "";
    busy = true;
    const turn = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const agentKey = `${turn}-a`;
    msgs = [
      ...msgs,
      { key: `${turn}-u`, role: "user", text: message },
      { key: agentKey, role: "agent", text: "", reading: [], status: "pending" },
    ];
    syncSnapshot();
    scheduleSave();
    notify();

    const patch = (fn: (last: Msg) => Msg) => {
      msgs = msgs.map((item) => (item.key === agentKey ? fn(item) : item));
      syncSnapshot();
      scheduleSave();
      notify();
    };
    const text = textBatch((chunk) => patch((l) => ({ ...l, text: l.text + chunk })));
    const abortController = new AbortController();
    let finished = false;

    const turnState: ActiveTurn = {
      abort: abortController,
      persisted: false,
      settled: false,
      flushText: () => {
        text.flush();
      },
      settle: () => {
        if (turnState.settled) return;
        turnState.settled = true;
        text.flush();
        if (turnState.persisted || finished) {
          msgs = msgs.map((item) => (item.key === agentKey ? settleCompletedMessage(item) : item));
        } else {
          sessionId = undefined;
          msgs = msgs.map((item) => (item.key === agentKey ? interruptMessage(item) : item));
        }
        dirty = true;
        syncSnapshot();
        flushSave();
        notify();
      },
    };
    activeTurn = turnState;

    const requestBody: { message: string; sessionId?: string } =
      sessionId !== undefined ? { message, sessionId } : { message };

    try {
      await streamChat(
        requestBody,
        {
          text: text.push,
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
          persisted: (v) => {
            text.flush();
            turnState.persisted = true;
            if (v.sessionId) sessionId = v.sessionId;
            msgs = msgs.map((item) =>
              item.key === agentKey
                ? {
                    ...item,
                    status: "complete",
                    ...(v.revision ? { revision: v.revision } : {}),
                  }
                : item,
            );
            dirty = true;
            syncSnapshot();
            flushSave();
            notify();
          },
          gap: (v) =>
            patch((l) => ({
              ...l,
              gapNotice:
                v.state === "record-failed"
                  ? "缺口信号未能保存；本次回答仍保留，请稍后重试。"
                  : v.state === "closed"
                    ? "这条缺口已验收关闭，本次重复通知不新增记录。"
                    : v.state === "awaiting-assessment"
                      ? `缺口信号已记录（${v.count} 次），已排进补写队列。夜间任务要在自动补写打开后才处理，还要先写好复测计划才会生成待审草稿。`
                      : `缺口信号已记录（${v.count}/${v.threshold}）；尚未确认知识缺失，也未启动补写。`,
            })),
          notice: (v) => patch((l) => ({ ...l, toolNotice: v.message })),
          quality: (v) => patch((l) => ({ ...l, quality: v })),
          model: (v) => patch((l) => ({ ...l, model: v })),
          knowledge: (v) => {
            sessionId = v.sessionId;
            patch((l) => ({
              ...l,
              revision: v.revision,
              ...(v.online !== undefined ? { online: v.online } : {}),
              ...(v.resetReason
                ? {
                    versionNotice:
                      v.resetReason === "knowledge-updated"
                        ? "知识库已更新，本轮重新检索；旧回答仅保留显示。"
                        : v.resetReason === "model-changed"
                          ? "已切换模型，本轮重新检索；此前的问题只用来理解指代。"
                          : v.resetReason === "turn-limit"
                            ? `这段对话已答满 ${v.maxTurns ?? 3} 轮，本轮开新会话重新检索（续得越长每轮越贵）；此前的问题只用来理解指代。`
                            : "原会话不可用，本轮重新检索。",
                  }
                : {}),
            }));
          },
          error: (m) => {
            text.flush();
            finished = true;
            patch((l) => ({ ...l, text: `${l.text}\n\n**出错了**：${m}` }));
          },
          done: (sid, answerId) => {
            text.flush();
            finished = true;
            turnState.persisted = true;
            if (sid) sessionId = sid;
            if (answerId) patch((l) => ({ ...l, answerId }));
            else scheduleSave();
          },
        },
        abortController.signal,
        fetchImpl,
      );
    } catch (err) {
      text.flush();
      if ((err as Error).name !== "AbortError") {
        patch((l) => ({ ...l, text: `${l.text}\n\n**连接失败**：${String(err)}` }));
      }
    } finally {
      turnState.settle();
      if (activeTurn === turnState) activeTurn = null;
      busy = false;
      syncSnapshot();
      notify();
    }
  }

  function flush() {
    activeTurn?.flushText();
    flushSave();
  }

  function dispose() {
    const turn = activeTurn;
    if (turn) {
      activeTurn = null;
      busy = false;
      turn.settle();
      turn.abort.abort();
    } else {
      flushSave();
    }
  }

  return {
    getState: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setInput,
    send,
    stop,
    flush,
    dispose,
  };
}

export function bindPageHideFlush(
  target: Pick<EventTarget, "addEventListener" | "removeEventListener">,
  controller: { flush: () => void; dispose: () => void },
): () => void {
  const onPageHide = () => controller.flush();
  target.addEventListener("pagehide", onPageHide);
  return () => {
    target.removeEventListener("pagehide", onPageHide);
    controller.dispose();
  };
}

/** 聊天状态放在面板外层：切页签、收起面板都不丢对话；卸载或关闭页面时先刷盘再中止连接 */
export function useChat(): ChatState {
  const [controller] = useState(() => createChatController());
  const state = useSyncExternalStore(controller.subscribe, controller.getState);

  useEffect(() => bindPageHideFlush(window, controller), [controller]);

  return state;
}

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
                    {m.model.provider === "codex" && " · Codex 账户额度"}
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
