/**
 * Deterministic screening for compiler input, informed by Multi-Agent's Unicode,
 * HTML, role-token and encoded-instruction passes. This is a risk filter, not a
 * trust verdict. Removed spans are excluded; blocked inputs return no compiler text.
 */
export const SANITIZER_VERSION = "wiki-text-v1";
const MAX_BYTES = 1024 * 1024;
const INVISIBLE = /[\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff\u{e0000}-\u{e007f}]/gu;
// biome-ignore lint/suspicious/noControlCharactersInRegex: intentionally detect control characters
const CONTROL = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/;
const INSTRUCTION =
  /ignore (?:all )?(?:previous|above) instructions|disregard (?:all )?(?:previous|above)|(?:reveal|override|ignore|print|leak|show|return).{0,60}system prompts?|(?:忽略|无视|覆盖).{0,12}(?:指令|提示词)|(?:输出|泄露|显示).{0,12}系统提示词/i;
const ROLE =
  /<\|(?:im_start|im_end|system|assistant|endoftext)\|>|\[\/?INST\]|<<\/?SYS>>|(?:^|\n)\s*(?:role:\s*(?:system|developer|assistant)|(?:system|developer|assistant|human):)/i;
const ACTIVE_HTML =
  /<\/?(?:script|iframe|object|embed)\b|(?:javascript|vbscript):|data:(?:text\/html|application\/javascript)/i;

export interface SanitizeResult {
  version: string;
  blocked: boolean;
  text: string;
  findings: { reason: string }[];
}

function detectionText(text: string): string {
  return text
    .normalize("NFKC")
    .replace(INVISIBLE, "")
    .replace(/&#(x[0-9a-f]+|\d+);?/gi, (whole, n: string) => {
      const code = n[0]?.toLowerCase() === "x" ? Number.parseInt(n.slice(1), 16) : Number(n);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    })
    .replace(/&colon;/gi, ":")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function containsInstruction(text: string): boolean {
  const view = detectionText(text);
  return INSTRUCTION.test(view.replace(/\s+/g, " ")) || ROLE.test(view) || ACTIVE_HTML.test(view);
}

function encodedInstruction(text: string, depth = 0): boolean {
  if (depth === 3) return false;
  for (const m of text.matchAll(/\b[A-Za-z0-9+/]{32,}={0,2}/g)) {
    const decoded = Buffer.from(m[0], "base64").toString("utf8");
    if (containsInstruction(decoded) || encodedInstruction(decoded, depth + 1)) return true;
  }
  return false;
}

export function sanitizeRawInput(input: string): SanitizeResult {
  const findings: SanitizeResult["findings"] = [];
  const blocked = (reason: string): SanitizeResult => ({
    version: SANITIZER_VERSION,
    blocked: true,
    text: "",
    findings: [...findings, { reason }],
  });
  if (Buffer.byteLength(input, "utf8") > MAX_BYTES) return blocked("size-limit");
  if (CONTROL.test(input)) return blocked("control-character");
  // Preserve newline bytes so a remaining line still cites its original location.
  let text = input.replace(/<!--[\s\S]*?(?:-->|$)/g, (comment) => {
    findings.push({ reason: "html-comment" });
    return comment.replace(/[^\r\n]/g, "");
  });
  const visible = text.replace(INVISIBLE, "");
  if (visible !== text) findings.push({ reason: "invisible-character" });
  text = visible;
  if (containsInstruction(text)) return blocked("instruction-or-active-content");
  if (encodedInstruction(detectionText(text))) return blocked("encoded-instruction");
  if (!text.trim()) return blocked("empty-input");
  return { version: SANITIZER_VERSION, blocked: false, text, findings };
}
