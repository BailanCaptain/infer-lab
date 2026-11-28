import { classifyEnvVar, type MoeCommMethod, selectMoeCommMethod, VERIFIED_COMMITS } from "../rules";
import { ASCEND_KNOB_CATALOG, getKnobById } from "./ascendKnobCatalog";
import {
  type ActiveKnobEntry,
  type AscendKnobSpec,
  type KnobConflictFinding,
  type KnobEvaluationResult,
  type KnobFixAction,
  type KnobSandboxContext,
  type KnobSelectionMap,
  resolveKnobLifecycle,
} from "./types";

const VA030 = VERIFIED_COMMITS.vllmAscendV030;
const VAMAIN = VERIFIED_COMMITS.vllmAscendMain;
const V030 = VERIFIED_COMMITS.vllmV030;
const MEASURED_DOC_COMMIT = "d1b1a14";

export const URL_SEL_CORRUPT_SENTINEL_PREFIX = "__URL_SEL_CORRUPT__:";
export const URL_SEL_PARSE_ERROR_KEY = "__url_sel_parse_error__";

function isCorruptUrlSentinel(val: unknown): boolean {
  return typeof val === "string" && val.startsWith(URL_SEL_CORRUPT_SENTINEL_PREFIX);
}

export function applyKnobFixAction(
  context: KnobSandboxContext,
  selections: KnobSelectionMap,
  fixAction: KnobFixAction,
): { context: KnobSandboxContext; selections: Record<string, string | number | boolean> } {
  const nextContext: KnobSandboxContext = fixAction.nextContextPatch
    ? { ...context, ...fixAction.nextContextPatch }
    : { ...context };
  const nextSelections: Record<string, string | number | boolean> = { ...selections };
  if (fixAction.nextSelections) {
    for (const [key, val] of Object.entries(fixAction.nextSelections)) {
      if (val === null) {
        delete nextSelections[key];
      } else {
        nextSelections[key] = val;
      }
    }
  }
  return { context: nextContext, selections: nextSelections };
}

function parseBoolLike(value: string | number | boolean | undefined): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
    return undefined;
  }
  if (typeof value === "string") {
    const norm = value.toLowerCase();
    if (norm === "true" || norm === "1" || norm === "yes" || norm === "on" || norm === "t" || norm === "y") {
      return true;
    }
    if (norm === "false" || norm === "0" || norm === "no" || norm === "off" || norm === "f" || norm === "n") {
      return false;
    }
  }
  return undefined;
}

const ND_ZERO_CODEPOINTS = [
  0x30, 0x660, 0x6f0, 0x7c0, 0x966, 0x9e6, 0xa66, 0xae6, 0xb66, 0xbe6, 0xc66, 0xce6, 0xd66, 0xde6, 0xe50,
  0xed0, 0xf20, 0x1040, 0x1090, 0x17e0, 0x1810, 0x1946, 0x19d0, 0x1a80, 0x1a90, 0x1b50, 0x1bb0, 0x1c40,
  0x1c50, 0xa620, 0xa8d0, 0xa900, 0xa9d0, 0xa9f0, 0xaa50, 0xabf0, 0xff10, 0x104a0, 0x10d30, 0x11066, 0x110f0,
  0x11136, 0x111d0, 0x112f0, 0x11450, 0x114d0, 0x11650, 0x116c0, 0x11730, 0x118e0, 0x11950, 0x11c50, 0x11d50,
  0x11da0, 0x11f50, 0x16a60, 0x16ac0, 0x16b50, 0x1d7ce, 0x1d7d8, 0x1d7e2, 0x1d7ec, 0x1d7f6, 0x1e140, 0x1e2f0,
  0x1e4f0, 0x1e950, 0x1fbf0,
] as const;

function normalizePythonUnicodeDigits(raw: string): string {
  let out = "";
  for (const ch of raw) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= 0x30 && cp <= 0x39) {
      out += ch;
      continue;
    }
    if (cp < 0x660) {
      out += ch;
      continue;
    }
    let mapped = ch;
    for (const zeroCp of ND_ZERO_CODEPOINTS) {
      if (cp >= zeroCp && cp <= zeroCp + 9) {
        mapped = String(cp - zeroCp);
        break;
      }
      if (zeroCp > cp) break;
    }
    out += mapped;
  }
  return out;
}

function trimPythonWhitespace(raw: string): string {
  return raw.replace(/^\p{White_Space}+|\p{White_Space}+$/gu, "");
}

type JsonWithRawSupport = typeof JSON & {
  rawJSON?: (text: string) => object;
};
const JSON_RAW = JSON as JsonWithRawSupport;
const I64_MIN_BIG = -(1n << 63n);
const I64_MAX_EXCLUSIVE_BIG = 1n << 63n;

interface RawJsonNumberMeta {
  readonly source: string;
  readonly isIntToken: boolean;
  readonly floatVal: number;
}

const RAW_JSON_NUMBERS = new WeakMap<object, RawJsonNumberMeta>();

export function createRawJsonLiteral(
  source: string,
  meta?: { isIntToken?: boolean; floatVal?: number },
): object {
  const obj = typeof JSON_RAW.rawJSON === "function" ? JSON_RAW.rawJSON(source) : Object.freeze({});
  RAW_JSON_NUMBERS.set(obj, {
    source,
    isIntToken: meta?.isIntToken ?? /^-?\d+$/.test(source),
    floatVal: meta?.floatVal ?? Number(source),
  });
  return obj;
}

export function parseLosslessJson<TNum = unknown>(
  text: string,
  onNumber: (source: string, floatVal: number, isIntToken: boolean) => TNum,
): unknown {
  // First validate strict RFC-8259 syntax via native JSON.parse
  JSON.parse(text);
  let idx = 0;
  const len = text.length;
  const skipWs = () => {
    while (idx < len) {
      const c = text.charCodeAt(idx);
      if (c === 32 || c === 9 || c === 10 || c === 13) idx += 1;
      else break;
    }
  };
  const readStr = (): string => {
    const start = idx;
    idx += 1; // skip opening "
    while (idx < len) {
      const c = text.charCodeAt(idx);
      if (c === 92) {
        idx += 2;
      } else if (c === 34) {
        idx += 1;
        break;
      } else {
        idx += 1;
      }
    }
    return JSON.parse(text.slice(start, idx)) as string;
  };
  const readVal = (): unknown => {
    skipWs();
    const ch = text[idx];
    if (ch === "{") {
      idx += 1;
      skipWs();
      const obj: Record<string, unknown> = {};
      if (text[idx] === "}") {
        idx += 1;
        return obj;
      }
      while (idx < len) {
        skipWs();
        const key = readStr();
        skipWs();
        idx += 1; // ':'
        const val = readVal();
        Object.defineProperty(obj, key, {
          value: val,
          enumerable: true,
          writable: true,
          configurable: true,
        });
        skipWs();
        if (text[idx] === ",") {
          idx += 1;
        } else {
          idx += 1; // '}'
          break;
        }
      }
      return obj;
    }
    if (ch === "[") {
      idx += 1;
      skipWs();
      const arr: unknown[] = [];
      if (text[idx] === "]") {
        idx += 1;
        return arr;
      }
      while (idx < len) {
        arr.push(readVal());
        skipWs();
        if (text[idx] === ",") {
          idx += 1;
        } else {
          idx += 1; // ']'
          break;
        }
      }
      return arr;
    }
    if (ch === '"') return readStr();
    if (ch === "t") {
      idx += 4;
      return true;
    }
    if (ch === "f") {
      idx += 5;
      return false;
    }
    if (ch === "n") {
      idx += 4;
      return null;
    }
    const start = idx;
    while (idx < len && /[-+0-9.eE]/.test(text[idx]!)) idx += 1;
    const rawNum = text.slice(start, idx);
    return onNumber(rawNum, Number(rawNum), /^-?\d+$/.test(rawNum));
  };
  return readVal();
}

export function stringifyLosslessJson(value: unknown, space = 0): string {
  const indentUnit = space > 0 ? " ".repeat(space) : "";
  const ser = (val: unknown, depth: number): string | undefined => {
    if (val && typeof val === "object") {
      const rawMeta = RAW_JSON_NUMBERS.get(val);
      if (rawMeta) return rawMeta.source;
      if (Array.isArray(val)) {
        if (val.length === 0) return "[]";
        if (space > 0) {
          const innerPad = indentUnit.repeat(depth + 1);
          const closePad = indentUnit.repeat(depth);
          const items = val.map((item) => `${innerPad}${ser(item, depth + 1) ?? "null"}`);
          return `[\n${items.join(",\n")}\n${closePad}]`;
        }
        return `[${val.map((item) => ser(item, depth + 1) ?? "null").join(",")}]`;
      }
      const entries: string[] = [];
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        const sv = ser(v, depth + 1);
        if (sv !== undefined) {
          entries.push(space > 0 ? `${JSON.stringify(k)}: ${sv}` : `${JSON.stringify(k)}:${sv}`);
        }
      }
      if (entries.length === 0) return "{}";
      if (space > 0) {
        const innerPad = indentUnit.repeat(depth + 1);
        const closePad = indentUnit.repeat(depth);
        return `{\n${entries.map((e) => `${innerPad}${e}`).join(",\n")}\n${closePad}}`;
      }
      return `{${entries.join(",")}}`;
    }
    if (val === undefined || typeof val === "function" || typeof val === "symbol") {
      return undefined;
    }
    return JSON.stringify(val);
  };
  return ser(value, 0) ?? "null";
}

const PY_DIGITS = "\\d(?:_?\\d)*";
const PY_PURE_INT_RE = new RegExp(`^[+-]?${PY_DIGITS}$`);
const PY_LAX_INT_CORE = `(?:(?:0_*)*0|(?:0_*)*[1-9](?:_?\\d)*)`;
const PY_LAX_INT_RE = new RegExp(`^[+-]?${PY_LAX_INT_CORE}(?:\\.0+)?$`);
const PY_FLOAT_RE = new RegExp(
  `^[+-]?(?:${PY_DIGITS}(?:\\.(?:${PY_DIGITS})?)?|\\.${PY_DIGITS})(?:[eE][+-]?${PY_DIGITS})?$`,
);

function clampBigIntToSafeNumber(big: bigint): number {
  if (big > BigInt(Number.MAX_SAFE_INTEGER)) return Number.MAX_SAFE_INTEGER;
  if (big < BigInt(Number.MIN_SAFE_INTEGER)) return Number.MIN_SAFE_INTEGER;
  return Number(big);
}

function parseFloatNumberAsI64BigInt(value: number): bigint | undefined {
  if (!Number.isFinite(value) || !Number.isInteger(value)) return undefined;
  const big = BigInt(value);
  return big >= I64_MIN_BIG && big < I64_MAX_EXCLUSIVE_BIG ? big : undefined;
}

function parsePureBigIntLike(value: string | number | boolean | undefined): bigint | undefined {
  if (typeof value === "number") {
    return parseFloatNumberAsI64BigInt(value);
  }
  if (typeof value === "string") {
    const trimmed = trimPythonWhitespace(value);
    if (!PY_PURE_INT_RE.test(trimmed)) return undefined;
    try {
      return BigInt(trimmed.replace(/_/g, ""));
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function parseStrictBigIntLike(value: string | number | boolean | undefined): bigint | undefined {
  if (typeof value === "number") {
    return parseFloatNumberAsI64BigInt(value);
  }
  if (typeof value === "string") {
    const trimmed = trimPythonWhitespace(value);
    if (!PY_LAX_INT_RE.test(trimmed)) return undefined;
    const intPart = trimmed.split(".")[0] ?? trimmed;
    try {
      return BigInt(intPart.replace(/_/g, ""));
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function getRawJsonNumberMeta(val: unknown): RawJsonNumberMeta | undefined {
  return val && typeof val === "object" ? RAW_JSON_NUMBERS.get(val) : undefined;
}

function parsePydanticLaxBigIntWithBool(value: unknown): bigint | undefined {
  const rawMeta = getRawJsonNumberMeta(value);
  if (rawMeta) {
    if (rawMeta.isIntToken) {
      try {
        return BigInt(rawMeta.source);
      } catch {
        return undefined;
      }
    }
    return parseFloatNumberAsI64BigInt(rawMeta.floatVal);
  }
  if (typeof value === "boolean") return value ? 1n : 0n;
  if (typeof value === "number" || typeof value === "string") {
    return parseStrictBigIntLike(value);
  }
  return undefined;
}

function parseNumberLike(value: string | number | boolean | undefined): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") {
    const trimmed = trimPythonWhitespace(value);
    if (!PY_FLOAT_RE.test(trimmed)) return undefined;
    const n = Number(trimmed.replace(/_/g, ""));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function parseCliFloatLike(value: string | number | boolean | undefined): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") {
    return parseNumberLike(normalizePythonUnicodeDigits(value));
  }
  return undefined;
}

function parsePureIntLike(value: string | number | boolean | undefined): number | undefined {
  const big = parsePureBigIntLike(value);
  return big === undefined ? undefined : clampBigIntToSafeNumber(big);
}

function parseCliBigIntLike(value: string | number | boolean | undefined): bigint | undefined {
  if (typeof value === "number") {
    return parseFloatNumberAsI64BigInt(value);
  }
  if (typeof value === "string") {
    return parsePureBigIntLike(normalizePythonUnicodeDigits(value));
  }
  return undefined;
}

function parseCliIntLike(value: string | number | boolean | undefined): number | undefined {
  const big = parseCliBigIntLike(value);
  return big === undefined ? undefined : clampBigIntToSafeNumber(big);
}

function parseHumanReadableBigIntLike(value: string | number | boolean | undefined): bigint | undefined {
  if (typeof value === "number") {
    return parseFloatNumberAsI64BigInt(value);
  }
  if (typeof value === "string") {
    const trimmed = normalizePythonUnicodeDigits(trimPythonWhitespace(value));
    const match = /^(\d+(?:\.\d+)?)([kKmMgGtT])$/.exec(trimmed);
    if (match) {
      const [, numStr = "", suffix = ""] = match;
      const decMult: Record<string, number> = { k: 1e3, m: 1e6, g: 1e9, t: 1e12 };
      const binMult: Record<string, bigint> = {
        K: 1024n,
        M: 1048576n,
        G: 1073741824n,
        T: 1099511627776n,
      };
      if (suffix in decMult) {
        const res = Math.trunc(Number(numStr) * (decMult[suffix] ?? 1));
        return Number.isFinite(res) ? BigInt(res) : undefined;
      }
      if (suffix in binMult) {
        if (numStr.includes(".")) return undefined;
        try {
          return BigInt(numStr) * (binMult[suffix] ?? 1n);
        } catch {
          return undefined;
        }
      }
    }
    return parsePureBigIntLike(trimmed);
  }
  return undefined;
}

function parseHumanReadableIntLike(value: string | number | boolean | undefined): number | undefined {
  const big = parseHumanReadableBigIntLike(value);
  return big === undefined ? undefined : clampBigIntToSafeNumber(big);
}

function parseStrictIntLike(value: string | number | boolean | undefined): number | undefined {
  const big = parseStrictBigIntLike(value);
  return big === undefined ? undefined : clampBigIntToSafeNumber(big);
}

function parseEnvIntLike(value: string | number | boolean | undefined): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) && Number.isSafeInteger(value) ? value : undefined;
  }
  if (typeof value === "string") {
    if (!/^[+-]?\d+$/.test(value)) return undefined;
    const n = Number(value);
    return Number.isSafeInteger(n) ? n : undefined;
  }
  return undefined;
}

function parseIntForSpec(
  spec: Pick<AscendKnobSpec, "id" | "entryKind">,
  value: string | number | boolean | undefined,
): number | undefined {
  if (spec.id === "cli_max_num_batched_tokens") {
    return parseHumanReadableIntLike(value);
  }
  if (spec.entryKind === "env") {
    return parseEnvIntLike(value);
  }
  if (spec.entryKind === "additional_config") {
    return parseStrictIntLike(value);
  }
  return spec.id === "cli_ec_recv_buffer_tokens" ? parsePureIntLike(value) : parseCliIntLike(value);
}

function parseJsonValue(raw: string | number | boolean): unknown {
  if (typeof raw !== "string") return raw;
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return parseLosslessJson(trimmed, (source, floatVal, isIntToken) => {
        if (!Number.isSafeInteger(floatVal) && (isIntToken || Number.isInteger(floatVal))) {
          return createRawJsonLiteral(source, { isIntToken, floatVal });
        }
        return floatVal;
      });
    } catch {
      return raw;
    }
  }
  return raw;
}

function setNestedPath(target: Record<string, unknown>, dotPath: string, value: unknown): void {
  const segments = dotPath.split(".");
  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const key = segments[i];
    if (!key) continue;
    const existing = cursor[key];
    if (existing && typeof existing === "object" && !Array.isArray(existing)) {
      cursor = existing as Record<string, unknown>;
    } else {
      const next: Record<string, unknown> = {};
      cursor[key] = next;
      cursor = next;
    }
  }
  const leaf = segments[segments.length - 1];
  if (leaf) {
    cursor[leaf] = value;
  }
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_.,:/=-]+$/.test(value)) {
    return value;
  }
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function modelPlaceholderFor(
  modelKind: KnobSandboxContext["modelKind"],
  isAscendQuantized = false,
  sparseKvOffload = false,
): string {
  if (sparseKvOffload && modelKind === "mla_moe") {
    return "deepseek-ai/DeepSeek-V3.2-Exp";
  }
  if (isAscendQuantized) {
    switch (modelKind) {
      case "dense":
        return "Ascend-ModelSlim/Qwen3-8B-W8A8";
      case "moe":
        return "Ascend-ModelSlim/Qwen3-235B-A22B-W8A8";
      case "mla_moe":
        return "Ascend-ModelSlim/DeepSeek-V3-W8A8";
      case "engram_moe":
        return "Ascend-ModelSlim/DeepSeek-V4.1-Engram-W8A8";
    }
  }
  switch (modelKind) {
    case "dense":
      return "Qwen/Qwen3-8B";
    case "moe":
      return "Qwen/Qwen3-235B-A22B";
    case "mla_moe":
      return "deepseek-ai/DeepSeek-V3";
    case "engram_moe":
      return "deepseek-ai/DeepSeek-V4.1";
  }
}

const DEDICATED_RANGE_INT_KNOB_IDS: ReadonlySet<string> = new Set([
  "cfg_eplb_stair_rank_transfer_limit",
  "cfg_eplb_stair_cross_node_transfer_limit",
  "cfg_sparse_kv_offload_topk_buffer_size",
  "cli_ec_recv_buffer_tokens",
]);

function isInvalidGeneralNumericValue(spec: AscendKnobSpec, rawVal: string | number | boolean): boolean {
  if (typeof rawVal === "boolean") return true;
  if (spec.valueType === "int") {
    const intNum = parseIntForSpec(spec, rawVal);
    if (intNum === undefined) return true;
    if (spec.id === "cfg_sparse_kv_offload_topk_buffer_size") {
      return intNum !== -1 && intNum <= 0;
    }
    if (spec.id === "cfg_eplb_stair_rank_transfer_limit") {
      return intNum !== -1 && intNum < 1;
    }
    if (spec.id === "cfg_eplb_stair_cross_node_transfer_limit") {
      return intNum < -1;
    }
    if (spec.id === "cli_ec_recv_buffer_tokens") {
      return intNum < 2048;
    }
    if (spec.id === "cli_max_num_batched_tokens" || spec.id === "cli_max_num_seqs") {
      return intNum < 1;
    }
    return intNum < 0;
  }
  const num = spec.entryKind === "cli_core" ? parseCliFloatLike(rawVal) : parseNumberLike(rawVal);
  if (num === undefined || !Number.isFinite(num)) return true;
  if (spec.valueType === "float") {
    if (spec.id === "cli_gpu_memory_utilization") {
      return num <= 0 || num > 1;
    }
    return num < 0;
  }
  return false;
}

function isValidJsonKnobPayload(
  spec: Pick<AscendKnobSpec, "id">,
  raw: string | number | boolean | undefined,
): boolean {
  if (typeof raw !== "string") return false;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) return false;
  let parsed: unknown;
  try {
    parsed = parseLosslessJson(trimmed, (source, floatVal, isIntToken) =>
      createRawJsonLiteral(source, { isIntToken, floatVal }),
    );
  } catch {
    return false;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || getRawJsonNumberMeta(parsed)) {
    return false;
  }
  const obj = parsed as Record<string, unknown>;

  if (spec.id === "cfg_quantized_all_reduce_config") {
    const allowed = new Set(["enable", "min_numel"]);
    for (const k of Object.keys(obj)) {
      if (!allowed.has(k)) return false;
    }
    if ("enable" in obj) {
      const enMeta = getRawJsonNumberMeta(obj.enable);
      const en = enMeta
        ? enMeta.isIntToken
          ? (() => {
              const b = BigInt(enMeta.source);
              return b === 0n ? 0 : b === 1n ? 1 : 2;
            })()
          : enMeta.floatVal === 0 || enMeta.floatVal === 1
            ? enMeta.floatVal
            : 2
        : obj.enable;
      if (
        (typeof en !== "boolean" && typeof en !== "number" && typeof en !== "string") ||
        parseBoolLike(en) === undefined
      ) {
        return false;
      }
    }
    if ("min_numel" in obj) {
      const mnBig = parsePydanticLaxBigIntWithBool(obj.min_numel);
      if (mnBig === undefined || mnBig < 1n) return false;
    }
    return true;
  }

  if (spec.id === "cfg_shared_engram") {
    const allowed = new Set([
      "backend",
      "endpoint",
      "capacity",
      "library_path",
      "listen_port",
      "local_comm_res",
    ]);
    for (const k of Object.keys(obj)) {
      if (!allowed.has(k)) return false;
    }
    if (obj.backend !== "a2" && obj.backend !== "a3" && obj.backend !== "a5") return false;
    if (typeof obj.endpoint !== "string") return false;
    const sepIdx = obj.endpoint.lastIndexOf(":");
    if (sepIdx <= 0) return false;
    const portRaw = obj.endpoint.slice(sepIdx + 1);
    if (portRaw.length === 0) return false;
    const normPort = normalizePythonUnicodeDigits(portRaw);
    if (!/^\d+$/.test(normPort)) return false;
    const portBig = BigInt(normPort);
    if (portBig <= 0n || portBig >= 65536n) return false;

    if (obj.backend === "a3") {
      if ("capacity" in obj) {
        const capMeta = getRawJsonNumberMeta(obj.capacity);
        const capOk = capMeta
          ? capMeta.isIntToken
            ? BigInt(capMeta.source) === 65536n
            : capMeta.floatVal === 65536
          : false;
        if (!capOk) return false;
      }
      if ("library_path" in obj && obj.library_path !== null) return false;
      if ("listen_port" in obj && obj.listen_port !== null) return false;
      if ("local_comm_res" in obj && obj.local_comm_res !== null) return false;
    }

    if ("capacity" in obj) {
      const capBig = parsePydanticLaxBigIntWithBool(obj.capacity);
      if (capBig === undefined || capBig < 1n || capBig > 262144n) return false;
    }
    if ("library_path" in obj && obj.library_path !== null) {
      if (typeof obj.library_path !== "string") return false;
    }
    if ("listen_port" in obj && obj.listen_port !== null) {
      const lpBig = parsePydanticLaxBigIntWithBool(obj.listen_port);
      if (lpBig === undefined || lpBig < 1n || lpBig >= 65536n) return false;
    }
    if ("local_comm_res" in obj && obj.local_comm_res !== null) {
      if (typeof obj.local_comm_res !== "string") return false;
    }
    if (obj.listen_port !== undefined && obj.listen_port !== null && obj.local_comm_res) {
      return false;
    }
    return true;
  }

  return true;
}

const BASE_KV_CACHE_DTYPES = [
  "auto",
  "float16",
  "bfloat16",
  "int8",
  "mxfp8",
  "fp8",
  "fp8_e4m3",
  "fp8_e5m2",
  "fp8_inc",
  "fp8_ds_mla",
  "nvfp4_ds_mla",
  "turboquant_k8v4",
  "turboquant_4bit_nc",
  "turboquant_k3v4_nc",
  "turboquant_3bit_nc",
  "int4_per_token_head",
  "int8_per_token_head",
  "fp8_per_token_head",
  "nvfp4",
  "nvfp4_4over6",
] as const;

export const UPSTREAM_KV_CACHE_DTYPES_BY_VERSION: Readonly<
  Record<KnobSandboxContext["version"], ReadonlySet<string>>
> = {
  "v0.30.0": new Set(BASE_KV_CACHE_DTYPES),
  main: new Set([
    ...BASE_KV_CACHE_DTYPES,
    "octave_k3v4",
    "octave_k3v3",
    "octave_k3v3_compact",
    "ultraquant_4bit",
  ]),
};

