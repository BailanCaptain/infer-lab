import type {
  ActivationScheme,
  CouplingCheckInput,
  CudaGraphMode,
  KvRole,
  ModelDtype,
  RuleVersion,
} from "../rules/types";
import {
  ASCEND_SUBCONFIG_FIELD_TYPES,
  ASCEND_TOP_LEVEL_FIELD_TYPES,
  type AscendFieldPrimitiveSpec,
  MAIN_ONLY_TOP_LEVEL_KEYS,
  type UpgradeTargetVersion,
  VALID_ASCEND_COMPILATION_KEYS,
  VALID_ASCEND_FUSION_KEYS,
  VALID_ASCEND_WARMUP_KEYS,
  VALID_BATCH_JOB_SCHED_KEYS,
  VALID_DYNAMIC_SPEC_KEYS,
  VALID_DYNTRA_LB_KEYS,
  VALID_EPLB_KEYS,
  VALID_FINEGRAINED_TP_KEYS_BY_TARGET,
  VALID_KV_TRACE_KEYS,
  VALID_PROFILING_CHUNK_KEYS,
  VALID_REJECTION_SAMPLER_KEYS,
  VALID_RFORK_EPLB_KEYS,
  VALID_RL_KEYS,
  VALID_SCHEDULER_KEYS_BY_TARGET,
  VALID_SHORT_REQUEST_FIRST_KEYS,
  VALID_SPARSE_KV_OFFLOAD_KEYS_BY_TARGET,
  VALID_STAIR_KEYS,
  VALID_TOP_LEVEL_KEYS_BY_TARGET,
  VALID_XLITE_GRAPH_KEYS,
} from "./ascendConfigSchemaKeys";

export interface CliParseDiagnostic {
  code:
    | "parse-empty-command"
    | "parse-unterminated-quote"
    | "parse-invalid-json"
    | "parse-invalid-json-type"
    | "parse-missing-flag-value"
    | "parse-invalid-number"
    | "parse-invalid-range"
    | "parse-invalid-visible-devices"
    | "parse-invalid-vllm-port";
  severity: "error" | "warn";
  flag?: string | undefined;
  message: string;
  remediation?: string | undefined;
}

export interface InferredModelHints {
  matchedPresetName: string | null;
  isMoe?: boolean | undefined;
  hasRoutedExpertHiddenSize?: boolean | undefined;
  useMla?: boolean | undefined;
  usesSfaSparse?: boolean | undefined;
  hasCompressRatios?: boolean | undefined;
  indexTopk?: number | undefined;
  linearNumHeads?: number | undefined;
  isQwen35Dense?: boolean | undefined;
  modelType?: string | undefined;
  numExperts?: number | undefined;
  numExpertsPerTok?: number | undefined;
  numAttentionHeads?: number | undefined;
  numKvHeads?: number | undefined;
  headDim?: number | undefined;
  kvLoraRank?: number | undefined;
  qkRopeHeadDim?: number | undefined;
  defaultModelDtype?: ModelDtype | undefined;
  defaultMaxModelLen?: number | undefined;
  quantMethod?: string | undefined;
  quantScheme?: string | undefined;
  hasWeightBlockSize?: boolean | undefined;
  activationScheme?: ActivationScheme | undefined;
  enableC8Quant?: boolean | undefined;
}

export interface ParsedVllmServeCommand {
  rawText: string;
  normalizedCommandLine: string;
  shellPreamble: readonly string[];
  envVars: Readonly<Record<string, string>>;
  visibleDevices: readonly number[] | null;
  model: string | null;
  servedModelName: string | null;
  port: number | null;
  host: string | null;
  distributedExecutorBackend: string | null;
  loadFormat: string | null;
  trustRemoteCode: boolean;
  enforceEager: boolean;
  enableSleepMode: boolean;
  enablePrefixCaching: boolean | undefined;
  gpuMemoryUtilization: number | undefined;
  rawDtype: string | undefined;
  rawQuantization: string | undefined;
  rawKvCacheDtype: string | undefined;
  dataParallelSizeLocal: number | undefined;
  additionalConfig: Readonly<Record<string, unknown>> | null;
  compilationConfig: Readonly<Record<string, unknown>> | null;
  kvTransferConfig: Readonly<Record<string, unknown>> | null;
  speculativeConfig: Readonly<Record<string, unknown>> | null;
  unknownFlags: readonly string[];
  parseDiagnostics: readonly CliParseDiagnostic[];
  inferredHints: InferredModelHints;
  couplingInput: CouplingCheckInput;
  requiredLocalRanks: number;
  matchedStatementIndex?: number | undefined;
}

export interface ShellAstStatement {
  readonly leadingConj: "" | "&&" | "||";
  readonly terminator: "" | "\n" | ";" | "&";
  readonly raw: string;
}

interface ShellStatement {
  leadingConj: "" | "&&" | "||";
  terminator: "" | "\n" | ";" | "&";
  rawWords: string[];
  raw: string;
}

function isLastCharEscaped(buf: string): boolean {
  let backslashes = 0;
  for (let k = buf.length - 2; k >= 0 && buf[k] === "\\"; k -= 1) {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
}

export function normalizeShellContinuations(input: string): string {
  const lf = input.replace(/\r\n/g, "\n");
  let out = "";
  let quote: "'" | '"' | null = null;
  let inComment = false;
  let i = 0;
  while (i < lf.length) {
    const ch = lf[i] ?? "";
    if (inComment) {
      out += ch;
      if (ch === "\n") inComment = false;
      i += 1;
      continue;
    }
    if (quote === "'") {
      out += ch;
      if (ch === "'") quote = null;
      i += 1;
      continue;
    }
    if (ch === "\\") {
      if (lf[i + 1] === "\n") {
        i += 2;
        continue;
      }
      if (i + 1 < lf.length) {
        out += ch + lf[i + 1]!;
        i += 2;
        continue;
      }
    }
    if (quote === '"') {
      out += ch;
      if (ch === '"') quote = null;
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      out += ch;
      i += 1;
      continue;
    }
    const prev = out[out.length - 1] ?? "";
    if (ch === "#" && (out.length === 0 || (/[\s;&|()]/.test(prev) && !isLastCharEscaped(out)))) {
      inComment = true;
      out += ch;
      i += 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

/**
 * Given `str` immediately after `${` (`startIdx` points to the first char inside `${`),
 * returns the index immediately after the matching `}`, or `-1` if unclosed.
 */
function findClosingDollarBrace(str: string, startIdx: number): number {
  let j = startIdx;
  while (j < str.length) {
    const c = str[j] ?? "";
    if (c === "}") return j + 1;
    if (c === "'") {
      j += 1;
      while (j < str.length && str[j] !== "'") j += 1;
      if (j >= str.length) return -1;
      j += 1;
      continue;
    }
    if (c === '"') {
      j += 1;
      while (j < str.length && str[j] !== '"') {
        const dc = str[j] ?? "";
        if (dc === "\\" && j + 1 < str.length) {
          j += 2;
          continue;
        }
        if (dc === "$" && str[j + 1] === "{") {
          const nestedEnd = findClosingDollarBrace(str, j + 2);
          if (nestedEnd === -1) return -1;
          j = nestedEnd;
          continue;
        }
        j += 1;
      }
      if (j >= str.length) return -1;
      j += 1;
      continue;
    }
    if (c === "\\" && j + 1 < str.length) {
      j += 2;
      continue;
    }
    if (c === "$" && str[j + 1] === "{") {
      const nestedEnd = findClosingDollarBrace(str, j + 2);
      if (nestedEnd === -1) return -1;
      j = nestedEnd;
      continue;
    }
    j += 1;
  }
  return -1;
}

export function splitShellAstStatements(text: string): ShellAstStatement[] {
  const out: ShellAstStatement[] = [];
  let cur = "";
  let pendingConj: "" | "&&" | "||" = "";
  let quote: "'" | '"' | null = null;
  let i = 0;

  const flush = (term: "" | "\n" | ";" | "&", nextConj: "" | "&&" | "||"): void => {
    if (cur.trim().length > 0) {
      out.push({ leadingConj: pendingConj, terminator: term, raw: cur.trim() });
      cur = "";
      pendingConj = nextConj;
    } else if (nextConj !== "") {
      pendingConj = nextConj;
    }
  };

  while (i < text.length) {
    const ch = text[i] ?? "";
    const next = text[i + 1] ?? "";

    if (quote === "'") {
      cur += ch;
      if (ch === "'") quote = null;
      i += 1;
      continue;
    }

    if (quote === '"') {
      if (ch === "\\" && i + 1 < text.length) {
        cur += ch + next;
        i += 2;
        continue;
      }
      if (ch === "$" && next === "{") {
        const endIdx = findClosingDollarBrace(text, i + 2);
        if (endIdx !== -1) {
          cur += text.slice(i, endIdx);
          i = endIdx;
          continue;
        }
      }
      cur += ch;
      if (ch === '"') quote = null;
      i += 1;
      continue;
    }

    if (ch === "\\" && i + 1 < text.length) {
      cur += ch + next;
      i += 2;
      continue;
    }
    if (ch === "$" && next === "{") {
      const endIdx = findClosingDollarBrace(text, i + 2);
      if (endIdx !== -1) {
        cur += text.slice(i, endIdx);
        i = endIdx;
        continue;
      }
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      cur += ch;
      i += 1;
      continue;
    }
    if (
      ch === "#" &&
      (cur.length === 0 || (/\s/.test(cur[cur.length - 1] ?? "") && !isLastCharEscaped(cur)))
    ) {
      while (i < text.length && text[i] !== "\n") i += 1;
      continue;
    }
    if (ch === "\n" || ch === ";") {
      flush(ch, "");
      i += 1;
      continue;
    }
    if (ch === "&" && next === "&") {
      flush("", "&&");
      i += 2;
      continue;
    }
    if (ch === "|" && next === "|") {
      flush("", "||");
      i += 2;
      continue;
    }
    const prev = cur[cur.length - 1] ?? "";
    if (ch === "&" && next !== "&" && next !== ">" && prev !== ">" && prev !== "<") {
      flush("&", "");
      i += 1;
      continue;
    }
    cur += ch;
    i += 1;
  }

  if (cur.trim().length > 0) {
    out.push({ leadingConj: pendingConj, terminator: "", raw: cur.trim() });
  }
  return out;
}

function tokenizeStatement(astStmt: ShellAstStatement, diagnostics: CliParseDiagnostic[]): ShellStatement {
  const stmt = astStmt.raw;
  const rawWords: string[] = [];
  let cur = "";
  let quote: "'" | '"' | null = null;
  let i = 0;

  while (i < stmt.length) {
    const ch = stmt[i] ?? "";
    const next = stmt[i + 1] ?? "";

    if (quote === "'") {
      cur += ch;
      if (ch === "'") quote = null;
      i += 1;
      continue;
    }

    if (quote === '"') {
      if (ch === "\\" && i + 1 < stmt.length) {
        cur += ch + next;
        i += 2;
        continue;
      }
      if (ch === "$" && next === "{") {
        const endIdx = findClosingDollarBrace(stmt, i + 2);
        if (endIdx !== -1) {
          cur += stmt.slice(i, endIdx);
          i = endIdx;
          continue;
        }
      }
      cur += ch;
      if (ch === '"') quote = null;
      i += 1;
      continue;
    }

    if (/\s/.test(ch)) {
      if (cur.length > 0) {
        rawWords.push(cur);
        cur = "";
      }
      i += 1;
      continue;
    }

    if (ch === "'" || ch === '"') {
      quote = ch;
      cur += ch;
      i += 1;
      continue;
    }

    if (ch === "\\" && i + 1 < stmt.length) {
      cur += ch + next;
      i += 2;
      continue;
    }

    if (ch === "$" && next === "{") {
      const endIdx = findClosingDollarBrace(stmt, i + 2);
      if (endIdx !== -1) {
        cur += stmt.slice(i, endIdx);
        i = endIdx;
        continue;
      }
    }

    cur += ch;
    i += 1;
  }

  if (quote !== null) {
    diagnostics.push({
      code: "parse-unterminated-quote",
      severity: "error",
      message: `命令中存在未闭合的 ${quote} 引号，请检查 JSON 或字符串参数引号配对。`,
      remediation: "补全缺失的单引号或双引号后再重新体检。",
    });
  }

  if (cur.length > 0) rawWords.push(cur);
  // Strip trailing unquoted shell background '&' token
  while (rawWords.length > 0 && rawWords[rawWords.length - 1] === "&") {
    rawWords.pop();
  }
  return {
    leadingConj: astStmt.leadingConj,
    terminator: astStmt.terminator,
    rawWords,
    raw: stmt,
  };
}

function expandDollarExpression(
  rawExpr: string,
  env: Record<string, string>,
  onAssignSideEffect: ((key: string, val: string) => void) | undefined,
  singleQuotesAreLiteral: boolean,
  depth: number,
  unsetNames?: ReadonlySet<string>,
): string {
  const inner = rawExpr.slice(2, -1);
  const paramMatch = /^([A-Za-z_][A-Za-z0-9_]*)(?:(:?[-=+])([\s\S]*))?$/.exec(inner);
  if (!paramMatch?.[1]) return rawExpr;
  const key = paramMatch[1];
  const op = paramMatch[2];
  const fallbackRaw = paramMatch[3] ?? "";
  const isSet = Object.hasOwn(env, key);
  const currentVal = isSet ? (env[key] ?? "") : "";
  const isNonEmpty = isSet && currentVal.length > 0;
  if (!op) {
    if (isSet) return currentVal;
    return unsetNames?.has(key) ? "" : rawExpr;
  }
  if (op === ":-" || op === ":=") {
    if (isNonEmpty) return currentVal;
    const expanded = expandShellWord(
      fallbackRaw,
      env,
      onAssignSideEffect,
      singleQuotesAreLiteral,
      depth + 1,
      unsetNames,
    );
    if (op === ":=") {
      env[key] = expanded;
      onAssignSideEffect?.(key, expanded);
    }
    return expanded;
  }
  if (op === "-" || op === "=") {
    if (isSet) return currentVal;
    const expanded = expandShellWord(
      fallbackRaw,
      env,
      onAssignSideEffect,
      singleQuotesAreLiteral,
      depth + 1,
      unsetNames,
    );
    if (op === "=") {
      env[key] = expanded;
      onAssignSideEffect?.(key, expanded);
    }
    return expanded;
  }
  if (op === ":+") {
    return isNonEmpty
      ? expandShellWord(fallbackRaw, env, onAssignSideEffect, singleQuotesAreLiteral, depth + 1, unsetNames)
      : "";
  }
  if (op === "+") {
    return isSet
      ? expandShellWord(fallbackRaw, env, onAssignSideEffect, singleQuotesAreLiteral, depth + 1, unsetNames)
      : "";
  }
  return rawExpr;
}

function expandShellWord(
  rawWord: string,
  env: Record<string, string>,
  onAssignSideEffect?: (key: string, val: string) => void,
  singleQuotesAreLiteral = false,
  depth = 0,
  unsetNames?: ReadonlySet<string>,
): string {
  if (depth > 8) return rawWord;
  let out = "";
  let i = 0;

  while (i < rawWord.length) {
    const ch = rawWord[i] ?? "";
    const next = rawWord[i + 1] ?? "";

    if (!singleQuotesAreLiteral && ch === "'") {
      i += 1;
      while (i < rawWord.length && rawWord[i] !== "'") {
        out += rawWord[i] ?? "";
        i += 1;
      }
      if (i < rawWord.length) i += 1;
      continue;
    }

    if (ch === '"') {
      i += 1;
      while (i < rawWord.length && rawWord[i] !== '"') {
        const dc = rawWord[i] ?? "";
        const dnext = rawWord[i + 1] ?? "";
        if (dc === "\\" && (dnext === '"' || dnext === "\\" || dnext === "$" || dnext === "`")) {
          out += dnext;
          i += 2;
          continue;
        }
        if (dc === "$" && dnext === "{") {
          const endIdx = findClosingDollarBrace(rawWord, i + 2);
          if (endIdx !== -1) {
            out += expandDollarExpression(
              rawWord.slice(i, endIdx),
              env,
              onAssignSideEffect,
              true,
              depth,
              unsetNames,
            );
            i = endIdx;
            continue;
          }
        }
        if (dc === "$") {
          const simpleMatch = /^([A-Za-z_][A-Za-z0-9_]*)/.exec(rawWord.slice(i + 1));
          if (simpleMatch?.[1]) {
            const key = simpleMatch[1];
            out += Object.hasOwn(env, key) ? (env[key] ?? "") : unsetNames?.has(key) ? "" : `$${key}`;
            i += 1 + key.length;
            continue;
          }
        }
        out += dc;
        i += 1;
      }
      if (i < rawWord.length) i += 1;
      continue;
    }

    if (ch === "\\" && i + 1 < rawWord.length) {
      if (!singleQuotesAreLiteral || next === '"' || next === "\\" || next === "$" || next === "`") {
        out += next;
        i += 2;
        continue;
      }
    }

    if (ch === "$" && next === "{") {
      const endIdx = findClosingDollarBrace(rawWord, i + 2);
      if (endIdx !== -1) {
        out += expandDollarExpression(
          rawWord.slice(i, endIdx),
          env,
          onAssignSideEffect,
          singleQuotesAreLiteral,
          depth,
          unsetNames,
        );
        i = endIdx;
        continue;
      }
    }

    if (ch === "$") {
      const simpleMatch = /^([A-Za-z_][A-Za-z0-9_]*)/.exec(rawWord.slice(i + 1));
      if (simpleMatch?.[1]) {
        const key = simpleMatch[1];
        out += Object.hasOwn(env, key) ? (env[key] ?? "") : unsetNames?.has(key) ? "" : `$${key}`;
        i += 1 + key.length;
        continue;
      }
    }

    out += ch;
    i += 1;
  }

  return out;
}

interface ShellWordSegment {
  readonly text: string;
  readonly splittable: boolean;
}

function expandWordSegments(
  rawWord: string,
  env: Record<string, string>,
  onAssignSideEffect: ((key: string, val: string) => void) | undefined,
  unsetNames: ReadonlySet<string> | undefined,
  inUnquotedFallback: boolean,
  depth: number,
): ShellWordSegment[] {
  if (depth > 8) return [{ text: rawWord, splittable: false }];
  const segs: ShellWordSegment[] = [];
  let i = 0;

  while (i < rawWord.length) {
    const ch = rawWord[i] ?? "";
    const next = rawWord[i + 1] ?? "";

    if (ch === "'") {
      let inner = "";
      i += 1;
      while (i < rawWord.length && rawWord[i] !== "'") {
        inner += rawWord[i] ?? "";
        i += 1;
      }
      if (i < rawWord.length) i += 1;
      segs.push({ text: inner, splittable: false });
      continue;
    }

    if (ch === '"') {
      let qEnd = i + 1;
      while (qEnd < rawWord.length && rawWord[qEnd] !== '"') {
        const dc = rawWord[qEnd] ?? "";
        if (dc === "\\" && qEnd + 1 < rawWord.length) {
          qEnd += 2;
          continue;
        }
        if (dc === "$" && rawWord[qEnd + 1] === "{") {
          const bEnd = findClosingDollarBrace(rawWord, qEnd + 2);
          if (bEnd !== -1) {
            qEnd = bEnd;
            continue;
          }
        }
        qEnd += 1;
      }
      const sliceEnd = qEnd < rawWord.length ? qEnd + 1 : rawWord.length;
      const expanded = expandShellWord(
        rawWord.slice(i, sliceEnd),
        env,
        onAssignSideEffect,
        false,
        depth,
        unsetNames,
      );
      segs.push({ text: expanded, splittable: false });
      i = sliceEnd;
      continue;
    }

    if (ch === "\\" && i + 1 < rawWord.length) {
      segs.push({ text: next, splittable: false });
      i += 2;
      continue;
    }

    if (ch === "$" && next === "{") {
      const endIdx = findClosingDollarBrace(rawWord, i + 2);
      if (endIdx !== -1) {
        const rawExpr = rawWord.slice(i, endIdx);
        const inner = rawExpr.slice(2, -1);
        const pm = /^([A-Za-z_][A-Za-z0-9_]*)(?:(:?[-=+])([\s\S]*))?$/.exec(inner);
        if (!pm?.[1]) {
          segs.push({ text: rawExpr, splittable: false });
        } else {
          const key = pm[1];
          const op = pm[2];
          const fallbackRaw = pm[3] ?? "";
          const isSet = Object.hasOwn(env, key);
          const curVal = isSet ? (env[key] ?? "") : "";
          const isNonEmpty = isSet && curVal.length > 0;
          if (!op) {
            if (isSet) segs.push({ text: curVal, splittable: true });
            else if (!unsetNames?.has(key)) segs.push({ text: rawExpr, splittable: false });
          } else if (op === ":-" || op === "-") {
            const useCurrent = op === ":-" ? isNonEmpty : isSet;
            if (useCurrent) {
              segs.push({ text: curVal, splittable: true });
            } else {
              segs.push(
                ...expandWordSegments(fallbackRaw, env, onAssignSideEffect, unsetNames, true, depth + 1),
              );
            }
          } else if (op === ":=" || op === "=") {
            const useCurrent = op === ":=" ? isNonEmpty : isSet;
            if (useCurrent) {
              segs.push({ text: curVal, splittable: true });
            } else {
              const assigned = expandShellWord(
                fallbackRaw,
                env,
                onAssignSideEffect,
                false,
                depth + 1,
                unsetNames,
              );
              env[key] = assigned;
              onAssignSideEffect?.(key, assigned);
              segs.push({ text: assigned, splittable: true });
            }
          } else if (op === ":+" || op === "+") {
            const active = op === ":+" ? isNonEmpty : isSet;
            if (active) {
              segs.push(
                ...expandWordSegments(fallbackRaw, env, onAssignSideEffect, unsetNames, true, depth + 1),
              );
            }
          }
        }
        i = endIdx;
        continue;
      }
    }

    if (ch === "$") {
      const simpleMatch = /^([A-Za-z_][A-Za-z0-9_]*)/.exec(rawWord.slice(i + 1));
      if (simpleMatch?.[1]) {
        const key = simpleMatch[1];
        if (Object.hasOwn(env, key)) {
          segs.push({ text: env[key] ?? "", splittable: true });
        } else if (!unsetNames?.has(key)) {
          segs.push({ text: `$${key}`, splittable: false });
        }
        i += 1 + key.length;
        continue;
      }
    }

    segs.push({ text: ch, splittable: inUnquotedFallback });
    i += 1;
  }

  return segs;
}

function splitSegmentsByIfs(segments: readonly ShellWordSegment[], ifs: string | undefined): string[] {
  const effIfs = ifs === undefined ? " \t\n" : ifs;
  if (effIfs.length === 0) {
    const hasAny = segments.some((s) => !s.splittable || s.text.length > 0);
    return hasAny ? [segments.map((s) => s.text).join("")] : [];
  }
  const ifsWs = new Set<string>([...effIfs].filter((c) => c === " " || c === "\t" || c === "\n"));
  const ifsNonWs = new Set<string>([...effIfs].filter((c) => !ifsWs.has(c)));

  const fields: string[] = [];
  let cur = "";
  let hasToken = false;
  let pendingDelim: "none" | "ws" | "nonws" = "none";

  for (const seg of segments) {
    if (!seg.splittable) {
      cur += seg.text;
      hasToken = true;
      pendingDelim = "none";
      continue;
    }
    for (const ch of seg.text) {
      if (ifsWs.has(ch)) {
        if (hasToken) {
          fields.push(cur);
          cur = "";
          hasToken = false;
          pendingDelim = "ws";
        }
      } else if (ifsNonWs.has(ch)) {
        if (hasToken) {
          fields.push(cur);
          cur = "";
          hasToken = false;
        } else if (pendingDelim !== "ws") {
          fields.push("");
        }
        pendingDelim = "nonws";
      } else {
        cur += ch;
        hasToken = true;
        pendingDelim = "none";
      }
    }
  }
  if (hasToken) fields.push(cur);
  return fields;
}

function expandShellWordToFields(
  rawWord: string,
  env: Record<string, string>,
  onAssignSideEffect?: (key: string, val: string) => void,
  unsetNames?: ReadonlySet<string>,
): string[] {
  const segs = expandWordSegments(rawWord, env, onAssignSideEffect, unsetNames, false, 0);
  const ifs = Object.hasOwn(env, "IFS") ? env.IFS : undefined;
  return splitSegmentsByIfs(segs, ifs);
}

const RAW_SHELL_ASSIGN_RE = /^([A-Za-z_][A-Za-z0-9_]*)=([\s\S]*)$/;
const VALID_IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

const ENV_ASSIGN_RE = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const UNSAFE_JSON_INTS = new WeakMap<object, Map<string | number, bigint>>();

function setUnsafeJsonInt(holder: object, key: string | number, value: bigint | undefined): void {
  let map = UNSAFE_JSON_INTS.get(holder);
  if (value === undefined) {
    map?.delete(key);
    return;
  }
  if (!map) {
    map = new Map<string | number, bigint>();
    UNSAFE_JSON_INTS.set(holder, map);
  }
  map.set(key, value);
}

function getUnsafeJsonInt(holder: object, key: string | number): bigint | undefined {
  return UNSAFE_JSON_INTS.get(holder)?.get(key);
}

export function copyUnsafeJsonInt(src: object, dst: object, key: string | number): void {
  setUnsafeJsonInt(dst, key, getUnsafeJsonInt(src, key));
}

export function cloneRecordWithUnsafeInts(src: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const cloneVal = (v: unknown): unknown => {
    if (Array.isArray(v)) {
      const clonedArr = v.map(cloneVal);
      for (let idx = 0; idx < v.length; idx += 1) {
        copyUnsafeJsonInt(v, clonedArr, idx);
      }
      return clonedArr;
    }
    if (isRecord(v)) return cloneRecordWithUnsafeInts(v);
    return v;
  };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(src)) {
    defineOwnRecordField(out, k, cloneVal(v));
    copyUnsafeJsonInt(src, out, k);
  }
  return out;
}

export function stringifyJsonWithUnsafeInts(value: unknown, exactOverride?: bigint | undefined): string {
  if (exactOverride !== undefined) return exactOverride.toString();
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") return Number.isFinite(value) ? JSON.stringify(value) : "null";
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) {
    return `[${value.map((item, idx) => stringifyJsonWithUnsafeInts(item, getUnsafeJsonInt(value, idx))).join(",")}]`;
  }
  if (isRecord(value)) {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue;
      parts.push(`${JSON.stringify(k)}:${stringifyJsonWithUnsafeInts(v, getUnsafeJsonInt(value, k))}`);
    }
    return `{${parts.join(",")}}`;
  }
  return JSON.stringify(value);
}

function recordUnsafeJsonInts(rawJson: string, root: unknown): void {
  let i = 0;
  const skipWs = (): void => {
    while (i < rawJson.length && /\s/.test(rawJson[i]!)) i += 1;
  };
  const readJsonString = (): string => {
    const start = i;
    i += 1;
    while (i < rawJson.length) {
      const c = rawJson[i]!;
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (c === '"') {
        i += 1;
        break;
      }
      i += 1;
    }
    return JSON.parse(rawJson.slice(start, i)) as string;
  };
  const walk = (holder: object | null, propKey: string | number | null, val: unknown): void => {
    skipWs();
    if (i >= rawJson.length) return;
    const ch = rawJson[i]!;
    if (ch === "{") {
      i += 1;
      skipWs();
      if (rawJson[i] === "}") {
        i += 1;
        return;
      }
      while (i < rawJson.length) {
        skipWs();
        if (rawJson[i] !== '"') break;
        const k = readJsonString();
        skipWs();
        if (rawJson[i] === ":") i += 1;
        walk(isRecord(val) ? val : null, k, isRecord(val) && Object.hasOwn(val, k) ? val[k] : undefined);
        skipWs();
        if (rawJson[i] === ",") {
          i += 1;
          continue;
        }
        if (rawJson[i] === "}") {
          i += 1;
        }
        break;
      }
      return;
    }
    if (ch === "[") {
      i += 1;
      skipWs();
      if (rawJson[i] === "]") {
        i += 1;
        return;
      }
      let arrIdx = 0;
      while (i < rawJson.length) {
        walk(Array.isArray(val) ? val : null, arrIdx, Array.isArray(val) ? val[arrIdx] : undefined);
        arrIdx += 1;
        skipWs();
        if (rawJson[i] === ",") {
          i += 1;
          continue;
        }
        if (rawJson[i] === "]") {
          i += 1;
        }
        break;
      }
      return;
    }
    if (ch === '"') {
      readJsonString();
      if (holder && propKey !== null) setUnsafeJsonInt(holder, propKey, undefined);
      return;
    }
    const start = i;
    while (i < rawJson.length && !/[\s,}\]]/.test(rawJson[i]!)) i += 1;
    const lit = rawJson.slice(start, i);
    if (holder && propKey !== null) {
      if (/^-?\d+$/.test(lit)) {
        try {
          const bi = BigInt(lit);
          if (bi > 9007199254740991n || bi < -9007199254740991n) {
            setUnsafeJsonInt(holder, propKey, bi);
          } else {
            setUnsafeJsonInt(holder, propKey, undefined);
          }
        } catch {
          setUnsafeJsonInt(holder, propKey, undefined);
        }
      } else {
        setUnsafeJsonInt(holder, propKey, undefined);
      }
    }
  };
  try {
    walk(null, null, root);
  } catch {
    // Ignore scanner errors; JSON.parse already validated syntax
  }
}

