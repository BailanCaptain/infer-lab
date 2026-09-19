import { type ChildProcess, spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, it } from "vitest";
import { runBuild } from "../scripts/wiki/build";
import { HANDBOOK_H2 } from "../scripts/wiki/handbook";
import { runStagedIntegration } from "../scripts/wiki/integration-run";
import { saveRawSnapshot } from "../scripts/wiki/raw";
import { approveReview } from "../scripts/wiki/review";
import { wikiFixture } from "../scripts/wiki/test-fixture";
import { retrieve } from "../src/content/wiki/retrieve";
import { readKnowledgeSnapshot } from "./snapshot";

const fixtures: ReturnType<typeof wikiFixture>[] = [];
const children: ChildProcess[] = [];
afterEach(async () => {
  for (const child of children.splice(0)) {
    if (child.exitCode !== null) continue;
    await new Promise<void>((resolve) => {
      child.once("exit", () => resolve());
      child.kill();
    });
  }
  for (const f of fixtures.splice(0)) f.cleanup();
});

it("the running server observes new publications without restart and refuses an interrupted publication", async () => {
  const f = wikiFixture();
  fixtures.push(f);
  f.write(
    "wiki/HANDBOOK.md",
    Object.values(HANDBOOK_H2)
      .map((heading) => `## ${heading}\n\nfixture\n`)
      .join("\n"),
  );
  const raw = saveRawSnapshot(join(f.root, "wiki"), "新增知识用于解释人工设置。\n");
  const source = `raw:${raw.slice(4)}#L1`;
  const page = (id: string, title: string) =>
    `---\nid: ${id}\ntitle: ${title}\ntype: source\nsummary: ${title}\nsources: [${source}]\nevidence: I\nupdated: '2026-09-15'\n---\n## 一句话\n${title}\n`;
  f.write("wiki/sources/a.md", page("a", "原有条目"));
  f.write("wiki/_drafts/b.md", page("b", "新增知识"));
  runBuild(f.root);
  const first = await readKnowledgeSnapshot(f.root);
  const proposal = await runStagedIntegration(
    f.root,
    {
      id: "integration",
      cwd: "",
      args: [],
      stdin: "",
      timeoutMs: 1000,
      allowedWrites: ["sources/**", "_drafts/_integration.json"],
    },
    ["b"],
    "2026-09-15",
    {
      runAgent: async (req) => {
        writeFileSync(join(req.cwd, "sources/b.md"), page("b", "新增知识"));
        writeFileSync(
          join(req.cwd, "_drafts/_integration.json"),
          JSON.stringify({ promoted: ["b"], merged: [], rejected: [] }),
        );
        return { id: req.id, ok: true, exitCode: 0, stderrTail: "" };
      },
      validate: () => [],
    },
  );
  const child = spawn(
    process.execPath,
    ["--import", import.meta.resolve("tsx"), fileURLToPath(new URL("./index.ts", import.meta.url))],
    {
      cwd: f.root,
      env: { ...process.env, WIKI_SERVER_PORT: "0" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  children.push(child);
  const base = await new Promise<string>((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error(`server startup timeout: ${output}`)), 10000);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", () => {
      clearTimeout(timer);
      reject(new Error(output));
    });
    child.stderr!.on("data", (chunk) => {
      output += chunk;
    });
    child.stdout!.on("data", (chunk) => {
      output += chunk;
      const url = /http:\/\/127\.0\.0\.1:\d+/.exec(output)?.[0];
      if (url) {
        clearTimeout(timer);
        resolve(url);
      }
    });
  });
  const health = async () => fetch(`${base}/api/wiki/health`);
  expect(await (await health()).json()).toMatchObject({ pages: 1 });
  const reader = async () => fetch(`${base}/api/wiki/pages`);
  expect(await (await reader()).json()).toMatchObject({ pageTexts: [{ file: "sources/a.md" }] });
  for (const input of [null, { message: 3 }, { message: "", sessionId: {} }]) {
    const invalid = await fetch(`${base}/api/wiki/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    expect(invalid.status).toBe(400);
  }
  await expect(
    approveReview(f.root, proposal.reviewId, {
      afterWrite: () => {
        throw new Error("interrupt");
      },
    }),
  ).rejects.toThrow("interrupt");
  expect((await health()).status).toBe(503);
  expect((await reader()).status).toBe(503);
  const published = await fetch(`${base}/api/wiki/reviews/${proposal.reviewId}/approve`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-wiki-review": "1", origin: base },
    body: JSON.stringify({ revision: proposal.reviewId }),
  });
  expect(published.status, await published.text()).toBe(200);
  expect(await (await health()).json()).toMatchObject({ pages: 2 });
  const readerResult = (await (await reader()).json()) as { pageTexts: { file: string; text: string }[] };
  expect(readerResult.pageTexts).toHaveLength(2);
  expect(readerResult.pageTexts.find((p) => p.file === "sources/b.md")?.text).toContain("新增知识");
  const next = await readKnowledgeSnapshot(f.root);
  expect(retrieve("新增知识", next.index).some((hit) => hit.id === "b")).toBe(true);
  expect(first.registry.pages).toHaveLength(1);
});