export function isAllowedEnumValue(
  spec: AscendKnobSpec,
  rawVal: string | number | boolean,
  version?: KnobSandboxContext["version"],
): boolean {
  if (
    spec.id === "env_enable_flashcomm1" &&
    typeof rawVal === "string" &&
    ["0", "1", "true", "false"].includes(rawVal.trim().toLowerCase())
  ) {
    return true;
  }
  if (
    spec.id === "env_expert_map_record" &&
    typeof rawVal === "string" &&
    ["true", "false", "1"].includes(rawVal.toLowerCase())
  ) {
    return true;
  }
  if (spec.id === "cli_kv_cache_dtype" && typeof rawVal === "string") {
    if (version) {
      return UPSTREAM_KV_CACHE_DTYPES_BY_VERSION[version].has(rawVal);
    }
    return (
      UPSTREAM_KV_CACHE_DTYPES_BY_VERSION["v0.30.0"].has(rawVal) ||
      UPSTREAM_KV_CACHE_DTYPES_BY_VERSION.main.has(rawVal)
    );
  }
  const candidates = version
    ? (spec.recommendedValuesByVersion?.[version] ?? spec.recommendedValues)
    : [
        ...spec.recommendedValues,
        ...(spec.recommendedValuesByVersion?.["v0.30.0"] ?? []),
        ...(spec.recommendedValuesByVersion?.main ?? []),
      ];
  return candidates.some((rv) => rv.value === rawVal);
}

const ASCEND_IMPLEMENTED_KV_CACHE_DTYPES: ReadonlySet<string> = new Set([
  "auto",
  "float16",
  "bfloat16",
  "int8",
  "fp8",
  "fp8_e4m3",
  "mxfp8",
  "turboquant_4bit_nc",
]);

function isStrippedInCommandOutput(
  spec: AscendKnobSpec,
  version: KnobSandboxContext["version"],
  rawVal: string | number | boolean,
  selections: KnobSelectionMap,
): boolean {
  if (typeof rawVal === "string" && rawVal.startsWith(URL_SEL_CORRUPT_SENTINEL_PREFIX)) {
    return true;
  }
  const versionStatus = spec.statusByVersion[version];
  if (versionStatus === "absent" || versionStatus === "retired") {
    return true;
  }
  if (resolveKnobLifecycle(spec, version) === "retired-trap") {
    return true;
  }
  if (
    spec.id === "env_ascend_rt_visible_devices" &&
    (typeof rawVal !== "string" || !/^\d+(?:,\d+)*$/.test(rawVal))
  ) {
    return true;
  }
  if (spec.id === "env_vllm_use_v2_model_runner" && version === "main" && parseBoolLike(rawVal) === false) {
    return true;
  }
  if (spec.id === "cli_quantization" && String(rawVal).trim().toLowerCase() === "modelslim") {
    return true;
  }
  if (
    spec.id === "cli_kv_cache_dtype" &&
    (typeof rawVal !== "string" || !ASCEND_IMPLEMENTED_KV_CACHE_DTYPES.has(rawVal))
  ) {
    return true;
  }
  if (spec.valueType === "enum" && !isAllowedEnumValue(spec, rawVal, version)) {
    return true;
  }
  if (spec.valueType === "bool" && parseBoolLike(rawVal) === undefined) {
    return true;
  }
  if (
    (spec.valueType === "int" || spec.valueType === "float") &&
    isInvalidGeneralNumericValue(spec, rawVal)
  ) {
    return true;
  }
  if (
    spec.id === "cfg_sparse_kv_offload_topk_buffer_size" &&
    parseBoolLike(selections.cfg_sparse_kv_offload_enabled) === true
  ) {
    const topkBig = parseStrictBigIntLike(rawVal);
    if (topkBig === undefined || (topkBig !== -1n && (topkBig < 2048n || topkBig % 128n !== 0n))) {
      return true;
    }
  }
  if (spec.valueType === "json" && !isValidJsonKnobPayload(spec, rawVal)) {
    return true;
  }
  return false;
}

function parseJsonObject(raw: string | number | boolean | undefined): Record<string, unknown> | undefined {
  if (raw === undefined) return undefined;
  const parsed = parseJsonValue(raw);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  return undefined;
}

function computeRequiredMc2BuffSizeMiB(
  context: KnobSandboxContext,
  selections: KnobSelectionMap,
  fusedLevel: number,
): number {
  const maxBatchedTokens = parseHumanReadableIntLike(selections.cli_max_num_batched_tokens) ?? 2048;
  const prefillActive =
    parseBoolLike(selections.cfg_enable_prefill_mc2) === true ||
    (fusedLevel === 2 && context.pdRole !== "decode");
  const batchTokens = prefillActive ? maxBatchedTokens : 256;
  const hiddenSize = context.modelKind === "mla_moe" || context.modelKind === "engram_moe" ? 7168 : 4096;
  return Math.ceil((batchTokens * hiddenSize * 8 * 3) / (1024 * 1024)) + 10;
}

function buildShellOutputs(
  context: KnobSandboxContext,
  selections: KnobSelectionMap,
): {
  envExports: readonly string[];
  additionalConfigObj: Record<string, unknown>;
  cliArgs: readonly string[];
  shellCommand: string;
} {
  const envExports: string[] = [];
  const additionalConfigObj: Record<string, unknown> = {};
  const cliArgs: string[] = [];
  const strippedNames: string[] = [];
  const retiredEnvNames: string[] = [];

  if (context.tpSize > 1) {
    cliArgs.push(`--tensor-parallel-size ${context.tpSize}`);
  }
  if (context.dpSize > 1) {
    cliArgs.push(`--data-parallel-size ${context.dpSize}`);
  }
  const ppSize = context.ppSize ?? 1;
  if (ppSize > 1) {
    cliArgs.push(`--pipeline-parallel-size ${ppSize}`);
  }
  if (context.epEnabled) {
    cliArgs.push("--enable-expert-parallel");
  }
  if (context.sleepMode) {
    cliArgs.push("--enable-sleep-mode");
  }
  if (context.rforkEnabled) {
    cliArgs.push("--load-format rfork");
  }
  if (context.loraEnabled) {
    cliArgs.push("--enable-lora");
  }
  const parsedLayerwise = Object.hasOwn(selections, "cli_kv_transfer_use_layerwise")
    ? parseBoolLike(selections.cli_kv_transfer_use_layerwise)
    : undefined;
  const hasValidLayerwiseKnob = parsedLayerwise !== undefined;
  const selectedConnectorRaw =
    Object.hasOwn(selections, "cli_kv_transfer_connector") &&
    typeof selections.cli_kv_transfer_connector === "string"
      ? selections.cli_kv_transfer_connector
      : undefined;
  const validConnectors = new Set([
    "MooncakeConnectorV2",
    "MultiConnector(Mooncake+PreemptOffload)",
    "PreemptOffloadConnector",
    "MooncakeLayerwiseConnector",
    "AscendStoreConnector",
  ]);
  const activeConnector =
    selectedConnectorRaw !== undefined && validConnectors.has(selectedConnectorRaw)
      ? selectedConnectorRaw
      : undefined;
  if (context.pdRole !== "none" || hasValidLayerwiseKnob || activeConnector !== undefined) {
    const kvRole =
      context.pdRole === "prefill" ? "kv_producer" : context.pdRole === "decode" ? "kv_consumer" : "kv_both";
    const extraCfg = hasValidLayerwiseKnob ? { use_layerwise: parsedLayerwise } : undefined;
    let kvTransferObj: Record<string, unknown>;
    if (activeConnector === "MultiConnector(Mooncake+PreemptOffload)") {
      kvTransferObj = {
        kv_connector: "MultiConnector",
        kv_role: kvRole,
        kv_connector_extra_config: {
          connectors: [
            {
              kv_connector: "MooncakeConnectorV2",
              kv_role: kvRole,
              ...(extraCfg ? { kv_connector_extra_config: extraCfg } : {}),
            },
            { kv_connector: "PreemptOffloadConnector", kv_role: kvRole },
          ],
        },
      };
    } else {
      kvTransferObj = {
        kv_connector: activeConnector ?? "MooncakeConnectorV2",
        kv_role: kvRole,
        ...(extraCfg ? { kv_connector_extra_config: extraCfg } : {}),
      };
    }
    cliArgs.push(`--kv-transfer-config ${shellQuote(JSON.stringify(kvTransferObj))}`);
  }
  if (Object.hasOwn(selections, "cli_ec_recv_buffer_tokens")) {
    const ecRaw = selections.cli_ec_recv_buffer_tokens;
    const ecBig = parsePureBigIntLike(ecRaw);
    if (typeof ecRaw !== "boolean" && ecBig !== undefined && ecBig >= 2048n) {
      const ecBufVal =
        ecBig <= BigInt(Number.MAX_SAFE_INTEGER)
          ? Number(ecBig)
          : createRawJsonLiteral(ecBig.toString(), { isIntToken: true });
      const ecObj = {
        ec_connector: "ECMemcacheConnector",
        ec_connector_module_path: "vllm_ascend.distributed.ec_transfer.ec_memcache_connector",
        ec_role:
          context.pdRole === "prefill"
            ? "ec_producer"
            : context.pdRole === "decode"
              ? "ec_consumer"
              : "ec_both",
        ec_connector_extra_config: { recv_buffer_tokens: ecBufVal },
      };
      cliArgs.push(`--ec-transfer-config ${shellQuote(stringifyLosslessJson(ecObj))}`);
    }
  }
  if (context.soc === "310P") {
    cliArgs.push("--dtype float16");
  }
  if (context.graphMode === "NONE") {
    cliArgs.push("--enforce-eager");
  } else {
    cliArgs.push(`--compilation-config ${shellQuote(JSON.stringify({ cudagraph_mode: context.graphMode }))}`);
  }

  const engramValid =
    context.version === "main" &&
    isValidJsonKnobPayload({ id: "cfg_shared_engram" }, selections.cfg_shared_engram);
  const engramObj = engramValid ? parseJsonObject(selections.cfg_shared_engram) : undefined;
  const engramActive = engramValid && engramObj !== undefined;
  const engramBackend = typeof engramObj?.backend === "string" ? engramObj.backend : "";
  const engramNeedsTimeout = engramActive && (engramBackend === "a2" || engramBackend === "a5");

  for (const spec of ASCEND_KNOB_CATALOG) {
    if (!Object.hasOwn(selections, spec.id)) continue;
    const rawVal = selections[spec.id];
    if (rawVal === undefined) continue;
    if (isStrippedInCommandOutput(spec, context.version, rawVal, selections)) {
      strippedNames.push(spec.name);
      if (
        spec.entryKind === "env" &&
        (spec.statusByVersion[context.version] === "retired" ||
          spec.statusByVersion[context.version] === "absent" ||
          resolveKnobLifecycle(spec, context.version) === "retired-trap" ||
          (spec.id === "env_vllm_use_v2_model_runner" &&
            context.version === "main" &&
            parseBoolLike(rawVal) === false))
      ) {
        retiredEnvNames.push(spec.name);
      }
      continue;
    }

    if (spec.entryKind === "env") {
      envExports.push(`export ${spec.name}=${shellQuote(String(rawVal))}`);
    } else if (spec.entryKind === "additional_config") {
      const path = spec.jsonPath ?? spec.name;
      const parsed =
        spec.valueType === "json"
          ? parseJsonValue(rawVal)
          : spec.valueType === "int"
            ? (() => {
                const big = parseStrictBigIntLike(rawVal);
                if (big !== undefined) {
                  if (big >= BigInt(Number.MIN_SAFE_INTEGER) && big <= BigInt(Number.MAX_SAFE_INTEGER)) {
                    return Number(big);
                  }
                  return createRawJsonLiteral(big.toString(), { isIntToken: true });
                }
                return rawVal;
              })()
            : spec.valueType === "float"
              ? (parseNumberLike(rawVal) ?? rawVal)
              : spec.valueType === "bool"
                ? (parseBoolLike(rawVal) ?? rawVal)
                : rawVal;
      setNestedPath(additionalConfigObj, path, parsed);
    } else if (spec.entryKind === "cli_core" && spec.cliFlag) {
      if (
        spec.id === "cli_kv_transfer_use_layerwise" ||
        spec.id === "cli_kv_transfer_connector" ||
        spec.id === "cli_ec_recv_buffer_tokens"
      ) {
        continue;
      }
      if (spec.id === "cli_enable_eplb") {
        if (parseBoolLike(rawVal) === true) {
          cliArgs.push("--enable-eplb");
        }
        continue;
      }
      if (engramNeedsTimeout && spec.id === "cli_shutdown_timeout" && (parseCliIntLike(rawVal) ?? 0) <= 0) {
        continue;
      }
      const cliToken =
        typeof rawVal === "string" && (spec.valueType === "int" || spec.valueType === "float")
          ? normalizePythonUnicodeDigits(trimPythonWhitespace(rawVal))
          : typeof rawVal === "number" && spec.valueType === "int" && Number.isFinite(rawVal)
            ? BigInt(rawVal).toString()
            : String(rawVal);
      cliArgs.push(`${spec.cliFlag} ${shellQuote(cliToken)}`);
    }
  }

  if (engramActive) {
    cliArgs.push("--hf-overrides '{\"engram_cpu_offload\":true}'");
    if (engramNeedsTimeout && (parseCliIntLike(selections.cli_shutdown_timeout) ?? 0) <= 0) {
      cliArgs.push("--shutdown-timeout 120");
    }
  }

  if (Object.keys(additionalConfigObj).length > 0) {
    cliArgs.push(`--additional-config ${shellQuote(stringifyLosslessJson(additionalConfigObj))}`);
  }

  const isAscendQuantized = String(selections.cli_quantization ?? "") === "ascend";
  const sparseKvActive = parseBoolLike(selections.cfg_sparse_kv_offload_enabled) === true;
  const keepDeviceKv = parseBoolLike(selections.cfg_sparse_kv_offload_keep_device_kv_cache) === true;
  const kvDtypeExact =
    selections.cli_kv_cache_dtype === undefined ? "" : String(selections.cli_kv_cache_dtype);
  const oprojVal = parseStrictIntLike(selections.cfg_finegrained_tp_oproj) ?? 0;
  const mlpVal = parseStrictIntLike(selections.cfg_finegrained_tp_mlp) ?? 0;
  const hasPreemptConn =
    activeConnector === "PreemptOffloadConnector" ||
    activeConnector === "MultiConnector(Mooncake+PreemptOffload)";
  const sparseKvSupported =
    sparseKvActive &&
    context.modelKind === "mla_moe" &&
    context.soc === "A3" &&
    (context.ppSize ?? 1) <= 1 &&
    (keepDeviceKv || context.pdRole === "decode") &&
    (kvDtypeExact === "" || kvDtypeExact === "auto" || kvDtypeExact === "bfloat16") &&
    oprojVal <= 1 &&
    mlpVal <= 1 &&
    !hasPreemptConn;
  const modelLine = `vllm serve ${modelPlaceholderFor(context.modelKind, isAscendQuantized, sparseKvSupported)}`;
  const serveBlock = cliArgs.length > 0 ? `${modelLine} \\\n  ${cliArgs.join(" \\\n  ")}` : modelLine;

  const headerLines: string[] = [];
  if (strippedNames.length > 0) {
    headerLines.push(`# 已自动剥离当前版本不支持或已退役项: ${strippedNames.join(", ")}`);
  }
  if (retiredEnvNames.length > 0) {
    headerLines.push(`unset ${retiredEnvNames.join(" ")}`);
  }
  if (envExports.length > 0) {
    headerLines.push(...envExports);
  }
  const shellCommand = headerLines.length > 0 ? `${headerLines.join("\n")}\n\n${serveBlock}` : serveBlock;

  return { envExports, additionalConfigObj, cliArgs, shellCommand };
}

function recordSilentOverride(
  map: Map<string, { value: string | number | boolean; ruleId: string }>,
  knobId: string,
  value: string | number | boolean,
  ruleId: string,
): void {
  if (!map.has(knobId)) {
    map.set(knobId, { value, ruleId });
  }
}

interface EngineEvalState {
  readonly context: KnobSandboxContext;
  readonly selections: KnobSelectionMap;
  readonly findings: KnobConflictFinding[];
  readonly silentOverrides: Map<string, { value: string | number | boolean; ruleId: string }>;
  readonly npugraphEx: boolean;
  readonly staticKernel: boolean;
  readonly superKernel: boolean;
  readonly fusedLevel: number;
  readonly rlEnabled: boolean;
  readonly batchInvariant: boolean;
  readonly effectiveNz: number;
}

function mapRetiredIntMode(raw: string | number | boolean): number {
  const num = parseNumberLike(raw);
  if (num !== undefined && Number.isInteger(num) && num >= 0) {
    return num;
  }
  return parseBoolLike(raw) === false ? 0 : 1;
}

