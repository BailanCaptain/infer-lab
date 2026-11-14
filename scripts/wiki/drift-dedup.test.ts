import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { detectDrift } from "./drift";
import { enqueueTask, listTasks } from "./queue";
import { wikiFixture } from "./test-fixture";

const fixtures: ReturnType<typeof wikiFixture>[] = [];
afterEach(() => {
  vi.useRealTimers();
  for (const f of fixtures.splice(0)) f.cleanup();
});
function fixture() {
  const f = wikiFixture();
  fixtures.push(f);
  f.write("wiki/HANDBOOK.md", readFileSync(new URL("../../wiki/HANDBOOK.md", import.meta.url), "utf8"));
  f.write("repo/code.py", "value = 1\n");
  const pin = f.commit("source");
  f.write(
    "wiki/seeds/r.yaml",
    `repos:\n  r:\n    url: https://example.test/r\n    path: repo\n    refs: {main: "${pin}"}\nfeatures: []\n`,
  );
  const page = (body = "alpha beta gamma", commit = pin) =>
    `---\nid: a\ntitle: A\ntype: source\nsummary: A\nsources: [r@${commit}:code.py#L1]\nevidence: I\nupdated: '2026-01-01'\n---\n${body}\n`;
  f.write("wiki/sources/a.md", page());
  const agent = vi.fn(async (req: { id: string }) => ({
    id: req.id,
    ok: true,
    exitCode: 0,
    stderrTail: "",
    costUsd: 0,
    output: '{"body":"other new words"}',
  }));
  const run = () =>
    detectDrift(f.root, { sample: 1, policy: { accountingOnly: true } }, { runAgent: agent, retry: true });
  return { ...f, page, agent, run };
}
it("skips unchanged evidence after a new day and formal edits, including legacy queued work", async () => {
  const f = fixture();
  await f.run();
  const source = listTasks(f.root)[0]!.input;
  expect(source.kind).toBe("rewrite");
  f.write("wiki/sources/a.md", f.page("editor's newer text must remain"));
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2027-01-02T00:00:00Z"));
  expect((await f.run())[0]?.status).toBe("unchanged-source");
  expect(f.agent).toHaveBeenCalledTimes(1);
  expect(listTasks(f.root)).toHaveLength(1);
  expect(readFileSync(join(f.root, "wiki/sources/a.md"), "utf8")).toContain("editor's newer text");
});
it("persists a successful no-drift check, but processes changed source bytes", async () => {
  const f = fixture();
  f.agent.mockImplementation(async (req) => ({
    id: req.id,
    ok: true,
    exitCode: 0,
    stderrTail: "",
    costUsd: 0,
    output: '{"body":"alpha beta gamma"}',
  }));
  await f.run();
  expect(listTasks(f.root)).toHaveLength(0);
  f.write("wiki/sources/a.md", f.page("same evidence, different prose"));
  expect((await f.run())[0]?.status).toBe("unchanged-source");
  expect(f.agent).toHaveBeenCalledTimes(1);
  f.write("repo/code.py", "value = 2\n");
  const changed = f.commit("changed source");
  f.write("wiki/sources/a.md", f.page("same evidence, different prose", changed));
  expect((await f.run())[0]?.status).toBe("checked");
  expect(f.agent).toHaveBeenCalledTimes(2);
});
it("defers new evidence while the same page already has outstanding rewrite work", async () => {
  const f = fixture();
  await enqueueTask(f.root, {
    kind: "rewrite",
    pageId: "a",
    revision: "a".repeat(64),
    source: "raw:older",
    reason: "content-drift",
  });
  expect((await f.run())[0]?.status).toBe("deferred");
  expect(f.agent).not.toHaveBeenCalled();
  expect(listTasks(f.root)).toHaveLength(1);
});
it("failed extraction does not create a successful evidence receipt", async () => {
  const f = fixture();
  f.agent.mockResolvedValueOnce({
    id: "fail",
    ok: false,
    exitCode: 1,
    stderrTail: "offline",
    costUsd: 0,
    output: "",
  });
  expect((await f.run())[0]?.status).toBe("failed");
  expect((await f.run())[0]?.status).toBe("checked");
  expect(f.agent).toHaveBeenCalledTimes(2);
});
