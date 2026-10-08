import { readFileSync } from "node:fs";
import { afterEach, expect, it } from "vitest";
import { localFixVersions, looksLikeError, traceChat } from "./chat-trace";
import { GithubClient } from "./github";
import { TraceSession, traceConfigSchema } from "./github-trace";
import { wikiFixture } from "./test-fixture";

// 用户 2026-09-23 定：网页聊天接入在线排错算 F003 的验收项。这里只验编排：
// 什么时候去查、查到的东西怎么核对版本、失败怎么说。GitHub 一律用假 fetch，不联网。

const REPO = "vllm-project/vllm-ascend";
const config = traceConfigSchema.parse({
  ...JSON.parse(readFileSync("wiki/github-trace.config.json", "utf8")),
  repos: [REPO],
  queriesPerRepo: 1,
});
const fixtures: ReturnType<typeof wikiFixture>[] = [];
afterEach(() => {
  for (const f of fixtures.splice(0)) f.cleanup();
});

const item = (number: number, pr: boolean, body: string) => ({
  number,
  title: pr ? "[BugFix] fix collective failure" : "RuntimeError: collective failed on 8 cards",
  body,
  state: "closed",
  html_url: `https://github.com/${REPO}/${pr ? "pull" : "issues"}/${number}`,
  user: { login: "someone" },
  created_at: "2026-09-01T00:00:00Z",
  updated_at: pr ? "2026-09-10T00:00:00Z" : "2026-09-12T00:00:00Z",
  closed_at: "2026-09-12T00:00:00Z",
  labels: [],
  ...(pr ? { pull_request: {} } : {}),
});

/** 本地克隆：main 上合入了 #15981；v0.23 发布分支没有这个提交，但有一条同号回移 */
// 钉点写进 YAML 时必须加引号：像 4e123456、12345678 这样的短提交号会被 YAML 读成数字（2026-09-23 实遇，测试时好时坏）
function localClone() {
  const f = wikiFixture();
  fixtures.push(f);
  f.write("repo/a.txt", "base\n");
  const base = f.commit("base");
  f.git(["branch", "rel", base]);
  f.write("repo/a.txt", "fixed\n");
  const fix = f.commit("[BugFix] fix collective failure (#15981)");
  f.git(["tag", "v0.26.0rc2"]);
  f.git(["checkout", "-q", "rel"]);
  f.write("repo/a.txt", "backported\n");
  const backport = f.commit("[v0.23][BugFix] fix collective failure (#15981)");
  f.git(["checkout", "-q", "main"]);
  f.write(
    "wiki/seeds/vllm-ascend-code.yaml",
    `repos:\n  vllm-ascend:\n    url: https://github.com/${REPO}\n    path: repo\n    refs:\n      main: "${fix.slice(0, 8)}"\n      "releases/v0.23.0": "${backport.slice(0, 8)}"\nfeatures: []\n`,
  );
  f.write("wiki/github-trace.config.json", JSON.stringify(config));
  return { ...f, fix, backport };
}

function fakeGithub(route: (url: URL) => Response) {
  const sent: string[] = [];
  const client = new GithubClient(undefined, async (url) => {
    sent.push(String(url));
    return route(new URL(String(url)));
  });
  return { client, sent };
}

it("普通提问不去 GitHub：没有异常类名或 traceback 就不发任何网络请求", async () => {
  const f = localClone();
  const { client, sent } = fakeGithub(() => Response.json({}));
  const trace = await traceChat(f.root, "KV Cache 是什么？prefill 和 decode 有什么区别", {
    session: new TraceSession(config, client),
  });
  expect(trace.status).toBe("skipped");
  expect(sent).toEqual([]);
  expect(looksLikeError("报 AttributeError: 'NPUModelRunner' object has no attribute 'x' 怎么办")).toBe(true);
  expect(looksLikeError("Traceback (most recent call last):")).toBe(true);
  expect(looksLikeError("KV Cache 是什么")).toBe(false);
});

it("retains the screened search body when thread inspection is rate limited", async () => {
  const f = localClone();
  const body = `${"environment ".repeat(80)}\nSecond finding: decode before try can terminate the accept loop.`;
  const { client } = fakeGithub((url) =>
    url.pathname === "/search/issues"
      ? Response.json({ total_count: 1, incomplete_results: false, items: [item(17932, false, body)] })
      : Response.json({ message: "rate limit" }, { status: 403 }),
  );
  const trace = await traceChat(f.root, "UnicodeDecodeError", { session: new TraceSession(config, client) });
  expect(trace.status).toBe("done");
  if (trace.status !== "done") return;
  expect(trace.candidates[0]!.excerpt).toContain("Second finding: decode before try");
  expect(trace.complete).toBe(false);
  expect(trace.problems.join()).toContain("403");
});

