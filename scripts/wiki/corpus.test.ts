import { rmSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { afterEach, describe, expect, it } from "vitest";
import { type CorpusRecord, writeCorpus } from "./corpus";
import { corpusDocuments } from "./corpus-trace";
import { wikiFixture } from "./test-fixture";

const fixtures: ReturnType<typeof wikiFixture>[] = [];

afterEach(() => {
  for (const f of fixtures.splice(0)) f.cleanup();
});

function makeRecord(overrides: Partial<CorpusRecord> & Pick<CorpusRecord, "kind" | "number">): CorpusRecord {
  const repo = overrides.repo ?? "vllm-project/vllm-ascend";
  const pathSegment = overrides.kind === "issue" ? "issues" : "pull";
  return {
    schemaVersion: 1,
    repo,
    title: overrides.title ?? `Sample ${overrides.kind} #${overrides.number}`,
    url: overrides.url ?? `https://github.com/${repo}/${pathSegment}/${overrides.number}`,
    state: overrides.state ?? "open",
    author: "tester",
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    closedAt: null,
    labels: [],
    fixes: [],
    files: [],
    patches: [],
    docs: [],
    comments: overrides.comments ?? [],
    body: overrides.body ?? `Body content for #${overrides.number}`,
    ...overrides,
  };
}

describe("corpusDocuments directory-stamp cache", () => {
  it("serves warm hits in < 2ms and immediately invalidates on add, modify, and remove", () => {
    const f = wikiFixture();
    fixtures.push(f);
    const repo = "vllm-project/vllm-ascend";

    // Seed enough corpus files so cold parsing is measurably heavier than a directory stamp check.
    for (let i = 1; i <= 20; i++) {
      writeCorpus(
        f.root,
        makeRecord({
          kind: "issue",
          number: i,
          title: `OOM issue ${i}`,
          body: `RuntimeError: NPU out of memory case ${i}\n${"detail line\n".repeat(40)}`,
        }),
      );
    }

    // 1. Cold read populates cache
    const first = corpusDocuments(f.root, repo);
    expect(first).toHaveLength(20);
    expect(first[0]?.title).toContain("OOM issue 1");

    // 2. Warm hit returns identical sanitized docs in < 2ms
    const t0 = performance.now();
    const second = corpusDocuments(f.root, repo);
    const warmMs = performance.now() - t0;
    expect(second).toEqual(first);
    expect(warmMs).toBeLessThan(2);

    // Defensive copy: mutating caller result must not corrupt cache
    second[0]!.title = "MUTATED";
    second.push({
      id: "fake",
      title: "fake",
      url: "https://example.com",
      text: "fake",
    });
    const third = corpusDocuments(f.root, repo);
    expect(third).toHaveLength(20);
    expect(third[0]?.title).toContain("OOM issue 1");

    // 3. Immediate invalidation on file addition (PR added)
    writeCorpus(
      f.root,
      makeRecord({
        kind: "pr",
        number: 99,
        title: "Fix HCCL timeout",
        body: "Fixes #1 by resizing buffer",
        fixes: [1],
      }),
    );
    const afterAdd = corpusDocuments(f.root, repo);
    expect(afterAdd).toHaveLength(21);
    expect(afterAdd.some((d) => d.id === "github-pr-99" && d.title.includes("Fix HCCL timeout"))).toBe(true);

    // 4. Immediate invalidation on file modification
    writeCorpus(
      f.root,
      makeRecord({
        kind: "issue",
        number: 1,
        title: "Updated OOM title",
        body: "Updated root cause description",
      }),
    );
    const afterModify = corpusDocuments(f.root, repo);
    expect(afterModify).toHaveLength(21);
    const updatedDoc = afterModify.find((d) => d.id === "github-issue-1");
    expect(updatedDoc?.title).toContain("Updated OOM title");
    expect(updatedDoc?.text).toContain("Updated root cause description");

    // 5. Immediate invalidation on file removal
    rmSync(join(f.root, "tools/corpus/vllm-ascend/prs/99.md"));
    const afterRemove = corpusDocuments(f.root, repo);
    expect(afterRemove).toHaveLength(20);
    expect(afterRemove.some((d) => d.id === "github-pr-99")).toBe(false);
  });

  it("isolates cache entries by root and repo, including initially empty directories", () => {
    const f1 = wikiFixture();
    const f2 = wikiFixture();
    fixtures.push(f1, f2);

    expect(corpusDocuments(f1.root, "vllm-project/vllm-ascend")).toEqual([]);
    expect(corpusDocuments(f2.root, "vllm-project/vllm-ascend")).toEqual([]);

    writeCorpus(
      f1.root,
      makeRecord({
        repo: "vllm-project/vllm-ascend",
        kind: "issue",
        number: 7,
        title: "Root 1 ascend issue",
      }),
    );
    writeCorpus(
      f1.root,
      makeRecord({
        repo: "vllm-project/vllm",
        kind: "issue",
        number: 7,
        title: "Root 1 core issue",
      }),
    );

    const ascendDocs = corpusDocuments(f1.root, "vllm-project/vllm-ascend");
    const coreDocs = corpusDocuments(f1.root, "vllm-project/vllm");
    const f2Docs = corpusDocuments(f2.root, "vllm-project/vllm-ascend");

    expect(ascendDocs).toHaveLength(1);
    expect(ascendDocs[0]?.title).toContain("Root 1 ascend issue");
    expect(coreDocs).toHaveLength(1);
    expect(coreDocs[0]?.title).toContain("Root 1 core issue");
    expect(f2Docs).toEqual([]);
  });
});