function evaluateRetiredAndVersionRules(state: EngineEvalState): void {
  const { context, selections, findings, silentOverrides, fusedLevel } = state;

  // 1. Retired & zero-read trap env vars
  const retiredEnvMigrations: readonly {
    id: string;
    targetId: string;
    mapValue: (raw: string | number | boolean) => string | number | boolean;
    label: string;
  }[] = [
    {
      id: "env_retired_enable_nz",
      targetId: "cfg_weight_nz_mode",
      mapValue: mapRetiredIntMode,
      label: "移除已退役 VLLM_ASCEND_ENABLE_NZ 并改用 weight_nz_mode",
    },
    {
      id: "env_retired_enable_mlapo",
      targetId: "cfg_enable_mlapo",
      mapValue: (raw) => parseBoolLike(raw) !== false,
      label: "移除已退役 VLLM_ASCEND_ENABLE_MLAPO 并改用 enable_mlapo",
    },
    {
      id: "env_retired_enable_fused_mc2",
      targetId: "cfg_enable_fused_mc2",
      mapValue: mapRetiredIntMode,
      label: "移除已退役 VLLM_ASCEND_ENABLE_FUSED_MC2 并改用 enable_fused_mc2",
    },
  ];

  for (const item of retiredEnvMigrations) {
    if (!Object.hasOwn(selections, item.id)) continue;
    const raw = selections[item.id];
    const spec = getKnobById(item.id);
    if (!spec || raw === undefined) continue;
    const classified = classifyEnvVar(spec.name, context.version);
    recordSilentOverride(silentOverrides, item.id, "无效(0处读取)", `rule-retired-env-${spec.name}`);
    const nextSelections: Record<string, string | number | boolean | null> = {
      [item.id]: null,
    };
    if (!Object.hasOwn(selections, item.targetId)) {
      nextSelections[item.targetId] = item.mapValue(raw);
    }
    findings.push({
      id: `rule-retired-env-${spec.name}`,
      severity: "silent-reset",
      title: `已退役环境变量 ${spec.name} 在 ${context.version} 下 0 处读取（静默无效）`,
      detail: `${classified.reason} 已自动从安全命令中剥离；${spec.replacementHintZh ?? ""}`,
      affectedKnobIds: [item.id, item.targetId],
      sources: classified.sources.length > 0 ? classified.sources : spec.sources,
      evidenceLevel: "C",
      fixAction: {
        label: item.label,
        nextSelections,
      },
    });
  }

  if (Object.hasOwn(selections, "env_trap_hccl_buffsize_ep")) {
    const raw = selections.env_trap_hccl_buffsize_ep;
    const spec = getKnobById("env_trap_hccl_buffsize_ep");
    const classified = classifyEnvVar("HCCL_BUFFSIZE_EP", context.version);
    if (spec && raw !== undefined) {
      recordSilentOverride(
        silentOverrides,
        "env_trap_hccl_buffsize_ep",
        "0处读取(未消费)",
        "rule-retired-env-HCCL_BUFFSIZE_EP",
      );
      const parsedVal = parseNumberLike(raw);
      const existingBuff = parseNumberLike(selections.env_hccl_buffsize);
      const requiredMiB = computeRequiredMc2BuffSizeMiB(context, selections, fusedLevel);
      const needsBuffRaise =
        (context.epEnabled || fusedLevel > 0) &&
        ((existingBuff !== undefined && existingBuff < Math.max(64, requiredMiB)) ||
          (existingBuff === undefined && requiredMiB > 200));
      const targetMiB = Math.max(256, requiredMiB, parsedVal && parsedVal >= 200 ? parsedVal : 0);
      const nextSelections: Record<string, string | number | boolean | null> = {
        env_trap_hccl_buffsize_ep: null,
        ...(needsBuffRaise ? { env_hccl_buffsize: targetMiB } : {}),
      };
      findings.push({
        id: "rule-retired-env-HCCL_BUFFSIZE_EP",
        severity: "silent-reset",
        title: "HCCL_BUFFSIZE_EP 在 vllm / vllm-ascend 源码 0 处读取（建议迁移检查 HCCL_BUFFSIZE）",
        detail: `${classified.reason} vllm 与 vllm-ascend Python/C++ 源码 0 处读取（闭源 CANN 内部行为待核）；DispatchFFNCombine 窗口校验仅读取 HCCL_BUFFSIZE，误写 HCCL_BUFFSIZE_EP 会导致窗口仍停在默认 200 MiB。`,
        affectedKnobIds: ["env_trap_hccl_buffsize_ep", "env_hccl_buffsize"],
        sources: spec.sources,
        evidenceLevel: "C",
        fixAction: {
          label: needsBuffRaise
            ? `移除 HCCL_BUFFSIZE_EP 并提升 HCCL_BUFFSIZE 至 ${targetMiB} MiB`
            : "移除未消费的 HCCL_BUFFSIZE_EP",
          nextSelections,
        },
      });
    }
  }

  if (context.version === "main" && Object.hasOwn(selections, "env_kvpool_range_debug")) {
    const raw = selections.env_kvpool_range_debug;
    const classified = classifyEnvVar("VLLM_ASCEND_KVPOOL_RANGE_DEBUG", "main");
    recordSilentOverride(
      silentOverrides,
      "env_kvpool_range_debug",
      "main 已移除",
      "rule-retired-env-VLLM_ASCEND_KVPOOL_RANGE_DEBUG",
    );
    const nextSelections: Record<string, string | number | boolean | null> = {
      env_kvpool_range_debug: null,
    };
    if (!Object.hasOwn(selections, "cfg_kv_pool_range_debug")) {
      nextSelections.cfg_kv_pool_range_debug = parseBoolLike(raw) !== false;
    }
    findings.push({
      id: "rule-retired-env-VLLM_ASCEND_KVPOOL_RANGE_DEBUG",
      severity: "silent-reset",
      title: "main 分支已移除 VLLM_ASCEND_KVPOOL_RANGE_DEBUG（已迁移至 kv_pool_range_debug）",
      detail: classified.reason,
      affectedKnobIds: ["env_kvpool_range_debug", "cfg_kv_pool_range_debug"],
      sources: classified.sources,
      evidenceLevel: "C",
      fixAction: {
        label: "迁移为 additional_config.kv_pool_range_debug",
        nextSelections,
      },
    });
  }

  if (context.version === "main" && Object.hasOwn(selections, "env_rope_ub_size_kb")) {
    recordSilentOverride(
      silentOverrides,
      "env_rope_ub_size_kb",
      "main 已移除(0处读取)",
      "rule-retired-env-VLLM_ASCEND_ROPE_UB_SIZE_KB",
    );
    findings.push({
      id: "rule-retired-env-VLLM_ASCEND_ROPE_UB_SIZE_KB",
      severity: "silent-reset",
      title: "main 分支已移除 VLLM_ASCEND_ROPE_UB_SIZE_KB（已改用纯自动 UB 探测）",
      detail:
        "v0.30.0 在 envs.py#L89 与 triton_utils.py#L95-L97 读取 VLLM_ASCEND_ROPE_UB_SIZE_KB；main (8d6180e2) 已移除该环境变量并改为全自动 UB 容量推导，继续导出无任何作用。",
      affectedKnobIds: ["env_rope_ub_size_kb"],
      sources: [
        `vllm-ascend@${VA030}:vllm_ascend/envs.py#L89`,
        `vllm-ascend@${VA030}:vllm_ascend/ops/triton/triton_utils.py#L95-L97`,
        `vllm-ascend@${VAMAIN}:vllm_ascend/envs.py#L94`,
        `vllm-ascend@${VAMAIN}:vllm_ascend/ops/triton/triton_utils.py#L83-L90`,
      ],
      evidenceLevel: "C",
      fixAction: {
        label: "移除 main 已退役的 VLLM_ASCEND_ROPE_UB_SIZE_KB",
        nextSelections: { env_rope_ub_size_kb: null },
      },
    });
  }

  if (Object.hasOwn(selections, "env_retired_enable_matmul_allreduce")) {
    const raw = selections.env_retired_enable_matmul_allreduce;
    const spec = getKnobById("env_retired_enable_matmul_allreduce");
    if (spec && raw !== undefined) {
      recordSilentOverride(
        silentOverrides,
        "env_retired_enable_matmul_allreduce",
        "无效(0处读取)",
        "rule-retired-env-VLLM_ASCEND_ENABLE_MATMUL_ALLREDUCE",
      );
      findings.push({
        id: "rule-retired-env-VLLM_ASCEND_ENABLE_MATMUL_ALLREDUCE",
        severity: "silent-reset",
        title: `已退役环境变量 VLLM_ASCEND_ENABLE_MATMUL_ALLREDUCE 在 ${context.version} 下 0 处读取（静默无效）`,
        detail:
          "该环境变量在 v0.26.0rc 起已从源码移除，v0.30.0 与 main 的 vllm_ascend/ 及 csrc/ 全仓均 0 处读取，导出不会开启 Matmul+AllReduce 融合。",
        affectedKnobIds: ["env_retired_enable_matmul_allreduce"],
        sources: spec.sources,
        evidenceLevel: "C",
        fixAction: {
          label: "移除已退役 VLLM_ASCEND_ENABLE_MATMUL_ALLREDUCE",
          nextSelections: { env_retired_enable_matmul_allreduce: null },
        },
      });
    }
  }

  if (Object.hasOwn(selections, "env_retired_balance_scheduling")) {
    const raw = selections.env_retired_balance_scheduling;
    const spec = getKnobById("env_retired_balance_scheduling");
    if (spec && raw !== undefined) {
      recordSilentOverride(
        silentOverrides,
        "env_retired_balance_scheduling",
        "无效(已删env兜底)",
        "rule-retired-env-VLLM_ASCEND_BALANCE_SCHEDULING",
      );
      const wantEnabled = parseBoolLike(raw) === true;
      const canMigrateEnable =
        wantEnabled &&
        context.pdRole === "none" &&
        !(context.version === "v0.30.0" && parseBoolLike(selections.cfg_profiling_chunk) === true);
      const nextSelections: Record<string, string | number | boolean | null> = {
        env_retired_balance_scheduling: null,
        ...(canMigrateEnable && !Object.hasOwn(selections, "cfg_balance_scheduling")
          ? { cfg_balance_scheduling: true }
          : {}),
      };
      findings.push({
        id: "rule-retired-env-VLLM_ASCEND_BALANCE_SCHEDULING",
        severity: "silent-reset",
        title: `已退役环境变量 VLLM_ASCEND_BALANCE_SCHEDULING 在 ${context.version} 静默无效（环境变量兜底已移除）`,
        detail:
          "ascend_config.py 注释 the legacy environment fallback has been removed：仅导出该环境变量时均衡调度仍保持 False；混部/kv_both 请迁入 additional_config.scheduler_config.enable_balance_scheduling，独立 P/D 节点请直接移除。",
        affectedKnobIds: ["env_retired_balance_scheduling", "cfg_balance_scheduling"],
        sources: spec.sources,
        evidenceLevel: "C",
        fixAction: {
          label: canMigrateEnable
            ? "移除旧 env 并迁入 scheduler_config.enable_balance_scheduling=true"
            : "移除已退役的 VLLM_ASCEND_BALANCE_SCHEDULING",
          nextSelections,
        },
      });
    }
  }

  if (
    context.version === "main" &&
    Object.hasOwn(selections, "env_vllm_use_v2_model_runner") &&
    parseBoolLike(selections.env_vllm_use_v2_model_runner) === false
  ) {
    findings.push({
      id: "rule-mrv1-removed-in-main",
      severity: "blocker",
      title: "main 分支已物理移除 Model Runner V1，设 VLLM_USE_V2_MODEL_RUNNER=0 启动必抛 ValueError",
      detail:
        "main@8d6180e2 mrv2_utils.py#L29-L86 检测到 VLLM_USE_V2_MODEL_RUNNER=0 时直接抛 ValueError: Model Runner V1 has been removed from vllm-ascend, so VLLM_USE_V2_MODEL_RUNNER=0 cannot be honored. Unset it to run Model Runner V2.",
      affectedKnobIds: ["env_vllm_use_v2_model_runner"],
      sources: [`vllm-ascend@${VAMAIN}:vllm_ascend/mrv2_utils.py#L29-L86`],
      evidenceLevel: "C",
      fixAction: {
        label: "移除 VLLM_USE_V2_MODEL_RUNNER=0（使用 MRv2）",
        nextSelections: { env_vllm_use_v2_model_runner: null },
      },
    });
  }

  // 2. Version mismatch & retired additional_config keys (extra="forbid")
  if (context.version === "v0.30.0") {
    const mainOnlyIds = [
      "cfg_shared_engram",
      "cfg_kv_pool_range_debug",
      "cfg_quantized_all_reduce_config",
      "cfg_runtime_config_hot_reload",
      "cfg_finegrained_tp_qkv_iproj",
      "cfg_gdn_internal_prefill_checkpoints",
    ].filter((id) => Object.hasOwn(selections, id));

    if (mainOnlyIds.length > 0) {
      const names = mainOnlyIds.map((id) => getKnobById(id)?.name ?? id);
      const nextSelections: Record<string, null> = Object.fromEntries(mainOnlyIds.map((id) => [id, null]));
      findings.push({
        id: "rule-version-mismatch-main-only",
        severity: "blocker",
        title: `v0.30.0 AscendConfig(extra="forbid") 拒收 main 专属键：${names.join("、")}`,
        detail: `以下字段仅存在于 vllm-ascend main (${VAMAIN})，在标准 v0.30.0 (${VA030}) 下直接触发 Pydantic ValidationError: Extra inputs are not permitted。`,
        affectedKnobIds: mainOnlyIds,
        sources: [
          `vllm-ascend@${VA030}:vllm_ascend/ascend_config.py#L562`,
          `vllm-ascend@${VAMAIN}:vllm_ascend/ascend_config.py#L656-L727`,
        ],
        evidenceLevel: "C",
        fixAction: {
          label: "移除仅 main 支持的 additional_config 键",
          nextSelections,
        },
      });
    }

    if (Object.hasOwn(selections, "env_ascend_buffer_pool")) {
      const classified = classifyEnvVar("ASCEND_BUFFER_POOL", "v0.30.0");
      findings.push({
        id: "rule-version-mismatch-ascend-buffer-pool",
        severity: "perf-trap",
        title: "v0.30.0 源码未读取 ASCEND_BUFFER_POOL（仅 main EC Store 路径读取）",
        detail: `${classified.reason} 若无需 main EC Transfer 行为建议移除以免混淆。`,
        affectedKnobIds: ["env_ascend_buffer_pool"],
        sources: [
          ...classified.sources,
          `vllm-ascend@${VAMAIN}:vllm_ascend/distributed/ec_transfer/ec_connector/mooncake/store_backend.py#L122-L125`,
        ],
        evidenceLevel: "C",
        fixAction: {
          label: "移除 v0.30.0 未证实读取的 ASCEND_BUFFER_POOL",
          nextSelections: { env_ascend_buffer_pool: null },
        },
      });
    }
  } else if (
    Object.hasOwn(selections, "env_ascend_buffer_pool") &&
    String(selections.env_ascend_buffer_pool ?? "").trim().length > 0 &&
    String(selections.env_ascend_enable_use_fabric_mem ?? "").trim() !== "1"
  ) {
    findings.push({
      id: "rule-ascend-buffer-pool-requires-fabric-mem",
      severity: "blocker",
      title: "main 分支启用 ASCEND_BUFFER_POOL 必须同时开启 ASCEND_ENABLE_USE_FABRIC_MEM=1",
      detail:
        "main@8d6180e2 Mooncake EC StoreBackend 在检测到设置 ASCEND_BUFFER_POOL 且未开启 FabricMem 时直接抛 ValueError，必须先设置 ASCEND_ENABLE_USE_FABRIC_MEM=1。",
      affectedKnobIds: ["env_ascend_buffer_pool", "env_ascend_enable_use_fabric_mem"],
      sources: [
        `vllm-ascend@${VAMAIN}:vllm_ascend/distributed/ec_transfer/ec_connector/mooncake/store_backend.py#L122-L125`,
      ],
      evidenceLevel: "C",
      fixAction: {
        label: "开启前置环境变量 ASCEND_ENABLE_USE_FABRIC_MEM = 1",
        nextSelections: { env_ascend_enable_use_fabric_mem: "1" },
      },
    });
  }

  if (Object.hasOwn(selections, "cfg_profiling_chunk")) {
    if (context.version === "main") {
      findings.push({
        id: "rule-version-mismatch-v030-only",
        severity: "blocker",
        title: "main 分支已移除 profiling_chunk_config（extra='forbid' 启动报错）",
        detail: `vllm-ascend main (${VAMAIN}) 已删除 SchedulerConfig.profiling_chunk_config，继续传入会在构造阶段抛 ValidationError。`,
        affectedKnobIds: ["cfg_profiling_chunk"],
        sources: [`vllm-ascend@${VAMAIN}:vllm_ascend/ascend_config.py#L2011-L2017`],
        evidenceLevel: "C",
        fixAction: {
          label: "移除 main 已删除的 profiling_chunk_config",
          nextSelections: { cfg_profiling_chunk: null },
        },
      });
    } else if (parseBoolLike(selections.cfg_profiling_chunk) === true) {
      if ((context.ppSize ?? 1) <= 1) {
        findings.push({
          id: "rule-v030-profiling-chunk-requires-pp",
          severity: "blocker",
          title: `v0.30.0 profiling_chunk_config.enabled=true 要求 PP > 1（当前 PP=${context.ppSize ?? 1}）`,
          detail:
            "v0.30.0 ascend_config.py#L724-L728 强校验开启 profiling_chunk_config 时 pipeline_parallel_size 必须大于 1，否则启动直接抛 ValueError。",
          affectedKnobIds: ["cfg_profiling_chunk"],
          sources: [`vllm-ascend@${VA030}:vllm_ascend/ascend_config.py#L724-L728`],
          evidenceLevel: "C",
          fixAction: {
            label: "将 PP 提升至 2 以满足 profiling_chunk 要求",
            nextContextPatch: { ppSize: 2 },
          },
        });
      }
      if (parseBoolLike(selections.cfg_balance_scheduling) === true) {
        findings.push({
          id: "rule-profiling-chunk-balance-sched-mutex",
          severity: "blocker",
          title: "v0.30.0 profiling_chunk_config 与 enable_balance_scheduling 互斥（启动 ValueError）",
          detail:
            "v0.30.0 ascend_config.py#L712-L736 禁止同时启用 profiling_chunk_config.enabled 与 scheduler_config.enable_balance_scheduling。",
          affectedKnobIds: ["cfg_profiling_chunk", "cfg_balance_scheduling"],
          sources: [`vllm-ascend@${VA030}:vllm_ascend/ascend_config.py#L712-L736`],
          evidenceLevel: "C",
          fixAction: {
            label: "关闭互斥的 enable_balance_scheduling",
            nextSelections: { cfg_balance_scheduling: false },
          },
        });
      }
    }
  }

  if (Object.hasOwn(selections, URL_SEL_PARSE_ERROR_KEY)) {
    findings.push({
      id: "rule-corrupted-url-selections",
      severity: "blocker",
      title: "分享链接 sel 参数损坏、截断或超出长度上限，已锁定复制以防静默丢项",
      detail:
        "URL 查询串中的 sel 参数无法解析为合法对象或超出 256 KiB 上限；雷达已阻断命令与 JSON 复制，避免将截断后的不完整配置当作零冲突放行。",
      affectedKnobIds: [],
      sources: [`vllm-ascend@${VA030}:vllm_ascend/ascend_config.py#L562`],
      evidenceLevel: "C",
      fixAction: {
        label: "清除损坏的分享链接参数",
        nextSelections: { [URL_SEL_PARSE_ERROR_KEY]: null },
      },
    });
  }

  for (const spec of ASCEND_KNOB_CATALOG) {
    if (Object.hasOwn(selections, spec.id)) {
      const sentinelRaw = selections[spec.id];
      if (typeof sentinelRaw === "string" && sentinelRaw.startsWith(URL_SEL_CORRUPT_SENTINEL_PREFIX)) {
        const isNonFinite = sentinelRaw === `${URL_SEL_CORRUPT_SENTINEL_PREFIX}non_finite`;
        findings.push({
          id: `rule-invalid-url-value-${spec.id}`,
          severity: "blocker",
          title: isNonFinite
            ? `${spec.name} 在分享链接中传入了超出 IEEE-754 双精度上限的溢出数值（已剥离并阻断）`
            : `${spec.name} 在分享链接中传入了非标量（数组/对象/null）或超长字符串（已剥离并阻断）`,
          detail: isNonFinite
            ? `${spec.name} 传入了如 1e309 等溢出为 Infinity 的非有限浮点数，JSON/配置校验阶段将直接拒绝（生成命令已自动剥离）。`
            : `${spec.name} 仅接受合法标量或指定 JSON 字符串，传入数组/对象或 >4096 字符异常值已在导出阶段自动剥离。`,
          affectedKnobIds: [spec.id],
          sources: spec.sources,
          evidenceLevel: "C",
          fixAction: {
            label: `移除异常字段 ${spec.name}`,
            nextSelections: { [spec.id]: null },
          },
        });
        continue;
      }
      if (
        spec.id === "env_ascend_rt_visible_devices" &&
        sentinelRaw !== undefined &&
        (typeof sentinelRaw !== "string" || !/^\d+(?:,\d+)*$/.test(sentinelRaw))
      ) {
        findings.push({
          id: "rule-invalid-visible-devices",
          severity: "blocker",
          title: `ASCEND_RT_VISIBLE_DEVICES=${JSON.stringify(sentinelRaw)} 格式非法（需逗号分隔非负卡号）`,
          detail:
            "ASCEND_RT_VISIBLE_DEVICES 仅接受逗号分隔的非负整数设备索引（如 0,1,2,3），非法字符串或空值会导致 CANN 设备可见性初始化失败（生成命令已自动剥离）。",
          affectedKnobIds: ["env_ascend_rt_visible_devices"],
          sources: spec.sources,
          evidenceLevel: "C",
          fixAction: {
            label: "恢复 ASCEND_RT_VISIBLE_DEVICES = 0,1,2,3",
            nextSelections: { env_ascend_rt_visible_devices: "0,1,2,3" },
          },
        });
        continue;
      }
    }
    if (spec.valueType === "enum" && Object.hasOwn(selections, spec.id)) {
      if (spec.statusByVersion[context.version] !== "supported") continue;
      const rawVal = selections[spec.id];
      if (rawVal === undefined || isAllowedEnumValue(spec, rawVal, context.version)) continue;
      const fallbackList = spec.recommendedValuesByVersion?.[context.version] ?? spec.recommendedValues;
      const fallbackVal = fallbackList[0]?.value;
      findings.push({
        id: `rule-invalid-enum-knob-${spec.id}`,
        severity: "blocker",
        title: `${spec.name}=${JSON.stringify(rawVal)} 为非法枚举值（参数/配置校验阻断）`,
        detail: `仅允许枚举值 ${fallbackList.map((rv) => JSON.stringify(rv.value)).join(" / ")}，传入未定义枚举值会在参数解析或配置校验阶段直接报错（生成命令已自动剥离该无效项）。`,
        affectedKnobIds: [spec.id],
        sources: spec.sources,
        evidenceLevel: "C",
        fixAction:
          fallbackVal !== undefined
            ? {
                label: `恢复 ${spec.name} 为合法值 ${String(fallbackVal)}`,
                nextSelections: { [spec.id]: fallbackVal },
              }
            : {
                label: `移除无效枚举项 ${spec.name}`,
                nextSelections: { [spec.id]: null },
              },
      });
      continue;
    }
    if (spec.valueType === "bool" && Object.hasOwn(selections, spec.id)) {
      const rawVal = selections[spec.id];
      if (rawVal === undefined || parseBoolLike(rawVal) !== undefined) continue;
      const isSupportedInVersion = spec.statusByVersion[context.version] === "supported";
      const fallbackVal = spec.recommendedValues.find((rv) => typeof rv.value === "boolean")?.value ?? false;
      findings.push({
        id: `rule-invalid-bool-knob-${spec.id}`,
        severity: "blocker",
        title: `${spec.name}=${JSON.stringify(rawVal)} 非法布尔值（Pydantic bool_parsing 阻断）`,
        detail: `${spec.name} 仅接受无首尾空格的 true/false 或 1/0 等合法布尔表示，传入 ${JSON.stringify(rawVal)} 会在 Pydantic 布尔校验阶段直接报错（生成命令已自动剥离该无效项）。`,
        affectedKnobIds: [spec.id],
        sources: spec.sources,
        evidenceLevel: "C",
        fixAction: isSupportedInVersion
          ? {
              label: `恢复 ${spec.name} 为合法布尔值 ${String(fallbackVal)}`,
              nextSelections: { [spec.id]: fallbackVal },
            }
          : {
              label: `移除无效且当前版本不支持的 ${spec.name}`,
              nextSelections: { [spec.id]: null },
            },
      });
      continue;
    }
    if (
      (spec.valueType === "int" || spec.valueType === "float") &&
      !DEDICATED_RANGE_INT_KNOB_IDS.has(spec.id) &&
      Object.hasOwn(selections, spec.id)
    ) {
      if (spec.statusByVersion[context.version] !== "supported") continue;
      const rawVal = selections[spec.id];
      if (rawVal === undefined || !isInvalidGeneralNumericValue(spec, rawVal)) continue;
      const fallbackList = spec.recommendedValuesByVersion?.[context.version] ?? spec.recommendedValues;
      const fallbackVal =
        fallbackList.find((rv) => !isInvalidGeneralNumericValue(spec, rv.value))?.value ?? 0;
      findings.push({
        id: `rule-invalid-number-knob-${spec.id}`,
        severity: "blocker",
        title: `${spec.name}=${JSON.stringify(rawVal)} 非法数值或负值越界（启动参数/配置校验阻断）`,
        detail: `${spec.name} 要求合法的${spec.valueType === "int" ? "非负整数" : "浮点比例值"}，传入负值、非整数或越界值会在 Pydantic / CLI 校验阶段直接报错（如 FinegrainedTPConfig._validate_sizes 明确拒绝 < 0；生成命令已自动剥离该无效项）。`,
        affectedKnobIds: [spec.id],
        sources: spec.sources,
        evidenceLevel: "C",
        fixAction: {
          label: `恢复 ${spec.name} 为合法值 ${String(fallbackVal)}`,
          nextSelections: { [spec.id]: fallbackVal },
        },
      });
      continue;
    }
    if (spec.valueType !== "json" || !Object.hasOwn(selections, spec.id)) continue;
    if (spec.statusByVersion[context.version] !== "supported") continue;
    const rawVal = selections[spec.id];
    if (rawVal === undefined || isValidJsonKnobPayload(spec, rawVal)) continue;
    const fallbackVal = spec.recommendedValues[0]?.value ?? "{}";
    findings.push({
      id: `rule-invalid-json-knob-${spec.id}`,
      severity: "blocker",
      title: `${spec.name} JSON 结构或内部字段校验失败（Pydantic 子配置阻断）`,
      detail: `additional_config.${spec.jsonPath ?? spec.name} 对应 Pydantic 子配置模型（extra='forbid'），传入非对象、未知键或越界子字段（如 endpoint 缺少合法 host:port、min_numel < 1、A3 混入 A2/A5 选项等）会在启动时直接抛 ValidationError / ValueError（生成命令已自动剥离该无效项）。`,
      affectedKnobIds: [spec.id],
      sources: spec.sources,
      evidenceLevel: "C",
      fixAction: {
        label: `恢复 ${spec.name} 为标准 JSON 对象示例`,
        nextSelections: { [spec.id]: fallbackVal },
      },
    });
  }

  const retiredCfgIds = ["cfg_retired_layer_sharding", "cfg_retired_weight_prefetch_config"].filter((id) =>
    Object.hasOwn(selections, id),
  );
  if (retiredCfgIds.length > 0) {
    const names = retiredCfgIds.map((id) => getKnobById(id)?.name ?? id);
    findings.push({
      id: "rule-retired-additional-config",
      severity: "blocker",
      title: `已移除旧键 ${names.join(" / ")} 触发 AscendConfig(extra="forbid") 阻断`,
      detail:
        "layer_sharding 与 weight_prefetch_config 在 v0.30.0 与 main 均已从 AscendConfig 删除，仅残留在历史教程中；传入会在启动时直接报 Extra inputs are not permitted。",
      affectedKnobIds: retiredCfgIds,
      sources: [
        `vllm-ascend@${VA030}:vllm_ascend/ascend_config.py#L562`,
        `vllm-ascend@${VAMAIN}:vllm_ascend/ascend_config.py#L652`,
      ],
      evidenceLevel: "C",
      fixAction: {
        label: `移除已废弃键 ${names.join(" / ")}`,
        nextSelections: Object.fromEntries(retiredCfgIds.map((id) => [id, null])),
      },
    });
  }
}

function hasExpandableSegmentsTrue(allocRaw: string): boolean {
  return /\bexpandable_segments\s*:\s*true\b/i.test(allocRaw);
}

function stripExpandableSegments(allocRaw: string): string {
  return allocRaw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !/\bexpandable_segments\s*:\s*true\b/i.test(part))
    .join(",");
}

function evaluateSleepAndMemoryRules(state: EngineEvalState): void {
  const { context, selections, findings, silentOverrides, effectiveNz, rlEnabled } = state;
  const allocRaw = String(selections.env_pytorch_npu_alloc_conf ?? "");
  const hasExpandable = hasExpandableSegmentsTrue(allocRaw);
  const strippedAlloc = hasExpandable ? stripExpandableSegments(allocRaw) : allocRaw;

  // 2b. RlConfig.apply() overrides weight_nz_mode=0 & strips expandable_segments before Sleep checks
  if (rlEnabled) {
    const rawNz = parseNumberLike(selections.cfg_weight_nz_mode);
    const overridesNz = rawNz !== undefined && rawNz !== 0;
    if (overridesNz || hasExpandable) {
      const affected: string[] = ["cfg_rl_enabled"];
      const nextSelections: Record<string, string | number | boolean | null> = {};
      if (overridesNz) {
        affected.push("cfg_weight_nz_mode");
        recordSilentOverride(silentOverrides, "cfg_weight_nz_mode", 0, "rule-rl-overrides-nz-and-alloc");
        nextSelections.cfg_weight_nz_mode = 0;
      }
      if (hasExpandable) {
        affected.push("env_pytorch_npu_alloc_conf");
        recordSilentOverride(
          silentOverrides,
          "env_pytorch_npu_alloc_conf",
          strippedAlloc.length > 0 ? strippedAlloc : "已剥离 expandable_segments",
          "rule-rl-overrides-nz-and-alloc",
        );
        nextSelections.env_pytorch_npu_alloc_conf = strippedAlloc.length > 0 ? strippedAlloc : null;
      }
      findings.push({
        id: "rule-rl-overrides-nz-and-alloc",
        severity: "silent-reset",
        title: "rl_config.enabled=true 在启动期强制将 weight_nz_mode 置 0 并剥离 expandable_segments",
        detail:
          "RlConfig.apply() 在平台睡眠校验之前强制重置 weight_nz_mode=0 并调用 _disable_expandable_segments() 移除 expandable_segments:True，从而免除 Sleep Mode 唤醒冲突。",
        affectedKnobIds: affected,
        sources: [`vllm-ascend@${VA030}:vllm_ascend/ascend_config.py#L362-L394`],
        evidenceLevel: "C",
        fixAction: {
          label: "显式对齐 RlConfig 覆写后的 weight_nz_mode=0 与分配器配置",
          nextSelections,
        },
      });
    }
  }

  evaluateRlExtraCleanupRule(state);

  if (!context.sleepMode) return;

  // 3. Sleep Mode + weight_nz_mode != 0
  if (effectiveNz !== 0) {
    findings.push({
      id: "rule-sleep-mode-weight-nz-blocker",
      severity: "blocker",
      title: `Sleep Mode 唤醒必挂：当前生效 weight_nz_mode=${effectiveNz}（非 0）`,
      detail: `NPUWorker.wake_up() 在 weight_nz_mode != 0 时直接抛 ValueError 拒绝唤醒（即便 BF16 模型在默认 mode=1 未实际转 NZ 也会触发）；Ascend 910B3 真机实测设 weight_nz_mode=0 后唤醒仅需 2.482s（较 95.83s 冷启动快 38.61×）。`,
      affectedKnobIds: ["cfg_weight_nz_mode"],
      sources: [
        `vllm-ascend@${VA030}:vllm_ascend/worker/worker.py#L279-L299`,
        `vllm-ascend@${VA030}:vllm_ascend/ascend_config.py#L615`,
        `infer-lab@${MEASURED_DOC_COMMIT}:docs/benchmarks/2026-11-23-ascend-910b3-measured-evidence.md#L50`,
      ],
      evidenceLevel: "M",
      fixAction: {
        label: "显式设置 weight_nz_mode = 0 关闭 FRACTAL_NZ",
        nextSelections: { cfg_weight_nz_mode: 0 },
      },
    });
  } else if (context.soc === "310P") {
    findings.push({
      id: "rule-sleep-mode-310p-force-nz-trap",
      severity: "perf-trap",
      title: "Atlas 300I DUO (310P) FORCE_NZ 与 Sleep Mode 存在布局冲突风险",
      detail:
        "虽然 weight_nz_mode=0 可通过 wake_up() 配置检查，但 310P 硬件档案强制启用 WeightLayoutPolicy.FORCE_NZ，睡眠还原稳定性未验证。",
      affectedKnobIds: ["cfg_weight_nz_mode"],
      sources: [
        `vllm-ascend@${VA030}:vllm_ascend/device/hardware_profile.py#L317`,
        `vllm-ascend@${VA030}:vllm_ascend/worker/worker.py#L279-L299`,
      ],
      evidenceLevel: "C",
      fixAction: {
        label: "在 310P 上关闭 Sleep Mode",
        nextContextPatch: { sleepMode: false },
      },
    });
  }

  // 4. Sleep Mode + RFork silent fallback
  if (context.rforkEnabled) {
    findings.push({
      id: "rule-sleep-mode-rfork-fallback",
      severity: "silent-reset",
      title: "Sleep Mode 与 RFork 同开触发静默回退（退回普通 safetensors 加载）",
      detail:
        "rfork/safety.py 的 mutable_weights_bypass_reason() 检测到 enable_sleep_mode=True 时直接跳过内存池注册，RForkLoader 自动回退至默认 auto 加载器，秒级共享拷贝加速失效。",
      affectedKnobIds: [],
      sources: [
        `vllm-ascend@${VA030}:vllm_ascend/model_loader/rfork/safety.py#L12-L16`,
        `vllm-ascend@${VA030}:vllm_ascend/model_loader/rfork/rfork_loader.py#L195-L199`,
      ],
      evidenceLevel: "C",
      fixAction: {
        label: "在 Sleep Mode 实例中关闭 RFork 加载",
        nextContextPatch: { rforkEnabled: false },
      },
    });
  }

  // 5. Sleep Mode + PYTORCH_NPU_ALLOC_CONF containing expandable_segments:True (suppressed when RL applies)
  if (!rlEnabled && hasExpandable) {
    findings.push({
      id: "rule-sleep-mode-expandable-segments-blocker",
      severity: "blocker",
      title: "Sleep Mode 与 PYTORCH_NPU_ALLOC_CONF=expandable_segments:True 分配器硬冲突",
      detail:
        "CaMemAllocator.__init__ 在初始化睡眠池时强断言禁止 expandable_segments:True；未剥离时直接触发 AssertionError 崩溃。",
      affectedKnobIds: ["env_pytorch_npu_alloc_conf"],
      sources: [
        `vllm-ascend@${VA030}:vllm_ascend/platform.py#L1445-L1481`,
        `vllm-ascend@${VA030}:vllm_ascend/device_allocator/camem.py#L153-L157`,
      ],
      evidenceLevel: "C",
      fixAction: {
        label: "从 PYTORCH_NPU_ALLOC_CONF 移除 expandable_segments:True",
        nextSelections: { env_pytorch_npu_alloc_conf: strippedAlloc.length > 0 ? strippedAlloc : null },
      },
    });
  }

  // 6. Sleep Mode + shared_engram blocker
  if (Object.hasOwn(selections, "cfg_shared_engram")) {
    findings.push({
      id: "rule-sleep-mode-shared-engram-blocker",
      severity: "blocker",
      title: "Sleep Mode 与 shared_engram 互斥（消费者实例不可同时开启）",
      detail:
        "shared_engram 共享宿主内存映射租约，与 --enable-sleep-mode 卸载恢复语义互斥（main ascend_config.py 显式抛 ValueError）。",
      affectedKnobIds: ["cfg_shared_engram"],
      sources: [`vllm-ascend@${VAMAIN}:vllm_ascend/ascend_config.py#L807-L808`],
      evidenceLevel: "C",
      fixAction: {
        label: "移除与 Sleep Mode 互斥的 shared_engram",
        nextSelections: { cfg_shared_engram: null },
      },
    });
  }
}

