import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { wikiFixture } from "../test-fixture";
import { buildParamPage, paramId } from "./pages";
import { scanSources } from "./scan";

it("plans canonical mapped ids and skips reference identities through the real ingestion CLI", () => {
  const f = wikiFixture();
  try {
    const source = "class ExampleConfig:\n    limit: int = 1\n";
    const entry = scanSources({ "config.py": source })[0]!;
    const data = { repo: "r", ref: "main", commit: "a".repeat(40), entries: [entry] };
    f.write("params.json", JSON.stringify(data));
    f.write(
      "wiki/params/legacy-limit.md",
      buildParamPage({ ...data, entry, date: "2026-10-08", pageId: "legacy-limit" }),
    );
    const bindings = [
      {
        repo: "r",
        file: entry.file,
        class: entry.class,
        json_path: entry.json_path,
        pageId: "legacy-limit",
        role: "definition",
      },
    ];
    f.write("wiki/params/identities.json", JSON.stringify({ schemaVersion: 1, bindings }));
    for (const name of ["limit", "legacy-limit", paramId(entry)]) {
      const result = f.cli("wiki-ingest", ["--params", name, "--input", "params.json", "--dry-run"]);
      expect(result.status, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({ targets: ["legacy-limit"], modelStarted: false });
    }
    const other = scanSources({ "other.py": "class OtherConfig:\n    limit: int = 2\n" })[0]!;
    f.write("params.json", JSON.stringify({ ...data, entries: [entry, other] }));
    const disambiguated = f.cli("wiki-ingest", [
      "--params",
      "legacy-limit",
      "--input",
      "params.json",
      "--dry-run",
    ]);
    expect(disambiguated.status, disambiguated.stderr).toBe(0);
    expect(JSON.parse(disambiguated.stdout)).toMatchObject({ targets: ["legacy-limit"] });
    const unmapped = f.cli("wiki-ingest", [
      "--params",
      paramId(other),
      "--input",
      "params.json",
      "--dry-run",
    ]);
    expect(unmapped.status).not.toBe(0);
    expect(unmapped.stderr).toContain("旧参数页需要明确身份映射");
    f.write("params.json", JSON.stringify(data));
    bindings[0]!.role = "reference";
    f.write("wiki/params/identities.json", JSON.stringify({ schemaVersion: 1, bindings }));
    const reference = f.cli("wiki-ingest", ["--params", "limit", "--input", "params.json", "--dry-run"]);
    expect(reference.status, reference.stderr).toBe(0);
    expect(JSON.parse(reference.stdout)).toMatchObject({
      targets: [],
      skippedReferences: ["limit"],
      modelStarted: false,
    });
  } finally {
    f.cleanup();
  }
});

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
