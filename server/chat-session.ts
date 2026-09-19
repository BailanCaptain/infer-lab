import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";
import { localFile } from "../scripts/wiki/review-files";
import { atomicText, WorkflowStore } from "../scripts/wiki/workflow";
import { HttpError } from "./http";

const uuid = z.string().uuid();
const sessionSchema = z
  .object({
    id: uuid,
    revision: z.string().regex(/^[a-f0-9]{64}$/),
    agentSessionId: uuid.optional(),
    questions: z.array(z.string().max(8000)).max(6),
    active: z.object({ token: uuid, pid: z.number().int().positive() }).optional(),
  })
  .strict();
type Session = z.infer<typeof sessionSchema>;
export interface ChatLease {
  id: string;
  token: string;
  revision: string;
  agentSessionId?: string | undefined;
  previousQuestions: string[];
  contextQuestions: string[];
  resetReason?: "knowledge-updated" | "session-unavailable" | undefined;
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
export function beginChat(root: string, revision: string, id?: string): Promise<ChatLease> {
  return new WorkflowStore(root).locked(() => {
    const known = id && uuid.safeParse(id).success && existsSync(pathOf(root, id));
    const session: Session = known ? read(root, id) : { id: randomUUID(), revision, questions: [] };
    if (session.active && alive(session.active.pid))
      throw new HttpError(409, "这段会话正在回答，请等待结束后再提问");
    const changed = session.revision !== revision;
    const token = randomUUID();
    const lease: ChatLease = {
      id: session.id,
      token,
      revision,
      agentSessionId: changed ? undefined : session.agentSessionId,
      previousQuestions: changed ? session.questions : [],
      contextQuestions: session.questions,
      resetReason: changed ? "knowledge-updated" : id && !known ? "session-unavailable" : undefined,
    };
    session.active = { token, pid: process.pid };
    write(root, session);
    return lease;
  });
}

export function finishChat(
  root: string,
  lease: ChatLease,
  question: string,
  result: { ok: boolean; sessionId?: string | undefined },
): Promise<void> {
  return new WorkflowStore(root).locked(() => {
    const session = read(root, lease.id);
    if (session.active?.token !== lease.token) throw new Error("会话 attempt 已过期，拒绝回写");
    if (result.ok) {
      session.revision = lease.revision;
      session.agentSessionId = uuid.safeParse(result.sessionId).success ? result.sessionId : undefined;
      session.questions = [...session.questions, question.slice(0, 8000)].slice(-6);
    }
    delete session.active;
    write(root, session);
  });
}
