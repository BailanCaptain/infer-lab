import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import type { RunAgent } from "./batch";
import { reconcileBatch } from "./reconcile";
import { listReviews, readReview, retireReview } from "./review";
import { wikiFixture } from "./test-fixture";

const fixtures: ReturnType<typeof wikiFixture>[] = [];
afterEach(() => {
  for (const f of fixtures.splice(0)) f.cleanup();
});
const page = (id: string, body: string, date = "2026-10-31", source = "https://example.test/v1") =>
  `---\nid: ${id}\ntitle: ${id}\ntype: source\nsummary: ${id}\nsources: [${source}]\nevidence: I\nupdated: '${date}'\n---\n${body}\n`;
function fixture(body = "A uses B for storage.") {
  const f = wikiFixture();
  fixtures.push(f);
  f.write("wiki/sources/a.md", page("a", body));
  f.write("wiki/sources/b.md", page("b", "B provides storage."));
  const candidate = {
    from: "a",
    relation: { to: "b", kind: "builds-on", note: "A uses B for storage." },
    evidence: [
      { page: "a", text: body.split("\n")[0] },
      { page: "b", text: "B provides storage." },
    ],
  };
  const run = (runAgent: RunAgent) =>
    reconcileBatch(f.root, ["a", "b"], { accountingOnly: true }, { runAgent, retry: true });
  return { ...f, candidate, run };
}
type ModelInput = {
  mode?: string;
  candidateId: string;
  oldSection: { start: number; end: number; text: string };
};
const respond =
  (value: (data: ModelInput) => unknown): RunAgent =>
  async (req) => ({
    id: req.id,
    ok: true,
    exitCode: 0,
    stderrTail: "",
    output: JSON.stringify(value(JSON.parse(req.stdin))),
  });
const generation = (candidate: unknown) => ({ relations: [candidate], contradictions: [], duplicates: [] });

it("omits only a fully covered navigation with exact active-text evidence", async () => {
  const body = "A uses [B](b.md#storage) for `storage`.";
  const f = fixture(body),
    agent = vi.fn(
      respond((data) =>
        data.mode === "relation-coverage"
          ? {
              candidateId: data.candidateId,
              covered: true,
              quotes: [
                {
                  text: data.oldSection.text,
                },
              ],
              reason: "The same prerequisite and navigation are already explicit.",
            }
          : generation(f.candidate),
      ),
    );
  const before = readFileSync(join(f.root, "wiki/sources/a.md"), "utf8");
  expect((await f.run(agent)).reviewId).toBeUndefined();
  expect(listReviews(f.root)).toHaveLength(0);
  expect(agent.mock.calls.some(([req]) => JSON.parse(req.stdin).mode === "relation-coverage")).toBe(true);
  expect(readFileSync(join(f.root, "wiki/sources/a.md"), "utf8")).toBe(before);
});

it.each([false, "invalid-proof", "offline"])(
  "retains unique/uncertain information despite an existing link: %s",
  async (verdict) => {
    const f = fixture("A uses [B](b.md) only on v2. v1 remains unsupported.");
    f.candidate.relation.note = "Only v2 uses B; v1 remains unsupported.";
    const result = await f.run(
      respond((data) => {
        if (data.mode !== "relation-coverage") return generation(f.candidate);
        if (verdict === "offline") throw new Error("judge unavailable");
        return {
          candidateId: data.candidateId,
          covered: verdict !== false,
          quotes: verdict === "invalid-proof" ? [{ text: "fake" }] : [],
          reason: "The old link alone does not cover the version restriction.",
        };
      }),
    );
    expect(readReview(f.root, result.reviewId!).state).toBe("pending");
  },
);

it("does not treat similar ids, examples, or retired history as an existing navigation", async () => {
  const f = fixture(
    "A uses B for storage.\n[A variant](b-variant.md)\n`[example](b.md)`\n## 已废弃的说法\n[Old](b.md)",
  );
  const agent = vi.fn(respond(() => generation(f.candidate)));
  expect((await f.run(agent)).reviewId).toBeTruthy();
  expect(agent).toHaveBeenCalledTimes(1);
});

it("remembers a retired exact proposal across date-only edits but rechecks changed evidence", async () => {
  const f = fixture(),
    agent = vi.fn(respond(() => generation(f.candidate)));
  const first = await f.run(agent);
  await retireReview(f.root, first.reviewId!, "Already covered by the reading route.");
  f.write("wiki/sources/a.md", page("a", "A uses B for storage.", "2026-11-01"));
  expect((await f.run(agent)).reviewId).toBeUndefined();
  expect(agent).toHaveBeenCalledTimes(1);
  f.write("wiki/sources/b.md", page("b", "B provides storage.", "2026-11-01", "https://example.test/v2"));
  expect((await f.run(agent)).reviewId).toBeTruthy();
  expect(agent).toHaveBeenCalledTimes(2);
});

it("binds both endpoint baselines and refuses to stage stale evidence", async () => {
  const f = fixture();
  await expect(
    f.run(
      respond(() => {
        f.write("wiki/sources/b.md", page("b", "B no longer provides storage."));
        return generation(f.candidate);
      }),
    ),
  ).rejects.toThrow(/读取时改变|基线/);
  expect(listReviews(f.root)).toHaveLength(0);
});

it("includes the target in the eventual publication baseline", async () => {
  const f = fixture(),
    result = await f.run(respond(() => generation(f.candidate)));
  expect(readReview(f.root, result.reviewId!).payload.base).toHaveProperty("wiki/sources/b.md");
});

it("cannot use a code-example fragment as suppression evidence", async () => {
  const body = "A uses [B](b.md) for storage.\n```md\n[Fictional complete coverage](b.md)\n```";
  const f = fixture(body);
  const result = await f.run(
    respond((data) => {
      if (data.mode !== "relation-coverage") return generation(f.candidate);
      const text = "[Fictional complete coverage](b.md)";
      return {
        candidateId: data.candidateId,
        covered: true,
        quotes: [{ text }],
        reason: "Incorrect code-only proof.",
      };
    }),
  );
  expect(result.reviewId).toBeTruthy();
});

it("keeps contradiction findings even when every navigation is covered", async () => {
  const f = fixture("A uses [B](b.md) for storage.");
  const result = await f.run(
    respond((data) =>
      data.mode === "relation-coverage"
        ? {
            candidateId: data.candidateId,
            covered: true,
            quotes: [{ text: data.oldSection.text }],
            reason: "Navigation covered; contradiction must remain separate.",
          }
        : {
            ...generation(f.candidate),
            contradictions: [
              {
                a: f.candidate.evidence[0],
                b: f.candidate.evidence[1],
                reason: "New conflicting condition needs human review.",
              },
            ],
          },
    ),
  );
  expect(result.reviewId).toBeUndefined();
  const warning = JSON.parse(
    readFileSync(join(f.root, `wiki/warnings/reconcile-${result.jobId}.json`), "utf8"),
  );
  expect(warning.contradictions).toHaveLength(1);
});
