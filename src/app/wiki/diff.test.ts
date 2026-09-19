import { describe, expect, it } from "vitest";
import { addedText, isContentPage, parseReviewDiff, splitFrontmatter } from "./diff";

const SAMPLE = `
wiki/concepts/kv-cache-spec.md (更新)
diff --git a/before b/after
index 1111111..2222222 100644
--- a/before
+++ b/after
@@ -35,5 +35,8 @@ relations:
   - to: paged-attention
     kind: builds-on
-    note: 旧的说明文字在这里
+    note: 新的说明文字在这里
+  - to: kv-cache
+    kind: builds-on
 contradicts: []

wiki/concepts/rope.md (新增)
diff --git a/before b/after
new file mode 100644
--- /dev/null
+++ b/after
@@ -0,0 +1,5 @@
+---
+id: rope
+---
+
+## 一句话
\\ No newline at end of file

wiki/_drafts/rope.md (删除)
diff --git a/before b/after
deleted file mode 100644
--- a/before
+++ /dev/null
@@ -1,2 +0,0 @@
----
-id: rope
`;

describe("parseReviewDiff", () => {
  const files = parseReviewDiff(SAMPLE);

  it("按文件分段并识别新增 / 更新 / 删除", () => {
    expect(files.map((f) => [f.path, f.kind])).toEqual([
      ["wiki/concepts/kv-cache-spec.md", "modified"],
      ["wiki/concepts/rope.md", "added"],
      ["wiki/_drafts/rope.md", "deleted"],
    ]);
  });

  it("数出每个文件的增删行数", () => {
    expect(files.map((f) => [f.added, f.deleted])).toEqual([
      [3, 1],
      [5, 0],
      [0, 2],
    ]);
  });

  it("行号从 hunk 头起算，增删各走各的", () => {
    const lines = files[0]!.hunks[0]!.lines;
    expect(lines[0]).toMatchObject({ type: "ctx", oldNo: 35, newNo: 35 });
    expect(lines[2]).toMatchObject({ type: "del", oldNo: 37 });
    expect(lines[3]).toMatchObject({ type: "add", newNo: 37 });
    expect(lines.at(-1)).toMatchObject({ type: "ctx", oldNo: 38, newNo: 40 });
  });

  it("一删一增成对时只标出真正变了的那一段", () => {
    const [, , del, add] = files[0]!.hunks[0]!.lines;
    expect(del!.text.slice(...del!.mark!)).toBe("旧");
    expect(add!.text.slice(...add!.mark!)).toBe("新");
  });

  it("文件头之前的 diff 元信息不算内容行，frontmatter 的 --- 不被误判", () => {
    expect(addedText(files[1]!)).toBe("---\nid: rope\n---\n\n## 一句话");
  });

  it("内容行长得像文件头也不切段", () => {
    const tricky = "\na.md (更新)\n--- a/before\n+++ b/after\n@@ -1,1 +1,1 @@\n-x\n+wiki/b.md (新增)\n";
    expect(parseReviewDiff(tricky)).toHaveLength(1);
  });
});

describe("helpers", () => {
  it("区分正文页与派生文件", () => {
    expect(isContentPage("wiki/concepts/rope.md")).toBe(true);
    expect(isContentPage("wiki/index.md")).toBe(false);
    expect(isContentPage("wiki/_drafts/rope.md")).toBe(false);
    expect(isContentPage("src/content/wiki/registry.json")).toBe(false);
  });

  it("拆 frontmatter", () => {
    expect(splitFrontmatter("---\nid: a\n---\n\n正文")).toEqual({ frontmatter: "id: a", body: "\n正文" });
    expect(splitFrontmatter("没有头")).toEqual({ frontmatter: "", body: "没有头" });
  });
});
