/**
 * 把 wiki/HANDBOOK.md 按 H2 切成六片，分别注入不同角色的 agent。
 * 程序只做索引（切片），不做语义判断；H3 及以下归属当前 H2；前言与未知 H2 丢弃。
 * 思路借自 Multi-Agent packages/api/src/wiki/handbook-slicer.ts。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const HANDBOOK_H2 = {
  pageFormat: "页面格式",
  extract: "提取",
  integrate: "整合",
  query: "查询",
  lint: "Lint",
  human: "人类须知",
} as const;
export type HandbookSliceKey = keyof typeof HANDBOOK_H2;
export type HandbookSlices = Record<HandbookSliceKey, string>;

export class HandbookSliceMissingError extends Error {
  constructor(readonly key: HandbookSliceKey) {
    super(`HANDBOOK 缺少 H2 切片「${HANDBOOK_H2[key]}」（${key}）`);
    this.name = "HandbookSliceMissingError";
  }
}

const H2_TO_KEY = new Map<string, HandbookSliceKey>(
  (Object.entries(HANDBOOK_H2) as [HandbookSliceKey, string][]).map(([k, h]) => [h, k]),
);

export function sliceHandbook(content: string): HandbookSlices {
  const slices: HandbookSlices = { pageFormat: "", extract: "", integrate: "", query: "", lint: "", human: "" };
  let current: HandbookSliceKey | null = null;
  for (const line of content.split(/\r?\n/)) {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m) {
      current = H2_TO_KEY.get((m[1] ?? "").trim()) ?? null;
      if (current) slices[current] += `${line}\n`;
      continue;
    }
    if (current) slices[current] += `${line}\n`;
  }
  for (const key of Object.keys(HANDBOOK_H2) as HandbookSliceKey[]) {
    if (!slices[key].trim()) throw new HandbookSliceMissingError(key);
  }
  return slices;
}

export function loadHandbook(wikiRoot: string): HandbookSlices {
  return sliceHandbook(readFileSync(join(wikiRoot, "HANDBOOK.md"), "utf8"));
}
