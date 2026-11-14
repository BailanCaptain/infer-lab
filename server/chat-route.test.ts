import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import type { ChatTrace, traceChat } from "../scripts/wiki/chat-trace";
import type { judgeGapIdentity } from "../scripts/wiki/gap-identity";
import { listGaps } from "../scripts/wiki/gap-ledger";
import { handbookFixture, wikiFixture } from "../scripts/wiki/test-fixture";
import type { judgeAnswer } from "./answer-quality";
import { judgeAnswer as reviewAnswer } from "./answer-quality";
import type { runChat } from "./chat";
import { handleChat } from "./chat-route";
import { CODEX_EVIDENCE_LIMIT } from "./codex-chat";

const fixtures: ReturnType<typeof wikiFixture>[] = [];
const servers: Server[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const f of fixtures.splice(0)) f.cleanup();
});
const original =
  "---\nid: a\ntitle: A\ntype: source\nsummary: 默认值为 1\nsources: [https://docs.vllm.ai/en/latest/]\nevidence: S\nupdated: '2026-09-15'\n---\n## 一句话\n默认值为 1。\n";
async function setup(
  run: typeof runChat,
  extra: {
    traceChat?: typeof traceChat;
    judgeGap?: typeof judgeGapIdentity;
    judgeAnswer?: typeof judgeAnswer;
  } = {},
) {
  const f = wikiFixture();
  fixtures.push(f);
  f.write("wiki/HANDBOOK.md", handbookFixture());
  f.write("wiki/sources/a.md", original);
  const server = createServer((req, res) => {
    void handleChat(req, res, f.root, {
      runChat: run,
      judgeAnswer: async () => {
        throw new Error("fixture judge unavailable");
      },
      ...extra,
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing server");
  const request = (body: unknown) =>
    fetch(`http://127.0.0.1:${address.port}/api/wiki/chat`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-wiki-review": "1" },
      body: JSON.stringify(body),
    });
  return { ...f, request, url: `http://127.0.0.1:${address.port}/api/wiki/chat` };
}

const unauthorizedRequests: { headers: Record<string, string>; status: number }[] = [
  { headers: { "content-type": "text/plain", origin: "https://untrusted.example", "sec-fetch-site": "cross-site" }, status: 403 },
  { headers: { "content-type": "application/json" }, status: 403 },
  { headers: { "content-type": "text/plain", "x-wiki-review": "1" }, status: 415 },
  { headers: { "content-type": "application/json", "x-wiki-review": "1", origin: "https://untrusted.example" }, status: 403 },
];
it.each(unauthorizedRequests)("rejects unauthorized chat writes before model or state activity: $headers", async ({ headers, status }) => {
  let calls = 0;
  const f = await setup(async () => {
    calls++;
    return { ok: false, reason: "This request must not run a model" };
  });
  const response = await fetch(f.url, { method: "POST", headers, body: JSON.stringify({ message: "A 是什么？" }) });
  await response.text();
  expect(response.status).toBe(status);
  expect(calls).toBe(0);
  expect(existsSync(join(f.root, "wiki/_jobs"))).toBe(false);
});
const frame = (body: string, event: string) => {
  const value = body
    .split("\n\n")
    .find((part) => part.startsWith(`event: ${event}\n`))
    ?.split("\ndata: ")[1];
  return value ? JSON.parse(value) : undefined;
};

const traceFrames = (body: string) =>
  body
    .split("\n\n")
    .filter((part) => part.startsWith("event: trace\n"))
    .map((part) => JSON.parse(part.split("\ndata: ")[1]!));

it("independently detects a confidently wrong cited answer and queues it without offering save", async () => {
  let checked = 0;
  const f = await setup(
    async (_req, on) => {
      on.text(
        '默认值为 2，见 [A](sources/a.md)。<!-- wiki-coverage: {"satisfied":true,"reason":"已覆盖"} -->',
      );
      return { ok: true };
    },
    {
      judgeAnswer: async (_root, input) => {
        checked++;
        expect(input.answer).toContain("默认值为 2");
        expect(input.snapshot.pageTexts[0]!.text).toContain("默认值为 1");
        return {
          status: "checked",
          jobId: "d".repeat(64),
          revision: input.snapshot.revision,
          decision: {
            satisfied: false,
            classification: "answer-error",
            reason: "回答把 1 写成 2",
            answerQuote: "默认值为 2",
            evidence: [{ pageId: "a", quote: "默认值为 1。" }],
          },
        };
      },
    },
  );
  const body = await (await f.request({ message: "A 默认值？" })).text();
  expect(checked).toBe(1);
  expect(frame(body, "quality")).toMatchObject({ status: "checking" });
  expect(body).toContain('"classification":"answer-error"');
  expect(frame(body, "done").answerId).toBeUndefined();
  expect(listGaps(f.root)[0]!.occurrences[0]!.signals).toContainEqual(
    expect.objectContaining({ kind: "independent-review", decision: "d".repeat(64) }),
  );
});

it("does not trust an answer's uncovered marker over a completed independent judgment", async () => {
  const f = await setup(
    async (_req, on) => {
      on.text(
        '默认值为 1，见 [A](sources/a.md#一句话)。<!-- wiki-coverage: {"satisfied":false,"reason":"不确定"} -->',
      );
      return { ok: true };
    },
    {
      judgeAnswer: async (_root, input) => ({
        status: "checked",
        jobId: "d".repeat(64),
        revision: input.snapshot.revision,
        decision: {
          satisfied: true,
          classification: "covered",
          reason: "正文支持",
          answerQuote: "默认值为 1",
          evidence: [{ pageId: "a", quote: "默认值为 1。" }],
        },
      }),
    },
  );
  const body = await (await f.request({ message: "A 默认值？" })).text();
  expect(frame(body, "gap")).toBeUndefined();
  expect(frame(body, "cite").cited).toBe(true);
  expect(frame(body, "done").answerId).toEqual(expect.any(String));
  expect(listGaps(f.root)).toEqual([]);
});

it("does not validate or save a Codex citation to a page omitted from its evidence window", async () => {
  const f = await setup(async (_req, on) => {
    on.text("默认值为 1，见 [A](sources/a.md)。");
    return { ok: true };
  });
  f.write("wiki/sync.config.local.json", JSON.stringify({ chatProvider: "codex" }));
  f.write("wiki/sources/a.md", original + "\n" + "x".repeat(CODEX_EVIDENCE_LIMIT + 1));
  const response = await (await f.request({ message: "A 的默认值？" })).text();
  expect(frame(response, "cite").cited).toBe(false);
  expect(frame(response, "done").answerId).toBeUndefined();
});

it("keeps the prior assistant's checks available to a Codex follow-up and its independent review", async () => {
  const firstQuestion = "A 的现场性能怎么排查？";
  const firstAnswer = "第一步对齐请求。第二步核对 check-anchor-1101 对应的提交与完成记录。见 [A](sources/a.md)。";
  const prompts: string[] = [];
  const reviews: unknown[] = [];
  const f = await setup(
    async (req, on) => {
      prompts.push(req.stdin ?? "");
      on.text(prompts.length === 1 ? firstAnswer : "这些记录已齐，继续依据 [A](sources/a.md) 判读。");
      return { ok: true };
    },
    {
      judgeAnswer: async (_root, input) => {
        reviews.push(input);
        return {
          status: "checked",
          jobId: "d".repeat(64),
          revision: input.snapshot.revision,
          decision: {
            satisfied: true,
            classification: "covered",
            reason: "fixture judgment; this test checks context transport, not answer quality",
            answerQuote: "",
            evidence: [{ pageId: "a", quote: "默认值为 1。" }],
          },
        };
      },
    },
  );
  f.write("wiki/sync.config.local.json", JSON.stringify({ chatProvider: "codex" }));
  const first = await (await f.request({ message: firstQuestion })).text();
  const sessionId = frame(first, "done").sessionId;
  const second = await (await f.request({ message: "你刚才第二步的记录齐了，接下来怎么判断？", sessionId })).text();
  expect(frame(second, "error")).toBeUndefined();
  expect(frame(second, "done").sessionId).toBe(sessionId);
  expect(prompts).toHaveLength(2);
  expect.soft(prompts[1]).toContain(JSON.stringify(firstAnswer));
  expect.soft(reviews[1]).toMatchObject({ contextTurns: [{ question: firstQuestion, answer: firstAnswer }] });
});

it.each([false, true])("Codex uses pinned injected evidence without an unused filesystem snapshot (live edit: %s)", async (edited) => {
  const f = await setup(async (req, on) => {
    expect(req.provider).toBe("codex");
    expect(req.stdin).toContain("默认值为 1");
    expect(existsSync(join(f.root, "tools/wiki-runtime/knowledge"))).toBe(false);
    // Live edits after request construction must not replace this answer's evidence.
    if (edited) f.write("wiki/sources/a.md", original.replaceAll("默认值为 1", "默认值为 2"));
    on.text("默认值为 1，见 [A](sources/a.md)。");
    return { ok: true };
  });
  f.write("wiki/sync.config.local.json", JSON.stringify({ chatProvider: "codex" }));
  const body = await (await f.request({ message: "A 默认值？" })).text();
  expect(frame(body, "error")).toBeUndefined();
  expect(frame(body, "cite").cited).toBe(true);
  // A changed live page still prevents saving the old revision, as on the Claude path.
  if (edited) expect(frame(body, "done").answerId).toBeUndefined();
  else expect(frame(body, "done").answerId).toEqual(expect.any(String));
});

it("贴报错时把 GitHub 在线候选推给界面、交给问答模型；普通提问不去查（F003 AC4 聊天层接入）", async () => {
  const REPO = "vllm-project/vllm-ascend";
  const trace: ChatTrace = {
    status: "done",
    scope: { repos: [REPO], since: "2025-09-23", terms: ["RuntimeError collective failed"] },
    candidates: [
      {
        repo: REPO,
        number: 15815,
        kind: "issue",
        url: `https://github.com/${REPO}/issues/15815`,
        title: "RuntimeError: collective failed on 8 cards",
        state: "closed",
        updatedAt: "2026-09-12T00:00:00Z",
        matchedQueries: 1,
        excerpt: "8 卡跑起来就崩",
        linkedPrs: [
          {
            number: 15981,
            url: `https://github.com/${REPO}/pull/15981`,
            basis: "GitHub cross-referenced 事件；不是修复证明",
            versions: {
              status: "found",
              commit: "a".repeat(40),
              pins: [
                { ref: "releases/v0.26.0rc", commit: "b".repeat(40), contains: true },
                {
                  ref: "releases/v0.23.0",
                  commit: "c".repeat(40),
                  contains: false,
                  sameNumberCommit: "d".repeat(40),
                },
              ],
              tags: ["v0.26.0rc2"],
              moreTags: 0,
            },
          },
        ],
      },
    ],
    omitted: 0,
    complete: true,
    problems: [],
    requests: 4,
    cacheHits: 0,
  };
  let stdin = "";
  const traced: string[] = [];
  const f = await setup(
    async (req, on) => {
      stdin = req.stdin;
      on.text("社区里有人报过，见 issue。");
      return { ok: true, sessionId: randomUUID() };
    },
    {
      traceChat: async (_root, message) => {
        traced.push(message);
        return trace;
      },
    },
  );
  const body = await (await f.request({ message: "RuntimeError: collective failed on 8 cards" })).text();
  const frames = traceFrames(body);
  expect(frames[0]).toEqual({ status: "searching" });
  expect(frames.at(-1)).toMatchObject({ status: "done", candidates: [{ number: 15815 }] });
  // 界面拿到的是能点开核对的东西；社区正文摘录只给问答模型
  expect(frames.at(-1).candidates[0]).not.toHaveProperty("excerpt");
  expect(stdin).toContain(`https://github.com/${REPO}/issues/15815`);
  expect(stdin).toContain("不是已确认的根因或修复");
  expect(stdin).toContain("releases/v0.26.0rc 钉点 bbbbbbbb 包含");
  expect(stdin).toContain("同号提交 dddddddd");
  expect(stdin).toContain("尚未收录为 Wiki 结论");

  const plain = await (await f.request({ message: "KV Cache 是什么" })).text();
  expect(traceFrames(plain)).toEqual([]);
  expect(traced).toEqual(["RuntimeError: collective failed on 8 cards"]);
});

it("在线搜索失败时告诉问答模型「失败」而不是「没有相关 issue」", async () => {
  let stdin = "";
  const f = await setup(
    async (req, on) => {
      stdin = req.stdin;
      on.text("在线搜索暂时失败。");
      return { ok: true, sessionId: randomUUID() };
    },
    {
      traceChat: async () => ({
        status: "failed",
        reason: "GitHub rate-limit (403)",
        scope: { repos: ["vllm-project/vllm-ascend"], since: "2025-09-23", terms: ["RuntimeError"] },
      }),
    },
  );
  const body = await (await f.request({ message: "RuntimeError: collective failed" })).text();
  expect(traceFrames(body).at(-1)).toMatchObject({ status: "failed", reason: "GitHub rate-limit (403)" });
  expect(stdin).toContain("搜索失败：GitHub rate-limit (403)");
  expect(stdin).toContain("不要据此说社区没有相关 issue");
});

it("records repeated uncovered answers and returns an honest assessment status without extra model calls", async () => {
  let calls = 0;
  const f = await setup(async (_req, on) => {
    calls++;
    on.text("知识库里还没有这一条。");
    return { ok: true, sessionId: randomUUID() };
  });
  let sessionId: string | undefined;
  for (let i = 1; i <= 3; i++) {
    const response = await (await f.request({ message: "chunk_config main 怎么配置？", sessionId })).text();
    expect(frame(response, "gap")).toMatchObject({
      count: i,
      state: i === 3 ? "awaiting-assessment" : "collecting",
    });
    sessionId = frame(response, "done").sessionId;
  }
  expect(calls).toBe(3);
  expect(listGaps(f.root)).toHaveLength(1);
  expect(listGaps(f.root)[0]!.occurrences[0]!.revision).toHaveLength(64);
});

it("supplies snapshot-bound copyable citations to the real chat request", async () => {
  let stdin = "";
  const f = await setup(async (req, on) => {
    stdin = req.stdin;
    on.text("默认值为 1，见 [a](sources/a.md)。");
    return { ok: true, sessionId: randomUUID() };
  });
  f.write("wiki/sources/a.md", original.replace("默认值为 1。", "默认值为 1 [S1]。"));
  await (await f.request({ message: "A 的默认值？" })).text();
  expect(stdin).toContain("[a](sources/a.md)");
  expect(stdin).not.toContain("[S1](sources/a.md)");
  expect(stdin).toContain("手册「查询」规则");
  expect(stdin).not.toContain("[C1](sources/a.md)");
});

it("records web verification as an attempt even when the answer uses an existing page", async () => {
  const f = await setup(async (_req, on) => {
    on.tool?.("WebFetch", "https://docs.vllm.ai/");
    on.text("默认值为 1，见 [A](sources/a.md)。");
    return { ok: true, sessionId: randomUUID() };
  });
  const response = await (await f.request({ message: "A 的默认值？" })).text();
  expect(frame(response, "done").answerId).toBeTruthy();
  expect(listGaps(f.root)[0]).toMatchObject({ assessment: "unassessed", count: 1 });
  expect(listGaps(f.root)[0]!.occurrences[0]!.signals[0]).toMatchObject({
    kind: "web-attempt",
    tool: "WebFetch",
  });
});

it("failed answers do not record a completed observation, and ledger failure does not lose an answer", async () => {
  const f = await setup(async (_req, on) => {
    on.text("知识库里还没有这一条。");
    return { ok: false, reason: "interrupted" };
  });
  const failed = await (await f.request({ message: "A？" })).text();
  expect(frame(failed, "gap")).toBeUndefined();
  expect(listGaps(f.root)).toEqual([]);
  const g = await setup(async (_req, on) => {
    on.text("知识库里还没有这一条。");
    return { ok: true, sessionId: randomUUID() };
  });
  g.write("wiki/_gaps.json", "damaged");
  const completed = await (await g.request({ message: "A？" })).text();
  expect(frame(completed, "gap").state).toBe("record-failed");
  expect(frame(completed, "error")).toBeUndefined();
  expect(frame(completed, "done").sessionId).toBeTruthy();
});

it.each([
  ["虚构链接", "见 [不存在](sources/missing.md)。", "当前知识版本"],
  ["未收录不能掩盖坏链接", "尚未收录。见 [不存在](sources/missing.md)。", "当前知识版本"],
  ["未绑定来源页", "默认值为 1 [S1]，见 [A](sources/a.md)。", "所属页"],
  ["伪造源码证据", "默认值为 1 [C1](sources/a.md)。", "没有该证据标记"],
  ["推断不能编号", "默认值为 1 [I1](sources/a.md)。", "不能带来源编号"],
])("%s 会显示引用失败并关闭保存", async (_name, answer, reason) => {
  const f = await setup(async (_req, on) => {
    on.text(answer);
    return { ok: true, sessionId: randomUUID() };
  });
  const response = await (await f.request({ message: "默认值？" })).text();
  expect(frame(response, "cite")).toMatchObject({ cited: false, reason: expect.stringContaining(reason) });
  expect(frame(response, "done").answerId).toBeUndefined();
});

it("real HTTP turns freeze file reads and stop resuming the old model session after an update", async () => {
  let count = 0;
  const nativeId = randomUUID();
  const f = await setup(async (req, on) => {
    count++;
    expect(req.cwd).not.toBe(join(f.root, "wiki"));
    expect(req.args).toContain("--restricted");
    expect(req.args).toContain("--safe-mode");
    if (count === 1) {
      expect(req.args).not.toContain("--resume");
      f.write("wiki/sources/a.md", original.replaceAll("默认值为 1", "默认值为 2"));
      expect(readFileSync(join(req.cwd, "sources/a.md"), "utf8")).toBe(original);
      on.text("默认值为 1，见 [A](sources/a.md)。");
    } else {
      expect(readFileSync(join(req.cwd, "sources/a.md"), "utf8")).toContain("默认值为 2");
      if (count === 2) {
        expect(req.args).not.toContain("--resume");
        expect(req.stdin).toContain("A 的默认值？");
        expect(req.stdin).not.toContain("默认值为 1");
      } else {
        expect(req.args[req.args.indexOf("--resume") + 1]).toBe(nativeId);
        expect(req.args).toContain("--fork-session");
      }
      on.text("默认值为 2，见 [A](sources/a.md)。");
    }
    return { ok: true, sessionId: nativeId };
  });
  const first = await (await f.request({ message: "A 的默认值？" })).text();
  const id = frame(first, "done").sessionId;
  expect(frame(first, "done").answerId).toBeUndefined();
  const second = await (await f.request({ message: "现在呢？", sessionId: id })).text();
  expect(frame(second, "knowledge").resetReason).toBe("knowledge-updated");
  expect(frame(second, "knowledge").revision).not.toBe(frame(first, "knowledge").revision);
  expect(frame(second, "done").answerId).toMatch(/^[a-f0-9]{64}$/);
  const third = await (await f.request({ message: "再解释一次", sessionId: id })).text();
  expect(frame(third, "knowledge").resetReason).toBeUndefined();
  expect(count).toBe(3);
});

it("a modified execution snapshot fails the turn and does not offer save", async () => {
  const f = await setup(async (req, on) => {
    writeFileSync(join(req.cwd, "sources/a.md"), original.replace("默认值为 1", "篡改"));
    on.text("见 [A](sources/a.md)。");
    return { ok: true, sessionId: randomUUID() };
  });
  const response = await (await f.request({ message: "A？" })).text();
  expect(frame(response, "error").message).toContain("快照");
  expect(frame(response, "done").answerId).toBeUndefined();
});

it.each([
  "本轮没有联网工具，只能读快照；知识库里还没有这一条。",
  "本轮联网核查工具也不可用，因此退出原因尚未核实。",
])("flags an unverified offline claim without asserting why no web call was recorded: %s", async (answer) => {
  // 2026-09-23 实测：服务端每轮都给了 WebFetch / WebSearch，模型却有几轮说「本轮没有联网工具」。用户得知道。
  const f = await setup(async (_req, on) => {
    on.text(answer);
    return { ok: true, sessionId: randomUUID() };
  });
  const response = await (await f.request({ message: "HCCL 缓冲区怎么定？" })).text();
  expect(frame(response, "knowledge")).toMatchObject({ online: true });
  expect(frame(response, "notice")).toMatchObject({ kind: "offline-claim" });
  expect(frame(response, "notice").message).toContain("未记录到联网调用");
  expect(frame(response, "notice").message).toContain("说法尚未核实");
  const used = await setup(async (_req, on) => {
    on.tool?.("WebFetch", "https://docs.vllm.ai/");
    on.text("本轮没有联网工具？不，我查到了：默认值为 1，见 [A](sources/a.md)。");
    return { ok: true, sessionId: randomUUID() };
  });
  const second = await (await used.request({ message: "A 的默认值？" })).text();
  expect(second).not.toContain("event: notice");
});

it("标出实际作答模型：换了模型要推给界面，也写进问答记录；配置了 chatModel 就固定它", async () => {
  // 2026-09-23 实遇：8 个问答会话全被 Opus 5.5 以 frontier_llm 拒答、换 Opus 5 作答，界面上看不出来
  const models = {
    requested: "claude-opus-5-5[1m]",
    answered: ["claude-opus-5"],
    switches: [
      {
        event: "model_refusal_fallback",
        from: "claude-opus-5-5[1m]",
        to: "claude-opus-5",
        reason: "frontier_llm",
      },
    ],
  };
  let args: string[] = [];
  const f = await setup(async (req, on) => {
    args = req.args;
    on.text("默认值为 1，见 [A](sources/a.md)。");
    return { ok: true, sessionId: randomUUID(), models };
  });
  const response = await (await f.request({ message: "A 的默认值？" })).text();
  expect(args[args.indexOf("--model") + 1]).toBe("claude-opus-5-5[1m]");
  expect(frame(response, "model")).toEqual({
    provider: "claude",
    requested: "claude-opus-5-5[1m]",
    answeredBy: "claude-opus-5",
    switched: true,
    switches: models.switches,
  });
  const answerId = frame(response, "done").answerId as string;
  expect(JSON.parse(readFileSync(join(f.root, `wiki/_jobs/answers/${answerId}.json`), "utf8")).model).toEqual(
    models,
  );

  f.write("wiki/sync.config.local.json", JSON.stringify({ chatModel: "claude-fable-5-1" }));
  await (await f.request({ message: "A 的默认值？" })).text();
  expect(args[args.indexOf("--model") + 1]).toBe("claude-fable-5-1");
});

it("Codex receives current page bodies and follow-up context, without resuming Claude or launching a hidden Claude judge", async () => {
  const requests: Parameters<typeof runChat>[0][] = [];
  let judges = 0;
  const f = await setup(
    async (req, on) => {
      requests.push(req);
      on.text("默认值为 1，见 [A](sources/a.md)。");
      return {
        ok: true,
        ...(req.provider === "codex"
          ? { models: { requested: "gpt-6.1-sol", answered: [], switches: [] } }
          : { sessionId: randomUUID() }),
      };
    },
    {
      judgeGap: async () => {
        judges++;
        return undefined;
      },
    },
  );
  const first = await (await f.request({ message: "A 的默认值？" })).text();
  const sessionId = frame(first, "done").sessionId;
  f.write("wiki/sync.config.local.json", JSON.stringify({ chatProvider: "codex", chatModel: "gpt-6.1-sol" }));
  const second = await (await f.request({ message: "A 的默认值为何？", sessionId })).text();
  expect(requests[1].provider).toBe("codex");
  expect(requests[1].stdin).toContain("默认值为 1");
  expect(requests[1].stdin).toContain("A 的默认值？");
  expect(requests[1].args).not.toContain("--resume");
  expect(frame(second, "knowledge").resetReason).toBe("model-changed");
  expect(frame(second, "done").answerId).toBeTruthy();
  expect(frame(second, "model").requested).toBe("gpt-6.1-sol");
  expect(frame(second, "model").answeredBy).toBeUndefined();
  await (await f.request({ message: "还有其他限制吗？", sessionId })).text();
  expect(requests[2].stdin).toContain("A 的默认值为何？");
  expect(requests[2].stdin).toContain("默认值为 1");
  expect(judges).toBe(0);
});

it("说法不同的缺口按判定归进已有那条；判定失败照旧新建一条，不丢记录", async () => {
  // 用户 09-23 定「说法不同、问的是同一件事也算同一题」
  let fail = false;
  const f = await setup(
    async (_req, on) => {
      on.text("知识库里还没有这一条。");
      return { ok: true, sessionId: randomUUID() };
    },
    {
      judgeGap: async (root, input) => {
        const gaps = listGaps(root);
        if (!gaps.length || gaps.some((g) => g.question === input.question)) return undefined;
        if (fail) throw new Error("共享预算已暂停");
        return { entryKey: gaps[0]!.key, decision: "d".repeat(64) };
      },
    },
  );
  await (await f.request({ message: "chunk_config 在 main 上默认开启吗？" })).text();
  const second = await (await f.request({ message: "main 分支里 chunk_config 是不是默认就打开的？" })).text();
  expect(frame(second, "gap")).toMatchObject({ count: 2, state: "collecting" });
  expect(listGaps(f.root)).toHaveLength(1);
  fail = true;
  const third = await (await f.request({ message: "KV_CACHE_DTYPE 默认是什么？" })).text();
  expect(frame(third, "gap")).toMatchObject({ count: 1 });
  expect(listGaps(f.root)).toHaveLength(2);
});

it("客户端断开（点停止）时中止模型调用、跳过质检与缺口判定，并立即释放会话", async () => {
  let calls = 0;
  let judged = 0;
  let gapJudged = 0;
  let signal: AbortSignal | undefined;
  let started!: () => void;
  const running = new Promise<void>((resolve) => {
    started = resolve;
  });
  let modelDone: Promise<void> = Promise.resolve();
  const f = await setup(
    async (req, on) => {
      calls++;
      if (calls > 1) {
        on.text("第二问的回答。");
        return { ok: true, sessionId: randomUUID() };
      }
      signal = req.signal;
      on.text("知识库里还没有这一条，答到一半");
      let finish!: () => void;
      modelDone = new Promise<void>((resolve) => {
        finish = resolve;
      });
      started();
      // 模拟仍在生成的模型：只有中止信号能让它提前结束
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 1500);
        req.signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          resolve();
        });
      });
      finish();
      return { ok: true, sessionId: randomUUID() };
    },
    {
      judgeAnswer: async (_root, input) => {
        if (input.question === "A？") judged++;
        throw new Error("fixture judge unavailable");
      },
      judgeGap: async (_root, input) => {
        if (input.question === "A？") gapJudged++;
        return undefined;
      },
    },
  );
  const controller = new AbortController();
  const response = await fetch(f.url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-wiki-review": "1" },
    body: JSON.stringify({ message: "A？" }),
    signal: controller.signal,
  });
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let seen = "";
  while (!frame(seen, "knowledge")) {
    const { done, value } = await reader.read();
    if (done) break;
    seen += decoder.decode(value, { stream: true });
  }
  const sessionId: string = frame(seen, "knowledge").sessionId;
  await running;
  controller.abort();
  const session = join(f.root, "wiki/_jobs/chat-sessions", `${sessionId}.json`);
  const deadline = Date.now() + 500;
  while (Date.now() < deadline && JSON.parse(readFileSync(session, "utf8")).active)
    await new Promise((resolve) => setTimeout(resolve, 20));
  try {
    expect(signal?.aborted).toBe(true);
    expect(JSON.parse(readFileSync(session, "utf8")).active).toBeUndefined();
    const again = await f.request({ message: "再问一次", sessionId });
    expect(again.status).toBe(200);
    await again.text();
  } finally {
    await modelDone;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  expect(judged).toBe(0);
  expect(gapJudged).toBe(0);
  expect(listGaps(f.root).flatMap((gap) => gap.occurrences.map((o) => o.question))).not.toContain("A？");
});

