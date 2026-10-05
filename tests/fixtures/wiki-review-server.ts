import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { listGaps } from "../../scripts/wiki/gap-ledger";
import { captureAnswer, handleAnswers } from "../../server/answers";
import { handleChat } from "../../server/chat-route";
import { handlePages } from "../../server/pages";
import { handleReview } from "../../server/review";
import { readKnowledgeSnapshot } from "../../server/snapshot";
import { handleStatus } from "../../server/status";
import { retrieve } from "../../src/content/wiki/retrieve";

const root = process.argv[2]!;
const answer = "组合诊断：需要比较两个条件，参见 [原有解释](sources/a.md)。";
const answerId = await captureAnswer(root, "如何组合诊断？", answer, [
  { file: "sources/a.md", text: readFileSync(join(root, "wiki/sources/a.md"), "utf8") },
]);
let calls = 0;
const chatCalls: { resumed: boolean; text: string }[] = [];
const server = createServer(async (req, res) => {
  if (req.url === "/test-state") {
    const snapshot = await readKnowledgeSnapshot(root);
    res.end(
      JSON.stringify({
        pages: snapshot.registry.pages.length,
        hit: retrieve("组合诊断", snapshot.index)[0]?.id,
        calls,
        chatCalls,
        gaps: listGaps(root),
      }),
    );
    return;
  }
  if (await handlePages(req, res, root)) return;
  if (await handleStatus(req, res, root)) return;
  if (await handleReview(req, res, root)) return;
  if (
    await handleChat(req, res, root, {
      runChat: async (request, on) => {
        const text = readFileSync(join(request.cwd, "index.md"), "utf8");
        chatCalls.push({ resumed: request.args.includes("--resume"), text });
        on.text(
          request.stdin.startsWith("学习者的问题：未收录概念")
            ? "知识库里还没有这一条。请补充可核对的来源。"
            : request.stdin.startsWith("学习者的问题：检查未绑定引用")
              ? "默认开启 [S1]，见 [原有解释](sources/a.md)。"
              : text.includes("组合诊断")
                ? `已读到发布后的组合诊断，参见 [组合诊断](sources/answer-${answerId}.md)。`
                : answer,
        );
        return { ok: true, sessionId: randomUUID() };
      },
    })
  )
    return;
  if (
    await handleAnswers(req, res, root, {
      runAgent: async (request) => {
        calls++;
        const { material } = JSON.parse(request.stdin);
        return {
          id: request.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0.1,
          output: `---\nid: ${request.id}\ntitle: 组合诊断\ntype: source\nsummary: 比较两个条件\nsources: [${material.source}]\nevidence: I\nupdated: '2026-09-15'\n---\n## 一句话\n比较两个条件，参见 [原有解释](../sources/a.md)。\n`,
        };
      },
    })
  )
    return;
  res.writeHead(404);
  res.end();
});
server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing fixture server");
  console.log(JSON.stringify({ origin: `http://127.0.0.1:${address.port}`, answerId, answer }));
});
