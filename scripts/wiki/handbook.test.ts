import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { inputByteLimit } from "./context-window";
import { HANDBOOK_H2, HANDBOOK_H3, HandbookSliceMissingError, loadHandbook, sliceHandbook } from "./handbook";
import { lintPages } from "./lint";
import { parsePage } from "./pages";
import { handbookFixture, wikiFixture } from "./test-fixture";

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
  it("按 H2 切六片，H3 归当前片，标题行保留，未知 H2 与前言丢弃", () => {
    const s = sliceHandbook(doc);
    expect(s.pageFormat).toBe(
      "## 页面格式\nA1\n### 读页约定\nR\n#### 读页约定里的小节\nR2\n### 子节\nA2\n### 可引来源\nCI\n\n",
    );
    expect(s.extract.trim()).toBe("## 提取\nB");
    expect(s.coverage.trim()).toBe("## 覆盖判定\nG");
    // 人类须知已搬去交接文档；HANDBOOK 里若还留着同名一节，它不进任何切片
    expect(JSON.stringify(s)).not.toContain("人类须知");
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
  it("术语叫法表单独成文件，拼到「页面格式」末尾给写页的 agent；只读页的切片不带它", () => {
    const f = wikiFixture();
    try {
      f.write("wiki/HANDBOOK.md", handbookFixture());
      const bare = loadHandbook(`${f.root}/wiki`);
      f.write("wiki/TERMS.md", "### 术语叫法\n\n| 统一叫法 | 一句白话 |\n| NPU | 昇腾的计算芯片 |\n");
      const s = loadHandbook(`${f.root}/wiki`);
      expect(s.pageFormat.startsWith(bare.pageFormat)).toBe(true);
      expect(s.pageFormat).toContain("| NPU | 昇腾的计算芯片 |");
      expect(s.reading).toBe(bare.reading);
      expect(s.query).toBe(bare.query);
    } finally {
      f.cleanup();
    }
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
  it("写页规则注入唯一正式标准，临时整合副本也可读取；只读角色不携带写作全文", () => {
    const f = wikiFixture();
    try {
      f.write("wiki/HANDBOOK.md", handbookFixture());
      const slices = loadHandbook(`${f.root}/wiki`);
      const standard = readFileSync(new URL("../../docs/wiki-writing-standard.md", import.meta.url), "utf8");
      expect(slices.pageFormat).toContain(standard);
      expect(slices.reading).not.toContain(standard);
      expect(slices.query).not.toContain(standard);
    } finally {
      f.cleanup();
    }
  });
  it("手册摘要不再要求与正式标准冲突的正文就近证据角标", () => {
    const rules = loadHandbook(`${process.cwd()}/wiki`).pageFormat;
    expect(rules).not.toContain("数值、版本差异、反直觉结论的证据就近标注");
  });
  it("按本次材料选择术语，保留对应原文定义和完整正式标准，不把无关词表塞入每次写作", () => {
    const f = wikiFixture();
    try {
      f.write("wiki/HANDBOOK.md", handbookFixture());
      f.write(
        "wiki/TERMS.md",
        "## 术语\n| 统一叫法 | 别的叫法 | 简明定义 | 对应页面 | 备注 |\n| --- | --- | --- | --- | --- |\n| token | 词元 | 离散编号 | token | 完整定义 |\n| RFork | fork weights | 权重传输 | rfork | 无关定义 |\n",
      );
      const rules = loadHandbook(`${f.root}/wiki`, "词元的处理").pageFormat;
      expect(rules).toContain("| token | 词元 | 离散编号 | token | 完整定义 |");
      expect(rules).not.toContain("无关定义");
      expect(rules).toContain("对照源码之上零证据角标");
    } finally {
      f.cleanup();
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
  it("无工具纯文本写页（textOnly=true）在真实 HANDBOOK + 标准 + TERMS 下满足默认 128K 窗口并保留全部事实与引用规则", () => {
    const context =
      "PagedAttention KV Cache token prefill decode scheduler block_table NPU HCCL https://docs.vllm.ai/projects/ascend/ xgrammar";
    const slices = loadHandbook(`${process.cwd()}/wiki`, context, true);
    const budget128k = { contextWindowTokens: 128_000, outputReserveTokens: 16_384 };
    expect(inputByteLimit("", slices.pageFormat, budget128k)).toBeGreaterThanOrEqual(25_000);
    expect(
      inputByteLimit("", `${slices.pageFormat}\n${slices.integrate}`, budget128k),
    ).toBeGreaterThanOrEqual(15_000);
    expect(slices.pageFormat).toContain("purpose: answer-record");
    expect(slices.pageFormat).toContain("### 读页约定");
    expect(slices.pageFormat).toContain("### 版本");
    expect(slices.pageFormat).toContain("### 条件");
    expect(slices.pageFormat).toContain("### 关系");
    expect(slices.pageFormat).toContain("### 链接与来源");
    expect(slices.pageFormat).toContain("### 可引来源");
    expect(slices.pageFormat).toContain("S 至少需一条官方或论文来源");
    expect(slices.pageFormat).toContain("镜像站和 AI 二手知识库不可引");
    expect(slices.pageFormat).toContain("CITABLE_DOMAINS");
    expect(slices.pageFormat).toContain("docs.vllm.ai");
    expect(slices.pageFormat).toContain("xgrammar");
    expect(slices.pageFormat).not.toContain("terratorch/vllm/plugins/segmentation");
    expect(slices.pageFormat).toContain("对照源码之上零证据角标");
    expect(slices.pageFormat).not.toContain("## 审查与修订流程");
  });
});
