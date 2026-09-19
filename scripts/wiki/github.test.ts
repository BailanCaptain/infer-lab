import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { claimCorpusRepo, parseDocLinks, readCorpus } from "./corpus";
import { GithubClient } from "./github";
import { lintLog } from "./lint";
import { syncGithub } from "./sync-github";
import { wikiFixture } from "./test-fixture";

it.each([
  [401, {}, "auth"],
  [403, { "x-ratelimit-remaining": "0" }, "rate-limit"],
  [429, {}, "rate-limit"],
  [404, {}, "not-found"],
] as const)("classifies %s without leaking credentials or response text", async (status, headers, kind) => {
  const client = new GithubClient("SECRET", async () => new Response("SECRET", { status, headers }));
  await expect(client.get("/repos/o/r/issues")).rejects.toMatchObject({ kind });
  await expect(client.get("/repos/o/r/issues")).rejects.not.toThrow(/SECRET/);
});
it("classifies network failures and rejects credential redirects", async () => {
  const client = new GithubClient("SECRET", async (_url, init) => {
    expect(init?.redirect).toBe("error");
    throw new Error("SECRET");
  });
  await expect(client.get("/repos/o/r/issues")).rejects.toMatchObject({ kind: "network" });
});

it("resumes complete pages, distinguishes PRs, reconciles comment deletion, and keeps failed checkpoints", async () => {
  const f = wikiFixture();
  try {
    const date = "2026-09-15T00:00:00Z";
    const item = (number: number) => ({
      number,
      title: `Item ${number}`,
      body: number === 2 ? "Fixes #1" : "RuntimeError: fixture failure",
      state: "closed",
      html_url: `https://github.com/o/r/${number === 2 ? "pull" : "issues"}/${number}`,
      user: { login: "author" },
      labels: [],
      created_at: date,
      updated_at: date,
      closed_at: date,
      ...(number === 2 ? { pull_request: {} } : {}),
    });
    let comment = true;
    let fail = false;
    const calls: string[] = [];
    const client = new GithubClient(undefined, async (url) => {
      const u = new URL(String(url));
      calls.push(u.pathname + u.search);
      if (fail) return new Response("bad token", { status: 401 });
      let value: unknown = [];
      if (u.pathname === "/repos/o/r/issues") value = [item(1), item(2)];
      if (/\/issues\/[12]$/.test(u.pathname)) value = item(Number(u.pathname.split("/").at(-1)));
      if (u.pathname === "/repos/o/r/pulls/2") value = { merged: true };
      if (u.pathname === "/repos/o/r/issues/2/timeline")
        value = [{ event: "merged", commit_id: "a".repeat(40), created_at: date }];
      if (u.pathname === "/repos/o/r/pulls/2/files") value = [{ filename: "vllm_ascend/config.py" }];
      if (u.pathname === "/repos/o/r/issues/1/comments" && comment)
        value = [
          {
            id: 9,
            body: "changed comment",
            html_url: "https://github.com/o/r/issues/1#issuecomment-9",
            updated_at: date,
            user: null,
          },
        ];
      return Response.json(value);
    });
    const first = await syncGithub(f.root, "o/r", { full: true }, client);
    expect(first).toMatchObject({ changed: 2, issues: 1, prs: 1 });
    expect(() => claimCorpusRepo(f.root, "other/r")).toThrow(/其他仓库/);
    expect((await syncGithub(f.root, "o/r", {}, client)).changed).toBe(0);
    expect(readCorpus(f.root, "o/r").find((r) => r.kind === "pr")).toMatchObject({
      fixes: [1],
      merged: true,
      files: ["vllm_ascend/config.py"],
      patches: [{ file: "vllm_ascend/config.py", patch: null, status: "unknown" }],
    });
    comment = false;
    expect((await syncGithub(f.root, "o/r", {}, client)).changed).toBe(1);
    expect(readCorpus(f.root, "o/r")[0]?.comments).toEqual([]);
    const checkpoint = readFileSync(join(f.root, "tools/corpus/r/checkpoint.json"), "utf8");
    fail = true;
    await expect(syncGithub(f.root, "o/r", {}, client)).rejects.toMatchObject({ kind: "auth" });
    expect(readFileSync(join(f.root, "tools/corpus/r/checkpoint.json"), "utf8")).toBe(checkpoint);
    expect(readFileSync(join(f.root, "wiki/log.md"), "utf8")).toContain("auth");
    expect(lintLog(readFileSync(join(f.root, "wiki/log.md"), "utf8"))).toEqual([]);
    expect(calls.some((p) => p.startsWith("/repos/o/r/pulls/comments?"))).toBe(true);
  } finally {
    f.cleanup();
  }
});

it("resumes page two after a failed 101-item initial scan, then overlaps updates from the original start", async () => {
  const f = wikiFixture();
  try {
    const item = (number: number) => ({
      number,
      title: `Issue ${number}`,
      body: "body",
      state: "open",
      html_url: `https://github.com/o/r/issues/${number}`,
      user: null,
      labels: [],
      created_at: "2026-09-01T00:00:00Z",
      updated_at: "2026-09-01T00:00:00Z",
      closed_at: null,
    });
    let fail = true;
    const calls: string[] = [];
    const client = new GithubClient(undefined, async (url) => {
      const u = new URL(String(url));
      calls.push(u.pathname + u.search);
      if (u.pathname === "/repos/o/r/issues" && !u.searchParams.has("since")) {
        if (u.searchParams.get("page") === "1")
          return Response.json(Array.from({ length: 100 }, (_, i) => item(i + 1)));
        if (fail) return new Response("outage", { status: 503 });
        return Response.json([item(101)]);
      }
      const n = /\/issues\/(\d+)$/.exec(u.pathname)?.[1];
      return Response.json(n ? item(Number(n)) : []);
    });
    await expect(syncGithub(f.root, "o/r", { full: true, reconcileLimit: 0 }, client)).rejects.toMatchObject({
      kind: "api",
    });
    const checkpoint = JSON.parse(readFileSync(join(f.root, "tools/corpus/r/checkpoint.json"), "utf8"));
    expect(checkpoint.full.nextPage).toBe(2);
    expect(checkpoint.completedAt).toBeUndefined();
    calls.length = 0;
    fail = false;
    expect(await syncGithub(f.root, "o/r", { full: true, reconcileLimit: 0 }, client)).toMatchObject({
      issues: 101,
      changed: 1,
    });
    expect(
      calls.some((s) => {
        const query = new URL(s, "https://api.github.com").searchParams;
        return query.get("sort") === "created" && query.get("page") === "1";
      }),
    ).toBe(false);
    expect(calls.some((s) => s.includes("since="))).toBe(true);
    expect(readCorpus(f.root, "o/r")).toHaveLength(101);
  } finally {
    f.cleanup();
  }
});
it("parses versioned documentation links without accepting traversal", () => {
  expect(
    parseDocLinks("See https://docs.vllm.ai/projects/ascend/en/v0.9.1/user_guide/configuration.html#foo"),
  ).toEqual([
    {
      url: "https://docs.vllm.ai/projects/ascend/en/v0.9.1/user_guide/configuration.html#foo",
      version: "v0.9.1",
      path: "user_guide/configuration.html",
    },
  ]);
  expect(parseDocLinks("https://docs.vllm.ai/projects/ascend/en/latest/%2e%2e/secrets.html")).toEqual([]);
});
