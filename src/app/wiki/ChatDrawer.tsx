import { CornerDownLeft, MessageSquare, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { rewriteRelativeLink } from "../../content/wiki/index";
import { AnswerSave } from "./AnswerSave";

interface Msg {
  /** 稳定 key：消息会边流边改，用数组下标当 key 会让 React 复用错行 */
  key: string;
  role: "user" | "agent";
  text: string;
  /** 回答没有引用任何页时给出的提示 */
  uncited?: boolean;
  citationReason?: string;
  reading?: string[];
  answerId?: string;
  revision?: string;
  versionNotice?: string;
  gapNotice?: string;
  related?: { id: string; title: string; href: string; note: string }[];
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
    error: (m: string) => void;
    knowledge: (v: { revision: string; sessionId: string; resetReason?: string }) => void;
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
      else if (ev === "gap") on.gap(data as never);
      else if (ev === "related" && Array.isArray(data.pages))
        on.related(data.pages as NonNullable<Msg["related"]>);
      else if (ev === "done")
        on.done(data.sessionId as string | undefined, data.answerId as string | undefined);
    }
  }
}

export function ChatDrawer({ onReview }: { onReview: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const sessionId = useRef<string | undefined>(undefined);
  const abort = useRef<AbortController | null>(null);

  const send = useCallback(async () => {
    const message = input.trim();
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
          tool: (target) =>
            patch((l) => {
              if (!target) return l;
              const name = target.split(/[\\/]/).pop() ?? target;
              return l.reading?.includes(name) ? l : { ...l, reading: [...(l.reading ?? []), name] };
            }),
          cite: (v) =>
            patch((l) => ({ ...l, uncited: !v.cited, citationReason: v.reason ?? "没有可核对的知识库引用" })),
          gap: (v) =>
            patch((l) => ({
              ...l,
              gapNotice:
                v.state === "record-failed"
                  ? "缺口信号未能保存；本次回答仍保留，请稍后重试。"
                  : v.state === "awaiting-assessment"
                    ? `缺口信号已记录（${v.count} 次），已进入处理队列；预算内核对后生成待审变更，缺材料时等待补充。`
                    : `缺口信号已记录（${v.count}/${v.threshold}）；尚未确认知识缺失，也未启动补写。`,
            })),
          knowledge: (v) => {
            sessionId.current = v.sessionId;
            patch((l) => ({
              ...l,
              revision: v.revision,
              ...(v.resetReason
                ? {
                    versionNotice:
                      v.resetReason === "knowledge-updated"
                        ? "知识库已更新，本轮重新检索；旧回答仅保留显示。"
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
  }, [input, busy]);

  if (!open) {
    return (
      <button type="button" className="wiki-chat-fab" data-testid="chat-open" onClick={() => setOpen(true)}>
        <MessageSquare size={14} /> 问知识库
      </button>
    );
  }

  return (
    <aside className="wiki-chat" data-testid="chat-drawer">
      <header>
        <strong>问知识库</strong>
        <button
          type="button"
          aria-label="关闭"
          data-testid="chat-close"
          onClick={() => {
            abort.current?.abort();
            setOpen(false);
          }}
        >
          <X size={14} />
        </button>
      </header>

      <div className="wiki-chat-log" data-testid="chat-log">
        {msgs.length === 0 && (
          <p className="wiki-chat-hint">
            问什么都行，比如「Block Table 是什么」。回答只基于这个知识库；库里没有的会明说。
          </p>
        )}
        {msgs.map((m) => (
          <div key={m.key} className={`wiki-chat-msg is-${m.role}`}>
            {m.revision && (
              <p className="wiki-chat-reading" data-testid="chat-version">
                知识版本 {m.revision.slice(0, 12)}
              </p>
            )}
            {m.versionNotice && (
              <p role="status" className="wiki-chat-uncited" data-testid="chat-version-notice">
                {m.versionNotice}
              </p>
            )}
            {m.reading && m.reading.length > 0 && (
              <p className="wiki-chat-reading">正在读：{m.reading.join("、")}</p>
            )}
            {m.role === "agent" ? (
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
              m.text
            )}
            {m.uncited && (
              <p className="wiki-chat-uncited" data-testid="chat-uncited">
                引用检查未通过：{m.citationReason ?? "没有可核对的知识库引用"}
                。这段回答未经本库核对，暂不能存进 Wiki。
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
        <button type="submit" data-testid="chat-send" disabled={busy || !input.trim()}>
          <CornerDownLeft size={13} /> 问
        </button>
      </form>
    </aside>
  );
}
