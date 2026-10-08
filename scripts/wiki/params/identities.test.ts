import { expect, it } from "vitest";
import { parsePage } from "../pages";
import { wikiFixture } from "../test-fixture";
import { parameterPageId } from "./identities";
import { buildParamPage, paramId } from "./pages";
import { scanSources } from "./scan";

it("reuses an existing exact identity when distinct parameter scopes share a name", () => {
  const f = wikiFixture();
  try {
    const entries = scanSources({
      "vllm_ascend/config.py":
        "class FirstConfig:\n    limit: int = 1\n\nclass SecondConfig:\n    limit: int = 2\n",
    });
    expect(entries).toHaveLength(2);
    const pages = entries.map(
      (entry) =>
        parsePage(
          `params/${paramId(entry)}.md`,
          buildParamPage({ repo: "r", ref: "main", commit: "a".repeat(40), entry, date: "2026-10-08" }),
        ).page!,
    );
    for (const entry of entries) expect(parameterPageId(f.root, "r", entry, pages)).toBe(paramId(entry));
  } finally {
    f.cleanup();
  }
});