function evaluateRlExtraCleanupRule(state: EngineEvalState): void {
  const { selections, findings, silentOverrides, rlEnabled } = state;
  if (parseBoolLike(selections.cfg_rl_sleep_mode_extra_cleanup) !== true || rlEnabled) return;

  recordSilentOverride(
    silentOverrides,
    "cfg_rl_sleep_mode_extra_cleanup",
    false,
    "rule-rl-extra-cleanup-needs-rl-enabled",
  );
  const allocRaw = String(selections.env_pytorch_npu_alloc_conf ?? "");
  const hasExpandable = hasExpandableSegmentsTrue(allocRaw);
  const strippedAlloc = hasExpandable ? stripExpandableSegments(allocRaw) : allocRaw;
  const hasSharedEngram = Object.hasOwn(selections, "cfg_shared_engram");

  findings.push({
    id: "rule-rl-extra-cleanup-needs-rl-enabled",
    severity: "silent-reset",
    title: "rl_config.sleep_mode_extra_cleanup=true 未同步开启 rl_config.enabled=true（额外清理静默跳过）",
    detail:
      "worker.py 严格以 rl_config.enabled and rl_config.sleep_mode_extra_cleanup 为门槛；未开 rl_config.enabled 时仅执行常规 CaMemAllocator 睡眠，额外 HCCL/图资源清理不会生效。",
    affectedKnobIds: ["cfg_rl_sleep_mode_extra_cleanup", "cfg_rl_enabled", "cfg_weight_nz_mode"],
    sources: [
      `vllm-ascend@${VA030}:vllm_ascend/ascend_config.py#L370-L388`,
      `vllm-ascend@${VA030}:vllm_ascend/worker/worker.py#L259-L303`,
      `vllm-ascend@${VAMAIN}:vllm_ascend/worker/worker.py#L324-L332`,
    ],
    evidenceLevel: "C",
    fixAction: hasSharedEngram
      ? {
          label: "shared_engram 与 Sleep Mode 互斥，关闭 sleep_mode_extra_cleanup",
          nextSelections: { cfg_rl_sleep_mode_extra_cleanup: false },
        }
      : {
          label: "补齐 rl_config.enabled=true、--enable-sleep-mode 与 weight_nz_mode=0",
          nextContextPatch: { sleepMode: true },
          nextSelections: {
            cfg_rl_enabled: true,
            cfg_weight_nz_mode: 0,
            ...(hasExpandable
              ? { env_pytorch_npu_alloc_conf: strippedAlloc.length > 0 ? strippedAlloc : null }
              : {}),
          },
        },
  });
}

function evaluateGraphCompilationRules(state: EngineEvalState): void {
  const { context, selections, findings, silentOverrides, npugraphEx, staticKernel, superKernel } = state;
  const graphBreaksFull =
    context.graphMode === "PIECEWISE" ||
    context.graphMode === "NONE" ||
    context.graphMode === "FULL_AND_PIECEWISE";

  // 8a. Dependency chain checks (AssertionError before _setup_compile_backend on non-310P)
  if (context.soc !== "310P") {
    if (staticKernel && !npugraphEx) {
      findings.push({
        id: "rule-static-kernel-missing-npugraph",
        severity: "blocker",
        title: "enable_static_kernel=true 缺少前置 enable_npugraph_ex=true（启动 AssertionError）",
        detail:
          "AscendCompilationConfig 在 A2/A3/A5 上强检 npugraph_ex -> static_kernel 依赖链，关闭 npugraph_ex 同时开启 static_kernel 直接崩溃。",
        affectedKnobIds: ["cfg_enable_static_kernel", "cfg_enable_npugraph_ex"],
        sources: [
          `vllm-ascend@${VA030}:vllm_ascend/ascend_config.py#L165-L169`,
          `vllm-ascend@${VAMAIN}:vllm_ascend/ascend_config.py#L172-L176`,
        ],
        evidenceLevel: "C",
        fixAction: {
          label: "同步开启 enable_npugraph_ex = true",
          nextSelections: { cfg_enable_npugraph_ex: true },
        },
      });
    }

    if (superKernel && (!npugraphEx || !staticKernel)) {
      findings.push({
        id: "rule-super-kernel-missing-prereq",
        severity: "blocker",
        title: "enable_super_kernel=true 缺少前置 static_kernel / npugraph_ex（启动 AssertionError）",
        detail:
          "AscendCompilationConfig 校验 Super Kernel 必须建立在 enable_static_kernel=true 与 enable_npugraph_ex=true 之上，单独开启直接抛 AssertionError。",
        affectedKnobIds: ["cfg_enable_super_kernel", "cfg_enable_static_kernel", "cfg_enable_npugraph_ex"],
        sources: [
          `vllm-ascend@${VA030}:vllm_ascend/ascend_config.py#L165-L169`,
          `vllm-ascend@${VAMAIN}:vllm_ascend/ascend_config.py#L172-L176`,
        ],
        evidenceLevel: "C",
        fixAction: {
          label: "补齐前置依赖 enable_npugraph_ex=true 与 enable_static_kernel=true",
          nextSelections: { cfg_enable_npugraph_ex: true, cfg_enable_static_kernel: true },
        },
      });
    }
  }

  // 7 & 8b. 310P / PIECEWISE / NONE silent resets for static_kernel / super_kernel / npugraph_ex
  const explicitNpugraph = parseBoolLike(selections.cfg_enable_npugraph_ex) === true;
  if (context.soc === "310P" && (explicitNpugraph || staticKernel || superKernel)) {
    const affected: string[] = [];
    if (explicitNpugraph) {
      affected.push("cfg_enable_npugraph_ex");
      recordSilentOverride(silentOverrides, "cfg_enable_npugraph_ex", false, "rule-310p-graph-reset");
    }
    if (staticKernel) {
      affected.push("cfg_enable_static_kernel");
      recordSilentOverride(silentOverrides, "cfg_enable_static_kernel", false, "rule-310p-graph-reset");
    }
    if (superKernel) {
      affected.push("cfg_enable_super_kernel");
      recordSilentOverride(silentOverrides, "cfg_enable_super_kernel", false, "rule-310p-graph-reset");
    }
    findings.push({
      id: "rule-310p-graph-reset",
      severity: "silent-reset",
      title: "Ascend 310P 缺少 NPUGRAPH_EX 能力：静默清零 npugraph_ex / static_kernel / super_kernel",
      detail:
        "310P 硬件档案不含 NPUGRAPH_EX 能力位，AscendCompilationConfig 后置校验会告警并将三项开关全部重置为 False。",
      affectedKnobIds: affected,
      sources: [`vllm-ascend@${VA030}:vllm_ascend/ascend_config.py#L149-L164`],
      evidenceLevel: "C",
      fixAction: {
        label: "显式关闭 310P 不支持的 npugraph_ex / static_kernel / super_kernel",
        nextSelections: {
          ...(explicitNpugraph ? { cfg_enable_npugraph_ex: false } : {}),
          ...(staticKernel ? { cfg_enable_static_kernel: false } : {}),
          ...(superKernel ? { cfg_enable_super_kernel: false } : {}),
        },
      },
    });
  } else if (context.soc !== "310P" && graphBreaksFull && (staticKernel || superKernel || explicitNpugraph)) {
    const affected: string[] = [];
    if (explicitNpugraph) {
      affected.push("cfg_enable_npugraph_ex");
      recordSilentOverride(
        silentOverrides,
        "cfg_enable_npugraph_ex",
        false,
        "rule-static-kernel-graph-reset",
      );
    }
    if (staticKernel) {
      affected.push("cfg_enable_static_kernel");
      recordSilentOverride(
        silentOverrides,
        "cfg_enable_static_kernel",
        false,
        "rule-static-kernel-graph-reset",
      );
    }
    if (superKernel) {
      affected.push("cfg_enable_super_kernel");
      recordSilentOverride(
        silentOverrides,
        "cfg_enable_super_kernel",
        false,
        "rule-static-kernel-graph-reset",
      );
    }
    findings.push({
      id: "rule-static-kernel-graph-reset",
      severity: "silent-reset",
      title: `图模式 ${context.graphMode} 静默重置 npugraph_ex / static_kernel / super_kernel 为 False`,
      detail: `platform._setup_compile_backend 仅在 FULL 或 FULL_DECODE_ONLY 下保留整图编译后端；${context.graphMode} 下分段或 Eager 执行会静默清空 static_kernel 与 super_kernel。`,
      affectedKnobIds: affected,
      sources: [
        `vllm-ascend@${VA030}:vllm_ascend/platform.py#L1313-L1352`,
        `vllm@${V030}:vllm/config/compilation.py#L77-L91`,
      ],
      evidenceLevel: "C",
      fixAction: {
        label: "将图模式切为 FULL_DECODE_ONLY 以激活静态核与超级内核",
        nextContextPatch: { graphMode: "FULL_DECODE_ONLY" },
      },
    });
  } else if (context.soc === "A3" && staticKernel && !graphBreaksFull) {
    findings.push({
      id: "rule-static-kernel-a3-dual-die-warmup",
      severity: "perf-trap",
      title: "Atlas A3 开启 enable_static_kernel 需承担双裸片 LOCAL_WORLD_SIZE 静态编译与预热耗时",
      detail:
        "Atlas A3 单卡对应双 Die 逻辑进程（8 卡展开为 16 进程），compiler_interface.py 会按实际本地进程数设置 LOCAL_WORLD_SIZE 并为解码图档位触发静态编译与析构卸载脚本，冷启动耗时明显拉长。",
      affectedKnobIds: ["cfg_enable_static_kernel"],
      sources: [
        `vllm-ascend@${VA030}:vllm_ascend/compilation/compiler_interface.py#L83-L160`,
        `vllm-ascend@${VA030}:vllm_ascend/worker/worker.py#L198-L235`,
      ],
      evidenceLevel: "C",
      fixAction: {
        label: "若偏好快速冷启动可关闭 static_kernel",
        nextSelections: {
          cfg_enable_static_kernel: false,
          ...(Object.hasOwn(selections, "cfg_enable_super_kernel") ? { cfg_enable_super_kernel: false } : {}),
        },
      },
    });
  }

  // 11. multistream_engram_overlap vs PIECEWISE / FULL_AND_PIECEWISE
  const engramOverlap = parseBoolLike(selections.cfg_multistream_engram_overlap) === true;
  if (engramOverlap && (context.graphMode === "PIECEWISE" || context.graphMode === "FULL_AND_PIECEWISE")) {
    if (context.graphMode === "PIECEWISE") {
      recordSilentOverride(
        silentOverrides,
        "cfg_multistream_engram_overlap",
        false,
        "rule-engram-overlap-piecewise-reset",
      );
    }
    findings.push({
      id: "rule-engram-overlap-piecewise-reset",
      severity: "silent-reset",
      title: `multistream_engram_overlap=true 在 ${context.graphMode} 下回退主流串行`,
      detail:
        "prepare_engram_inputs 仅在单步 cg_mode 为 NONE 或 FULL（含 FULL_DECODE_ONLY）时启用辅助流重叠；PIECEWISE 分段边界破坏跨流事件链并静默退回串行。",
      affectedKnobIds: ["cfg_multistream_engram_overlap"],
      sources: [
        `vllm-ascend@${VA030}:vllm_ascend/ascend_config.py#L567-L573`,
        `vllm-ascend@${VA030}:vllm_ascend/models/deepseek_v41/model.py#L1433`,
        `vllm-ascend@${VAMAIN}:vllm_ascend/models/deepseek_v41/model.py#L1546`,
      ],
      evidenceLevel: "C",
      fixAction: {
        label: "切换为 FULL_DECODE_ONLY 以启用 Engram 辅助流重叠",
        nextContextPatch: { graphMode: "FULL_DECODE_ONLY" },
      },
    });
  }

  // xLite graph preconditions (PP > 1, turboquant_4bit_nc, full_mode without enabled)
  const xliteEnabled = parseBoolLike(selections.cfg_xlite_enabled) === true;
  const xliteFullMode = parseBoolLike(selections.cfg_xlite_full_mode) === true;
  const kvCacheDtypeNorm = String(selections.cli_kv_cache_dtype ?? "")
    .trim()
    .toLowerCase();
  if (xliteEnabled) {
    if ((context.ppSize ?? 1) > 1) {
      findings.push({
        id: "rule-xlite-pp-blocker",
        severity: "blocker",
        title: `xlite_graph_config.enabled=true 不支持流水线并行 PP=${context.ppSize}（启动 RuntimeError）`,
        detail:
          "ascend_config.py 校验开启 xlite_graph_config 时 pipeline_parallel_size 必须为 1，否则直接抛 RuntimeError: xlite graph is not compatible with pipeline parallelism. Please set pipeline_parallel_size to 1.",
        affectedKnobIds: ["cfg_xlite_enabled"],
        sources: [
          `vllm-ascend@${VA030}:vllm_ascend/ascend_config.py#L1464-L1468`,
          `vllm-ascend@${VAMAIN}:vllm_ascend/ascend_config.py#L1596-L1600`,
        ],
        evidenceLevel: "C",
        fixAction: {
          label: "关闭 xlite_graph_config.enabled = false",
          nextSelections: { cfg_xlite_enabled: false },
        },
      });
    }
    if (kvCacheDtypeNorm === "turboquant_4bit_nc") {
      findings.push({
        id: "rule-xlite-turboquant-mutex",
        severity: "blocker",
        title:
          "xlite_graph_config.enabled=true 与 --kv-cache-dtype turboquant_4bit_nc 互斥（启动 ValueError）",
        detail:
          "turboquant/config.py#L36-L42 校验 packed SFA 路径禁止开启 xlite_graph_config.enabled=true，启动直接抛 ValueError: turboquant_4bit_nc does not support xLite graph mode。",
        affectedKnobIds: ["cfg_xlite_enabled", "cli_kv_cache_dtype"],
        sources: [
          `vllm-ascend@${VA030}:vllm_ascend/quantization/methods/kv_cache/turboquant/config.py#L36-L42`,
          `vllm-ascend@${VAMAIN}:vllm_ascend/quantization/methods/kv_cache/turboquant/config.py#L36-L42`,
        ],
        evidenceLevel: "C",
        fixAction: {
          label: "关闭 xlite_graph_config.enabled = false",
          nextSelections: { cfg_xlite_enabled: false },
        },
      });
    }
  } else if (xliteFullMode) {
    recordSilentOverride(silentOverrides, "cfg_xlite_full_mode", false, "rule-xlite-full-mode-needs-enabled");
    const canEnableXlite = (context.ppSize ?? 1) <= 1 && kvCacheDtypeNorm !== "turboquant_4bit_nc";
    findings.push({
      id: "rule-xlite-full-mode-needs-enabled",
      severity: "silent-reset",
      title: "xlite_graph_config.full_mode=true 未开启 xlite_graph_config.enabled=true（静默不生效）",
      detail: "xlite_graph_config.enabled 默认 false，未启用 xLite 图运行时不会消费 full_mode 预分配策略。",
      affectedKnobIds: ["cfg_xlite_full_mode", "cfg_xlite_enabled"],
      sources: [
        `vllm-ascend@${VA030}:vllm_ascend/ascend_config.py#L1450-L1455`,
        `vllm-ascend@${VAMAIN}:vllm_ascend/ascend_config.py#L1582-L1587`,
      ],
      evidenceLevel: "C",
      fixAction: canEnableXlite
        ? {
            label: "同步开启 xlite_graph_config.enabled = true",
            nextSelections: { cfg_xlite_enabled: true },
          }
        : {
            label: "当前拓扑/KV 精度不支持 xLite，关闭 full_mode",
            nextSelections: { cfg_xlite_full_mode: false },
          },
    });
  }
}

