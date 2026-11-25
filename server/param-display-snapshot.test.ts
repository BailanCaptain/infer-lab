import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkContent } from "../scripts/check-content";
import { runBuild } from "../scripts/wiki/build";
import { diagramRefs } from "../scripts/wiki/diagrams";
import { generatedSection as generatedSectionLineage } from "../scripts/wiki/lineage";
import { parsePage } from "../scripts/wiki/pages";
import {
  PARAM_SECTION as PARAM_SECTION_NODE,
  parsePinnedParamIdentity as parsePinnedNode,
  protectedParamSection as protectedSectionNode,
} from "../scripts/wiki/params/pages";
import {
  deriveParamDisplayTitle,
  generatedSection as generatedSectionShared,
  PARAM_SECTION as PARAM_SECTION_SHARED,
  pageDisplayTitle,
  parsePinnedParamIdentity as parsePinnedShared,
  protectedParamSection as protectedSectionShared,
} from "../src/content/wiki/param-display";
import { deserializeSearchIndex, retrieve } from "../src/content/wiki/retrieve";
import { parseRawRef, registrySchema } from "../src/content/wiki/schema";
import { readKnowledgeSnapshot, readReaderSnapshot } from "./snapshot";

const REPO_ROOT = process.cwd();

const ORACLE_ROWS = [
  {
    id: "size-40a1c2ca47b8",
    file: "params/size-40a1c2ca47b8.md",
    sha256: "f604d3c5355ba8188ea20093508b8130d71923fb58da5cbe3ed618fdd80d1123",
    expectedDisplay: "KVPPConfig.size",
  },
  {
    id: "enable-super-kernel-ce990e186bfa",
    file: "params/enable-super-kernel-ce990e186bfa.md",
    sha256: "ae18cf830b19d5826492e587045030da2c858c1a90d66fb0071eab02d3308f3c",
    expectedDisplay: "ascend_compilation_config.enable_super_kernel",
  },
  {
    id: "absolute-balance-threshold-71578a0c428d",
    file: "params/absolute-balance-threshold-71578a0c428d.md",
    sha256: "2b021b4eb2776d0538fb393b40e2b799b419f2accea4866719a385bda7951dbe",
    expectedDisplay: "stair_config.absolute_balance_threshold",
  },
  {
    id: "profiling-chunk-config",
    file: "params/profiling-chunk-config.md",
    sha256: "4d907884fe316f22d394f7443d2808937b88c2791502e3994dcebb5ef6f9711b",
    expectedDisplay: "动态切块配置（profiling_chunk_config）",
  },
] as const;

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function copyIntoTemp(tempRoot: string, relPath: string): void {
  const src = join(REPO_ROOT, relPath);
  const dst = join(tempRoot, relPath);
  mkdirSync(dirname(dst), { recursive: true });
  copyFileSync(src, dst);
}

const EXPECTED_FORMAL_PARAM_IDS = [
  "absolute-balance-threshold-71578a0c428d",
  "block-table-no-commit-optimize-8328d0d2d00d",
  "c8-enable-reshape-optim-8bd7e5f82c6c",
  "combine-quant-mode-2a3f7cd47997",
  "cross-node-transfer-limit-06ee92260b7a",
  "enable-async-exponential",
  "enable-force-eplb-b7ec3661121f",
  "enable-matmul-allreduce",
  "enable-pcp-embedding-lmhead-weight-sharding-91c5a17a08c9",
  "enable-pcp-o-proj-weight-sharding-8528cf5af9c6",
  "enable-sleep-mode-extra-cleanup",
  "enable-super-kernel-ce990e186bfa",
  "fuse-allreduce-rms",
  "fused-op-type-fc0f5fcd7be0",
  "gdn-internal-prefill-checkpoints-50f5ac80d583",
  "kv-pool-range-debug-83e8b165addd",
  "kvpp-config-0445bd352140",
  "layer-sharding",
  "load-risk-quantile-d89a080ba048",
  "load-window-bins-cc21068b082d",
  "megamoe-shared-expert-fusion-5a99901d47e6",
  "multistream-engram-overlap-29113aa3f8fc",
  "multistream-overlap-gate",
  "placement-search-backtrack-limit-82b03cef98b0",
  "prefetch-ratio",
  "profiling-chunk-config",
  "quantized-all-reduce-config-3cc69e492011",
  "rank-transfer-limit-99529b37d91d",
  "relative-balance-threshold-bcbc40e7dc87",
  "replica-search-beam-size-6556d1650a62",
  "replica-search-num-stages-e4b10925ff97",
  "replica-search-radius-cd3118b5aae5",
  "runtime-config-abb228bbf148",
  "runtime-config-hot-reload-9c9ab794933a",
  "sfa-dcp-force-tmajor-restore-6d9c266d3ece",
  "shared-engram-31bf0d820403",
  "size-40a1c2ca47b8",
  "stair-config-cca9e594a052",
  "use-fused-overlap-75a180fff6ab",
  "use-layerwise-b475778cd352",
  "weight-prefetch-config",
] as const;

