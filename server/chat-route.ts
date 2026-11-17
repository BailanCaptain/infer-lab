import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { z } from "zod";
import { withBudget } from "../scripts/wiki/budget";
import { type ChatTrace, looksLikeError, publicTrace, traceChat } from "../scripts/wiki/chat-trace";
import { attachCorpusProvenance, corpusDocuments } from "../scripts/wiki/corpus-trace";
import { judgeGapIdentity } from "../scripts/wiki/gap-identity";
import { recordGapObservation } from "../scripts/wiki/gap-ledger";
import { answeredBy, modelSwitched } from "../scripts/wiki/model-use";
import { selectedModel as readSelectedModel } from "../scripts/wiki/sync-config";
import type { AnswerQuality } from "../src/content/wiki/answer-quality";
import type { CorpusDocument } from "../src/content/wiki/corpus-retrieve";
import { neighborhood } from "../src/content/wiki/relations";
import { type CitationVerdict, retrieve } from "../src/content/wiki/retrieve";
import { judgeAnswer } from "./answer-quality";
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
import { codexEvidencePages } from "./codex-chat";
import { coverageSignals } from "./coverage";
import { checkWriter, HttpError, parseWikiUrl, readJson, send } from "./http";
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

/** Both production HTTP and fixture browsers use this exact orchestration. */
export async function handleChat(
  req: IncomingMessage,
  res: ServerResponse,
  root: string,
  deps: {
    runChat?: typeof runChat;
    traceChat?: typeof traceChat;
    judgeGap?: typeof judgeGapIdentity;
    judgeAnswer?: typeof judgeAnswer;
  } = {},
): Promise<boolean> {
  const url = parseWikiUrl(req, res);
  if (!url) return true;
  if (url.pathname !== "/api/wiki/chat") return false;
  let lease: ChatLease | undefined;
  let leaseSettled = false;
  let citeEmitted = false;
  let message = "";
  let answer = "";
  let answerId: string | undefined;
  const webTools: { name: string; target?: string }[] = [];
  let citations: CitationVerdict = { cited: false, selfDeclaredUncovered: false, reason: "回答尚未完整核对" };
  let outcome: Awaited<ReturnType<typeof runChat>> = { ok: false };
  const emit = (event: string, data: unknown) => {
    if (!res.destroyed) res.write(sseFrame(event, data));
  };
  const settleLease = async (ok: boolean) => {
    if (!lease || leaseSettled) return;
    leaseSettled = true;
    await finishChat(root, lease, message, { ...outcome, answer, ok });
  };
  // 读者点「停止」= 浏览器断开连接：立刻中止模型，不再质检、不判缺口，会话随即释放
  const cancel = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) cancel.abort();
  });
  try {
    if (req.method !== "POST") throw new HttpError(405, "需要 POST");
    checkWriter(req);
    const input = inputSchema.parse(await readJson(req, 400_000));
    message = input.message;
    const snapshot = await readKnowledgeSnapshot(root);
    cancel.signal.throwIfAborted();
    const selectedModel = readSelectedModel(root);
    // Codex receives immutable page text and runs in its own empty cwd; only Claude reads files.
    const location =
      selectedModel.provider === "claude" ? await materializeSnapshot(root, snapshot) : undefined;
    lease = await beginChat(
      root,
      snapshot.revision,
      input.sessionId,
      `${selectedModel.provider}:${selectedModel.model ?? "default"}`,
    );
    cancel.signal.throwIfAborted();
    const retrievalQuery =
      selectedModel.provider === "codex"
        ? [message, ...lease.contextQuestions.slice(-2)].join("\n")
        : message;
    const context = retrieveChatContext(retrievalQuery, snapshot, corpusDocuments(root));
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
      provider: selectedModel.provider,
    });
    emit("hits", { hits });
    // 贴的是报错才在线查 GitHub（F003 AC4 聊天层接入）；普通提问一个网络请求都不发
    let github: ChatTrace | undefined;
    if (looksLikeError(message)) {
      emit("trace", { status: "searching" });
      try {
        github = await (deps.traceChat ?? traceChat)(root, message, { signal: cancel.signal });
      } catch (error) {
        github = { status: "failed", reason: error instanceof Error ? error.message : String(error) };
      }
      emit("trace", publicTrace(github));
    }
    cancel.signal.throwIfAborted();
    const evidencePages =
      selectedModel.provider === "codex"
        ? codexEvidencePages(
            [
              ...new Set([
                ...hits.map((h) => h.id),
                ...graph.flatMap((g) =>
                  [
                    ...g.neighborhood.foundations,
                    ...g.neighborhood.dependents,
                    ...g.neighborhood.siblings,
                  ].map((edge) => edge.id),
                ),
              ]),
            ].flatMap((id) => {
              const file = snapshot.registry.pages.find((p) => p.id === id)?.file;
              return snapshot.pageTexts.filter((p) => p.file === file);
            }),
          )
        : snapshot.pageTexts;
    const request = buildChatRequest(
      {
        message,
        ...(lease.agentSessionId ? { sessionId: lease.agentSessionId } : {}),
        previousQuestions: lease.previousQuestions,
        ...(!lease.agentSessionId
          ? { previousTurns: lease.contextTurns, historyOmitted: lease.historyOmitted }
          : {}),
        hits,
        graph,
        citationGuide: context.citationGuide,
        ...(github && github.status !== "skipped" ? { github } : {}),
      },
      snapshot.handbook,
      {
        wikiRoot: location ?? join(root, "wiki"),
        revision: snapshot.revision,
        timeoutMs: CHAT_TIMEOUT_MS,
        ...selectedModel,
        pages: evidencePages,
      },
    );
    const execute: typeof runChat =
      deps.runChat ?? ((req, on) => withBudget(root, "chat", req, (bounded) => runChat(bounded, on)));
    outcome = await execute(
      { ...request, signal: cancel.signal },
      {
        text: (text) => {
          answer += text;
          emit("text", { text });
        },
        tool: (name, target) => {
          if ((name === "WebFetch" || name === "WebSearch") && webTools.length < 20)
            webTools.push({ name, ...(target ? { target } : {}) });
          emit("tool", { name, target });
        },
      },
    );
    // 失败的轮次也发：拒答换手常常就出在这种时候
    if (outcome.models)
      emit("model", {
        provider: selectedModel.provider,
        ...(outcome.models.requested ? { requested: outcome.models.requested } : {}),
        answeredBy:
          selectedModel.provider === "codex" ? outcome.models.answered.at(-1) : answeredBy(outcome.models),
        switched: modelSwitched(outcome.models),
        switches: outcome.models.switches,
      });
    if (cancel.signal.aborted) outcome = { ...outcome, ok: false, reason: "已取消" };
    if (location) verifySnapshot(root, location, snapshot);
    if (outcome.ok && !answer.trim()) outcome = { ok: false, reason: "问答没有返回正文" };
    if (outcome.ok) citations = checkAnswerCitations(answer, evidencePages);
    if (outcome.ok && citations.cited) emit("related", { pages: relatedReading(answer, snapshot) });
    // 给了联网工具、一次没用、却说自己联不了网：读者得知道这条回答没有联网核对
    if (outcome.ok && chatOnline({}) && webTools.length === 0 && claimsOffline(answer))
      emit("notice", {
        kind: "offline-claim",
        message:
          "服务端本轮已启用联网工具，但未记录到联网调用。回答中“工具不可用”的说法尚未核实，外部结论尚未完成联网核对。",
      });
    if (!outcome.ok) emit("error", { message: outcome.reason ?? "agent 失败" });
    if (outcome.ok && lease) {
      // 主回答与快照校验已完成：立即持久化对话轮次并释放会话租约，随后再进入独立质检与缺口归并
      await settleLease(true);
      citeEmitted = true;
      emit("cite", citations);
      emit("persisted", { sessionId: lease.id, revision: lease.revision });
    }
    if (outcome.ok && !res.destroyed && !cancel.signal.aborted) {
      let quality: AnswerQuality;
      emit("quality", { status: "checking" });
      try {
        quality = await (deps.judgeAnswer ?? judgeAnswer)(root, {
          question: message,
          observationId: lease.token,
          contextQuestions: lease.contextQuestions,
          contextTurns: lease.contextTurns,
          answer,
          snapshot,
          evidencePages,
          selection: selectedModel,
          signal: cancel.signal,
        });
      } catch (error) {
        quality = { status: "unavailable", reason: String(error) };
      }
      cancel.signal.throwIfAborted();
      emit("quality", quality);
      const signals = coverageSignals(answer, webTools).filter(
        (signal) =>
          !(
            quality.status === "checked" &&
            quality.decision.satisfied === true &&
            signal.kind === "agent-uncovered"
          ),
      );
      if (
        !res.destroyed &&
        !cancel.signal.aborted &&
        !(quality.status === "checked" && quality.decision.satisfied === false) &&
        !signals.some((signal) => signal.kind === "agent-uncovered")
      )
        answerId = await captureAnswer(root, message, answer, evidencePages, outcome.models);
      if (quality.status === "checked" && quality.decision.satisfied !== true) {
        signals.unshift({
          kind: "independent-review",
          decision: quality.jobId,
          reason: `${quality.decision.classification}：${quality.decision.reason}`.slice(0, 2000),
        });
        signals.splice(21);
      }
      if (signals.length && !cancel.signal.aborted) {
        try {
          // 说法不同的同一问要归进已有缺口；判定失败（预算暂停、模型出错）就照旧新建一条，不丢这次记录
          const question = { question: message, contextQuestions: lease.contextQuestions };
          const sameAs = await (deps.judgeGap ?? judgeGapIdentity)(root, {
            ...question,
            signal: cancel.signal,
          }).catch(() => undefined);
          cancel.signal.throwIfAborted();
          const gap = await recordGapObservation(
            root,
            {
              eventId: lease.token,
              ...question,
              revision: snapshot.revision,
              candidates: hits.map((hit) => ({ id: hit.id, score: hit.score, how: hit.how })),
              signals,
            },
            undefined,
            sameAs,
          );
          emit("gap", { key: gap.key, count: gap.pendingCount, threshold: gap.threshold, state: gap.state });
        } catch (error) {
          emit("gap", { state: "record-failed", reason: String(error) });
        }
      }
    }
  } catch (error) {
    if (!leaseSettled) outcome = { ok: false };
    if (res.headersSent) {
      if (!cancel.signal.aborted) emit("error", { message: String(error) });
    } else
      send(res, error instanceof HttpError ? error.status : error instanceof z.ZodError ? 400 : 503, {
        error: String(error),
      });
  } finally {
    if (lease) {
      if (!leaseSettled) {
        try {
          await settleLease(false);
        } catch (error) {
          answerId = undefined;
          emit("error", { message: String(error) });
        }
      }
      if (!citeEmitted) emit("cite", citations);
      emit("done", { sessionId: lease.id, answerId, revision: lease.revision });
    }
    if (!res.writableEnded) res.end();
  }
  return true;
}
