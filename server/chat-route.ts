import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { z } from "zod";
import { withBudget } from "../scripts/wiki/budget";
import { type ChatTrace, looksLikeError, publicTrace, traceChat } from "../scripts/wiki/chat-trace";
import { attachCorpusProvenance, corpusDocuments } from "../scripts/wiki/corpus-trace";
import { recordGapObservation } from "../scripts/wiki/gap-ledger";
import { answeredBy, modelSwitched } from "../scripts/wiki/model-use";
import { readSyncConfig } from "../scripts/wiki/sync";
import type { CorpusDocument } from "../src/content/wiki/corpus-retrieve";
import { neighborhood } from "../src/content/wiki/relations";
import { type CitationVerdict, retrieve } from "../src/content/wiki/retrieve";
import { captureAnswer } from "./answers";
import {
  buildChatRequest,
  CHAT_TIMEOUT_MS,
  type ChatHit,
  chatOnline,
  claimsOffline,
  runChat,
  sseFrame,
} from "./chat";
import { beginChat, type ChatLease, finishChat, MAX_SESSION_TURNS } from "./chat-session";
import { answerCitationGuide, checkAnswerCitations } from "./citations";
import { coverageSignals } from "./coverage";
import { HttpError, readJson, send } from "./http";
import { relatedReading } from "./related-reading";
import {
  type KnowledgeSnapshot,
  materializeSnapshot,
  readKnowledgeSnapshot,
  verifySnapshot,
} from "./snapshot";

const inputSchema = z
  .object({
    message: z.string().trim().min(1).max(100_000),
    sessionId: z.string().min(1).max(200).optional(),
  })
  .strict();

/** Production and controlled evaluation must inject the same retrieval context. */
export function retrieveChatContext(
  message: string,
  snapshot: Pick<KnowledgeSnapshot, "index" | "registry" | "pageTexts">,
  corpus?: CorpusDocument[],
) {
  const hits = retrieve(message, snapshot.index, {
    limit: 5,
    expand: true,
    expansionLimit: 5,
    corpus,
  }) as ChatHit[];
  const graph = hits.slice(0, 2).flatMap((hit) => {
    const page = snapshot.registry.pages.find((p) => p.id === hit.id);
    return page
      ? [{ id: page.id, title: page.title, neighborhood: neighborhood(page.relations, page.backlinks) }]
      : [];
  });
  const files = new Set(
    snapshot.registry.pages.filter((page) => hits.some((hit) => hit.id === page.id)).map((page) => page.file),
  );
  const citationGuide = answerCitationGuide(snapshot.pageTexts.filter((page) => files.has(page.file)));
  return { hits, graph, citationGuide };
}

/** 同步配置里的 chatModel，本机覆盖文件优先；每轮现读，改了配置不用重启服务 */
function chatModel(root: string): { model?: string } {
  const model = readSyncConfig(join(root, "wiki/sync.config.json")).chatModel;
  return model ? { model } : {};
}

