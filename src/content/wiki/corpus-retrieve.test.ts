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

it("preserves CANN/ACL numeric and hex error codes so distinct error codes never collide as corpus-exact", () => {
  const corpus = [
    {
      id: "github-issue-507034",
      title: "vector core timeout 507034",
      url: "https://github.com/vllm-project/vllm-ascend/issues/16446",
      text: "RuntimeError: AclrtSynchronizeStreamWithTimeout, error code is 507034",
    },
    {
      id: "github-issue-0x91",
      title: "aicore retCode 0x91",
      url: "https://github.com/vllm-project/vllm-ascend/issues/19999",
      text: "[ERROR] RUNTIME(111,):2026-09-10 [stream.cc:1743]222 GetError:Stream Synchronize failed, stream_id=12, retCode=0x91, [aicore exception].",
    },
  ];
  const emptyIdx = buildIndex([]);

  // 507015 must NOT falsely match 507034
  expect(
    retrieve("RuntimeError: AclrtSynchronizeStreamWithTimeout, error code is 507015", emptyIdx, { corpus }),
  ).toEqual([]);
  // Exact 507034 still matches 507034
  expect(
    retrieve("RuntimeError: AclrtSynchronizeStreamWithTimeout, error code is 507034", emptyIdx, {
      corpus,
    }).map((h) => h.id),
  ).toEqual(["github-issue-507034"]);

  // retCode=0x26 must NOT falsely match retCode=0x91, even when stream_id differs
  expect(
    retrieve(
      "[ERROR] RUNTIME(289610,):2026-09-10 [stream.cc:1743]289907 GetError:Stream Synchronize failed, stream_id=47, retCode=0x26, [aicore exception].",
      emptyIdx,
      { corpus },
    ),
  ).toEqual([]);
  expect(
    retrieve(
      "[ERROR] RUNTIME(999,):2026-09-11 [stream.cc:1743]888 GetError:Stream Synchronize failed, stream_id=99, retCode=0x91, [aicore exception].",
      emptyIdx,
      { corpus },
    ).map((h) => h.id),
  ).toEqual(["github-issue-0x91"]);
});
