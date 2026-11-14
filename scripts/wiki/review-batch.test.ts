import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { afterEach, expect, it } from "vitest";
import { approveReview, createReview, prepareReviewBatch, readReview } from "./review";
import { wikiContents } from "./review-files";
import { wikiFixture } from "./test-fixture";
import { digest } from "./workflow";

const fixtures: ReturnType<typeof wikiFixture>[] = [];
afterEach(() => {
  for (const f of fixtures.splice(0)) f.cleanup();
});
async function setup() {
  const f = wikiFixture();
  fixtures.push(f);
  for (const id of ["a", "b", "c"])
    f.write(
      `wiki/sources/${id}.md`,
      `---\nid: ${id}\ntitle: ${id}\ntype: source\nsummary: 说明\nsources: [https://example.com]\nevidence: S\nupdated: '2026-09-15'\n---\n原有正文。\n`,
    );
  const before = wikiContents(f.root);
  const page = matter(before.get("wiki/sources/a.md")!);
  const reviews = [];
  for (const to of ["b", "c"]) {
    const after = new Map(before);
    after.set(
      "wiki/sources/a.md",
      matter.stringify(page.content, {
        ...page.data,
        relations: [{ to, kind: "builds-on", note: `依赖 ${to}` }],
      }),
    );
    reviews.push(
      await createReview(f.root, before, after, {
        promoted: [],
        merged: [],
        rejected: [],
        contradictions: [],
      }),
    );
  }
  return { ...f, before, ids: reviews.map((r) => r.id) };
}
it("combines independently reviewed relation additions on the same original page and publishes once", async () => {
  const f = await setup();
  const batch = await prepareReviewBatch(f.root, f.ids);
  expect(wikiContents(f.root)).toEqual(f.before);
  await approveReview(f.root, batch.id, { validate: () => [] });
  expect(
    matter(readFileSync(join(f.root, "wiki/sources/a.md"), "utf8"))
      .data.relations.map((r: { to: string }) => r.to)
      .sort(),
  ).toEqual(["b", "c"]);
  for (const id of f.ids)
    expect(readReview(f.root, id)).toMatchObject({ state: "published", publishedBy: batch.id });
  expect((await prepareReviewBatch(f.root, [...f.ids].reverse())).id).toBe(batch.id);
});
it("does not overwrite a changed baseline", async () => {
  const f = await setup();
  f.write("wiki/sources/a.md", `${f.before.get("wiki/sources/a.md")!}用户刚写的内容。\n`);
  await expect(prepareReviewBatch(f.root, f.ids)).rejects.toThrow("基础内容发生变化");
  expect(readReview(f.root, f.ids[0]!).state).toBe("pending");
});
it("rejects competing body edits and validates the combined result before publishing any child", async () => {
  const f = await setup();
  const ids: string[] = [];
  for (const suffix of ["第一份补充。", "另一份补充。"]) {
    const after = new Map(f.before);
    after.set("wiki/sources/a.md", `${f.before.get("wiki/sources/a.md")!}${suffix}\n`);
    ids.push(
      (
        await createReview(f.root, f.before, after, {
          promoted: [],
          merged: [],
          rejected: [],
          contradictions: [],
          revisions: [{ id: "a", kind: "supplement", reason: "补充" }],
          revisionDate: "2026-09-15",
        })
      ).id,
    );
  }
  await expect(prepareReviewBatch(f.root, ids)).rejects.toThrow("同页变更冲突");
  const batch = await prepareReviewBatch(f.root, f.ids);
  await expect(approveReview(f.root, batch.id, { validate: () => ["合并后关系不合法"] })).rejects.toThrow(
    "合并后关系不合法",
  );
  expect(wikiContents(f.root)).toEqual(f.before);
  expect(f.ids.map((id) => readReview(f.root, id).state)).toEqual(["pending", "pending"]);
});
it("can resume a batch after interruption without losing its original review receipts", async () => {
  const f = await setup();
  const batch = await prepareReviewBatch(f.root, f.ids);
  await expect(
    approveReview(f.root, batch.id, {
      validate: () => [],
      afterWrite: () => {
        throw new Error("interrupted");
      },
    }),
  ).rejects.toThrow("interrupted");
  expect((await prepareReviewBatch(f.root, f.ids)).id).toBe(batch.id);
  await approveReview(f.root, batch.id, { validate: () => [] });
  for (const id of f.ids) expect(readReview(f.root, id).state).toBe("published");
});

it("consumes a draft containing generated sections without changing the official sections", async () => {
  const f = await setup();
  const official = `${f.before.get("wiki/sources/a.md")}\n## 参数定义（自动生成）\n\n保持定义。\n\n## 版本谱系\n\n保持谱系。\n`;
  f.write("wiki/sources/a.md", official);
  f.write("wiki/_drafts/a.md", official);
  const before = wikiContents(f.root);
  const after = new Map(before);
  after.delete("wiki/_drafts/a.md");
  const review = await createReview(f.root, before, after, {
    promoted: [],
    merged: [],
    rejected: [],
    contradictions: [],
  });
  const batch = await prepareReviewBatch(f.root, [review.id]);
  await approveReview(f.root, batch.id, { validate: () => [] });
  expect(existsSync(join(f.root, "wiki/_drafts/a.md"))).toBe(false);
  expect(readFileSync(join(f.root, "wiki/sources/a.md"), "utf8")).toBe(official);
  expect(readReview(f.root, review.id).state).toBe("published");
});

it.each(["## 参数定义（自动生成）", "## 版本谱系"])(
  "still refuses a manifest that changes the official %s section",
  async (heading) => {
    const f = await setup();
    const official = `${f.before.get("wiki/sources/a.md")}\n${heading}\n\n必须保留。\n`;
    f.write("wiki/sources/a.md", official);
    const before = wikiContents(f.root);
    const after = new Map(before);
    const page = matter(official);
    after.set(
      "wiki/sources/a.md",
      matter.stringify(page.content, {
        ...page.data,
        relations: [{ to: "b", kind: "builds-on", note: "依赖 b" }],
      }),
    );
    const review = await createReview(f.root, before, after, {
      promoted: [],
      merged: [],
      rejected: [],
      contradictions: [],
    });
    review.payload.writes.find((w) => w.path === "wiki/sources/a.md")!.after = after
      .get("wiki/sources/a.md")!
      .replace("必须保留。", "非法改写。");
    review.id = digest(JSON.stringify(review.payload));
    f.write(`wiki/_jobs/reviews/${review.id}.json`, JSON.stringify(review));
    await expect(approveReview(f.root, review.id, { validate: () => [] })).rejects.toThrow(
      "自动生成区被修改",
    );
    expect(readFileSync(join(f.root, "wiki/sources/a.md"), "utf8")).toBe(official);
    expect(readReview(f.root, review.id).state).toBe("pending");
  },
);
