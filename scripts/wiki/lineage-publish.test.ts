import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { publishLineage } from "./lineage-publish";
import { wikiFixture } from "./test-fixture";

it("refuses an entire batch when a page changed after Git computation, preserving all newer edits", async () => {
  const f = wikiFixture();
  try {
    f.write("wiki/_drafts/a.md", "old a");
    f.write("wiki/_drafts/b.md", "new user text");
    await expect(
      publishLineage(f.root, [
        { path: "wiki/_drafts/a.md", before: "old a", after: "computed a" },
        { path: "wiki/_drafts/b.md", before: "old b", after: "computed b" },
      ]),
    ).rejects.toThrow("变化");
    expect(readFileSync(join(f.root, "wiki/_drafts/a.md"), "utf8")).toBe("old a");
    expect(readFileSync(join(f.root, "wiki/_drafts/b.md"), "utf8")).toBe("new user text");
  } finally {
    f.cleanup();
  }
});
