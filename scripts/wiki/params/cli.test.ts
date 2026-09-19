import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { wikiFixture } from "../test-fixture";
import { paramId } from "./pages";
import { scanSources } from "./scan";

it("builds one verified skeleton via the real CLI and preserves prose on an idempotent refresh", () => {
  const f = wikiFixture();
  try {
    const source = "class ExampleConfig:\n    limit: int = 1\n";
    f.write("repo/vllm_ascend/config.py", source);
    const commit = f.commit("config (#1)");
    f.git(["tag", "v1"]);
    const entries = scanSources({ "vllm_ascend/config.py": source });
    f.write("params.json", JSON.stringify({ repo: "r", ref: "main", commit, entries }));
    f.write(
      "seeds.yaml",
      `repos:\n  r:\n    url: https://example.test/r\n    path: repo\n    refs: {main: ${commit}}\nfeatures: []\n`,
    );
    const args = ["--input", "params.json", "--seeds", "seeds.yaml", "--only", "limit"];
    const first = f.cli("wiki-build-param-pages", args);
    expect(first.status, first.stderr).toBe(0);
    const file = `wiki/params/${paramId(entries[0]!)}.md`;
    const body = readFileSync(join(f.root, file), "utf8").replace(
      "骨架，待补：为什么存在。",
      "保留人工解释。[D]",
    );
    f.write(file, body);
    const second = f.cli("wiki-build-param-pages", args);
    expect(second.status, second.stderr).toBe(0);
    expect(readFileSync(join(f.root, file), "utf8")).toBe(body);
    expect(body).toContain("## 版本谱系");
    expect(body).toContain("v1");
    const lint = f.cli("wiki-lint", []);
    expect(lint.status, lint.stderr + lint.stdout).toBe(0);
  } finally {
    f.cleanup();
  }
});