function parseJsonObjectFlag(
  flag: string,
  rawValue: string,
  diagnostics: CliParseDiagnostic[],
): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(rawValue);
    if (!isRecord(parsed)) {
      diagnostics.push({
        code: "parse-invalid-json-type",
        severity: "error",
        flag,
        message: `${flag} 需要 JSON 对象（例如 '{...}'），实际解析类型为 ${Array.isArray(parsed) ? "array" : typeof parsed}。`,
        remediation: `请使用合法的 JSON 对象传给 ${flag}。`,
      });
      return null;
    }
    recordUnsafeJsonInts(rawValue, parsed);
    return parsed;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    diagnostics.push({
      code: "parse-invalid-json",
      severity: "error",
      flag,
      message: `${flag} 的 JSON 格式非法（${detail}）。`,
      remediation: `请用双引号包裹键名与字符串，去掉多余尾逗号，并用单引号包住整段 JSON 传给 ${flag}。`,
    });
    return null;
  }
}

function parseIntegerFlag(
  flag: string,
  rawValue: string,
  diagnostics: CliParseDiagnostic[],
  opts: {
    min?: number;
    max?: number;
    allowMinusOne?: boolean;
    allowAuto?: boolean;
    allowSuffix?: boolean;
  } = {},
): number | undefined {
  const trimmed = rawValue.trim();
  if (opts.allowAuto && trimmed.toLowerCase() === "auto") {
    return -1;
  }
  if (opts.allowMinusOne && trimmed === "-1") {
    return -1;
  }
  let num: number | undefined;
  if (opts.allowSuffix) {
    num = parseHumanReadableInt(trimmed);
  }
  if (num === undefined) {
    if (/^[+-]?\d(?:_?\d)*$/.test(trimmed)) {
      num = Number.parseInt(trimmed.replace(/_/g, ""), 10);
    } else {
      diagnostics.push({
        code: "parse-invalid-number",
        severity: "error",
        flag,
        message: `${flag} 需要整数，收到 '${rawValue}'。`,
      });
      return undefined;
    }
  }
  if (opts.allowMinusOne && num === -1) return num;
  if ((opts.min !== undefined && num < opts.min) || (opts.max !== undefined && num > opts.max)) {
    diagnostics.push({
      code: "parse-invalid-range",
      severity: "error",
      flag,
      message: `${flag} 数值越界（收到 ${num}，允许范围 ${opts.min ?? "-∞"}..${opts.max ?? "+∞"}）。`,
    });
    return undefined;
  }
  return num;
}

function parseFloatFlag(
  flag: string,
  rawValue: string,
  diagnostics: CliParseDiagnostic[],
  opts: { minExclusive?: number; maxInclusive?: number } = {},
): number | undefined {
  const trimmed = rawValue.trim();
  const num = Number(trimmed);
  if (trimmed.length === 0 || !Number.isFinite(num)) {
    diagnostics.push({
      code: "parse-invalid-number",
      severity: "error",
      flag,
      message: `${flag} 需要数值，收到 '${rawValue}'。`,
    });
    return undefined;
  }
  if (
    (opts.minExclusive !== undefined && num <= opts.minExclusive) ||
    (opts.maxInclusive !== undefined && num > opts.maxInclusive)
  ) {
    diagnostics.push({
      code: "parse-invalid-range",
      severity: "error",
      flag,
      message: `${flag} 数值越界（收到 ${num}，需满足 (${opts.minExclusive ?? "-∞"}, ${opts.maxInclusive ?? "+∞"}]）。`,
    });
    return undefined;
  }
  return num;
}

function parseBoolLike(val: unknown): boolean | undefined {
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val !== 0;
  if (typeof val === "string") {
    const lower = val.trim().toLowerCase();
    if (lower === "1" || lower === "true") return true;
    if (lower === "0" || lower === "false") return false;
  }
  return undefined;
}

function parseEnvIntBool(raw: string | undefined): boolean | undefined {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (!/^[+-]?\d(?:_?\d)*$/.test(trimmed)) return undefined;
  try {
    return BigInt(trimmed.replace(/_/g, "")) !== 0n;
  } catch {
    return undefined;
  }
}

function parsePydanticLaxBool(val: unknown): boolean | undefined {
  if (typeof val === "boolean") return val;
  if (val === 0) return false;
  if (val === 1) return true;
  if (typeof val === "string") {
    if (/^(?:1|true|t|yes|y|on)$/i.test(val)) return true;
    if (/^(?:0|false|f|no|n|off)$/i.test(val)) return false;
  }
  return undefined;
}

function pythonTruthiness(val: unknown): boolean {
  if (val === undefined || val === null || val === false || val === 0 || val === "") return false;
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val !== 0 && !Number.isNaN(val);
  if (typeof val === "string") return val.length > 0;
  if (Array.isArray(val)) return val.length > 0;
  if (isRecord(val)) return Object.keys(val).length > 0;
  return Boolean(val);
}

function parsePydanticBoolField(
  holder: Record<string, unknown>,
  key: string,
  flagPath: string,
  diagnostics: CliParseDiagnostic[],
  opts: { allowNull?: boolean } = {},
): boolean | undefined {
  if (!Object.hasOwn(holder, key) || holder[key] === undefined) return undefined;
  const raw = holder[key];
  if (raw === null && opts.allowNull) return undefined;
  const parsed = parsePydanticLaxBool(raw);
  if (parsed !== undefined) return parsed;
  diagnostics.push({
    code: "parse-invalid-json-type",
    severity: "error",
    flag: flagPath,
    message: `ValidationError: ${flagPath} 需要布尔值（Pydantic 仅接受 true/false、0/1 或 'true'/'false'/'on'/'off'/'yes'/'no'），收到 ${JSON.stringify(raw)}。`,
    remediation: `请将 ${flagPath} 设为 true 或 false。`,
  });
  return undefined;
}

function parseAscendBoolField(
  holder: Record<string, unknown>,
  key: string,
  flagPath: string,
  diagnostics: CliParseDiagnostic[],
  isRfork: boolean,
): boolean | undefined {
  if (!Object.hasOwn(holder, key) || holder[key] === undefined) return undefined;
  if (isRfork) return pythonTruthiness(holder[key]);
  return parsePydanticBoolField(holder, key, flagPath, diagnostics);
}

function parsePydanticLaxBigInt(val: unknown): bigint | undefined {
  if (typeof val === "boolean") return val ? 1n : 0n;
  if (typeof val === "number" && Number.isInteger(val)) return BigInt(val);
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (/^[+-]?\d(?:_?\d)*(?:\.0+)?$/.test(trimmed)) {
      const normalized = trimmed.replace(/_/g, "").replace(/\.0+$/, "");
      try {
        return BigInt(normalized);
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

function parsePydanticLaxInt(val: unknown): number | undefined {
  const bi = parsePydanticLaxBigInt(val);
  if (bi === undefined) return undefined;
  const n = Number(bi);
  if (Number.isFinite(n)) return n;
  return bi > 0n ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER;
}

function parsePydanticNoBoolBigInt(val: unknown): bigint | undefined {
  if (typeof val === "boolean") return undefined;
  return parsePydanticLaxBigInt(val);
}

function parsePythonBuiltinBigInt(val: unknown): bigint | "invalid" | undefined {
  if (val === undefined) return undefined;
  if (typeof val === "boolean") return val ? 1n : 0n;
  if (typeof val === "number") {
    if (!Number.isFinite(val)) return "invalid";
    return BigInt(Math.trunc(val));
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (/^[+-]?\d(?:_?\d)*$/.test(trimmed)) {
      try {
        return BigInt(trimmed.replace(/_/g, ""));
      } catch {
        return "invalid";
      }
    }
  }
  return "invalid";
}

function parsePythonBuiltinFloat(val: unknown): number | "invalid" | undefined {
  if (val === undefined) return undefined;
  if (typeof val === "boolean") return val ? 1 : 0;
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (/^[+-]?nan$/i.test(trimmed)) return Number.NaN;
    const f = parsePydanticLaxFloat(trimmed);
    if (f !== undefined) return f;
  }
  return "invalid";
}

function parsePydanticLaxFloat(val: unknown): number | undefined {
  if (typeof val === "boolean") return val ? 1 : 0;
  if (typeof val === "number" && !Number.isNaN(val)) return val;
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (/^[+-]?(?:inf|infinity)$/i.test(trimmed)) {
      return trimmed.startsWith("-") ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
    }
    if (
      /^[+-]?(?:\d(?:_?\d)*(?:\.(?:\d(?:_?\d)*)?)?|\.\d(?:_?\d)*)(?:[eE][+-]?\d(?:_?\d)*)?$/.test(trimmed)
    ) {
      const n = Number(trimmed.replace(/_/g, ""));
      if (!Number.isNaN(n)) return n;
    }
  }
  return undefined;
}

function parsePydanticNoBoolFloat(val: unknown): number | undefined {
  if (typeof val === "boolean") return undefined;
  return parsePydanticLaxFloat(val);
}

function extractTopLevelJsonFloatLiteral(rawJson: string, targetKey: string): string | undefined {
  let depth = 0;
  let i = 0;
  let result: string | undefined;

  const skipJsonString = (start: number): [string, number] => {
    let decoded = "";
    let p = start + 1;
    while (p < rawJson.length) {
      const c = rawJson[p]!;
      if (c === "\\") {
        decoded += rawJson[p + 1] ?? "";
        p += 2;
        continue;
      }
      if (c === '"') return [decoded, p + 1];
      decoded += c;
      p += 1;
    }
    return [decoded, p];
  };

  while (i < rawJson.length) {
    const ch = rawJson[i]!;
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === '"') {
      const [strVal, afterStr] = skipJsonString(i);
      i = afterStr;
      if (depth === 1) {
        while (i < rawJson.length && /\s/.test(rawJson[i]!)) i += 1;
        if (rawJson[i] === ":") {
          i += 1;
          while (i < rawJson.length && /\s/.test(rawJson[i]!)) i += 1;
          const vStart = i;
          const vc = rawJson[i];
          if (vc === '"') {
            const [, afterVal] = skipJsonString(i);
            i = afterVal;
            if (strVal === targetKey) result = undefined;
          } else if (vc === "{" || vc === "[") {
            let subDepth = 1;
            i += 1;
            while (i < rawJson.length && subDepth > 0) {
              const sc = rawJson[i]!;
              if (sc === '"') {
                const [, afterSubStr] = skipJsonString(i);
                i = afterSubStr;
                continue;
              }
              if (sc === "{" || sc === "[") subDepth += 1;
              else if (sc === "}" || sc === "]") subDepth -= 1;
              i += 1;
            }
            if (strVal === targetKey) result = undefined;
          } else {
            while (i < rawJson.length && !/[\s,}\]]/.test(rawJson[i]!)) i += 1;
            if (strVal === targetKey) {
              const tok = rawJson.slice(vStart, i).trim();
              result = /^-?\d+(?:\.\d+(?:[eE][+-]?\d+)?|[eE][+-]?\d+)$/.test(tok) ? tok : undefined;
            }
          }
        }
      }
      continue;
    }
    if (ch === "{" || ch === "[") depth += 1;
    else if (ch === "}" || ch === "]") depth = Math.max(0, depth - 1);
    i += 1;
  }
  return result;
}

