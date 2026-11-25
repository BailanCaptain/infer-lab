import { expect, it } from "vitest";
import { parsePage } from "../pages";
import { wikiFixture } from "../test-fixture";
import { hasPublishedParentParamPage, isNestedAdditionalConfigSubKey, parameterPageId } from "./identities";
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

it("resolves explicit bindings and guards legacy pages by pinned parameter identity when display titles include parent context", () => {
  const f = wikiFixture();
  try {
    const file = "vllm_ascend/config.py";
    const entries = scanSources({
      [file]: "class AscendCompilationConfig:\n    size: int = 128\n\nclass KVPPConfig:\n    size: int = 1\n",
    }).filter((e) => e.name === "size");
    expect(entries).toHaveLength(2);
    const [first, second] = entries as [(typeof entries)[0], (typeof entries)[0]];
    const firstId = paramId(first);
    const secondId = paramId(second);

    const firstPage = parsePage(
      `params/${firstId}.md`,
      buildParamPage({
        repo: "r",
        ref: "main",
        commit: "a".repeat(40),
        entry: first,
        date: "2026-11-16",
      }).replace(/^title:.*$/m, "title: npu_compilation_config.size"),
    ).page!;
    const secondPage = parsePage(
      `params/${secondId}.md`,
      buildParamPage({
        repo: "r",
        ref: "main",
        commit: "a".repeat(40),
        entry: { ...second, confidence: "suspect", review: { verdict: "param", reason: "derived" } },
        date: "2026-11-16",
      })
        .replace(
          '| 标识 | `additional_config["size"]` |',
          "| 字段身份（不代表用户输入入口） | `KVPPConfig.size` |",
        )
        .replace(/^title:.*$/m, "title: KVPPConfig.size"),
    ).page!;

    f.write(
      "wiki/params/identities.json",
      JSON.stringify({
        schemaVersion: 1,
        bindings: [
          {
            repo: "r",
            file,
            class: first.class,
            json_path: first.json_path,
            pageId: firstId,
            role: "definition",
          },
          {
            repo: "r",
            file,
            class: second.class,
            json_path: second.json_path,
            pageId: secondId,
            role: "definition",
          },
        ],
      }),
    );
    expect(parameterPageId(f.root, "r", first, [firstPage, secondPage])).toBe(firstId);
    expect(parameterPageId(f.root, "r", second, [firstPage, secondPage])).toBe(secondId);

    // Cross-binding first entry to KVPPConfig.size's page must fail closed even though both have leaf name `size`!
    f.write(
      "wiki/params/identities.json",
      JSON.stringify({
        schemaVersion: 1,
        bindings: [
          {
            repo: "r",
            file,
            class: first.class,
            json_path: first.json_path,
            pageId: secondId,
            role: "definition",
          },
        ],
      }),
    );
    expect(() => parameterPageId(f.root, "r", first, [firstPage, secondPage])).toThrow(
      "参数身份映射目标不匹配",
    );

    // Even when ONLY the wrong target page (`| 标识 |` form) is present in inventory, both directions must reject!
    const secondPathPage = parsePage(
      `params/${secondId}.md`,
      buildParamPage({
        repo: "r",
        ref: "main",
        commit: "a".repeat(40),
        entry: second,
        date: "2026-11-16",
      }).replace(/^title:.*$/m, "title: kvpp_config.size"),
    ).page!;
    expect(() => parameterPageId(f.root, "r", first, [secondPathPage])).toThrow("参数身份映射目标不匹配");
    f.write(
      "wiki/params/identities.json",
      JSON.stringify({
        schemaVersion: 1,
        bindings: [
          {
            repo: "r",
            file,
            class: second.class,
            json_path: second.json_path,
            pageId: firstId,
            role: "definition",
          },
        ],
      }),
    );
    expect(() => parameterPageId(f.root, "r", second, [firstPage])).toThrow("参数身份映射目标不匹配");

    // Legacy unhashed page (`id: size`) with contextual display title still requires explicit mapping
    f.write("wiki/params/identities.json", JSON.stringify({ schemaVersion: 1, bindings: [] }));
    const legacyPage = parsePage(
      "params/size.md",
      buildParamPage({ repo: "r", ref: "main", commit: "a".repeat(40), entry: first, date: "2026-11-16" })
        .replace(`id: ${firstId}`, "id: size")
        .replace(/^title:.*$/m, "title: npu_compilation_config.size"),
    ).page!;
    expect(() => parameterPageId(f.root, "r", first, [legacyPage])).toThrow("旧参数页需要明确身份映射");
  } finally {
    f.cleanup();
  }
});

