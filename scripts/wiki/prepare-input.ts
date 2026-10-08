import { parseRawRef } from "../../src/content/wiki/schema";
import { sourceLines } from "./audit";
import { readRawSnapshot } from "./raw";
import { sanitizeRawInput } from "./sanitize";
import { digest } from "./workflow";

/** Only screened, selected lines enter compilerData; removed spans and absolute paths do not.
 * Callers must use a tool-restricted compiler; this data boundary is not an OS sandbox.
 */
export function prepareRawInput(wikiRoot: string, source: string) {
  const ref = parseRawRef(source);
  if (!ref) throw new Error("非法本地来源引用");
  const original = readRawSnapshot(wikiRoot, ref.path);
  if (ref.lineEnd > sourceLines(original).length) throw new Error("本地来源行号越界");
  const result = sanitizeRawInput(original);
  const receipt = {
    source,
    rawHash: digest(original),
    sanitizerVersion: result.version,
    cleanHash: digest(result.text),
    blocked: result.blocked,
    findings: result.findings,
  };
  if (result.blocked) return { receipt, compilerData: null };
  const lines = sourceLines(result.text)
    .slice(ref.lineStart - 1, ref.lineEnd)
    .map((text, i) => ({ line: ref.lineStart + i, text }));
  if (!lines.some((line) => line.text.trim()))
    return {
      receipt: { ...receipt, blocked: true, findings: [...receipt.findings, { reason: "empty-selection" }] },
      compilerData: null,
    };
  return { receipt, compilerData: JSON.stringify({ source, lines }) };
}
