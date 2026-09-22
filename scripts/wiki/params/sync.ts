import type { ParamEntry } from "../../../src/content/wiki/schema";
export const parameterKey = (p: Pick<ParamEntry, "file" | "class" | "json_path">) =>
  `${p.file}:${p.class}:${p.json_path}`;
/**
 * 出现位置与总数只是给审阅者的线索，上游任何一处改动都会让它们变。判断「这条记录是否仍与钉定源码一致」
 * 时不看它们——旧记录的位置是全量清单、也没有总数（2026-09-23 前的格式），照样算同一条。
 */
export const withoutLocations = <T extends { occurrences?: unknown; occurrenceCount?: unknown }>(p: T) => ({
  ...p,
  occurrences: undefined,
  occurrenceCount: undefined,
});
export function parameterDiff(before: ParamEntry[], after: ParamEntry[]) {
  const old = new Map(before.map((p) => [parameterKey(p), p]));
  const next = new Map(after.map((p) => [parameterKey(p), p]));
  const semantic = (p: ParamEntry) =>
    JSON.stringify({
      type: p.type,
      default: p.default,
      comment: p.comment,
      constraints: p.constraints,
      confidence: p.confidence,
    });
  return {
    added: after.filter((p) => !old.has(parameterKey(p))),
    removed: before.filter((p) => !next.has(parameterKey(p))),
    changed: after.flatMap((p) => {
      const prior = old.get(parameterKey(p));
      return prior && semantic(prior) !== semantic(p) ? [{ before: prior, after: p }] : [];
    }),
    relocated: after.flatMap((p) => {
      const prior = old.get(parameterKey(p));
      return prior && semantic(prior) === semantic(p) && prior.line !== p.line
        ? [{ before: prior, after: p }]
        : [];
    }),
  };
}
