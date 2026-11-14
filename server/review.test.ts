import { readFileSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runStagedIntegration } from "../scripts/wiki/integration-run";
import { saveRawSnapshot } from "../scripts/wiki/raw";
import { type Review, createReview, readReview } from "../scripts/wiki/review";
import { wikiContents } from "../scripts/wiki/review-files";
import { wikiFixture } from "../scripts/wiki/test-fixture";
import { handleReview } from "./review";

const fixtures: ReturnType<typeof wikiFixture>[] = [];
const servers: Server[] = [];
afterEach(async () => {
  for (const server of servers.splice(0))
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  for (const fixture of fixtures.splice(0)) fixture.cleanup();
});

async function setup() {
  const f = wikiFixture();
  fixtures.push(f);
  const raw = saveRawSnapshot(join(f.root, "wiki"), "X 默认开启。\nX 已被移除。\n");
  const source = `raw:${raw.slice(4)}#L1-L2`;
  const page = `---\nid: a\ntitle: A\ntype: source\nsummary: X 已被移除\nsources: [${source}]\nevidence: I\nupdated: '2026-09-15'\n---\n## 一句话\nX 已被移除。\n`;
  f.write("wiki/sources/a.md", page.replaceAll("X 已被移除", "X 默认开启"));
  f.write("wiki/_drafts/a.md", page);
  const result = await runStagedIntegration(
    f.root,
    {
      id: "integration",
      cwd: "",
      args: [],
      stdin: "",
      timeoutMs: 1000,
      allowedWrites: ["sources/**", "_drafts/_integration.json"],
    },
    ["a"],
    "2026-09-15",
    {
      runAgent: async (req) => {
        writeFileSync(join(req.cwd, "sources/a.md"), page);
        writeFileSync(
          join(req.cwd, "_drafts/_integration.json"),
          JSON.stringify({
            promoted: ["a"],
            merged: [],
            rejected: [],
            revisions: [
              {
                id: "a",
                kind: "supersede",
                reason: "新版移除",
                claims: [{ old: "X 默认开启。", replacement: "X 已被移除。", sources: [source] }],
              },
            ],
          }),
        );
        return { id: req.id, ok: true, exitCode: 0, stderrTail: "" };
      },
      validate: () => [],
    },
  );
  const server = createServer(async (req, res) => {
    if (!(await handleReview(req, res, f.root))) {
      res.writeHead(404);
      res.end();
    }
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test server has no port");
  const base = `http://127.0.0.1:${address.port}`;
  const url = `${base}/api/wiki/reviews/${result.reviewId}`;
  const post = (action: string, body: unknown, headers: Record<string, string> = {}) =>
    fetch(`${url}/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-wiki-review": "1", origin: base, ...headers },
      body: JSON.stringify(body),
    });
  return { ...f, base, url, id: result.reviewId, post };
}

describe("review HTTP API", () => {
  it("batch approval publishes only explicitly selected revisions and keeps same-origin protection", async () => {
    const f = await setup();
    const before = wikiContents(f.root);
    const after = new Map(before);
    after.set("wiki/sources/b.md",before.get("wiki/sources/a.md")!.replace("id: a","id: b").replace("title: A","title: B"));
    const later = await createReview(f.root,before,after,{promoted:["b"],merged:[],rejected:[],contradictions:[]});
    const request = (body: unknown, origin=f.base) => fetch(`${f.base}/api/wiki/reviews/batch/approve`, {
      method:"POST", headers:{"content-type":"application/json","x-wiki-review":"1",origin},body:JSON.stringify(body),
    });
    expect((await request({revisions:[f.id]},"https://evil.example")).status).toBe(403);
    expect((await request({revisions:[f.id],all:true})).status).toBe(400);
    expect((await request({revisions:[f.id]})).status).toBe(200);
    expect(readReview(f.root,f.id).state).toBe("published");
    expect(readReview(f.root,later.id).state).toBe("pending");
  });
  it("keeps superseded claims in the review and publishes only the current explanation", async () => {
    const f = await setup();
    const before = wikiContents(f.root);
    const list = await fetch(`${f.base}/api/wiki/reviews`);
    expect(list.status).toBe(200);
    expect(await list.json()).toMatchObject({ reviews: [{ id: f.id }] });
    const detail = await fetch(f.url);
    const shown = (await detail.json()) as { diff: string; review: Review };
    expect(shown.diff).toContain("X 默认开启。");
    expect(shown.diff).toContain("X 已被移除。");
    expect(shown.diff).not.toContain("已废弃的说法");
    const revision = shown.review.payload.decision.revisions?.[0];
    expect(revision?.kind).toBe("supersede");
    if (revision?.kind !== "supersede") throw new Error("Expected a supersede revision");
    expect(revision.claims[0]).toMatchObject({
      old: "X 默认开启。",
      replacement: "X 已被移除。",
    });
    expect(wikiContents(f.root)).toEqual(before);
    expect((await f.post("approve", { revision: f.id })).status).toBe(200);
    const page = readFileSync(join(f.root, "wiki/sources/a.md"), "utf8");
    expect(page).not.toContain("X 默认开启。");
    expect(page).not.toContain("已废弃的说法");
    expect(page).toContain("X 已被移除。");
    expect(page).toContain("2026-09-15");
    expect(readReview(f.root, f.id).state).toBe("published");
    expect((await f.post("approve", { revision: f.id })).status).toBe(200);
    expect(readFileSync(join(f.root, "wiki/log.md"), "utf8").match(/晋升/g)).toHaveLength(1);
  });
  it("rejects with a reason and preserves all wiki inputs", async () => {
    const f = await setup();
    const before = wikiContents(f.root);
    expect((await f.post("reject", { revision: f.id, reason: "来源不支持该断言" })).status).toBe(200);
    expect((await f.post("approve", { revision: f.id })).status).toBe(409);
    expect(wikiContents(f.root)).toEqual(before);
  });
  it("rejects stale, mismatched and client-supplied file payloads", async () => {
    const f = await setup();
    expect((await f.post("approve", { revision: "0".repeat(64) })).status).toBe(400);
    expect(
      (await f.post("approve", { revision: f.id, path: "wiki/sources/a.md", after: "injected" })).status,
    ).toBe(400);
    f.write("wiki/sources/a.md", "user change");
    expect((await f.post("approve", { revision: f.id })).status).toBe(409);
    expect(readFileSync(join(f.root, "wiki/sources/a.md"), "utf8")).toBe("user change");
  });
  it("rejects cross-origin writes, simple requests, oversized bodies and wrong methods", async () => {
    const f = await setup();
    const before = wikiContents(f.root);
    expect((await f.post("approve", { revision: f.id }, { origin: "https://evil.example" })).status).toBe(
      403,
    );
    expect((await f.post("approve", { revision: f.id }, { "x-wiki-review": "" })).status).toBe(403);
    expect((await f.post("approve", { revision: f.id, junk: "x".repeat(20000) })).status).toBe(413);
    expect((await fetch(`${f.url}/approve`)).status).toBe(405);
    expect(wikiContents(f.root)).toEqual(before);
  });
});
