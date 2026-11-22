import { useEffect, useState, useSyncExternalStore } from "react";
import type { AnswerQuality } from "../../content/wiki/answer-quality";
import type { AscendCalcCardId, KvCacheDtype, WeightPrecision } from "../../sim/modelspec/deployCalculator";
import type { AscendFamily, CudaGraphMode, RuleVersion } from "../../sim/rules/types";
import { type BackendAvailability, getBackendAvailability, setBackendAvailability } from "./api";
import {
  chatHttpError,
  interruptMessage,
  type Msg,
  readChatHistory,
  settleCompletedMessage,
  settleFailedMessage,
  type TraceView,
  writeChatHistory,
} from "./chat-history";
import { textBatch } from "./text-batch";

type ModelView = NonNullable<Msg["model"]>;

export const STATIC_CHAT_UNAVAILABLE = "当前静态环境未连接本地问答服务，请使用顶部搜索（Ctrl+K）查阅知识库。";

export type ChatAnalysisPayload =
  | {
      kind: "deploy";
      model: string | Record<string, unknown>;
      cardId: AscendCalcCardId;
      version?: RuleVersion | undefined;
      weightPrecision?: WeightPrecision | undefined;
      kvCacheDtype?: KvCacheDtype | undefined;
      blockSize?: number | undefined;
      userSpecifiedBlockSize?: boolean | undefined;
      weightNzMode?: 0 | 1 | 2 | undefined;
      tpSize?: number | undefined;
      ppSize?: number | undefined;
      dpSize?: number | undefined;
      pcpSize?: number | undefined;
      dcpSize?: number | undefined;
      enableEp?: boolean | undefined;
      enableEplb?: boolean | undefined;
      dynamicEplb?: boolean | undefined;
      engramCpuOffload?: boolean | undefined;
      numSpecTokens?: number | undefined;
      gpuMemoryUtilization?: number | undefined;
      maxModelLen?: number | undefined;
      maxNumBatchedTokens?: number | undefined;
      maxNumSeqs?: number | undefined;
      cudagraphMode?: CudaGraphMode | undefined;
      cudagraphCaptureCount?: number | undefined;
      enforceEager?: boolean | undefined;
      decodeBatchSize?: number | undefined;
      prefillTokens?: number | undefined;
      decodeContextLen?: number | undefined;
    }
  | {
      kind: "doctor";
      command: string;
      decodeCommand?: string | undefined;
      mode?: "minimal" | "full" | undefined;
      hardwareFamily?: AscendFamily | undefined;
      decodeHardwareFamily?: AscendFamily | undefined;
      version?: RuleVersion | undefined;
      crossNodeRoce?: boolean | undefined;
    }
  | {
      kind: "troubleshoot";
      rawInput: string;
    };

export interface PendingChatAttachment {
  title: string;
  summary: string;
  sanitizedBlock: string;
  redactionCount?: number | undefined;
  suggestedQuestion?: string | undefined;
  analysis?: ChatAnalysisPayload | undefined;
}

