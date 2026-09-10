import { CornerDownLeft, MessageSquare, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { rewriteRelativeLink } from "../../content/wiki/index";

interface Msg {
  /** 稳定 key：消息会边流边改，用数组下标当 key 会让 React 复用错行 */
  key: string;
  role: "user" | "agent";
  text: string;
  /** 回答没有引用任何页时给出的提示 */
  uncited?: boolean;
  reading?: string[];
}

/** 一次 SSE 请求。把帧回调出去，UI 只管渲染。 */
async function streamChat(
  body: { message: string; sessionId?: string },
  on: {
    text: (t: string) => void;
    tool: (target?: string) => void;
    cite: (v: { cited: boolean; selfDeclaredUncovered: boolean }) => void;
    done: (sessionId?: string) => void;
    error: (m: string) => void;
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
      else if (ev === "done") on.done(data.sessionId as string | undefined);
    }
  }
}

export function ChatDrawer() {
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
      setMsgs((m) => {
        const last = m[m.length - 1];
        return last ? [...m.slice(0, -1), fn(last)] : m;
      });

    abort.current = new AbortController();
    try {
      await streamChat(
        { message, ...(sessionId.current ? { sessionId: sessionId.current } : {}) },
        {
          text: (t) => patch((l) => ({ ...l, text: l.text + t })),
          tool: (target) =>
            patch((l) => {
              if (!target) return l;
              const name = target.split(/[\\/]/).pop() ?? target;
              return l.reading?.includes(name) ? l : { ...l, reading: [...(l.reading ?? []), name] };
            }),
          cite: (v) => patch((l) => ({ ...l, uncited: !v.cited })),
          error: (m) => patch((l) => ({ ...l, text: `${l.text}\n\n**出错了**：${m}` })),
          done: (sid) => {
            if (sid) sessionId.current = sid;
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
            {m.reading && m.reading.length > 0 && (
              <p className="wiki-chat-reading">正在读：{m.reading.join("、")}</p>
            )}
            {m.role === "agent" ? (
              <ReactMarkdown
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
                这段回答没有引用知识库里的任何页面，属于模型自身知识，未经本库核对。
              </p>
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
