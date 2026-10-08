import * as fs from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { wikiFixture } from "./test-fixture";
import { atomicText } from "./workflow";

vi.mock("node:fs", async (original) => {
  const actual = await original<typeof fs>();
  return { ...actual, renameSync: vi.fn(actual.renameSync) };
});
const fixtures: ReturnType<typeof wikiFixture>[] = [];
afterEach(() => {
  vi.mocked(fs.renameSync).mockReset();
  for (const fixture of fixtures.splice(0)) fixture.cleanup();
});

it("retries a transient rename lock without deleting the existing receipt", async () => {
  const f = wikiFixture();
  fixtures.push(f);
  f.write("receipt.json", "old");
  const path = join(f.root, "receipt.json");
  const actual = await vi.importActual<typeof fs>("node:fs");
  vi.mocked(fs.renameSync)
    .mockImplementationOnce(() => {
      throw Object.assign(new Error("file locked"), { code: "EPERM" });
    })
    .mockImplementationOnce((from, to) => {
      expect(fs.readFileSync(path, "utf8")).toBe("old");
      actual.renameSync(from, to);
    });
  atomicText(path, "new");
  expect(fs.readFileSync(path, "utf8")).toBe("new");
  expect(fs.readdirSync(f.root).filter((name) => name.endsWith(".tmp"))).toEqual([]);
});

it.each(["EPERM", "EACCES", "ENOSPC"])("bounds retry and preserves old data on persistent %s", (code) => {
  const f = wikiFixture();
  fixtures.push(f);
  f.write("receipt.json", "old");
  const path = join(f.root, "receipt.json");
  vi.mocked(fs.renameSync).mockImplementation(() => {
    throw Object.assign(new Error("cannot replace"), { code });
  });
  expect(() => atomicText(path, "new")).toThrow("cannot replace");
  expect(fs.readFileSync(path, "utf8")).toBe("old");
  expect(fs.renameSync).toHaveBeenCalledTimes(code === "ENOSPC" ? 1 : 5);
  expect(fs.readdirSync(f.root).filter((name) => name.endsWith(".tmp"))).toEqual([]);
});
