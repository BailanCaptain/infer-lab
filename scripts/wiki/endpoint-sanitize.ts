/**
 * Pure secret-free endpoint URL and harness argument sanitization helpers.
 * Zero internal module imports to avoid circular dependencies across workflow/pages/ingest.
 */

export function stripUrlCredentials(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    const pathname = parsed.pathname.replace(/\/+$/, "");
    return `${parsed.protocol}//${parsed.host}${pathname}`;
  } catch {
    return trimmed
      .replace(/([a-z][a-z0-9+.-]*:\/\/)([^:@/\s]+):([^@/\s]+)@/gi, "$1")
      .replace(/[?#][\s\S]*$/, "")
      .replace(/\/+$/, "");
  }
}

const FLAG_NAME_RE = /^--?[a-z0-9][a-z0-9_-]*$/i;
const FLAG_ASSIGN_RE = /^(--?[a-z0-9][a-z0-9_-]*)=([\s\S]*)$/i;
const ALWAYS_SECRET_SEGMENTS = new Set([
  "secret",
  "secrets",
  "password",
  "passwords",
  "passwd",
  "passphrase",
  "bearer",
  "credential",
  "credentials",
  "auth",
  "authorization",
  "apikey",
  "apikeys",
  "authtoken",
  "accesstoken",
  "bearertoken",
  "refreshtoken",
  "idtoken",
  "sessiontoken",
  "clientsecret",
]);
const NON_SECRET_TOKEN_SEGMENTS = new Set([
  "max",
  "min",
  "num",
  "count",
  "limit",
  "batched",
  "batch",
  "prompt",
  "input",
  "output",
  "completion",
  "total",
  "spec",
  "speculative",
  "draft",
  "new",
  "pad",
  "bos",
  "eos",
  "stop",
  "special",
  "extra",
  "cache",
  "block",
  "chunk",
  "prefill",
  "decode",
  "context",
  "window",
  "len",
  "length",
  "size",
  "budget",
  "rate",
  "per",
  "tokenizer",
  "tokenize",
  "vocab",
  "logprob",
  "logprobs",
]);

function isSecretFlagName(rawFlag: string): boolean {
  const trimmed = rawFlag.trim();
  if (!FLAG_NAME_RE.test(trimmed)) return false;
  const body = trimmed.replace(/^-+/, "");
  const segments = body
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .split(/[-_]+/)
    .filter(Boolean);
  if (segments.length === 0) return false;
  if (segments.some((seg) => ALWAYS_SECRET_SEGMENTS.has(seg))) return true;
  if (segments.some((seg) => seg === "key" || seg === "keys")) return true;
  if (segments.some((seg) => seg === "token" || seg === "tokens")) {
    return !segments.some((seg) => NON_SECRET_TOKEN_SEGMENTS.has(seg));
  }
  return false;
}

const SECRET_ENV_ASSIGN_RE = /^([A-Z0-9_]*(?:API_KEY|SECRET|TOKEN|PASSWORD|PASSWD|CREDENTIAL))=([\s\S]*)$/;
const SECRET_INLINE_RE =
  /\b(?:sk-[A-Za-z0-9_-]{12,}|hf_[A-Za-z0-9]{12,})\b|Authorization\s*:\s*(?:Bearer|Basic|Token)\s+\S+|[a-z][a-z0-9+.-]*:\/\/[^:@/\s]+:[^@/\s]+@/i;

function sanitizeSingleArg(arg: string): string {
  const eq = FLAG_ASSIGN_RE.exec(arg);
  if (eq && isSecretFlagName(eq[1]!)) return `${eq[1]}=[REDACTED]`;
  const envAssign = SECRET_ENV_ASSIGN_RE.exec(arg);
  if (envAssign) return `${envAssign[1]}=[REDACTED]`;
  return arg
    .replace(/(Authorization\s*:\s*(?:Bearer|Basic|Token)\s+)([^\s"']+)/gi, "$1[REDACTED]")
    .replace(/\b(sk-[A-Za-z0-9_-]{12,}|hf_[A-Za-z0-9]{12,})\b/g, "[REDACTED]")
    .replace(/([a-z][a-z0-9+.-]*:\/\/)([^:@/\s]+):([^@/\s]+)@/gi, "$1[REDACTED]@");
}

export function sanitizeHarnessArgs(args: readonly string[]): string[] {
  const out: string[] = [];
  let redactValues = false;
  for (const arg of args) {
    if (redactValues) {
      if (!arg.startsWith("-")) {
        out.push("[REDACTED]");
        continue;
      }
      redactValues = false;
    }
    if (isSecretFlagName(arg)) {
      out.push(arg);
      redactValues = true;
      continue;
    }
    out.push(sanitizeSingleArg(arg));
  }
  return out;
}

export function hasSecretHarnessArg(args: readonly string[]): boolean {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (isSecretFlagName(arg) && i + 1 < args.length && !args[i + 1]!.startsWith("-")) return true;
    const eq = FLAG_ASSIGN_RE.exec(arg);
    if ((eq && isSecretFlagName(eq[1]!)) || SECRET_ENV_ASSIGN_RE.test(arg) || SECRET_INLINE_RE.test(arg)) {
      return true;
    }
  }
  return false;
}
