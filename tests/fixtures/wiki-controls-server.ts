/** Real HTTP/control/CLI paths, isolated knowledge and a deterministic local child instead of a paid model. */
import { randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createServer, request } from "node:http";
import { join } from "node:path";
import type { AgentRequest } from "../../scripts/wiki/batch";
import { spawnClaude } from "../../scripts/wiki/claude-cli";
import { listBatches } from "../../scripts/wiki/drop-batch";
import { judgeGapIdentity } from "../../scripts/wiki/gap-identity";
import { recordGapObservation } from "../../scripts/wiki/gap-ledger";
import { handbookFixture, wikiFixture } from "../../scripts/wiki/test-fixture";
import { judgeAnswer } from "../../server/answer-quality";
import { handleChat } from "../../server/chat-route";
import { handleDrop } from "../../server/drop";
import { handlePages } from "../../server/pages";
import { handleReview } from "../../server/review";
import { dropBrowserAgent } from "./drop-browser-agent";

const fixture = wikiFixture();
const root = fixture.root;
fixture.write("wiki/HANDBOOK.md", handbookFixture());
fixture.write("wiki/log.md", "# log\n");
fixture.write(
  "wiki/sources/a.md",
  "---\nid: a\ntitle: 控制验收资料\ntype: source\nsummary: 隔离验收\nsources: [https://docs.vllm.ai/en/latest/]\nevidence: S\nupdated: '2026-11-10'\n---\n## 验收说明\n默认值为 1。这里的操作只影响隔离测试库。\n",
);
await recordGapObservation(root, {
  eventId: randomUUID(),
  question: "既有缺口",
  contextQuestions: [],
  revision: "a".repeat(64),
  candidates: [],
  signals: [{ kind: "agent-uncovered", reason: "已有问题" }],
});
const children: { stage: string; pid: number; finished: boolean; cancelled: boolean }[] = [];
const childResults: unknown[] = [];
let dropMode = "repair";
let generateCalls = 0;
async function waitModel(req: AgentRequest, stage: string) {
  let entry: (typeof children)[number] | undefined;
  const result = await spawnClaude(
    {
      ...req,
      args: ["-e", "process.stdout.write(String(process.pid)+'\\n');setInterval(()=>{},1000)"],
      timeoutMs: 30_000,
    },
    (line) => {
      if (!entry && /^\d+$/.test(line)) {
        entry = { stage, pid: Number(line), finished: false, cancelled: false };
        children.push(entry);
      }
      return undefined;
    },
    { command: process.execPath, shell: false },
  );
  if (entry) {
    entry.finished = true;
    entry.cancelled = !!req.signal?.aborted;
  }
  childResults.push({ stage, ...result });
  return { ...result, costUsd: 0 };
}
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname === "/test-state") {
    const dir = join(root, "wiki/_jobs/chat-sessions");
    const sessions = existsSync(dir)
      ? readdirSync(dir)
          .filter((f) => f.endsWith(".json"))
          .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")))
      : [];
    res.end(
      JSON.stringify({
        children,
        childResults,
        generateCalls,
        dropMode,
        activeSessions: sessions.filter((s) => s.active).length,
        batches: listBatches(root),
      }),
    );
    return;
  }
  if (url.pathname === "/test/drop-mode" && req.method === "POST") {
    dropMode = url.searchParams.get("value") ?? "normal";
    res.end("ok");
    return;
  }
  if (
    await handleChat(req, res, root, {
      runChat: async (input, on) => {
        on.text(
          input.stdin.includes("缺口时停止")
            ? "知识库里还没有这一条。"
            : "默认值为 1，见 [资料](sources/a.md)。",
        );
        if (input.stdin.includes("生成时停止")) return waitModel(input, "answer");
        return { ok: true, sessionId: randomUUID() };
      },
      judgeAnswer: async (r, input) =>
        input.question === "核对时停止"
          ? judgeAnswer(r, input, { runAgent: (req) => waitModel(req, "quality") })
          : {
              status: "checked",
              jobId: "d".repeat(64),
              revision: input.snapshot.revision,
              decision: {
                satisfied: input.question === "缺口时停止" ? null : true,
                classification: input.question === "缺口时停止" ? "undetermined" : "covered",
                reason: "隔离验收结果",
                answerQuote: "",
                evidence: [],
              },
            },
      judgeGap: (r, input) => judgeGapIdentity(r, input, { runAgent: (req) => waitModel(req, "gap") }),
    })
  )
    return;
  if (
    await handleDrop(req, res, root, {
      runAgent: async (input) => {
        const data = JSON.parse(input.stdin);
        if (data.mode === "drop-generate") {
          generateCalls++;
          if (dropMode === "wait") return waitModel(input, "drop");
          if (dropMode === "repair")
            return {
              id: input.id,
              ok: true,
              exitCode: 0,
              costUsd: 0,
              stderrTail: "",
              output: JSON.stringify({
                text: generateCalls,
                diagrams: Array.from({ length: generateCalls }, () => 0),
                revision: null,
              }),
            };
        }
        return dropBrowserAgent(input);
      },
    })
  )
    return;
  if (await handleReview(req, res, root)) return;
  if (await handlePages(req, res, root)) return;
  if (url.pathname.startsWith("/api/")) {
    res.writeHead(404);
    res.end();
    return;
  }
  const proxy = request(
    {
      hostname: "127.0.0.1",
      port: Number(process.env.WIKI_TEST_WEB_PORT ?? 5193),
      path: req.url,
      method: req.method,
      headers: req.headers,
    },
    (upstream) => {
      res.writeHead(upstream.statusCode ?? 502, upstream.headers);
      upstream.pipe(res);
    },
  );
  proxy.on("error", () => {
    res.writeHead(502);
    res.end("Frontend unavailable");
  });
  req.pipe(proxy);
});
server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  if (address && typeof address !== "string")
    console.log(JSON.stringify({ origin: `http://127.0.0.1:${address.port}`, root }));
});
process.on("SIGTERM", () =>
  server.close(() => {
    fixture.cleanup();
    process.exit(0);
  }),
);
