import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { findPageByName } from "./page-names";
import {
  deriveParamDisplayTitle,
  pageDisplayTitle,
  parsePinnedParamIdentity,
  protectedParamSection,
} from "./param-display";
import { createReaderStore } from "./reader-store";
import { buildIndex, deserializeSearchIndex, retrieve, serializeSearchIndex } from "./retrieve";
import { Term } from "./Term";
import { buildToc } from "./toc";

const SIZE_BODY = `## 一句话

正文说明。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 字段身份（不代表用户输入入口） | \`KVPPConfig.size\` |
| 所属类 | \`KVPPConfig\` |
| 类型 | \`int\` |
| 默认表达式 | \`1\` |
| 定义 | \`vllm_ascend/ascend_config.py:66\` [C19] |
| 版本 | releases/v0.30.0rc2 · 7d825229c77025cfb185a010c25819c1214b9450 |
`;

const SUPER_KERNEL_BODY = `## 一句话

正文说明。

## 参数定义（自动生成）

| 项 | 静态记录 |
| --- | --- |
| 标识 | \`additional_config["ascend_compilation_config"]["enable_super_kernel"]\` |
| 所属类 | \`AscendCompilationConfig\` |
| 类型 | \`bool\` |
| 默认表达式 | \`False\` |
| 定义 | \`vllm_ascend/ascend_config.py:126\` [C30] |
| 版本 | releases/v0.30.0rc2 · 7d825229c77025cfb185a010c25819c1214b9450 |
`;

const STAIR_BODY = `## 参数定义（自动生成）

| 项 | 静态记录 |
| --- | --- |
| 标识 | \`additional_config["eplb_config"]["stair_config"]["absolute_balance_threshold"]\` |
| 所属类 | \`StairConfig\` |
| 定义 | \`vllm_ascend/ascend_config.py:221\` [C24] |
| 版本 | releases/v0.30.0rc2 · 7d825229c77025cfb185a010c25819c1214b9450 |
`;

const HANDWRITTEN_BODY = `## 一句话

手写参数页，无自动生成节。

\`\`\`markdown
## 参数定义（自动生成）
| 标识 | \`additional_config["fake_parent"]["profiling_chunk_config"]\` |
\`\`\`
`;