it("在线候选与评论中的文档按文档自身版本映射，并明确区别当前钉点", async () => {
  const f = localClone();
  f.write("repo/docs/source/usage/guide.md", "old documented behavior\n");
  const docCommit = f.commit("versioned docs");
  f.git(["tag", "v0.25.0"]);
  const link = "https://docs.vllm.ai/projects/ascend/en/v0.25.0/usage/guide/";
  const { client } = fakeGithub((url) => {
    if (url.pathname === "/search/issues")
      return Response.json({
        total_count: 1,
        incomplete_results: false,
        items: [item(1, false, "RuntimeError: failed")],
      });
    if (url.pathname.endsWith("/issues/1")) return Response.json(item(1, false, "RuntimeError: failed"));
    if (url.pathname.endsWith("/comments"))
      return Response.json([
        {
          body: `使用 ${link}`,
          html_url: "https://github.com/vllm-project/vllm-ascend/issues/1#issuecomment-1",
        },
      ]);
    return Response.json([]);
  });
  const trace = await traceChat(f.root, "RuntimeError: failed", {
    session: new TraceSession(config, client),
  });
  expect(trace.status).toBe("done");
  if (trace.status !== "done") return;
  expect(trace.candidates[0]).toMatchObject({
    docs: [
      {
        url: link,
        version: "v0.25.0",
        mappings: [
          {
            pinnedRef: "main",
            commit: docCommit,
            localPath: "docs/source/usage/guide.md",
            matchesPinned: false,
          },
          {
            pinnedRef: "releases/v0.23.0",
            commit: docCommit,
            localPath: "docs/source/usage/guide.md",
            matchesPinned: false,
          },
        ],
      },
    ],
  });
});

it("贴报错时在线搜候选，追第一个 issue 关联的 PR，并用本地克隆核对修复进了哪些钉住的版本和 tag", async () => {
  const f = localClone();
  const { client, sent } = fakeGithub((url) => {
    if (url.pathname === "/search/issues")
      return Response.json({
        total_count: 2,
        incomplete_results: false,
        items: [item(15815, false, "8 卡跑起来就崩，见 #15981"), item(15981, true, "Fixes #15815")],
      });
    if (url.pathname.endsWith("/issues/15815")) return Response.json(item(15815, false, "见 #15981"));
    if (url.pathname.endsWith("/issues/15815/comments")) return Response.json([]);
    if (url.pathname.endsWith("/issues/15815/timeline"))
      return Response.json([
        {
          event: "cross-referenced",
          source: { issue: { html_url: `https://github.com/${REPO}/pull/15981` } },
        },
      ]);
    return Response.json({ message: "Not Found" }, { status: 404 });
  });
  const message =
    'File "C:\\Users\\Alice\\work\\run.py", line 12, in execute_model\ntoken=ghp_privatevalue\nRuntimeError: collective failed on 8 cards';
  const trace = await traceChat(f.root, message, { session: new TraceSession(config, client) });

  expect(trace.status).toBe("done");
  if (trace.status !== "done") return;
  // 原始日志不出本机：路径、token 都不进请求
  expect(sent.join("\n")).not.toMatch(/Alice|ghp_|privatevalue/);
  expect(trace.candidates.map((c) => `${c.kind}#${c.number}`)).toEqual(["issue#15815", "pr#15981"]);

  const expected = {
    status: "found",
    commit: f.fix,
    pins: [
      { ref: "main", contains: true },
      { ref: "releases/v0.23.0", contains: false, sameNumberCommit: f.backport },
    ],
    tags: ["v0.26.0rc2"],
  };
  // 第一个 issue：顺着正文与 cross-reference 找到的 PR，逐个做本地版本核对
  expect(trace.candidates[0]!.excerpt).toContain("见 #15981");
  expect(trace.candidates[0]!.linkedPrs?.[0]).toMatchObject({ number: 15981, versions: expected });
  // 候选本身就是 PR 的，直接核对
  expect(trace.candidates[1]!.versions).toMatchObject(expected);
});