function parseNumberLike(val: unknown): number | undefined {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "string" && val.trim().length > 0) {
    const n = Number(val.trim());
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function normalizeModelDtype(raw: string | undefined): ModelDtype | undefined {
  if (!raw) return undefined;
  const lower = raw.trim().toLowerCase();
  if (lower === "bfloat16" || lower === "bf16") return "bfloat16";
  if (lower === "float16" || lower === "fp16" || lower === "half") return "float16";
  if (lower === "float32" || lower === "fp32" || lower === "float") return "float32";
  return undefined;
}

function normalizeCudaGraphMode(val: unknown): CudaGraphMode | undefined {
  if (typeof val !== "string") return undefined;
  const upper = val.trim().toUpperCase();
  if (
    upper === "NONE" ||
    upper === "PIECEWISE" ||
    upper === "FULL_DECODE_ONLY" ||
    upper === "FULL" ||
    upper === "FULL_AND_PIECEWISE"
  ) {
    return upper;
  }
  return undefined;
}

function normalizeKvRole(val: unknown): KvRole | undefined {
  if (typeof val !== "string") return undefined;
  const lower = val.trim().toLowerCase();
  if (lower === "kv_producer" || lower === "kv_consumer" || lower === "kv_both") {
    return lower;
  }
  return undefined;
}

export function inferModelHints(modelPath: string | null): InferredModelHints {
  if (!modelPath) return { matchedPresetName: null };
  const s = modelPath.toLowerCase();
  const hints: InferredModelHints = { matchedPresetName: null };

  if (/qwen3[-_.]?30b[-_.]?a3b/.test(s)) {
    hints.matchedPresetName = "Qwen3-30B-A3B";
    hints.isMoe = true;
    hints.useMla = false;
    hints.modelType = "qwen3_moe";
    hints.numExperts = 128;
    hints.numExpertsPerTok = 8;
    hints.numAttentionHeads = 32;
    hints.numKvHeads = 4;
    hints.headDim = 128;
    hints.defaultModelDtype = "bfloat16";
    hints.defaultMaxModelLen = 40960;
  } else if (/qwen3[-_.]?235b[-_.]?a22b/.test(s)) {
    hints.matchedPresetName = "Qwen3-235B-A22B";
    hints.isMoe = true;
    hints.useMla = false;
    hints.modelType = "qwen3_moe";
    hints.numExperts = 128;
    hints.numExpertsPerTok = 8;
    hints.numAttentionHeads = 64;
    hints.numKvHeads = 4;
    hints.headDim = 128;
    hints.defaultModelDtype = "bfloat16";
    hints.defaultMaxModelLen = 40960;
  } else if (/qwen3[-_.]?8b/.test(s)) {
    hints.matchedPresetName = "Qwen3-8B";
    hints.isMoe = false;
    hints.useMla = false;
    hints.modelType = "qwen3";
    hints.numAttentionHeads = 32;
    hints.numKvHeads = 8;
    hints.headDim = 128;
    hints.defaultModelDtype = "bfloat16";
    hints.defaultMaxModelLen = 40960;
  } else if (/qwen3[-_.]?14b/.test(s)) {
    hints.matchedPresetName = "Qwen3-14B";
    hints.isMoe = false;
    hints.useMla = false;
    hints.modelType = "qwen3";
    hints.numAttentionHeads = 40;
    hints.numKvHeads = 8;
    hints.headDim = 128;
    hints.defaultModelDtype = "bfloat16";
    hints.defaultMaxModelLen = 40960;
  } else if (/qwen3[-_.]?32b/.test(s)) {
    hints.matchedPresetName = "Qwen3-32B";
    hints.isMoe = false;
    hints.useMla = false;
    hints.modelType = "qwen3";
    hints.numAttentionHeads = 64;
    hints.numKvHeads = 8;
    hints.headDim = 128;
    hints.defaultModelDtype = "bfloat16";
    hints.defaultMaxModelLen = 40960;
  } else if (/qwen3[-_.]?0\.6b/.test(s)) {
    hints.matchedPresetName = "Qwen3-0.6B";
    hints.isMoe = false;
    hints.useMla = false;
    hints.modelType = "qwen3";
    hints.numAttentionHeads = 16;
    hints.numKvHeads = 8;
    hints.headDim = 128;
    hints.defaultModelDtype = "bfloat16";
    hints.defaultMaxModelLen = 40960;
  } else if (/qwen3\.[568][-_.]?27b/.test(s)) {
    hints.matchedPresetName = "Qwen3.5-27B";
    hints.isMoe = false;
    hints.useMla = false;
    hints.modelType = "qwen3_5";
    hints.isQwen35Dense = true;
    hints.defaultModelDtype = "bfloat16";
  } else if (/deepseek[-_.]?v4(?:\.\d+)?[-_.]?(?:flash|pro)/.test(s)) {
    hints.matchedPresetName = /[-_.]pro(?:$|[-_./])/.test(s) ? "DeepSeek-V4-Pro" : "DeepSeek-V4-Flash";
    hints.isMoe = true;
    hints.useMla = true;
    hints.usesSfaSparse = false;
    hints.hasCompressRatios = true;
    hints.indexTopk = 1024;
    hints.modelType = "deepseek_v4";
    hints.numExperts = /[-_.]pro(?:$|[-_./])/.test(s) ? 384 : 256;
    hints.numExpertsPerTok = 8;
    hints.numAttentionHeads = 64;
    hints.headDim = 512;
    hints.kvLoraRank = 512;
    hints.qkRopeHeadDim = 64;
    hints.defaultModelDtype = "bfloat16";
  } else if (/deepseek[-_.]?v4/.test(s)) {
    hints.matchedPresetName = "DeepSeek-V4";
    hints.isMoe = true;
    hints.useMla = true;
    hints.usesSfaSparse = true;
    hints.indexTopk = 2048;
    hints.modelType = "deepseek_v4";
    hints.numExperts = 256;
    hints.numExpertsPerTok = 8;
    hints.numAttentionHeads = 128;
    hints.headDim = 512;
    hints.kvLoraRank = 512;
    hints.qkRopeHeadDim = 64;
    hints.defaultModelDtype = "bfloat16";
  } else if (/deepseek[-_.]?v3\.2/.test(s)) {
    hints.matchedPresetName = "DeepSeek-V3.2";
    hints.isMoe = true;
    hints.useMla = true;
    hints.usesSfaSparse = true;
    hints.indexTopk = 2048;
    hints.modelType = "deepseek_v32";
    hints.numExperts = 256;
    hints.numExpertsPerTok = 8;
    hints.numAttentionHeads = 128;
    hints.kvLoraRank = 512;
    hints.qkRopeHeadDim = 64;
    hints.defaultModelDtype = "bfloat16";
  } else if (/deepseek[-_.]?(v3|r1)/.test(s)) {
    hints.matchedPresetName = "DeepSeek-V3/R1";
    hints.isMoe = true;
    hints.useMla = true;
    hints.modelType = "deepseek_v3";
    hints.numExperts = 256;
    hints.numExpertsPerTok = 8;
    hints.numAttentionHeads = 128;
    hints.kvLoraRank = 512;
    hints.qkRopeHeadDim = 64;
    hints.defaultModelDtype = "bfloat16";
  } else if (/glm[-_.]?5\.3[-_.]?flash/.test(s)) {
    hints.matchedPresetName = "GLM-5.3-Flash";
    hints.isMoe = true;
    hints.useMla = true;
    hints.usesSfaSparse = false;
    hints.indexTopk = 2048;
    hints.numExperts = 288;
    hints.modelType = "glm5_next";
    hints.linearNumHeads = 64;
    hints.defaultModelDtype = "bfloat16";
  } else if (/glm[-_.]?5/.test(s)) {
    hints.matchedPresetName = "GLM-5-MoE";
    hints.isMoe = true;
    hints.useMla = true;
    hints.usesSfaSparse = true;
    hints.indexTopk = 2048;
    hints.numExperts = 256;
    hints.modelType = "glm5";
    hints.defaultModelDtype = "bfloat16";
  } else if (/glm[-_.]?4\.7[-_.]?flash/.test(s)) {
    hints.matchedPresetName = "GLM-4.7-Flash";
    hints.isMoe = true;
    hints.useMla = true;
    hints.modelType = "glm4_moe_lite";
    hints.defaultModelDtype = "bfloat16";
  } else if (/glm[-_.]?(4\.5|4\.6|4\.7)/.test(s)) {
    hints.matchedPresetName = "GLM-4.5/4.7-MoE";
    hints.isMoe = true;
    hints.useMla = false;
    hints.modelType = "glm4_moe";
    hints.defaultModelDtype = "bfloat16";
  } else if (/kimi[-_.]?k3/.test(s)) {
    hints.matchedPresetName = "Kimi-K3-LatentMoE";
    hints.isMoe = true;
    hints.modelType = "kimi_k3";
    hints.hasRoutedExpertHiddenSize = true;
    hints.defaultModelDtype = "bfloat16";
  } else if (/llama[-_.]?4/.test(s)) {
    hints.matchedPresetName = "Llama-4-MoE";
    hints.isMoe = true;
    hints.useMla = false;
    hints.modelType = "llama4";
    if (/maverick|128e/.test(s)) hints.numExperts = 128;
    else if (/scout|16e/.test(s)) hints.numExperts = 16;
  } else if (/minimax[-_.]?m3/.test(s)) {
    hints.matchedPresetName = "MiniMax-M3";
    hints.isMoe = true;
    hints.useMla = false;
    hints.modelType = "minimax_m3";
  } else if (/mixtral/.test(s)) {
    hints.isMoe = true;
    hints.useMla = false;
    hints.modelType = "mixtral";
  } else if (/(?:llama|mistral|gemma|internlm|yi)/.test(s)) {
    hints.isMoe = /moe|-\d+e(?:$|\b|[-_.])/.test(s);
    hints.useMla = false;
  }

  // Weight quantization & C8 naming hints
  if (/(?:^|[-_/])fp8(?:$|[-_/])/.test(s)) {
    hints.quantMethod = "fp8";
    hints.hasWeightBlockSize = true;
    hints.activationScheme = "dynamic";
  } else if (/(?:^|[-_/])(w8a8(?:sc|[_-]?dynamic|[_-]?mix|[_-]?pdmix|-310)?|w4a8|w4a4)(?:$|[-_/])/.test(s)) {
    hints.quantMethod = "ascend";
    if (/(?:^|[-_/])w8a8[_-]?pdmix(?:$|[-_/])/.test(s)) {
      hints.quantScheme = "W8A8_PDMIX";
    } else if (/(?:^|[-_/])w8a8[_-]?mix(?:$|[-_/])/.test(s)) {
      hints.quantScheme = "W8A8_MIX";
    }
  }
  if (/(?:^|[-_/])(c8|w8a8c8)(?:$|[-_/])/.test(s)) {
    hints.enableC8Quant = true;
  }

  return hints;
}

function parseVisibleDevices(raw: string | undefined, diagnostics: CliParseDiagnostic[]): number[] | null {
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    diagnostics.push({
      code: "parse-invalid-visible-devices",
      severity: "error",
      flag: "ASCEND_RT_VISIBLE_DEVICES",
      message: "ASCEND_RT_VISIBLE_DEVICES 为空字符串，进程将无法发现任何 NPU 设备。",
      remediation: "请填写逗号分隔的设备编号，例如 export ASCEND_RT_VISIBLE_DEVICES=0,1。",
    });
    return [];
  }
  const parts = trimmed.split(",").map((p) => p.trim());
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const part of parts) {
    if (!/^\d+$/.test(part)) {
      diagnostics.push({
        code: "parse-invalid-visible-devices",
        severity: "error",
        flag: "ASCEND_RT_VISIBLE_DEVICES",
        message: `ASCEND_RT_VISIBLE_DEVICES='${raw}' 中包含非整数设备号 '${part}'。`,
        remediation: "设备列表应为逗号分隔的非负整数，例如 0,1,2,3。",
      });
      return null;
    }
    const id = Number.parseInt(part, 10);
    if (seen.has(id)) {
      diagnostics.push({
        code: "parse-invalid-visible-devices",
        severity: "warn",
        flag: "ASCEND_RT_VISIBLE_DEVICES",
        message: `ASCEND_RT_VISIBLE_DEVICES='${raw}' 中存在重复设备编号 ${id}。`,
      });
    }
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function stripShellRedirections(tokens: readonly string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const tok = tokens[i] ?? "";
    if (/^(?:\d?>&?\d?|\d?>>|&>|&>>)$/.test(tok)) {
      if (!tok.includes("&") && i + 1 < tokens.length) {
        i += 1;
      }
      continue;
    }
    if (/^(?:\d?>>?|\d?>&\d|&>>?).+/.test(tok)) {
      continue;
    }
    out.push(tok);
  }
  return out;
}

const KNOWN_NO_ARG_BOOL_FLAGS: ReadonlySet<string> = new Set([
  "--disable-log-requests",
  "--enable-log-requests",
  "--no-enable-log-requests",
  "--disable-log-stats",
  "--disable-uvicorn-access-log",
  "--disable-fastapi-docs",
  "--disable-frontend-multiprocessing",
  "--disable-custom-all-reduce",
  "--disable-sliding-window",
  "--disable-mm-preprocessor-cache",
  "--disable-hybrid-kv-cache-manager",
  "--disable-cascade-attn",
  "--enable-auto-tool-choice",
  "--enable-reasoning",
  "--enable-chunked-local-attn",
  "--enable-prompt-embeds",
  "--enable-multimodal",
  "--enable-eplb",
  "--no-enable-eplb",
  "--enable-dbo",
  "--no-enable-dbo",
  "--enable-dp-attention",
  "--no-enable-dp-attention",
  "--async-scheduling",
  "--no-async-scheduling",
  "--skip-tokenizer-init",
  "--headless",
]);

function isLikelyModelArg(token: string): boolean {
  if (token.includes("/") || token.includes("\\")) return true;
  return /^(?:qwen|deepseek|llama|glm|mistral|gemma|mixtral|internlm|yi|kimi|minimax)/i.test(token);
}

function normalizeCliFlag(rawFlag: string): string {
  if (rawFlag.startsWith("--")) {
    const body = rawFlag.slice(2);
    const dotIdx = body.indexOf(".");
    if (dotIdx >= 0) {
      return `--${body.slice(0, dotIdx).replace(/_/g, "-")}${body.slice(dotIdx)}`;
    }
    return `--${body.replace(/_/g, "-")}`;
  }
  return rawFlag;
}

const FORBIDDEN_DOTTED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function parseHumanReadableInt(raw: string): number | undefined {
  const m = /^(\d+(?:\.\d+)?)([kKmMgGtT])$/.exec(raw.trim());
  if (!m?.[1] || !m[2]) return undefined;
  const digits = m[1];
  const num = Number(digits);
  if (!Number.isFinite(num)) return undefined;
  const decimalMult: Readonly<Record<string, number>> = {
    k: 1e3,
    m: 1e6,
    g: 1e9,
    t: 1e12,
  };
  const binaryMult: Readonly<Record<string, number>> = {
    K: 2 ** 10,
    M: 2 ** 20,
    G: 2 ** 30,
    T: 2 ** 40,
  };
  if (Object.hasOwn(decimalMult, m[2])) {
    return Math.trunc(num * decimalMult[m[2]]!);
  }
  if (Object.hasOwn(binaryMult, m[2])) {
    if (digits.includes(".")) return undefined;
    return Number.parseInt(digits, 10) * binaryMult[m[2]]!;
  }
  return undefined;
}

function parseDottedScalarOrJson(raw: string): { value: unknown; unsafeInt?: bigint | undefined } {
  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (isRecord(parsed)) {
      recordUnsafeJsonInts(trimmed, parsed);
    } else if (/^-?\d+$/.test(trimmed)) {
      try {
        const bi = BigInt(trimmed);
        if (bi > 9007199254740991n || bi < -9007199254740991n) {
          return { value: parsed, unsafeInt: bi };
        }
      } catch {
        // Ignore BigInt overflow
      }
    }
    return { value: parsed };
  } catch {
    const hr = parseHumanReadableInt(trimmed);
    if (hr !== undefined) return { value: hr };
    if (/^[+-]?\d(?:_?\d)*$/.test(trimmed)) {
      const normalized = trimmed.replace(/_/g, "");
      try {
        const bi = BigInt(normalized);
        const num = Number(bi);
        if (bi > 9007199254740991n || bi < -9007199254740991n) {
          return { value: num, unsafeInt: bi };
        }
        return { value: num };
      } catch {
        // Fall through to raw string
      }
    }
    return { value: raw };
  }
}

