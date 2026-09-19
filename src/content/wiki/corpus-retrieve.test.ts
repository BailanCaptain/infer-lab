import { expect, it } from "vitest";
import { buildIndex, retrieve } from "./retrieve";

it("uses the shared retrieval interface for stable traceback matches without suggesting a confirmed fix", () => {
  const corpus = [
    {
      id: "github-issue-1",
      title: "one",
      url: "https://github.com/o/r/issues/1",
      text: 'File "/tmp/server.py", line 123\nRuntimeError: block 123 exceeds capacity 45',
    },
    {
      id: "github-issue-2",
      title: "two",
      url: "https://github.com/o/r/issues/2",
      text: "RuntimeError: unrelated failure 123",
    },
  ];
  const hits = retrieve(
    'File "C:\\code\\server.py", line 999\nRuntimeError: block 999 exceeds capacity 88',
    buildIndex([]),
    { corpus },
  );
  expect(hits.map((h) => h.id)).toEqual(["github-issue-1"]);
  expect(hits[0]).toMatchObject({ how: "corpus-exact", qualification: "报错文本匹配，修复适用性尚未确认" });
  expect(retrieve("RuntimeError: entirely different failure", buildIndex([]), { corpus })).toEqual([]);
});