/** Both production HTTP and fixture browsers use this exact orchestration. */
export async function handleChat(
  req: IncomingMessage,
  res: ServerResponse,
  root: string,
  deps: { runChat?: typeof runChat; traceChat?: typeof traceChat } = {},
): Promise<boolean> {
  if (new URL(req.url ?? "/", "http://localhost").pathname !== "/api/wiki/chat") return false;
  let lease: ChatLease | undefined;
  let message = "";
  let answer = "";
  let answerId: string | undefined;
  const webTools: { name: string; target?: string }[] = [];
  let citations: CitationVerdict = { cited: false, selfDeclaredUncovered: false, reason: "回答尚未完整核对" };
  let outcome: Awaited<ReturnType<typeof runChat>> = { ok: false };
  const emit = (event: string, data: unknown) => {
    if (!res.destroyed) res.write(sseFrame(event, data));
  };
  try {
    if (req.method !== "POST") throw new HttpError(405, "需要 POST");
    const input = inputSchema.parse(await readJson(req, 400_000));
    message = input.message;
    const snapshot = await readKnowledgeSnapshot(root);
    const location = await materializeSnapshot(root, snapshot);
    lease = await beginChat(root, snapshot.revision, input.sessionId);
    const context = retrieveChatContext(message, snapshot, corpusDocuments(root));
    const hits = attachCorpusProvenance(root, context.hits);
    const graph = context.graph;
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    emit("knowledge", {
      revision: lease.revision,
      sessionId: lease.id,
      resetReason: lease.resetReason,
      maxTurns: MAX_SESSION_TURNS,
      // 网页问答永远给联网工具（离线对照只走内部评测）；界面照实标出来
      online: chatOnline({}),
    });
    emit("hits", { hits });
    // 贴的是报错才在线查 GitHub（F003 AC4 聊天层接入）；普通提问一个网络请求都不发
    let github: ChatTrace | undefined;
    if (looksLikeError(message)) {
      emit("trace", { status: "searching" });
      try {
        github = await (deps.traceChat ?? traceChat)(root, message);
      } catch (error) {
        github = { status: "failed", reason: error instanceof Error ? error.message : String(error) };
      }
      emit("trace", publicTrace(github));
    }
    const request = buildChatRequest(
      {
        message,
        ...(lease.agentSessionId ? { sessionId: lease.agentSessionId } : {}),
        previousQuestions: lease.previousQuestions,
        hits,
        graph,
        citationGuide: context.citationGuide,
        ...(github && github.status !== "skipped" ? { github } : {}),
      },
      snapshot.handbook,
      { wikiRoot: location, revision: snapshot.revision, timeoutMs: CHAT_TIMEOUT_MS, ...chatModel(root) },
    );
    const execute: typeof runChat =
      deps.runChat ?? ((req, on) => withBudget(root, "chat", req, (bounded) => runChat(bounded, on)));
    outcome = await execute(request, {
      text: (text) => {
        answer += text;
        emit("text", { text });
      },
      tool: (name, target) => {
        if ((name === "WebFetch" || name === "WebSearch") && webTools.length < 20)
          webTools.push({ name, ...(target ? { target } : {}) });
        emit("tool", { name, target });
      },
    });
    // 失败的轮次也发：拒答换手常常就出在这种时候
    if (outcome.models)
      emit("model", {
        ...(outcome.models.requested ? { requested: outcome.models.requested } : {}),
        answeredBy: answeredBy(outcome.models),
        switched: modelSwitched(outcome.models),
        switches: outcome.models.switches,
      });
    verifySnapshot(root, location, snapshot);
    if (outcome.ok && !answer.trim()) outcome = { ok: false, reason: "问答没有返回正文" };
    if (outcome.ok) citations = checkAnswerCitations(answer, snapshot.pageTexts);
    if (outcome.ok && citations.cited) emit("related", { pages: relatedReading(answer, snapshot) });
    // 给了联网工具、一次没用、却说自己联不了网：读者得知道这条回答没有联网核对
    if (outcome.ok && chatOnline({}) && webTools.length === 0 && claimsOffline(answer))
      emit("notice", {
        kind: "offline-claim",
        message:
          "服务端本轮已提供联网工具（WebFetch / WebSearch），模型没有用就说无法联网；这条回答没有经过联网核对。",
      });
    if (outcome.ok && answer.trim() && !res.destroyed)
      answerId = await captureAnswer(root, message, answer, snapshot.pageTexts, outcome.models);
    if (!outcome.ok) emit("error", { message: outcome.reason ?? "agent 失败" });
    if (outcome.ok && !res.destroyed) {
      const signals = coverageSignals(answer, webTools);
      if (signals.length) {
        try {
          const gap = await recordGapObservation(root, {
            eventId: lease.token,
            question: message,
            contextQuestions: lease.contextQuestions,
            revision: snapshot.revision,
            candidates: hits.map((hit) => ({ id: hit.id, score: hit.score, how: hit.how })),
            signals,
          });
          emit("gap", { key: gap.key, count: gap.count, threshold: gap.threshold, state: gap.state });
        } catch (error) {
          emit("gap", { state: "record-failed", reason: String(error) });
        }
      }
    }
  } catch (error) {
    outcome = { ok: false };
    if (res.headersSent) emit("error", { message: String(error) });
    else
      send(res, error instanceof HttpError ? error.status : error instanceof z.ZodError ? 400 : 503, {
        error: String(error),
      });
  } finally {
    if (lease) {
      try {
        await finishChat(root, lease, message, { ...outcome, ok: outcome.ok && !res.destroyed });
      } catch (error) {
        answerId = undefined;
        emit("error", { message: String(error) });
      }
      emit("cite", citations);
      emit("done", { sessionId: lease.id, answerId, revision: lease.revision });
    }
    if (!res.writableEnded) res.end();
  }
  return true;
}
