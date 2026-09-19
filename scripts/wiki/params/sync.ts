import type { ParamEntry } from "../../../src/content/wiki/schema";
export const parameterKey = (p: Pick<ParamEntry, "file" | "class" | "json_path">) =>
  `${p.file}:${p.class}:${p.json_path}`;
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
