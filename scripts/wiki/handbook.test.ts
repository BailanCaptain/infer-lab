import { describe, expect, it } from "vitest";
import { HANDBOOK_H2, HandbookSliceMissingError, loadHandbook, sliceHandbook } from "./handbook";
import { lintPages } from "./lint";
import { parsePage } from "./pages";

const doc = `---
title: x
---
# 前言（不进任何切片）

## 页面格式
A1
### 子节
A2

## 提取
B

## 整合
C

## 查询
D

## Lint
E

## 人类须知
F

## 未知标题
丢弃
`;

describe("sliceHandbook", () => {
  it("按 H2 切六片，H3 归当前片，标题行保留，未知 H2 与前言丢弃", () => {
    const s = sliceHandbook(doc);
    expect(s.pageFormat).toBe("## 页面格式\nA1\n### 子节\nA2\n\n");
    expect(s.extract.trim()).toBe("## 提取\nB");
    expect(s.human.trim()).toBe("## 人类须知\nF");
    expect(JSON.stringify(s)).not.toContain("丢弃");
    expect(JSON.stringify(s)).not.toContain("前言");
  });
  it("任一切片缺失即抛错并指名", () => {
    expect(() => sliceHandbook(doc.replace("## 查询\nD\n", ""))).toThrow(HandbookSliceMissingError);
    expect(() => sliceHandbook(doc.replace("## 查询\nD\n", ""))).toThrow(/查询/);
  });
  it("真实 HANDBOOK.md 六片齐全", () => {
    const s = loadHandbook(`${process.cwd()}/wiki`);
    for (const key of Object.keys(HANDBOOK_H2) as (keyof typeof HANDBOOK_H2)[]) {
      expect(s[key].length, key).toBeGreaterThan(50);
    }
  });
  it("问答编译规则给出的证据标记能够通过实际 lint", () => {
    const rules = loadHandbook(`${process.cwd()}/wiki`).pageFormat;
    const instruction = rules
      .split("\n")
      .find((line) => line.startsWith("任务若指定 `purpose: answer-record`"))!;
    const marks = instruction.match(/\[[SCMDIA!]\d*\]/g) ?? [];
    expect(marks.length).toBeGreaterThan(0);
    const page = parsePage(
      "sources/answer.md",
      `---\nid: answer\ntitle: Answer\ntype: source\nsummary: 归档问答\nsources: [raw:sha256-${"a".repeat(64)}.md#L1]\nevidence: I\nupdated: '2026-09-15'\n---\n## 一句话\n${marks.join(" ")}\n`,
    ).page!;
    expect(
      lintPages([page], { chapterIds: [], existsFile: () => true }).filter((p) => p.rule.startsWith("mark-")),
    ).toEqual([]);
  });
});
