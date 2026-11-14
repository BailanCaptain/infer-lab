import { join } from "node:path";
import { readSyncConfig } from "./sync-config";

export const jsonBytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value), "utf8");

/**
 * No shared tokenizer exists across providers. Budget one UTF-8 byte per input token
 * conservatively, with separate space for output and provider framing.
 */
export function inputByteLimit(
  root: string,
  rules: string,
  snapshot?: { contextWindowTokens: number; outputReserveTokens: number },
) {
  const config = snapshot ?? readSyncConfig(join(root, "wiki/sync.config.json"));
  const available =
    config.contextWindowTokens - config.outputReserveTokens - 8192 - Buffer.byteLength(rules, "utf8");
  if (available < 4096) throw new Error("模型上下文窗口不足以容纳写作规则和输出预留；请配置实际可用窗口");
  return available;
}

export function assertInputFits(
  root: string,
  rules: string,
  stdin: string,
  snapshot?: { contextWindowTokens: number; outputReserveTokens: number },
) {
  const limit = inputByteLimit(root, rules, snapshot);
  if (Buffer.byteLength(stdin, "utf8") > limit)
    throw new Error(`模型输入超过本次可用预算 ${limit} 字节，需要分段处理`);
}

/** UTF-16 offsets remain exact, including a single huge line and surrogate pairs. */
export function textChunks(text: string, maxBytes: number) {
  if (!Number.isInteger(maxBytes) || maxBytes < 16) throw new Error("分段预算过小");
  const result: { start: number; end: number; text: string }[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(text.length, start + maxBytes);
    while (Buffer.byteLength(text.slice(start, end), "utf8") > maxBytes)
      end = start + Math.max(1, Math.floor((end - start) * 0.8));
    if (end < text.length && /[\uD800-\uDBFF]/.test(text[end - 1]!)) end--;
    if (end < text.length) {
      const newline = text.lastIndexOf("\n", end - 1);
      if (newline > start + (end - start) / 2) end = newline + 1;
    }
    result.push({ start, end, text: text.slice(start, end) });
    start = end;
  }
  return result;
}