/** 一次 SSE 请求。把帧回调出去，UI 只管渲染。 */
async function streamChat(
  body: { message: string; sessionId?: string; analysis?: ChatAnalysisPayload },
  on: {
    text: (t: string) => void;
    tool: (target?: string) => void;
    toolEvidence?: (v: Record<string, unknown>) => void;
    cite: (v: { cited: boolean; selfDeclaredUncovered: boolean; reason?: string }) => void;
    persisted: (v: { sessionId?: string; revision?: string; finalText?: string }) => void;
    done: (sessionId?: string, answerId?: string, finalText?: string) => void;
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
  const contentType = res.headers?.get?.("content-type")?.trim() ?? "";
  if (!res.ok || !res.body) {
    const rawBody = await res.text().catch(() => "");
    if (res.status === 404 && !contentType.toLowerCase().includes("application/json")) {
      setBackendAvailability("offline");
      on.error(STATIC_CHAT_UNAVAILABLE);
      return;
    }
    on.error(chatHttpError(res.status, rawBody));
    return;
  }
  if (contentType && !contentType.toLowerCase().includes("text/event-stream")) {
    setBackendAvailability("offline");
    on.error(STATIC_CHAT_UNAVAILABLE);
    return;
  }
  if (contentType.toLowerCase().includes("text/event-stream")) {
    setBackendAvailability("online");
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
      else if (ev === "toolEvidence") on.toolEvidence?.(data);
      else if (ev === "cite") on.cite(data as never);
      else if (ev === "persisted") {
        const payload: { sessionId?: string; revision?: string; finalText?: string } = {};
        if (typeof data.sessionId === "string") payload.sessionId = data.sessionId;
        if (typeof data.revision === "string") payload.revision = data.revision;
        if (typeof data.finalText === "string") payload.finalText = data.finalText;
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
        on.done(
          data.sessionId as string | undefined,
          data.answerId as string | undefined,
          typeof data.finalText === "string" ? data.finalText : undefined,
        );
    }
  }
}

const SAVE_ERROR = "本机保存失败，刷新可能丢失记录；请先复制需要的回答。";

export interface ChatState {
  msgs: Msg[];
  input: string;
  setInput: (value: string) => void;
  pendingAttachment?: PendingChatAttachment | null | undefined;
  setPendingAttachment?: ((attachment: PendingChatAttachment | null) => void) | undefined;
  busy: boolean;
  send: (preset?: string) => Promise<void>;
  stop: () => void;
  storageError: string;
}

export interface ChatControllerDeps {
  storage?: Pick<Storage, "getItem" | "setItem">;
  fetchImpl?: typeof fetch;
  getBackendAvailability?: () => BackendAvailability;
}

interface ActiveTurn {
  readonly turnId: number;
  abort: AbortController;
  persisted: boolean;
  settled: boolean;
  flushText: () => void;
  settle: () => void;
}

export function createChatController(deps: ChatControllerDeps = {}) {
  const storage = deps.storage ?? (typeof localStorage !== "undefined" ? localStorage : undefined);
  const fetchImpl = deps.fetchImpl ?? fetch;
  const readBackendAvailability = deps.getBackendAvailability ?? getBackendAvailability;

  let msgs: Msg[] = [];
  let input = "";
  let ephemeralQuestion = "";
  let pendingAttachment: PendingChatAttachment | null = null;
  let sessionId: string | undefined;
  let storageError = "";
  let busy = false;
  let dirty = false;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let activeTurn: ActiveTurn | null = null;
  let latestTurnId = 0;
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

  const effectiveInput = () => (input.trim() ? input : ephemeralQuestion || input);

  const notify = () => {
    for (const listener of listeners) listener();
  };

  let snapshot: ChatState = {
    msgs,
    input: effectiveInput(),
    setInput,
    pendingAttachment,
    setPendingAttachment,
    busy,
    send,
    stop,
    storageError,
  };

  const syncSnapshot = () => {
    snapshot = {
      msgs,
      input: effectiveInput(),
      setInput,
      pendingAttachment,
      setPendingAttachment,
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
    ephemeralQuestion = "";
    if (input === value) {
      syncSnapshot();
      notify();
      return;
    }
    input = value;
    syncSnapshot();
    scheduleSave();
    notify();
  }

  function setPendingAttachment(attachment: PendingChatAttachment | null) {
    pendingAttachment = attachment;
    ephemeralQuestion = attachment?.suggestedQuestion?.trim() ?? "";
    syncSnapshot();
    notify();
  }

  function stop() {
    const turn = activeTurn;
    if (!turn) return;
    turn.settle();
    activeTurn = null;
    busy = false;
    syncSnapshot();
    notify();
    turn.abort.abort();
  }

  async function send(preset?: string): Promise<void> {
    if (readBackendAvailability() === "offline") return;
    const isPreset = preset !== undefined;
    const attachment = isPreset ? null : pendingAttachment;
    const rawDraft = (preset ?? effectiveInput()).trim();
    if (!rawDraft && !attachment) return;
    if (busy || activeTurn) {
      if (isPreset && !input.trim()) setInput(preset);
      return;
    }

    const analysis = attachment?.analysis;
    let message = rawDraft;
    if (attachment) {
      if (!message) {
        message = `${attachment.title}\n\n${attachment.sanitizedBlock}`;
      } else if (!message.includes(attachment.sanitizedBlock)) {
        message = `${message}\n\n${attachment.sanitizedBlock}`;
      }
      pendingAttachment = null;
    }
    if (!isPreset) {
      ephemeralQuestion = "";
      input = "";
    }
    busy = true;

    const turnId = ++latestTurnId;
    const priorSessionId = sessionId;
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
    const text = textBatch((chunk) => {
      if (latestTurnId !== turnId) return;
      patch((l) => ({ ...l, text: l.text + chunk }));
    });
    const abortController = new AbortController();
    let doneReceived = false;
    let errored = false;

    const turnState: ActiveTurn = {
      turnId,
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
        if (turnState.persisted || (doneReceived && !errored)) {
          msgs = msgs.map((item) => (item.key === agentKey ? settleCompletedMessage(item) : item));
        } else if (errored) {
          if (latestTurnId === turnId) {
            sessionId = priorSessionId;
          }
          msgs = msgs.map((item) => (item.key === agentKey ? settleFailedMessage(item) : item));
        } else {
          if (latestTurnId === turnId) {
            sessionId = undefined;
          }
          msgs = msgs.map((item) => (item.key === agentKey ? interruptMessage(item) : item));
        }
        dirty = true;
        syncSnapshot();
        flushSave();
        notify();
      },
    };
    activeTurn = turnState;
    const isCurrentTurn = () => latestTurnId === turnId && activeTurn === turnState;

    const requestBody: { message: string; sessionId?: string; analysis?: ChatAnalysisPayload } = {
      message,
      ...(sessionId !== undefined ? { sessionId } : {}),
      ...(analysis !== undefined ? { analysis } : {}),
    };

    try {
      await streamChat(
        requestBody,
        {
          text: (chunk) => {
            if (!isCurrentTurn()) return;
            text.push(chunk);
          },
          related: (pages) => {
            if (!isCurrentTurn()) return;
            patch((l) => ({ ...l, related: pages }));
          },
          trace: (v) => {
            if (!isCurrentTurn()) return;
            patch((l) => ({ ...l, trace: v }));
          },
          tool: (target) => {
            if (!isCurrentTurn()) return;
            patch((l) => {
              if (!target) return l;
              const name = target.split(/[\\/]/).pop() ?? target;
              return l.reading?.includes(name) ? l : { ...l, reading: [...(l.reading ?? []), name] };
            });
          },
          cite: (v) => {
            if (!isCurrentTurn() || errored) return;
            patch((l) => ({
              ...l,
              uncited: !v.cited && !v.selfDeclaredUncovered,
              uncovered: v.selfDeclaredUncovered,
              citationReason: v.reason ?? "没有可核对的知识库引用",
            }));
          },
          persisted: (v) => {
            if (!isCurrentTurn() || errored) return;
            text.flush();
            turnState.persisted = true;
            if (v.sessionId) sessionId = v.sessionId;
            msgs = msgs.map((item) =>
              item.key === agentKey
                ? {
                    ...item,
                    ...(typeof v.finalText === "string" ? { text: v.finalText } : {}),
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
          gap: (v) => {
            if (!isCurrentTurn()) return;
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
            }));
          },
          notice: (v) => {
            if (!isCurrentTurn()) return;
            patch((l) => ({ ...l, toolNotice: v.message }));
          },
          quality: (v) => {
            if (!isCurrentTurn()) return;
            patch((l) => ({ ...l, quality: v }));
          },
          model: (v) => {
            if (!isCurrentTurn()) return;
            patch((l) => ({ ...l, model: v }));
          },
          knowledge: (v) => {
            if (!isCurrentTurn()) return;
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
            if (!isCurrentTurn() || turnState.persisted) return;
            text.flush();
            errored = true;
            patch((l) => ({ ...l, text: `${l.text}\n\n**出错了**：${m}` }));
          },
          done: (sid, answerId, finalText) => {
            if (!isCurrentTurn() || errored) return;
            text.flush();
            doneReceived = true;
            if (sid) sessionId = sid;
            if (answerId || finalText !== undefined) {
              patch((l) => ({
                ...l,
                ...(finalText !== undefined ? { text: finalText } : {}),
                ...(answerId ? { answerId } : {}),
              }));
            } else {
              scheduleSave();
            }
          },
        },
        abortController.signal,
        fetchImpl,
      );
    } catch (err) {
      if (isCurrentTurn() && !turnState.persisted) {
        text.flush();
        if ((err as Error).name !== "AbortError") {
          errored = true;
          patch((l) => ({ ...l, text: `${l.text}\n\n**连接失败**：${String(err)}` }));
        }
      }
    } finally {
      if (latestTurnId === turnId) {
        turnState.settle();
        if (activeTurn === turnState) activeTurn = null;
        busy = false;
        syncSnapshot();
        notify();
      }
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
    setPendingAttachment,
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
