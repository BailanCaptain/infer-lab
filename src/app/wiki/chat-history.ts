import { z } from "zod";
import { answerQualitySchema } from "../../content/wiki/answer-quality";
import { CHAT_PROVIDERS } from "../../content/wiki/chat-models";

export const CHAT_HISTORY_KEY = "wiki-chat-history-v1";
const strings = z.array(z.string());

const ruleVersionSchema = z.enum(["v0.30.0", "main", "rfork"]);
const ascendFamilySchema = z.enum(["A2", "A3", "310P", "A5"]);
const cardIdSchema = z.enum(["a2-64g", "a2-32g", "a3-die64g", "310p-24g", "950dt-128g"]);
const weightPrecisionSchema = z.enum([
  "bf16",
  "fp16",
  "w8a8",
  "w8a8_dynamic",
  "w4a8",
  "fp8_block",
  "w8a8sc_310p",
]);
const kvCacheDtypeSchema = z.enum(["auto", "int8", "mxfp8"]);
const cudagraphModeSchema = z.enum(["NONE", "PIECEWISE", "FULL_DECODE_ONLY", "FULL", "FULL_AND_PIECEWISE"]);

const deployAnalysisSchema = z.object({
  kind: z.literal("deploy"),
  model: z.union([z.string().min(1), z.record(z.string().min(1), z.unknown())]),
  cardId: cardIdSchema,
  version: ruleVersionSchema.optional(),
  weightPrecision: weightPrecisionSchema.optional(),
  kvCacheDtype: kvCacheDtypeSchema.optional(),
  blockSize: z.number().finite().optional(),
  userSpecifiedBlockSize: z.boolean().optional(),
  weightNzMode: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
  tpSize: z.number().finite().optional(),
  ppSize: z.number().finite().optional(),
  dpSize: z.number().finite().optional(),
  pcpSize: z.number().finite().optional(),
  dcpSize: z.number().finite().optional(),
  enableEp: z.boolean().optional(),
  enableEplb: z.boolean().optional(),
  dynamicEplb: z.boolean().optional(),
  engramCpuOffload: z.boolean().optional(),
  numSpecTokens: z.number().finite().optional(),
  gpuMemoryUtilization: z.number().finite().optional(),
  maxModelLen: z.number().finite().optional(),
  maxNumBatchedTokens: z.number().finite().optional(),
  maxNumSeqs: z.number().finite().optional(),
  cudagraphMode: cudagraphModeSchema.optional(),
  cudagraphCaptureCount: z.number().finite().optional(),
  enforceEager: z.boolean().optional(),
  decodeBatchSize: z.number().finite().optional(),
  prefillTokens: z.number().finite().optional(),
  decodeContextLen: z.number().finite().optional(),
});

const doctorModelTraitOverrideSchema = z.object({
  isMoe: z.boolean().optional(),
  useMla: z.boolean().optional(),
  sfaDcpReplicatedIndexer: z.boolean().optional(),
  numExperts: z.number().finite().optional(),
  numExpertsPerTok: z.number().finite().optional(),
  numAttentionHeads: z.number().finite().optional(),
  numKvHeads: z.number().finite().optional(),
  headDim: z.number().finite().optional(),
});

const doctorAnalysisSchema = z.object({
  kind: z.literal("doctor"),
  command: z.string().min(1),
  decodeCommand: z.string().min(1).optional(),
  mode: z.enum(["minimal", "full"]).optional(),
  hardwareFamily: ascendFamilySchema.optional(),
  decodeHardwareFamily: ascendFamilySchema.optional(),
  version: ruleVersionSchema.optional(),
  crossNodeRoce: z.boolean().optional(),
  modelId: z.string().min(1).optional(),
  modelTraitOverride: doctorModelTraitOverrideSchema.optional(),
});

const troubleshootAnalysisSchema = z.object({
  kind: z.literal("troubleshoot"),
  rawInput: z.string().min(1),
});

export const chatAnalysisSchema = z.discriminatedUnion("kind", [
  deployAnalysisSchema,
  doctorAnalysisSchema,
  troubleshootAnalysisSchema,
]);

function tolerantOptional<S extends z.ZodTypeAny>(schema: S) {
  return z
    .unknown()
    .transform((val): z.infer<S> | undefined => {
      if (val === undefined) return undefined;
      const parsed = schema.safeParse(val);
      return parsed.success ? parsed.data : undefined;
    })
    .optional();
}

export const retryAttachmentSchema = z.object({
  title: z.string(),
  summary: z.string(),
  sanitizedBlock: z.string(),
  redactionCount: z.number().finite().nonnegative().optional(),
  suggestedQuestion: z.string().optional(),
  analysis: tolerantOptional(chatAnalysisSchema),
});
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
  status: z.enum(["pending", "complete", "interrupted", "failed"]).optional(),
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
  rawDraft: tolerantOptional(z.string()),
  retryAttachment: tolerantOptional(retryAttachmentSchema),
});
const history = z.object({
  version: z.literal(1),
  msgs: z.array(message),
  input: z.string(),
  sessionId: z.string().optional(),
});
export type Msg = z.infer<typeof message>;
export type ChatAnalysisPayload = z.infer<typeof chatAnalysisSchema>;
export type PendingChatAttachment = z.infer<typeof retryAttachmentSchema>;
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

export function settleFailedMessage(msg: Msg): Msg {
  const { answerId: _unusedAnswerId, ...rest } = msg;
  return {
    ...rest,
    status: "failed",
    trace:
      msg.trace?.status === "searching"
        ? { status: "failed", reason: "回答出错，未收到搜索结果" }
        : msg.trace,
    quality:
      msg.quality?.status === "checking"
        ? { status: "unavailable", reason: "回答出错，未收到核对结果" }
        : msg.quality,
  };
}

export function settleCompletedMessage(msg: Msg): Msg {
  const { retryAttachment: _unusedRetry, rawDraft: _unusedDraft, ...rest } = msg;
  return {
    ...rest,
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
        : msg.status === "failed"
          ? settleFailedMessage(msg)
          : msg.status === "interrupted"
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
