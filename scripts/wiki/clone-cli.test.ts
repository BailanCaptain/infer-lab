import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { wikiFixture } from "./test-fixture";

const fixtures: ReturnType<typeof wikiFixture>[] = [];
afterEach(() => {
  for (const f of fixtures.splice(0)) f.cleanup();
});

describe("wiki:clone existing pins", () => {
  it("updates existing release pins and refuses dirty working trees before changing HEAD", () => {
    const f = wikiFixture();
    fixtures.push(f);
    f.write("repo/a.py", "old\n");
    const old = f.commit("old");
    f.write("repo/a.py", "new\n");
    const current = f.commit("new");
    const seeds = (pin: string) =>
      f.write(
        "seeds.yaml",
        `repos:\n  r:\n    url: ${pathToFileURL(join(f.root, "repo")).href}\n    path: tools/repos/r\n    refs: {main: ${current}, release: ${pin}}\nfeatures: []\n`,
      );
    seeds(old);
    const first = f.cli("wiki-clone", ["--seeds", "seeds.yaml"]);
    expect(first.status, first.stderr).toBe(0);
    seeds(current);
    const update = f.cli("wiki-clone", ["--seeds", "seeds.yaml"]);
    expect(update.status, update.stderr).toBe(0);
    expect(f.git(["rev-parse", "HEAD"], "tools/repos/r@release")).toBe(current);
    f.write("tools/repos/r@release/a.py", "user edit\n");
    seeds(old);
    const dirty = f.cli("wiki-clone", ["--seeds", "seeds.yaml"]);
    expect(dirty.status).toBe(1);
    expect(dirty.stderr).toMatch(/未提交|dirty/);
    expect(f.git(["rev-parse", "HEAD"], "tools/repos/r@release")).toBe(current);
    expect(readFileSync(join(f.root, "tools/repos/r@release/a.py"), "utf8")).toBe("user edit\n");
  }, 30_000);
});
