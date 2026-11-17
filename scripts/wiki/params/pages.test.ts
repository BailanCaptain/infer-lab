import { expect, it } from "vitest";
import { wikiFixture } from "../test-fixture";
import { buildParamPage, paramId, protectedParamSection } from "./pages";
import { scanSources } from "./scan";

it("builds a valid stable page id for a mixed-case configuration key", () => {
  const [entry] = scanSources({
    "vllm_ascend/config.py": "class StoreConfig:\n    dram_size_per_dp_GB: int = 0\n",
  });
  const text = buildParamPage({
    repo: "r",
    ref: "main",
    commit: "a".repeat(40),
    entry: entry!,
    date: "2026-10-08",
  });
  expect(text).toContain("title: dram_size_per_dp_GB");
  expect(paramId(entry!)).toMatch(/^dram-size-per-dp-gb-[a-f0-9]{12}$/);
});

it("refreshes generated facts while preserving authored explanation and distinguishes nested same-name fields", () => {
  const [row] = scanSources({ "vllm_ascend/config.py": "class ExampleConfig:\n    limit: int = 1\n" });
  const input = { repo: "vllm-ascend", ref: "main", commit: "a".repeat(40), entry: row!, date: "2026-09-15" };
  const first = buildParamPage(input);
  expect(buildParamPage(input, first)).toBe(first);
  const authored = first.replace("骨架，待补：为什么存在。", "限制队列可以防止资源耗尽。[D]");
  const next = buildParamPage({ ...input, entry: { ...row!, default: "2" } }, authored);
  expect(next).toContain("限制队列可以防止资源耗尽。");
  expect(protectedParamSection(next)).toContain("2");
  expect(paramId({ ...row!, json_path: 'additional_config["nested"]["limit"]' })).not.toBe(paramId(row!));
  expect(() => buildParamPage({ ...input, entry: { ...row!, confidence: "suspect" } })).toThrow(/复核/);
});

it("shows an unconfirmed field identity without inventing a writable configuration path", () => {
  const [row] = scanSources({ "vllm_ascend/config.py": "class KVPPConfig:\n    size: int = 1\n" });
  const input = { repo: "r", ref: "main", commit: "a".repeat(40), entry: row!, date: "2026-11-10" };
  const previous = buildParamPage(input);
  const next = buildParamPage(
    { ...input, pageId: paramId(row!), entry: { ...row!, confidence: "suspect" } },
    previous,
  );
  expect(protectedParamSection(next)).toContain("字段身份（不代表用户输入入口） | `KVPPConfig.size`");
  expect(protectedParamSection(next)).not.toContain('additional_config["size"]');
});

it("refreshes an already-confirmed parameter page with a contextual display title and rejects mismatched field class", () => {
  const entries = scanSources({
    "vllm_ascend/config.py":
      "class AscendCompilationConfig:\n    size: int = 128\n\nclass KVPPConfig:\n    size: int = 1\n",
  }).filter((r) => r.name === "size");
  const [compSize, kvppSize] = entries as [(typeof entries)[0], (typeof entries)[0]];
  const id = paramId(kvppSize);
  const initial = buildParamPage({
    repo: "r",
    ref: "main",
    commit: "a".repeat(40),
    entry: kvppSize,
    date: "2026-11-10",
    pageId: id,
  }).replace(/^title:.*$/m, "title: KVPPConfig.size");

  // Swapping frontmatter id/title onto kvppSize's initial `| 标识 |` page cannot confirm compSize!
  const swappedPrior = initial
    .replace(/^id:.*$/m, `id: ${paramId(compSize)}`)
    .replace(/^title:.*$/m, "title: npu_compilation_config.size");
  expect(() =>
    buildParamPage(
      {
        repo: "r",
        ref: "main",
        commit: "a".repeat(40),
        entry: { ...compSize, confidence: "suspect" },
        date: "2026-11-16",
        pageId: paramId(compSize),
      },
      swappedPrior,
    ),
  ).toThrow(/复核/);

  const refreshed = buildParamPage(
    {
      repo: "r",
      ref: "main",
      commit: "b".repeat(40),
      entry: { ...kvppSize, confidence: "suspect" },
      date: "2026-11-16",
      pageId: id,
    },
    initial,
  );
  expect(refreshed).toContain("title: KVPPConfig.size");
  expect(protectedParamSection(refreshed)).toContain("字段身份（不代表用户输入入口） | `KVPPConfig.size`");

  // Passing compSize against kvppSize's pinned field-identity page must be rejected!
  expect(() =>
    buildParamPage(
      {
        repo: "r",
        ref: "main",
        commit: "c".repeat(40),
        entry: { ...compSize, confidence: "suspect" },
        date: "2026-11-16",
        pageId: id,
      },
      refreshed,
    ),
  ).toThrow(/复核/);
});

it("preserves valid legacy classless page across line relocation with pinned repo and rejects same-value wrong class with or without repo context", () => {
  const f = wikiFixture();
  try {
    const file = "vllm_ascend/config.py";
    const source = "class FirstConfig:\n    size: int = 1\n\nclass SecondConfig:\n    size: int = 1\n";
    f.write(`repo/${file}`, source);
    const oldCommit = f.commit("equal defaults");
    const entries = scanSources({ [file]: source }).filter((r) => r.name === "size");
    const [first, second] = entries as [(typeof entries)[0], (typeof entries)[0]];
    const legacyPages = [first, second].map((entry) =>
      buildParamPage({ repo: "r", ref: "fixed", commit: oldCommit, entry, date: "2026-11-16" }).replace(
        /^\| 所属类 \| `[^`]*` \|\r?\n/gm,
        "",
      ),
    );
    f.write(`repo/${file}`, `\n${source}`);
    const nextCommit = f.commit("line shift");
    const next = scanSources({ [file]: `\n${source}` }).filter((r) => r.name === "size");
    const baseInput = {
      repo: "r",
      ref: "next",
      commit: nextCommit,
      entry: { ...next[0]!, confidence: "suspect" as const },
      date: "2026-11-16",
      pageId: paramId(first),
    };
    const relocated = buildParamPage({ ...baseInput, repoDir: `${f.root}/repo` }, legacyPages[0]);
    expect(protectedParamSection(relocated)).toContain("字段身份（不代表用户输入入口） | `FirstConfig.size`");

    const swappedSameValues = legacyPages[1]!.replace(/^id:.*$/m, `id: ${paramId(first)}`);
    expect(() => buildParamPage({ ...baseInput, repoDir: `${f.root}/repo` }, swappedSameValues)).toThrow(
      /复核/,
    );
    expect(() => buildParamPage(baseInput, swappedSameValues)).toThrow(/复核/);
  } finally {
    f.cleanup();
  }
});