function evaluateFusedMc2AndCommRules(state: EngineEvalState): void {
  const { context, selections, findings, silentOverrides, fusedLevel } = state;
  const epWorldSize = context.tpSize * context.dpSize;
  const isMoeModel = context.modelKind !== "dense";

  // 9a. enable_fused_mc2=3 only valid on main + A5
  if (fusedLevel === 3 && (context.version === "v0.30.0" || context.soc !== "A5")) {
    findings.push({
      id: "rule-fused-mc2-level3-blocker",
      severity: "blocker",
      title: "enable_fused_mc2=3（MegaMoe+共享专家融合）仅支持 main 分支 Ascend A5",
      detail:
        context.version === "v0.30.0"
          ? "v0.30.0 尚未引入 MegaMoe 共享专家融合级别 3，校验将直接拒绝。"
          : `main 分支显式拒绝在 ${context.soc} 上设置 enable_fused_mc2=3（仅 A5 支持）。`,
      affectedKnobIds: ["cfg_enable_fused_mc2"],
      sources: [`vllm-ascend@${VAMAIN}:vllm_ascend/ascend_config.py#L1117-L1127`],
      evidenceLevel: "C",
      fixAction: {
        label: context.soc === "A3" ? "降级为 enable_fused_mc2 = 2" : "关闭 enable_fused_mc2 = 0",
        nextSelections: { cfg_enable_fused_mc2: context.soc === "A3" ? 2 : 0 },
      },
    });
  } else if (fusedLevel > 0) {
    const moeResult = selectMoeCommMethod(
      {
        hardwareFamily: context.soc,
        isMoe: isMoeModel,
        enableExpertParallel: context.epEnabled,
        isLoraEnabled: context.loraEnabled,
        tpSize: context.tpSize,
        dpSize: context.dpSize,
        pcpSize: 1,
        enableFusedMc2: (fusedLevel === 1 || fusedLevel === 2 || fusedLevel === 3 ? fusedLevel : 1) as
          | 1
          | 2
          | 3,
      },
      context.version,
    );
    const effectiveMethod: MoeCommMethod | null = moeResult.method;
    const unsupportedHardware = context.soc === "310P" || context.soc === "A2";
    const epTooLargeForA3Level1 = context.soc === "A3" && fusedLevel === 1 && epWorldSize > 32;
    const epTooLargeForA3Level2 = context.soc === "A3" && fusedLevel === 2 && epWorldSize > 64;

    if (
      !isMoeModel ||
      !context.epEnabled ||
      epWorldSize <= 1 ||
      context.loraEnabled ||
      unsupportedHardware ||
      epTooLargeForA3Level1 ||
      epTooLargeForA3Level2 ||
      effectiveMethod !== "FUSED_MC2"
    ) {
      const reasons: string[] = [];
      if (!isMoeModel) reasons.push("当前模型为 Dense（非 MoE）");
      if (!context.epEnabled || epWorldSize <= 1) reasons.push("未开启 EP（或 TP×DP=1）");
      if (context.loraEnabled) reasons.push("开启 LoRA 时强制回退 ALLTOALL");
      if (unsupportedHardware) reasons.push(`${context.soc} 硬件档案不支持 FUSED_MC2`);
      if (epTooLargeForA3Level1) {
        reasons.push(`A3 下 enable_fused_mc2=1 要求 ep_world_size=${epWorldSize} <= 32`);
      }
      if (epTooLargeForA3Level2) {
        reasons.push(`A3 下 MegaMoe 要求 ep_world_size=${epWorldSize} <= 64`);
      }
      const isLoraBypass = context.loraEnabled && context.epEnabled && isMoeModel && epWorldSize > 1;
      recordSilentOverride(
        silentOverrides,
        "cfg_enable_fused_mc2",
        isLoraBypass ? "旁路 → ALLTOALL" : 0,
        "rule-fused-mc2-silent-reset",
      );
      const canUseLevel2 =
        isMoeModel &&
        context.epEnabled &&
        !context.loraEnabled &&
        context.soc === "A3" &&
        fusedLevel === 1 &&
        epWorldSize > 32 &&
        epWorldSize <= 64;
      findings.push({
        id: "rule-fused-mc2-silent-reset",
        severity: "silent-reset",
        title: `enable_fused_mc2=${fusedLevel} 被静默旁路/回退（实际通信方式：${effectiveMethod ?? "无"}）`,
        detail: `${reasons.join("；")}。${moeResult.reason}`,
        affectedKnobIds: ["cfg_enable_fused_mc2"],
        sources: [
          ...moeResult.sources,
          `vllm-ascend@${VA030}:vllm_ascend/ascend_forward_context.py#L87-L97`,
          `vllm-ascend@${VA030}:vllm_ascend/ascend_forward_context.py#L396-L404`,
        ],
        evidenceLevel: "C",
        fixAction: {
          label: canUseLevel2
            ? "改用 enable_fused_mc2=2（MegaMoe 支持 EP<=64）"
            : "关闭无效的 enable_fused_mc2=0",
          nextSelections: { cfg_enable_fused_mc2: canUseLevel2 ? 2 : 0 },
        },
      });
    }
  }

  // 9b. enable_fused_mc2 vs multistream_overlap_shared_expert
  const overlapShared = parseBoolLike(selections.cfg_multistream_overlap_shared_expert) === true;
  const fusedClearsOverlap =
    fusedLevel === 1 || fusedLevel === 2 || (context.version === "main" && fusedLevel > 0);
  if (overlapShared && fusedClearsOverlap) {
    recordSilentOverride(
      silentOverrides,
      "cfg_multistream_overlap_shared_expert",
      false,
      "rule-fused-mc2-clears-shared-expert-overlap",
    );
    findings.push({
      id: "rule-fused-mc2-clears-shared-expert-overlap",
      severity: "silent-reset",
      title: "enable_fused_mc2 静默关闭 multistream_overlap_shared_expert",
      detail:
        "AscendConfig 在开启 Fused MC2 时打印告警并将 multistream_overlap_shared_expert 强制重置为 False。",
      affectedKnobIds: ["cfg_enable_fused_mc2", "cfg_multistream_overlap_shared_expert"],
      sources: [
        `vllm-ascend@${VA030}:vllm_ascend/ascend_config.py#L850-L854`,
        `vllm-ascend@${VAMAIN}:vllm_ascend/ascend_config.py#L919-L923`,
      ],
      evidenceLevel: "C",
      fixAction: {
        label: "关闭互斥的 multistream_overlap_shared_expert",
        nextSelections: { cfg_multistream_overlap_shared_expert: false },
      },
    });
  }

  // 9c. mix_placement vs effective shared_expert_dp / effective multistream_overlap_shared_expert
  const effectiveSharedExpertDp =
    parseBoolLike(selections.cfg_enable_shared_expert_dp) === true &&
    context.epEnabled &&
    context.tpSize > 1 &&
    isMoeModel;
  const effectiveMultistreamOverlap = overlapShared && !fusedClearsOverlap;
  if (
    parseBoolLike(selections.cfg_mix_placement) === true &&
    (effectiveSharedExpertDp || effectiveMultistreamOverlap)
  ) {
    findings.push({
      id: "rule-mix-placement-mutex",
      severity: "blocker",
      title:
        "mix_placement=true 与生效态 shared_expert_dp / multistream_overlap_shared_expert 互斥（启动 ValueError）",
      detail:
        "_check_mix_placement() 在生效态 enable_shared_expert_dp 或 multistream_overlap_shared_expert 为 True 时直接抛 ValueError: Mix placement is not supported with shared expert DP or multistream overlap.",
      affectedKnobIds: [
        "cfg_mix_placement",
        ...(effectiveSharedExpertDp ? ["cfg_enable_shared_expert_dp"] : []),
        ...(effectiveMultistreamOverlap ? ["cfg_multistream_overlap_shared_expert"] : []),
      ],
      sources: [
        `vllm-ascend@${VA030}:vllm_ascend/ascend_config.py#L1045-L1048`,
        `vllm-ascend@${VAMAIN}:vllm_ascend/ascend_config.py#L1163-L1166`,
      ],
      evidenceLevel: "C",
      fixAction: {
        label: "关闭 mix_placement = false",
        nextSelections: { cfg_mix_placement: false },
      },
    });
  }

  // 9d. fusion_ops_gmmswigluquant=false on MoE + --quantization ascend
  const isAscendQuantized = String(selections.cli_quantization ?? "").trim() === "ascend";
  if (
    Object.hasOwn(selections, "cfg_fusion_ops_gmmswigluquant") &&
    parseBoolLike(selections.cfg_fusion_ops_gmmswigluquant) === false &&
    isMoeModel &&
    isAscendQuantized
  ) {
    findings.push({
      id: "rule-gmmswigluquant-disabled-int32-trap",
      severity: "perf-trap",
      title: "W8A8 动态 MoE 关闭 fusion_ops_gmmswigluquant 时 MC2 分支产生 INT32 中间激活（该张量内存翻倍）",
      detail:
        "w8a8_dynamic.py 在未命中融合算子且走 MC2 路径时执行 npu_grouped_matmul(..., output_dtype=torch.int32) 再做反量化/SwiGLU/量化；源码注明该中间激活张量显存翻倍（非整卡翻倍）。",
      affectedKnobIds: ["cfg_fusion_ops_gmmswigluquant", "cli_quantization"],
      sources: [
        `vllm-ascend@${VA030}:vllm_ascend/quantization/methods/w8a8/w8a8_dynamic.py#L413-L453`,
        `vllm-ascend@${VAMAIN}:vllm_ascend/quantization/methods/w8a8/w8a8_dynamic.py#L421-L461`,
      ],
      evidenceLevel: "C",
      fixAction: {
        label: "开启 fusion_ops_gmmswigluquant = true",
        nextSelections: { cfg_fusion_ops_gmmswigluquant: true },
      },
    });
  }

  // 13. HCCL_BUFFSIZE uint16_t overflow (> 65535 -> 200 MiB) + plain DispatchFFNCombine window check
  const explicitBuff = parseEnvIntLike(selections.env_hccl_buffsize);
  const isBuffOverflow = explicitBuff !== undefined && explicitBuff > 65535;
  const effectiveBuff = explicitBuff === undefined ? 200 : isBuffOverflow ? 200 : explicitBuff;
  const requiredWindowMiB = computeRequiredMc2BuffSizeMiB(context, selections, fusedLevel);
  const megaMoeRequested =
    context.version === "main" ? fusedLevel === 2 || fusedLevel === 3 : fusedLevel === 2;
  const megaMoeActive =
    megaMoeRequested &&
    isMoeModel &&
    context.epEnabled &&
    epWorldSize > 1 &&
    epWorldSize <= 64 &&
    !context.loraEnabled &&
    (context.soc === "A3" || context.soc === "A5");
  const plainDispatchFfnCombineActive =
    context.soc === "A3" &&
    fusedLevel === 1 &&
    isMoeModel &&
    context.epEnabled &&
    epWorldSize > 1 &&
    epWorldSize <= 32 &&
    !context.loraEnabled;

  const cannotFitUint16 = requiredWindowMiB > 65535;
  if (isBuffOverflow) {
    recordSilentOverride(
      silentOverrides,
      "env_hccl_buffsize",
      200,
      "rule-hccl-buffsize-uint16-overflow-reset",
    );
    const overflowFixesMc2 = plainDispatchFfnCombineActive && cannotFitUint16;
    const safeCapMiB = plainDispatchFfnCombineActive
      ? Math.min(65535, Math.max(512, Math.ceil(requiredWindowMiB / 64) * 64))
      : 1024;
    findings.push({
      id: "rule-hccl-buffsize-uint16-overflow-reset",
      severity: "silent-reset",
      title: `HCCL_BUFFSIZE=${explicitBuff} 超出 uint16_t 上限 (65535)，DispatchFFNCombine 静默退回 200 MiB`,
      detail:
        "dispatch_ffn_combine_tiling.cpp#L63-L84 以 uint16_t defaultWindowSize=200 读取 HCCL_BUFFSIZE；超过 65535 时打印 OP_LOGW(... out of range, using default.) 并按 200 MiB 检查窗口（大批易爆 EI0002）。",
      affectedKnobIds: ["env_hccl_buffsize", ...(overflowFixesMc2 ? ["cfg_enable_fused_mc2"] : [])],
      sources: [
        `vllm-ascend@${VA030}:csrc/mc2/dispatch_ffn_combine/op_host/dispatch_ffn_combine_tiling.cpp#L63-L84`,
        `vllm-ascend@${VAMAIN}:csrc/mc2/dispatch_ffn_combine/op_host/dispatch_ffn_combine_tiling.cpp#L63-L84`,
      ],
      evidenceLevel: "C",
      fixAction: overflowFixesMc2
        ? {
            label: `关闭普通 Fused MC2 = 0 并回调 HCCL_BUFFSIZE = 1024 MiB（所需窗口 ${requiredWindowMiB} MiB 超 uint16 上限）`,
            nextSelections: { env_hccl_buffsize: 1024, cfg_enable_fused_mc2: 0 },
          }
        : {
            label: `将 HCCL_BUFFSIZE 收敛至 uint16_t 合法范围内 (${safeCapMiB} MiB)`,
            nextSelections: { env_hccl_buffsize: safeCapMiB },
          },
    });
  }

  const epCommActive = isMoeModel && context.epEnabled && epWorldSize > 1;
  const tooSmallMc2Window = plainDispatchFfnCombineActive && effectiveBuff < requiredWindowMiB;
  const tooSmallGeneralEp =
    !plainDispatchFfnCombineActive &&
    !megaMoeActive &&
    epCommActive &&
    explicitBuff !== undefined &&
    explicitBuff < 34;

  if (tooSmallMc2Window || tooSmallGeneralEp) {
    const isBlocker = plainDispatchFfnCombineActive;
    const disableMc2ForOverflow = tooSmallMc2Window && cannotFitUint16;
    const hiddenSize = context.modelKind === "mla_moe" || context.modelKind === "engram_moe" ? 7168 : 4096;
    const targetBuffMiB = Math.min(65535, Math.max(256, Math.ceil(requiredWindowMiB / 64) * 64));
    findings.push({
      id: "rule-hccl-buffsize-too-small",
      severity: isBlocker ? "blocker" : "perf-trap",
      title: tooSmallMc2Window
        ? `HCCL_BUFFSIZE 有效窗口=${effectiveBuff} MiB 不足：普通 dispatch_ffn_combine 需 ≥ ${requiredWindowMiB} MiB`
        : `HCCL_BUFFSIZE=${effectiveBuff} MiB 过小，存在 EP 通信窗口溢出风险`,
      detail: `普通 DispatchFFNCombine Host Tiling 按 ceil(m * ${hiddenSize} * 8 * 3 / 1 MiB) + 10 MiB 校验 HCCL_BUFFSIZE 窗口（当前模型估算需 ≥ ${requiredWindowMiB} MiB，无额外 <64 MiB 硬底线；默认或 uint16 溢出回退均为 200 MiB）；CANN MegaMoe 改用独立 PyTorch 对称缓冲（不读 HCCL_BUFFSIZE）。`,
      affectedKnobIds: [
        "env_hccl_buffsize",
        ...(fusedLevel > 0 ? ["cfg_enable_fused_mc2"] : []),
        ...(Object.hasOwn(selections, "cfg_enable_prefill_mc2") ? ["cfg_enable_prefill_mc2"] : []),
        ...(Object.hasOwn(selections, "cli_max_num_batched_tokens") ? ["cli_max_num_batched_tokens"] : []),
      ],
      sources: [
        `vllm-ascend@${VA030}:csrc/mc2/dispatch_ffn_combine/op_host/dispatch_ffn_combine_tiling.cpp#L63-L84`,
        `vllm-ascend@${VA030}:csrc/mc2/dispatch_ffn_combine/op_host/dispatch_ffn_combine_tiling.cpp#L288-L293`,
      ],
      evidenceLevel: "C",
      fixAction: disableMc2ForOverflow
        ? {
            label: `关闭普通 Fused MC2 = 0（所需窗口 ${requiredWindowMiB} MiB 超出 uint16 上限 65535）`,
            nextSelections: {
              cfg_enable_fused_mc2: 0,
              ...(isBuffOverflow ? { env_hccl_buffsize: 1024 } : {}),
            },
          }
        : {
            label: `将 HCCL_BUFFSIZE 提升至 ${targetBuffMiB} MiB`,
            nextSelections: { env_hccl_buffsize: targetBuffMiB },
          },
    });
  }
}

function evaluateRuntimeAndEnvTraps(state: EngineEvalState): void {
  const { context, selections, findings, silentOverrides, batchInvariant, fusedLevel } = state;

  // 10. VLLM_LOGGING_LEVEL === "DEBUG"
  const logLevel = String(selections.env_vllm_logging_level ?? "")
    .trim()
    .toUpperCase();
  if (logLevel === "DEBUG") {
    findings.push({
      id: "rule-logging-debug-perf-trap",
      severity: "perf-trap",
      title: "VLLM_LOGGING_LEVEL=DEBUG 在热路径引入分配器查询与 ACLGraph 指针校验（TTFT +39.48%）",
      detail:
        "worker.py:762-772 每步 execute_model 查询 torch.npu.memory_reserved()/allocated() 并刷写千行日志，acl_graph.py:275-282 逐张量校验 data_ptr()；910B3 TP=8 c=1 实测 TTFT 从 139.07 ms 恶化至 193.98 ms（+39.48%）。",
      affectedKnobIds: ["env_vllm_logging_level"],
      sources: [
        `vllm@${V030}:vllm/envs.py#L834`,
        `vllm-ascend@${VA030}:vllm_ascend/worker/worker.py#L762-L772`,
        `vllm-ascend@${VA030}:vllm_ascend/compilation/acl_graph.py#L275-L282`,
        `infer-lab@${MEASURED_DOC_COMMIT}:docs/benchmarks/2026-11-23-ascend-910b3-measured-evidence.md#L49`,
      ],
      evidenceLevel: "M",
      fixAction: {
        label: "将 VLLM_LOGGING_LEVEL 恢复为 INFO",
        nextSelections: { env_vllm_logging_level: "INFO" },
      },
    });
  }

  // 12. VLLM_BATCH_INVARIANT === "1"
  if (batchInvariant) {
    const rawNz = parseNumberLike(selections.cfg_weight_nz_mode);
    const hcclDet = selections.env_hccl_deterministic;
    const overlapShared = parseBoolLike(selections.cfg_multistream_overlap_shared_expert) === true;
    const engramOverlap = parseBoolLike(selections.cfg_multistream_engram_overlap) === true;

    if ((rawNz !== undefined && rawNz !== 0) || (hcclDet !== undefined && hcclDet !== "strict")) {
      if (rawNz !== undefined && rawNz !== 0) {
        recordSilentOverride(
          silentOverrides,
          "cfg_weight_nz_mode",
          0,
          "rule-batch-invariant-forced-override",
        );
      }
      if (hcclDet !== undefined && hcclDet !== "strict") {
        recordSilentOverride(
          silentOverrides,
          "env_hccl_deterministic",
          "strict",
          "rule-batch-invariant-forced-override",
        );
      }
      findings.push({
        id: "rule-batch-invariant-forced-override",
        severity: "silent-reset",
        title: "VLLM_BATCH_INVARIANT=1 强制覆写 weight_nz_mode=0 与 HCCL_DETERMINISTIC=strict",
        detail:
          "batch_invariant.py#L102-L115 运行期强制重置 weight_nz_mode=0 并注入 HCCL_DETERMINISTIC='strict' 与 LCCL_DETERMINISTIC='1'，手设的非确定值会被覆盖。",
        affectedKnobIds: ["env_vllm_batch_invariant", "cfg_weight_nz_mode", "env_hccl_deterministic"],
        sources: [`vllm-ascend@${VA030}:vllm_ascend/batch_invariant.py#L102-L115`],
        evidenceLevel: "C",
        fixAction: {
          label: "显式对齐 weight_nz_mode=0 与 HCCL_DETERMINISTIC=strict",
          nextSelections: {
            ...(rawNz !== undefined && rawNz !== 0 ? { cfg_weight_nz_mode: 0 } : {}),
            ...(hcclDet !== undefined && hcclDet !== "strict" ? { env_hccl_deterministic: "strict" } : {}),
          },
        },
      });
    }

    if (overlapShared || engramOverlap || fusedLevel > 0 || context.graphMode !== "NONE") {
      findings.push({
        id: "rule-batch-invariant-throughput-tradeoff",
        severity: "perf-trap",
        title: "确定性批不变模式（VLLM_BATCH_INVARIANT=1）会锁定 HCCL/算子并发并牺牲吞吐",
        detail:
          "开启后启用 torch.use_deterministic_algorithms(True) 与 HCCL_DETERMINISTIC=strict，在 main A5 下还会关闭自定义算子并限制异步并发重叠收益；仅建议精度对标排障期间启用。",
        affectedKnobIds: ["env_vllm_batch_invariant"],
        sources: [
          `vllm@${V030}:vllm/envs.py#L619`,
          `vllm-ascend@${VA030}:vllm_ascend/batch_invariant.py#L102-L115`,
          `vllm-ascend@${VAMAIN}:vllm_ascend/utils.py#L583-L590`,
        ],
        evidenceLevel: "C",
        fixAction: {
          label: "非精度排障时关闭 VLLM_BATCH_INVARIANT",
          nextSelections: { env_vllm_batch_invariant: null },
        },
      });
    }
  }

  // 14a. TASK_QUEUE_ENABLE === "0"
  if (
    Object.hasOwn(selections, "env_task_queue_enable") &&
    parseBoolLike(selections.env_task_queue_enable) === false
  ) {
    findings.push({
      id: "rule-task-queue-disabled-perf-trap",
      severity: "perf-trap",
      title: "TASK_QUEUE_ENABLE=0 关闭 NPU 算子异步下发队列（吞吐/时延显著下降）",
      detail:
        "官方 Dockerfile 默认开启 TASK_QUEUE_ENABLE=1；设为 0 会迫使 Host 侧同步等待/串行下发算子，大幅拉高单步调度开销。",
      affectedKnobIds: ["env_task_queue_enable"],
      sources: [`vllm-ascend@${VA030}:Dockerfile#L55-L57`],
      evidenceLevel: "C",
      fixAction: {
        label: "恢复 TASK_QUEUE_ENABLE = 1",
        nextSelections: { env_task_queue_enable: "1" },
      },
    });
  }

  // 14b. OMP_NUM_THREADS > 16
  const ompThreads = parseEnvIntLike(selections.env_omp_num_threads);
  if (ompThreads !== undefined && ompThreads > 16) {
    findings.push({
      id: "rule-omp-threads-contention-perf-trap",
      severity: "perf-trap",
      title: `OMP_NUM_THREADS=${ompThreads} 过高，多 Worker 进程将严重争抢宿主 CPU 核`,
      detail: `当前 TP×DP=${context.tpSize * context.dpSize} 个独立 Worker 各自派生 ${ompThreads} 个 OpenMP 线程；官方 Dockerfile 推荐设为 1（多卡一般不超过 1~10）。`,
      affectedKnobIds: ["env_omp_num_threads"],
      sources: [`vllm-ascend@${VA030}:Dockerfile#L55-L57`],
      evidenceLevel: "C",
      fixAction: {
        label: "将 OMP_NUM_THREADS 收敛至 1",
        nextSelections: { env_omp_num_threads: 1 },
      },
    });
  }
}