it("rejects cross-binding unhashed legacy classless pages in both directions via pinned Git definition", () => {
  const f = wikiFixture();
  try {
    const file = "vllm_ascend/config.py";
    const source = "class FirstConfig:\n    size: int = 1\n\nclass SecondConfig:\n    size: int = 1\n";
    f.write(`repo/${file}`, source);
    const oldCommit = f.commit("two size definitions");
    f.write(
      "wiki/seeds/r.yaml",
      `repos:\n  r:\n    url: https://github.com/example/r\n    path: repo\n    refs: { main: ${oldCommit} }\nfeatures: []\n`,
    );
    const entries = scanSources({ [file]: source }).filter((e) => e.name === "size");
    const [first, second] = entries as [(typeof entries)[0], (typeof entries)[0]];
    const legacyRaw = [first, second].map((entry) =>
      buildParamPage({ repo: "r", ref: "fixed", commit: oldCommit, entry, date: "2026-11-16" }).replace(
        /^\| 所属类 \| `[^`]*` \|\r?\n/gm,
        "",
      ),
    );
    for (const [i, entry] of [first, second].entries()) {
      const wrongId = i ? "legacy-first-size" : "legacy-second-size";
      const wrongPage = parsePage(
        `params/${wrongId}.md`,
        legacyRaw[1 - i]!.replace(/^id:.*$/m, `id: ${wrongId}`),
      ).page!;
      f.write(
        "wiki/params/identities.json",
        JSON.stringify({
          schemaVersion: 1,
          bindings: [
            {
              repo: "r",
              file,
              class: entry.class,
              json_path: entry.json_path,
              pageId: wrongId,
              role: "definition",
            },
          ],
        }),
      );
      expect(() => parameterPageId(f.root, "r", entry, [wrongPage])).toThrow("参数身份映射目标不匹配");
    }
  } finally {
    f.cleanup();
  }
});

it("enforces file scope on definition bindings for both explicit-class and legacy pages while preserving cross-file references", () => {
  const f = wikiFixture();
  try {
    const src = "class Config:\n    size: int = 1\n";
    const fileA = "vllm_ascend/a_config.py";
    const fileB = "vllm_ascend/b_config.py";
    f.write(`repo/${fileA}`, src);
    f.write(`repo/${fileB}`, src);
    const commit = f.commit("two files same class and field");
    f.write(
      "wiki/seeds/r.yaml",
      `repos:\n  r:\n    url: https://github.com/example/r\n    path: repo\n    refs: { main: ${commit} }\nfeatures: []\n`,
    );
    const entries = scanSources({ [fileA]: src, [fileB]: src });
    const left = entries.find((e) => e.file === fileA)!;
    const right = entries.find((e) => e.file === fileB)!;
    const prior = buildParamPage({
      repo: "r",
      ref: "main",
      commit,
      entry: right,
      pageId: "legacy-b-size",
      date: "2026-11-16",
    });

    for (const hasClassRow of [true, false]) {
      const raw = hasClassRow ? prior : prior.replace(/^\| 所属类 \| `[^`]*` \|\r?\n/gm, "");
      const page = parsePage("params/legacy-b-size.md", raw).page!;

      f.write(
        "wiki/params/identities.json",
        JSON.stringify({
          schemaVersion: 1,
          bindings: [
            {
              repo: "r",
              file: right.file,
              class: right.class,
              json_path: right.json_path,
              pageId: "legacy-b-size",
              role: "definition",
            },
          ],
        }),
      );
      expect(parameterPageId(f.root, "r", right, [page])).toBe("legacy-b-size");

      f.write(
        "wiki/params/identities.json",
        JSON.stringify({
          schemaVersion: 1,
          bindings: [
            {
              repo: "r",
              file: left.file,
              class: left.class,
              json_path: left.json_path,
              pageId: "legacy-b-size",
              role: "definition",
            },
          ],
        }),
      );
      expect(() => parameterPageId(f.root, "r", left, [page])).toThrow("参数身份映射目标不匹配");

      f.write(
        "wiki/params/identities.json",
        JSON.stringify({
          schemaVersion: 1,
          bindings: [
            {
              repo: "r",
              file: left.file,
              class: left.class,
              json_path: left.json_path,
              pageId: "legacy-b-size",
              role: "reference",
            },
          ],
        }),
      );
      expect(parameterPageId(f.root, "r", left, [page])).toBeUndefined();
    }
  } finally {
    f.cleanup();
  }
});

it("folds unauthored nested AscendConfig sub-keys into parent while preserving existing published sub-key pages and validating reference bindings", () => {
  const f = wikiFixture();
  try {
    const file = "vllm_ascend/ascend_config.py";
    const src = [
      "class SharedEngramConfig:",
      "    backend: str = 'a2'",
      "",
      "class AscendCompilationConfig:",
      "    enable_static_kernel: bool = False",
      "",
      "class ExpertOffloadConfig:",
      "    enabled: bool = False",
      "",
      "class AscendConfig:",
      "    shared_engram: SharedEngramConfig | None = None",
      "    ascend_compilation_config: AscendCompilationConfig | None = None",
      "    expert_offload_config: ExpertOffloadConfig | None = None",
      "    sub_feature_path: str | None = None",
      "    unrelated_flag: bool = False",
      "",
    ].join("\n");
    const entries = scanSources({ [file]: src });
    const parent = entries.find((e) => e.name === "shared_engram")!;
    const subBackend = entries.find((e) => e.name === "backend")!;
    const compStaticKernel = entries.find((e) => e.name === "enable_static_kernel")!;
    const expertOffloadParent = entries.find((e) => e.name === "expert_offload_config")!;
    const expertOffloadEnabled = entries.find((e) => e.name === "enabled")!;
    const siblingPath = entries.find((e) => e.name === "sub_feature_path")!;
    const unrelated = entries.find((e) => e.name === "unrelated_flag")!;

    expect(isNestedAdditionalConfigSubKey(parent)).toBe(false);
    expect(isNestedAdditionalConfigSubKey(subBackend)).toBe(true);
    expect(isNestedAdditionalConfigSubKey(compStaticKernel)).toBe(true);
    expect(isNestedAdditionalConfigSubKey(expertOffloadEnabled)).toBe(true);

    const parentId = paramId(parent);
    const parentRaw = buildParamPage({
      repo: "vllm-ascend",
      ref: "main",
      commit: "b".repeat(40),
      entry: parent,
      date: "2026-11-26",
    }).replace(/^type: param$/m, "type: param\naliases:\n  - sub_feature_path");
    const parentPage = parsePage(`params/${parentId}.md`, parentRaw).page!;

    // Draft-only parent (`_drafts/expert-offload-config-*.md`) must NOT trigger folding!
    const draftParentId = paramId(expertOffloadParent);
    const draftParentPage = parsePage(
      `_drafts/${draftParentId}.md`,
      buildParamPage({
        repo: "vllm-ascend",
        ref: "main",
        commit: "b".repeat(40),
        entry: expertOffloadParent,
        date: "2026-11-26",
      }),
    ).page!;

    // 1. Sub-key folds ONLY when a published `params/*.md` page exists for `json_path[0]`
    expect(hasPublishedParentParamPage(subBackend, [parentPage, draftParentPage])).toBe(true);
    expect(hasPublishedParentParamPage(compStaticKernel, [parentPage, draftParentPage])).toBe(false);
    expect(hasPublishedParentParamPage(expertOffloadEnabled, [parentPage, draftParentPage])).toBe(false);

    expect(parameterPageId(f.root, "vllm-ascend", parent, [parentPage])).toBe(parentId);
    expect(parameterPageId(f.root, "vllm-ascend", subBackend, [parentPage])).toBeUndefined();
    expect(parameterPageId(f.root, "vllm-ascend", compStaticKernel, [parentPage])).toBe(
      paramId(compStaticKernel),
    );
    expect(parameterPageId(f.root, "vllm-ascend", expertOffloadEnabled, [parentPage, draftParentPage])).toBe(
      paramId(expertOffloadEnabled),
    );

    // 2. Existing published sub-key pages continue to resolve their standalone pageId
    const publishedSubId = paramId(subBackend);
    const publishedSubPage = parsePage(
      `params/${publishedSubId}.md`,
      buildParamPage({
        repo: "vllm-ascend",
        ref: "main",
        commit: "b".repeat(40),
        entry: subBackend,
        date: "2026-11-26",
      }),
    ).page!;
    expect(parameterPageId(f.root, "vllm-ascend", subBackend, [parentPage, publishedSubPage])).toBe(
      publishedSubId,
    );

    // 3. Explicit reference bindings work for child json_path and aliased sibling keys, but reject unrelated keys
    f.write(
      "wiki/params/identities.json",
      JSON.stringify({
        schemaVersion: 1,
        bindings: [
          {
            repo: "vllm-ascend",
            file,
            class: subBackend.class,
            json_path: subBackend.json_path,
            pageId: parentId,
            role: "reference",
          },
          {
            repo: "vllm-ascend",
            file,
            class: siblingPath.class,
            json_path: siblingPath.json_path,
            pageId: parentId,
            role: "reference",
          },
        ],
      }),
    );
    expect(parameterPageId(f.root, "vllm-ascend", subBackend, [parentPage])).toBeUndefined();
    expect(parameterPageId(f.root, "vllm-ascend", siblingPath, [parentPage])).toBeUndefined();

    f.write(
      "wiki/params/identities.json",
      JSON.stringify({
        schemaVersion: 1,
        bindings: [
          {
            repo: "vllm-ascend",
            file,
            class: unrelated.class,
            json_path: unrelated.json_path,
            pageId: parentId,
            role: "reference",
          },
        ],
      }),
    );
    expect(() => parameterPageId(f.root, "vllm-ascend", unrelated, [parentPage])).toThrow(
      "参数身份映射目标不匹配",
    );
  } finally {
    f.cleanup();
  }
});