describe("param-display snapshot parity · 单一真相源重导出与隔离临时副本快照校验", () => {
  it("lineage / params/pages 与前端共用同一纯函数引用，41 篇正式参数页保持只读，快照构建在隔离临时目录运行并清理", async () => {
    // 1. P4 单一真相源：Node 旧入口与浏览器公共入口导出完全同一函数/常量引用
    expect(generatedSectionLineage).toBe(generatedSectionShared);
    expect(PARAM_SECTION_NODE).toBe(PARAM_SECTION_SHARED);
    expect(protectedSectionNode).toBe(protectedSectionShared);
    expect(parsePinnedNode).toBe(parsePinnedShared);

    // 2. 主工作区只读核对：记录运行前真实缓存状态（绝不写、不删、不回滚主仓 tools/wiki-runtime）
    const repoCachePath = join(REPO_ROOT, "tools/wiki-runtime/reader-snapshot.bin");
    const repoCacheBefore = existsSync(repoCachePath)
      ? { mtimeMs: statSync(repoCachePath).mtimeMs, sha256: sha256File(repoCachePath) }
      : null;

    for (const row of ORACLE_ROWS) {
      expect(sha256File(join(REPO_ROOT, "wiki", row.file))).toBe(row.sha256);
    }

    const staticRegistry = registrySchema.parse(
      JSON.parse(readFileSync(join(REPO_ROOT, "src/content/wiki/registry.json"), "utf8")),
    );
    const paramFiles = readdirSync(join(REPO_ROOT, "wiki/params"))
      .filter((name) => name.endsWith(".md"))
      .sort();
    expect(paramFiles.length).toBe(41);
    expect(paramFiles).toEqual(EXPECTED_FORMAL_PARAM_IDS.map((id) => `${id}.md`));

    for (const name of paramFiles) {
      const rel = `params/${name}`;
      const raw = readFileSync(join(REPO_ROOT, "wiki", rel), "utf8");
      const parsed = parsePage(rel, raw);
      expect(parsed.problems, rel).toEqual([]);
      const entry = staticRegistry.pages.find((p) => p.file === rel);
      expect(entry, rel).toBeDefined();
      const display = deriveParamDisplayTitle(entry!, raw);
      expect(display.length, rel).toBeGreaterThan(0);
    }

    // 3. 在独立临时根目录中复制 4 篇真实 oracle 参数页及其直接引用的 raw/diagram，隔离验证快照与检索
    const tempRoot = mkdtempSync(join(tmpdir(), "infra-param-display-snapshot-"));
    try {
      copyIntoTemp(tempRoot, "wiki/HANDBOOK.md");
      for (const row of ORACLE_ROWS) {
        copyIntoTemp(tempRoot, `wiki/${row.file}`);
        const raw = readFileSync(join(REPO_ROOT, "wiki", row.file), "utf8");
        const parsed = parsePage(row.file, raw).page!;
        for (const rawPath of parsed.fm.rawSources ?? []) {
          copyIntoTemp(tempRoot, `wiki/${rawPath}`);
        }
        for (const srcRef of parsed.fm.sources) {
          const r = parseRawRef(srcRef);
          if (r) copyIntoTemp(tempRoot, `wiki/${r.path}`);
        }
        for (const diagId of diagramRefs(parsed.body)) {
          for (const ext of ["yaml", "svg"]) {
            const relDiag = `wiki/diagrams/${diagId}.${ext}`;
            if (existsSync(join(REPO_ROOT, relDiag))) copyIntoTemp(tempRoot, relDiag);
          }
        }
      }

      expect(runBuild(tempRoot)).toEqual({ pageCount: ORACLE_ROWS.length, problems: 0 });
      expect(checkContent(tempRoot).pageCount).toBe(ORACLE_ROWS.length);

      const reader = await readReaderSnapshot(tempRoot);
      const knowledge = await readKnowledgeSnapshot(tempRoot);
      expect(existsSync(join(tempRoot, "tools/wiki-runtime/reader-snapshot.bin"))).toBe(true);

      const deserialized = deserializeSearchIndex(reader.searchIndex);
      for (const row of ORACLE_ROWS) {
        const readerEntry = reader.registry.pages.find((p) => p.id === row.id)!;
        const knowledgeEntry = knowledge.registry.pages.find((p) => p.id === row.id)!;
        expect(pageDisplayTitle(readerEntry)).toBe(row.expectedDisplay);
        expect(pageDisplayTitle(knowledgeEntry)).toBe(row.expectedDisplay);

        const hitsByDisplay = retrieve(row.expectedDisplay, deserialized, { limit: 5 });
        expect(hitsByDisplay.some((h) => h.id === row.id && h.title === row.expectedDisplay)).toBe(true);

        const hitsById = retrieve(row.id, deserialized, { limit: 5 });
        expect(hitsById[0]?.id).toBe(row.id);
        expect(hitsById[0]?.title).toBe(row.expectedDisplay);

        const hitsByOrigTitle = retrieve(readerEntry.title, deserialized, { limit: 5 });
        expect(hitsByOrigTitle.some((h) => h.id === row.id && h.title === row.expectedDisplay)).toBe(true);
      }

      // 在隔离临时副本内更新受保护字段身份，验证快照 revision、displayTitle 与检索索引联动刷新
      const tempSizePath = join(tempRoot, "wiki/params/size-40a1c2ca47b8.md");
      const updatedSizeMd = readFileSync(tempSizePath, "utf8").replace(
        "| 字段身份（不代表用户输入入口） | `KVPPConfig.size` |",
        "| 字段身份（不代表用户输入入口） | `KVPPConfig.group_size` |",
      );
      writeFileSync(tempSizePath, updatedSizeMd, "utf8");
      const refreshed = await readReaderSnapshot(tempRoot);
      expect(refreshed.revision).not.toBe(reader.revision);
      const refreshedSize = refreshed.registry.pages.find((p) => p.id === "size-40a1c2ca47b8")!;
      expect(pageDisplayTitle(refreshedSize)).toBe("KVPPConfig.group_size");
      expect(retrieve("KVPPConfig.group_size", deserializeSearchIndex(refreshed.searchIndex))[0]?.title).toBe(
        "KVPPConfig.group_size",
      );
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
    expect(existsSync(tempRoot)).toBe(false);

    // 4. 确认主仓运行缓存与正式 oracle 字节全程零触碰
    const repoCacheAfter = existsSync(repoCachePath)
      ? { mtimeMs: statSync(repoCachePath).mtimeMs, sha256: sha256File(repoCachePath) }
      : null;
    expect(repoCacheAfter).toEqual(repoCacheBefore);
    for (const row of ORACLE_ROWS) {
      expect(sha256File(join(REPO_ROOT, "wiki", row.file))).toBe(row.sha256);
    }
  });
});