it("关联 PR 名额有限时，先取主动引用这个 issue 的 PR（修复通常在这里），再取评论、最后取正文里顺手提到的", async () => {
  // 2026-09-23 真实跑 #15815：正文先提到 #13268、#13412 两个旧 PR，评论又提到 #14030，
  // 三个名额被占满，真正的修复 #15981（cross-referenced）排在最后被截掉。
  const f = localClone();
  for (const n of [100, 101, 102]) {
    f.write("repo/a.txt", `older ${n}\n`);
    f.commit(`[Misc] older change (#${n})`);
  }
  f.write(
    "wiki/seeds/vllm-ascend-code.yaml",
    `repos:\n  vllm-ascend:\n    url: https://github.com/${REPO}\n    path: repo\n    refs:\n      main: "${f.git(["rev-parse", "HEAD"]).slice(0, 8)}"\nfeatures: []\n`,
  );
  const { client } = fakeGithub((url) => {
    if (url.pathname === "/search/issues")
      return Response.json({
        total_count: 1,
        incomplete_results: false,
        items: [item(15815, false, "起因见 #100、#101")],
      });
    if (url.pathname.endsWith("/issues/15815")) return Response.json(item(15815, false, "起因见 #100、#101"));
    if (url.pathname.endsWith("/issues/15815/comments"))
      return Response.json([{ html_url: "c1", updated_at: "2026-09-12T00:00:00Z", body: "和 #102 有关" }]);
    if (url.pathname.endsWith("/issues/15815/timeline"))
      return Response.json([
        {
          event: "cross-referenced",
          source: { issue: { html_url: `https://github.com/${REPO}/pull/15981` } },
        },
      ]);
    return Response.json({ message: "Not Found" }, { status: 404 });
  });
  const trace = await traceChat(f.root, "RuntimeError: collective failed", {
    session: new TraceSession(config, client),
  });
  expect(trace.status).toBe("done");
  if (trace.status !== "done") return;
  expect(trace.candidates[0]!.linkedPrs?.map((l) => l.number)).toEqual([15981, 102, 100]);
});

it("直接合进发布分支的 PR 也找得到合并提交：main 上没有就去发布分支与各钉点找", () => {
  // 2026-09-23 真实跑：#15981 是「[Backport v0.26.0rc] … (#15981)」，只在 releases/v0.26.0rc 上，main 上没有
  const f = localClone();
  f.git(["checkout", "-q", "-b", "rel26", f.fix]);
  f.write("repo/a.txt", "release only\n");
  const onRelease = f.commit("[Backport v0.26.0rc][BugFix] fix stale bindings (#16000)");
  f.git(["checkout", "-q", "main"]);
  f.write(
    "wiki/seeds/vllm-ascend-code.yaml",
    `repos:\n  vllm-ascend:\n    url: https://github.com/${REPO}\n    path: repo\n    refs:\n      main: "${f.fix.slice(0, 8)}"\n      "releases/v0.26.0rc": "${onRelease.slice(0, 8)}"\nfeatures: []\n`,
  );
  expect(localFixVersions(f.root, REPO, 16000)).toMatchObject({
    status: "found",
    commit: onRelease,
    pins: [
      { ref: "main", contains: false },
      { ref: "releases/v0.26.0rc", contains: true },
    ],
  });
});

it("在线搜索失败要如实说失败，不能当成零命中", async () => {
  const f = localClone();
  const { client } = fakeGithub(
    () =>
      new Response(JSON.stringify({ message: "API rate limit exceeded" }), {
        status: 403,
        headers: { "content-type": "application/json", "x-ratelimit-remaining": "0" },
      }),
  );
  const trace = await traceChat(f.root, "RuntimeError: collective failed", {
    session: new TraceSession(config, client),
  });
  expect(trace.status).toBe("failed");
  if (trace.status !== "failed") return;
  expect(trace.reason).toMatch(/rate-limit|限额/);
});

it("关联 PR 按仓库和编号去重，两个仓库同号不能合并", async () => {
  const f = localClone();
  const cfg = { ...config, repos: [REPO, "vllm-project/vllm"] };
  f.write("wiki/github-trace.config.json", JSON.stringify(cfg));
  const { client } = fakeGithub((url) => {
    if (url.pathname === "/search/issues")
      return Response.json({
        total_count: 1,
        incomplete_results: false,
        items: [item(1, false, "RuntimeError")],
      });
    if (url.pathname.endsWith("/issues/1")) return Response.json(item(1, false, "RuntimeError"));
    if (url.pathname.endsWith("/timeline"))
      return Response.json(
        cfg.repos.map((repo) => ({
          event: "cross-referenced",
          source: { issue: { html_url: `https://github.com/${repo}/pull/7` } },
        })),
      );
    return Response.json([]);
  });
  const result = await traceChat(f.root, "RuntimeError: failed", { session: new TraceSession(cfg, client) });
  expect(result.status).toBe("done");
  if (result.status !== "done") return;
  expect(result.candidates[0]!.linkedPrs?.map((pr) => pr.url)).toEqual(
    cfg.repos.map((repo) => `https://github.com/${repo}/pull/7`),
  );
});
