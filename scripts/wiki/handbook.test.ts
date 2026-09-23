import { describe, expect, it } from "vitest";
import { HANDBOOK_H2, HANDBOOK_H3, HandbookSliceMissingError, loadHandbook, sliceHandbook } from "./handbook";
import { lintPages } from "./lint";
import { parsePage } from "./pages";
import { handbookFixture } from "./test-fixture";

const doc = `---
title: x
---
# 前言（不进任何切片）

## 页面格式
A1
### 读页约定
R
#### 读页约定里的小节
R2
### 子节
A2
### 可引来源
CI

## 提取
B

## 整合
C

## 查询
D

## 覆盖判定
G

## Lint
E

## 人类须知
F

## 未知标题
丢弃
`;

describe("sliceHandbook", () => {
  it("按 H2 切七片，H3 归当前片，标题行保留，未知 H2 与前言丢弃", () => {
    const s = sliceHandbook(doc);
    expect(s.pageFormat).toBe(
      "## 页面格式\nA1\n### 读页约定\nR\n#### 读页约定里的小节\nR2\n### 子节\nA2\n### 可引来源\nCI\n\n",
    );
    expect(s.extract.trim()).toBe("## 提取\nB");
    expect(s.coverage.trim()).toBe("## 覆盖判定\nG");
    expect(s.human.trim()).toBe("## 人类须知\nF");
    expect(JSON.stringify(s)).not.toContain("丢弃");
    expect(JSON.stringify(s)).not.toContain("前言");
  });
  it("「页面格式」下的读页约定与可引来源另成两片，仍留在页面格式里给写页的 agent", () => {
    const s = sliceHandbook(doc);
    expect(s.reading.trim()).toBe("### 读页约定\nR\n#### 读页约定里的小节\nR2");
    expect(s.citable.trim()).toBe("### 可引来源\nCI");
    expect(s.pageFormat).toContain(s.reading.trim());
    expect(s.pageFormat).toContain(s.citable.trim());
  });
  it("任一切片缺失即抛错并指名", () => {
    expect(() => sliceHandbook(doc.replace("## 查询\nD\n", ""))).toThrow(HandbookSliceMissingError);
    expect(() => sliceHandbook(doc.replace("## 查询\nD\n", ""))).toThrow(/查询/);
    expect(() => sliceHandbook(doc.replace("### 读页约定\nR\n", ""))).toThrow(/读页约定/);
  });
  it("H3 切片只认「页面格式」下的那一个，写在别处不算，写两遍报错", () => {
    const moved = doc
      .replace("### 可引来源\nCI\n", "")
      .replace("## 查询\nD\n", "## 查询\nD\n### 可引来源\nCI\n");
    expect(() => sliceHandbook(moved)).toThrow(/可引来源/);
    const twice = doc.replace("### 子节\n", "### 读页约定\n");
    expect(() => sliceHandbook(twice)).toThrow(/读页约定/);
  });
  it("测试夹具造的最小手册能切出全部切片", () => {
    const s = sliceHandbook(handbookFixture());
    for (const key of [...Object.keys(HANDBOOK_H2), ...Object.keys(HANDBOOK_H3)] as (keyof typeof s)[])
      expect(s[key].trim(), key).not.toBe("");
  });
  it("真实 HANDBOOK.md 各片齐全", () => {
    const s = loadHandbook(`${process.cwd()}/wiki`);
    for (const key of [...Object.keys(HANDBOOK_H2), ...Object.keys(HANDBOOK_H3)] as (keyof typeof s)[]) {
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
