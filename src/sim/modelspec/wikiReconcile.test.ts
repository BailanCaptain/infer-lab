/// <reference types="node" />
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import matter from "gray-matter";
import { describe, expect, it } from "vitest";
import { analyzeKvPerToken, analyzeParams, type ParamBreakdown } from "./analyze";
import { evaluateDeployPlan, GIB, KIB, MIB } from "./deployCalculator";
import { getPresetSpec } from "./presets";

const WIKI_CONCEPTS_DIR = resolve(process.cwd(), "wiki/concepts");

interface ParsedWikiConcept {
  verified: readonly string[];
  body: string;
  tableRows: readonly string[][];
}

function splitMarkdownRow(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inCode = false;
  for (const ch of line.trim().replace(/^\|/, "").replace(/\|$/, "")) {
    if (ch === "`") inCode = !inCode;
    if (ch === "|" && !inCode) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function readConceptPage(slug: string): ParsedWikiConcept {
  const raw = readFileSync(resolve(WIKI_CONCEPTS_DIR, `${slug}.md`), "utf8");
  const parsed = matter(raw);
  const tableRows: string[][] = [];
  for (const line of parsed.content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    const cells = splitMarkdownRow(trimmed);
    if (cells.every((c) => /^:?-+:?$/.test(c))) continue;
    tableRows.push(cells);
  }
  return {
    verified: Array.isArray(parsed.data.verified) ? parsed.data.verified : [],
    body: parsed.content,
    tableRows,
  };
}

function findRow(rows: readonly string[][], needle: string): string[] {
  const exact = rows.find((r) => (r[0] ?? "") === needle || (r[0] ?? "").startsWith(needle));
  const hit = exact ?? rows.find((r) => (r[0] ?? "").includes(needle));
  expect(hit, `Expected table row containing "${needle}"`).toBeDefined();
  return hit!;
}

function extractExactInt(cell: string, targetValue: number): number {
  const formatted = targetValue.toLocaleString("en-US");
  const rawTokens = cell.match(/(?<![\d,.])\d+(?:,\d{3})*(?![\d,.])/g) ?? [];
  const parsedValues = rawTokens.map((tok) => Number.parseInt(tok.replace(/,/g, ""), 10));
  expect(
    parsedValues,
    `Expected standalone integer ${formatted} (${targetValue}) in "${cell}", found [${rawTokens.join(", ")}]`,
  ).toContain(targetValue);
  return targetValue;
}

function extractHeadTriplet(cell: string): [number, number, number] {
  const m = /`(\d+)`\s*\/\s*`(\d+)`\s*\/\s*`(\d+)`/.exec(cell);
  expect(m, `Expected backticked Q / KV / head_dim triplet in "${cell}"`).not.toBeNull();
  return [Number.parseInt(m![1]!, 10), Number.parseInt(m![2]!, 10), Number.parseInt(m![3]!, 10)];
}

function extractMetricFloat(cell: string, unitRe: RegExp): number {
  const m = unitRe.exec(cell);
  expect(m?.[1], `Expected float matching ${unitRe} in "${cell}"`).toBeDefined();
  return Number.parseFloat(m![1]!.replace(/,/g, ""));
}

function itemCount(params: ParamBreakdown, id: string): number {
  return params.items.find((it) => it.id === id)?.count ?? 0;
}

function perLayerAttnParams(params: ParamBreakdown, numLayers: number): number {
  const attnIds = ["layers.ln1", "layers.q", "layers.k", "layers.v", "layers.o", "layers.qn", "layers.kn"];
  return attnIds.reduce((sum, id) => sum + itemCount(params, id), 0) / numLayers;
}

function perLayerFfnResidentParams(params: ParamBreakdown, numLayers: number): number {
  return params.perLayer[0]!.total - perLayerAttnParams(params, numLayers);
}

function perLayerFfnActiveParams(params: ParamBreakdown, numLayers: number): number {
  return params.perLayer[0]!.active - perLayerAttnParams(params, numLayers);
}

describe("Wiki-to-Calculator Automated Parity (v0.30.0 Core Concept Pages)", () => {
  const q8Spec = getPresetSpec("qwen3-8b");
  const q30Spec = getPresetSpec("qwen3-30b-a3b");
  const q06Spec = getPresetSpec("qwen3-0.6b");
  const q8Params = analyzeParams(q8Spec);
  const q30Params = analyzeParams(q30Spec);
  const q06Params = analyzeParams(q06Spec);
  const q8Kv = analyzeKvPerToken(q8Spec, 2);
  const q30Kv = analyzeKvPerToken(q30Spec, 2);
  const q06Kv = analyzeKvPerToken(q06Spec, 2);

  it("verifies all 5 audited core Wiki pages carry releases/v0.30.0 verification", () => {
    for (const slug of ["hf-model-anatomy", "gqa", "moe", "kv-cache", "kv-cache-memory-profiling"] as const) {
      const page = readConceptPage(slug);
      expect(page.verified, `${slug}.md must be verified on releases/v0.30.0`).toContain("releases/v0.30.0");
    }
  });

  it("reconciles hf-model-anatomy.md architectural dimensions, parameter counts, BF16 weights, and KV bytes", () => {
    const page = readConceptPage("hf-model-anatomy");

    // 1. Summary table: Qwen3-8B, Qwen3-30B-A3B, Qwen3-0.6B
    const layersRow = findRow(page.tableRows, "num_hidden_layers");
    expect(extractExactInt(layersRow[1]!, q8Spec.layers.length)).toBe(36);
    expect(extractExactInt(layersRow[2]!, q30Spec.layers.length)).toBe(48);
    expect(extractExactInt(layersRow[3]!, q06Spec.layers.length)).toBe(28);

    const hiddenRow = findRow(page.tableRows, "hidden_size");
    expect(extractExactInt(hiddenRow[1]!, q8Spec.hidden)).toBe(4096);
    expect(extractExactInt(hiddenRow[2]!, q30Spec.hidden)).toBe(2048);
    expect(extractExactInt(hiddenRow[3]!, q06Spec.hidden)).toBe(1024);

    const headsRow = findRow(page.tableRows, "Q 头数 / KV 头数");
    expect(extractHeadTriplet(headsRow[1]!)).toEqual([
      q8Spec.layers[0]!.attention.numHeads,
      q8Spec.layers[0]!.attention.numKvHeads,
      q8Spec.layers[0]!.attention.headDim,
    ]);
    expect(extractHeadTriplet(headsRow[2]!)).toEqual([
      q30Spec.layers[0]!.attention.numHeads,
      q30Spec.layers[0]!.attention.numKvHeads,
      q30Spec.layers[0]!.attention.headDim,
    ]);
    expect(extractHeadTriplet(headsRow[3]!)).toEqual([
      q06Spec.layers[0]!.attention.numHeads,
      q06Spec.layers[0]!.attention.numKvHeads,
      q06Spec.layers[0]!.attention.headDim,
    ]);

    const summaryBf16Row = findRow(page.tableRows, "BF16 纯权重占用");
    expect(extractMetricFloat(summaryBf16Row[1]!, /([\d.]+)\s*GiB/)).toBeCloseTo(
      (q8Params.total * 2) / GIB,
      2,
    );
    expect(extractMetricFloat(summaryBf16Row[2]!, /([\d.]+)\s*GiB/)).toBeCloseTo(
      (q30Params.total * 2) / GIB,
      2,
    );
    expect(extractMetricFloat(summaryBf16Row[3]!, /([\d.]+)\s*GiB/)).toBeCloseTo(
      (q06Params.total * 2) / GIB,
      2,
    );

    const summaryKvRow = findRow(page.tableRows, "每 token BF16 KV cache（全层）");
    expect(extractMetricFloat(summaryKvRow[1]!, /([\d.]+)\s*KiB/)).toBeCloseTo(q8Kv.bytesPerToken / KIB, 1);
    expect(extractMetricFloat(summaryKvRow[2]!, /([\d.]+)\s*KiB/)).toBeCloseTo(q30Kv.bytesPerToken / KIB, 1);
    expect(extractMetricFloat(summaryKvRow[3]!, /([\d.]+)\s*KiB/)).toBeCloseTo(q06Kv.bytesPerToken / KIB, 1);

    // 2. Module-by-module exact parameter & byte ledger
    const embedRow = findRow(page.tableRows, "首端 `embed_tokens`");
    expect(extractExactInt(embedRow[1]!, itemCount(q8Params, "embed"))).toBe(622_329_856);
    expect(extractExactInt(embedRow[2]!, itemCount(q30Params, "embed"))).toBe(311_164_928);

    const attnRow = findRow(page.tableRows, "单层 Attention");
    expect(extractExactInt(attnRow[1]!, perLayerAttnParams(q8Params, q8Spec.numLayers))).toBe(41_947_392);
    expect(extractExactInt(attnRow[2]!, perLayerAttnParams(q30Params, q30Spec.numLayers))).toBe(18_876_672);

    const ffnResidentRow = findRow(page.tableRows, "单层前馈：全量驻留");
    expect(extractExactInt(ffnResidentRow[1]!, perLayerFfnResidentParams(q8Params, q8Spec.numLayers))).toBe(
      150_999_040,
    );
    expect(extractExactInt(ffnResidentRow[2]!, perLayerFfnResidentParams(q30Params, q30Spec.numLayers))).toBe(
      604_243_968,
    );

    const ffnActiveRow = findRow(page.tableRows, "单层前馈：单步激活");
    expect(extractExactInt(ffnActiveRow[1]!, perLayerFfnActiveParams(q8Params, q8Spec.numLayers))).toBe(
      150_999_040,
    );
    expect(extractExactInt(ffnActiveRow[2]!, perLayerFfnActiveParams(q30Params, q30Spec.numLayers))).toBe(
      38_012_928,
    );

    const totalParamRow = findRow(page.tableRows, "整模型总参数");
    expect(extractExactInt(totalParamRow[1]!, q8Params.total)).toBe(8_190_735_360);
    expect(extractExactInt(totalParamRow[2]!, q30Params.total)).toBe(30_532_122_624);

    const activeParamRow = findRow(page.tableRows, "单 token 激活参数");
    expect(extractExactInt(activeParamRow[1]!, q8Params.active)).toBe(8_190_735_360);
    expect(extractExactInt(activeParamRow[2]!, q30Params.active)).toBe(3_353_032_704);

    const bf16BytesRow = findRow(page.tableRows, "BF16 纯权重静态显存");
    expect(extractExactInt(bf16BytesRow[1]!, q8Params.total * 2)).toBe(16_381_470_720);
    expect(extractExactInt(bf16BytesRow[2]!, q30Params.total * 2)).toBe(61_064_245_248);

    const perLayerKvRow = findRow(page.tableRows, "单层每 token BF16 KV cache");
    expect(extractExactInt(perLayerKvRow[1]!, q8Kv.perLayer[0]!.bytes)).toBe(4_096);
    expect(extractExactInt(perLayerKvRow[2]!, q30Kv.perLayer[0]!.bytes)).toBe(2_048);
  });

  it("reconciles gqa.md and moe.md projection shapes, expert sizing, and per-token KV ratios", () => {
    const gqaPage = readConceptPage("gqa");
    const gqa8Row = findRow(gqaPage.tableRows, "**`Qwen3-8B`**");
    const gqa30Row = findRow(gqaPage.tableRows, "**`Qwen3-30B-A3B`**");

    expect(gqa8Row[1]).toContain("32Q : 8KV");
    expect(gqa8Row[2]).toContain("[4096, 1024]");
    expect(extractExactInt(gqa8Row[3]!, q8Kv.perLayer[0]!.bytes)).toBe(4_096);
    expect(extractMetricFloat(gqa8Row[4]!, /([\d.]+)\s*KiB\/tok/)).toBeCloseTo(q8Kv.bytesPerToken / KIB, 1);
    expect(extractMetricFloat(gqa8Row[4]!, /(\d+)\s*MiB/)).toBe((q8Kv.bytesPerToken * 4096) / MIB);

    expect(gqa30Row[1]).toContain("32Q : 4KV");
    expect(gqa30Row[2]).toContain("[2048, 4096]");
    expect(gqa30Row[2]).toContain("[2048, 512]");
    expect(extractExactInt(gqa30Row[3]!, q30Kv.perLayer[0]!.bytes)).toBe(2_048);
    expect(extractMetricFloat(gqa30Row[4]!, /([\d.]+)\s*KiB\/tok/)).toBeCloseTo(q30Kv.bytesPerToken / KIB, 1);
    expect(extractMetricFloat(gqa30Row[4]!, /(\d+)\s*MiB/)).toBe((q30Kv.bytesPerToken * 4096) / MIB);

    const moePage = readConceptPage("moe");
    const mlp0 = q30Spec.layers[0]!.mlp;
    expect(mlp0.kind).toBe("moe");
    if (mlp0.kind === "moe") {
      const singleExpertParams = 3 * q30Spec.hidden * mlp0.moeIntermediate;
      const layerRoutedParams = mlp0.numExperts * singleExpertParams;
      const activeRoutedParams = mlp0.topK * singleExpertParams;
      const routerParams = q30Spec.hidden * mlp0.numExperts;

      const singleExpertRow = findRow(moePage.tableRows, "单个路由专家");
      expect(extractExactInt(singleExpertRow[2]!, singleExpertParams)).toBe(4_718_592);
      expect(extractMetricFloat(singleExpertRow[2]!, /([\d.]+)\s*MiB/)).toBeCloseTo(
        (singleExpertParams * 2) / MIB,
        2,
      );

      const allExpertsRow = findRow(moePage.tableRows, "单层 `128` 个路由专家合计");
      expect(extractExactInt(allExpertsRow[2]!, layerRoutedParams)).toBe(603_979_776);
      expect(extractMetricFloat(allExpertsRow[2]!, /([\d.]+)\s*GiB/)).toBeCloseTo(
        (layerRoutedParams * 2) / GIB,
        3,
      );

      const activeExpertsRow = findRow(moePage.tableRows, "单 token 本层激活专家");
      expect(extractExactInt(activeExpertsRow[2]!, activeRoutedParams)).toBe(37_748_736);
      expect(q30Spec.hidden + routerParams + layerRoutedParams).toBe(
        perLayerFfnResidentParams(q30Params, q30Spec.numLayers),
      );
      expect(q30Spec.hidden + routerParams + activeRoutedParams).toBe(
        perLayerFfnActiveParams(q30Params, q30Spec.numLayers),
      );
    }
  });

  it("reconciles kv-cache.md and kv-cache-memory-profiling.md against evaluateDeployPlan (BF16, W8A8, TP=1/4/8)", () => {
    const kvPage = readConceptPage("kv-cache");
    const memPage = readConceptPage("kv-cache-memory-profiling");

    // 1. Exact per-token bytes in kv-cache.md: 147,456 B (8B), 98,304 B (30B-A3B full), 24,576 B (30B-A3B TP=4 & TP=8)
    const tokRow = findRow(kvPage.tableRows, "1 token 单层 / 全模型");
    expect(extractExactInt(tokRow[1]!, q8Kv.bytesPerToken)).toBe(147_456);
    expect(extractExactInt(tokRow[2]!, q30Kv.bytesPerToken)).toBe(98_304);
    expect(extractMetricFloat(tokRow[3]!, /(\d+)\s*KiB\s*\/\s*卡/)).toBe(24);
    const tp8ReplicationLine = kvPage.body
      .split("\n")
      .find((line) => line.includes("边界与例外") && line.includes("TP = 8"));
    expect(tp8ReplicationLine).toBeDefined();
    expect(
      extractMetricFloat(
        tp8ReplicationLine!,
        /`TP = 8`\s*下每卡仍驻留\s*`1`\s*个头（即\s*`(\d+)\s*KiB\/tok`）/,
      ),
    ).toBe(24);

    // 2. Qwen3-8B BF16 TP=1 on Atlas A2 64 GiB (u=0.92)
    const plan8B = evaluateDeployPlan({
      model: "qwen3-8b",
      cardId: "a2-64g",
      weightPrecision: "bf16",
      kvCacheDtype: "auto",
      tpSize: 1,
      gpuMemoryUtilization: 0.92,
    });
    // 3. Qwen3-30B-A3B W8A8_DYNAMIC TP=4 + EP=4 on Atlas A2 64 GiB (u=0.92)
    const plan30BTp4 = evaluateDeployPlan({
      model: "qwen3-30b-a3b",
      cardId: "a2-64g",
      weightPrecision: "w8a8_dynamic",
      kvCacheDtype: "auto",
      tpSize: 4,
      dpSize: 1,
      enableEp: true,
      gpuMemoryUtilization: 0.92,
    });
    // 4. Qwen3-30B-A3B TP=8 KV head replication check (n_kv=4 < TP=8 => replicas=2, still 24,576 B/tok)
    const plan30BTp8 = evaluateDeployPlan({
      model: "qwen3-30b-a3b",
      cardId: "a2-64g",
      weightPrecision: "w8a8_dynamic",
      kvCacheDtype: "auto",
      tpSize: 8,
      dpSize: 1,
      enableEp: true,
    });
    expect(plan30BTp4.fourQuestions.q2Capacity.kvBytesPerTokenPerRank).toBe(24_576);
    expect(plan30BTp8.fourQuestions.q2Capacity.kvBytesPerTokenPerRank).toBe(24_576);
    expect(8 / q30Spec.layers[0]!.attention.numKvHeads).toBe(2);

    const stage12Row = findRow(memPage.tableRows, "1–2. 总显存与实例预算");
    expect(extractMetricFloat(stage12Row[1]!, /预算\s*`([\d.]+)\s*GiB`/)).toBeCloseTo(
      plan8B.requestedBytes / GIB,
      2,
    );
    expect(extractMetricFloat(stage12Row[1]!, /留\s*`([\d.]+)\s*GiB`/)).toBeCloseTo(
      plan8B.unbudgetedHeadroomBytes / GIB,
      2,
    );

    const stage3Row = findRow(memPage.tableRows, "3. 常驻权重");
    expect(extractMetricFloat(stage3Row[1]!, /([\d.]+)\s*GiB/)).toBeCloseTo(
      plan8B.stages[2]!.pointEstimateBytes / GIB,
      2,
    );
    expect(extractMetricFloat(stage3Row[2]!, /([\d.]+)\s*GiB/)).toBeCloseTo(
      plan30BTp4.stages[2]!.pointEstimateBytes / GIB,
      2,
    );

    const stage5Row = findRow(memPage.tableRows, "5. 非 Torch 增量");
    const hccl8BMatch = /world\((\d+)M\)\s*\+\s*dp\((\d+)M\)/.exec(stage5Row[1]!);
    expect(hccl8BMatch, `Expected world(<n>M) + dp(<m>M) in "${stage5Row[1]}"`).not.toBeNull();
    const worldMiB = Number.parseInt(hccl8BMatch![1]!, 10);
    const dpMiB = Number.parseInt(hccl8BMatch![2]!, 10);
    expect([worldMiB, dpMiB]).toEqual([200, 50]);
    expect(worldMiB + dpMiB).toBe(plan8B.hcclEstimate.totalMaterializedMiB);
    expect(extractMetricFloat(stage5Row[2]!, /(\d+)\s*MiB/)).toBe(
      plan30BTp4.hcclEstimate.totalMaterializedMiB,
    );

    const stage6Row = findRow(memPage.tableRows, "6. 可用 KV 池");
    expect(extractMetricFloat(stage6Row[1]!, /([\d.]+)\s*MiB/)).toBeCloseTo(
      plan8B.fourQuestions.q2Capacity.kvBytesPerBlock / MIB,
      3,
    );
    expect(extractMetricFloat(stage6Row[2]!, /([\d.]+)\s*MiB/)).toBeCloseTo(
      plan30BTp4.fourQuestions.q2Capacity.kvBytesPerBlock / MIB,
      3,
    );
  });
});
