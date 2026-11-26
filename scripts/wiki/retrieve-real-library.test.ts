import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { deriveParamDisplayTitle } from "../../src/content/wiki/param-display";
import {
  buildIndex,
  deserializeSearchIndex,
  retrieve,
  serializeSearchIndex,
} from "../../src/content/wiki/retrieve";
import { registrySchema } from "../../src/content/wiki/schema";
import { loadPages } from "./pages";

/**
 * 真实知识库上的短查询 / 单复合标识符回归（2026-11 检索加固）：
 * 只断言产品明确要求的首位与「只返回真正相关页」，其余排序交给 engineering-eval 基准。
 */
describe("真实知识库检索回归：名称词首与单复合标识符", () => {
  const root = process.cwd();
  const registry = registrySchema.parse(
    JSON.parse(readFileSync(join(root, "src/content/wiki/registry.json"), "utf8")),
  );
  const bodyByFile = new Map(loadPages(join(root, "wiki")).pages.map((p) => [p.file, p.body.trim()]));
  const pages = registry.pages.map((page) => {
    const body = bodyByFile.get(page.file) ?? "";
    const derived = deriveParamDisplayTitle(page, body);
    return { ...page, ...(derived !== page.title ? { displayTitle: derived } : {}), text: body };
  });
  const fullIndex = buildIndex(pages);
  const browserIndex = deserializeSearchIndex(
    JSON.parse(JSON.stringify(serializeSearchIndex(fullIndex, "e".repeat(64)))),
  );
  const has = (id: string) => registry.pages.some((p) => p.id === id);

  it.each([
    ["DSP", "dspark"],
    ["dspa", "dspark"],
    ["dfl", "dspark"],
    ["moon", "mooncake-connector"],
    ["spec", "speculative-decoding"],
    ["chunk", "lmcache"],
    ["allreduce", "collective-communication"],
    ["AllReduce", "collective-communication"],
  ])("%s 的首位是 %s，且构建索引与浏览器还原索引完全一致", (query, expected) => {
    expect(has(expected), `目标页 ${expected} 必须存在`).toBe(true);
    const hits = retrieve(query, fullIndex, { limit: 20 });
    expect(hits[0]?.id).toBe(expected);
    expect(retrieve(query, browserIndex, { limit: 20 })).toEqual(hits);
  });

  it("3 字母前缀认领页超过扇出时若别无命中，仍给出低置信度候选（moo 不再零结果）", () => {
    expect(
      retrieve("moo", fullIndex, { limit: 5 })
        .slice(0, 3)
        .map((h) => h.id),
    ).toContain("mooncake-connector");
  });

  it("initial_verify_budget_per_req 在大 limit 下只返回 dspark 一个直接页", () => {
    expect(has("dspark")).toBe(true);
    const hits = retrieve("initial_verify_budget_per_req", fullIndex, { limit: 200 });
    expect(hits.map((h) => h.id)).toEqual(["dspark"]);
    expect(retrieve("initial_verify_budget_per_req", browserIndex, { limit: 200 })).toEqual(hits);
  });

  it("泛化短词不获得词首奖励，长句异常不被短名称劫持", () => {
    for (const q of ["npu", "api", "max", "num", "get", "llm"]) {
      expect(
        retrieve(q, fullIndex, { limit: 200 }).filter((h) => h.how === "fuzzy"),
        q,
      ).toEqual([]);
    }
    const trace = retrieve("NPU out of memory during capture_model", fullIndex, { limit: 3 }).map(
      (h) => h.id,
    );
    expect(trace).not.toContain("hardware-devices");
  });
});
