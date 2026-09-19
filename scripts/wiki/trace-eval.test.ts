import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { z } from "zod";
import { buildIndex, retrieve } from "../../src/content/wiki/retrieve";

it("meets the fixed 10-real-traceback Top-5 gate on the bounded 30-document corpus", () => {
  const suite = z
    .object({
      cases: z.array(z.object({ issue: z.number(), query: z.string() })).length(10),
      corpus: z
        .array(z.object({ id: z.string(), title: z.string(), url: z.string(), text: z.string() }))
        .length(30),
    })
    .parse(JSON.parse(readFileSync(new URL("./trace-eval-suite.json", import.meta.url), "utf8")));
  const results = suite.cases.map((c) => {
    expect(c.query).not.toContain(`github.com/`);
    expect(c.query).not.toContain(`#${c.issue}`);
    return retrieve(c.query, buildIndex([]), { corpus: suite.corpus }).findIndex(
      (h) => h.id === `github-issue-${c.issue}`,
    );
  });
  expect(results.filter((r) => r >= 0 && r < 5).length).toBeGreaterThanOrEqual(7);
  expect(
    retrieve("UnseenFixtureError: intentionally nonexistent control", buildIndex([]), {
      corpus: suite.corpus,
    }),
  ).toEqual([]);
});
