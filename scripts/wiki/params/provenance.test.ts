import { expect, it } from "vitest";
import { wikiFixture } from "../test-fixture";
import { buildParamPage } from "./pages";
import { parameterDefinition } from "./provenance";
import { scanSources } from "./scan";

it("binds lineage to the cited class and rejects a mismatched generated definition", () => {
  const f = wikiFixture();
  try {
    const file = "vllm_ascend/config.py";
    const source = "class OtherConfig:\n    size: int = 4\nclass KVPPConfig:\n    size: int = 1\n";
    f.write(`repo/${file}`, source);
    const commit = f.commit("definitions");
    const entry = scanSources({ [file]: source }).find((row) => row.class === "KVPPConfig")!;
    const text = buildParamPage({ repo: "r", ref: "main", commit, entry, date: "2026-11-03" });
    expect(parameterDefinition(`${f.root}/repo`, text)).toMatchObject({
      class: "KVPPConfig",
      name: "size",
      line: 4,
    });
    expect(() => parameterDefinition(`${f.root}/repo`, text.replace("config.py:4`", "config.py:2`"))).toThrow(
      "不匹配",
    );
  } finally {
    f.cleanup();
  }
});
