import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { approveReview, readReview } from "./review";
import { stageDrafts } from "./stage";
import { wikiFixture } from "./test-fixture";

const fixtures: ReturnType<typeof wikiFixture>[] = [];
afterEach(() => {
  for (const f of fixtures.splice(0)) f.cleanup();
});

const page = (id: string, relations = "") =>
  `---\nid: ${id}\ntitle: ${id.toUpperCase()}\ntype: concept\nsummary: ${id} 的一句话\nsources: [r@28bf3a2e:a.py#L1]\nevidence: C\n${relations}updated: '2026-09-20'\n---\n## 一句话\n${id}\n`;
const edge = (to: string) =>
  `relations:\n  - to: ${to}\n    kind: builds-on\n    note: 先懂 ${to} 才读得懂这一页\n`;

function setup() {
  const f = wikiFixture();
  fixtures.push(f);
  f.write("wiki/concepts/old.md", page("old"));
  f.write("wiki/_drafts/fresh.md", page("fresh", edge("old")));
  return f;
}

describe("stageDrafts", () => {
  it("草稿原样进待审包，正式库在批准前不变，批准后落地并用掉草稿", async () => {
    const f = setup();
    const result = await stageDrafts(f.root, ["fresh"], new Map(), {}, () => []);
    expect(existsSync(join(f.root, "wiki/concepts/fresh.md"))).toBe(false);
    const review = readReview(f.root, result.reviewId);
    expect(review.state).toBe("pending");
    expect(review.payload.decision.promoted).toEqual(["fresh"]);
    const written = review.payload.writes.find((w) => w.path === "wiki/concepts/fresh.md");
    expect(written?.after).toBe(page("fresh", edge("old")));

    await approveReview(f.root, result.reviewId, { validate: () => [] });
    expect(readFileSync(join(f.root, "wiki/concepts/fresh.md"), "utf8")).toBe(page("fresh", edge("old")));
    expect(existsSync(join(f.root, "wiki/_drafts/fresh.md"))).toBe(false);
  });

  it("顺带修改的既有页进同一个待审包，而不是直接生效", async () => {
    const f = setup();
    const edited = page("old", edge("fresh"));
    const result = await stageDrafts(f.root, ["fresh"], new Map([["concepts/old.md", edited]]), {}, () => []);
    expect(readFileSync(join(f.root, "wiki/concepts/old.md"), "utf8")).toBe(page("old"));
    const write = readReview(f.root, result.reviewId).payload.writes.find(
      (w) => w.path === "wiki/concepts/old.md",
    );
    expect(write).toMatchObject({ before: page("old"), after: edited });
  });

  it("校验不过就不产生待审包", async () => {
    const f = setup();
    await expect(stageDrafts(f.root, ["fresh"], new Map(), {}, () => ["来源行号越界"])).rejects.toThrow(
      /来源行号越界/,
    );
    expect(existsSync(join(f.root, "wiki/_jobs/reviews"))).toBe(false);
  });

  it("拒绝没有草稿的 id、已存在的页、以及指向非正式页的顺带修改", async () => {
    const f = setup();
    await expect(stageDrafts(f.root, ["nope"], new Map(), {}, () => [])).rejects.toThrow(/没有草稿/);
    f.write("wiki/_drafts/old.md", page("old"));
    await expect(stageDrafts(f.root, ["old"], new Map(), {}, () => [])).rejects.toThrow(/已存在/);
    await expect(stageDrafts(f.root, ["fresh"], new Map([["index.md", "x"]]), {}, () => [])).rejects.toThrow(
      /只能顺带修改/,
    );
  });
});
