import { expect, it } from "vitest";
import { applyDropEdits, DropContext } from "./drop-context";

const budget = { contextWindowTokens: 128000, outputReserveTokens: 16384, algorithm: 1 as const };

it("keeps quoted cross-section conditions without carrying every historical read into generation", () => {
  const c = new DropContext(budget);
  const first = "编码见文末条件。\n\n";
  const middle = Array.from({ length: 2000 }, (_, i) => `| 表行 ${i} | 123 |\n`).join("");
  const tail = "仅 V2 开启压缩时 B=2。\n默认值未知，N=0 时仍保留固定头部。";
  const text = `${first}${middle}\n${tail}`;
  const id = c.add("raw/a.md", "source", text);
  const range = c.range({ id, start: 0, end: first.length });
  const support = c.quoteSupport(range, [c.range({ id })], ["编码见文末条件。", "B=2"]);
  const actual = c.pack(support).materials;
  expect(actual.map((m) => m.text).join("")).toBe(first + tail);
  expect(actual.some((m) => m.text.includes("默认值未知，N=0"))).toBe(true);
  expect(() => c.quoteSupport(range, [range], ["B=2"])).toThrow("摘录");
  expect(() => c.quoteSupport(range, [c.range({ id })], ["B=2"])).toThrow("当前段");
  const middleRange = c.chunks(id, 12000)[1]!;
  const row = c.text(middleRange).split("\n")[0]!;
  // A quote already inside the mandatory chunk must not expand a long table again.
  const localSupport = c.quoteSupport(middleRange, [c.range({ id })], [row]);
  expect(localSupport).toEqual([middleRange]);
});

it("retains every matching quoted paragraph when different versions repeat a phrase", () => {
  const c = new DropContext(budget);
  const id = c.add("raw/a.md", "source", "版本盘点。\n\nV1\n默认关闭。\n\nV2\n默认关闭。仅测试配置。\n");
  const range = c.range({ id, start: 0, end: 7 });
  const support = c.quoteSupport(range, [c.range({ id })], ["版本盘点。", "默认关闭。"]);
  const text = c
    .pack(support)
    .materials.map((m) => m.text)
    .join("");
  expect(text).toContain("V1\n默认关闭。");
  expect(text).toContain("V2\n默认关闭。仅测试配置。");
});

it("merges overlapping ranges only within the same immutable material", () => {
  const c = new DropContext(budget);
  const a = c.add("raw/a.md", "source", "甲乙丙丁", [{ identity: "v1" }]);
  const b = c.add("raw/b.md", "source", "甲乙丙丁", [{ identity: "v2" }]);
  const packed = c.pack([
    { id: a, start: 0, end: 3 },
    { id: a, start: 1, end: 4 },
    { id: b, start: 0, end: 4 },
  ]);
  expect(packed.materials).toHaveLength(2);
  expect(packed.materials.map((m) => m.text)).toEqual(["甲乙丙丁", "甲乙丙丁"]);
  expect(packed.savedBytes).toBe(6);
  expect(c.complete(a)).toBe(false);
});

it("records actual current input separately from historical coverage and never loses Unicode", async () => {
  const c = new DropContext(budget);
  const original = "😀条件并非通用。".repeat(8000);
  const id = c.add("raw/long.md", "source", original);
  const chunks = c.chunks(id, 12000);
  expect(chunks.map((r) => c.text(r)).join("")).toBe(original);
  for (const r of chunks) c.record("extract", "rules", { materials: c.pack([r]).materials });
  expect(c.complete(id)).toBe(true);
  const next = c.record("generate", "rules", { materials: c.pack([chunks[0]!]).materials });
  expect(next.materials).toHaveLength(1);
  expect(next.materials[0]!.end).toBeLessThan(original.length);
  expect(c.pack(chunks).materials).toHaveLength(1);
  expect(() => c.record("oversize", "rules", { materials: c.pack(chunks).materials })).toThrow("预算");
});

it("applies hash-bound edits without rewriting untouched bytes or accepting overlaps", () => {
  const c = new DropContext(budget);
  const old = "前言😀\n条件：v1\n| 表 | 值 |\n尾注\n";
  const id = c.add("concepts/a.md", "page", old);
  const hash = c.resource(id).hash;
  expect(applyDropEdits(old, hash, [{ start: 7, end: 12, old: old.slice(7, 12), text: "版本限定" }])).toBe(
    `${old.slice(0, 7)}版本限定${old.slice(12)}`,
  );
  expect(() =>
    applyDropEdits(old, hash, [
      { start: 0, end: 4, old: old.slice(0, 4), text: "" },
      { start: 3, end: 6, old: old.slice(3, 6), text: "" },
    ]),
  ).toThrow("重叠");
  expect(() => applyDropEdits(`${old}变动`, hash, [])).toThrow("hash");
});

it("rejects edits that split Unicode characters or give ambiguous insertions", () => {
  const c = new DropContext(budget);
  const old = "A😀B";
  const id = c.add("sources/a.md", "page", old);
  const hash = c.resource(id).hash;
  expect(() => applyDropEdits(old, hash, [{ start: 2, end: 3, old: old.slice(2, 3), text: "" }])).toThrow(
    "字符边界",
  );
  expect(() => applyDropEdits(old, hash, [{ start: -1, end: -1, old: "", text: "X" }])).toThrow("范围");
  expect(() =>
    applyDropEdits(old, hash, [
      { start: 1, end: 1, old: "", text: "X" },
      { start: 1, end: 1, old: "", text: "Y" },
    ]),
  ).toThrow("重叠");
});
