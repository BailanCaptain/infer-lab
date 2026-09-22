import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import type { ChatTrace, traceChat } from "../scripts/wiki/chat-trace";
import { listGaps } from "../scripts/wiki/gap-ledger";
import { HANDBOOK_H2 } from "../scripts/wiki/handbook";
import { wikiFixture } from "../scripts/wiki/test-fixture";
import type { runChat } from "./chat";
import { handleChat } from "./chat-route";

const fixtures: ReturnType<typeof wikiFixture>[] = [];
const servers: Server[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const f of fixtures.splice(0)) f.cleanup();
});
const original =
  "---\nid: a\ntitle: A\ntype: source\nsummary: 默认值为 1\nsources: [https://docs.vllm.ai/en/latest/]\nevidence: S\nupdated: '2026-09-15'\n---\n## 一句话\n默认值为 1。\n";
async function setup(run: typeof runChat, extra: { traceChat?: typeof traceChat } = {}) {
  const f = wikiFixture();
  fixtures.push(f);
  f.write(
    "wiki/HANDBOOK.md",
    Object.values(HANDBOOK_H2)
      .map((h) => `## ${h}\n\nfixture\n`)
      .join("\n"),
  );
  f.write("wiki/sources/a.md", original);
  const server = createServer((req, res) => {
    void handleChat(req, res, f.root, { runChat: run, ...extra });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing server");
  const request = (body: unknown) =>
    fetch(`http://127.0.0.1:${address.port}/api/wiki/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  return { ...f, request };
}
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
                { ref: "releases/v0.23.0", commit: "c".repeat(40), contains: false, sameNumberCommit: "d".repeat(40) },
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
