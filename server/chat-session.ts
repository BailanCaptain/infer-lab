import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";
import { localFile } from "../scripts/wiki/review-files";
import { atomicText, WorkflowStore } from "../scripts/wiki/workflow";
import { HttpError } from "./http";

const uuid = z.string().uuid();
/**
 * 一个模型会话最多续答几轮。2026-09-23 实测同一会话连问四轮，费用 $0.66 → $1.15 → $1.60 → $2.01：
 * 续会话要带上全部历史，每轮约贵 $0.45，第四轮就超过 $2 的单次预留、触发共享预算熔断。
 * 答满就换新会话；同知识、同模型保留有界问答作指代，知识或模型变化时只保留问题。
 */
export const MAX_SESSION_TURNS = 3;
export const CHAT_HISTORY_BYTES = 32 * 1024;
/** 同一进程内异常挂起的会话租约最长保留时间（大于单轮问答超时，防止永久 409） */
export const CHAT_LEASE_TTL_MS = 10 * 60_000;
const turnSchema = z.object({ question: z.string(), answer: z.string() }).strict();
export type ChatTurn = z.infer<typeof turnSchema>;
// Keep whole consecutive turns; a partial log or answer could reverse its meaning.
function recentTurns(turns: ChatTurn[]): ChatTurn[] {
  const kept: ChatTurn[] = [];
  for (const turn of turns.slice(-MAX_SESSION_TURNS).reverse()) {
    if (Buffer.byteLength(JSON.stringify([turn, ...kept]), "utf8") > CHAT_HISTORY_BYTES) break;
    kept.unshift(turn);
  }
  return kept;
}
const sessionSchema = z
  .object({
    id: uuid,
    revision: z.string().regex(/^[a-f0-9]{64}$/),
    modelKey: z.string().default("claude"),
    agentSessionId: uuid.optional(),
    /** 当前模型会话已答的轮数；换会话时从头数 */
    turns: z.number().int().nonnegative().default(0),
    questions: z.array(z.string().max(8000)).max(6),
    history: z.array(turnSchema).max(MAX_SESSION_TURNS).default([]),
    active: z
      .object({
        token: uuid,
        pid: z.number().int().positive(),
        startedAt: z.number().finite().optional(),
      })
      .optional(),
  })
  .strict();
type Session = z.infer<typeof sessionSchema>;
export interface ChatLease {
  id: string;
  token: string;
  revision: string;
  modelKey: string;
  agentSessionId?: string | undefined;
  previousQuestions: string[];
  contextQuestions: string[];
  contextTurns: ChatTurn[];
  historyOmitted: boolean;
  resetReason?: "knowledge-updated" | "session-unavailable" | "turn-limit" | "model-changed" | undefined;
}
const pathOf = (root: string, id: string) =>
  localFile(root, `wiki/_jobs/chat-sessions/${uuid.parse(id)}.json`);
const read = (root: string, id: string) =>
  sessionSchema.parse(JSON.parse(readFileSync(pathOf(root, id), "utf8")));
const write = (root: string, session: Session) => {
  const path = pathOf(root, session.id);
  mkdirSync(dirname(path), { recursive: true });
  atomicText(path, `${JSON.stringify(sessionSchema.parse(session), null, 2)}\n`);
};
const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code !== "ESRCH";
  }
};

/** Application session IDs never become unrestricted caller-supplied --resume arguments. */
export function beginChat(
  root: string,
  revision: string,
  id?: string,
  modelKey = "claude",
  now = Date.now(),
): Promise<ChatLease> {
  return new WorkflowStore(root).locked(() => {
    const known = id && uuid.safeParse(id).success && existsSync(pathOf(root, id));
    const session: Session = known
      ? read(root, id)
      : { id: randomUUID(), revision, modelKey, turns: 0, questions: [], history: [] };
    const leaseExpired =
      session.active?.startedAt !== undefined && now - session.active.startedAt >= CHAT_LEASE_TTL_MS;
    if (session.active && !leaseExpired && alive(session.active.pid))
      throw new HttpError(409, "这段会话正在回答，请等待结束后再提问");
    const changed = session.revision !== revision;
    const exhausted = !changed && session.turns >= MAX_SESSION_TURNS;
    const modelChanged = session.modelKey !== modelKey;
    const fresh = changed || exhausted || modelChanged || !session.agentSessionId;
    const contextTurns = changed || modelChanged ? [] : recentTurns(session.history);
    const token = randomUUID();
    const lease: ChatLease = {
      id: session.id,
      token,
      revision,
      modelKey,
      agentSessionId: fresh ? undefined : session.agentSessionId,
      previousQuestions: fresh ? session.questions : [],
      contextQuestions: session.questions,
      contextTurns,
      historyOmitted: contextTurns.length < session.questions.length,
      resetReason: changed
        ? "knowledge-updated"
        : modelChanged
          ? "model-changed"
          : exhausted
            ? "turn-limit"
            : id && !known
              ? "session-unavailable"
              : undefined,
    };
    session.active = { token, pid: process.pid, startedAt: now };
    write(root, session);
    return lease;
  });
}

export function finishChat(
  root: string,
  lease: ChatLease,
  question: string,
  result: { ok: boolean; sessionId?: string | undefined; answer?: string | undefined },
): Promise<void> {
  return new WorkflowStore(root).locked(() => {
    const session = read(root, lease.id);
    if (session.active?.token !== lease.token) throw new Error("会话 attempt 已过期，拒绝回写");
    if (result.ok) {
      session.revision = lease.revision;
      session.modelKey = lease.modelKey;
      session.agentSessionId = uuid.safeParse(result.sessionId).success ? result.sessionId : undefined;
      // 续上旧会话就累加；这轮开的是新会话就从 1 数起
      session.turns = lease.agentSessionId ? session.turns + 1 : 1;
      session.questions = [...session.questions, question.slice(0, 8000)].slice(-6);
      session.history = result.answer
        ? recentTurns([...lease.contextTurns, { question, answer: result.answer }])
        : [];
    }
    delete session.active;
    write(root, session);
  });
}
