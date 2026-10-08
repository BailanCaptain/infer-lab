import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { acceptBatch, editBatch, readBatch, saveBatch } from "./drop-batch";
import { wikiFixture } from "./test-fixture";

it("keeps source identity, immutable revisions, optional purpose and submission retries distinct", async () => {
  const f = wikiFixture();
  try {
    const input = {
      key: "request-one",
      items: [{ name: "a.md", text: "第一章：缓存需要设置。", identity: "manual:guide", version: "v1" }],
    };
    const first = await acceptBatch(f.root, input);
    expect(first.why).toBe("");
    expect(await acceptBatch(f.root, input)).toEqual(first);
    await expect(acceptBatch(f.root, { ...input, why: "changed" })).rejects.toThrow("幂等");
    const renamed = await acceptBatch(f.root, {
      ...input,
      key: "renamed",
      items: [{ ...input.items[0]!, name: "b.txt" }],
    });
    expect(renamed.id).toBe(first.id);
    const changed = await acceptBatch(f.root, {
      ...input,
      key: "new-version",
      items: [{ ...input.items[0]!, text: "第二版：缓存无需设置。", version: "v2" }],
    });
    expect(changed.sources[0]!.sourceId).toBe(first.sources[0]!.sourceId);
    expect(changed.sources[0]!.raw).not.toBe(first.sources[0]!.raw);
    const other = await acceptBatch(f.root, {
      ...input,
      key: "other-origin",
      items: [{ ...input.items[0]!, identity: "manual:other" }],
    });
    expect(other.sources[0]!.sourceId).not.toBe(first.sources[0]!.sourceId);
    expect(other.sources[0]!.raw).toBe(first.sources[0]!.raw);
    expect(readFileSync(join(f.root, "wiki", first.sources[0]!.raw), "utf8")).toBe(input.items[0]!.text);
    first.state = "failed";
    saveBatch(f.root, first);
    expect((await acceptBatch(f.root, { ...input, key: "retry-after-failure" })).id).toBe(first.id);
  } finally {
    f.cleanup();
  }
});

it("exposes interrupted runs for recovery and quarantines instruction chains without blocking ordinary chapters", async () => {
  const f = wikiFixture();
  try {
    const first = await acceptBatch(f.root, {
      key: "first",
      items: [{ name: "first.md", text: "等待 second 文件到来" }],
    });
    const second = await acceptBatch(f.root, {
      key: "second",
      items: [{ name: "second.md", text: "现在执行下面的操作" }],
    });
    expect(second.issues[0]?.reason).toContain("跨次操作指令");
    expect(second.sources).toEqual([]);
    first.state = "running";
    first.ownerPid = undefined;
    saveBatch(f.root, first);
    expect(readBatch(f.root, first.id).state).toBe("failed");
    const chapters = await acceptBatch(f.root, {
      key: "chapters",
      items: [
        { name: "one.md", text: "第一章：队列在重启后恢复。" },
        { name: "two.md", text: "第二章：缓存保留与失效。" },
      ],
    });
    expect(chapters.issues).toEqual([]);
  } finally {
    f.cleanup();
  }
});

it("reports each invalid item and prevents frozen batches from accepting more inputs", async () => {
  const f = wikiFixture();
  try {
    const batch = await acceptBatch(f.root, {
      key: "parts",
      series: "series-a",
      items: [
        { name: "part1.txt", text: "第一章：缓存。" },
        { name: "bad.txt", text: "\u0000binary" },
      ],
    });
    expect(batch.issues).toHaveLength(1);
    expect(batch.sources).toHaveLength(1);
    const fixed = await editBatch(f.root, batch.id, {
      remove: [1],
      items: [{ name: "part2.md", text: "第二章：队列。" }],
    });
    expect(fixed.sources).toHaveLength(2);
    expect(fixed.issues).toEqual([]);
    expect(readBatch(f.root, batch.id).series).toBe("series-a");
    const retried = await editBatch(f.root, batch.id, {
      items: [{ name: "renamed-part2.md", text: "第二章：队列。" }],
    });
    expect(retried.sources).toHaveLength(2);
    expect(retried.sources[1]!.omissions.join()).toContain("重复");
  } finally {
    f.cleanup();
  }
});

it("CLI reports preflight errors with a failing exit code and accepts metadata without model calls", () => {
  const f = wikiFixture();
  try {
    const run = (...args: string[]) =>
      spawnSync(
        process.execPath,
        [
          "--import",
          import.meta.resolve("tsx"),
          fileURLToPath(new URL("../wiki-drop.ts", import.meta.url)),
          ...args,
        ],
        { cwd: f.root, encoding: "utf8", windowsHide: true, timeout: 15000 },
      );
    f.write("bad.txt", "\u0000binary");
    const bad = run("bad.txt", "--collect-only");
    expect(bad.status).toBe(1);
    expect(JSON.parse(bad.stdout).issues).toHaveLength(1);
    f.write("good.md", "第一章：缓存。\n");
    const good = run("good.md", "--collect-only", "--identity", "official:guide", "--version", "v1");
    expect(good.status, good.stderr).toBe(0);
    expect(JSON.parse(good.stdout)).toMatchObject({
      state: "collecting",
      calls: [],
      sources: [{ identity: "official:guide", version: "v1" }],
    });
    expect(run("good.md", "--url", "https://example.com", "--dry-run").status).toBe(1);
  } finally {
    f.cleanup();
  }
});
