import { useEffect, useState, useSyncExternalStore } from "react";
import type { AnswerQuality } from "../../content/wiki/answer-quality";
import {
  chatHttpError,
  interruptMessage,
  type Msg,
  readChatHistory,
  settleCompletedMessage,
  type TraceView,
  writeChatHistory,
} from "./chat-history";
import { textBatch } from "./text-batch";

type ModelView = NonNullable<Msg["model"]>;

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
    if (!message) return;
    if (busy || activeTurn) {
      if (preset !== undefined) setInput(preset);
      return;
    }
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
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);

  useEffect(() => bindPageHideFlush(window, controller), [controller]);

  return state;
}
