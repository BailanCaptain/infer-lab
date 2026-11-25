import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  buildIndex,
  deserializeSearchIndex,
  retrieve,
  serializeSearchIndex,
} from "../../src/content/wiki/retrieve";
import { registrySchema } from "../../src/content/wiki/schema";
import { loadAgentWiki } from "./agent-access";
import { loadPages } from "./pages";

const evalCaseSchema = z
  .object({
    id: z.string().min(1),
    category: z.enum(["error-trace", "exact-param", "exact-concept", "arch-deploy", "negative"]),
    query: z.string().min(1),
    expectedTop1: z.string().min(1).optional(),
    expectedAnyTop3: z.array(z.string().min(1)).min(1).optional(),
    expectEmpty: z.boolean().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.expectEmpty) {
      if (val.category !== "negative") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${val.id}: expectEmpty cases must use category="negative"`,
        });
      }
      if (val.expectedTop1 || val.expectedAnyTop3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${val.id}: negative cases cannot declare expectedTop1/expectedAnyTop3`,
        });
      }
    } else if (!val.expectedAnyTop3 || val.expectedAnyTop3.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${val.id}: every positive eval case must declare non-empty expectedAnyTop3`,
      });
    }
  });

const evalSuiteSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  cases: z.array(evalCaseSchema).min(55),
});

describe("engineering-eval-suite（193 页真实知识库工程检索与负例基准）", () => {
  const root = process.cwd();
  const registry = registrySchema.parse(
    JSON.parse(readFileSync(join(root, "src/content/wiki/registry.json"), "utf8")),
  );
  const bodyByFile = new Map(loadPages(join(root, "wiki")).pages.map((p) => [p.file, p.body.trim()]));
  const pages = registry.pages.map((page) => ({
    ...page,
    text: bodyByFile.get(page.file) ?? "",
  }));
  const fullIndex = buildIndex(pages);
  const browserIndex = deserializeSearchIndex(serializeSearchIndex(fullIndex, "e".repeat(64)));
  const agentWiki = loadAgentWiki(root);

  const suite = evalSuiteSchema.parse(
    JSON.parse(readFileSync(new URL("./engineering-eval-suite.json", import.meta.url), "utf8")),
  );

  it("真实 registry.json 包含 193 篇正式页面（含 41 篇正式参数页），基准集含 55+ 条正向查询与负例对照", () => {
    expect(registry.pages.length).toBeGreaterThanOrEqual(193);
    expect(registry.pages.filter((p) => p.type === "param").length).toBeGreaterThanOrEqual(41);

    const knownIds = new Set(registry.pages.map((p) => p.id));
    const positives = suite.cases.filter((c) => !c.expectEmpty);
    const negatives = suite.cases.filter((c) => c.expectEmpty);
    expect(positives.length).toBeGreaterThanOrEqual(55);
    expect(negatives.length).toBeGreaterThanOrEqual(5);

    for (const c of positives) {
      if (c.expectedTop1) expect(knownIds.has(c.expectedTop1), `${c.id}: ${c.expectedTop1}`).toBe(true);
      for (const expectedId of c.expectedAnyTop3 ?? []) {
        expect(knownIds.has(expectedId), `${c.id}: ${expectedId}`).toBe(true);
      }
    }
  });

  it("满足精确参数/概念 Top-1 = 100%、正向工程查询 Top-3 召回率 >= 95%、虚构负例零误命中，且浏览器序列化索引完全一致", () => {
    const positives = suite.cases.filter((c) => !c.expectEmpty);
    const exactCases = positives.filter((c) => Boolean(c.expectedTop1));
    const negatives = suite.cases.filter((c) => c.expectEmpty);

    const exactMisses: string[] = [];
    const top3Misses: string[] = [];

    for (const c of positives) {
      const hits = retrieve(c.query, fullIndex, { limit: 5 });
      const browserHits = retrieve(c.query, browserIndex, { limit: 5 });
      expect(browserHits, `serialized parity for ${c.id}`).toEqual(hits);

      const agentHits = agentWiki.search(c.query, 5);
      expect(agentHits[0]?.id, `agentWiki parity for ${c.id}`).toBe(hits[0]?.id);

      const top3Ids = hits.slice(0, 3).map((h) => h.id);
      if (c.expectedTop1 && hits[0]?.id !== c.expectedTop1) {
        exactMisses.push(
          `${c.id} ("${c.query}") -> got #1=${hits[0]?.id ?? "none"}, expected ${c.expectedTop1}`,
        );
      }
      if (c.expectedAnyTop3 && !c.expectedAnyTop3.some((id) => top3Ids.includes(id))) {
        top3Misses.push(
          `${c.id} ("${c.query}") -> top3=[${top3Ids.join(", ")}], expected one of [${c.expectedAnyTop3.join(", ")}]`,
        );
      }
    }

    expect(exactCases.length).toBeGreaterThanOrEqual(15);
    expect(exactMisses, "Exact param/concept Top-1 misses").toEqual([]);

    const top3Recall = (positives.length - top3Misses.length) / positives.length;
    expect(
      top3Recall,
      `Top-3 recall ${(top3Recall * 100).toFixed(1)}% < 95%; misses:\n${top3Misses.join("\n")}`,
    ).toBeGreaterThanOrEqual(0.95);

    for (const neg of negatives) {
      expect(retrieve(neg.query, fullIndex, { limit: 5 }), `negative case ${neg.id}`).toEqual([]);
      expect(retrieve(neg.query, browserIndex, { limit: 5 }), `browser negative case ${neg.id}`).toEqual([]);
      expect(agentWiki.search(neg.query, 5), `agentWiki negative case ${neg.id}`).toEqual([]);
    }
  });

  it("不依赖硬编码数字错误码路由表：未收录报错码的干净索引对 507015 / 507034 / 161002 返回空命中", () => {
    const cleanIndex = buildIndex([
      {
        id: "inference-troubleshooting",
        title: "通用排障导览",
        summary: "演示不含任何数字错误码时的检索行为。",
        aliases: [],
        chapters: ["19"],
        evidence: "C",
        relations: [],
        text: "## 先看阶段边界\n\n当请求超时时，先核对入口与调度日志。",
      },
    ]);
    for (const code of ["507015", "507034", "507035", "161002", "107030"]) {
      expect(retrieve(code, cleanIndex, { limit: 5 })).toEqual([]);
    }
  });
});
