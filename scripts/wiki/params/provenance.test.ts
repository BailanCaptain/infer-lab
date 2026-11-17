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

it("recovers exact pinned definitions across same-name fields when display titles change", () => {
  const f = wikiFixture();
  try {
    const file = "vllm_ascend/config.py";
    const source =
      "class AscendCompilationConfig:\n    size: int = 128\n\nclass KVPPConfig:\n    size: int = 1\n";
    f.write(`repo/${file}`, source);
    const commit = f.commit("two size definitions");
    const entries = scanSources({ [file]: source }).filter((row) => row.name === "size");
    const [first, second] = entries as [(typeof entries)[0], (typeof entries)[0]];

    const page1 = buildParamPage({
      repo: "r",
      ref: "main",
      commit,
      entry: first,
      date: "2026-11-16",
    }).replace(/^title:.*$/m, "title: npu_compilation_config.size");
    const page2 = buildParamPage(
      {
        repo: "r",
        ref: "main",
        commit,
        entry: { ...second, confidence: "suspect" },
        date: "2026-11-16",
        pageId: "size-kvpp",
      },
      buildParamPage({
        repo: "r",
        ref: "main",
        commit,
        entry: second,
        date: "2026-11-16",
        pageId: "size-kvpp",
      }),
    ).replace(/^title:.*$/m, "title: KVPP 组大小（KVPPConfig.size）");

    expect(parameterDefinition(`${f.root}/repo`, page1)).toMatchObject({
      class: "AscendCompilationConfig",
      name: "size",
      line: 2,
    });
    expect(parameterDefinition(`${f.root}/repo`, page2)).toMatchObject({
      class: "KVPPConfig",
      name: "size",
      line: 5,
    });
    expect(
      parameterDefinition(`${f.root}/repo`, page2.replace("KVPPConfig.size", "AscendCompilationConfig.size")),
    ).toMatchObject({
      class: "KVPPConfig",
      name: "size",
      line: 5,
    });
    expect(() =>
      parameterDefinition(
        `${f.root}/repo`,
        page2.replace("| `KVPPConfig.size` |", "| `AscendCompilationConfig.size` |"),
      ),
    ).toThrow("不能唯一定位参数定义");
  } finally {
    f.cleanup();
  }
});

it("recovers class-rooted pinned parameter identity when single-file scan emits coarse additional_config path", () => {
  const f = wikiFixture();
  try {
    const file = "vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/yuanrong_backend.py";
    const source = "class YuanrongConfig:\n    use_layerwise: bool = False\n";
    f.write(`repo/${file}`, source);
    const commit = f.commit("yuanrong config");
    const [scanned] = scanSources({ [file]: source });
    expect(scanned).toMatchObject({
      class: "YuanrongConfig",
      name: "use_layerwise",
      json_path: 'additional_config["use_layerwise"]',
    });
    const pinnedPage = buildParamPage({
      repo: "vllm-ascend",
      ref: "releases/v0.30.0rc2",
      commit,
      entry: { ...scanned!, json_path: 'YuanrongConfig["use_layerwise"]' },
      date: "2026-11-03",
      pageId: "use-layerwise-b475778cd352",
    }).replace(/^title:.*$/m, "title: YuanrongConfig.use_layerwise");

    expect(parameterDefinition(`${f.root}/repo`, pinnedPage)).toMatchObject({
      class: "YuanrongConfig",
      name: "use_layerwise",
      line: 2,
    });
    expect(() =>
      parameterDefinition(
        `${f.root}/repo`,
        pinnedPage.replace('YuanrongConfig["use_layerwise"]', 'OtherConfig["use_layerwise"]'),
      ),
    ).toThrow("不能唯一定位参数定义");
  } finally {
    f.cleanup();
  }
});