function defineOwnRecordField(target: Record<string, unknown>, key: string, value: unknown): void {
  if (Object.hasOwn(target, key)) {
    target[key] = value;
  } else {
    Object.defineProperty(target, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
}

export function setDottedRecordValue(
  target: Record<string, unknown>,
  pathSegments: readonly string[],
  value: unknown,
  unsafeLeafInt?: bigint | undefined,
): boolean {
  if (pathSegments.length === 0 || pathSegments.some((seg) => FORBIDDEN_DOTTED_KEYS.has(seg))) {
    return false;
  }
  let cursor: Record<string, unknown> = target;
  for (let idx = 0; idx < pathSegments.length - 1; idx += 1) {
    const seg = pathSegments[idx]!;
    const existing = Object.hasOwn(cursor, seg) ? cursor[seg] : undefined;
    if (isRecord(existing)) {
      cursor = existing;
    } else {
      const next: Record<string, unknown> = {};
      defineOwnRecordField(cursor, seg, next);
      cursor = next;
    }
  }
  const leaf = pathSegments[pathSegments.length - 1]!;
  const prevLeaf = Object.hasOwn(cursor, leaf) ? cursor[leaf] : undefined;
  if (Array.isArray(prevLeaf) && Array.isArray(value)) {
    defineOwnRecordField(cursor, leaf, [...prevLeaf, ...value]);
    setUnsafeJsonInt(cursor, leaf, undefined);
  } else if (isRecord(prevLeaf) && isRecord(value)) {
    for (const [k, v] of Object.entries(value)) {
      setDottedRecordValue(prevLeaf, [k], v, getUnsafeJsonInt(value, k));
    }
  } else {
    defineOwnRecordField(cursor, leaf, value);
    setUnsafeJsonInt(cursor, leaf, unsafeLeafInt);
  }
  return true;
}

function buildExportedSnapshot(
  shellVars: Readonly<Record<string, string>>,
  exportedNames: ReadonlySet<string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of exportedNames) {
    if (Object.hasOwn(shellVars, name) && shellVars[name] !== undefined) {
      out[name] = shellVars[name]!;
    }
  }
  return out;
}

function findServeTokens(statements: readonly ShellStatement[]): {
  serveTokens: string[];
  envVars: Record<string, string>;
  shellPreamble: string[];
  matchedStatementIndex: number;
} {
  const shellVars: Record<string, string> = {};
  const exportedNames = new Set<string>();
  const unsetNames = new Set<string>();
  let allExport = false;
  let lastExitStatus = 0;
  let matchedEnvVars: Record<string, string> | null = null;
  let matchedStatementIndex = -1;
  const shellPreamble: string[] = [];
  let serveTokens: string[] = [];

  for (let stmtIdx = 0; stmtIdx < statements.length; stmtIdx += 1) {
    const stmt = statements[stmtIdx]!;
    if (stmt.leadingConj === "&&" && lastExitStatus !== 0) continue;
    if (stmt.leadingConj === "||" && lastExitStatus === 0) continue;

    const isSubshell = stmt.terminator === "&";
    const curVars: Record<string, string> = isSubshell ? { ...shellVars } : shellVars;
    const curExported: Set<string> = isSubshell ? new Set(exportedNames) : exportedNames;
    const curUnset: Set<string> = isSubshell ? new Set(unsetNames) : unsetNames;
    let curAllExport = allExport;
    const setCurVar = (name: string, val: string): void => {
      curVars[name] = val;
      curUnset.delete(name);
      if (curAllExport) curExported.add(name);
    };
    if (isSubshell) lastExitStatus = 0;

    const rawWords = stmt.rawWords;
    if (rawWords.length === 0) continue;

    // POSIX §2.9.1: identify leading unquoted ASSIGNMENT_WORDs purely lexically BEFORE any word expansion
    let idx = 0;
    while (idx < rawWords.length && RAW_SHELL_ASSIGN_RE.test(rawWords[idx] ?? "")) {
      idx += 1;
    }

    if (idx === rawWords.length) {
      // Standalone variable assignment(s): evaluate & commit left-to-right directly on curVars
      for (let i = 0; i < rawWords.length; i += 1) {
        const m = RAW_SHELL_ASSIGN_RE.exec(rawWords[i] ?? "");
        if (!m?.[1]) continue;
        const val = expandShellWord(m[2] ?? "", curVars, setCurVar, false, 0, curUnset);
        setCurVar(m[1], val);
      }
      if (!isSubshell) lastExitStatus = 0;
      continue;
    }

    // Check if rawWords[idx] is the literal `export` declaration utility (whose assignment args do not IFS-split)
    const cmdRawWord = rawWords[idx] ?? "";
    const cmdFields = expandShellWordToFields(cmdRawWord, curVars, setCurVar, curUnset);
    if (cmdFields.length === 1 && cmdFields[0] === "export" && idx < rawWords.length) {
      const expandedExportArgs: Array<{ rw: string; expanded: string }> = [];
      for (let i = idx + 1; i < rawWords.length; i += 1) {
        const rw = rawWords[i] ?? "";
        if (RAW_SHELL_ASSIGN_RE.test(rw)) {
          expandedExportArgs.push({
            rw,
            expanded: expandShellWord(rw, curVars, setCurVar, false, 0, curUnset),
          });
        } else {
          for (const f of expandShellWordToFields(rw, curVars, setCurVar, curUnset)) {
            expandedExportArgs.push({ rw, expanded: f });
          }
        }
      }
      // POSIX §2.14: variable assignments preceding special built-in `export` persist in curVars
      for (let i = 0; i < idx; i += 1) {
        const m = RAW_SHELL_ASSIGN_RE.exec(rawWords[i] ?? "");
        if (!m?.[1]) continue;
        const val = expandShellWord(m[2] ?? "", curVars, setCurVar, false, 0, curUnset);
        setCurVar(m[1], val);
      }
      let removeExport = false;
      for (let i = 0; i < expandedExportArgs.length; i += 1) {
        const { rw, expanded } = expandedExportArgs[i]!;
        if (i === 0 && expanded === "-n") {
          removeExport = true;
          continue;
        }
        if (expanded === "-p" || expanded === "--") continue;
        const assignMatch = ENV_ASSIGN_RE.exec(expanded);
        if (assignMatch?.[1] && (RAW_SHELL_ASSIGN_RE.test(rw) || assignMatch[1].length > 0)) {
          const name = assignMatch[1];
          curVars[name] = assignMatch[2] ?? "";
          curUnset.delete(name);
          if (removeExport) curExported.delete(name);
          else curExported.add(name);
          continue;
        }
        if (VALID_IDENT_RE.test(expanded)) {
          if (removeExport) curExported.delete(expanded);
          else curExported.add(expanded);
        }
      }
      if (!isSubshell) lastExitStatus = 0;
      continue;
    }

    // POSIX §2.9.1 Step 1: Expand command word & arguments FIRST against curVars (with IFS field splitting!)
    const expandedWords: string[] = [
      ...cmdFields,
      ...rawWords.slice(idx + 1).flatMap((w) => expandShellWordToFields(w, curVars, setCurVar, curUnset)),
    ];

    if (expandedWords.length === 0) {
      for (let i = 0; i < idx; i += 1) {
        const m = RAW_SHELL_ASSIGN_RE.exec(rawWords[i] ?? "");
        if (!m?.[1]) continue;
        const val = expandShellWord(m[2] ?? "", curVars, setCurVar, false, 0, curUnset);
        setCurVar(m[1], val);
      }
      if (!isSubshell) lastExitStatus = 0;
      continue;
    }

    const firstCmd = expandedWords[0] ?? "";
    if (firstCmd === "set") {
      for (let i = 0; i < idx; i += 1) {
        const m = RAW_SHELL_ASSIGN_RE.exec(rawWords[i] ?? "");
        if (!m?.[1]) continue;
        const val = expandShellWord(m[2] ?? "", curVars, setCurVar, false, 0, curUnset);
        setCurVar(m[1], val);
      }
      const setArgs = expandedWords.slice(1);
      for (let i = 0; i < setArgs.length; i += 1) {
        const arg = setArgs[i] ?? "";
        if (arg === "--" || arg === "-" || arg === "+") break;
        if (/^[-+][A-Za-z]+$/.test(arg)) {
          const enable = arg[0] === "-";
          for (let cIdx = 1; cIdx < arg.length; cIdx += 1) {
            const ch = arg[cIdx];
            if (ch === "a") {
              curAllExport = enable;
              if (!isSubshell) allExport = enable;
            } else if (ch === "o") {
              if (i + 1 < setArgs.length) {
                if (setArgs[i + 1] === "allexport") {
                  curAllExport = enable;
                  if (!isSubshell) allExport = enable;
                }
                i += 1;
              }
            }
          }
          continue;
        }
        break;
      }
      shellPreamble.push(stmt.raw);
      if (!isSubshell) lastExitStatus = 0;
      continue;
    }

    if (firstCmd === "unset") {
      for (let i = 0; i < idx; i += 1) {
        const m = RAW_SHELL_ASSIGN_RE.exec(rawWords[i] ?? "");
        if (!m?.[1]) continue;
        const val = expandShellWord(m[2] ?? "", curVars, setCurVar, false, 0, curUnset);
        setCurVar(m[1], val);
      }
      let unsetVarMode = true;
      let parsingUnsetOpts = true;
      for (const expanded of expandedWords.slice(1)) {
        if (parsingUnsetOpts && expanded === "--") {
          parsingUnsetOpts = false;
          continue;
        }
        if (parsingUnsetOpts && /^-[vf]+$/.test(expanded)) {
          unsetVarMode = !expanded.endsWith("f");
          continue;
        }
        parsingUnsetOpts = false;
        if (unsetVarMode && VALID_IDENT_RE.test(expanded)) {
          delete curVars[expanded];
          curExported.delete(expanded);
          curUnset.add(expanded);
        }
      }
      if (!isSubshell) lastExitStatus = 0;
      continue;
    }

    // POSIX §2.9.1 Step 2: Expand prefix assignments left-to-right into childEnv
    const assignEnv: Record<string, string> = { ...curVars };
    const cmdUnsetNames = new Set<string>(curUnset);
    const childEnv = buildExportedSnapshot(curVars, curExported);
    const onPrefixSideEffect = (k: string, v: string): void => {
      assignEnv[k] = v;
      cmdUnsetNames.delete(k);
      setCurVar(k, v);
      if (curExported.has(k) || Object.hasOwn(childEnv, k)) childEnv[k] = v;
    };
    for (let i = 0; i < idx; i += 1) {
      const m = RAW_SHELL_ASSIGN_RE.exec(rawWords[i] ?? "");
      if (!m?.[1]) continue;
      const val = expandShellWord(m[2] ?? "", assignEnv, onPrefixSideEffect, false, 0, cmdUnsetNames);
      assignEnv[m[1]] = val;
      cmdUnsetNames.delete(m[1]);
      childEnv[m[1]] = val;
    }

    // Unwrap nohup [--] / setsid [OPTION]... [--] / env [OPTION]... [NAME=VALUE]...
    let wIdx = 0;
    while (wIdx < expandedWords.length) {
      const w = expandedWords[wIdx] ?? "";
      if (w === "nohup") {
        wIdx += 1;
        if (expandedWords[wIdx] === "--") wIdx += 1;
        continue;
      }
      if (w === "setsid") {
        wIdx += 1;
        while (wIdx < expandedWords.length) {
          const sw = expandedWords[wIdx] ?? "";
          if (sw === "--") {
            wIdx += 1;
            break;
          }
          if (/^-[cfw]+$/.test(sw) || sw === "--ctty" || sw === "--fork" || sw === "--wait") {
            wIdx += 1;
            continue;
          }
          break;
        }
        continue;
      }
      if (w === "env") {
        wIdx += 1;
        let parsingEnvOpts = true;
        while (wIdx < expandedWords.length) {
          const ew = expandedWords[wIdx] ?? "";
          if (parsingEnvOpts && (ew === "-i" || ew === "--ignore-environment" || ew === "-")) {
            for (const k of Object.keys(childEnv)) delete childEnv[k];
            wIdx += 1;
            continue;
          }
          if (parsingEnvOpts && ew === "-u" && wIdx + 1 < expandedWords.length) {
            delete childEnv[expandedWords[wIdx + 1] ?? ""];
            wIdx += 2;
            continue;
          }
          if (parsingEnvOpts && ew.startsWith("--unset=")) {
            delete childEnv[ew.slice("--unset=".length)];
            wIdx += 1;
            continue;
          }
          if (parsingEnvOpts && ew === "--") {
            parsingEnvOpts = false;
            wIdx += 1;
            continue;
          }
          const em = ENV_ASSIGN_RE.exec(ew);
          if (em?.[1]) {
            childEnv[em[1]] = em[2] ?? "";
            wIdx += 1;
            continue;
          }
          break;
        }
        continue;
      }
      break;
    }

    const rest = stripShellRedirections(expandedWords.slice(wIdx));
    const head = rest[0] ?? "";
    const second = rest[1] ?? "";
    const isVllmServe = head === "vllm" && second === "serve";
    const isPythonApiServer =
      (head === "python" || head === "python3") &&
      second === "-m" &&
      (rest[2] === "vllm.entrypoints.openai.api_server" || rest[2] === "vllm.entrypoints.cli.main");
    const isBareFlags = head.startsWith("-");

    if (isVllmServe || isPythonApiServer || isBareFlags) {
      matchedEnvVars = childEnv;
      matchedStatementIndex = stmtIdx;
      if (isVllmServe) {
        serveTokens = rest.slice(2);
      } else if (isPythonApiServer) {
        serveTokens =
          rest[2] === "vllm.entrypoints.cli.main" && rest[3] === "serve" ? rest.slice(4) : rest.slice(3);
      } else {
        serveTokens = rest;
      }
      if (!isSubshell) lastExitStatus = 0;
    } else {
      shellPreamble.push(stmt.raw);
      if (!isSubshell) lastExitStatus = firstCmd === "false" ? 1 : 0;
    }
  }

  return {
    serveTokens,
    envVars: matchedEnvVars ?? buildExportedSnapshot(shellVars, exportedNames),
    shellPreamble,
    matchedStatementIndex,
  };
}

function describeAscendFieldSpec(spec: AscendFieldPrimitiveSpec): string {
  if (typeof spec === "string") return spec;
  if ("intEnum" in spec) return `整数枚举 ${JSON.stringify(spec.intEnum)}`;
  if ("optStrEnum" in spec) return `可选字符串枚举 ${JSON.stringify(spec.optStrEnum)} 或 null`;
  return `枚举值 ${JSON.stringify(spec)}`;
}

function matchesAscendFieldPrimitive(val: unknown, spec: AscendFieldPrimitiveSpec): boolean {
  if (typeof spec !== "string") {
    if ("intEnum" in spec) {
      const parsed = parsePydanticLaxInt(val);
      return parsed !== undefined && spec.intEnum.includes(parsed);
    }
    if ("optStrEnum" in spec) {
      return val === null || (typeof val === "string" && spec.optStrEnum.includes(val));
    }
    return (spec as readonly unknown[]).includes(val);
  }
  switch (spec) {
    case "bool":
      return parsePydanticLaxBool(val) !== undefined;
    case "strictBool":
      return typeof val === "boolean";
    case "optBool":
      return val === null || parsePydanticLaxBool(val) !== undefined;
    case "int":
      return parsePydanticLaxBigInt(val) !== undefined;
    case "noBoolInt":
      return typeof val !== "boolean" && parsePydanticLaxBigInt(val) !== undefined;
    case "optInt":
      return val === null || parsePydanticLaxBigInt(val) !== undefined;
    case "float":
      return parsePydanticLaxFloat(val) !== undefined;
    case "noBoolFloat":
      return parsePydanticNoBoolFloat(val) !== undefined;
    case "str":
      return typeof val === "string";
    case "optStr":
      return val === null || typeof val === "string";
    case "list":
      return Array.isArray(val);
    case "dict":
      return isRecord(val);
    case "optDict":
      return val === null || isRecord(val);
  }
}

function validateRecordFieldTypes(
  record: Record<string, unknown>,
  flagPath: string,
  specs: Readonly<Record<string, AscendFieldPrimitiveSpec>>,
  diagnostics: CliParseDiagnostic[],
): void {
  for (const [k, spec] of Object.entries(specs)) {
    if (!Object.hasOwn(record, k) || record[k] === undefined) continue;
    const fullFlag = `${flagPath}.${k}`;
    if (diagnostics.some((d) => d.flag === fullFlag)) continue;
    const val = record[k];
    if (!matchesAscendFieldPrimitive(val, spec)) {
      const expectedDesc = describeAscendFieldSpec(spec);
      diagnostics.push({
        code: "parse-invalid-json-type",
        severity: "error",
        flag: fullFlag,
        message: `ValidationError: ${fullFlag} 字段类型或枚举值非法（期望 ${expectedDesc}，收到 ${JSON.stringify(val)}）。`,
        remediation: `请按上游 AscendConfig 字段类型修正 ${fullFlag}。`,
      });
    }
  }
}

function pushRangeError(
  diagnostics: CliParseDiagnostic[],
  flag: string,
  constraintDesc: string,
  val: unknown,
): void {
  if (diagnostics.some((d) => d.flag === flag)) return;
  const formattedVal = typeof val === "bigint" ? val.toString() : JSON.stringify(val);
  diagnostics.push({
    code: "parse-invalid-range",
    severity: "error",
    flag,
    message: `ValidationError: ${flag} 超出上游取值约束（要求 ${constraintDesc}，收到 ${formattedVal}）。`,
    remediation: `请按上游校验规则调整 ${flag}（${constraintDesc}）。`,
  });
}

function readPydanticLaxBigIntField(holder: Record<string, unknown>, key: string): bigint | undefined {
  const exact = getUnsafeJsonInt(holder, key);
  if (exact !== undefined) return exact;
  return parsePydanticLaxBigInt(holder[key]);
}

function readPydanticNoBoolBigIntField(holder: Record<string, unknown>, key: string): bigint | undefined {
  if (typeof holder[key] === "boolean") return undefined;
  const exact = getUnsafeJsonInt(holder, key);
  if (exact !== undefined) return exact;
  return parsePydanticNoBoolBigInt(holder[key]);
}

function readRforkIntField(
  holder: Record<string, unknown>,
  key: string,
  flagPath: string,
  diagnostics: CliParseDiagnostic[],
): bigint | undefined {
  if (!Object.hasOwn(holder, key) || holder[key] === undefined) return undefined;
  const exact = getUnsafeJsonInt(holder, key);
  if (exact !== undefined) return exact;
  const parsed = parsePythonBuiltinBigInt(holder[key]);
  if (parsed === "invalid") {
    const fullFlag = `${flagPath}.${key}`;
    if (!diagnostics.some((d) => d.flag === fullFlag)) {
      diagnostics.push({
        code: "parse-invalid-json-type",
        severity: "error",
        flag: fullFlag,
        message: `ValueError / TypeError: ${fullFlag} 无法通过 Python int() 解析（收到 ${JSON.stringify(holder[key])}）。`,
      });
    }
    return undefined;
  }
  return parsed;
}

function readRforkFloatField(
  holder: Record<string, unknown>,
  key: string,
  flagPath: string,
  diagnostics: CliParseDiagnostic[],
): number | undefined {
  if (!Object.hasOwn(holder, key) || holder[key] === undefined) return undefined;
  const parsed = parsePythonBuiltinFloat(holder[key]);
  if (parsed === "invalid") {
    const fullFlag = `${flagPath}.${key}`;
    if (!diagnostics.some((d) => d.flag === fullFlag)) {
      diagnostics.push({
        code: "parse-invalid-json-type",
        severity: "error",
        flag: fullFlag,
        message: `ValueError / TypeError: ${fullFlag} 无法通过 Python float() 解析（收到 ${JSON.stringify(holder[key])}）。`,
      });
    }
    return undefined;
  }
  return parsed;
}

function validateAscendModelValidatorRanges(
  effectiveAdditional: Readonly<Record<string, unknown>>,
  sched: Record<string, unknown> | null,
  resolveSchedHolder: (key: string) => { holder: Record<string, unknown>; flagPath: string } | null,
  version: RuleVersion,
  envVars: Readonly<Record<string, string>>,
  rawMegaFloatLiteral: string | undefined,
  diagnostics: CliParseDiagnostic[],
): void {
  const isRfork = version === "rfork";
  const rawDump = effectiveAdditional.dump_config;
  const rawDumpPath = effectiveAdditional.dump_config_path;
  if (rawDump !== undefined && rawDump !== null && !isRecord(rawDump)) {
    diagnostics.push({
      code: "parse-invalid-json-type",
      severity: "error",
      flag: "additional_config.dump_config",
      message: `ValueError: additional_config.dump_config 必须为字典对象，收到 ${JSON.stringify(rawDump)}。`,
    });
  }
  if (rawDumpPath !== undefined && rawDumpPath !== null && typeof rawDumpPath !== "string") {
    diagnostics.push({
      code: "parse-invalid-json-type",
      severity: "error",
      flag: "additional_config.dump_config_path",
      message: `ValueError: additional_config.dump_config_path 必须为字符串，收到 ${JSON.stringify(rawDumpPath)}。`,
    });
  }
  if (rawDump !== undefined && rawDump !== null && rawDumpPath !== undefined && rawDumpPath !== null) {
    diagnostics.push({
      code: "parse-invalid-json-type",
      severity: "error",
      flag: "additional_config.dump_config",
      message:
        "ValueError: additional_config.dump_config 与 additional_config.dump_config_path 互斥，不能同时非空。",
      remediation: "请仅保留 dump_config 或 dump_config_path 其中之一。",
    });
  }

  if (
    Object.hasOwn(effectiveAdditional, "mega_moe_max_tokens") &&
    effectiveAdditional.mega_moe_max_tokens !== undefined
  ) {
    const rawMega = effectiveAdditional.mega_moe_max_tokens;
    if (
      isRfork &&
      (rawMegaFloatLiteral !== undefined ||
        (typeof rawMega !== "boolean" && !(typeof rawMega === "number" && Number.isInteger(rawMega))))
    ) {
      diagnostics.push({
        code: "parse-invalid-json-type",
        severity: "error",
        flag: "additional_config.mega_moe_max_tokens",
        message: `ValueError: additional_config.mega_moe_max_tokens 必须为整数，收到 ${rawMegaFloatLiteral ?? JSON.stringify(rawMega)}。`,
      });
    } else {
      const megaMax = readPydanticLaxBigIntField(
        effectiveAdditional as Record<string, unknown>,
        "mega_moe_max_tokens",
      );
      if (megaMax !== undefined && (version === "main" ? megaMax < 0n : megaMax <= 0n)) {
        pushRangeError(
          diagnostics,
          "additional_config.mega_moe_max_tokens",
          version === "main" ? ">= 0" : "> 0",
          megaMax,
        );
      }
    }
  }

  if (
    isRfork &&
    !pythonTruthiness(effectiveAdditional.enable_mc2_hierarchy_comm) &&
    Object.hasOwn(effectiveAdditional, "mc2_comm_alg") &&
    effectiveAdditional.mc2_comm_alg !== undefined
  ) {
    const alg = effectiveAdditional.mc2_comm_alg;
    if (alg !== "" && alg !== "fullmesh" && alg !== "hierarchy" && alg !== "fullmesh_v2") {
      diagnostics.push({
        code: "parse-invalid-json-type",
        severity: "error",
        flag: "additional_config.mc2_comm_alg",
        message: `ValueError: additional_config.mc2_comm_alg 仅允许 "" / "fullmesh" / "hierarchy" / "fullmesh_v2"，收到 ${JSON.stringify(alg)}。`,
      });
    }
  }

  const eplb = effectiveAdditional.eplb_config;
  if (isRecord(eplb)) {
    if (isRfork) {
      validateSubConfigKeys(eplb, "additional_config.eplb_config", VALID_RFORK_EPLB_KEYS, diagnostics);
      if (Object.hasOwn(eplb, "eplb_policy_type") && eplb.eplb_policy_type !== undefined) {
        const rawPolicy = eplb.eplb_policy_type;
        const policyNum =
          typeof rawPolicy === "boolean"
            ? rawPolicy
              ? 1
              : 0
            : typeof rawPolicy === "number"
              ? rawPolicy
              : Number.NaN;
        if (![0, 1, 2, 3].includes(policyNum)) {
          pushRangeError(
            diagnostics,
            "additional_config.eplb_config.eplb_policy_type",
            "[0, 1, 2, 3]",
            rawPolicy,
          );
        }
      }
      if (
        Object.hasOwn(eplb, "eplb_heat_collection_stage") &&
        eplb.eplb_heat_collection_stage !== undefined &&
        !["all", "prefill", "decode"].includes(eplb.eplb_heat_collection_stage as string)
      ) {
        pushRangeError(
          diagnostics,
          "additional_config.eplb_config.eplb_heat_collection_stage",
          '["all", "prefill", "decode"]',
          eplb.eplb_heat_collection_stage,
        );
      }
    }
    for (const pathKey of ["expert_map_path", "expert_map_record_path"] as const) {
      const pVal = eplb[pathKey];
      if (typeof pVal === "string" && !pVal.endsWith(".json")) {
        const flag = `additional_config.eplb_config.${pathKey}`;
        if (!diagnostics.some((d) => d.flag === flag)) {
          diagnostics.push({
            code: "parse-invalid-json-type",
            severity: "error",
            flag,
            message: `TypeError: ${flag} 必须以 .json 结尾（收到 ${JSON.stringify(pVal)}）。`,
          });
        }
      }
    }
    for (const k of [
      "expert_heat_collection_interval",
      "algorithm_execution_interval",
      "num_redundant_experts",
    ] as const) {
      if (
        isRfork &&
        Object.hasOwn(eplb, k) &&
        eplb[k] !== undefined &&
        typeof eplb[k] !== "boolean" &&
        !(typeof eplb[k] === "number" && Number.isInteger(eplb[k]))
      ) {
        diagnostics.push({
          code: "parse-invalid-json-type",
          severity: "error",
          flag: `additional_config.eplb_config.${k}`,
          message: `TypeError: additional_config.eplb_config.${k} 必须为整数，收到 ${JSON.stringify(eplb[k])}。`,
        });
        continue;
      }
      const n = readPydanticLaxBigIntField(eplb, k);
      if (n !== undefined && n < 0n) {
        pushRangeError(diagnostics, `additional_config.eplb_config.${k}`, ">= 0", n);
      }
    }
    const effectiveDynEplb =
      (isRfork ? pythonTruthiness(eplb.dynamic_eplb) : parsePydanticLaxBool(eplb.dynamic_eplb) === true) ||
      (eplb.expert_map_record_path !== undefined && eplb.expert_map_record_path !== null);
    if (effectiveDynEplb) {
      const dynEnvOk =
        /^(?:true|1)$/i.test(envVars.DYNAMIC_EPLB ?? "false") ||
        (envVars.EXPERT_MAP_RECORD ?? "false") === "true";
      if (!dynEnvOk) {
        pushRangeError(
          diagnostics,
          "additional_config.eplb_config.dynamic_eplb",
          "必须同时导出 DYNAMIC_EPLB=true/1 或 EXPERT_MAP_RECORD=true",
          eplb.dynamic_eplb ?? true,
        );
      }
    }
    const stair = !isRfork ? eplb.stair_config : undefined;
    if (isRecord(stair)) {
      const sBase = "additional_config.eplb_config.stair_config";
      const bins = readPydanticNoBoolBigIntField(stair, "load_window_bins");
      if (bins !== undefined && (bins < 2n || bins > 256n)) {
        pushRangeError(diagnostics, `${sBase}.load_window_bins`, "2 <= x <= 256", bins);
      }
      const q = parsePydanticNoBoolFloat(stair.load_risk_quantile);
      if (q !== undefined && (!Number.isFinite(q) || !(q > 0.5 && q < 1))) {
        pushRangeError(diagnostics, `${sBase}.load_risk_quantile`, "0.5 < x < 1", q);
      }
      for (const tk of ["relative_balance_threshold", "absolute_balance_threshold"] as const) {
        const tv = parsePydanticNoBoolFloat(stair[tk]);
        if (tv !== undefined && (!Number.isFinite(tv) || !(tv > 0 && tv <= 1))) {
          pushRangeError(diagnostics, `${sBase}.${tk}`, "0 < x <= 1", tv);
        }
      }
      const rtl = readPydanticNoBoolBigIntField(stair, "rank_transfer_limit");
      if (rtl !== undefined && rtl !== -1n && rtl < 1n) {
        pushRangeError(diagnostics, `${sBase}.rank_transfer_limit`, "-1 或 >= 1", rtl);
      }
      const cntl = readPydanticNoBoolBigIntField(stair, "cross_node_transfer_limit");
      if (cntl !== undefined && cntl < -1n) {
        pushRangeError(diagnostics, `${sBase}.cross_node_transfer_limit`, ">= -1", cntl);
      }
      const stages = readPydanticNoBoolBigIntField(stair, "replica_search_num_stages");
      if (stages !== undefined && (stages < 1n || stages > 8n)) {
        pushRangeError(diagnostics, `${sBase}.replica_search_num_stages`, "1 <= x <= 8", stages);
      }
      const radius = readPydanticNoBoolBigIntField(stair, "replica_search_radius");
      if (radius !== undefined && (radius < 0n || radius > 32n)) {
        pushRangeError(diagnostics, `${sBase}.replica_search_radius`, "0 <= x <= 32", radius);
      }
      const beam = readPydanticNoBoolBigIntField(stair, "replica_search_beam_size");
      if (beam !== undefined && (beam < 1n || beam > 128n)) {
        pushRangeError(diagnostics, `${sBase}.replica_search_beam_size`, "1 <= x <= 128", beam);
      }
      const bt = readPydanticNoBoolBigIntField(stair, "placement_search_backtrack_limit");
      if (bt !== undefined && (bt < 0n || bt > 64n)) {
        pushRangeError(diagnostics, `${sBase}.placement_search_backtrack_limit`, "0 <= x <= 64", bt);
      }
    }
  }

  const rs = effectiveAdditional.rejection_sampler_config;
  if (isRfork && rs !== undefined && rs !== null && !isRecord(rs)) {
    diagnostics.push({
      code: "parse-invalid-json-type",
      severity: "error",
      flag: "additional_config.rejection_sampler_config",
      message: `ValidationError: additional_config.rejection_sampler_config 需要 JSON 对象，收到 ${JSON.stringify(rs)}。`,
    });
  } else if (isRecord(rs)) {
    if (isRfork) {
      for (const bk of ["enable_block_verify", "enable_entropy_verify"] as const) {
        if (Object.hasOwn(rs, bk) && rs[bk] !== undefined && typeof rs[bk] !== "boolean") {
          diagnostics.push({
            code: "parse-invalid-json-type",
            severity: "error",
            flag: `additional_config.rejection_sampler_config.${bk}`,
            message: `ValueError: rejection_sampler_config.${bk} 在 rfork 中必须为严格 bool，收到 ${JSON.stringify(rs[bk])}。`,
          });
        }
      }
      for (const fk of ["posterior_threshold", "posterior_alpha"] as const) {
        if (
          Object.hasOwn(rs, fk) &&
          rs[fk] !== undefined &&
          typeof rs[fk] !== "number" &&
          typeof rs[fk] !== "boolean"
        ) {
          diagnostics.push({
            code: "parse-invalid-json-type",
            severity: "error",
            flag: `additional_config.rejection_sampler_config.${fk}`,
            message: `ValueError: rejection_sampler_config.${fk} 在 rfork 中必须为数值，收到 ${JSON.stringify(rs[fk])}。`,
          });
        }
      }
    }
    if (version === "main" && parsePydanticLaxBool(rs.enable_block_verify) === true) {
      pushRangeError(
        diagnostics,
        "additional_config.rejection_sampler_config.enable_block_verify",
        "main 分支已移除 Block Verify，仅允许 false",
        rs.enable_block_verify,
      );
    }
    const pt = parsePydanticLaxFloat(rs.posterior_threshold);
    if (pt !== undefined && !(pt > 0 && pt <= 1)) {
      pushRangeError(
        diagnostics,
        "additional_config.rejection_sampler_config.posterior_threshold",
        "0 < x <= 1",
        pt,
      );
    }
    const pa = parsePydanticLaxFloat(rs.posterior_alpha);
    if (pa !== undefined && pa < 0) {
      pushRangeError(diagnostics, "additional_config.rejection_sampler_config.posterior_alpha", ">= 0", pa);
    }
  }

  const fgtp = effectiveAdditional.finegrained_tp_config;
  if (isRecord(fgtp) && !isRfork) {
    for (const k of [
      "oproj_tensor_parallel_size",
      "lmhead_tensor_parallel_size",
      "embedding_tensor_parallel_size",
      "mlp_tensor_parallel_size",
      "qkv_iproj_tensor_parallel_size",
    ] as const) {
      const n = readPydanticLaxBigIntField(fgtp, k);
      if (n !== undefined && n < 0n) {
        pushRangeError(diagnostics, `additional_config.finegrained_tp_config.${k}`, ">= 0", n);
      }
    }
  }

  if (version === "v0.30.0" || isRfork) {
    const profEntry = resolveSchedHolder("profiling_chunk_config");
    const prof =
      profEntry && isRecord(profEntry.holder.profiling_chunk_config)
        ? profEntry.holder.profiling_chunk_config
        : null;
    if (profEntry && prof) {
      const sf = isRfork
        ? readRforkFloatField(prof, "smooth_factor", profEntry.flagPath, diagnostics)
        : parsePydanticLaxFloat(prof.smooth_factor);
      if (sf !== undefined && !(sf > 0 && sf <= 1)) {
        pushRangeError(diagnostics, `${profEntry.flagPath}.smooth_factor`, "0 < x <= 1", sf);
      }
      const mc = isRfork
        ? readRforkIntField(prof, "min_chunk", profEntry.flagPath, diagnostics)
        : readPydanticLaxBigIntField(prof, "min_chunk");
      if (mc !== undefined && mc <= 0n) {
        pushRangeError(diagnostics, `${profEntry.flagPath}.min_chunk`, "> 0", mc);
      }
      const mfc = isRfork
        ? readRforkIntField(prof, "max_fit_chunk", profEntry.flagPath, diagnostics)
        : readPydanticLaxBigIntField(prof, "max_fit_chunk");
      if (mfc !== undefined && mfc <= 5n) {
        pushRangeError(diagnostics, `${profEntry.flagPath}.max_fit_chunk`, "> 5", mfc);
      }
    }
  }

  const bjsEntry = resolveSchedHolder("batch_job_sched_config");
  const bjs =
    bjsEntry && isRecord(bjsEntry.holder.batch_job_sched_config)
      ? bjsEntry.holder.batch_job_sched_config
      : null;
  if (bjsEntry && bjs) {
    for (const k of ["max_jobs", "reserve_margin_blocks"] as const) {
      const n = isRfork
        ? readRforkIntField(bjs, k, bjsEntry.flagPath, diagnostics)
        : readPydanticLaxBigIntField(bjs, k);
      if (n !== undefined && n < 0n) pushRangeError(diagnostics, `${bjsEntry.flagPath}.${k}`, ">= 0", n);
    }
    for (const k of [
      "reserve_max_blocks",
      "low_available_tokens_threshold",
      "short_decode_token_threshold",
    ] as const) {
      const n = isRfork
        ? readRforkIntField(bjs, k, bjsEntry.flagPath, diagnostics)
        : readPydanticLaxBigIntField(bjs, k);
      if (n !== undefined && n <= 0n) pushRangeError(diagnostics, `${bjsEntry.flagPath}.${k}`, "> 0", n);
    }
  }

  const srfEntry = resolveSchedHolder("short_request_first_config");
  const srf =
    srfEntry && isRecord(srfEntry.holder.short_request_first_config)
      ? srfEntry.holder.short_request_first_config
      : null;
  if (srfEntry && srf && (!isRfork || pythonTruthiness(srf))) {
    const th = isRfork
      ? readRforkIntField(srf, "threshold", srfEntry.flagPath, diagnostics)
      : readPydanticLaxBigIntField(srf, "threshold");
    if (th !== undefined && th < 0n)
      pushRangeError(diagnostics, `${srfEntry.flagPath}.threshold`, ">= 0", th);
    const mw = isRfork
      ? readRforkFloatField(srf, "long_max_wait_ms", srfEntry.flagPath, diagnostics)
      : parsePydanticLaxFloat(srf.long_max_wait_ms);
    if (mw !== undefined && mw < 0)
      pushRangeError(diagnostics, `${srfEntry.flagPath}.long_max_wait_ms`, ">= 0", mw);
  }

  const dlb = !isRfork && sched && isRecord(sched.dyntra_lb_config) ? sched.dyntra_lb_config : null;
  if (dlb) {
    const dBase = "additional_config.scheduler_config.dyntra_lb_config";
    const ss = readPydanticLaxBigIntField(dlb, "start_step");
    if (ss !== undefined && ss < 0n) pushRangeError(diagnostics, `${dBase}.start_step`, ">= 0", ss);
    const es = readPydanticLaxBigIntField(dlb, "end_step");
    const effStart = ss ?? 250n;
    if (es !== undefined && es < -1n) {
      pushRangeError(diagnostics, `${dBase}.end_step`, "-1 或 >= 0", es);
    } else if (es !== undefined && es !== -1n && es <= effStart) {
      pushRangeError(diagnostics, `${dBase}.end_step`, `> start_step (${effStart})`, es);
    }
    const bt = parsePydanticLaxFloat(dlb.bubble_threshold);
    if (bt !== undefined && bt <= 0) pushRangeError(diagnostics, `${dBase}.bubble_threshold`, "> 0", bt);
    const lr = readPydanticLaxBigIntField(dlb, "long_req_block_threshold");
    if (lr !== undefined && lr <= 0n)
      pushRangeError(diagnostics, `${dBase}.long_req_block_threshold`, "> 0", lr);
    const dm = readPydanticLaxBigIntField(dlb, "dynamic_max_step");
    if (dm !== undefined && dm <= 0n) pushRangeError(diagnostics, `${dBase}.dynamic_max_step`, "> 0", dm);
  }

  const skv = effectiveAdditional.sparse_kv_offload_config;
  if (isRecord(skv) && (!isRfork || pythonTruthiness(skv.enabled))) {
    const sBase = "additional_config.sparse_kv_offload_config";
    const tbs = isRfork
      ? readRforkIntField(skv, "topk_buffer_size", sBase, diagnostics)
      : readPydanticLaxBigIntField(skv, "topk_buffer_size");
    if (tbs !== undefined && (isRfork ? tbs <= 0n : tbs !== -1n && tbs <= 0n)) {
      pushRangeError(diagnostics, `${sBase}.topk_buffer_size`, isRfork ? "> 0" : "-1 或 > 0", tbs);
    }
    if (isRfork) {
      readRforkIntField(skv, "dram_size_per_dp_GB", sBase, diagnostics);
    } else {
      const dram = readPydanticLaxBigIntField(skv, "dram_size_per_dp_GB");
      if (dram !== undefined && dram <= 0n) {
        pushRangeError(diagnostics, `${sBase}.dram_size_per_dp_GB`, "> 0", dram);
      }
      if (version === "main") {
        const spb = readPydanticLaxBigIntField(skv, "store_port_base");
        if (spb !== undefined && (spb < 1n || spb > 65535n)) {
          pushRangeError(diagnostics, `${sBase}.store_port_base`, "1 <= x <= 65535", spb);
        }
      }
    }
  }
}

function validateSubConfigKeys(
  record: Record<string, unknown>,
  flagPath: string,
  allowedKeys: ReadonlySet<string>,
  diagnostics: CliParseDiagnostic[],
  exemptKeys?: ReadonlySet<string>,
): void {
  const unknown = Object.keys(record)
    .filter((k) => !allowedKeys.has(k) && !exemptKeys?.has(k))
    .sort();
  if (unknown.length > 0) {
    diagnostics.push({
      code: "parse-invalid-json-type",
      severity: "error",
      flag: `${flagPath}.${unknown[0]}`,
      message: `ValidationError: ${flagPath} 包含未知子键（Pydantic extra="forbid" 拒收）：${unknown.join("、")}。`,
      remediation: `请从 ${flagPath} 中移除或修正拼写错误的子键：${unknown.join("、")}。`,
    });
  }
}

function parseEnabledSubConfig(
  holder: Record<string, unknown>,
  key: string,
  flagPath: string,
  diagnostics: CliParseDiagnostic[],
  isRfork: boolean,
  opts: {
    allowNullOnRfork?: boolean;
    allowFalsyOnRfork?: boolean;
    allowedSubKeys?: ReadonlySet<string>;
    enforceSubKeysOnRfork?: boolean;
  } = {},
): boolean {
  if (!Object.hasOwn(holder, key) || holder[key] === undefined) return false;
  const val = holder[key];
  if (isRfork && val === null && opts.allowNullOnRfork) {
    return false;
  }
  if (isRfork && !pythonTruthiness(val) && opts.allowFalsyOnRfork) {
    return false;
  }
  if (!isRecord(val)) {
    diagnostics.push({
      code: "parse-invalid-json-type",
      severity: "error",
      flag: flagPath,
      message: `ValidationError: ${flagPath} 需要 JSON 子配置对象（例如 '{"enabled":true}'），收到 ${JSON.stringify(val)}。`,
      remediation: `请使用合法的 JSON 对象传给 ${flagPath}。`,
    });
    return false;
  }
  if (opts.allowedSubKeys && (!isRfork || opts.enforceSubKeysOnRfork)) {
    validateSubConfigKeys(val, flagPath, opts.allowedSubKeys, diagnostics);
  }
  if (!Object.hasOwn(val, "enabled") || val.enabled === undefined) return false;
  if (isRfork) {
    return pythonTruthiness(val.enabled);
  }
  return parsePydanticBoolField(val, "enabled", `${flagPath}.enabled`, diagnostics) === true;
}

export interface ParseVllmServeOptions {
  version?: RuleVersion;
  vllmOmniAvailable?: boolean;
}

export function parseVllmServeCommand(
  rawText: string,
  options?: ParseVllmServeOptions,
): ParsedVllmServeCommand {
  const version: RuleVersion = options?.version ?? "v0.30.0";
  const isRfork = version === "rfork";
  const targetSchemaVersion: UpgradeTargetVersion = version === "main" ? "main" : "v0.30.0";
  const vllmOmniAvailable = options?.vllmOmniAvailable === true;
  const diagnostics: CliParseDiagnostic[] = [];
  const normalized = normalizeShellContinuations(rawText);
  const rawStmts = splitShellAstStatements(normalized);
  const statements = rawStmts.map((s) => tokenizeStatement(s, diagnostics));
  const { serveTokens, envVars, shellPreamble, matchedStatementIndex } = findServeTokens(statements);

  if (rawText.trim().length === 0) {
    diagnostics.push({
      code: "parse-empty-command",
      severity: "error",
      message: "未输入启动命令。请粘贴 `vllm serve ...` 命令或选择下方预设场景。",
    });
  }

  let model: string | null = null;
  let servedModelName: string | null = null;
  let port: number | null = null;
  let host: string | null = null;
  let distributedExecutorBackend: string | null = null;
  let loadFormat: string | null = null;
  let shutdownTimeout: number | undefined;
  let mambaCacheMode: string | undefined;
  let trustRemoteCode = false;
  let enforceEager = false;
  let enableSleepMode = false;
  let enablePrefixCaching: boolean | undefined;
  let gpuMemoryUtilization: number | undefined;
  let rawDtype: string | undefined;
  let rawQuantization: string | undefined;
  let rawKvCacheDtype: string | undefined;
  let tpSize: number | undefined;
  let ppSize: number | undefined;
  let dpSize: number | undefined;
  let dataParallelSizeLocal: number | undefined;
  let pcpSize: number | undefined;
  let dcpSize: number | undefined;
  let enableExpertParallel: boolean | undefined;
  let maxModelLen: number | undefined;
  let maxNumBatchedTokens: number | undefined;
  let maxNumSeqs: number | undefined;
  let blockSize: number | undefined;
  let userSpecifiedBlockSize = false;
  let enableChunkedPrefill: boolean | undefined;
  let performanceMode: "balanced" | "throughput" | "interactivity" | undefined;
  let isLoraEnabled: boolean | undefined;
  let attentionBackend: string | undefined;
  let useSequenceParallelMoe: boolean | undefined;
  let enableDbo: boolean | undefined;
  let ubatchSize: number | undefined;
  let regularHotReloadFloatLiteral: string | undefined;
  let dottedHotReloadFloatLiteral: string | undefined;
  let regularMegaFloatLiteral: string | undefined;
  let dottedMegaFloatLiteral: string | undefined;
  let regularAdditionalConfig: Record<string, unknown> | null = null;
  let dottedAdditionalConfig: Record<string, unknown> | null = null;
  let compilationConfig: Record<string, unknown> | null = null;
  let kvTransferConfig: Record<string, unknown> | null = null;
  let speculativeConfig: Record<string, unknown> | null = null;
  const unknownFlags: string[] = [];

  const readValue = (
    flag: string,
    inlineValue: string | undefined,
    i: number,
  ): [string | undefined, number] => {
    if (inlineValue !== undefined) return [inlineValue, i];
    const next = serveTokens[i + 1];
    if (next === undefined || (next.startsWith("-") && !/^-\d/.test(next))) {
      diagnostics.push({
        code: "parse-missing-flag-value",
        severity: "error",
        flag,
        message: `参数 ${flag} 缺少取值。`,
      });
      return [undefined, i];
    }
    return [next, i + 1];
  };

  for (let i = 0; i < serveTokens.length; i += 1) {
    const token = serveTokens[i] ?? "";
    if (!token.startsWith("-")) {
      if (model === null) model = token;
      continue;
    }

    const eqIdx = token.indexOf("=");
    const rawFlag = eqIdx > 0 ? token.slice(0, eqIdx) : token;
    const flag = normalizeCliFlag(rawFlag);
    const inlineVal = eqIdx > 0 ? token.slice(eqIdx + 1) : undefined;

    switch (flag) {
      case "--model": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) model = v;
        break;
      }
      case "--served-model-name": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) servedModelName = v;
        break;
      }
      case "-tp":
      case "--tensor-parallel-size": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) tpSize = parseIntegerFlag(flag, v, diagnostics, { min: 1 });
        break;
      }
      case "-pp":
      case "--pipeline-parallel-size": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) ppSize = parseIntegerFlag(flag, v, diagnostics, { min: 1 });
        break;
      }
      case "-dp":
      case "--data-parallel-size": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) dpSize = parseIntegerFlag(flag, v, diagnostics, { min: 1 });
        break;
      }
      case "-dpl":
      case "--data-parallel-size-local": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) dataParallelSizeLocal = parseIntegerFlag(flag, v, diagnostics, { min: 1 });
        break;
      }
      case "--pcp-size":
      case "--prefill-context-parallel-size": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) pcpSize = parseIntegerFlag(flag, v, diagnostics, { min: 1 });
        break;
      }
      case "--dcp-size":
      case "--decode-context-parallel-size": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) dcpSize = parseIntegerFlag(flag, v, diagnostics, { min: 1 });
        break;
      }
      case "--enable-expert-parallel":
        enableExpertParallel = inlineVal !== undefined ? (parseBoolLike(inlineVal) ?? true) : true;
        break;
      case "--no-enable-expert-parallel":
        enableExpertParallel = false;
        break;
      case "--max-model-len": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) {
          maxModelLen = parseIntegerFlag(flag, v, diagnostics, {
            min: 1,
            allowMinusOne: true,
            allowAuto: true,
            allowSuffix: true,
          });
        }
        break;
      }
      case "--max-num-batched-tokens": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) {
          maxNumBatchedTokens = parseIntegerFlag(flag, v, diagnostics, { min: 1, allowSuffix: true });
        }
        break;
      }
      case "--max-num-seqs": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) {
          maxNumSeqs = parseIntegerFlag(flag, v, diagnostics, { min: 1 });
        }
        break;
      }
      case "--gpu-memory-utilization": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) {
          gpuMemoryUtilization = parseFloatFlag(flag, v, diagnostics, { minExclusive: 0, maxInclusive: 1 });
        }
        break;
      }
      case "--dtype": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) rawDtype = v.trim().toLowerCase();
        break;
      }
      case "-q":
      case "--quantization": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) rawQuantization = v.trim().toLowerCase();
        break;
      }
      case "--kv-cache-dtype": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) rawKvCacheDtype = v.trim().toLowerCase();
        break;
      }
      case "--block-size": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) {
          blockSize = parseIntegerFlag(flag, v, diagnostics, { min: 1 });
          userSpecifiedBlockSize = true;
        }
        break;
      }
      case "--enable-chunked-prefill":
        enableChunkedPrefill = inlineVal !== undefined ? (parseBoolLike(inlineVal) ?? true) : true;
        break;
      case "--no-enable-chunked-prefill":
        enableChunkedPrefill = false;
        break;
      case "--enable-prefix-caching":
        enablePrefixCaching = inlineVal !== undefined ? (parseBoolLike(inlineVal) ?? true) : true;
        break;
      case "--no-enable-prefix-caching":
        enablePrefixCaching = false;
        break;
      case "--enforce-eager":
        enforceEager = inlineVal !== undefined ? (parseBoolLike(inlineVal) ?? true) : true;
        break;
      case "--no-enforce-eager":
        enforceEager = false;
        break;
      case "--enable-lora":
        isLoraEnabled = inlineVal !== undefined ? (parseBoolLike(inlineVal) ?? true) : true;
        break;
      case "--no-enable-lora":
        isLoraEnabled = false;
        break;
      case "--enable-sleep-mode":
        enableSleepMode = inlineVal !== undefined ? (parseBoolLike(inlineVal) ?? true) : true;
        break;
      case "--no-enable-sleep-mode":
        enableSleepMode = false;
        break;
      case "--trust-remote-code":
        trustRemoteCode = true;
        break;
      case "--performance-mode": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        const lower = v?.trim().toLowerCase();
        if (lower === "balanced" || lower === "throughput" || lower === "interactivity") {
          performanceMode = lower;
        }
        break;
      }
      case "--attention-backend": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) attentionBackend = v.trim().toUpperCase();
        break;
      }
      case "--use-sequence-parallel-moe":
        useSequenceParallelMoe = inlineVal !== undefined ? (parseBoolLike(inlineVal) ?? true) : true;
        break;
      case "--no-use-sequence-parallel-moe":
        useSequenceParallelMoe = false;
        break;
      case "--enable-dbo":
        enableDbo = inlineVal !== undefined ? (parseBoolLike(inlineVal) ?? true) : true;
        break;
      case "--no-enable-dbo":
        enableDbo = false;
        break;
      case "--ubatch-size": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) {
          ubatchSize = parseIntegerFlag(flag, v, diagnostics, { min: 0 });
        }
        break;
      }
      case "--distributed-executor-backend": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) distributedExecutorBackend = v.trim();
        break;
      }
      case "--load-format": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) loadFormat = v.trim();
        break;
      }
      case "--shutdown-timeout": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) {
          const parsedTimeout = parseIntegerFlag(flag, v, diagnostics, { min: 0 });
          if (parsedTimeout !== undefined) {
            shutdownTimeout = parsedTimeout;
          }
        }
        break;
      }
      case "--mamba-cache-mode": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) mambaCacheMode = v.trim().toLowerCase();
        break;
      }
      case "--host": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) host = v.trim();
        break;
      }
      case "--port": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) {
          port = parseIntegerFlag(flag, v, diagnostics, { min: 1, max: 65535 }) ?? null;
        }
        break;
      }
      case "--additional-config": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) {
          regularHotReloadFloatLiteral = extractTopLevelJsonFloatLiteral(v, "runtime_config_hot_reload");
          regularMegaFloatLiteral = extractTopLevelJsonFloatLiteral(v, "mega_moe_max_tokens");
          const parsedObj = parseJsonObjectFlag(flag, v, diagnostics);
          if (parsedObj) {
            regularAdditionalConfig = parsedObj;
          }
        }
        break;
      }
      case "-cc":
      case "--compilation-config": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) compilationConfig = parseJsonObjectFlag(flag, v, diagnostics);
        break;
      }
      case "--kv-transfer-config": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) kvTransferConfig = parseJsonObjectFlag(flag, v, diagnostics);
        break;
      }
      case "--speculative-config": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) speculativeConfig = parseJsonObjectFlag(flag, v, diagnostics);
        break;
      }
      default: {
        if (flag.startsWith("--additional-config.")) {
          let dottedPath = flag.slice("--additional-config.".length);
          const isListAppend = dottedPath.endsWith("+");
          if (isListAppend) dottedPath = dottedPath.slice(0, -1);
          const segments = dottedPath.split(".");
          const [v, ni] = readValue(flag, inlineVal, i);
          i = ni;
          if (v !== undefined && segments.length > 0) {
            if (segments.some((seg) => FORBIDDEN_DOTTED_KEYS.has(seg))) {
              diagnostics.push({
                code: "parse-invalid-json",
                severity: "error",
                flag,
                message: `非法配置键路径 '${dottedPath}'。`,
              });
              break;
            }
            if (!dottedAdditionalConfig) dottedAdditionalConfig = {};
            const floatLit = /^-?\d+(?:\.\d+(?:[eE][+-]?\d+)?|[eE][+-]?\d+)$/.test(v.trim())
              ? v.trim()
              : undefined;
            if (segments.length === 1 && segments[0] === "runtime_config_hot_reload") {
              dottedHotReloadFloatLiteral = floatLit;
            }
            if (segments.length === 1 && segments[0] === "mega_moe_max_tokens") {
              dottedMegaFloatLiteral = floatLit;
            }
            if (isListAppend) {
              setDottedRecordValue(dottedAdditionalConfig, segments, v.split(","));
            } else {
              const parsedScalar = parseDottedScalarOrJson(v);
              setDottedRecordValue(
                dottedAdditionalConfig,
                segments,
                parsedScalar.value,
                parsedScalar.unsafeInt,
              );
            }
          }
          break;
        }
        const isKnownNoArgBool =
          KNOWN_NO_ARG_BOOL_FLAGS.has(flag) || /^--(?:no-)?(?:enable|disable)-/.test(flag);
        if (!KNOWN_NO_ARG_BOOL_FLAGS.has(flag)) {
          unknownFlags.push(flag);
        }
        // Only consume a following non-flag token if the flag is not a no-arg boolean and does not steal <model>
        if (inlineVal === undefined && !isKnownNoArgBool) {
          const peek = serveTokens[i + 1];
          if (peek !== undefined && !peek.startsWith("-") && !(model === null && isLikelyModelArg(peek))) {
            i += 1;
          }
        }
        break;
      }
    }
  }

  // Validate VLLM_PORT if present in envVars (K8s tcp:// URI raises ValueError in vllm/envs.py#L710)
  if (Object.hasOwn(envVars, "VLLM_PORT")) {
    const rawVllmPort = (envVars.VLLM_PORT ?? "").trim();
    if (rawVllmPort.includes("://") || (rawVllmPort.length > 0 && !/^\d+$/.test(rawVllmPort))) {
      diagnostics.push({
        code: "parse-invalid-vllm-port",
        severity: "error",
        flag: "VLLM_PORT",
        message: `ValueError: VLLM_PORT='${rawVllmPort}' 非纯整数（Kubernetes 同名 Service 注入 tcp:// URI 会直接报错）。`,
        remediation: "取消 VLLM_PORT 环境变量或将其设为纯整数端口。",
      });
    }
  }

  const visibleDevices = parseVisibleDevices(envVars.ASCEND_RT_VISIBLE_DEVICES, diagnostics);
  const inferredHints = inferModelHints(model);

  // Assemble CouplingCheckInput from CLI flags + JSON configs + env vars + model hints
  const couplingInput: CouplingCheckInput = {
    usageContext: "vllm_serve",
    tpSize: tpSize ?? 1,
    ppSize: ppSize ?? 1,
    dpSize: dpSize ?? 1,
    pcpSize: pcpSize ?? 1,
    dcpSize: dcpSize ?? 1,
    userSpecifiedBlockSize,
    enableSleepMode,
    envVars,
  };

  if (inferredHints.isMoe !== undefined) couplingInput.isMoe = inferredHints.isMoe;
  if (inferredHints.hasRoutedExpertHiddenSize !== undefined) {
    couplingInput.hasRoutedExpertHiddenSize = inferredHints.hasRoutedExpertHiddenSize;
  }
  if (inferredHints.useMla !== undefined) couplingInput.useMla = inferredHints.useMla;
  if (inferredHints.usesSfaSparse !== undefined) {
    couplingInput.usesSfaSparse =
      isRfork && inferredHints.modelType === "glm5_next" ? true : inferredHints.usesSfaSparse;
  }
  if (inferredHints.hasCompressRatios !== undefined)
    couplingInput.hasCompressRatios = inferredHints.hasCompressRatios;
  if (inferredHints.indexTopk !== undefined) couplingInput.indexTopk = inferredHints.indexTopk;
  if (inferredHints.linearNumHeads !== undefined) couplingInput.linearNumHeads = inferredHints.linearNumHeads;
  if (inferredHints.isQwen35Dense !== undefined) couplingInput.isQwen35Dense = inferredHints.isQwen35Dense;
  if (inferredHints.modelType !== undefined) couplingInput.modelType = inferredHints.modelType;
  if (inferredHints.numExperts !== undefined) couplingInput.numExperts = inferredHints.numExperts;
  if (inferredHints.numExpertsPerTok !== undefined)
    couplingInput.numExpertsPerTok = inferredHints.numExpertsPerTok;
  if (inferredHints.numAttentionHeads !== undefined)
    couplingInput.numAttentionHeads = inferredHints.numAttentionHeads;
  if (inferredHints.numKvHeads !== undefined) couplingInput.numKvHeads = inferredHints.numKvHeads;
  if (inferredHints.headDim !== undefined) couplingInput.headDim = inferredHints.headDim;
  if (inferredHints.kvLoraRank !== undefined) couplingInput.kvLoraRank = inferredHints.kvLoraRank;
  if (inferredHints.qkRopeHeadDim !== undefined) couplingInput.qkRopeHeadDim = inferredHints.qkRopeHeadDim;

  const explicitDtype = normalizeModelDtype(rawDtype);
  if (explicitDtype !== undefined) {
    couplingInput.modelDtype = explicitDtype;
  } else if (inferredHints.defaultModelDtype !== undefined) {
    couplingInput.modelDtype = inferredHints.defaultModelDtype;
  }

  const effectiveQuant = rawQuantization ?? inferredHints.quantMethod;
  if (effectiveQuant !== undefined) couplingInput.quantMethod = effectiveQuant;
  if (inferredHints.quantScheme !== undefined) couplingInput.quantScheme = inferredHints.quantScheme;
  if (inferredHints.hasWeightBlockSize !== undefined)
    couplingInput.hasWeightBlockSize = inferredHints.hasWeightBlockSize;
  if (inferredHints.activationScheme !== undefined)
    couplingInput.activationScheme = inferredHints.activationScheme;
  if (inferredHints.enableC8Quant !== undefined) couplingInput.enableC8Quant = inferredHints.enableC8Quant;

  if (enableExpertParallel !== undefined) couplingInput.enableExpertParallel = enableExpertParallel;
  if (maxModelLen !== undefined && maxModelLen > 0) {
    couplingInput.maxModelLen = maxModelLen;
  } else if (inferredHints.defaultMaxModelLen !== undefined) {
    couplingInput.maxModelLen = inferredHints.defaultMaxModelLen;
  }
  if (maxNumBatchedTokens !== undefined) couplingInput.maxNumBatchedTokens = maxNumBatchedTokens;
  if (maxNumSeqs !== undefined) couplingInput.maxNumSeqs = maxNumSeqs;
  if (blockSize !== undefined) couplingInput.blockSize = blockSize;
  if (enableChunkedPrefill !== undefined) couplingInput.enableChunkedPrefill = enableChunkedPrefill;
  if (performanceMode !== undefined) couplingInput.performanceMode = performanceMode;
  if (isLoraEnabled !== undefined) couplingInput.isLoraEnabled = isLoraEnabled;
  // Upstream vllm FlexibleArgumentParser appends merged dotted --additional-config.<path> JSON at the end
  // of processed_args, so any dotted --additional-config.<path> replaces earlier --additional-config JSON.
  const additionalConfig: Record<string, unknown> | null = dottedAdditionalConfig ?? regularAdditionalConfig;
  const rawHotReloadFloatLiteral: string | undefined = dottedAdditionalConfig
    ? dottedHotReloadFloatLiteral
    : regularHotReloadFloatLiteral;
  const rawMegaFloatLiteral: string | undefined = dottedAdditionalConfig
    ? dottedMegaFloatLiteral
    : regularMegaFloatLiteral;
  const useUbatching: boolean | undefined =
    enableDbo === true || (ubatchSize !== undefined && ubatchSize > 1)
      ? true
      : enableDbo === false || ubatchSize !== undefined
        ? false
        : undefined;

  if (attentionBackend !== undefined) couplingInput.attentionBackend = attentionBackend;
  if (useSequenceParallelMoe !== undefined) couplingInput.useSequenceParallelMoe = useSequenceParallelMoe;
  if (useUbatching !== undefined) couplingInput.useUbatching = useUbatching;
  if (enableDbo !== undefined) couplingInput.enableDbo = enableDbo;
  if (ubatchSize !== undefined) couplingInput.ubatchSize = ubatchSize;
  if (rawKvCacheDtype !== undefined) couplingInput.cacheDtype = rawKvCacheDtype;
  if (loadFormat !== null) couplingInput.loadFormat = loadFormat.toLowerCase();
  couplingInput.shutdownTimeout = shutdownTimeout ?? 0;
  if (mambaCacheMode !== undefined) couplingInput.mambaCacheMode = mambaCacheMode;

  // Env-driven coupling fields (vllm/envs.py uses bool(int(val)) for VLLM_USE_V2_MODEL_RUNNER & VLLM_BATCH_INVARIANT)
  for (const [envKey, targetField] of [
    ["VLLM_USE_V2_MODEL_RUNNER", "useV2ModelRunner"],
    ["VLLM_BATCH_INVARIANT", "vllmBatchInvariant"],
  ] as const) {
    if (Object.hasOwn(envVars, envKey)) {
      const rawEnv = envVars[envKey];
      const b = parseEnvIntBool(rawEnv);
      if (b !== undefined) {
        couplingInput[targetField] = b;
      } else {
        diagnostics.push({
          code: "parse-invalid-number",
          severity: "error",
          flag: envKey,
          message: `ValueError: 环境变量 ${envKey}='${rawEnv ?? ""}' 非十进制整数（上游 vllm/envs.py 通过 bool(int(...)) 解析该变量，传入非整数将在启动时抛出 ValueError）。`,
          remediation: `请将 ${envKey} 设为 1 或 0，或取消设置该环境变量。`,
        });
      }
    }
  }
  if (Object.hasOwn(envVars, "PYTORCH_NPU_ALLOC_CONF")) {
    const npuAlloc = envVars.PYTORCH_NPU_ALLOC_CONF;
    if (npuAlloc !== undefined) couplingInput.pytorchNpuAllocConf = npuAlloc;
  }
  const envFc1Enabled = isRfork
    ? parseBoolLike(envVars.VLLM_ASCEND_ENABLE_FLASHCOMM1) === true
    : /^(?:1|true)$/i.test((envVars.VLLM_ASCEND_ENABLE_FLASHCOMM1 ?? "").trim());
  if (envFc1Enabled) {
    couplingInput.enableFlashcomm1 = true;
  }
  if (isRfork && Object.hasOwn(envVars, "VLLM_ASCEND_ENABLE_FUSED_MC2")) {
    const rawEnvFused = parsePythonBuiltinBigInt(envVars.VLLM_ASCEND_ENABLE_FUSED_MC2);
    if (rawEnvFused === 0n || rawEnvFused === 1n) {
      couplingInput.enableFusedMc2 = Number(rawEnvFused) as 0 | 1;
    } else if (rawEnvFused === "invalid") {
      diagnostics.push({
        code: "parse-invalid-number",
        severity: "error",
        flag: "VLLM_ASCEND_ENABLE_FUSED_MC2",
        message: `ValueError: VLLM_ASCEND_ENABLE_FUSED_MC2='${envVars.VLLM_ASCEND_ENABLE_FUSED_MC2 ?? ""}' 在 rfork 中必须为整数。`,
      });
    } else if (
      rawEnvFused !== undefined &&
      (!additionalConfig ||
        !Object.hasOwn(additionalConfig, "enable_fused_mc2") ||
        additionalConfig.enable_fused_mc2 === undefined)
    ) {
      diagnostics.push({
        code: "parse-invalid-range",
        severity: "error",
        flag: "VLLM_ASCEND_ENABLE_FUSED_MC2",
        message: `AssertionError: VLLM_ASCEND_ENABLE_FUSED_MC2 在 rfork 中仅允许 0 或 1（收到 ${rawEnvFused.toString()}）。`,
      });
    }
  }

  // Extract --compilation-config fields
  if (enforceEager) {
    couplingInput.cudagraphMode = "NONE";
  }
  if (compilationConfig) {
    const mode = normalizeCudaGraphMode(compilationConfig.cudagraph_mode);
    if (mode !== undefined) couplingInput.cudagraphMode = mode;
    if (Array.isArray(compilationConfig.cudagraph_capture_sizes)) {
      const sizes = compilationConfig.cudagraph_capture_sizes
        .map(parseNumberLike)
        .filter((n): n is number => n !== undefined);
      couplingInput.cudagraphCaptureSizes = sizes;
    }
    const maxCap = parseNumberLike(compilationConfig.max_cudagraph_capture_size);
    if (maxCap !== undefined) couplingInput.maxCudagraphCaptureSize = maxCap;
    if (Array.isArray(compilationConfig.custom_ops)) {
      couplingInput.customOps = compilationConfig.custom_ops.filter(
        (x): x is string => typeof x === "string",
      );
    }
    if (isRecord(compilationConfig.pass_config)) {
      const sp = parsePydanticBoolField(
        compilationConfig.pass_config,
        "enable_sp",
        "compilation_config.pass_config.enable_sp",
        diagnostics,
        { allowNull: true },
      );
      if (sp !== undefined) couplingInput.enableSp = sp;
    } else if (
      Object.hasOwn(compilationConfig, "pass_config") &&
      compilationConfig.pass_config !== undefined
    ) {
      diagnostics.push({
        code: "parse-invalid-json-type",
        severity: "error",
        flag: "compilation_config.pass_config",
        message: `ValidationError: compilation_config.pass_config 需要 PassConfig JSON 对象（不允许传 null），收到 ${JSON.stringify(compilationConfig.pass_config)}。`,
      });
    }
  }

  // Extract --additional-config fields
  if (additionalConfig) {
    const presentMainOnly = MAIN_ONLY_TOP_LEVEL_KEYS.filter((k) => Object.hasOwn(additionalConfig, k));
    if (presentMainOnly.length > 0) {
      couplingInput.mainOnlyAdditionalConfigKeys = presentMainOnly;
    }

    let effectiveAdditional: Readonly<Record<string, unknown>> = additionalConfig;
    if (!isRfork) {
      const hasExplicitTarget = options?.version !== undefined;
      const validTopKeys = hasExplicitTarget
        ? VALID_TOP_LEVEL_KEYS_BY_TARGET[targetSchemaVersion]
        : new Set([...VALID_TOP_LEVEL_KEYS_BY_TARGET["v0.30.0"], ...VALID_TOP_LEVEL_KEYS_BY_TARGET.main]);
      if (
        version === "main" &&
        !vllmOmniAvailable &&
        Object.hasOwn(additionalConfig, "profiling_chunk_config") &&
        additionalConfig.profiling_chunk_config !== undefined
      ) {
        couplingInput.profilingChunkConfigured = true;
      }
      const ruleHandledTopKeys = new Set<string>(
        version === "v0.30.0"
          ? MAIN_ONLY_TOP_LEVEL_KEYS
          : vllmOmniAvailable
            ? []
            : ["profiling_chunk_config"],
      );
      const unknownTopKeys = Object.keys(additionalConfig)
        .filter((k) => !validTopKeys.has(k) && !ruleHandledTopKeys.has(k))
        .sort();
      if (unknownTopKeys.length > 0) {
        diagnostics.push({
          code: "parse-invalid-json-type",
          severity: vllmOmniAvailable ? "warn" : "error",
          flag: `additional_config.${unknownTopKeys[0]}`,
          message: vllmOmniAvailable
            ? `当前环境检测到 vllm_omni：init_ascend_config 会打印告警并从 AscendConfig 剥离未知顶层键（对应特性在 vLLM-Ascend 中不生效）：${unknownTopKeys.join("、")}。`
            : `ValidationError: additional_config 包含未知顶层键（Pydantic extra="forbid" 拒收）：${unknownTopKeys.join("、")}。`,
          remediation: `请从 --additional-config 顶层移除或修正键名：${unknownTopKeys.join("、")}。`,
        });
      }
      if (hasExplicitTarget) {
        const filtered: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(additionalConfig)) {
          if (validTopKeys.has(k)) {
            defineOwnRecordField(filtered, k, v);
            setUnsafeJsonInt(filtered, k, getUnsafeJsonInt(additionalConfig, k));
          }
        }
        effectiveAdditional = filtered;
      }
      for (const [subName, subValidKeys] of [
        ["ascend_fusion_config", VALID_ASCEND_FUSION_KEYS],
        ["ascend_warmup_config", VALID_ASCEND_WARMUP_KEYS],
        ["eplb_config", VALID_EPLB_KEYS],
        ["rejection_sampler_config", VALID_REJECTION_SAMPLER_KEYS],
        ["dynamic_spec_config", VALID_DYNAMIC_SPEC_KEYS],
        ["kv_trace", VALID_KV_TRACE_KEYS],
      ] as const) {
        if (!Object.hasOwn(effectiveAdditional, subName) || effectiveAdditional[subName] === undefined) {
          continue;
        }
        const subVal = effectiveAdditional[subName];
        if (!isRecord(subVal)) {
          diagnostics.push({
            code: "parse-invalid-json-type",
            severity: "error",
            flag: `additional_config.${subName}`,
            message: `ValidationError: additional_config.${subName} 需要 JSON 对象，收到 ${JSON.stringify(subVal)}。`,
          });
        } else {
          validateSubConfigKeys(subVal, `additional_config.${subName}`, subValidKeys, diagnostics);
          if (
            subName === "eplb_config" &&
            Object.hasOwn(subVal, "stair_config") &&
            subVal.stair_config !== undefined
          ) {
            if (!isRecord(subVal.stair_config)) {
              diagnostics.push({
                code: "parse-invalid-json-type",
                severity: "error",
                flag: "additional_config.eplb_config.stair_config",
                message: `ValidationError: additional_config.eplb_config.stair_config 需要 JSON 对象，收到 ${JSON.stringify(subVal.stair_config)}。`,
              });
            } else {
              validateSubConfigKeys(
                subVal.stair_config,
                "additional_config.eplb_config.stair_config",
                VALID_STAIR_KEYS,
                diagnostics,
              );
            }
          }
        }
      }
    }

    if (
      Object.hasOwn(effectiveAdditional, "ascend_compilation_config") &&
      effectiveAdditional.ascend_compilation_config !== undefined &&
      !isRecord(effectiveAdditional.ascend_compilation_config)
    ) {
      diagnostics.push({
        code: "parse-invalid-json-type",
        severity: "error",
        flag: "additional_config.ascend_compilation_config",
        message: `ValidationError: additional_config.ascend_compilation_config 需要 JSON 对象，收到 ${JSON.stringify(effectiveAdditional.ascend_compilation_config)}。`,
      });
    }
    const acc = isRecord(effectiveAdditional.ascend_compilation_config)
      ? effectiveAdditional.ascend_compilation_config
      : null;
    if (acc) {
      if (!isRfork) {
        validateSubConfigKeys(
          acc,
          "additional_config.ascend_compilation_config",
          VALID_ASCEND_COMPILATION_KEYS,
          diagnostics,
        );
      }
      const npugraph = parseAscendBoolField(
        acc,
        "enable_npugraph_ex",
        "additional_config.ascend_compilation_config.enable_npugraph_ex",
        diagnostics,
        isRfork,
      );
      if (npugraph !== undefined) couplingInput.enableNpugraphEx = npugraph;
      const staticK = parseAscendBoolField(
        acc,
        "enable_static_kernel",
        "additional_config.ascend_compilation_config.enable_static_kernel",
        diagnostics,
        isRfork,
      );
      if (staticK !== undefined) couplingInput.enableStaticKernel = staticK;
      const superK = parseAscendBoolField(
        acc,
        "enable_super_kernel",
        "additional_config.ascend_compilation_config.enable_super_kernel",
        diagnostics,
        isRfork,
      );
      if (superK !== undefined) couplingInput.enableSuperKernel = superK;
    }

    if (
      Object.hasOwn(effectiveAdditional, "scheduler_config") &&
      effectiveAdditional.scheduler_config !== undefined &&
      effectiveAdditional.scheduler_config !== null &&
      !isRecord(effectiveAdditional.scheduler_config)
    ) {
      diagnostics.push({
        code: "parse-invalid-json-type",
        severity: "error",
        flag: "additional_config.scheduler_config",
        message: `ValueError: additional_config.scheduler_config 必须为字典对象，收到 ${JSON.stringify(effectiveAdditional.scheduler_config)}。`,
      });
    }
    const sched = isRecord(effectiveAdditional.scheduler_config)
      ? effectiveAdditional.scheduler_config
      : null;
    if (sched && !isRfork) {
      validateSubConfigKeys(
        sched,
        "additional_config.scheduler_config",
        VALID_SCHEDULER_KEYS_BY_TARGET[targetSchemaVersion],
        diagnostics,
        version === "main" ? new Set(["profiling_chunk_config"]) : undefined,
      );
    }
    const resolveSchedHolder = (
      key: string,
    ): { holder: Record<string, unknown>; flagPath: string } | null => {
      if (sched && Object.hasOwn(sched, key)) {
        return { holder: sched, flagPath: `additional_config.scheduler_config.${key}` };
      }
      if (Object.hasOwn(effectiveAdditional, key)) {
        return {
          holder: effectiveAdditional as Record<string, unknown>,
          flagPath: `additional_config.${key}`,
        };
      }
      return null;
    };

    const recomputeEntry = resolveSchedHolder("recompute_scheduler_enable");
    if (recomputeEntry) {
      const recompute = parseAscendBoolField(
        recomputeEntry.holder,
        "recompute_scheduler_enable",
        recomputeEntry.flagPath,
        diagnostics,
        isRfork,
      );
      if (recompute !== undefined) couplingInput.recomputeSchedulerEnable = recompute;
    }

    const balSchedEntry = resolveSchedHolder("enable_balance_scheduling");
    if (balSchedEntry) {
      const balSched = parseAscendBoolField(
        balSchedEntry.holder,
        "enable_balance_scheduling",
        balSchedEntry.flagPath,
        diagnostics,
        isRfork,
      );
      if (balSched !== undefined) couplingInput.enableBalanceScheduling = balSched;
    }

    const profChunkEntry = resolveSchedHolder("profiling_chunk_config");
    if (profChunkEntry && profChunkEntry.holder.profiling_chunk_config !== undefined) {
      couplingInput.profilingChunkConfigured = true;
      const rawProfChunk = profChunkEntry.holder.profiling_chunk_config;
      if (
        parseEnabledSubConfig(
          profChunkEntry.holder,
          "profiling_chunk_config",
          profChunkEntry.flagPath,
          diagnostics,
          isRfork,
          { allowNullOnRfork: true, allowedSubKeys: VALID_PROFILING_CHUNK_KEYS },
        )
      ) {
        couplingInput.profilingChunkEnabled = true;
        if (isRecord(rawProfChunk)) {
          const rfMin = isRfork ? parsePythonBuiltinBigInt(rawProfChunk.min_chunk) : undefined;
          const minChunk = isRfork
            ? typeof rfMin === "bigint"
              ? Number(rfMin)
              : undefined
            : parsePydanticLaxInt(rawProfChunk.min_chunk);
          if (minChunk !== undefined && Number.isFinite(minChunk)) couplingInput.profilingMinChunk = minChunk;
        }
      }
    }

    const batchJobEntry = resolveSchedHolder("batch_job_sched_config");
    if (
      batchJobEntry &&
      parseEnabledSubConfig(
        batchJobEntry.holder,
        "batch_job_sched_config",
        batchJobEntry.flagPath,
        diagnostics,
        isRfork,
        { allowNullOnRfork: true, allowedSubKeys: VALID_BATCH_JOB_SCHED_KEYS },
      )
    ) {
      couplingInput.batchJobSchedEnabled = true;
    }

    const srfEntry = resolveSchedHolder("short_request_first_config");
    if (
      srfEntry &&
      parseEnabledSubConfig(
        srfEntry.holder,
        "short_request_first_config",
        srfEntry.flagPath,
        diagnostics,
        isRfork,
        {
          allowNullOnRfork: true,
          allowFalsyOnRfork: true,
          allowedSubKeys: VALID_SHORT_REQUEST_FIRST_KEYS,
          enforceSubKeysOnRfork: true,
        },
      )
    ) {
      couplingInput.shortRequestFirstEnabled = true;
    }

    if (
      !isRfork &&
      sched &&
      parseEnabledSubConfig(
        sched,
        "dyntra_lb_config",
        "additional_config.scheduler_config.dyntra_lb_config",
        diagnostics,
        isRfork,
        { allowedSubKeys: VALID_DYNTRA_LB_KEYS },
      )
    ) {
      couplingInput.dyntraLbEnabled = true;
    }

    const fc1 = parseAscendBoolField(
      effectiveAdditional,
      "enable_flashcomm1",
      "additional_config.enable_flashcomm1",
      diagnostics,
      isRfork,
    );
    if (fc1 !== undefined) {
      couplingInput.enableFlashcomm1 = isRfork ? fc1 : Boolean(fc1 || envFc1Enabled);
    }
    const dsaCp = parseAscendBoolField(
      effectiveAdditional,
      "enable_dsa_cp",
      "additional_config.enable_dsa_cp",
      diagnostics,
      isRfork,
    );
    if (dsaCp !== undefined) couplingInput.enableDsaCp = dsaCp;
    if (
      Object.hasOwn(effectiveAdditional, "enable_fused_mc2") &&
      effectiveAdditional.enable_fused_mc2 !== undefined
    ) {
      const rawFm = effectiveAdditional.enable_fused_mc2;
      if (isRfork) {
        const rfFm =
          typeof rawFm === "boolean" ? (rawFm ? 1 : 0) : rawFm === 0 || rawFm === 1 ? rawFm : undefined;
        if (rfFm !== undefined) {
          couplingInput.enableFusedMc2 = rfFm;
        } else {
          delete couplingInput.enableFusedMc2;
          diagnostics.push({
            code: "parse-invalid-range",
            severity: "error",
            flag: "additional_config.enable_fused_mc2",
            message: `AssertionError: additional_config.enable_fused_mc2 在 rfork 中仅允许整数 0 或 1，收到 ${JSON.stringify(rawFm)}。`,
          });
        }
      } else {
        const fusedMc2 = parsePydanticLaxInt(rawFm);
        if (fusedMc2 === 0 || fusedMc2 === 1 || fusedMc2 === 2 || fusedMc2 === 3) {
          couplingInput.enableFusedMc2 = fusedMc2;
        } else if (fusedMc2 !== undefined) {
          diagnostics.push({
            code: "parse-invalid-range",
            severity: "error",
            flag: "additional_config.enable_fused_mc2",
            message: `additional_config.enable_fused_mc2 仅允许 0 / 1 (dispatch_ffn_combine) / 2 (MegaMoe) / 3 (MegaMoe+共享专家融合，仅 main；v0.30.0 仅支持 0/1/2)，收到 ${fusedMc2}。`,
          });
        }
      }
    }
    const prefillMc2 = parseAscendBoolField(
      effectiveAdditional,
      "enable_prefill_mc2",
      "additional_config.enable_prefill_mc2",
      diagnostics,
      isRfork,
    );
    if (prefillMc2 !== undefined) couplingInput.enablePrefillMc2 = prefillMc2;
    const nzMode = isRfork
      ? parseNumberLike(effectiveAdditional.weight_nz_mode)
      : parsePydanticLaxInt(effectiveAdditional.weight_nz_mode);
    if (nzMode !== undefined) couplingInput.weightNzMode = nzMode;
    const sparseSfaC8 = parseAscendBoolField(
      effectiveAdditional,
      "enable_sparse_sfa_c8",
      "additional_config.enable_sparse_sfa_c8",
      diagnostics,
      isRfork,
    );
    if (sparseSfaC8 !== undefined) couplingInput.enableSparseSfaC8 = sparseSfaC8;

    if (isRecord(effectiveAdditional.rl_config)) {
      if (!isRfork) {
        validateSubConfigKeys(
          effectiveAdditional.rl_config,
          "additional_config.rl_config",
          VALID_RL_KEYS,
          diagnostics,
        );
      }
      const rlEn = parseAscendBoolField(
        effectiveAdditional.rl_config,
        "enabled",
        "additional_config.rl_config.enabled",
        diagnostics,
        isRfork,
      );
      if (rlEn !== undefined) couplingInput.rlEnabled = rlEn;
      const rlConsKey = Object.hasOwn(effectiveAdditional.rl_config, "enable_training_consistency")
        ? "enable_training_consistency"
        : isRfork
          ? "training_consistency"
          : "enable_training_consistency";
      const rlCons = parseAscendBoolField(
        effectiveAdditional.rl_config,
        rlConsKey,
        `additional_config.rl_config.${rlConsKey}`,
        diagnostics,
        isRfork,
      );
      if (rlCons !== undefined) couplingInput.rlTrainingConsistency = rlCons;
    } else if (
      !isRfork &&
      Object.hasOwn(effectiveAdditional, "rl_config") &&
      effectiveAdditional.rl_config !== undefined
    ) {
      diagnostics.push({
        code: "parse-invalid-json-type",
        severity: "error",
        flag: "additional_config.rl_config",
        message: `ValidationError: additional_config.rl_config 需要 JSON 对象，收到 ${JSON.stringify(effectiveAdditional.rl_config)}。`,
      });
    }
    if (
      parseEnabledSubConfig(
        effectiveAdditional,
        "xlite_graph_config",
        "additional_config.xlite_graph_config",
        diagnostics,
        isRfork,
        { allowedSubKeys: VALID_XLITE_GRAPH_KEYS },
      )
    ) {
      couplingInput.xliteEnabled = true;
    }
    const qarc = effectiveAdditional.quantized_all_reduce_config;
    if (Object.hasOwn(effectiveAdditional, "quantized_all_reduce_config") && qarc !== undefined) {
      if (!isRecord(qarc)) {
        couplingInput.quantizedAllReduceInvalidReason = `TypeError / ValidationError: additional_config.quantized_all_reduce_config 必须为字典对象（仅含 enable 与 min_numel），不能传 ${Array.isArray(qarc) ? "list" : qarc === null ? "null" : typeof qarc}`;
      } else {
        const unknownQarKeys = Object.keys(qarc)
          .filter((k) => k !== "enable" && k !== "min_numel")
          .sort();
        if (unknownQarKeys.length > 0) {
          couplingInput.quantizedAllReduceInvalidReason = `ValidationError: additional_config.quantized_all_reduce_config 在 main@8d6180e2 仅支持 enable 与 min_numel 两个子键，未知子键将被 extra="forbid" 拒收：${unknownQarKeys.join("、")}`;
        }
        if (qarc.enable !== undefined) {
          const qEn = parsePydanticLaxBool(qarc.enable);
          if (qEn !== undefined) {
            couplingInput.quantizedAllReduceEnabled = qEn;
          } else {
            couplingInput.quantizedAllReduceInvalidReason = `ValidationError: additional_config.quantized_all_reduce_config.enable 必须为布尔值（收到 ${JSON.stringify(qarc.enable)}）`;
          }
        }
        if (qarc.min_numel !== undefined) {
          const minNumel = parsePydanticLaxInt(qarc.min_numel);
          if (minNumel !== undefined) {
            couplingInput.quantizedAllReduceMinNumel = minNumel;
          } else {
            couplingInput.quantizedAllReduceInvalidReason = `ValidationError: additional_config.quantized_all_reduce_config.min_numel 必须为整数（收到 ${JSON.stringify(qarc.min_numel)}）`;
          }
        }
      }
      if (couplingInput.quantizedAllReduceInvalidReason && !isRfork && version === "main") {
        diagnostics.push({
          code: "parse-invalid-json-type",
          severity: "error",
          flag: "additional_config.quantized_all_reduce_config",
          message: couplingInput.quantizedAllReduceInvalidReason,
        });
      }
    }

    const kvNz = parseAscendBoolField(
      effectiveAdditional,
      "enable_kv_nz",
      "additional_config.enable_kv_nz",
      diagnostics,
      isRfork,
    );
    if (kvNz !== undefined) couplingInput.enableKvNz = kvNz;
    const mlapo = parseAscendBoolField(
      effectiveAdditional,
      "enable_mlapo",
      "additional_config.enable_mlapo",
      diagnostics,
      isRfork,
    );
    if (mlapo !== undefined) couplingInput.enableMlapo = mlapo;
    if (!isRfork) {
      const mlapoKeep = parseAscendBoolField(
        effectiveAdditional,
        "mlapo_keep_prefill_weights",
        "additional_config.mlapo_keep_prefill_weights",
        diagnostics,
        false,
      );
      if (mlapoKeep !== undefined) couplingInput.mlapoKeepPrefillWeights = mlapoKeep;
      const forceEplb = parseAscendBoolField(
        effectiveAdditional,
        "enable_force_eplb",
        "additional_config.enable_force_eplb",
        diagnostics,
        false,
      );
      if (forceEplb !== undefined) couplingInput.enableForceEplb = forceEplb;
    }
    if (isRecord(effectiveAdditional.eplb_config)) {
      const dynEplb = parseAscendBoolField(
        effectiveAdditional.eplb_config,
        "dynamic_eplb",
        "additional_config.eplb_config.dynamic_eplb",
        diagnostics,
        isRfork,
      );
      const hasRecPath =
        effectiveAdditional.eplb_config.expert_map_record_path !== undefined &&
        effectiveAdditional.eplb_config.expert_map_record_path !== null;
      if (dynEplb === true || hasRecPath) couplingInput.dynamicEplb = true;
      const rawRedExp = effectiveAdditional.eplb_config.num_redundant_experts;
      const redExp = isRfork
        ? typeof rawRedExp === "boolean"
          ? rawRedExp
            ? 1
            : 0
          : typeof rawRedExp === "number" && Number.isInteger(rawRedExp)
            ? rawRedExp
            : undefined
        : parsePydanticLaxInt(rawRedExp);
      if (redExp !== undefined) couplingInput.numRedundantExperts = redExp;
    }
    const mixPl = parseAscendBoolField(
      effectiveAdditional,
      "mix_placement",
      "additional_config.mix_placement",
      diagnostics,
      isRfork,
    );
    if (mixPl !== undefined) couplingInput.mixPlacement = mixPl;
    const msOse = parseAscendBoolField(
      effectiveAdditional,
      "multistream_overlap_shared_expert",
      "additional_config.multistream_overlap_shared_expert",
      diagnostics,
      isRfork,
    );
    if (msOse !== undefined) couplingInput.multistreamOverlapSharedExpert = msOse;
    const hierComm = parseAscendBoolField(
      effectiveAdditional,
      "enable_mc2_hierarchy_comm",
      "additional_config.enable_mc2_hierarchy_comm",
      diagnostics,
      isRfork,
    );
    if (hierComm === true) {
      couplingInput.mc2CommAlg = "hierarchy";
    } else if (typeof effectiveAdditional.mc2_comm_alg === "string") {
      couplingInput.mc2CommAlg = effectiveAdditional.mc2_comm_alg;
    }

    const sedp = parseAscendBoolField(
      effectiveAdditional,
      "enable_shared_expert_dp",
      "additional_config.enable_shared_expert_dp",
      diagnostics,
      isRfork,
    );
    if (sedp !== undefined) couplingInput.enableSharedExpertDp = sedp;
    const mmSef = parseAscendBoolField(
      effectiveAdditional,
      "megamoe_shared_expert_fusion",
      "additional_config.megamoe_shared_expert_fusion",
      diagnostics,
      isRfork,
    );
    if (mmSef !== undefined) couplingInput.megamoeSharedExpertFusion = mmSef;
    const meo = parseAscendBoolField(
      effectiveAdditional,
      "multistream_engram_overlap",
      "additional_config.multistream_engram_overlap",
      diagnostics,
      isRfork,
    );
    if (meo !== undefined) couplingInput.multistreamEngramOverlap = meo;
    const gdnCp = parseAscendBoolField(
      effectiveAdditional,
      "gdn_internal_prefill_checkpoints",
      "additional_config.gdn_internal_prefill_checkpoints",
      diagnostics,
      isRfork,
    );
    if (gdnCp !== undefined) couplingInput.gdnInternalPrefillCheckpoints = gdnCp;
    const kvDbg = parseAscendBoolField(
      effectiveAdditional,
      "kv_pool_range_debug",
      "additional_config.kv_pool_range_debug",
      diagnostics,
      isRfork,
    );
    if (kvDbg !== undefined) couplingInput.kvPoolRangeDebug = kvDbg;

    const rawSe = effectiveAdditional.shared_engram;
    if (rawSe !== undefined && rawSe !== null) {
      couplingInput.sharedEngramConfigured = true;
      if (!isRecord(rawSe)) {
        couplingInput.sharedEngramInvalidReason = `ValidationError: additional_config.shared_engram 必须为字典对象（收到 ${Array.isArray(rawSe) ? "list" : typeof rawSe}）`;
      } else {
        const ALLOWED_SE_KEYS = new Set([
          "backend",
          "endpoint",
          "capacity",
          "library_path",
          "listen_port",
          "local_comm_res",
        ]);
        const unknownSeKeys = Object.keys(rawSe)
          .filter((k) => !ALLOWED_SE_KEYS.has(k))
          .sort();
        if (unknownSeKeys.length > 0) {
          couplingInput.sharedEngramInvalidReason = `ValidationError: additional_config.shared_engram 未知子键将被 extra="forbid" 拒收：${unknownSeKeys.join("、")}`;
        }
        if (rawSe.backend !== undefined) {
          if (typeof rawSe.backend === "string") {
            couplingInput.sharedEngramBackend = rawSe.backend;
          } else {
            couplingInput.sharedEngramBackend = String(rawSe.backend);
            couplingInput.sharedEngramInvalidReason ??= `ValidationError: shared_engram.backend 必须为字符串（不能为 null，收到 ${JSON.stringify(rawSe.backend)}）`;
          }
        }
        if (rawSe.endpoint !== undefined) {
          if (typeof rawSe.endpoint === "string") {
            couplingInput.sharedEngramEndpoint = rawSe.endpoint;
          } else {
            couplingInput.sharedEngramInvalidReason ??= `ValidationError: shared_engram.endpoint 必须为字符串（收到 ${JSON.stringify(rawSe.endpoint)}）`;
          }
        }
        if (rawSe.capacity !== undefined) {
          const seCap = parsePydanticLaxInt(rawSe.capacity);
          if (seCap !== undefined) {
            couplingInput.sharedEngramCapacity = seCap;
          } else {
            couplingInput.sharedEngramInvalidReason ??= `ValidationError: shared_engram.capacity 必须为整数（不能为 null；省略该字段才使用默认值 65536，收到 ${JSON.stringify(rawSe.capacity)}）`;
          }
        }
        if (rawSe.library_path !== undefined && rawSe.library_path !== null) {
          if (typeof rawSe.library_path === "string") {
            if (rawSe.library_path.length > 0) couplingInput.sharedEngramLibraryPath = rawSe.library_path;
          } else {
            couplingInput.sharedEngramInvalidReason ??= `ValidationError: shared_engram.library_path 必须为字符串`;
          }
        }
        if (rawSe.listen_port !== undefined && rawSe.listen_port !== null) {
          const seLp = parsePydanticLaxInt(rawSe.listen_port);
          if (seLp !== undefined) {
            couplingInput.sharedEngramListenPort = seLp;
          } else {
            couplingInput.sharedEngramInvalidReason ??= `ValidationError: shared_engram.listen_port 必须为整数（收到 ${JSON.stringify(rawSe.listen_port)}）`;
          }
        }
        if (rawSe.local_comm_res !== undefined && rawSe.local_comm_res !== null) {
          if (typeof rawSe.local_comm_res === "string") {
            if (rawSe.local_comm_res.length > 0) {
              couplingInput.sharedEngramLocalCommRes = rawSe.local_comm_res;
            }
          } else {
            couplingInput.sharedEngramInvalidReason ??= `ValidationError: shared_engram.local_comm_res 必须为字符串`;
          }
        }
      }
    }

    const rawRc = effectiveAdditional.runtime_config;
    if (rawRc !== undefined && rawRc !== null) {
      if (isRecord(rawRc)) {
        couplingInput.runtimeConfigConfigured = true;
        if (Object.hasOwn(rawRc, "runtime_config_hot_reload")) {
          couplingInput.runtimeConfigHasNestedHotReload = true;
        }
        if (
          isRecord(rawRc.dump) &&
          rawRc.dump.manual_dump !== undefined &&
          rawRc.dump.manual_dump !== null &&
          rawRc.dump.manual_dump !== false &&
          rawRc.dump.manual_dump !== 0
        ) {
          couplingInput.runtimeConfigManualDumpSet = true;
        }
      } else {
        couplingInput.runtimeConfigInvalidType = Array.isArray(rawRc) ? "list" : typeof rawRc;
      }
    }
    const rawRcp = effectiveAdditional.runtime_config_path;
    if (rawRcp !== undefined && rawRcp !== null) {
      if (typeof rawRcp === "string") {
        couplingInput.runtimeConfigPathConfigured = true;
      } else {
        couplingInput.runtimeConfigPathInvalidType = Array.isArray(rawRcp) ? "list" : typeof rawRcp;
      }
    }
    const rawHr = effectiveAdditional.runtime_config_hot_reload;
    if (
      rawHotReloadFloatLiteral !== undefined &&
      Object.hasOwn(effectiveAdditional, "runtime_config_hot_reload")
    ) {
      couplingInput.runtimeConfigHotReloadInvalidValue = rawHotReloadFloatLiteral;
    } else if (rawHr !== undefined && rawHr !== null) {
      if (typeof rawHr === "boolean") {
        couplingInput.runtimeConfigHotReload = rawHr;
      } else if (rawHr === 0 || rawHr === 1) {
        couplingInput.runtimeConfigHotReload = rawHr === 1;
      } else {
        couplingInput.runtimeConfigHotReloadInvalidValue = rawHr;
      }
    }
    if (isRecord(effectiveAdditional.finegrained_tp_config)) {
      if (!isRfork) {
        validateSubConfigKeys(
          effectiveAdditional.finegrained_tp_config,
          "additional_config.finegrained_tp_config",
          VALID_FINEGRAINED_TP_KEYS_BY_TARGET[targetSchemaVersion],
          diagnostics,
        );
      }
      const parseFgInt = isRfork ? parseNumberLike : parsePydanticLaxInt;
      const oproj = parseFgInt(effectiveAdditional.finegrained_tp_config.oproj_tensor_parallel_size);
      if (oproj !== undefined) couplingInput.oprojTensorParallelSize = oproj;
      const mlp = parseFgInt(effectiveAdditional.finegrained_tp_config.mlp_tensor_parallel_size);
      if (mlp !== undefined) couplingInput.mlpTensorParallelSize = mlp;
      const emb = parseFgInt(effectiveAdditional.finegrained_tp_config.embedding_tensor_parallel_size);
      if (emb !== undefined) couplingInput.embeddingTensorParallelSize = emb;
      const lmhead = parseFgInt(effectiveAdditional.finegrained_tp_config.lmhead_tensor_parallel_size);
      if (lmhead !== undefined) couplingInput.lmheadTensorParallelSize = lmhead;
      if (version === "main") {
        const qkvIp = parseFgInt(effectiveAdditional.finegrained_tp_config.qkv_iproj_tensor_parallel_size);
        if (qkvIp !== undefined) couplingInput.qkvIprojTensorParallelSize = qkvIp;
      }
    } else if (
      Object.hasOwn(effectiveAdditional, "finegrained_tp_config") &&
      effectiveAdditional.finegrained_tp_config !== undefined
    ) {
      diagnostics.push({
        code: "parse-invalid-json-type",
        severity: "error",
        flag: "additional_config.finegrained_tp_config",
        message: `ValidationError: additional_config.finegrained_tp_config 需要 JSON 对象，收到 ${JSON.stringify(effectiveAdditional.finegrained_tp_config)}。`,
      });
    }
    if (isRecord(effectiveAdditional.sparse_kv_offload_config)) {
      const keep = parseAscendBoolField(
        effectiveAdditional.sparse_kv_offload_config,
        "keep_device_kv_cache",
        "additional_config.sparse_kv_offload_config.keep_device_kv_cache",
        diagnostics,
        isRfork,
      );
      if (keep !== undefined) couplingInput.keepDeviceKvCache = keep;
      const rfTopkBuf = isRfork
        ? parsePythonBuiltinBigInt(effectiveAdditional.sparse_kv_offload_config.topk_buffer_size)
        : undefined;
      const topkBuf = isRfork
        ? typeof rfTopkBuf === "bigint"
          ? Number(rfTopkBuf)
          : undefined
        : parsePydanticLaxInt(effectiveAdditional.sparse_kv_offload_config.topk_buffer_size);
      if (topkBuf !== undefined && Number.isFinite(topkBuf)) couplingInput.topkBufferSize = topkBuf;
    }
    if (
      parseEnabledSubConfig(
        effectiveAdditional,
        "sparse_kv_offload_config",
        "additional_config.sparse_kv_offload_config",
        diagnostics,
        isRfork,
        { allowedSubKeys: VALID_SPARSE_KV_OFFLOAD_KEYS_BY_TARGET[targetSchemaVersion] },
      )
    ) {
      couplingInput.sparseKvOffloadEnabled = true;
    }

    // Complete AST-derived field type validation across AscendConfig and all @config sub-configs
    if (!isRfork) {
      validateRecordFieldTypes(
        effectiveAdditional as Record<string, unknown>,
        "additional_config",
        ASCEND_TOP_LEVEL_FIELD_TYPES,
        diagnostics,
      );
      for (const [subName, fieldSpecs] of Object.entries(ASCEND_SUBCONFIG_FIELD_TYPES)) {
        if (subName === "stair_config") {
          const eplb = effectiveAdditional.eplb_config;
          if (isRecord(eplb) && isRecord(eplb.stair_config)) {
            validateRecordFieldTypes(
              eplb.stair_config,
              "additional_config.eplb_config.stair_config",
              fieldSpecs,
              diagnostics,
            );
          }
          continue;
        }
        if (subName === "dyntra_lb_config") {
          if (sched && isRecord(sched.dyntra_lb_config)) {
            validateRecordFieldTypes(
              sched.dyntra_lb_config,
              "additional_config.scheduler_config.dyntra_lb_config",
              fieldSpecs,
              diagnostics,
            );
          }
          continue;
        }
        if (
          subName === "profiling_chunk_config" ||
          subName === "batch_job_sched_config" ||
          subName === "short_request_first_config"
        ) {
          const entry = resolveSchedHolder(subName);
          if (entry && isRecord(entry.holder[subName])) {
            validateRecordFieldTypes(
              entry.holder[subName] as Record<string, unknown>,
              entry.flagPath,
              fieldSpecs,
              diagnostics,
            );
          }
          continue;
        }
        const subRec = effectiveAdditional[subName];
        if (isRecord(subRec)) {
          validateRecordFieldTypes(subRec, `additional_config.${subName}`, fieldSpecs, diagnostics);
        }
      }
    }
    validateAscendModelValidatorRanges(
      effectiveAdditional,
      sched,
      resolveSchedHolder,
      version,
      envVars,
      rawMegaFloatLiteral,
      diagnostics,
    );
  }

  // Extract --kv-transfer-config fields
  if (kvTransferConfig) {
    if (
      typeof kvTransferConfig.kv_connector === "string" &&
      kvTransferConfig.kv_connector.trim().length > 0
    ) {
      couplingInput.kvConnector = kvTransferConfig.kv_connector.trim();
    }
    const role = normalizeKvRole(kvTransferConfig.kv_role);
    if (role !== undefined) couplingInput.kvRole = role;
    if (isRecord(kvTransferConfig.kv_connector_extra_config)) {
      const extra = kvTransferConfig.kv_connector_extra_config;
      const prefillExtra = isRecord(extra.prefill) ? extra.prefill : null;
      const decodeExtra = isRecord(extra.decode) ? extra.decode : null;
      const pTp = parseNumberLike(extra.prefill_tp_size ?? prefillExtra?.tp_size);
      if (pTp !== undefined) couplingInput.prefillTpSize = pTp;
      const dTp = parseNumberLike(extra.decode_tp_size ?? decodeExtra?.tp_size);
      if (dTp !== undefined) couplingInput.decodeTpSize = dTp;
      if (Array.isArray(extra.connectors)) {
        const hasPreempt = extra.connectors.some(
          (c) => isRecord(c) && c.kv_connector === "PreemptOffloadConnector",
        );
        if (hasPreempt) couplingInput.hasPreemptOffloadConnector = true;
      }
    }
  }

  // Extract --speculative-config fields
  if (speculativeConfig) {
    const specTokens = parseNumberLike(speculativeConfig.num_speculative_tokens);
    if (specTokens !== undefined) couplingInput.numSpecTokens = specTokens;
    if (typeof speculativeConfig.method === "string") {
      couplingInput.speculativeMethod = speculativeConfig.method.trim().toLowerCase();
    }
  }

  const tp = Math.max(1, couplingInput.tpSize ?? 1);
  const pp = Math.max(1, couplingInput.ppSize ?? 1);
  const dpLocal = Math.max(1, dataParallelSizeLocal ?? couplingInput.dpSize ?? 1);
  const pcp = Math.max(1, couplingInput.pcpSize ?? 1);
  const requiredLocalRanks = tp * pp * dpLocal * pcp;

  return {
    rawText,
    normalizedCommandLine: serveTokens.join(" "),
    shellPreamble,
    envVars,
    visibleDevices,
    model,
    servedModelName,
    port,
    host,
    distributedExecutorBackend,
    loadFormat,
    trustRemoteCode,
    enforceEager,
    enableSleepMode,
    enablePrefixCaching,
    gpuMemoryUtilization,
    rawDtype,
    rawQuantization,
    rawKvCacheDtype,
    dataParallelSizeLocal,
    additionalConfig,
    compilationConfig,
    kvTransferConfig,
    speculativeConfig,
    unknownFlags,
    parseDiagnostics: diagnostics,
    inferredHints,
    couplingInput,
    requiredLocalRanks,
    matchedStatementIndex,
  };
}
