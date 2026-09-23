import { existsSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { saveRawSnapshot } from "../scripts/wiki/raw";
import { handbookFixture, wikiFixture } from "../scripts/wiki/test-fixture";
import { materializeSnapshot, readKnowledgeSnapshot } from "./snapshot";

const fixtures: ReturnType<typeof wikiFixture>[] = [];
vi.mock("node:fs", async (original) => {
  const fs = await original<typeof import("node:fs")>();
  return { ...fs, renameSync: vi.fn(fs.renameSync) };
});
const fs = await vi.importActual<typeof import("node:fs")>("node:fs");
afterEach(() => {
  vi.mocked(renameSync).mockImplementation(fs.renameSync);
  for (const f of fixtures.splice(0)) f.cleanup();
});
it("publishes a complete snapshot even when Windows refuses all directory renames", async () => {
  const f = wikiFixture();
  fixtures.push(f);
  f.write(
    "wiki/HANDBOOK.md",
    handbookFixture(),
  );
  const snapshot = await readKnowledgeSnapshot(f.root);
  vi.mocked(renameSync).mockImplementation((from, to) => {
    if (statSync(from).isDirectory())
      throw Object.assign(new Error("directory rename denied"), { code: "EPERM" });
    fs.renameSync(from, to);
  });
  const [location, concurrent] = await Promise.all([
    materializeSnapshot(f.root, snapshot),
    materializeSnapshot(f.root, snapshot),
  ]);
  expect(concurrent).toBe(location);
  expect(await materializeSnapshot(f.root, snapshot)).toBe(location);
  expect(readFileSync(join(location, "HANDBOOK.md"), "utf8")).toContain("fixture");
});
it("a failed ready pointer publishes nothing, and a tampered pointer is refused", async () => {
  const f = wikiFixture();
  fixtures.push(f);
  f.write(
    "wiki/HANDBOOK.md",
    handbookFixture(),
  );
  const snapshot = await readKnowledgeSnapshot(f.root);
  const pointer = join(f.root, "tools/wiki-runtime/knowledge", `${snapshot.revision}.json`);
  vi.mocked(renameSync).mockImplementation((from, to) => {
    if (to === pointer) throw Object.assign(new Error("permission denied"), { code: "EPERM" });
    fs.renameSync(from, to);
  });
  await expect(materializeSnapshot(f.root, snapshot)).rejects.toThrow("permission denied");
  expect(existsSync(pointer)).toBe(false);
  vi.mocked(renameSync).mockImplementation(fs.renameSync);
  await materializeSnapshot(f.root, snapshot);
  writeFileSync(pointer, JSON.stringify("../outside"));
  await expect(materializeSnapshot(f.root, snapshot)).rejects.toThrow(/快照/);
});
it("uses one content revision for metadata, body, rules and archived evidence", async () => {
  const f = wikiFixture();
  fixtures.push(f);
  f.write(
    "wiki/HANDBOOK.md",
    handbookFixture(),
  );
  const raw = saveRawSnapshot(join(f.root, "wiki"), "默认值为 1。\n");
  const page = `---\nid: a\ntitle: A\ntype: source\nsummary: 默认值为 1\nsources: [raw:${raw.slice(4)}#L1]\nevidence: I\nupdated: '2026-09-15'\n---\n## 一句话\n默认值为 1。\n`;
  f.write("wiki/sources/a.md", page);
  const first = await readKnowledgeSnapshot(f.root);
  expect(first.revision).toMatch(/^[a-f0-9]{64}$/);
  const location = await materializeSnapshot(f.root, first);
  expect(location).not.toBe(join(f.root, "wiki"));
  f.write("wiki/sources/a.md", page.replaceAll("默认值为 1", "默认值为 2"));
  expect(readFileSync(join(location, "sources/a.md"), "utf8")).toBe(page);
  expect(readFileSync(join(location, raw), "utf8")).toBe("默认值为 1。\n");
  const second = await readKnowledgeSnapshot(f.root);
  expect(second.revision).not.toBe(first.revision);
  expect((await readKnowledgeSnapshot(f.root)).revision).toBe(second.revision);
  expect(await materializeSnapshot(f.root, first)).toBe(location);
  writeFileSync(join(location, "sources/a.md"), "tampered");
  await expect(materializeSnapshot(f.root, first)).rejects.toThrow(/快照/);
});