function evaluateFinegrainedTpAndOffloadRules(
  state: EngineEvalState,
  isMlaModel: boolean,
  kvCacheDtype: string,
): void {
  const { context, selections, findings, silentOverrides } = state;
  const oprojTp = parseStrictIntLike(selections.cfg_finegrained_tp_oproj);
  const mlpTp = parseStrictIntLike(selections.cfg_finegrained_tp_mlp);
  const qkvIprojTp = parseStrictIntLike(selections.cfg_finegrained_tp_qkv_iproj);
  const disabledTpVal = context.version === "main" ? 1 : 0;
  const activeThreshold = context.version === "main" ? 1 : 0;
  const oprojValidInt = oprojTp !== undefined;
  const mlpValidInt = mlpTp !== undefined;
  const oprojActive = oprojValidInt && oprojTp > activeThreshold;
  const mlpActive = mlpValidInt && mlpTp > activeThreshold;
  const isFinegrainedTpActive = oprojActive || mlpActive;
  const realSplitActive = (oprojValidInt && oprojTp > 1) || (mlpValidInt && mlpTp > 1);
  const connectorVal =
    typeof selections.cli_kv_transfer_connector === "string" ? selections.cli_kv_transfer_connector : "";
  const hasPreemptOffload =
    connectorVal === "PreemptOffloadConnector" || connectorVal === "MultiConnector(Mooncake+PreemptOffload)";

  if (isFinegrainedTpActive) {
    const problems: string[] = [];
    if (realSplitActive && context.tpSize !== 1) problems.push(`要求 TP=1（当前 TP=${context.tpSize}）`);
    if (realSplitActive && context.graphMode === "NONE") problems.push("禁止 Eager 模式（graphMode=NONE）");
    if (context.pdRole !== "decode") problems.push("仅支持 PD Decode 节点（pdRole=decode）");
    if (context.modelKind === "dense") problems.push("仅支持 MoE 模型");
    if (oprojActive && context.dpSize % oprojTp !== 0) {
      problems.push(`dpSize(${context.dpSize}) 必须能被 oproj_tensor_parallel_size(${oprojTp}) 整除`);
    }
    if (mlpActive && context.dpSize % mlpTp !== 0) {
      problems.push(`dpSize(${context.dpSize}) 必须能被 mlp_tensor_parallel_size(${mlpTp}) 整除`);
    }
    if (parseBoolLike(selections.cfg_recompute_scheduler) !== true) {
      problems.push("要求 scheduler_config.recompute_scheduler_enable=true");
    }
    if (realSplitActive && !hasPreemptOffload) {
      problems.push("要求 kv_transfer_config 包含 PreemptOffloadConnector");
    }

    if (problems.length > 0) {
      const resetSelections: Record<string, number> = {};
      if (oprojActive) resetSelections.cfg_finegrained_tp_oproj = disabledTpVal;
      if (mlpActive) resetSelections.cfg_finegrained_tp_mlp = disabledTpVal;
      findings.push({
        id: "rule-finegrained-tp-preconditions",
        severity: "blocker",
        title: `finegrained_tp_config (oproj/mlp > ${activeThreshold}) 前置条件不满足：${problems.join("；")}`,
        detail:
          "v0.30.0 对 > 0（含 1）检查 MoE、DP 整除与 recompute_scheduler_enable=true（PD D 节点）；两版对真实分片 > 1 进一步强制要求 TP=1、图模式(非 NONE) 与 PreemptOffloadConnector（否则抛 ValueError / AssertionError）。",
        affectedKnobIds: [
          ...(oprojActive ? ["cfg_finegrained_tp_oproj"] : []),
          ...(mlpActive ? ["cfg_finegrained_tp_mlp"] : []),
          ...(Object.hasOwn(selections, "cfg_recompute_scheduler") ? ["cfg_recompute_scheduler"] : []),
          ...(Object.hasOwn(selections, "cli_kv_transfer_connector") ? ["cli_kv_transfer_connector"] : []),
        ],
        sources: [
          `vllm-ascend@${VA030}:vllm_ascend/ascend_config.py#L830-L837`,
          `vllm-ascend@${VA030}:vllm_ascend/ascend_config.py#L1358-L1434`,
          `vllm-ascend@${VA030}:vllm_ascend/platform.py#L1148-L1160`,
          `vllm-ascend@${VAMAIN}:vllm_ascend/ascend_config.py#L1489-L1566`,
          `vllm-ascend@${VAMAIN}:vllm_ascend/platform.py#L1320-L1332`,
        ],
        evidenceLevel: "C",
        fixAction: {
          label: `撤销细粒度 TP 分片（置为 ${disabledTpVal}）`,
          nextSelections: resetSelections,
        },
      });
    } else if (realSplitActive) {
      const maxBatched = parseHumanReadableIntLike(selections.cli_max_num_batched_tokens) ?? 2048;
      const maxSeqs = Object.hasOwn(selections, "cli_max_num_seqs")
        ? (parseCliIntLike(selections.cli_max_num_seqs) ?? 128)
        : Math.min(128, maxBatched);
      const maxStep = Math.min(maxBatched, maxSeqs);
      if (maxStep > 512) {
        const affected: string[] = [];
        if (oprojActive) {
          affected.push("cfg_finegrained_tp_oproj");
          recordSilentOverride(
            silentOverrides,
            "cfg_finegrained_tp_oproj",
            disabledTpVal,
            "rule-finegrained-tp-capture-bound-reset",
          );
        }
        if (mlpActive) {
          affected.push("cfg_finegrained_tp_mlp");
          recordSilentOverride(
            silentOverrides,
            "cfg_finegrained_tp_mlp",
            disabledTpVal,
            "rule-finegrained-tp-capture-bound-reset",
          );
        }
        findings.push({
          id: "rule-finegrained-tp-capture-bound-reset",
          severity: "silent-reset",
          title: `图捕获上限 (512) 小于单步最大 token 数 (${maxStep})，同时静默关闭 oproj 与 mlp 细粒度 TP`,
          detail: `ascend_config.py 计算 max_step=min(max_num_batched_tokens, max_num_seqs*(1+n_spec))=${maxStep}；默认图捕获上界 512 不足时打印告警并将 oproj 与 mlp 一起回写为 ${disabledTpVal}。`,
          affectedKnobIds: affected,
          sources: [
            `vllm-ascend@${VA030}:vllm_ascend/ascend_config.py#L1383-L1409`,
            `vllm-ascend@${VAMAIN}:vllm_ascend/ascend_config.py#L1515-L1540`,
          ],
          evidenceLevel: "C",
          fixAction: {
            label: "将 --max-num-seqs 收敛至 512（满足默认图捕获上界）",
            nextSelections: { cli_max_num_seqs: 512 },
          },
        });
      }
    }
  }

  if (context.version === "main" && qkvIprojTp !== undefined && qkvIprojTp > 1) {
    const qkvProblems: string[] = [
      "仅支持 model_type in ('glm5_next', 'glm5_next_text') 且 linear_num_heads 整除路数（当前 4 类沙盘模型均非 GLM5-Next）",
    ];
    if (context.tpSize !== 1 || (context.ppSize ?? 1) !== 1) {
      qkvProblems.push(`要求 TP=1 且 PP=1（当前 TP=${context.tpSize}, PP=${context.ppSize ?? 1}）`);
    }
    if (context.pdRole !== "decode") qkvProblems.push("仅支持 PD Decode 节点");
    if (context.dpSize % qkvIprojTp !== 0) {
      qkvProblems.push(
        `dpSize(${context.dpSize}) 必须能被 qkv_iproj_tensor_parallel_size(${qkvIprojTp}) 整除`,
      );
    }
    findings.push({
      id: "rule-finegrained-tp-qkv-iproj-preconditions",
      severity: "blocker",
      title: `qkv_iproj_tensor_parallel_size=${qkvIprojTp} 前置条件不满足：${qkvProblems.join("；")}`,
      detail:
        "main ascend_config.py#L1483-L1488 与 #L1550-L1566 仅允许 glm5_next / glm5_next_text、PD Decode 节点、TP=PCP=PP=1 且整除 KDA linear_num_heads 与 DP（沙盘预设模型启动必抛 AssertionError）。",
      affectedKnobIds: ["cfg_finegrained_tp_qkv_iproj"],
      sources: [
        `vllm-ascend@${VAMAIN}:vllm_ascend/ascend_config.py#L1473-L1488`,
        `vllm-ascend@${VAMAIN}:vllm_ascend/ascend_config.py#L1550-L1566`,
      ],
      evidenceLevel: "C",
      fixAction: {
        label: "关闭 qkv_iproj_tensor_parallel_size = 1",
        nextSelections: { cfg_finegrained_tp_qkv_iproj: 1 },
      },
    });
  }

  // sparse_kv_offload_config.{enabled, topk_buffer_size, keep_device_kv_cache}
  const sparseEnabled = parseBoolLike(selections.cfg_sparse_kv_offload_enabled) === true;
  const keepDeviceKvCache = parseBoolLike(selections.cfg_sparse_kv_offload_keep_device_kv_cache) === true;
  const rawTopkBuf = selections.cfg_sparse_kv_offload_topk_buffer_size;
  const topkBufBig = parseStrictBigIntLike(rawTopkBuf);
  if (
    Object.hasOwn(selections, "cfg_sparse_kv_offload_topk_buffer_size") &&
    !isCorruptUrlSentinel(rawTopkBuf) &&
    (typeof rawTopkBuf === "boolean" ||
      topkBufBig === undefined ||
      (topkBufBig !== -1n &&
        (topkBufBig <= 0n || (sparseEnabled && (topkBufBig < 2048n || topkBufBig % 128n !== 0n)))))
  ) {
    findings.push({
      id: "rule-sparse-kv-topk-buffer-size-invalid",
      severity: "blocker",
      title: `sparse_kv_offload_config.topk_buffer_size=${String(rawTopkBuf)} 非法${sparseEnabled ? "、未整除 SFA 块长 (128) 或小于 index_topk (2048)" : "（要求 -1 或正整数）"}`,
      detail:
        "SparseKVOffloadConfig._validate_values 始终要求 topk_buffer_size 为 -1 或正整数；启用 enabled=true 后，_validate_preconditions 与 SparseKVOffloadManager 进一步强制 >= model.index_topk (2048) 且整除 SFA block_size (128)，否则启动抛 ValueError（生成命令已剥离该无效项）。",
      affectedKnobIds: ["cfg_sparse_kv_offload_topk_buffer_size"],
      sources: [
        `vllm-ascend@${VA030}:vllm_ascend/ascend_config.py#L1702-L1771`,
        `vllm-ascend@${VA030}:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L770-L775`,
        `vllm-ascend@${VAMAIN}:vllm_ascend/ascend_config.py#L1800-L1865`,
        `vllm-ascend@${VAMAIN}:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L806-L809`,
      ],
      evidenceLevel: "C",
      fixAction: {
        label: "恢复 topk_buffer_size = -1（自动推导）",
        nextSelections: { cfg_sparse_kv_offload_topk_buffer_size: -1 },
      },
    });
  }

  if (sparseEnabled) {
    const sparseProblems: string[] = [];
    if (context.soc !== "A3") {
      sparseProblems.push(`仅支持 Atlas A3（当前硬件 ${context.soc} 启动抛 RuntimeError / ValueError）`);
    }
    if ((context.ppSize ?? 1) > 1) sparseProblems.push(`不支持 PP=${context.ppSize} (> 1)`);
    if (context.modelKind === "engram_moe") {
      sparseProblems.push(
        "DeepSeek-V4.1 (engram_moe) 含 compress_ratios 压缩权重，Sparse KV offload 硬拒绝含 compress_ratios 的模型",
      );
    } else if (context.modelKind !== "mla_moe") {
      sparseProblems.push("仅支持含 index_topk 且无 compress_ratios 的稀疏 MLA 模型（如 DeepSeek-V3.2-Exp）");
    }
    if (!keepDeviceKvCache && context.pdRole !== "decode") {
      sparseProblems.push(
        "默认仅支持 PD Decode 节点 (kv_consumer)；混部调试须显式开启 keep_device_kv_cache=true",
      );
    }
    if (kvCacheDtype !== "" && kvCacheDtype !== "auto" && kvCacheDtype !== "bfloat16") {
      sparseProblems.push(
        `要求 BF16 主 SFA 缓存（禁止 --kv-cache-dtype ${kvCacheDtype} 非 BF16/量化主缓存）`,
      );
    }
    if (realSplitActive || hasPreemptOffload) {
      sparseProblems.push("PreemptOffloadConnector（及依赖它的 >1 细粒度 TP）与 Sparse KV offload 硬互斥");
    }
    if (sparseProblems.length > 0) {
      findings.push({
        id: "rule-sparse-kv-offload-constraints",
        severity: "blocker",
        title: `sparse_kv_offload_config.enabled=true 启动阻断：${sparseProblems.join("；")}`,
        detail:
          "init_sparse_kv_offload_manager 与 SparseKVOffloadConfig 仅支持 Atlas A3 与 BF16 主 SFA 缓存（拒绝 C8 int8 / TQ4 / fp8 / fp8_e4m3 / mxfp8 / float16），硬检模型须含 index_topk 且无 compress_ratios（DeepSeek-V3.2-Exp 可用，DeepSeek-V4.1 报错），并禁止 PP>1、非 kv_consumer 节点（未开 keep_device_kv_cache）及 PreemptOffloadConnector 冲突。",
        affectedKnobIds: [
          "cfg_sparse_kv_offload_enabled",
          ...(kvCacheDtype !== "" && kvCacheDtype !== "auto" && kvCacheDtype !== "bfloat16"
            ? ["cli_kv_cache_dtype"]
            : []),
          ...(realSplitActive ? ["cfg_finegrained_tp_oproj", "cfg_finegrained_tp_mlp"] : []),
          ...(hasPreemptOffload ? ["cli_kv_transfer_connector"] : []),
        ],
        sources: [
          `vllm-ascend@${VA030}:vllm_ascend/ascend_config.py#L1012-L1016`,
          `vllm-ascend@${VA030}:vllm_ascend/ascend_config.py#L1716-L1771`,
          `vllm-ascend@${VA030}:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L1483-L1486`,
          `vllm-ascend@${VA030}:vllm_ascend/models/deepseek_v41/model.py#L519`,
          `vllm-ascend@${VAMAIN}:vllm_ascend/ascend_config.py#L1130-L1135`,
          `vllm-ascend@${VAMAIN}:vllm_ascend/ascend_config.py#L1813-L1850`,
          `vllm-ascend@${VAMAIN}:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L1520-L1521`,
        ],
        evidenceLevel: "C",
        fixAction: {
          label: "关闭 sparse_kv_offload_config.enabled = false",
          nextSelections: { cfg_sparse_kv_offload_enabled: false },
        },
      });
    } else if (keepDeviceKvCache) {
      findings.push({
        id: "rule-sparse-kv-keep-device-debug-only",
        severity: "perf-trap",
        title: "keep_device_kv_cache=true 仍全量分配 NPU 设备 KV（仅限 PD 混部调试）",
        detail:
          "SparseKVOffloadConfig 警告：开启 keep_device_kv_cache 仍会在设备侧分配完整 KV Pool，无法延长上下文或放大并发 batch_size；生产请改用 PD Decode 节点并关闭该开关。",
        affectedKnobIds: ["cfg_sparse_kv_offload_keep_device_kv_cache", "cfg_sparse_kv_offload_enabled"],
        sources: [
          `vllm-ascend@${VA030}:vllm_ascend/ascend_config.py#L1744-L1750`,
          `vllm-ascend@${VAMAIN}:vllm_ascend/ascend_config.py#L1841-L1848`,
        ],
        evidenceLevel: "C",
        fixAction:
          context.pdRole === "decode"
            ? {
                label: "关闭调试开关 keep_device_kv_cache = false",
                nextSelections: { cfg_sparse_kv_offload_keep_device_kv_cache: false },
              }
            : {
                label: "切至 PD Decode 生产卸载并关闭 keep_device_kv_cache",
                nextContextPatch: { pdRole: "decode" },
                nextSelections: { cfg_sparse_kv_offload_keep_device_kv_cache: false },
              },
      });
    }
  }

  // ec_transfer_config.ec_connector_extra_config.recv_buffer_tokens bounds
  if (
    Object.hasOwn(selections, "cli_ec_recv_buffer_tokens") &&
    !isCorruptUrlSentinel(selections.cli_ec_recv_buffer_tokens)
  ) {
    const ecRaw = selections.cli_ec_recv_buffer_tokens;
    const ecBufBig = parsePureBigIntLike(ecRaw);
    const maxBatchedBig = parseHumanReadableBigIntLike(selections.cli_max_num_batched_tokens) ?? 2048n;
    const isInvalidEcBuf = ecBufBig === undefined || ecBufBig < 2048n || ecBufBig > maxBatchedBig;
    if (isInvalidEcBuf) {
      const safeTarget = maxBatchedBig > 8192n ? 8192 : Number(maxBatchedBig < 2048n ? 2048n : maxBatchedBig);
      findings.push({
        id: "rule-ec-recv-buffer-tokens-out-of-range",
        severity: "blocker",
        title: `ECMemcache recv_buffer_tokens=${String(ecRaw)} 超出合法区间 [2048, max_num_batched_tokens=${maxBatchedBig}]`,
        detail:
          "_get_recv_buffer_tokens 硬校验 2048 <= recv_buffer_tokens <= scheduler_config.max_num_batched_tokens 且不得为 bool（注意默认 8192 在小 max_num_batched_tokens 下也会启动报错）。",
        affectedKnobIds: [
          "cli_ec_recv_buffer_tokens",
          ...(Object.hasOwn(selections, "cli_max_num_batched_tokens") ? ["cli_max_num_batched_tokens"] : []),
        ],
        sources: [
          `vllm-ascend@${VA030}:vllm_ascend/distributed/ec_transfer/ec_memcache_connector.py#L52-L73`,
          `vllm-ascend@${VAMAIN}:vllm_ascend/distributed/ec_transfer/ec_memcache_connector.py#L53-L70`,
        ],
        evidenceLevel: "C",
        fixAction:
          maxBatchedBig >= 2048n
            ? {
                label: `将 recv_buffer_tokens 收敛至 ${safeTarget}（满足 [2048, ${maxBatchedBig}]）`,
                nextSelections: { cli_ec_recv_buffer_tokens: safeTarget },
              }
            : {
                label: "将 recv_buffer_tokens 与 max_num_batched_tokens 对齐至 2048",
                nextSelections: { cli_ec_recv_buffer_tokens: 2048, cli_max_num_batched_tokens: 2048 },
              },
      });
    }
  }

  // enable_kvpp preconditions (active when kvpp_config.size = TP * PCP > 1)
  if (parseBoolLike(selections.cfg_enable_kvpp) === true && context.tpSize > 1) {
    const kvppProblems: string[] = [];
    if (context.pdRole === "decode") {
      kvppProblems.push("Mooncake Decode-only 节点必须关闭 KVPP");
    }
    if (context.graphMode === "FULL_DECODE_ONLY" || context.graphMode === "FULL_AND_PIECEWISE") {
      kvppProblems.push(`图模式 ${context.graphMode} 不受支持（仅支持 Eager NONE 或严格 PIECEWISE）`);
    }
    if (!isMlaModel) {
      kvppProblems.push("当前仅支持非混合 MLA 模型");
    }
    if (kvppProblems.length > 0) {
      findings.push({
        id: "rule-kvpp-constraints-blocker",
        severity: "blocker",
        title: `enable_kvpp=true (kvpp_config.size=${context.tpSize}) 启动阻断：${kvppProblems.join("；")}`,
        detail:
          "KVPPConfig.validate 在 size=TP×PCP > 1 时禁止 Mooncake Decode-only 节点（KVPP must be disabled on the decode-only node）、FULL_* 图模式与非 MLA 模型，违规启动即抛 ValueError。",
        affectedKnobIds: ["cfg_enable_kvpp"],
        sources: [
          `vllm-ascend@${VA030}:vllm_ascend/ascend_config.py#L70-L109`,
          `vllm-ascend@${VAMAIN}:vllm_ascend/ascend_config.py#L74-L116`,
        ],
        evidenceLevel: "C",
        fixAction: {
          label: "关闭 enable_kvpp = false",
          nextSelections: { cfg_enable_kvpp: false },
        },
      });
    }
  }

  // v0.30.0 MooncakeConnectorV2 ignores use_layerwise=true
  if (context.version === "v0.30.0" && parseBoolLike(selections.cli_kv_transfer_use_layerwise) === true) {
    recordSilentOverride(
      silentOverrides,
      "cli_kv_transfer_use_layerwise",
      false,
      "rule-v030-mooncake-v2-ignores-use-layerwise",
    );
    findings.push({
      id: "rule-v030-mooncake-v2-ignores-use-layerwise",
      severity: "silent-reset",
      title: "v0.30.0 MooncakeConnectorV2 注册到 MooncakePullConnector，忽略 use_layerwise=true",
      detail:
        "v0.30.0 kv_transfer/__init__.py 将 MooncakeConnectorV2 映射到 MooncakePullConnector（Push 实现仍抛 NotImplementedError）；v0.30.0 逐层 P2P 需改用 MooncakeLayerwiseConnector，或升级 main 使用 MooncakeConnectorV2。",
      affectedKnobIds: ["cli_kv_transfer_use_layerwise"],
      sources: [
        `vllm-ascend@${VA030}:vllm_ascend/distributed/kv_transfer/__init__.py#L55-L89`,
        `vllm-ascend@${VA030}:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/connector.py#L256-L269`,
        `vllm-ascend@${VAMAIN}:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/connector.py#L297-L313`,
      ],
      evidenceLevel: "C",
      fixAction: {
        label: "在 v0.30.0 MooncakeConnectorV2 下关闭 use_layerwise=false",
        nextSelections: { cli_kv_transfer_use_layerwise: false },
      },
    });
  }
}

