import { expect, it } from "vitest";
import { buildParamPage } from "./params/pages";
import { scanSources } from "./params/scan";
import { wikiFixture } from "./test-fixture";

it("does not report unchanged when an upstream ref cannot be read", () => {
  const f = wikiFixture();
  try {
    const source = "class ExampleConfig:\n    limit: int = 1\n";
    f.write("repo/vllm_ascend/config.py", source);
    const commit = f.commit("initial");
    f.write(
      "seeds.yaml",
      `repos:\n  r:\n    url: https://example.test/r\n    path: repo\n    refs: {main: ${commit}}\nfeatures: []\n`,
    );
    f.write(
      "wiki/params/limit.md",
      buildParamPage({
        repo: "r",
        ref: "main",
        commit,
        entry: scanSources({ "vllm_ascend/config.py": source })[0]!,
        date: "2026-09-16",
      }),
    );
    const result = f.cli("wiki-stale", ["--seeds", "seeds.yaml"]);
    expect(result.status).not.toBe(0);
    expect(result.stdout).not.toContain("都没变");
  } finally {
    f.cleanup();
  }
});