describe("param-display · 浏览器安全的受保护参数展示名派生", () => {
  it("严格区分显式字段身份、确认嵌套路径与无确认身份的手写页，绝不把围栏示例或派生字段伪装成可写配置", () => {
    expect(deriveParamDisplayTitle({ type: "param", title: "size" }, SIZE_BODY)).toBe("KVPPConfig.size");
    expect(deriveParamDisplayTitle({ type: "param", title: "enable_super_kernel" }, SUPER_KERNEL_BODY)).toBe(
      "ascend_compilation_config.enable_super_kernel",
    );
    expect(deriveParamDisplayTitle({ type: "param", title: "absolute_balance_threshold" }, STAIR_BODY)).toBe(
      "stair_config.absolute_balance_threshold",
    );
    expect(
      deriveParamDisplayTitle(
        { type: "param", title: "动态切块配置（profiling_chunk_config）" },
        HANDWRITTEN_BODY,
      ),
    ).toBe("动态切块配置（profiling_chunk_config）");
    expect(protectedParamSection(HANDWRITTEN_BODY)).toBeUndefined();
    expect(parsePinnedParamIdentity(HANDWRITTEN_BODY)).toBeUndefined();

    // 非参数页即使包含同名表格也不改写展示名
    expect(deriveParamDisplayTitle({ type: "concept", title: "size" }, SIZE_BODY)).toBe("size");
  });

  it("检索索引序列化/反序列化后，支持用稳定 id、文件名、legacyIds、原 title、aliases 与派生展示名检索并统一返回展示名", () => {
    const rawPages = [
      {
        id: "size-40a1c2ca47b8",
        file: "params/size-40a1c2ca47b8.md",
        legacyIds: ["legacy-kvpp-size"],
        title: "size",
        displayTitle: "KVPPConfig.size",
        aliases: ["KVPP 组大小", "kvpp_size"],
        summary: "KVPPConfig 里唯一的字段",
        chapters: ["11"],
        evidence: "C",
        text: "KVPP 把层分成几份的除数",
      },
      {
        id: "enable-super-kernel-ce990e186bfa",
        file: "params/enable-super-kernel-ce990e186bfa.md",
        title: "enable_super_kernel",
        displayTitle: "ascend_compilation_config.enable_super_kernel",
        aliases: ["SuperKernel 开关"],
        summary: "控制算子融合的编译开关",
        chapters: ["13"],
        evidence: "C",
        text: "开启 SuperKernel 子图调度",
      },
    ];
    const serialized = serializeSearchIndex(buildIndex(rawPages), "a".repeat(64));
    const index = deserializeSearchIndex(serialized);

    for (const query of [
      "size-40a1c2ca47b8",
      "size-40a1c2ca47b8.md",
      "params/size-40a1c2ca47b8.md",
      "legacy-kvpp-size",
      "size",
      "KVPP 组大小",
      "KVPPConfig.size",
      "KVPPConfig",
    ]) {
      const hits = retrieve(query, index, { limit: 5 });
      expect(hits[0]?.id, `query=${query}`).toBe("size-40a1c2ca47b8");
      expect(hits[0]?.title, `query=${query}`).toBe("KVPPConfig.size");
    }

    for (const query of [
      "enable-super-kernel-ce990e186bfa",
      "enable_super_kernel",
      "SuperKernel 开关",
      "ascend_compilation_config.enable_super_kernel",
      "ascend_compilation_config",
    ]) {
      const hits = retrieve(query, index, { limit: 5 });
      expect(hits[0]?.id, `query=${query}`).toBe("enable-super-kernel-ce990e186bfa");
      expect(hits[0]?.title, `query=${query}`).toBe("ascend_compilation_config.enable_super_kernel");
    }
  });

  it("目录排序、精确名称查找、reader-store、Term 与站内链接均对齐派生展示名", () => {
    const entryA = {
      id: "size-40a1c2ca47b8",
      file: "params/size-40a1c2ca47b8.md",
      title: "size",
      displayTitle: "KVPPConfig.size",
      type: "param" as const,
      origin: "seed" as const,
      summary: "KVPP 除数",
      aliases: ["KVPP 组大小"],
      chapters: ["11"],
      order: 500,
      prerequisites: [],
      sources: ["https://example.com/a"],
      verified: ["main"],
      evidence: "C" as const,
      relations: [],
      related: [],
      contradicts: [],
      updated: "2026-11-03",
      backlinks: [],
    };
    const entryB = {
      ...entryA,
      id: "enable-super-kernel-ce990e186bfa",
      file: "params/enable-super-kernel-ce990e186bfa.md",
      title: "enable_super_kernel",
      displayTitle: "ascend_compilation_config.enable_super_kernel",
    };

    expect(findPageByName([entryA, entryB], "KVPPConfig.size")?.id).toBe("size-40a1c2ca47b8");
    expect(findPageByName([entryA, entryB], "size")?.id).toBe("size-40a1c2ca47b8");

    const toc = buildToc([entryA, entryB]);
    expect(toc[0]?.sections.flatMap((s) => s.pages.map((p) => pageDisplayTitle(p)))).toEqual([
      "ascend_compilation_config.enable_super_kernel",
      "KVPPConfig.size",
    ]);
    const uncuratedToc = buildToc([
      { ...entryA, id: "uncurated-size" },
      { ...entryB, id: "uncurated-super-kernel" },
    ]);
    expect(uncuratedToc[0]?.sections[0]?.pages.map((p) => pageDisplayTitle(p))).toEqual([
      "ascend_compilation_config.enable_super_kernel",
      "KVPPConfig.size",
    ]);

    // 即使上层传入未预填 displayTitle 的快照 fixture，reader-store 也会从 pageTexts 一致派生展示名
    const rawEntry = { ...entryA };
    delete (rawEntry as { displayTitle?: string }).displayTitle;
    const rev = "b".repeat(64);
    const store = createReaderStore({
      revision: rev,
      registry: { version: 1, pages: [rawEntry] },
      pageTexts: [{ file: rawEntry.file, text: `---\nid: ${rawEntry.id}\n---\n${SIZE_BODY}` }],
      skipped: [],
      searchIndex: serializeSearchIndex(buildIndex([{ ...rawEntry, text: SIZE_BODY }]), rev),
    });
    expect(pageDisplayTitle(store.getState().pages[0]!)).toBe("KVPPConfig.size");

    // 真实知识库 Term 词条默认展示名
    const termHtml = renderToStaticMarkup(
      createElement(MemoryRouter, null, createElement(Term, { id: "kvpp-config-0445bd352140" })),
    );
    expect(termHtml).toContain("AscendConfig.kvpp_config");
  });

  it("文件名检索仅在存在真实 file 元数据时写入精确表，不向无 file 的 DropDiscovery 或压平模糊表注入 .md 键", () => {
    const dropLikeIndex = buildIndex([
      {
        id: "chunked-prefill",
        title: "Chunked Prefill",
        aliases: ["分块预填充"],
        summary: "把长提示词拆成固定位置预算分块执行",
        chapters: ["06"],
        evidence: "C",
        text: "分块预填充与 decode 同批执行",
      },
    ]);
    expect(dropLikeIndex.exact.has("chunked-prefill.md")).toBe(false);
    expect(dropLikeIndex.squashed.has("chunkedprefillmd")).toBe(false);

    const readerLikeIndex = deserializeSearchIndex(
      serializeSearchIndex(
        buildIndex([
          {
            id: "chunked-prefill",
            file: "concepts/chunked-prefill.md",
            title: "Chunked Prefill",
            aliases: ["分块预填充"],
            summary: "把长提示词拆成固定位置预算分块执行",
            chapters: ["06"],
            evidence: "C",
            text: "分块预填充与 decode 同批执行",
          },
        ]),
        "c".repeat(64),
      ),
    );
    expect(readerLikeIndex.exact.has("chunked-prefill.md")).toBe(true);
    expect(readerLikeIndex.exact.has("concepts/chunked-prefill.md")).toBe(true);
    expect(readerLikeIndex.squashed.has("chunkedprefillmd")).toBe(false);
    expect(readerLikeIndex.squashed.has("conceptschunkedprefillmd")).toBe(false);
  });
});