function evaluateConfigPreconditionsAndSynergies(state: EngineEvalState): void {
  const {
    context,
    selections,
    findings,
    silentOverrides,
    npugraphEx,
    staticKernel,
    superKernel,
    fusedLevel,
    effectiveNz,
  } = state;

  // 15a. Dynamic EPLB, STAIR, & legacy V1 EPLB env branching by version & Model Runner
  // v0.30.0 defaults to MRv1 when VLLM_USE_V2_MODEL_RUNNER is unset (patch_use_v2_model_runner.py#L27-L30).
  const explicitV2Runner = Object.hasOwn(selections, "env_vllm_use_v2_model_runner")
    ? parseBoolLike(selections.env_vllm_use_v2_model_runner)
    : undefined;
  const isMrv2 = context.version === "main" || explicitV2Runner === true;
  const isV030Mrv1 = context.version === "v0.30.0" && !isMrv2;
  const isV030ExplicitMrv2 = context.version === "v0.30.0" && explicitV2Runner === true;

  const hasDynamicEplbKey = Object.hasOwn(selections, "cfg_eplb_dynamic_eplb");
  const dynamicEplbCfg = parseBoolLike(selections.cfg_eplb_dynamic_eplb) === true;
  const hasExpertMapRecordPath = Object.hasOwn(selections, "cfg_eplb_expert_map_record_path");
  const expertMapRecordPathRaw = selections.cfg_eplb_expert_map_record_path;
  const expertMapRecordPathActive =
    hasExpertMapRecordPath &&
    typeof expertMapRecordPathRaw === "string" &&
    expertMapRecordPathRaw.trim().length > 0;
  const dynamicEplbEnvRaw = selections.env_dynamic_eplb;
  const dynamicEplbEnvTruthy =
    dynamicEplbEnvRaw !== undefined &&
    (String(dynamicEplbEnvRaw).trim().toLowerCase() === "true" || String(dynamicEplbEnvRaw).trim() === "1");
  const expertMapRecordRaw = selections.env_expert_map_record;
  const expertMapRecordEnvTruthy =
    expertMapRecordRaw !== undefined &&
    (String(expertMapRecordRaw).trim().toLowerCase() === "true" || String(expertMapRecordRaw).trim() === "1");
  const expertMapRecordExactLowerTrue =
    expertMapRecordRaw !== undefined && String(expertMapRecordRaw) === "true";
  const hasAnyLegacyEplbControl =
    hasDynamicEplbKey || hasExpertMapRecordPath || dynamicEplbEnvTruthy || expertMapRecordEnvTruthy;
  const wantsEplbViaLegacy =
    dynamicEplbCfg || expertMapRecordPathActive || dynamicEplbEnvTruthy || expertMapRecordEnvTruthy;
  const canMigrateToUpstreamEplb =
    wantsEplbViaLegacy &&
    context.modelKind !== "dense" &&
    context.tpSize * context.dpSize > 1 &&
    parseBoolLike(selections.cli_enable_eplb) !== true;

  if (isV030ExplicitMrv2 && hasAnyLegacyEplbControl) {
    const affected: string[] = [];
    const nextSelections: Record<string, string | number | boolean | null> = {};
    if (hasDynamicEplbKey) {
      affected.push("cfg_eplb_dynamic_eplb");
      nextSelections.cfg_eplb_dynamic_eplb = null;
    }
    if (hasExpertMapRecordPath) {
      affected.push("cfg_eplb_expert_map_record_path");
      nextSelections.cfg_eplb_expert_map_record_path = null;
    }
    if (dynamicEplbEnvTruthy) {
      affected.push("env_dynamic_eplb");
      nextSelections.env_dynamic_eplb = null;
    }
    if (expertMapRecordEnvTruthy) {
      affected.push("env_expert_map_record");
      nextSelections.env_expert_map_record = null;
    }
    if (canMigrateToUpstreamEplb) {
      nextSelections.cli_enable_eplb = true;
    }
    findings.push({
      id: "rule-eplb-v1-controls-in-mrv2",
      severity: "blocker",
      title: "v0.30.0 MRv2 拒绝旧 EPLB 键与环境变量（请改用 --enable-eplb 或切回 V1）",
      detail:
        "v0.30.0 在 VLLM_USE_V2_MODEL_RUNNER=1 下 _validate_eplb_config 仅接受 eplb_config.{load_collection_phase, stair_config}（即使 dynamic_eplb=false 或传 expert_map_record_path 只要键存在即报错），且严禁 DYNAMIC_EPLB / EXPERT_MAP_RECORD 设为 true/1。",
      affectedKnobIds: affected,
      sources: [
        `vllm-ascend@${VA030}:vllm_ascend/platform.py#L974-L995`,
        `vllm-ascend@${VA030}:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L27-L30`,
      ],
      evidenceLevel: "C",
      fixAction: {
        label: canMigrateToUpstreamEplb
          ? "清除旧 V1 EPLB 项并迁移启用 --enable-eplb"
          : "清除旧 V1 EPLB 键与环境变量",
        nextSelections,
        ...(canMigrateToUpstreamEplb && !context.epEnabled ? { nextContextPatch: { epEnabled: true } } : {}),
      },
    });
  } else if (context.version === "main" && hasAnyLegacyEplbControl) {
    const affected: string[] = [];
    const nextSelections: Record<string, string | number | boolean | null> = {};
    if (hasDynamicEplbKey) {
      affected.push("cfg_eplb_dynamic_eplb");
      nextSelections.cfg_eplb_dynamic_eplb = null;
      recordSilentOverride(
        silentOverrides,
        "cfg_eplb_dynamic_eplb",
        "main MRv2 已过滤",
        "rule-eplb-v1-controls-ignored-in-main",
      );
    }
    if (hasExpertMapRecordPath) {
      affected.push("cfg_eplb_expert_map_record_path");
      nextSelections.cfg_eplb_expert_map_record_path = null;
      recordSilentOverride(
        silentOverrides,
        "cfg_eplb_expert_map_record_path",
        "main MRv2 已过滤",
        "rule-eplb-v1-controls-ignored-in-main",
      );
    }
    if (dynamicEplbEnvTruthy) {
      affected.push("env_dynamic_eplb");
      nextSelections.env_dynamic_eplb = null;
      recordSilentOverride(
        silentOverrides,
        "env_dynamic_eplb",
        "main MRv2 已忽略",
        "rule-eplb-v1-controls-ignored-in-main",
      );
    }
    if (expertMapRecordEnvTruthy) {
      affected.push("env_expert_map_record");
      nextSelections.env_expert_map_record = null;
      recordSilentOverride(
        silentOverrides,
        "env_expert_map_record",
        "main MRv2 已忽略",
        "rule-eplb-v1-controls-ignored-in-main",
      );
    }
    if (canMigrateToUpstreamEplb) {
      nextSelections.cli_enable_eplb = true;
    }
    findings.push({
      id: "rule-eplb-v1-controls-ignored-in-main",
      severity: "silent-reset",
      title: "main 分支 MRv2 会自动过滤旧 eplb_config 字段并告警忽略 DYNAMIC_EPLB / EXPERT_MAP_RECORD",
      detail:
        "main@8d6180e2 platform.py#L1129-L1165 在 MRv2 下仅保留 load_collection_phase 与 stair_config，直接过滤 dynamic_eplb / expert_map_record_path 并打印警告忽略旧版环境变量（应改用 --enable-eplb）。",
      affectedKnobIds: affected,
      sources: [`vllm-ascend@${VAMAIN}:vllm_ascend/platform.py#L1129-L1165`],
      evidenceLevel: "C",
      fixAction: {
        label: canMigrateToUpstreamEplb
          ? "清理已忽略的旧 V1 EPLB 项并迁移启用 --enable-eplb"
          : "清理已被 main MRv2 忽略的旧 V1 EPLB 键与环境变量",
        nextSelections,
        ...(canMigrateToUpstreamEplb && !context.epEnabled ? { nextContextPatch: { epEnabled: true } } : {}),
      },
    });
  } else if (isV030Mrv1) {
    if (expertMapRecordPathActive && String(expertMapRecordPathRaw).trim().slice(-5) !== ".json") {
      findings.push({
        id: "rule-eplb-record-path-not-json",
        severity: "blocker",
        title: `expert_map_record_path=${JSON.stringify(expertMapRecordPathRaw)} 非 .json 后缀（启动 TypeError）`,
        detail:
          'EplbConfig._validate_config 严格检查 expert_map_record_path[-5:] == ".json"，否则启动直接抛 TypeError: The expert_map_record_path is not json.。',
        affectedKnobIds: ["cfg_eplb_expert_map_record_path"],
        sources: [`vllm-ascend@${VA030}:vllm_ascend/ascend_config.py#L308-L312`],
        evidenceLevel: "C",
        fixAction: {
          label: '将记录路径后缀改为 ".json"（/tmp/expert_map.json）',
          nextSelections: { cfg_eplb_expert_map_record_path: "/tmp/expert_map.json" },
        },
      });
    }
    const effectiveMrv1DynamicEplb = dynamicEplbCfg || expertMapRecordPathActive;
    if (effectiveMrv1DynamicEplb && !dynamicEplbEnvTruthy && !expertMapRecordExactLowerTrue) {
      const hasNonExactRecord =
        expertMapRecordRaw !== undefined &&
        (String(expertMapRecordRaw).trim() === "1" ||
          String(expertMapRecordRaw).trim().toLowerCase() === "true");
      findings.push({
        id: "rule-dynamic-eplb-missing-env",
        severity: "blocker",
        title: hasNonExactRecord
          ? `EXPERT_MAP_RECORD="${String(expertMapRecordRaw)}" 不满足 MRv1 精确小写 "true" 断言（启动 AssertionError）`
          : "v0.30.0 MRv1 下启用 dynamic_eplb / expert_map_record_path 缺少 DYNAMIC_EPLB=true / EXPERT_MAP_RECORD=true",
        detail:
          'v0.30.0 EplbConfig._validate_config 在设 dynamic_eplb=True 或非空 expert_map_record_path 时断言 os.getenv("DYNAMIC_EPLB","false").lower() in ("true","1") or os.getenv("EXPERT_MAP_RECORD","false") == "true"（EXPERT_MAP_RECORD 设 "1" 或 "True" 均触发 AssertionError）。',
        affectedKnobIds: [
          ...(hasDynamicEplbKey ? ["cfg_eplb_dynamic_eplb"] : []),
          ...(expertMapRecordPathActive ? ["cfg_eplb_expert_map_record_path"] : []),
          hasNonExactRecord ? "env_expert_map_record" : "env_dynamic_eplb",
        ],
        sources: [
          `vllm-ascend@${VA030}:vllm_ascend/ascend_config.py#L308-L326`,
          `vllm-ascend@${VA030}:vllm_ascend/envs.py#L78`,
        ],
        evidenceLevel: "C",
        fixAction: hasNonExactRecord
          ? {
              label: '将 EXPERT_MAP_RECORD 改为精确小写 "true"',
              nextSelections: { env_expert_map_record: "true" },
            }
          : {
              label: "补全环境变量 DYNAMIC_EPLB = true",
              nextSelections: { env_dynamic_eplb: "true" },
            },
      });
    } else if (
      !effectiveMrv1DynamicEplb &&
      expertMapRecordRaw !== undefined &&
      !expertMapRecordExactLowerTrue &&
      (String(expertMapRecordRaw).trim() === "1" ||
        String(expertMapRecordRaw).trim().toLowerCase() === "true")
    ) {
      findings.push({
        id: "rule-mrv1-expert-map-record-case-trap",
        severity: "perf-trap",
        title: `MRv1 下 EXPERT_MAP_RECORD="${String(expertMapRecordRaw)}" 未设为精确小写 "true"（开启记录路径将断言失败）`,
        detail:
          'EplbConfig._validate_config 仅对精确小写 EXPERT_MAP_RECORD=="true" 放行，设为 "1" 或大写在配置 expert_map_record_path 时会直接抛 AssertionError。',
        affectedKnobIds: ["env_expert_map_record"],
        sources: [`vllm-ascend@${VA030}:vllm_ascend/ascend_config.py#L308-L326`],
        evidenceLevel: "C",
        fixAction: {
          label: '将 EXPERT_MAP_RECORD 设为精确小写 "true"',
          nextSelections: { env_expert_map_record: "true" },
        },
      });
    }
  }

  // MRv2 STAIR EPLB & --enable-eplb validation
  const rawRankLimit = selections.cfg_eplb_stair_rank_transfer_limit;
  const rankLimit = parseStrictIntLike(rawRankLimit);
  const invalidRankLimit =
    Object.hasOwn(selections, "cfg_eplb_stair_rank_transfer_limit") &&
    !isCorruptUrlSentinel(rawRankLimit) &&
    (rankLimit === undefined || (rankLimit !== -1 && rankLimit < 1));
  const rawCrossLimit = selections.cfg_eplb_stair_cross_node_transfer_limit;
  const crossLimit = parseStrictIntLike(rawCrossLimit);
  const invalidCrossLimit =
    Object.hasOwn(selections, "cfg_eplb_stair_cross_node_transfer_limit") &&
    !isCorruptUrlSentinel(rawCrossLimit) &&
    (crossLimit === undefined || crossLimit < -1);
  if (invalidRankLimit || invalidCrossLimit) {
    const fixNext: Record<string, number> = {};
    if (invalidRankLimit) fixNext.cfg_eplb_stair_rank_transfer_limit = -1;
    if (invalidCrossLimit) fixNext.cfg_eplb_stair_cross_node_transfer_limit = -1;
    findings.push({
      id: "rule-stair-config-invalid-range",
      severity: "blocker",
      title: "eplb_config.stair_config 迁移配额参数越界（启动 ValueError）",
      detail:
        "StairConfig._validate() 强制校验 rank_transfer_limit 为 -1 或 >= 1（0 非法），cross_node_transfer_limit >= -1（0 表示禁用跨机），且拒绝 bool 类型。",
      affectedKnobIds: [
        ...(invalidRankLimit ? ["cfg_eplb_stair_rank_transfer_limit"] : []),
        ...(invalidCrossLimit ? ["cfg_eplb_stair_cross_node_transfer_limit"] : []),
      ],
      sources: [
        `vllm-ascend@${VA030}:vllm_ascend/ascend_config.py#L248-L251`,
        `vllm-ascend@${VAMAIN}:vllm_ascend/ascend_config.py#L238-L258`,
      ],
      evidenceLevel: "C",
      fixAction: {
        label: "恢复 stair_config 越界字段为 -1（不限）",
        nextSelections: fixNext,
      },
    });
  }

  const hasStairCfg =
    Object.hasOwn(selections, "cfg_eplb_stair_rank_transfer_limit") ||
    Object.hasOwn(selections, "cfg_eplb_stair_cross_node_transfer_limit");
  if (isV030Mrv1 && hasStairCfg) {
    findings.push({
      id: "rule-stair-config-requires-mrv2",
      severity: "blocker",
      title: "v0.30.0 MRv1 拒绝 additional_config.eplb_config.stair_config（仅支持 MRv2）",
      detail:
        "platform.py#L1011-L1015 与 patch_use_v2_model_runner.py：v0.30.0 未显式设 VLLM_USE_V2_MODEL_RUNNER=1 时按 MRv1 运行，传入 stair_config 直接抛 ValueError。",
      affectedKnobIds: [
        ...(Object.hasOwn(selections, "cfg_eplb_stair_rank_transfer_limit")
          ? ["cfg_eplb_stair_rank_transfer_limit"]
          : []),
        ...(Object.hasOwn(selections, "cfg_eplb_stair_cross_node_transfer_limit")
          ? ["cfg_eplb_stair_cross_node_transfer_limit"]
          : []),
      ],
      sources: [
        `vllm-ascend@${VA030}:vllm_ascend/platform.py#L1011-L1015`,
        `vllm-ascend@${VA030}:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L27-L30`,
      ],
      evidenceLevel: "C",
      fixAction: hasAnyLegacyEplbControl
        ? {
            label: "移除 MRv1 不兼容的 stair_config 子项",
            nextSelections: {
              ...(Object.hasOwn(selections, "cfg_eplb_stair_rank_transfer_limit")
                ? { cfg_eplb_stair_rank_transfer_limit: null }
                : {}),
              ...(Object.hasOwn(selections, "cfg_eplb_stair_cross_node_transfer_limit")
                ? { cfg_eplb_stair_cross_node_transfer_limit: null }
                : {}),
            },
          }
        : {
            label: "设置 VLLM_USE_V2_MODEL_RUNNER = 1 以启用 MRv2 STAIR EPLB",
            nextSelections: { env_vllm_use_v2_model_runner: "1" },
          },
    });
  }

  if (parseBoolLike(selections.cli_enable_eplb) === true) {
    if (isV030Mrv1) {
      findings.push({
        id: "rule-enable-eplb-requires-mrv2",
        severity: "blocker",
        title: "v0.30.0 MRv1 下禁用上游 --enable-eplb（必须显式设 VLLM_USE_V2_MODEL_RUNNER=1）",
        detail:
          "v0.30.0 platform.py#L1016-L1017 在 use_v2_model_runner=False（含未设环境变量）时直接抛 ValueError: Upstream EPLB is only supported by Model Runner V2 on Ascend.。",
        affectedKnobIds: ["cli_enable_eplb", "env_vllm_use_v2_model_runner"],
        sources: [
          `vllm-ascend@${VA030}:vllm_ascend/platform.py#L1016-L1017`,
          `vllm-ascend@${VA030}:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L27-L30`,
        ],
        evidenceLevel: "C",
        fixAction: hasAnyLegacyEplbControl
          ? {
              label: "关闭 MRv1 冲突的上游 --enable-eplb",
              nextSelections: { cli_enable_eplb: false },
            }
          : {
              label: "设置 VLLM_USE_V2_MODEL_RUNNER = 1 启用 MRv2",
              nextSelections: { env_vllm_use_v2_model_runner: "1" },
            },
      });
    }
    if (context.modelKind === "dense" || !context.epEnabled || context.tpSize * context.dpSize <= 1) {
      const canEnableEp = context.modelKind !== "dense" && context.tpSize * context.dpSize > 1;
      findings.push({
        id: "rule-enable-eplb-requires-moe-ep",
        severity: "blocker",
        title: "--enable-eplb 仅适用于开启 EP 的多卡 MoE 模型",
        detail: "上游异步 EPLB 需要 MoE 专家并行（--enable-expert-parallel）且总卡数 TP×DP > 1。",
        affectedKnobIds: ["cli_enable_eplb"],
        sources: [
          `vllm-ascend@${VA030}:vllm_ascend/platform.py#L994-L1010`,
          `vllm-ascend@${VAMAIN}:vllm_ascend/platform.py#L1172-L1188`,
        ],
        evidenceLevel: "C",
        fixAction: canEnableEp
          ? {
              label: "开启 --enable-expert-parallel 以配合 --enable-eplb",
              nextContextPatch: { epEnabled: true },
            }
          : {
              label: "关闭 --enable-eplb = false",
              nextSelections: { cli_enable_eplb: false },
            },
      });
    }
  }

  // 15b. enable_force_eplb + dynamic_eplb mutex (v0.30.0 derive_and_validate)
  if (
    context.version === "v0.30.0" &&
    parseBoolLike(selections.cfg_enable_force_eplb) === true &&
    dynamicEplbCfg &&
    context.modelKind !== "dense"
  ) {
    findings.push({
      id: "rule-force-eplb-dynamic-eplb-mutex",
      severity: "blocker",
      title: "enable_force_eplb 与 eplb_config.dynamic_eplb 互斥（启动 ValueError）",
      detail: "derive_and_validate() 禁止在 MoE 模型上同时启用强制均匀模拟与动态重排 EPLB。",
      affectedKnobIds: ["cfg_enable_force_eplb", "cfg_eplb_dynamic_eplb"],
      sources: [`vllm-ascend@${VA030}:vllm_ascend/ascend_config.py#L690-L696`],
      evidenceLevel: "C",
      fixAction: {
        label: "关闭压测开关 enable_force_eplb",
        nextSelections: { cfg_enable_force_eplb: false },
      },
    });
  }

  // 15c. mlapo_keep_prefill_weights preconditions
  const mlapoKeep = parseBoolLike(selections.cfg_mlapo_keep_prefill_weights) === true;
  const mlapoEnabled = parseBoolLike(selections.cfg_enable_mlapo) ?? true;
  const isMlaModel = context.modelKind === "mla_moe" || context.modelKind === "engram_moe";
  if (mlapoKeep && (!mlapoEnabled || !isMlaModel)) {
    findings.push({
      id: "rule-mlapo-keep-prefill-preconditions",
      severity: "blocker",
      title: "mlapo_keep_prefill_weights=true 前置条件不满足（启动 ValueError）",
      detail: "仅限 MLA 模型且 enable_mlapo=true 时允许开启 mlapo_keep_prefill_weights。",
      affectedKnobIds: ["cfg_mlapo_keep_prefill_weights", "cfg_enable_mlapo"],
      sources: [`vllm-ascend@${VA030}:vllm_ascend/ascend_config.py#L866-L877`],
      evidenceLevel: "C",
      fixAction: {
        label: isMlaModel ? "同步开启 enable_mlapo=true" : "关闭 mlapo_keep_prefill_weights",
        nextSelections: isMlaModel ? { cfg_enable_mlapo: true } : { cfg_mlapo_keep_prefill_weights: false },
      },
    });
  }

  // 15d. enable_kv_nz preconditions
  if (parseBoolLike(selections.cfg_enable_kv_nz) === true && (context.pdRole !== "decode" || !isMlaModel)) {
    findings.push({
      id: "rule-kv-nz-preconditions",
      severity: "blocker",
      title: "enable_kv_nz=true 仅支持 MLA 模型与 PD Decode 节点（启动报错）",
      detail:
        "ascend_config.py#L900-L912 对非 MLA 模型抛 RuntimeError，对非 kv_consumer (PD D 节点) 抛 NotImplementedError。",
      affectedKnobIds: ["cfg_enable_kv_nz"],
      sources: [`vllm-ascend@${VA030}:vllm_ascend/ascend_config.py#L900-L912`],
      evidenceLevel: "C",
      fixAction: {
        label: isMlaModel ? "将 PD 角色切为 Decode 节点" : "关闭 enable_kv_nz",
        ...(isMlaModel
          ? { nextContextPatch: { pdRole: "decode" } }
          : { nextSelections: { cfg_enable_kv_nz: false } }),
      },
    });
  }

  // 15e. MC2 hierarchy comm + enable_fused_mc2 mutex
  const hierarchySelected =
    selections.cfg_mc2_comm_alg === "hierarchy" ||
    parseBoolLike(selections.cfg_enable_mc2_hierarchy_comm) === true;
  if (hierarchySelected && fusedLevel > 0) {
    findings.push({
      id: "rule-mc2-hierarchy-fused-mutex",
      severity: "blocker",
      title: "MC2 层次化通信（hierarchy）与 enable_fused_mc2 严格互斥（启动 ValueError）",
      detail: "_validate_mc2_comm_alg 禁止同时开启 hierarchy 通信与 Fused MC2。",
      affectedKnobIds: ["cfg_mc2_comm_alg", "cfg_enable_mc2_hierarchy_comm", "cfg_enable_fused_mc2"],
      sources: [`vllm-ascend@${VA030}:vllm_ascend/ascend_config.py#L1005-L1010`],
      evidenceLevel: "C",
      fixAction: {
        label: "关闭 enable_fused_mc2=0 以保留 hierarchy 通信",
        nextSelections: { cfg_enable_fused_mc2: 0 },
      },
    });
  }

  // 15f. Scheduler PD role guards
  if (parseBoolLike(selections.cfg_balance_scheduling) === true && context.pdRole !== "none") {
    findings.push({
      id: "rule-balance-scheduling-pd-blocker",
      severity: "blocker",
      title: "enable_balance_scheduling 仅支持 PD 混部（在 PD 拆池 P/D 节点启动抛 ValueError）",
      detail: "platform.py#L1037-L1045 禁止在 kv_producer / kv_consumer 上启用均衡调度。",
      affectedKnobIds: ["cfg_balance_scheduling"],
      sources: [`vllm-ascend@${VA030}:vllm_ascend/platform.py#L1037-L1045`],
      evidenceLevel: "C",
      fixAction: {
        label: "关闭 enable_balance_scheduling",
        nextSelections: { cfg_balance_scheduling: false },
      },
    });
  }

  if (parseBoolLike(selections.cfg_recompute_scheduler) === true) {
    if (context.pdRole === "none") {
      findings.push({
        id: "rule-recompute-scheduler-mixed-blocker",
        severity: "blocker",
        title: "recompute_scheduler_enable 仅限 PD D 节点（混部模式启动抛 ValueError）",
        detail: "platform.py#L1134-L1138 校验非 kv_consumer 且非 P 节点时直接拒收启动。",
        affectedKnobIds: ["cfg_recompute_scheduler"],
        sources: [`vllm-ascend@${VA030}:vllm_ascend/platform.py#L1117-L1138`],
        evidenceLevel: "C",
        fixAction: {
          label: "关闭 recompute_scheduler_enable",
          nextSelections: { cfg_recompute_scheduler: false },
        },
      });
    } else if (context.pdRole === "prefill") {
      recordSilentOverride(
        silentOverrides,
        "cfg_recompute_scheduler",
        false,
        "rule-recompute-scheduler-prefill-ignored",
      );
      findings.push({
        id: "rule-recompute-scheduler-prefill-ignored",
        severity: "silent-reset",
        title: "recompute_scheduler_enable 在 PD Prefill 节点被静默置为 False",
        detail:
          "platform.py#L1120-L1133 打印警告并写回 additional_config.scheduler_config.recompute_scheduler_enable=False。",
        affectedKnobIds: ["cfg_recompute_scheduler"],
        sources: [`vllm-ascend@${VA030}:vllm_ascend/platform.py#L1120-L1133`],
        evidenceLevel: "C",
        fixAction: {
          label: "从 Prefill 节点关闭 recompute_scheduler_enable",
          nextSelections: { cfg_recompute_scheduler: false },
        },
      });
    }
  }

  // 15f-2. --quantization modelslim trap, FP8 KV non-A5 blocker, v0.30.0 & MLAPO checks
  if (String(selections.cli_quantization ?? "").trim() === "modelslim") {
    findings.push({
      id: "rule-quantization-modelslim-blocker",
      severity: "blocker",
      title: "--quantization modelslim 为非法参数值，昇腾量化必须传 --quantization ascend",
      detail:
        "vllm-ascend platform.py#L322-L329 仅向 QuantizationConfig 注册了 'ascend'，传入 modelslim 将在参数校验阶段失败；开启 ascend 时模型目录须含 quant_model_description.json。",
      affectedKnobIds: ["cli_quantization"],
      sources: [
        `vllm-ascend@${VA030}:vllm_ascend/platform.py#L322-L329`,
        `vllm-ascend@${VA030}:vllm_ascend/quantization/configs/modelslim_config.py#L941-L945`,
      ],
      evidenceLevel: "C",
      fixAction: {
        label: "改用官方注册名 --quantization ascend",
        nextSelections: { cli_quantization: "ascend" },
      },
    });
  }

  const hasSchedBatched = Object.hasOwn(selections, "cli_max_num_batched_tokens");
  const hasSchedSeqs = Object.hasOwn(selections, "cli_max_num_seqs");
  if (hasSchedBatched || hasSchedSeqs) {
    const schedBatchedBig = hasSchedBatched
      ? parseHumanReadableBigIntLike(selections.cli_max_num_batched_tokens)
      : 2048n;
    const schedSeqsBig = hasSchedSeqs
      ? parseCliBigIntLike(selections.cli_max_num_seqs)
      : schedBatchedBig !== undefined && schedBatchedBig < 128n
        ? schedBatchedBig
        : 128n;
    if (
      schedBatchedBig !== undefined &&
      schedBatchedBig >= 1n &&
      schedSeqsBig !== undefined &&
      schedSeqsBig >= 1n &&
      schedBatchedBig < schedSeqsBig
    ) {
      const targetBatchedBig = schedSeqsBig > 2048n ? schedSeqsBig : 2048n;
      const targetBatchedVal =
        targetBatchedBig <= BigInt(Number.MAX_SAFE_INTEGER)
          ? Number(targetBatchedBig)
          : targetBatchedBig.toString();
      findings.push({
        id: "rule-scheduler-batched-tokens-lt-max-seqs",
        severity: "blocker",
        title: `--max-num-batched-tokens (${schedBatchedBig}) 小于 --max-num-seqs (${schedSeqsBig})（启动 ValueError）`,
        detail:
          "SchedulerConfig.verify_max_model_len 强制校验 max_num_batched_tokens >= max_num_seqs，否则在配置构造阶段直接抛 ValueError。",
        affectedKnobIds: [
          ...(hasSchedBatched ? ["cli_max_num_batched_tokens"] : []),
          ...(hasSchedSeqs ? ["cli_max_num_seqs"] : []),
        ],
        sources: [`vllm@${V030}:vllm/config/scheduler.py#L309-L315`],
        evidenceLevel: "C",
        fixAction: {
          label: `将 --max-num-batched-tokens 提升至 ${targetBatchedBig}`,
          nextSelections: { cli_max_num_batched_tokens: targetBatchedVal },
        },
      });
    }
  }

  const kvCacheDtype =
    selections.cli_kv_cache_dtype === undefined ? "" : String(selections.cli_kv_cache_dtype);
  const kvDtypeAllowedInVersion =
    kvCacheDtype !== "" && UPSTREAM_KV_CACHE_DTYPES_BY_VERSION[context.version].has(kvCacheDtype);
  const isAscendQuantized = String(selections.cli_quantization ?? "") === "ascend";
  if (kvCacheDtype === "turboquant_4bit_nc") {
    if (context.soc === "A5" || context.soc === "310P") {
      findings.push({
        id: "rule-kv-cache-turboquant-unsupported-soc",
        severity: "blocker",
        title: `--kv-cache-dtype turboquant_4bit_nc 不支持 ${context.soc}（仅限 A2 / A3 BF16）`,
        detail:
          "turboquant/config.py#L15-L21 校验硬件能力 TURBOQUANT_4BIT_NC_CACHE 与 bfloat16；A5 与 310P 均不具备该能力，启动直接抛 ValueError: Ascend turboquant_4bit_nc is only supported on Ascend A2/A3。",
        affectedKnobIds: ["cli_kv_cache_dtype"],
        sources: [
          `vllm-ascend@${VA030}:vllm_ascend/quantization/methods/kv_cache/turboquant/config.py#L15-L21`,
          `vllm-ascend@${VA030}:vllm_ascend/device/hardware_profile.py#L291-L303`,
          `vllm-ascend@${VAMAIN}:vllm_ascend/quantization/methods/kv_cache/turboquant/config.py#L15-L21`,
        ],
        evidenceLevel: "C",
        fixAction: {
          label: "将 --kv-cache-dtype 恢复为 auto",
          nextSelections: { cli_kv_cache_dtype: "auto" },
        },
      });
    } else if (isV030Mrv1) {
      findings.push({
        id: "rule-kv-cache-turboquant-mrv1-blocker",
        severity: "blocker",
        title: "v0.30.0 MRv1 下 DeepSeek V4 TurboQuant 必须显式设 VLLM_USE_V2_MODEL_RUNNER=1",
        detail:
          "v0.30.0 patch_use_v2_model_runner.py#L27-L30 未设或设 0 均走 MRv1，turboquant/config.py#L64-L65 对 DeepSeek V4 压缩缓存路径显式检查 use_v2_model_runner，将抛 ValueError: DeepSeek V4 TurboQuant requires VLLM_USE_V2_MODEL_RUNNER=1。",
        affectedKnobIds: ["cli_kv_cache_dtype", "env_vllm_use_v2_model_runner"],
        sources: [
          `vllm-ascend@${VA030}:vllm_ascend/quantization/methods/kv_cache/turboquant/config.py#L64-L65`,
          `vllm-ascend@${VA030}:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L27-L30`,
          `vllm-ascend@${VAMAIN}:vllm_ascend/quantization/methods/kv_cache/turboquant/config.py#L56-L65`,
        ],
        evidenceLevel: "C",
        fixAction: {
          label: "设置 VLLM_USE_V2_MODEL_RUNNER = 1（启用 MRv2）",
          nextSelections: { env_vllm_use_v2_model_runner: "1" },
        },
      });
    }
  } else if (
    (kvCacheDtype === "fp8" || kvCacheDtype === "fp8_e4m3" || kvCacheDtype === "mxfp8") &&
    context.soc !== "A5"
  ) {
    findings.push({
      id: "rule-kv-cache-dtype-fp8-requires-a5",
      severity: "blocker",
      title: `--kv-cache-dtype ${kvCacheDtype} 在 ${context.soc} 上不支持（缺少 A5 FP8 / MXFP8 硬件能力，启动报错）`,
      detail:
        "platform.py#L511-L512、platform.py#L682 与 attention_c8_mxfp.py 对 fp8 / fp8_e4m3 / mxfp8 依赖 HardwareCapability.FP8_ATTENTION 及 A5 MXFP8 算子能力，A2/A3/310P 不具备该硬件能力，启动或推理直接报错。",
      affectedKnobIds: ["cli_kv_cache_dtype"],
      sources: [
        `vllm-ascend@${VA030}:vllm_ascend/platform.py#L511-L512`,
        `vllm-ascend@${VA030}:vllm_ascend/platform.py#L682`,
        `vllm-ascend@${VA030}:vllm_ascend/attention/attention_c8_mxfp.py#L899-L929`,
      ],
      evidenceLevel: "C",
      fixAction: {
        label: "将 --kv-cache-dtype 恢复为 auto",
        nextSelections: { cli_kv_cache_dtype: "auto" },
      },
    });
  } else if (
    kvDtypeAllowedInVersion &&
    ((kvCacheDtype === "bfloat16" && context.soc === "310P") ||
      (kvCacheDtype !== "auto" &&
        kvCacheDtype !== "float16" &&
        kvCacheDtype !== "bfloat16" &&
        kvCacheDtype !== "int8" &&
        kvCacheDtype !== "fp8" &&
        kvCacheDtype !== "fp8_e4m3" &&
        kvCacheDtype !== "mxfp8" &&
        kvCacheDtype !== "turboquant_4bit_nc"))
  ) {
    findings.push({
      id: "rule-kv-cache-dtype-unsupported-on-ascend",
      severity: "blocker",
      title: `--kv-cache-dtype ${kvCacheDtype} 在昇腾 ${context.soc} 后端无对应 KV Cache 算子实现（启动报错）`,
      detail:
        "vllm-ascend 虽保留了上游 CacheDType 联合类型（以兼容 argparse/schema 重建），但仅实现了 auto/float16/bfloat16(非 310P)、int8、turboquant_4bit_nc(A2/A3) 以及 A5 上的 fp8/fp8_e4m3/mxfp8；其他 GPU/HPU 专属枚举会在后端选择或注意力初始化时抛异常。",
      affectedKnobIds: ["cli_kv_cache_dtype"],
      sources: [
        `vllm-ascend@${VA030}:vllm_ascend/patch/platform/patch_kv_cache_dtype.py#L48-L75`,
        `vllm-ascend@${VAMAIN}:vllm_ascend/core/kv_cache_dtype_handlers.py#L22-L72`,
      ],
      evidenceLevel: "C",
      fixAction: {
        label: "将 --kv-cache-dtype 恢复为 auto",
        nextSelections: { cli_kv_cache_dtype: "auto" },
      },
    });
  } else if (kvCacheDtype === "int8") {
    if (!isMlaModel && context.pdRole !== "none") {
      findings.push({
        id: "rule-kv-cache-int8-gqa-mooncake-blocker",
        severity: "blocker",
        title: "GQA 模型在 PD 分离（MooncakeConnector）下不支持 --kv-cache-dtype int8（启动报错）",
        detail:
          "ascend_config.py#L1020-L1043 限制非 MLA（GQA）模型配合 Mooncake KV 传输时不可启用 C8 (int8) KV Cache 量化。",
        affectedKnobIds: ["cli_kv_cache_dtype"],
        sources: [`vllm-ascend@${VA030}:vllm_ascend/ascend_config.py#L1020-L1043`],
        evidenceLevel: "C",
        fixAction: {
          label: "将 --kv-cache-dtype 恢复为 auto",
          nextSelections: { cli_kv_cache_dtype: "auto" },
        },
      });
    } else if (!isAscendQuantized) {
      findings.push({
        id: "rule-kv-cache-int8-requires-quant-scale",
        severity: "blocker",
        title:
          "未开启 --quantization ascend 时普通浮点权重缺少 C8 KV scale，强开 --kv-cache-dtype int8 启动报错",
        detail:
          "昇腾 int8 (C8) KV Cache 依赖 ModelSlim 导出的 KV 量化缩放因子（quant_model_description.json）；普通 BF16/FP16 权重直接开启会因缺失 scale 报错。",
        affectedKnobIds: ["cli_kv_cache_dtype", "cli_quantization"],
        sources: [
          `vllm@${V030}:vllm/engine/arg_utils.py#L1275`,
          `vllm-ascend@${VA030}:vllm_ascend/quantization/configs/modelslim_config.py#L941-L945`,
        ],
        evidenceLevel: "C",
        fixAction: {
          label: "同时开启 --quantization ascend 切换至带 scale 的 ModelSlim 量化权重",
          nextSelections: { cli_quantization: "ascend" },
        },
      });
    }
  }

  if (context.version === "v0.30.0" && Object.hasOwn(selections, "cfg_mega_moe_max_tokens")) {
    const megaMaxTokens = parseStrictIntLike(selections.cfg_mega_moe_max_tokens);
    if (megaMaxTokens !== undefined && megaMaxTokens <= 0) {
      findings.push({
        id: "rule-v030-mega-moe-max-tokens-positive",
        severity: "blocker",
        title: `v0.30.0 下 mega_moe_max_tokens=${megaMaxTokens} 必须 > 0（启动 ValueError）`,
        detail:
          "v0.30.0 ascend_config.py#L952-L953 强校验 mega_moe_max_tokens > 0（0 值自动推导仅在 main 分支支持）。",
        affectedKnobIds: ["cfg_mega_moe_max_tokens"],
        sources: [`vllm-ascend@${VA030}:vllm_ascend/ascend_config.py#L952-L953`],
        evidenceLevel: "C",
        fixAction: {
          label: "恢复 v0.30.0 默认上限 mega_moe_max_tokens = 65536",
          nextSelections: { cfg_mega_moe_max_tokens: 65536 },
        },
      });
    }
  }

  if (String(selections.cfg_mc2_comm_alg ?? "").trim() === "fullmesh_v2" && context.soc !== "A3") {
    findings.push({
      id: "rule-mc2-fullmesh-v2-requires-a3",
      severity: "blocker",
      title: `mc2_comm_alg="fullmesh_v2" 仅支持 Ascend A3（当前 ${context.soc} 启动 ValueError）`,
      detail:
        "ascend_config.py#L984-L987 校验仅 A3 的 MC2_FULLMESH_V2_COMM 允许配置 fullmesh_v2，其他芯片将拒绝启动。",
      affectedKnobIds: ["cfg_mc2_comm_alg"],
      sources: [`vllm-ascend@${VA030}:vllm_ascend/ascend_config.py#L984-L987`],
      evidenceLevel: "C",
      fixAction: {
        label: "将 mc2_comm_alg 重置为自动默认",
        nextSelections: { cfg_mc2_comm_alg: "" },
      },
    });
  }

  if (
    parseBoolLike(selections.cfg_enable_shared_expert_dp) === true &&
    (!context.epEnabled || context.tpSize <= 1 || context.modelKind === "dense")
  ) {
    recordSilentOverride(
      silentOverrides,
      "cfg_enable_shared_expert_dp",
      false,
      "rule-shared-expert-dp-silent-reset",
    );
    findings.push({
      id: "rule-shared-expert-dp-silent-reset",
      severity: "silent-reset",
      title: "enable_shared_expert_dp=true 在非 (MoE + EP + TP>1) 条件下被静默置为 False",
      detail:
        "ascend_config.py#L741-L745 按 enable_expert_parallel && tensor_parallel_size > 1 门控开启共享专家 DP；条件不满足时静默回落 False。",
      affectedKnobIds: ["cfg_enable_shared_expert_dp"],
      sources: [`vllm-ascend@${VA030}:vllm_ascend/ascend_config.py#L741-L745`],
      evidenceLevel: "C",
      fixAction: {
        label: "关闭当前未生效的 enable_shared_expert_dp",
        nextSelections: { cfg_enable_shared_expert_dp: false },
      },
    });
  }

  if (parseBoolLike(selections.cfg_enable_mlapo) === true && !isMlaModel) {
    recordSilentOverride(silentOverrides, "cfg_enable_mlapo", false, "rule-mlapo-non-mla-noop");
    findings.push({
      id: "rule-mlapo-non-mla-noop",
      severity: "silent-reset",
      title: "非 MLA 模型（GQA Dense / 标准 MoE）不存在 MLA 前序层，enable_mlapo=true 静默不生效",
      detail:
        "enable_mlapo 仅作用于 DeepSeek MLA / SFA 注意力前序融合算子（aclnnMlaProlog）；Qwen3 等标准 GQA 模型不会进入 MLA 前序分支。",
      affectedKnobIds: ["cfg_enable_mlapo"],
      sources: [
        `vllm-ascend@${VA030}:vllm_ascend/ascend_config.py#L606`,
        `vllm-ascend@${VA030}:vllm_ascend/attention/mla_v1.py#L1040-L1044`,
      ],
      evidenceLevel: "C",
      fixAction: {
        label: "关闭对当前 GQA 模型无效的 enable_mlapo",
        nextSelections: { cfg_enable_mlapo: false },
      },
    });
  } else if (
    parseBoolLike(selections.cfg_enable_mlapo) === true &&
    (context.soc === "A2" || context.soc === "A3") &&
    context.pdRole !== "decode"
  ) {
    recordSilentOverride(silentOverrides, "cfg_enable_mlapo", false, "rule-mlapo-requires-decode-on-a2-a3");
    findings.push({
      id: "rule-mlapo-requires-decode-on-a2-a3",
      severity: "silent-reset",
      title: `${context.soc} 非 Decode-only 实例中 enable_mlapo=true 被静默禁用（需 PD Decode 节点或 A5）`,
      detail:
        "attention/utils.py#L665-L675 在无 UNRESTRICTED_MLAPO 能力的 A2/A3 上仅对 PD Decode 节点启用 MLAPO，混部或 Prefill 节点自动回退普通路径。",
      affectedKnobIds: ["cfg_enable_mlapo"],
      sources: [`vllm-ascend@${VA030}:vllm_ascend/attention/utils.py#L665-L675`],
      evidenceLevel: "C",
      fixAction: {
        label: isMlaModel ? "将 PD 角色切为 Decode 节点以激活 MLAPO" : "关闭 enable_mlapo",
        ...(isMlaModel
          ? { nextContextPatch: { pdRole: "decode" } }
          : { nextSelections: { cfg_enable_mlapo: false } }),
      },
    });
  }

  // 15g. main shared_engram & quantized_all_reduce preconditions
  if (
    context.version === "main" &&
    Object.hasOwn(selections, "cfg_shared_engram") &&
    isValidJsonKnobPayload({ id: "cfg_shared_engram" }, selections.cfg_shared_engram)
  ) {
    const obj = parseJsonObject(selections.cfg_shared_engram) ?? {};
    const backend = typeof obj.backend === "string" ? obj.backend : "";
    const problems: string[] = [];
    const nextSelections: Record<string, string | number | boolean | null> = {};
    let nextContextPatch: Partial<KnobSandboxContext> | undefined;

    if (context.modelKind !== "engram_moe") {
      problems.push("要求 Engram 模型（DeepSeek-V4.1 且含 engram_config.cpu_offload=True）");
      nextContextPatch = { ...nextContextPatch, modelKind: "engram_moe" };
    }
    if ((context.ppSize ?? 1) > 1) {
      problems.push(`要求 PP = 1（当前 PP=${context.ppSize}）`);
      nextContextPatch = { ...nextContextPatch, ppSize: 1 };
    }
    if (context.tpSize > 8) {
      problems.push(`Ascend Engram 要求 TP ∈ {1,2,4,8}（当前 TP=${context.tpSize}）`);
      nextContextPatch = {
        ...nextContextPatch,
        tpSize: Math.min(context.tpSize, 8) as 1 | 2 | 4 | 8,
      };
    }
    if (backend === "a3") {
      if (context.sleepMode) {
        problems.push("backend='a3' 禁止开启 Sleep Mode");
        nextContextPatch = { ...nextContextPatch, sleepMode: false };
      }
    }
    if (backend === "a2" || backend === "a5") {
      if (context.dpSize <= 1) {
        problems.push(`backend='${backend}' 远端 Engram 在 PCP=1 下要求 DP > 1（激活本地 dp_shared_memory）`);
        nextContextPatch = { ...nextContextPatch, dpSize: 2 };
      }
      if (context.rforkEnabled) {
        problems.push(`backend='${backend}' 要求 lazy safetensors 加载（禁止 --load-format rfork）`);
        nextContextPatch = { ...nextContextPatch, rforkEnabled: false };
      }
      if ((parseCliIntLike(selections.cli_shutdown_timeout) ?? 0) <= 0) {
        problems.push("backend='a2'/'a5' 要求 --shutdown-timeout > 0");
        nextSelections.cli_shutdown_timeout = 120;
      }
    }

    if (problems.length > 0) {
      findings.push({
        id: "rule-shared-engram-constraints",
        severity: "blocker",
        title: `shared_engram (main) 前置约束未满足：${problems.join("；")}`,
        detail:
          "main ascend_config.py#L797-L819、engram/parallel.py#L27-L29 与 deepseek_v41/model.py#L1057-L1065 校验不通过将直接抛 ValueError。",
        affectedKnobIds: ["cfg_shared_engram", "cli_shutdown_timeout"],
        sources: [
          `vllm-ascend@${VAMAIN}:vllm_ascend/ascend_config.py#L797-L819`,
          `vllm-ascend@${VAMAIN}:vllm_ascend/models/deepseek_v41/engram/parallel.py#L27-L29`,
          `vllm-ascend@${VAMAIN}:vllm_ascend/models/deepseek_v41/model.py#L1057-L1065`,
        ],
        evidenceLevel: "C",
        fixAction: {
          label: "补齐 shared_engram 模型、拓扑与运行器前置条件",
          ...(Object.keys(nextSelections).length > 0 ? { nextSelections } : {}),
          ...(nextContextPatch ? { nextContextPatch } : {}),
        },
      });
    }
  }

  const cfgFlashcomm = parseBoolLike(selections.cfg_enable_flashcomm1);
  const envFlashcommRaw = selections.env_enable_flashcomm1;
  const envFlashcomm =
    typeof envFlashcommRaw === "string"
      ? ["1", "true"].includes(envFlashcommRaw.trim().toLowerCase())
        ? true
        : ["0", "false"].includes(envFlashcommRaw.trim().toLowerCase())
          ? false
          : undefined
      : parseBoolLike(envFlashcommRaw);
  const effectiveFlashcomm = cfgFlashcomm === true || envFlashcomm === true;
  if (cfgFlashcomm === false && envFlashcomm === true) {
    recordSilentOverride(
      silentOverrides,
      "cfg_enable_flashcomm1",
      true,
      "rule-env-flashcomm1-overrides-json",
    );
    findings.push({
      id: "rule-env-flashcomm1-overrides-json",
      severity: "silent-reset",
      title: "VLLM_ASCEND_ENABLE_FLASHCOMM1=1 覆盖了 JSON 中的 enable_flashcomm1=false",
      detail:
        "ascend_config.py 在配置派生阶段执行 enable_flashcomm1 or os.getenv('VLLM_ASCEND_ENABLE_FLASHCOMM1','0').lower() in ('1','true')，环境变量为真仍会打开 FlashComm1。",
      affectedKnobIds: ["env_enable_flashcomm1", "cfg_enable_flashcomm1"],
      sources: [
        `vllm-ascend@${VA030}:vllm_ascend/ascend_config.py#L747-L769`,
        `vllm-ascend@${VAMAIN}:vllm_ascend/ascend_config.py#L844-L861`,
      ],
      evidenceLevel: "C",
      fixAction: {
        label: "移除遗留环境变量 VLLM_ASCEND_ENABLE_FLASHCOMM1",
        nextSelections: { env_enable_flashcomm1: null },
      },
    });
  }

  if (context.version === "main" && Object.hasOwn(selections, "cfg_quantized_all_reduce_config")) {
    const qObj = parseJsonObject(selections.cfg_quantized_all_reduce_config);
    const qEnabled =
      qObj !== undefined
        ? parseBoolLike(qObj.enable as string | number | boolean | undefined) === true
        : false;
    const moeSpActive =
      effectiveFlashcomm && context.modelKind !== "dense" && context.epEnabled && context.tpSize > 1;
    // derive_and_validate() clears quantized_all_reduce_config.enable BEFORE _validate_preconditions() checks TP<=8.
    if (qEnabled && moeSpActive) {
      recordSilentOverride(
        silentOverrides,
        "cfg_quantized_all_reduce_config",
        '{"enable":false}',
        "rule-quantized-ar-flashcomm-mutex",
      );
      const canKeepQuantizedAr = context.soc === "A2" && context.tpSize <= 8;
      const flashcommResetSelections: Record<string, string | number | boolean | null> = {};
      if (Object.hasOwn(selections, "cfg_enable_flashcomm1")) {
        flashcommResetSelections.cfg_enable_flashcomm1 = false;
      }
      if (Object.hasOwn(selections, "env_enable_flashcomm1")) {
        flashcommResetSelections.env_enable_flashcomm1 = null;
      }
      findings.push({
        id: "rule-quantized-ar-flashcomm-mutex",
        severity: "silent-reset",
        title: "quantized_all_reduce_config 在 TP/硬件校验前已被 MoE FlashComm1 SP 静默关闭",
        detail:
          "main ascend_config.py#L873-L884 在 derive_and_validate() 内先于 TP<=8 检查将 quantized_all_reduce_config.enable 置为 False（含通过 VLLM_ASCEND_ENABLE_FLASHCOMM1 激活的 MoE SP；Dense 不触发）。",
        affectedKnobIds: [
          "cfg_quantized_all_reduce_config",
          ...(Object.hasOwn(selections, "cfg_enable_flashcomm1") ? ["cfg_enable_flashcomm1"] : []),
          ...(Object.hasOwn(selections, "env_enable_flashcomm1") ? ["env_enable_flashcomm1"] : []),
        ],
        sources: [
          `vllm-ascend@${VAMAIN}:vllm_ascend/ascend_config.py#L844-L884`,
          `vllm-ascend@${VAMAIN}:vllm_ascend/ascend_config.py#L2044-L2049`,
          `vllm-ascend@${VAMAIN}:vllm_ascend/patch/platform/patch_parallel_config.py#L7-L28`,
        ],
        evidenceLevel: "C",
        fixAction: canKeepQuantizedAr
          ? {
              label: "关闭 FlashComm1（含 env）以保留量化 AllReduce",
              nextSelections: flashcommResetSelections,
            }
          : {
              label: "关闭当前硬件/TP 不支持的 quantized_all_reduce_config",
              nextSelections: { cfg_quantized_all_reduce_config: '{"enable":false,"min_numel":16777216}' },
            },
      });
    } else if (qEnabled && (context.soc !== "A2" || context.tpSize > 8)) {
      findings.push({
        id: "rule-quantized-ar-a2-tp8-blocker",
        severity: "blocker",
        title: `quantized_all_reduce_config 仅支持 main 分支 Ascend A2 且 TP<=8（当前 ${context.soc} / TP=${context.tpSize}）`,
        detail:
          "main@8d6180e2 quantized_all_reduce.py#L75-L95 仅放行 AscendDeviceType.A2，且 ascend_config.py#L446-L452 在 TP>8 时直接抛 ValueError。",
        affectedKnobIds: ["cfg_quantized_all_reduce_config"],
        sources: [
          `vllm-ascend@${VAMAIN}:vllm_ascend/distributed/device_communicators/quantized_all_reduce.py#L75-L95`,
          `vllm-ascend@${VAMAIN}:vllm_ascend/ascend_config.py#L446-L452`,
        ],
        evidenceLevel: "C",
        fixAction: {
          label: "关闭不支持当前硬件/TP 的 quantized_all_reduce_config",
          nextSelections: { cfg_quantized_all_reduce_config: '{"enable":false,"min_numel":16777216}' },
        },
      });
    }
  }

  evaluateFinegrainedTpAndOffloadRules(state, isMlaModel, kvCacheDtype);

  // 16. Synergy highlights
  const fuseNormQuant = parseBoolLike(selections.cfg_fuse_norm_quant);
  const hasQuantizedExec = String(selections.cli_quantization ?? "").trim() === "ascend";
  if (fuseNormQuant === true && hasQuantizedExec && context.soc !== "310P" && context.graphMode !== "NONE") {
    findings.push({
      id: "synergy-fuse-norm-quant",
      severity: "synergy",
      title:
        "协同增效（条件生效）：fuse_norm_quant=true 消去非 W4A4（如 W8A8）模型的独立 DynamicQuant 访存瓶颈",
      detail:
        "910B3 [M] 微基准实测未融合独立 DynamicQuant (31.79 µs) 会把 W8A8 纯 GEMM 1.312× 提速拉低至 1.128×；仅对 BF16/FP16 且所有层均不含 W4A4_DYNAMIC / W4A4_FLATQUANT_DYNAMIC 的模型在 FX 图编译（非 Eager）下注册 AddRMSNorm+Quant 融合（若制品任一层含 W4A4 INT4 则跳过整个 Pass）。",
      affectedKnobIds: ["cfg_fuse_norm_quant", "cli_quantization"],
      sources: [
        `vllm-ascend@${VA030}:vllm_ascend/compilation/graph_fusion_pass_manager.py#L58-L63`,
        `vllm-ascend@${VA030}:vllm_ascend/compilation/passes/norm_quant_fusion_pass.py#L349-L386`,
        `vllm-ascend@${VAMAIN}:vllm_ascend/compilation/passes/norm_quant_fusion_pass.py#L413-L457`,
        `infer-lab@${MEASURED_DOC_COMMIT}:docs/benchmarks/2026-11-23-ascend-910b3-measured-evidence.md#L19`,
      ],
      evidenceLevel: "M",
    });
  }

  const hasAllocBlocker = findings.some((f) => f.id === "rule-sleep-mode-expandable-segments-blocker");
  const hasEngramBlocker = findings.some((f) => f.id === "rule-sleep-mode-shared-engram-blocker");
  if (
    context.sleepMode &&
    effectiveNz === 0 &&
    context.soc !== "310P" &&
    !hasAllocBlocker &&
    !hasEngramBlocker
  ) {
    findings.push({
      id: "synergy-sleep-nz-zero",
      severity: "synergy",
      title: "协同增效：weight_nz_mode=0 + Sleep Mode 通过唤醒守卫实现秒级冷热切换",
      detail:
        "显式设 weight_nz_mode=0 并避开 expandable_segments:True 后，NPUWorker.wake_up() 顺利放行；910B3 真机实测唤醒仅需 2.482s（较 95.83s 冷启动快 38.61×）。",
      affectedKnobIds: ["cfg_weight_nz_mode", "env_pytorch_npu_alloc_conf"],
      sources: [
        `vllm-ascend@${VA030}:vllm_ascend/worker/worker.py#L279-L299`,
        `infer-lab@${MEASURED_DOC_COMMIT}:docs/benchmarks/2026-11-23-ascend-910b3-measured-evidence.md#L50`,
      ],
      evidenceLevel: "M",
    });
  }

  if (
    npugraphEx &&
    staticKernel &&
    superKernel &&
    context.soc !== "310P" &&
    context.graphMode === "FULL_DECODE_ONLY"
  ) {
    findings.push({
      id: "synergy-static-super-kernel",
      severity: "synergy",
      title: "协同增效：FULL_DECODE_ONLY + npugraph_ex + static_kernel (+ super_kernel) 三级全链路生效",
      detail:
        "Decode 整图档位同时享受到静态 Shape 编译免推导与相邻子 kernel 合并优化，最大限度压低单步发射气泡。",
      affectedKnobIds: ["cfg_enable_npugraph_ex", "cfg_enable_static_kernel", "cfg_enable_super_kernel"],
      sources: [
        `vllm-ascend@${VA030}:vllm_ascend/ascend_config.py#L131-L169`,
        `vllm-ascend@${VA030}:vllm_ascend/compilation/compiler_interface.py#L146-L160`,
      ],
      evidenceLevel: "C",
    });
  }

  const engramOverlap = parseBoolLike(selections.cfg_multistream_engram_overlap) === true;
  if (
    engramOverlap &&
    context.modelKind === "engram_moe" &&
    (context.graphMode === "FULL_DECODE_ONLY" || context.graphMode === "NONE")
  ) {
    findings.push({
      id: "synergy-engram-multistream",
      severity: "synergy",
      title: "协同增效：Engram 多流重叠在当前图模式下有效激活",
      detail:
        "prepare_engram_inputs 在 FULL_DECODE_ONLY / NONE 单步将 Engram 哈希检索与宿主查表下沉至辅助流，与主计算流并发隐藏通信与访存时延。",
      affectedKnobIds: ["cfg_multistream_engram_overlap"],
      sources: [
        `vllm-ascend@${VA030}:vllm_ascend/models/deepseek_v41/model.py#L1433`,
        `vllm-ascend@${VAMAIN}:vllm_ascend/models/deepseek_v41/model.py#L1546`,
      ],
      evidenceLevel: "C",
    });
  }
}

