import { z } from "zod";
import { answerQualitySchema } from "../../content/wiki/answer-quality";
import { CHAT_PROVIDERS } from "../../content/wiki/chat-models";

export const CHAT_HISTORY_KEY = "wiki-chat-history-v1";
const strings = z.array(z.string());
const versions = z.union([
  z.object({
    status: z.literal("found"),
    commit: z.string(),
    pins: z.array(
      z.object({
        ref: z.string(),
        contains: z.boolean(),
        sameNumberCommit: z.string().optional(),
      }),
    ),
    tags: strings,
    moreTags: z.number(),
  }),
  z.object({ status: z.enum(["no-local-clone", "no-local-commit", "error"]), reason: z.string() }),
]);
const trace = z.union([
  z.object({ status: z.literal("searching") }),
  z.object({ status: z.literal("failed"), reason: z.string() }),
  z.object({ status: z.literal("skipped"), reason: z.string() }),
  z.object({
    status: z.literal("done"),
    scope: z.object({ repos: strings, since: z.string() }),
    complete: z.boolean(),
    candidates: z.array(
      z.object({
        repo: z.string(),
        number: z.number(),
        kind: z.enum(["issue", "pr"]),
        url: z.string(),
        title: z.string(),
        state: z.string(),
        versions: versions.optional(),
        docs: z
          .array(
            z.object({
              url: z.string(),
              version: z.string(),
              reason: z.string().optional(),
              mappings: z.array(
                z.object({
                  pinnedRef: z.string().optional(),
                  matchesPinned: z.boolean(),
                  localPath: z.string().optional(),
                  reason: z.string().optional(),
                }),
              ),
            }),
          )
          .optional(),
        linkedPrs: z
          .array(z.object({ number: z.number(), url: z.string(), basis: z.string(), versions }))
          .optional(),
      }),
    ),
  }),
]);
const message = z.object({
  key: z.string(),
  role: z.enum(["user", "agent"]),
  text: z.string(),
  status: z.enum(["pending", "complete", "interrupted"]).optional(),
  uncited: z.boolean().optional(),
  uncovered: z.boolean().optional(),
  citationReason: z.string().optional(),
  reading: strings.optional(),
  answerId: z.string().optional(),
  revision: z.string().optional(),
  online: z.boolean().optional(),
  versionNotice: z.string().optional(),
  toolNotice: z.string().optional(),
  gapNotice: z.string().optional(),
  trace: trace.optional(),
  model: z
    .object({
      provider: z.enum(CHAT_PROVIDERS).optional(),
      requested: z.string().optional(),
      answeredBy: z.string().optional(),
      switched: z.boolean(),
      switches: z.array(
        z.object({ event: z.string(), from: z.string(), to: z.string(), reason: z.string().optional() }),
      ),
    })
    .optional(),
  related: z
    .array(z.object({ id: z.string(), title: z.string(), href: z.string(), note: z.string() }))
    .optional(),
  quality: z
    .union([
      z.object({ status: z.literal("checking") }),
      z.object({ status: z.literal("unavailable"), reason: z.string() }),
      z.object({
        status: z.literal("checked"),
        jobId: z.string(),
        revision: z.string(),
        decision: answerQualitySchema,
      }),
    ])
    .optional(),
});
const history = z.object({
  version: z.literal(1),
  msgs: z.array(message),
  input: z.string(),
  sessionId: z.string().optional(),
});
export type Msg = z.infer<typeof message>;
export type TraceView = z.infer<typeof trace>;
export type TraceVersions = z.infer<typeof versions>;
export type ChatHistory = z.infer<typeof history>;

/** 问答接口非 200 时给读者看的话：带上后端 JSON 里的说明（如 409「会话正在回答」），去掉 Error: 前缀 */
export function chatHttpError(status: number, body: string): string {
  let detail = "";
  try {
    const parsed: unknown = JSON.parse(body);
    if (parsed && typeof parsed === "object" && "error" in parsed && typeof parsed.error === "string")
      detail = parsed.error.replace(/^\w*Error:\s*/, "").trim();
  } catch {
    // 不是 JSON（例如代理返回的网页）：只报状态码
  }
  return detail ? `服务返回 ${status}：${detail}` : `服务返回 ${status}`;
}

export function interruptMessage(msg: Msg): Msg {
  return {
    ...msg,
    status: "interrupted",
    trace:
      msg.trace?.status === "searching"
        ? { status: "failed", reason: "回答中断，未收到搜索结果" }
        : msg.trace,
    quality:
      msg.quality?.status === "checking"
        ? { status: "unavailable", reason: "回答中断，未收到核对结果" }
        : msg.quality,
  };
}

export function settleCompletedMessage(msg: Msg): Msg {
  return {
    ...msg,
    status: "complete",
    trace:
      msg.trace?.status === "searching"
        ? { status: "failed", reason: "连接结束，未收到搜索结果" }
        : msg.trace,
    quality:
      msg.quality?.status === "checking"
        ? { status: "unavailable", reason: "独立核对未完成，未收到核对结果" }
        : msg.quality,
  };
}

export function readChatHistory(storage: Pick<Storage, "getItem">): ChatHistory {
  const raw = storage.getItem(CHAT_HISTORY_KEY);
  const saved = raw ? history.parse(JSON.parse(raw)) : { version: 1 as const, msgs: [], input: "" };
  const interrupted = saved.msgs.some((msg) => msg.status === "pending");
  return {
    ...saved,
    // A disconnected request can still hold the server lease; do not resume that lease.
    sessionId: interrupted ? undefined : saved.sessionId,
    msgs: saved.msgs.map((msg) =>
      msg.status === "pending"
        ? interruptMessage(msg)
        : msg.quality?.status === "checking" || msg.trace?.status === "searching"
          ? settleCompletedMessage(msg)
          : msg,
    ),
  };
}

export function writeChatHistory(storage: Pick<Storage, "setItem">, value: ChatHistory) {
  storage.setItem(CHAT_HISTORY_KEY, JSON.stringify(value));
}
