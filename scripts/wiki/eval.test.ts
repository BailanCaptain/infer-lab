import { describe, expect, it } from "vitest";
import { checkEvalSnapshot, verifyEvalSuite } from "./eval";
import { digest } from "./workflow";

const kinds = ["missing", "holdout", "synthesis", "version", "regression", "no-evidence"];
function fixture() {
  return {
    id: "fixture-v1",
    missingTerms: ["missing_config"],
    evidence: [
      { id: "source", commit: "a".repeat(40), path: "code.py", start: 1, end: 1, sha256: digest("fact\n") },
    ],
    cases: kinds.map((kind) => ({
      id: kind,
      kind,
      question: `Question ${kind}`,
      requiredFacts: ["fact"],
      forbiddenClaims: ["invented"],
      evidenceIds: kind === "no-evidence" ? [] : ["source"],
      expectedPages: [],
    })),
  };
}

describe("frozen evaluation suite", () => {
  it("checks pinned bytes and line ranges without a model", () => {
    const result = verifyEvalSuite(fixture(), () => ({ kind: "ok", text: "fact\n" }));
    expect(result.cases).toHaveLength(6);
    expect(result.revision).toMatch(/^[a-f0-9]{64}$/);
  });
  it("rejects changed or unavailable source evidence", () => {
    for (const read of [
      () => ({ kind: "ok" as const, text: "changed\n" }),
      () => ({ kind: "missing-file" as const }),
      () => ({ kind: "invalid-commit" as const }),
    ])
      expect(() => verifyEvalSuite(fixture(), read)).toThrow();
    const suite = fixture();
    suite.evidence[0]!.end = 3;
    expect(() => verifyEvalSuite(suite, () => ({ kind: "ok", text: "fact\n" }))).toThrow();
  });
  it("cannot replace the holdout with another case or use unknown evidence", () => {
    const suite = fixture();
    suite.cases[1]!.kind = "missing";
    expect(() => verifyEvalSuite(suite, () => ({ kind: "ok", text: "fact\n" }))).toThrow();
    const invalid = fixture();
    invalid.cases[0]!.evidenceIds = ["unknown"];
    expect(() => verifyEvalSuite(invalid, () => ({ kind: "ok", text: "fact\n" }))).toThrow();
  });
  it("binds wording, scoring and evidence to the same suite revision", () => {
    const suite = fixture();
    const read = () => ({ kind: "ok" as const, text: "fact\n" });
    const original = verifyEvalSuite(suite, read).revision;
    suite.cases[1]!.question += " changed";
    expect(verifyEvalSuite(suite, read).revision).not.toBe(original);
    suite.cases[1]!.requiredFacts = ["changed rubric"];
    expect(verifyEvalSuite(suite, read).revision).not.toBe(original);
  });
  it("rejects contaminated baselines, leaked holdout questions and missing regression pages", () => {
    const suite = verifyEvalSuite(fixture(), () => ({ kind: "ok", text: "fact\n" }));
    const snapshot = {
      files: [{ file: "index.md", text: "index" }],
      pageTexts: [{ file: "concepts/a.md", text: "missing_config" }],
      registry: { pages: [{ id: "a" }] },
    };
    expect(() => checkEvalSnapshot(suite, snapshot, "before")).toThrow(/基线/);
    expect(() => checkEvalSnapshot(suite, snapshot, "after")).not.toThrow();
    snapshot.files[0]!.text = suite.cases[1]!.question;
    expect(() => checkEvalSnapshot(suite, snapshot, "after")).toThrow(/泄漏/);
    snapshot.files[0]!.text = suite.cases[0]!.question;
    expect(() => checkEvalSnapshot(suite, snapshot, "after")).not.toThrow();
    snapshot.files[0]!.text = "index";
    suite.cases[4]!.expectedPages = ["missing-page"];
    expect(() => checkEvalSnapshot(suite, snapshot, "after")).toThrow(/依赖页/);
  });
});