it("停止独立核对会中止其模型并释放会话，不保存迟到的评判或缺口", async () => {
  let started!: () => void;
  const checking = new Promise<void>((resolve) => { started = resolve; });
  let signal: AbortSignal | undefined;
  let gapCalls = 0;
  const f = await setup(async (_req, on) => {
    on.text("默认值为 2，见 [A](sources/a.md)。");
    return { ok: true, sessionId: randomUUID() };
  }, {
    judgeAnswer: (root, input) => reviewAnswer(root, input, {
      runAgent: async (req) => {
        signal = req.signal;
        started();
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, 1500);
          req.signal?.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
        });
        return { id: req.id, ok: true, exitCode: 0, costUsd: 0, stderrTail: "", output: JSON.stringify({
          satisfied: false, classification: "answer-error", reason: "数字不符", answerQuote: "默认值为 2",
          evidence: [{ pageId: "a", quote: "默认值为 1。" }],
        }) };
      },
    }),
    judgeGap: async () => { gapCalls++; return undefined; },
  });
  const controller = new AbortController();
  const response = await fetch(f.url, { method: "POST", headers: { "content-type": "application/json", "x-wiki-review": "1" }, body: JSON.stringify({ message: "A 的默认值？" }), signal: controller.signal });
  const reader = response.body!.getReader();
  let seen = "";
  while (!frame(seen, "knowledge")) seen += new TextDecoder().decode((await reader.read()).value);
  const sessionId: string = frame(seen, "knowledge").sessionId;
  await checking;
  controller.abort();
  const session = join(f.root, "wiki/_jobs/chat-sessions", `${sessionId}.json`);
  try {
    await expect.poll(() => JSON.parse(readFileSync(session, "utf8")).active, { timeout: 750 }).toBeUndefined();
    expect(signal?.aborted).toBe(true);
    expect(gapCalls).toBe(0);
    expect(listGaps(f.root)).toEqual([]);
  } finally {
    // Keep the fixture alive until the red run's uncancelled model completes.
    await new Promise((resolve) => setTimeout(resolve, 1600));
  }
});