export function evaluateKnobRecipe(
  context: KnobSandboxContext,
  selections: KnobSelectionMap,
): KnobEvaluationResult {
  const findings: KnobConflictFinding[] = [];
  const silentOverrides = new Map<string, { value: string | number | boolean; ruleId: string }>();

  const npugraphEx = parseBoolLike(selections.cfg_enable_npugraph_ex) ?? true;
  const staticKernel = parseBoolLike(selections.cfg_enable_static_kernel) === true;
  const superKernel = Object.hasOwn(selections, "cfg_enable_super_kernel")
    ? parseBoolLike(selections.cfg_enable_super_kernel) === true
    : staticKernel;
  const rawFused = selections.cfg_enable_fused_mc2;
  const fusedLevel = typeof rawFused === "boolean" ? (rawFused ? 1 : 0) : (parseNumberLike(rawFused) ?? 0);
  const rlEnabled = parseBoolLike(selections.cfg_rl_enabled) === true;
  const batchInvariant = parseBoolLike(selections.env_vllm_batch_invariant) === true;
  const configuredNz = parseNumberLike(selections.cfg_weight_nz_mode);
  const effectiveNz = rlEnabled || batchInvariant ? 0 : (configuredNz ?? 1);

  const state: EngineEvalState = {
    context,
    selections,
    findings,
    silentOverrides,
    npugraphEx,
    staticKernel,
    superKernel,
    fusedLevel,
    rlEnabled,
    batchInvariant,
    effectiveNz,
  };

  evaluateRetiredAndVersionRules(state);
  evaluateSleepAndMemoryRules(state);
  evaluateGraphCompilationRules(state);
  evaluateFusedMc2AndCommRules(state);
  evaluateRuntimeAndEnvTraps(state);
  evaluateConfigPreconditionsAndSynergies(state);

  const activeKnobs: ActiveKnobEntry[] = [];
  for (const spec of ASCEND_KNOB_CATALOG) {
    if (!Object.hasOwn(selections, spec.id)) continue;
    const value = selections[spec.id];
    if (value === undefined) continue;
    const override = silentOverrides.get(spec.id);
    activeKnobs.push({
      spec,
      value,
      lifecycle: resolveKnobLifecycle(spec, context.version),
      ...(override ? { effectiveValue: override.value, overriddenByRuleId: override.ruleId } : {}),
    });
  }

  const blockers = findings.filter((f) => f.severity === "blocker");
  const silentResets = findings.filter((f) => f.severity === "silent-reset");
  const perfTraps = findings.filter((f) => f.severity === "perf-trap");
  const synergies = findings.filter((f) => f.severity === "synergy");
  const { envExports, additionalConfigObj, cliArgs, shellCommand } = buildShellOutputs(context, selections);

  return {
    activeKnobs,
    findings,
    blockers,
    silentResets,
    perfTraps,
    synergies,
    shellCommand,
    envExports,
    additionalConfigObj,
    cliArgs,
  };
}
