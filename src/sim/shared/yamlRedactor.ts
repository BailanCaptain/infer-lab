import { isAlias, isCollection, isMap, isScalar, isSeq, parseAllDocuments, visit } from "yaml";

export interface RedactCountResult {
  readonly text: string;
  readonly count: number;
}

export interface RedactIpOptions {
  readonly mask: string;
  readonly bracketedMask?: string | undefined;
}

const TERMINAL_CONTROL_RE = new RegExp(
  [
    "\\x1b\\][^\\x07\\x1b\\r\\n]*(?:\\x07|\\x1b\\\\)",
    "\\x1b[PX^_][^\\x07\\x1b\\r\\n]*(?:\\x07|\\x1b\\\\)",
    "\\x1b\\[[0-?]*[ -/]*[@-~]",
    "\\x1b[()*+\\-./][@-~]",
    "\\x1b[@-_]",
  ].join("|"),
  "g",
);

/**
 * Canonical terminal-control sequence decoder shared by client sanitizer and server evidence checks.
 */
export function stripTerminalControlSequences(raw: string): string {
  return raw.replace(TERMINAL_CONTROL_RE, "");
}

const IPV4_CORE_RE = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const KNOWN_IPV6_SINGLE_PREFIX_RE =
  /^(?:fe[89ab][0-9a-f]|f[cd][0-9a-f]{2}|ff[0-9a-f]{2}|[23][0-9a-f]{3}|64|100)$/i;

function parseIpv6Side(
  side: string,
  allowTrailingIpv4: boolean,
): { hextets: number; hasIpv4: boolean; groups: string[] } | null {
  if (side === "") return { hextets: 0, hasIpv4: false, groups: [] };
  if (side.startsWith(":") || side.endsWith(":")) return null;
  const groups = side.split(":");
  let hextets = 0;
  let hasIpv4 = false;
  for (let i = 0; i < groups.length; i += 1) {
    const part = groups[i]!;
    if (part.includes(".")) {
      if (!allowTrailingIpv4 || i !== groups.length - 1 || !IPV4_CORE_RE.test(part)) return null;
      hasIpv4 = true;
      hextets += 2;
    } else {
      if (!/^[0-9a-f]{1,4}$/i.test(part)) return null;
      hextets += 1;
    }
  }
  return { hextets, hasIpv4, groups };
}

function isValidIpv6Core(core: string): boolean {
  if (!core.includes(":") || core.includes(":::")) return false;
  const parts = core.split("::");
  if (parts.length > 2) return false;
  if (parts.length === 1) {
    const parsed = parseIpv6Side(parts[0]!, true);
    return parsed !== null && parsed.hextets === 8;
  }
  const left = parseIpv6Side(parts[0]!, false);
  const right = parseIpv6Side(parts[1]!, true);
  if (!left || !right) return false;
  return left.hextets + right.hextets <= 7;
}

function isSafeUnbracketedIpv6(core: string, hasZone: boolean): boolean {
  if (!isValidIpv6Core(core)) return false;
  if (!core.includes("::") || hasZone) return true;
  const [leftRaw = "", rightRaw = ""] = core.split("::");
  const leftGroups = leftRaw ? leftRaw.split(":") : [];
  const rightGroups = rightRaw ? rightRaw.split(":") : [];
  if (rightGroups.some((g) => g.includes("."))) return true;
  if (leftGroups.length + rightGroups.length >= 3) return true;
  if (leftGroups.length === 0 && rightGroups.length === 0) return true;
  if (leftGroups.length === 0 && rightGroups.length >= 1) {
    return true;
  }
  if (leftGroups.length === 1 && rightGroups.length === 0) {
    return true;
  }
  if (leftGroups.length === 2 && rightGroups.length === 0) {
    return true;
  }
  if (leftGroups.length === 1 && rightGroups.length === 1) {
    const l = leftGroups[0]!;
    return KNOWN_IPV6_SINGLE_PREFIX_RE.test(l) || /^\d/.test(l);
  }
  return false;
}

const UNBRACKETED_IPV6_HEX_CORE_SRC =
  "(?:(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4}){0,5}|::(?:[0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4}){0,6})?)";

const UNBRACKETED_IPV6_RE = new RegExp(
  `(?<![A-Za-z0-9_]|::|(?<![A-Za-z0-9_])[0-9a-fA-F]{1,4}:)(?:((?:[0-9a-fA-F]{0,4}:){2,8}(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3})(%[A-Za-z0-9_.-]+)?(?![A-Za-z0-9_]|:[0-9a-fA-F:]|\\.\\d)|(${UNBRACKETED_IPV6_HEX_CORE_SRC})(%[A-Za-z0-9_.-]+)?(?![A-Za-z0-9_]|:[0-9a-fA-F:]|\\.\\d))`,
  "g",
);

const EXPLICIT_ADDR_CONTEXT_RE =
  /(?:^|[\s"'({[,;])(?:--?(?:host(?:name)?|ip|addr|address|bind(?:-address)?|listen(?:-address)?|advertise(?:-address)?|peer|endpoint|target|pod|master-addr|node(?:-ip|-name)?)(?:[ \t]*=[ \t]*["']?|[ \t]+["']?)|(?:(["'])(?:host(?:name)?|node(?:_name|_ip)?|ip|host_ip|if_ip|peer_ip|bind_ip|master_addr|node_ip|listen_addr|advertise_addr|client_ip|remote_addr|local_addr|endpoint|target|http_target|pod|pod_name|exported_instance|instance(?:_id)?|group(?:_name|_id)?|comm_group|pg_name|peer|[A-Za-z0-9_]*_(?:ip|addr|host))\1|(?:host(?:name)?|node(?:_name|_ip)?|ip|host_ip|if_ip|peer_ip|bind_ip|master_addr|node_ip|listen_addr|advertise_addr|client_ip|remote_addr|local_addr|endpoint|target|http_target|pod|pod_name|exported_instance|instance(?:_id)?|group(?:_name|_id)?|comm_group|pg_name|peer|[A-Za-z0-9_]*_(?:ip|addr|host)))[ \t]*[:=][ \t]*["']?(?:https?:\/\/)?)$/i;

/**
 * Causal-domain tag positions understood by the troubleshoot analyzer (`host=`, `hostname=`, `node=`,
 * `node_name=`, `[host: …]`, `instance=`, `instance_id=`, `group=`, `comm_group=`, etc.).
 * Addresses here are rendered as bare, parseable aliases (`REDACTED_IP_<n>`) so distinct
 * causal domains stay distinct during cross-host / multi-instance cascade scoping.
 */
const HOST_TAG_CONTEXT_RE =
  /(?:(?:^|[^A-Za-z0-9_])(?:host(?:name)?|node(?:_name)?)["']?[^\S\r\n]*[:=][^\S\r\n]*["']?|\[[^\S\r\n]*(?:host|node)(?:[^\S\r\n]*[:=][^\S\r\n]*|[^\S\r\n]+|[-_])|(?:^|[^A-Za-z0-9_-])(?:host|node)[-_]|(?:^|[^A-Za-z0-9_])(?:instance(?:_id)?|group(?:_name|_id)?|comm_group|pg_name)["']?[^\S\r\n]*[:=][^\S\r\n]*["']?|\[[^\S\r\n]*(?:instance|group)[^\S\r\n]+|(?:^|[^A-Za-z0-9_])group[^\S\r\n]+|(?:^|[\s"'({[,;])(?:endpoint|target|pod(?:_name)?|exported_instance|http_target)["']?[^\S\r\n]*[:=][^\S\r\n]*["']?(?:https?:\/\/)?)$/i;

/**
 * Explicit diagnostic version labels (`CANN version 8.0.0.1`, `driver_version=24.1.0.1`,
 * `version: "8.0.0.1"`, `{"version":\n"8.0.0.1"}`) where a 4-segment dotted tuple is a benign
 * software/firmware version, not an IPv4.
 */
const EXPLICIT_VERSION_CONTEXT_RE =
  /(?:^|[\s"'([,;])(?:[A-Za-z0-9_.-]+[^\S\r\n]+)?(?<!ip_)(?:version|ver|release|fw_ver|sw_ver|cann_version|driver_version|toolkit_version)["']?[^\S\r\n]*(?:[:=]\s*|[^\S\r\n]+)v?["']?$/i;

function isHorizontalWsCode(code: number): boolean {
  return (
    code === 32 ||
    code === 9 ||
    code === 160 ||
    code === 11 ||
    code === 12 ||
    (code > 127 && /\s/.test(String.fromCharCode(code)))
  );
}

/**
 * Collect a bounded normalized prefix right before an IP match: horizontal whitespace runs (even
 * >48 NBSPs/spaces) collapse to `" "`, and when `allowNewlineAfterColon` is true, newlines
 * immediately following `:`/`=` (e.g. pretty JSON `"version":\n"8.0.0.1"`) also cross cleanly.
 */
function getNormalizedPrefixBeforeIp(src: string, offset: number, allowNewlineAfterColon: boolean): string {
  const out: string[] = [];
  let p = offset - 1;
  let inWsRun = false;
  let skippedWsTotal = 0;
  while (p >= 0 && out.length < 72 && skippedWsTotal < 8192) {
    const code = src.charCodeAt(p);
    if (code === 10 || code === 13) {
      if (!allowNewlineAfterColon) break;
      let q = p;
      let sawColonOrEq = false;
      while (q >= 0 && skippedWsTotal < 8192) {
        const c = src.charCodeAt(q);
        if (c === 10 || c === 13 || isHorizontalWsCode(c)) {
          q -= 1;
          skippedWsTotal += 1;
          continue;
        }
        if (c === 58 || c === 61) {
          sawColonOrEq = true;
        }
        break;
      }
      if (!sawColonOrEq) break;
      if (!inWsRun) {
        out.push(" ");
        inWsRun = true;
      }
      p = q;
      continue;
    }
    if (isHorizontalWsCode(code)) {
      if (!inWsRun) {
        out.push(" ");
        inWsRun = true;
      }
      p -= 1;
      skippedWsTotal += 1;
      continue;
    }
    inWsRun = false;
    out.push(src[p]!);
    p -= 1;
  }
  out.reverse();
  return out.join("");
}

function pickPrivateUseSentinel(raw: string): readonly [string, string] {
  for (let code = 0xe000; code < 0xf8f0; code += 2) {
    const open = String.fromCharCode(code);
    const close = String.fromCharCode(code + 1);
    if (!raw.includes(open) && !raw.includes(close)) return [open, close];
  }
  return ["\u0000IPA", "\u0000"];
}

/**
 * Redact valid IPv4 addresses (including sentence-trailing dot like `192.0.2.12.` when not followed
 * by digits) and all valid RFC-4291 IPv6 forms (including 7-hextet compressed `::`, `%zone`, and
 * IPv4-mapped `::ffff:a.b.c.d`) while preserving version numbers, `1.2.3.4.5`, `[12:34:56]`, and C++ `a::b`
 * outside explicit network address positions.
 *
 * Distinct addresses receive deterministic per-payload aliases in order of first appearance: the
 * first address uses the configured mask verbatim, later distinct addresses get `_<n>` suffixed masks
 * (`<REDACTED_IP_2>`), and analyzer host-tag positions get bare `REDACTED_IP_<n>` aliases. Equal
 * addresses always share one alias, so redaction never merges or splits hosts.
 */
export function redactIpAddresses(raw: string, opts: RedactIpOptions): RedactCountResult {
  const { mask } = opts;
  const bracketedMask = opts.bracketedMask ?? mask;
  let count = 0;
  const [sOpen, sClose] = pickPrivateUseSentinel(raw);
  const found: Array<{ key: string; bracketed: boolean }> = [];
  const placeholder = (key: string, bracketed: boolean): string => {
    found.push({ key, bracketed });
    count += 1;
    return `${sOpen}${found.length - 1}${sClose}`;
  };

  let text = raw.replace(
    /\[([0-9a-fA-F:]+(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}|[0-9a-fA-F:]+)(%[A-Za-z0-9_.-]+)?\]/g,
    (full, core: string, zone: string | undefined) => {
      if (!isValidIpv6Core(core)) return full;
      return placeholder(`${core.toLowerCase()}${zone ?? ""}`, true);
    },
  );

  text = text.replace(
    UNBRACKETED_IPV6_RE,
    (
      full,
      v4Core: string | undefined,
      v4Zone: string | undefined,
      hexCore: string | undefined,
      hexZone: string | undefined,
      offset: number,
    ) => {
      const core = v4Core ?? hexCore ?? "";
      const zone = v4Zone ?? hexZone;
      if (!isSafeUnbracketedIpv6(core, Boolean(zone))) {
        const before = getNormalizedPrefixBeforeIp(text, offset, true);
        if (!EXPLICIT_ADDR_CONTEXT_RE.test(before)) return full;
      }
      return placeholder(`${core.toLowerCase()}${zone ?? ""}`, false);
    },
  );

  text = text.replace(
    /(?<![A-Za-z0-9_.])(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}(?![A-Za-z0-9_]|\.\d)/g,
    (full, offset: number) => {
      const before = getNormalizedPrefixBeforeIp(text, offset, true);
      if (EXPLICIT_VERSION_CONTEXT_RE.test(before)) return full;
      return placeholder(full, false);
    },
  );

  if (found.length === 0) return { text, count };
  const reservedAliasIds = new Set<number>();
  if (/redacted_ip_/i.test(raw)) {
    for (const m of raw.matchAll(/\bREDACTED_IP_(\d+)\b/gi)) {
      reservedAliasIds.add(Number(m[1]));
    }
  }
  let nextAliasId = 1;
  const aliasByKey = new Map<string, number>();
  const sentinelRe = new RegExp(`${sOpen}(\\d+)${sClose}`, "g");
  text = text.replace(sentinelRe, (_m, idRaw: string, offset: number, whole: string) => {
    const entry = found[Number(idRaw)]!;
    let aliasIndex = aliasByKey.get(entry.key);
    if (aliasIndex === undefined) {
      while (reservedAliasIds.has(nextAliasId)) nextAliasId += 1;
      aliasIndex = nextAliasId;
      reservedAliasIds.add(aliasIndex);
      nextAliasId += 1;
      aliasByKey.set(entry.key, aliasIndex);
    }
    const before = getNormalizedPrefixBeforeIp(whole, offset, true);
    if (HOST_TAG_CONTEXT_RE.test(before)) return `REDACTED_IP_${aliasIndex}`;
    return entry.bracketed ? bracketedMask : mask;
  });

  return { text, count };
}

const AUTH_SCHEME_SRC =
  "(?:Bearer|Basic|Token|ApiKey|Digest|Negotiate|NTLM|DPoP|HOBA|Mutual|Vapid|OAuth|Hawk|Signature|AWS4-HMAC-SHA256|SCRAM-[A-Za-z0-9-]+)";
const AUTH_SCHEME_PREFIX_RE = new RegExp(
  `^(${AUTH_SCHEME_SRC})([ \\t]+|\\r\\n|\\r|\\n|\\\\(?:\\r\\n|\\r|\\n))`,
  "i",
);

// RFC 9110 §5.6.2 / §11.1: `token = 1*tchar` has no length cap.
const RFC9110_TCHAR_TOKEN_SRC = "[A-Za-z0-9!#$%&'*+.^_`|~-]+";
/**
 * Structured log fields (`status=401`, `path: /v1/chat`) that follow a credential on the same log
 * line. A credential token68 never has this shape, so the bare-header scan stops before them.
 */
const AUTH_LOG_FIELD_STOP_RE = /^[A-Za-z_][A-Za-z0-9_.-]*(?:=[^=\s]|:[ \t])/;
const NL_SRC = "(?:\\r\\n|\\r|\\n)";
const DIAG_COL0_HEADER_SRC =
  '(?:\\[(?:Rank\\b|\\d|[A-Z]{2,16}(?:\\]|\\b))|(?:\\d{4}[-/]\\d{1,2}[-/]\\d{1,2}|\\d{2}[-/]\\d{2}[ T/]\\d{2}|\\d{2}:\\d{2}:\\d{2})|(?:ERROR|WARN(?:ING)?|INFO|CRITICAL|FATAL|DEBUG|PANIC|TRACE)\\b|(?:Error|Warning|Info|Critical|Fatal|Debug|Traceback|[A-Za-z_][A-Za-z0-9_]*(?:Error|Exception))(?=[\\s:(\\[])|File\\s+"[^"]+",\\s*line\\s+\\d+)';
const DIAG_COL0_CONTINUATION_LOOKAHEAD_SRC = `(?!(?:${DIAG_COL0_HEADER_SRC}))`;
const DIAG_COL0_LINE_RE = new RegExp(`^${DIAG_COL0_HEADER_SRC}`);
const SHELL_BOUNDARY_LINE_RE =
  /^[ \t]*(?:#!\/|(?:export|sudo|nohup|setsid|ssh)[ \t]+(?:[A-Za-z0-9_@.-]|-)|env[ \t]+(?:-[A-Za-z]+[ \t]+)*(?:[A-Za-z_][A-Za-z0-9_]*=[^\s]+[ \t]+|(?:bash|sh|zsh|dash|ksh|curl|vllm|python3?)\b)|(?:[A-Za-z_][A-Za-z0-9_]*=[^\s]+[ \t]+)+(?:vllm[ \t]+serve|python3?[ \t]+(?:-m|-[A-Za-z]*c)|docker[ \t]+(?:run|exec|compose)|kubectl|helm|(?:bash|sh|zsh|dash|ksh)[ \t]+-[A-Za-z]*c|curl|ssh)(?=[ \t]|$)|(?:vllm[ \t]+serve|python3?[ \t]+(?:-m|-[A-Za-z]*c)|docker[ \t]+(?:run|exec|compose)|kubectl|helm|(?:bash|sh|zsh|dash|ksh)[ \t]+-[A-Za-z]*c)(?=[ \t]|$)|curl[ \t]+(?:--?[A-Za-z0-9]|["']?https?:\/\/|[A-Za-z0-9_.-]+(?:\/|:\d))|[A-Za-z0-9_./@-]+[ \t]+(?:--?[A-Za-z0-9_-]+(?:=[^\s]*)?[ \t]+)*(?:&&|\|\||;)[ \t]*(?:curl|vllm|bash|sh|zsh|python3?|ssh)\b|[A-Z][A-Z0-9_]{1,}=[^\s=])/;
const REDACTED_END_LOOKAHEAD_SRC =
  "(?=[\"']*(?:$|[\\r\\n,;|}\\]\\)&#]|\\\\(?:[rnt\"']|\\\\[rn])|[ \\t]+(?:$|\\r?\\n|\\\\(?:$|\\r?\\n)|[\"'|&;<>(){}\\]]|--?[A-Za-z]|(?:https?|wss?|redis|postgres(?:ql)?):\\/\\/|[A-Za-z_][A-Za-z0-9_.-]*(?:=[^=\\s]|:[ \\t])|(?:\\[?Rank\\b|INFO\\b|WARN(?:ING)?\\b|ERROR\\b|CRITICAL\\b|FATAL\\b))))";
const ALREADY_REDACTED_RE = /^["']?\[REDACTED(?:_[A-Z]+)?\]["']?$/;
const ALREADY_REDACTED_AUTH_RE = new RegExp(
  `^(?:${RFC9110_TCHAR_TOKEN_SRC}[ \\t]+)?\\[REDACTED(?:_[A-Z]+)?\\]["']*$`,
  "i",
);
const ALREADY_REDACTED_AUTH_PREFIX_RE = new RegExp(
  `^(?:${RFC9110_TCHAR_TOKEN_SRC}[ \\t]+)?\\[REDACTED(?:_[A-Z]+)?\\](?=["']*(?:$|[\\s,;|}\\]\\)&#]|\\\\(?:$|\\r?\\n)))`,
  "i",
);
const ALREADY_REDACTED_VAL_PREFIX_RE = /^\[REDACTED(?:_[A-Z]+)?\](?=["']*(?:$|[\s,;|}\])&#]|\\(?:$|\r?\n)))/i;
const ALREADY_REDACTED_SHELL_VAL_PREFIX_RE =
  /^\[REDACTED(?:_[A-Z]+)?\](?=["']*(?:$|[\s;|}\])&#]|\\(?:$|\r?\n)))/i;
const BEARER_PROSE_STOP_RE =
  /^(?:of|the|is|was|were|are|be|been|being|to|for|from|in|on|at|by|with|without|and|or|as|that|this|these|those|which|who|whom|whose|can|may|might|will|would|should|could|has|have|had|does|do|did|not|only|also|must|shall)$/i;

const STRONG_CREDENTIAL_KEY_RE =
  /(?:api|access|private|secret|auth|client)[-_ ]?key|apikey|(?:api|jwt|oauth|session|github|gitlab|git|private|bearer|pat|identity|registry|auth|access|refresh|hf|huggingface)[-_ ]?token|session[-_ ]?id|(?:basic|proxy|registry|docker)[-_ ]?auth(?:[-_ ]?config)?|secret|password|passwd|credentials?|cookie|(?:proxy[-_ ]?)?authorization|bearer|(?:^|[-_.])creds$|(?:^|[-_.])(?:ak|sk)$|(?:^|[-_.])pwd$/i;
const TOKEN_KEY_RE = /token/i;
const NON_SECRET_TOKEN_KEY_RE =
  /(?:^(?:bos|eos|pad|unk|cls|sep|mask|stop|think|fim_prefix|fim_middle|fim_suffix)[-_]token(?:[_-]id)?$|(?:^|[_-])(?:tokens(?:[_-][a-z0-9]+)*|token[_-](?:ids?|len|length|count|limit|budget|size|rate|type|index|pos|offset|latency)(?:[_-][a-z0-9]+)*)$|^(?:hf_hub_)?disable_implicit_token$|^(?:disable|no|skip|ignore|strip|suppress)_[a-z0-9_]*token$|^(?:[a-z0-9_-]*[_-])?tokeniz(?:er|ers|ation)(?:[_-](?!.*(?:key|secret|pass|passwd|auth|cred|token(?:$|[_-])))[a-z0-9_-]+)?$)/i;
/**
 * Keys that *name* or *reference* a credential (Kubernetes `secretKeyRef`, Helm `existingSecret`,
 * `imagePullSecrets`, `--password-stdin`) without carrying its value. Their structure is preserved.
 */
const CREDENTIAL_REFERENCE_KEY_RE =
  /^(?:secret(?:Key)?Refs?|secret[-_]?names?|existing[-_]?secret|secret[-_]?provider[-_]?class|image[-_]?pull[-_]?secrets?|password[-_]?stdin)$/i;
/** Credential-name fragments strong enough that even boolean/float-looking values are masked. */
const STRONG_VALUE_CREDENTIAL_KEY_RE =
  /password|passwd|(?:^|[-_.])pwd$|api[-_ ]?key|apikey|access[-_ ]?key|private[-_ ]?key|secret[-_ ]?key|^(?:secret|secrets)$|(?:client|app|api|auth|oauth|webhook|jwt|hmac|signing|shared|private|session|service|admin|master|consumer|bot|vendor|partner|tenant|project|account)[-_ ]?(?:secret|token)|auth|cookie|credential|(?:^|[-_.])creds$|session|bearer|jwt|oauth|(?:^|[-_.])(?:ak|sk)$/i;
const NON_SECRET_LITERAL_VALUE_RE = /^(?:true|false|yes|no|on|off|-?\d+\.\d+(?:[eE][+-]?\d+)?)$/i;

export function isNonSecretTokenKey(rawKey: string): boolean {
  const norm = rawKey.replace(/^--/, "").toLowerCase();
  if (STRONG_CREDENTIAL_KEY_RE.test(norm)) return false;
  return NON_SECRET_TOKEN_KEY_RE.test(norm);
}

export function isCredentialKey(rawKey: string): boolean {
  const clean = rawKey.replace(/^--/, "");
  // POSIX shell `PWD` / `OLDPWD` hold the working directory, not a password.
  if (/^(?:OLD)?PWD$/.test(clean)) return false;
  if (CREDENTIAL_REFERENCE_KEY_RE.test(clean)) return false;
  if (STRONG_CREDENTIAL_KEY_RE.test(clean)) return true;
  if (!TOKEN_KEY_RE.test(clean)) return false;
  return !isNonSecretTokenKey(clean);
}

/**
 * A credential key whose match is only a generic `secret` / `token` fragment (`secret_ratio`,
 * `use_secret`, `token`). Boolean and fractional values of such keys are configuration, not secrets.
 */
export function isWeakCredentialKey(rawKey: string): boolean {
  const clean = rawKey.replace(/^--/, "");
  return isCredentialKey(clean) && !STRONG_VALUE_CREDENTIAL_KEY_RE.test(clean);
}

/** True when a weak credential key carries a boolean / fractional literal (or a list of them). */
function isNonSecretLiteralText(rawKey: string, valueText: string): boolean {
  if (!isWeakCredentialKey(rawKey)) return false;
  const v = valueText.trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
  if (NON_SECRET_LITERAL_VALUE_RE.test(v)) return true;
  const listM = /^\[([\s\S]*)\]$/.exec(v);
  if (!listM) return false;
  const items = listM[1]!.split(",").map((s) => s.trim());
  return items.every((s) => s === "" || /^-?\d+(?:\.\d+)?$/.test(s) || NON_SECRET_LITERAL_VALUE_RE.test(s));
}

/**
 * True when a weak credential key holds a typed non-string value (boolean/number or list thereof)
 * such as `use_secret: false` or `secret_ratio: 0.25`. Shared with structured JSON sanitizers.
 */
export function isNonSecretTypedValue(rawKey: string, value: unknown): boolean {
  if (!isWeakCredentialKey(rawKey)) return false;
  if (typeof value === "boolean" || typeof value === "number") return true;
  if (Array.isArray(value)) {
    return value.length > 0 && value.every((item) => typeof item === "boolean" || typeof item === "number");
  }
  return false;
}

function consumeNewline(text: string, idx: number): number {
  if (idx >= text.length) return -1;
  if (text[idx] === "\r" && text[idx + 1] === "\n") return idx + 2;
  if (text[idx] === "\r" || text[idx] === "\n") return idx + 1;
  return -1;
}

function isDiagCol0At(text: string, lineStart: number): boolean {
  if (lineStart < 0 || lineStart >= text.length) return false;
  return DIAG_COL0_LINE_RE.test(text.slice(lineStart, lineStart + 96));
}

function isShellBoundaryAt(text: string, lineStart: number): boolean {
  if (lineStart < 0 || lineStart >= text.length) return false;
  return SHELL_BOUNDARY_LINE_RE.test(text.slice(lineStart, lineStart + 160));
}

function lineOpensOwnQuote(text: string, lineStart: number, quote: '"' | "'"): boolean {
  let p = lineStart;
  let firstQ = -1;
  while (p < text.length && text[p] !== "\r" && text[p] !== "\n") {
    const c = text[p]!;
    if (quote === '"' && c === "\\" && p + 1 < text.length && text[p + 1] !== "\r" && text[p + 1] !== "\n") {
      p += 2;
      continue;
    }
    if (quote === "'" && c === "'" && p + 1 < text.length && text[p + 1] === "'") {
      p += 2;
      continue;
    }
    if (c === quote && firstQ === -1) {
      firstQ = p;
    }
    p += 1;
  }
  if (firstQ === -1) return false;
  const beforeOk = firstQ === lineStart || /[\s=:(,[{]/.test(text[firstQ - 1]!);
  if (!beforeOk) return false;
  let after = firstQ + 1;
  while (after < p && (text[after] === " " || text[after] === "\t")) after += 1;
  return after < p && !/^(?:#|;|\||&|<|>|\d+[<>]|[,}\])])/.test(text.slice(after, p));
}

function isSglQuoteClosingAfterBackslash(text: string, afterQuoteIdx: number): boolean {
  if (afterQuoteIdx >= text.length) return true;
  const next = text[afterQuoteIdx]!;
  const isDelim =
    next === " " ||
    next === "\t" ||
    next === "\r" ||
    next === "\n" ||
    next === ";" ||
    next === "," ||
    next === ")" ||
    next === "}" ||
    next === "]" ||
    next === "&" ||
    next === "|";
  if (!isDelim) return false;
  if (next === ")" || next === "}" || next === "]") {
    const afterClose = text[afterQuoteIdx + 1];
    if (
      afterClose !== undefined &&
      afterClose !== " " &&
      afterClose !== "\t" &&
      afterClose !== "\r" &&
      afterClose !== "\n" &&
      afterClose !== "," &&
      afterClose !== ";" &&
      afterClose !== ")" &&
      afterClose !== "}" &&
      afterClose !== "]" &&
      afterClose !== "&" &&
      afterClose !== "|"
    ) {
      return false;
    }
  }
  const eol = findLineEnd(text, afterQuoteIdx);
  let rawSglQuotes = 0;
  let inDoubleQuote = false;
  let bracketDepth = 1;
  let parenDepth = 1;
  for (let p = afterQuoteIdx; p < eol; p += 1) {
    const ch = text[p]!;
    if (inDoubleQuote) {
      if (ch === "\\" && p + 1 < eol) {
        p += 1;
      } else if (ch === '"') {
        inDoubleQuote = false;
      }
      continue;
    }
    if (ch === '"') {
      inDoubleQuote = true;
      continue;
    }
    if (ch === "'") {
      if (text[p + 1] === "'") {
        p += 1;
      } else {
        rawSglQuotes += 1;
      }
      continue;
    }
    if (rawSglQuotes % 2 === 0) {
      if (ch === "[") {
        bracketDepth += 1;
      } else if (ch === "]") {
        if (bracketDepth > 0) bracketDepth -= 1;
        if (bracketDepth === 0) {
          const rest = text.slice(p + 1, eol);
          if (
            /^[ \t]*(?:\)|,[ \t]*[A-Za-z_][A-Za-z0-9_]*[ \t]*=|[ \t]+[A-Za-z_]+'[A-Za-z]+|[ \t]*$)/i.test(
              rest,
            )
          ) {
            break;
          }
        }
      } else if (ch === "(") {
        parenDepth += 1;
      } else if (ch === ")") {
        if (parenDepth > 0) parenDepth -= 1;
        if (parenDepth === 0) break;
      } else if (
        bracketDepth <= 1 &&
        ch === "," &&
        /^,[ \t]*[A-Za-z_][A-Za-z0-9_]*[ \t]*=/.test(text.slice(p, Math.min(eol, p + 64)))
      ) {
        break;
      }
    }
  }
  return rawSglQuotes % 2 === 0;
}

/**
 * Scan a double- or single-quoted scalar starting at `openIdx`, honoring backslash escapes,
 * YAML `''` doubled single quotes, legitimate line continuations, and col-0 diagnostic log
 * boundaries so unclosed partial pastes never swallow subsequent `ERROR` / `INFO` lines.
 */
function scanQuotedScalar(
  text: string,
  openIdx: number,
  quote: '"' | "'",
  stopAtDiagCol0 = true,
): { end: number; closed: boolean } {
  let i = openIdx + 1;
  let firstShellBoundaryIdx = -1;
  while (i < text.length) {
    const ch = text[i]!;
    if (ch === "\r" || ch === "\n") {
      const nextLine = consumeNewline(text, i);
      if (stopAtDiagCol0) {
        if (isDiagCol0At(text, nextLine) || lineOpensOwnQuote(text, nextLine, quote)) {
          return { end: firstShellBoundaryIdx !== -1 ? firstShellBoundaryIdx : i, closed: false };
        }
        if (firstShellBoundaryIdx === -1 && isShellBoundaryAt(text, nextLine)) {
          firstShellBoundaryIdx = i;
        }
      }
      i = nextLine;
      continue;
    }
    if (quote === '"') {
      if (ch === "\\" && i + 1 < text.length) {
        const afterNl = consumeNewline(text, i + 1);
        if (afterNl !== -1) {
          if (stopAtDiagCol0 && isDiagCol0At(text, afterNl)) {
            return { end: i + 1, closed: false };
          }
          i = afterNl;
          continue;
        }
        i += 2;
        continue;
      }
      if (ch === '"') return { end: i + 1, closed: true };
      i += 1;
    } else {
      if (ch === "'") {
        if (text[i + 1] === "'") {
          i += 2;
          continue;
        }
        return { end: i + 1, closed: true };
      }
      if (ch === "\\" && i + 1 < text.length) {
        const afterNl = consumeNewline(text, i + 1);
        if (afterNl !== -1) {
          if (stopAtDiagCol0 && isDiagCol0At(text, afterNl)) {
            return { end: i + 1, closed: false };
          }
          i = afterNl;
          continue;
        }
        if (text[i + 1] === "'") {
          if (isSglQuoteClosingAfterBackslash(text, i + 2)) {
            return { end: i + 2, closed: true };
          }
          const eol = findLineEnd(text, i + 2);
          if (!text.slice(i + 2, eol).includes("'")) {
            return { end: i + 2, closed: true };
          }
          i += 2;
          continue;
        }
        i += 2;
        continue;
      }
      i += 1;
    }
  }
  return { end: firstShellBoundaryIdx !== -1 ? firstShellBoundaryIdx : text.length, closed: false };
}

function splitSchemePrefix(body: string): { schemePrefix: string; rest: string } {
  const m = AUTH_SCHEME_PREFIX_RE.exec(body);
  if (!m) return { schemePrefix: "", rest: body };
  const rest = body.slice(m[0].length).replace(/^[ \t]+/, "");
  return { schemePrefix: `${m[1]} `, rest };
}

function countLineBreaks(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    if (c === 10) n += 1;
    else if (c === 13 && s.charCodeAt(i + 1) !== 10) n += 1;
  }
  return n;
}

/**
 * Keep the physical line count of a masked span: append one line break per line break the mask
 * removed. Unquoted shell `\`-continued spans keep ` \`-continuation padding so the command
 * stays one logical line; all other spans emit neutral `\n` breaks so downstream line numbers
 * (`firstFaultLineNumber`, truncation markers) never shift.
 */
export function padRemovedLineBreaks(original: string, replacement: string): string {
  const missing = countLineBreaks(original) - countLineBreaks(replacement);
  if (missing <= 0) return replacement;
  const lastLf = original.lastIndexOf("\n");
  const lastCr = original.lastIndexOf("\r");
  const lastNl = Math.max(lastLf, lastCr);
  const nlStart = lastLf > 0 && original[lastLf - 1] === "\r" && lastLf === lastNl ? lastLf - 1 : lastNl;
  const isUnquotedShellCont =
    nlStart > 0 && original[nlStart - 1] === "\\" && !replacement.endsWith('"') && !replacement.endsWith("'");
  return replacement + (isUnquotedShellCont ? " \\\n" : "\n").repeat(missing);
}

/** O(line length) end-of-line lookup (never scans the remainder of the text for an absent `\r`). */
function findLineEnd(text: string, from: number): number {
  let i = from;
  while (i < text.length) {
    const c = text.charCodeAt(i);
    if (c === 10 || c === 13) return i;
    i += 1;
  }
  return text.length;
}

function createMonotonicIndentLookup(src: string): (pos: number) => number {
  let cachedEnd = -1;
  let cachedIndent = 0;
  return (pos: number): number => {
    if (pos > cachedEnd) {
      let ls = pos;
      while (ls > 0) {
        const prev = src.charCodeAt(ls - 1);
        if (prev === 10 || prev === 13) break;
        ls -= 1;
      }
      let p = ls;
      while (p < src.length && (src.charCodeAt(p) === 32 || src.charCodeAt(p) === 9)) p += 1;
      cachedIndent = p - ls;
      cachedEnd = findLineEnd(src, pos);
    }
    return cachedIndent;
  };
}

const AUTH_SCHEME_TOKEN_STICKY_RE = new RegExp(RFC9110_TCHAR_TOKEN_SRC, "y");

/**
 * Strict O(token) check for whether an Authorization header value already begins with
 * `[REDACTED...]` or `<Scheme> [REDACTED...]`. Returns the end index of the redacted token so
 * callers can advance `lastIndex`, or `-1` when not already masked.
 */
function findAlreadyRedactedAuthPrefixEnd(
  src: string,
  valStart: number,
  allowSingleTokenNonSchemeTerminator = false,
): number {
  if (ALREADY_REDACTED_VAL_PREFIX_RE.test(src.slice(valStart, valStart + 64))) {
    const closeIdx = src.indexOf("]", valStart);
    return closeIdx !== -1 ? closeIdx + 1 : valStart + 10;
  }
  AUTH_SCHEME_TOKEN_STICKY_RE.lastIndex = valStart;
  const sm = AUTH_SCHEME_TOKEN_STICKY_RE.exec(src);
  if (!sm) return -1;
  let pos = valStart + sm[0].length;
  const gapStart = pos;
  while (pos < src.length && (src[pos] === " " || src[pos] === "\t")) pos += 1;
  if (pos === gapStart) return -1;
  const preview = src.slice(pos, pos + 64);
  if (
    ALREADY_REDACTED_VAL_PREFIX_RE.test(preview) ||
    (allowSingleTokenNonSchemeTerminator &&
      /^(?:Bearer|Basic|Token|ApiKey|Negotiate|NTLM|DPoP|HOBA|Vapid)$/i.test(sm[0]) &&
      /^\[REDACTED(?:_[A-Z]+)?\](?:$|[^A-Za-z0-9._~+/=:-])/i.test(preview))
  ) {
    const closeIdx = src.indexOf("]", pos);
    return closeIdx !== -1 ? closeIdx + 1 : pos + 10;
  }
  return -1;
}

function replaceMatchedSpans(
  text: string,
  edits: ReadonlyArray<{ start: number; end: number; replacement: string }>,
): string {
  if (edits.length === 0) return text;
  let out = "";
  let cursor = 0;
  for (const e of edits) {
    if (e.start < cursor) continue;
    out += text.slice(cursor, e.start) + padRemovedLineBreaks(text.slice(e.start, e.end), e.replacement);
    cursor = e.end;
  }
  return out + text.slice(cursor);
}

function isFoldedHeaderContinuation(
  text: string,
  nlIdx: number,
  headerLineIndent: number,
  mode: "auth" | "digest" | "cookie",
): number {
  const nextLineStart = consumeNewline(text, nlIdx);
  if (nextLineStart === -1 || nextLineStart >= text.length) return -1;
  if (isDiagCol0At(text, nextLineStart)) return -1;
  let ws = nextLineStart;
  while (ws < text.length && (text[ws] === " " || text[ws] === "\t")) ws += 1;
  const lineIndent = ws - nextLineStart;
  if (lineIndent === 0 || lineIndent <= headerLineIndent || ws >= text.length) return -1;
  const ch = text[ws]!;
  if (ch === "\r" || ch === "\n") return -1;
  let lineEnd = ws;
  while (lineEnd < text.length && text[lineEnd] !== "\r" && text[lineEnd] !== "\n") lineEnd += 1;
  const lineRest = text.slice(ws, lineEnd);
  if (/^(?:--?[A-Za-z]|-(?:[ \t]|$)|(?:https?|wss?|redis|postgres(?:ql)?):\/\/)/i.test(lineRest)) {
    return -1;
  }
  if (/^(?:"[^"]+"|'[^']+'|[A-Za-z0-9_.-]+)[ \t]*:(?:[ \t]|$)/.test(lineRest)) {
    return -1;
  }
  if (mode === "auth") {
    if (/^[A-Za-z_][A-Za-z0-9_]*=[^\s=]/.test(lineRest)) return -1;
    if (/^(?:\[?Rank\b|INFO\b|WARN(?:ING)?\b|ERROR\b|CRITICAL\b|FATAL\b)/.test(lineRest)) return -1;
  } else if (mode === "digest") {
    if (/^[A-Z_][A-Z0-9_]*=[^\s=]/.test(lineRest)) return -1;
    if (/^(?:\[?Rank\b|INFO\b|WARN(?:ING)?\b|ERROR\b|CRITICAL\b|FATAL\b)/.test(lineRest)) return -1;
  } else if (!/^(?:;[ \t]*|[A-Za-z0-9_.-]+=)/.test(lineRest)) {
    return -1;
  }
  return ws;
}

function isShellWordConcatDelimiter(ch: string): boolean {
  if (
    ch === " " ||
    ch === "\t" ||
    ch === "\r" ||
    ch === "\n" ||
    ch === ";" ||
    ch === "|" ||
    ch === "&" ||
    ch === "<" ||
    ch === ">" ||
    ch === "(" ||
    ch === ")" ||
    ch === "{" ||
    ch === "}" ||
    ch === "]" ||
    ch === ","
  ) {
    return true;
  }
  const code = ch.charCodeAt(0);
  return (code >= 0x3000 && code <= 0x303f) || (code >= 0xff00 && code <= 0xffef);
}

/**
 * Scan a shell-quoted argument (e.g. `curl -H 'one'\''two'`, `'demo'sample`), supporting
 * zero-whitespace POSIX quote concatenation and adjacent unquoted shell word segments (including
 * inside outer `bash -c "..."` quotes, stopping at the outer closing quote or collection boundary).
 */
function scanShellQuotedArg(
  text: string,
  openIdx: number,
  quote: '"' | "'",
  stopAtDiagCol0 = true,
  precomputedFlowCtx?: FlowContextInfo,
): { end: number; closed: boolean } {
  const first = scanQuotedScalar(text, openIdx, quote, stopAtDiagCol0);
  if (!first.closed) return first;
  const flowCtx = precomputedFlowCtx ?? isInsideFlowContext(text, openIdx);
  if (flowCtx.inBraceOrBracket || flowCtx.outerQuote === quote) return first;
  let k = first.end;
  while (k < text.length) {
    const ch = text[k]!;
    if (flowCtx.outerQuote !== null && ch === flowCtx.outerQuote) break;
    if (ch === "\\") {
      const afterNl = consumeNewline(text, k + 1);
      if (afterNl !== -1) {
        if (stopAtDiagCol0 && isDiagCol0At(text, afterNl)) return { end: k + 1, closed: false };
        let ws = afterNl;
        while (ws < text.length && (text[ws] === " " || text[ws] === "\t")) ws += 1;
        if (ws >= text.length || isShellWordConcatDelimiter(text[ws]!)) break;
        if (flowCtx.outerQuote !== null && text[ws] === flowCtx.outerQuote) break;
        k = ws;
        continue;
      }
      if (k + 1 < text.length) {
        k += 2;
        continue;
      }
      break;
    }
    if (ch === '"' || ch === "'") {
      const next = scanQuotedScalar(text, k, ch, stopAtDiagCol0);
      k = next.end;
      if (!next.closed) return { end: k, closed: false };
      continue;
    }
    if (isShellWordConcatDelimiter(ch)) break;
    k += 1;
  }
  return { end: k, closed: true };
}

const MULTIVALUE_SECRET_FLAG_RE = /^--(?:api[-_]?keys?|tokens?|bearer[-_]?tokens?)$/i;
type CliCmdProfile = "generic" | "curl" | "container-login" | "mysql" | "sshpass" | "obsutil";
const CONTAINER_LOGIN_CMDS = new Set(["docker", "podman", "nerdctl", "helm", "crictl"]);
const MYSQL_CMDS = new Set(["mysql", "mariadb", "mysqldump", "mysqladmin", "mysqlsh"]);
const SHORT_CURL_FLAG_RE = /^-[sSfkLiIvNg46ORZnGaq]*(?:b[uU]|[uUb])$/;
const SHORT_CURL_ATTACHED_RE = /^(-[sSfkLiIvNg46ORZnGaq]*(?:b[uU]|[uUb]))(.+)$/;

export interface ArgvSecretState {
  cmd: string | null;
  profile: CliCmdProfile;
  expectingFlagValue: boolean;
  cmdLocked?: boolean;
  wrapper?: string | null;
  wrapperPositional?: "none" | "duration" | "cpumask" | "priority";
  wrapperOptionsEnded?: boolean;
  expectingDuration?: boolean;
  pendingNext?: Extract<ArgvFlagAction, { kind: "next" }> | null;
  pendingTaken?: number;
}

const PRE_CMD_WRAPPER_FLAGS: Readonly<Record<string, ReadonlySet<string>>> = {
  sudo: new Set([
    "-u",
    "--user",
    "-g",
    "--group",
    "-h",
    "--host",
    "-p",
    "--prompt",
    "-r",
    "--role",
    "-t",
    "--type",
    "-U",
    "--other-user",
    "-C",
    "--close-from",
  ]),
  env: new Set(["-u", "--unset", "-C", "--chdir", "-S", "--split-string", "-a", "--argv0"]),
  nice: new Set(["-n", "--adjustment"]),
  taskset: new Set(["-c", "--cpu-list"]),
  stdbuf: new Set(["-i", "--input", "-o", "--output", "-e", "--error"]),
  timeout: new Set(["-s", "--signal", "-k", "--kill-after"]),
  numactl: new Set([
    "-C",
    "--physcpubind",
    "-N",
    "--cpunodebind",
    "-m",
    "--membind",
    "-i",
    "--interleave",
    "-p",
    "--preferred",
  ]),
  chrt: new Set(["-p", "--pid"]),
  ionice: new Set(["-c", "--class", "-n", "--classdata", "-p", "--pid"]),
  strace: new Set(["-p", "--attach", "-o", "--output", "-e", "--trace"]),
};
const PRE_CMD_WRAPPERS = new Set([
  "sudo",
  "env",
  "nohup",
  "setsid",
  "exec",
  "command",
  "time",
  "nice",
  "ionice",
  "chrt",
  "taskset",
  "timeout",
  "stdbuf",
  "strace",
  "numactl",
  "--",
]);
const LOG_PREFIX_TOKEN_RE =
  /^(?:TRACE|DEBUG|INFO|WARN(?:ING)?|ERROR|CRITICAL|FATAL|PANIC|NOTICE|ALERT|PID|TID|\[[^\]\r\n]+\]:?|\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:[T_]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?)?|\d{2}:\d{2}:\d{2}(?:[.,]\d+)?)$/i;

/** Splits a shell-style string (`"docker login -p"`) into quote-aware tokens for argv state seeding. */
export function splitArgvTokensForSeed(text: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < text.length) {
    while (i < text.length && /\s/.test(text[i]!)) i += 1;
    if (i >= text.length) break;
    let cur = "";
    let quote: '"' | "'" | null = null;
    while (i < text.length) {
      const ch = text[i]!;
      if (quote) {
        if (quote === '"' && ch === "\\" && i + 1 < text.length) {
          cur += text[i + 1]!;
          i += 2;
          continue;
        }
        if (ch === quote) {
          quote = null;
          i += 1;
          continue;
        }
        cur += ch;
        i += 1;
        continue;
      }
      if (/\s/.test(ch)) break;
      if (ch === '"' || ch === "'") {
        quote = ch;
        i += 1;
        continue;
      }
      if (ch === "\\" && i + 1 < text.length) {
        cur += text[i + 1]!;
        i += 2;
        continue;
      }
      cur += ch;
      i += 1;
    }
    if (cur) tokens.push(cur);
  }
  return tokens;
}

function stripMatchingArgvQuotes(token: string): string {
  const t = token.trim();
  if (t.length >= 2 && ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))) {
    return t.slice(1, -1);
  }
  return t;
}

function basenameLower(token: string): string {
  const clean = stripMatchingArgvQuotes(token);
  const slash = Math.max(clean.lastIndexOf("/"), clean.lastIndexOf("\\"));
  return (slash >= 0 ? clean.slice(slash + 1) : clean).toLowerCase();
}

export function createArgvSecretState(): ArgvSecretState {
  return {
    cmd: null,
    profile: "generic",
    expectingFlagValue: false,
    cmdLocked: false,
    wrapper: null,
    wrapperPositional: "none",
    wrapperOptionsEnded: false,
    expectingDuration: false,
    pendingNext: null,
    pendingTaken: 0,
  };
}

function advanceArgvCmdState(state: ArgvSecretState, rawToken: string): void {
  const t = stripMatchingArgvQuotes(rawToken);
  if (!t) return;
  if (state.expectingFlagValue) {
    state.expectingFlagValue = false;
    return;
  }
  if (state.cmd === null) {
    if (t === "--") {
      if (state.wrapper !== null) {
        state.wrapperOptionsEnded = true;
      }
      state.expectingFlagValue = false;
      return;
    }
    const baseTok = basenameLower(t);
    if (state.wrapperPositional === "none" && PRE_CMD_WRAPPERS.has(baseTok)) {
      state.wrapper = baseTok === "--" ? null : baseTok;
      state.wrapperPositional =
        baseTok === "timeout"
          ? "duration"
          : baseTok === "taskset"
            ? "cpumask"
            : baseTok === "chrt"
              ? "priority"
              : "none";
      state.wrapperOptionsEnded = false;
      state.expectingDuration = state.wrapperPositional === "duration";
      state.expectingFlagValue = false;
      return;
    }
    if (!state.wrapperOptionsEnded && t.startsWith("-")) {
      const wrapperFlags = state.wrapper ? PRE_CMD_WRAPPER_FLAGS[state.wrapper] : undefined;
      if (wrapperFlags && !t.includes("=") && wrapperFlags.has(t)) {
        state.expectingFlagValue = true;
      }
      if (state.wrapper === "taskset" && /^-(?:[a-z]*[cp][a-z]*|-(?:cpu-list|pid)(?:=|$))/i.test(t)) {
        state.wrapperPositional = "none";
      } else if (state.wrapper === "chrt" && /^-(?:[a-z]*p[a-z]*|-pid(?:=|$))/i.test(t)) {
        state.wrapperPositional = "none";
      }
      return;
    }
    if (
      state.wrapper === null &&
      (LOG_PREFIX_TOKEN_RE.test(t) || (t.endsWith(":") && t.length > 1 && !/^\//.test(t)))
    ) {
      return;
    }
    const posKind = state.wrapperPositional ?? (state.expectingDuration ? "duration" : "none");
    if (posKind === "duration" && /^\d+(?:\.\d+)?[smhd]?$/i.test(t)) {
      state.wrapperPositional = "none";
      state.expectingDuration = false;
      return;
    }
    if (posKind === "cpumask" && /^(?:0x)?[0-9a-fA-F]+(?:,(?:0x)?[0-9a-fA-F]+)*$/.test(t)) {
      state.wrapperPositional = "none";
      return;
    }
    if (posKind === "priority" && /^\d+$/.test(t)) {
      state.wrapperPositional = "none";
      return;
    }
    state.wrapperPositional = "none";
    state.expectingDuration = false;
    state.wrapperOptionsEnded = false;
  } else if (t.startsWith("-")) {
    if (
      state.profile === "container-login" &&
      (t === "-u" || t === "--username" || t === "-e" || t === "--env")
    ) {
      state.expectingFlagValue = true;
    } else if (
      !state.cmdLocked &&
      CONTAINER_LOGIN_CMDS.has(state.cmd) &&
      (t === "-H" ||
        t === "--host" ||
        t === "-c" ||
        t === "--context" ||
        t === "--config" ||
        t === "--kubeconfig" ||
        t === "--kube-context" ||
        t === "--kube-apiserver" ||
        t === "--kube-token" ||
        t === "--kube-ca-file" ||
        t === "--registry-config" ||
        t === "--root" ||
        t === "--runroot" ||
        t === "--address" ||
        t === "--tlscacert" ||
        t === "--tlscert" ||
        t === "--tlskey" ||
        t === "-n" ||
        t === "--namespace" ||
        t === "-l" ||
        t === "--log-level")
    ) {
      state.expectingFlagValue = true;
    }
    return;
  }
  if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(t)) return;
  if (state.cmdLocked) return;
  const base = basenameLower(t);
  if (state.cmd && CONTAINER_LOGIN_CMDS.has(state.cmd)) {
    if (base === "login") {
      state.profile = "container-login";
    }
    state.cmdLocked = true;
    return;
  }
  if (base === "curl") {
    state.cmd = base;
    state.profile = "curl";
    state.cmdLocked = true;
  } else if (CONTAINER_LOGIN_CMDS.has(base)) {
    state.cmd = base;
    state.profile = "generic";
    state.cmdLocked = false;
  } else if (MYSQL_CMDS.has(base)) {
    state.cmd = base;
    state.profile = "mysql";
    state.cmdLocked = true;
  } else if (base === "sshpass") {
    state.cmd = base;
    state.profile = "sshpass";
    state.cmdLocked = true;
  } else if (base === "obsutil") {
    state.cmd = base;
    state.profile = "obsutil";
    state.cmdLocked = true;
  } else {
    state.cmd = base;
    state.profile = "generic";
    state.cmdLocked = true;
  }
}

/** True when a token starting with `-` looks like another CLI option rather than a secret starting with `-`. */
export function isArgvFlagBoundary(rawToken: string): boolean {
  const t = rawToken.trim();
  if (!t.startsWith("-")) return false;
  if (t.startsWith("--")) return true;
  if (/^-[A-Za-z][A-Za-z0-9_-]*=/.test(t)) return true;
  if (/^-[A-Za-z0-9]{1,3}$/.test(t)) return true;
  return /^-[sSfkLiIvNg46ORZnGaquUb]{2,5}$/.test(t);
}

/**
 * Required single-operand CLI flags (`docker login -p <pw>`, `docker login --password <pw>`,
 * `sshpass -p <pw>`, `curl -u <user:pw>`, `obsutil -i/-k`) consume the immediate next token even
 * when it looks like `--port` or `--demo`; optional/weak-style flags still stop on options.
 */
export function isMandatoryOperandFlagBoundary(rawToken: string, requiresOperand: boolean): boolean {
  if (!isArgvFlagBoundary(rawToken)) return false;
  return !requiresOperand;
}

export type ArgvFlagAction =
  | { kind: "none" }
  | { kind: "inline"; valueOffset: number }
  | { kind: "next"; multi: boolean; weakFlag: string | null; requiresOperand: boolean };

export function advanceArgvSeedFromState(
  baseState: ArgvSecretState,
  tokens: Iterable<unknown>,
): ArgvSecretState {
  const state: ArgvSecretState = {
    ...baseState,
    pendingNext: baseState.pendingNext ? { ...baseState.pendingNext } : null,
  };
  let pendingNext: Extract<ArgvFlagAction, { kind: "next" }> | null = state.pendingNext ?? null;
  let pendingTaken = state.pendingTaken ?? 0;
  for (const raw of tokens) {
    if (typeof raw !== "string") {
      pendingNext = null;
      pendingTaken = 0;
      continue;
    }
    const t = raw.trim();
    if (pendingNext) {
      const isBoundary = isMandatoryOperandFlagBoundary(t, pendingNext.requiresOperand && pendingTaken === 0);
      const skipWeak = pendingNext.weakFlag !== null && isNonSecretTypedValue(pendingNext.weakFlag, t);
      if (!isBoundary && !skipWeak) {
        pendingTaken += 1;
        if (!pendingNext.multi) {
          pendingNext = null;
          pendingTaken = 0;
        }
        continue;
      }
      pendingNext = null;
      pendingTaken = 0;
    }
    const act = classifyArgvSecretToken(state, t);
    if (act.kind === "next") {
      pendingNext = act;
      pendingTaken = 0;
    }
  }
  state.pendingNext = pendingNext;
  state.pendingTaken = pendingTaken;
  return state;
}

export function seedArgvSecretState(tokens: Iterable<unknown>): ArgvSecretState {
  return advanceArgvSeedFromState(createArgvSecretState(), tokens);
}

export function classifyArgvSecretToken(state: ArgvSecretState, tokenText: string): ArgvFlagAction {
  if (!tokenText.startsWith("-")) {
    advanceArgvCmdState(state, tokenText);
    return { kind: "none" };
  }
  const eqIdx = tokenText.indexOf("=");
  if (eqIdx > 1) {
    const flag = tokenText.slice(0, eqIdx);
    const val = tokenText.slice(eqIdx + 1);
    const isSecretLong =
      flag.startsWith("--") &&
      (isCredentialKey(flag) || (state.profile === "curl" && /^--(?:proxy-)?user(?:name)?$/i.test(flag)));
    const isSecretShort =
      ((state.profile === "container-login" || state.profile === "sshpass" || state.profile === "mysql") &&
        flag === "-p") ||
      (state.profile === "obsutil" && (flag === "-i" || flag === "-k")) ||
      (state.profile === "curl" && SHORT_CURL_FLAG_RE.test(flag));
    if (
      (isSecretLong || isSecretShort) &&
      !(isWeakCredentialKey(flag) && isNonSecretLiteralText(flag, val))
    ) {
      return { kind: "inline", valueOffset: eqIdx + 1 };
    }
    if (tokenText.startsWith("--")) {
      return { kind: "none" };
    }
  }
  if (
    (state.profile === "container-login" || state.profile === "sshpass" || state.profile === "mysql") &&
    tokenText.startsWith("-p") &&
    tokenText.length > 2
  ) {
    return { kind: "inline", valueOffset: 2 };
  }
  if (
    state.profile === "obsutil" &&
    (tokenText.startsWith("-i") || tokenText.startsWith("-k")) &&
    tokenText.length > 2
  ) {
    return { kind: "inline", valueOffset: 2 };
  }
  if (state.profile === "curl") {
    const attM = SHORT_CURL_ATTACHED_RE.exec(tokenText);
    if (attM?.[1]) return { kind: "inline", valueOffset: attM[1].length };
  }
  if (/^--[A-Za-z][A-Za-z0-9_-]*$/.test(tokenText)) {
    const isCred =
      isCredentialKey(tokenText) ||
      (state.profile === "curl" && /^--(?:proxy-)?user(?:name)?$/i.test(tokenText));
    if (isCred) {
      const multi = MULTIVALUE_SECRET_FLAG_RE.test(tokenText);
      const requiresOperand =
        !multi &&
        (state.profile === "container-login" ||
          state.profile === "sshpass" ||
          /^--(?:password|passwd)$/i.test(tokenText));
      return {
        kind: "next",
        multi,
        weakFlag: isWeakCredentialKey(tokenText) ? tokenText : null,
        requiresOperand,
      };
    }
  }
  if ((state.profile === "container-login" || state.profile === "sshpass") && tokenText === "-p") {
    return { kind: "next", multi: false, weakFlag: null, requiresOperand: true };
  }
  if (state.profile === "obsutil" && (tokenText === "-i" || tokenText === "-k")) {
    return { kind: "next", multi: false, weakFlag: null, requiresOperand: true };
  }
  if (state.profile === "curl" && SHORT_CURL_FLAG_RE.test(tokenText)) {
    return { kind: "next", multi: false, weakFlag: null, requiresOperand: true };
  }
  advanceArgvCmdState(state, tokenText);
  return { kind: "none" };
}

const WRAPPER_DUMMY_VALUE_FLAG: Readonly<Record<string, string>> = {
  sudo: "-u",
  env: "-u",
  nice: "-n",
  taskset: "-c",
  stdbuf: "-o",
  timeout: "-s",
  numactl: "-C",
  chrt: "-p",
  ionice: "-c",
  strace: "-o",
};

/**
 * Redacts CLI credentials inside a standalone string fragment (`command` or `args` string in Compose/K8s)
 * when a sibling `entrypoint`/`command` field already established a specialized CLI profile or pending flag.
 */
export function redactCommandFragmentWithSeed(text: string, seed: ArgvSecretState, mask: string): string {
  const trimmed = text.trim();
  if (!trimmed) return text;
  if (seed.pendingNext) {
    const isBoundary = isMandatoryOperandFlagBoundary(
      trimmed,
      seed.pendingNext.requiresOperand && (seed.pendingTaken ?? 0) === 0,
    );
    const skipWeak =
      seed.pendingNext.weakFlag !== null && isNonSecretTypedValue(seed.pendingNext.weakFlag, trimmed);
    if (!isBoundary && !skipWeak && !/\s/.test(trimmed)) {
      return mask;
    }
  }
  const cmdPrefix = seed.pendingNext
    ? seed.pendingNext.requiresOperand
      ? "docker login -p "
      : seed.pendingNext.multi
        ? "--api-key "
        : "--password "
    : seed.expectingFlagValue
      ? seed.cmd === null && seed.wrapper
        ? `${seed.wrapper} ${WRAPPER_DUMMY_VALUE_FLAG[seed.wrapper] ?? "-u"} `
        : seed.cmd && !seed.cmdLocked && CONTAINER_LOGIN_CMDS.has(seed.cmd)
          ? `${seed.cmd} --context `
          : seed.profile === "container-login"
            ? `${seed.cmd ?? "docker"} login -u `
            : "cmd -u "
      : seed.cmd && !seed.cmdLocked && CONTAINER_LOGIN_CMDS.has(seed.cmd)
        ? `${seed.cmd} `
        : seed.profile === "container-login"
          ? `${seed.cmd ?? "docker"} login `
          : seed.profile === "mysql"
            ? "mysql "
            : seed.profile === "sshpass"
              ? "sshpass "
              : seed.profile === "obsutil"
                ? "obsutil "
                : seed.profile === "curl"
                  ? "curl "
                  : seed.cmd === null && seed.wrapper
                    ? seed.wrapperPositional === "duration"
                      ? "timeout "
                      : seed.wrapperPositional === "cpumask"
                        ? seed.wrapperOptionsEnded
                          ? "taskset -- "
                          : "taskset "
                        : seed.wrapperPositional === "priority"
                          ? "chrt "
                          : `${seed.wrapper} `
                    : "";
  if (!cmdPrefix) return text;
  const res = redactDiagnosticCredentials(`${cmdPrefix}${text}`, {
    keyMask: mask,
    tokenMask: mask,
    flagMask: mask,
    privateKeyMask: mask,
    authMask: mask,
    ipMask: "<REDACTED_IP>",
    bracketedIpMask: "[<REDACTED_IP>]",
  });
  return res.text.startsWith(cmdPrefix) ? res.text.slice(cmdPrefix.length) : text;
}

/**
 * Redact HTTP Authorization / Proxy-Authorization headers across single-quoted (including YAML `''`
 * and POSIX `'\''`), double-quoted, multiline full-header and YAML/JSON quoted scalars, RFC 7616/9110
 * multi-parameter schemes (including unclosed trailing params & folded headers), unbounded RFC 9110
 * `1*tchar` token schemes, unquoted `\\\n` & RFC 9110 obs-fold continuations, and partial pastes.
 */
export function redactAuthorizationHeaders(raw: string, maskToken: string): RedactCountResult {
  let count = 0;
  let text = raw;

  // 1. Full header enclosed in double or single quotes (multiline continuations, shell '\'' concat, and unclosed partial pastes)
  const fullHeaderAnchorRe = /(["'])((?:Proxy-)?Authorization[ \t]*:[ \t]*)/gi;
  const fullFlowScanner = createFlowContextScanner(text);
  const fullEdits: Array<{ start: number; end: number; replacement: string }> = [];
  let fm = fullHeaderAnchorRe.exec(text);
  while (fm !== null) {
    const start = fm.index;
    const quote = fm[1] as '"' | "'";
    const prefix = fm[2]!;
    const qRes = scanShellQuotedArg(text, start, quote, true, fullFlowScanner.at(start));
    const innerCloseOffset = qRes.closed && text[qRes.end - 1] === quote ? 1 : 0;
    const body = text.slice(start + 1 + prefix.length, qRes.end - innerCloseOffset);
    if (body.trim() !== "" && !ALREADY_REDACTED_AUTH_RE.test(body.trim())) {
      const { schemePrefix, rest } = splitSchemePrefix(body);
      const effectiveRest = rest.replace(/^[\\\r\n \t]+/, "");
      const masked = effectiveRest.length > 0 ? `${schemePrefix}${maskToken}` : maskToken;
      fullEdits.push({
        start,
        end: qRes.end,
        replacement: `${quote}${prefix}${masked}${quote}`,
      });
      count += 1;
    }
    fullHeaderAnchorRe.lastIndex = Math.max(fullHeaderAnchorRe.lastIndex, qRes.end);
    fm = fullHeaderAnchorRe.exec(text);
  }
  text = replaceMatchedSpans(text, fullEdits);

  // 2. Quoted header values (`Authorization: "..."` or `"Authorization": "..."`, closed or unclosed)
  const quotedHeaderValRe =
    /(?:(?<![A-Za-z0-9_-])|(?<=\\[rnt]))((["']?)(?:Proxy-)?Authorization\2[ \t]*:[ \t]*)(["'])/gi;
  const qValEdits: Array<{ start: number; end: number; replacement: string }> = [];
  let qm = quotedHeaderValRe.exec(text);
  while (qm !== null) {
    const start = qm.index;
    const prefix = qm[1]!;
    const quote = qm[3] as '"' | "'";
    const openQuoteIdx = start + prefix.length;
    const qRes = scanQuotedScalar(text, openQuoteIdx, quote, true);
    const innerCloseOffset = qRes.closed ? 1 : 0;
    const body = text.slice(openQuoteIdx + 1, qRes.end - innerCloseOffset);
    if (body.trim() !== "" && !ALREADY_REDACTED_AUTH_RE.test(body.trim())) {
      const { schemePrefix, rest } = splitSchemePrefix(body);
      const effectiveRest = rest.replace(/^[\\\r\n \t]+/, "");
      const masked = effectiveRest.length > 0 ? `${schemePrefix}${maskToken}` : maskToken;
      qValEdits.push({
        start,
        end: qRes.end,
        replacement: `${prefix}${quote}${masked}${quote}`,
      });
      count += 1;
    }
    quotedHeaderValRe.lastIndex = Math.max(quotedHeaderValRe.lastIndex, qRes.end);
    qm = quotedHeaderValRe.exec(text);
  }
  text = replaceMatchedSpans(text, qValEdits);

  const multiParamAnchorRe = new RegExp(
    `(?:(?<![A-Za-z0-9_-])|(?<=\\\\[rnt]))((["']?)(?:Proxy-)?Authorization\\2[ \\t]*:[ \\t]*(?!(?:Bearer|Basic|Token|ApiKey|Negotiate|NTLM|DPoP|HOBA|Vapid)(?:[ \\t\\\\]|\\r|\\n))${RFC9110_TCHAR_TOKEN_SRC}(?:[ \\t]+|\\\\?${NL_SRC}${DIAG_COL0_CONTINUATION_LOOKAHEAD_SRC}[ \\t]+))(?=${RFC9110_TCHAR_TOKEN_SRC}=[^\\s=])`,
    "gi",
  );
  const paramNameEqRe = new RegExp(`${RFC9110_TCHAR_TOKEN_SRC}[ \\t]*=[ \\t]*`, "y");
  const unquotedParamValRe = /(?:[^\s",;|&<>(){}\r\n]|;(?=[A-Za-z0-9_-]))+/y;
  const execSticky = (re: RegExp, idx: number): RegExpExecArray | null => {
    re.lastIndex = idx;
    return re.exec(text);
  };
  const getMultiParamIndent = createMonotonicIndentLookup(text);
  const multiParamEdits: Array<{ start: number; end: number; replacement: string }> = [];
  let mm = multiParamAnchorRe.exec(text);
  while (mm !== null) {
    const start = mm.index;
    const rawPrefix = mm[1]!;
    const headerIndent = getMultiParamIndent(start);
    let cursor = start + rawPrefix.length;
    if (ALREADY_REDACTED_VAL_PREFIX_RE.test(text.slice(cursor, cursor + 64))) {
      mm = multiParamAnchorRe.exec(text);
      continue;
    }
    let matchedParam = false;
    while (cursor < text.length) {
      const nameEq = execSticky(paramNameEqRe, cursor);
      if (!nameEq) break;
      cursor += nameEq[0].length;
      if (cursor >= text.length) {
        matchedParam = true;
        break;
      }
      const vch = text[cursor]!;
      if (vch === '"' || vch === "'") {
        const qRes = scanQuotedScalar(text, cursor, vch, true);
        cursor = qRes.end;
        matchedParam = true;
        if (!qRes.closed) break;
      } else {
        const uq = execSticky(unquotedParamValRe, cursor);
        if (!uq) break;
        cursor += uq[0].length;
        matchedParam = true;
      }
      let nextPos = cursor;
      let commaWs = nextPos;
      while (commaWs < text.length && (text[commaWs] === " " || text[commaWs] === "\t")) commaWs += 1;
      if (text[commaWs] === ",") {
        let afterComma = commaWs + 1;
        while (afterComma < text.length && (text[afterComma] === " " || text[afterComma] === "\t")) {
          afterComma += 1;
        }
        if (text[afterComma] === "\\") {
          const nlNext = consumeNewline(text, afterComma + 1);
          if (nlNext !== -1 && !isDiagCol0At(text, nlNext)) {
            afterComma = nlNext;
            while (afterComma < text.length && (text[afterComma] === " " || text[afterComma] === "\t")) {
              afterComma += 1;
            }
          }
        } else if (text[afterComma] === "\r" || text[afterComma] === "\n") {
          const folded = isFoldedHeaderContinuation(text, afterComma, headerIndent, "digest");
          const plainNl = folded !== -1 ? folded : consumeNewline(text, afterComma);
          if (plainNl !== -1 && !isDiagCol0At(text, plainNl)) {
            afterComma = plainNl;
            while (afterComma < text.length && (text[afterComma] === " " || text[afterComma] === "\t")) {
              afterComma += 1;
            }
          }
        }
        nextPos = afterComma;
      } else if (text[commaWs] === "\r" || text[commaWs] === "\n") {
        const folded = isFoldedHeaderContinuation(text, commaWs, headerIndent, "digest");
        if (folded === -1) break;
        nextPos = folded;
      } else if (commaWs > nextPos) {
        nextPos = commaWs;
      } else {
        const folded = isFoldedHeaderContinuation(text, nextPos, headerIndent, "digest");
        if (folded === -1) break;
        nextPos = folded;
      }
      if (!execSticky(paramNameEqRe, nextPos)) break;
      cursor = nextPos;
    }
    if (matchedParam) {
      const cleanPrefix = rawPrefix.replace(/(?:[ \t]*\\?(?:\r\n|\r|\n)[ \t]*|[ \t]+)$/, " ");
      multiParamEdits.push({ start, end: cursor, replacement: `${cleanPrefix}${maskToken}` });
      count += 1;
      multiParamAnchorRe.lastIndex = Math.max(multiParamAnchorRe.lastIndex, cursor);
    }
    mm = multiParamAnchorRe.exec(text);
  }
  text = replaceMatchedSpans(text, multiParamEdits);

  // 4 & 5. Bare `<Scheme> <Credentials>` (unbounded RFC 9110 `1*tchar` + obs-fold / `\\\n`) and bare single-token `Authorization: <secret>`
  const knownSchemeRe = new RegExp(`^${AUTH_SCHEME_SRC}$`, "i");
  const rfcTokenRe = new RegExp(`^${RFC9110_TCHAR_TOKEN_SRC}$`);
  const knownCliOptStopRe =
    /^--(?:header|url|data|proxy|user|port|host|model|max-|tensor-|pipeline-|gpu-|enable-|enforce-|trust-|kv-|served-|tokenizer|quantization|speculative|additional-|compilation-|silent|verbose|location|output|request|insecure|include|fail|compressed)\b/i;
  const generalStopTokRe =
    /^(?:https?|wss?|redis|postgres(?:ql)?):\/\/|^--?[A-Za-z]|^(?:\[?Rank\b|INFO\b|WARN(?:ING)?\b|ERROR\b|CRITICAL\b|FATAL\b)/;

  const isBareTokChar = (ch: string) =>
    !(
      ch === " " ||
      ch === "\t" ||
      ch === "\r" ||
      ch === "\n" ||
      ch === '"' ||
      ch === "'" ||
      ch === ";" ||
      ch === "|" ||
      ch === "&" ||
      ch === "<" ||
      ch === ">" ||
      ch === "(" ||
      ch === ")" ||
      ch === "{" ||
      ch === "}" ||
      ch === "]"
    );

  const scanBareToken = (src: string, pos: number): number => {
    let i = pos;
    while (i < src.length) {
      const ch = src[i]!;
      if (ch === "\\") {
        const next = src[i + 1];
        if (i + 1 < src.length && next !== "\r" && next !== "\n" && next !== "r" && next !== "n") {
          i += 2;
          continue;
        }
        break;
      }
      if (!isBareTokChar(ch)) break;
      i += 1;
    }
    return i;
  };

  const advanceBareAuthSep = (src: string, pos: number, headerIndent: number): number => {
    let p = pos;
    while (p < src.length && (src[p] === " " || src[p] === "\t")) p += 1;
    if (p > pos) {
      if (p < src.length && src[p] === "\\") {
        const nl = consumeNewline(src, p + 1);
        if (nl !== -1 && !isDiagCol0At(src, nl)) {
          let ws = nl;
          while (ws < src.length && (src[ws] === " " || src[ws] === "\t")) ws += 1;
          return ws < src.length && isBareTokChar(src[ws]!) ? ws : -1;
        }
      }
      if (p < src.length && (src[p] === "\r" || src[p] === "\n")) {
        const folded = isFoldedHeaderContinuation(src, p, headerIndent, "auth");
        return folded !== -1 && isBareTokChar(src[folded]!) ? folded : -1;
      }
      return p < src.length && isBareTokChar(src[p]!) ? p : -1;
    }
    if (p < src.length && src[p] === "\\") {
      const nl = consumeNewline(src, p + 1);
      if (nl !== -1 && !isDiagCol0At(src, nl)) {
        let ws = nl;
        while (ws < src.length && (src[ws] === " " || src[ws] === "\t")) ws += 1;
        return ws < src.length && isBareTokChar(src[ws]!) ? ws : -1;
      }
    }
    if (p < src.length && (src[p] === "\r" || src[p] === "\n")) {
      const folded = isFoldedHeaderContinuation(src, p, headerIndent, "auth");
      return folded !== -1 && isBareTokChar(src[folded]!) ? folded : -1;
    }
    return -1;
  };

  const bareAuthAnchorRe =
    /(?:(?<![A-Za-z0-9_-])|(?<=\\[rnt]))((["']?)(?:Proxy-)?Authorization\2[ \t]*:[ \t]*)/gi;
  const rfcSchemeRegex = new RegExp(RFC9110_TCHAR_TOKEN_SRC, "y");
  const getBareAuthIndent = createMonotonicIndentLookup(text);
  const bareEdits: Array<{ start: number; end: number; replacement: string }> = [];
  let bm = bareAuthAnchorRe.exec(text);
  while (bm !== null) {
    const start = bm.index;
    const prefix = bm[1]!;
    const valStart = start + prefix.length;
    const headerIndent = getBareAuthIndent(start);
    if (text[valStart] === '"' || text[valStart] === "'") {
      bm = bareAuthAnchorRe.exec(text);
      continue;
    }
    const alreadyMaskedEnd = findAlreadyRedactedAuthPrefixEnd(text, valStart);
    if (alreadyMaskedEnd !== -1) {
      bareAuthAnchorRe.lastIndex = Math.max(bareAuthAnchorRe.lastIndex, alreadyMaskedEnd);
      bm = bareAuthAnchorRe.exec(text);
      continue;
    }
    // Go `http.Header` / bracketed lists: `map[Authorization:[Bearer ZQX] Content-Type:[...]]`
    if (text[valStart] === "[") {
      const flowEnd = scanBalancedFlowCollectionEnd(text, valStart);
      if (flowEnd > valStart + 2) {
        bareEdits.push({ start, end: flowEnd, replacement: `${prefix}[${maskToken}]` });
        count += 1;
        bareAuthAnchorRe.lastIndex = Math.max(bareAuthAnchorRe.lastIndex, flowEnd);
        bm = bareAuthAnchorRe.exec(text);
        continue;
      }
    }
    let firstStart = valStart;
    if (text[firstStart] === "\\") {
      const nl = consumeNewline(text, firstStart + 1);
      if (nl !== -1 && !isDiagCol0At(text, nl)) {
        firstStart = nl;
        while (firstStart < text.length && (text[firstStart] === " " || text[firstStart] === "\t")) {
          firstStart += 1;
        }
      }
    } else if (text[firstStart] === "\r" || text[firstStart] === "\n") {
      const folded = isFoldedHeaderContinuation(text, firstStart, headerIndent, "auth");
      if (folded !== -1) firstStart = folded;
    }
    const isRedactedSecondToken = (candidateSecondStart: number): boolean =>
      candidateSecondStart !== -1 &&
      ALREADY_REDACTED_VAL_PREFIX_RE.test(text.slice(candidateSecondStart, candidateSecondStart + 64));
    const checkSecond = (tokStr: string, candidateSecondStart: number): boolean => {
      if (candidateSecondStart === -1 || isRedactedSecondToken(candidateSecondStart)) {
        return false;
      }
      const secondPreview = text.slice(candidateSecondStart, candidateSecondStart + 40);
      return knownSchemeRe.test(tokStr)
        ? !knownCliOptStopRe.test(secondPreview) &&
            !/^-[A-Za-z](?![A-Za-z0-9_-])/.test(secondPreview) &&
            !/^(?:https?|wss?|redis|postgres(?:ql)?):\/\/|^(?:\[?Rank\b|INFO\b|WARN(?:ING)?\b|ERROR\b|CRITICAL\b|FATAL\b)/.test(
              secondPreview,
            )
        : !generalStopTokRe.test(secondPreview);
    };

    const tcharMatch = execSticky(rfcSchemeRegex, firstStart);
    const tcharEnd = tcharMatch ? firstStart + tcharMatch[0].length : -1;
    const tcharSecond = tcharEnd > firstStart ? advanceBareAuthSep(text, tcharEnd, headerIndent) : -1;
    const bareEnd = scanBareToken(text, firstStart);
    const bareSecond = bareEnd > firstStart ? advanceBareAuthSep(text, bareEnd, headerIndent) : -1;

    const useTcharScheme =
      tcharEnd > bareEnd && tcharMatch !== null && checkSecond(tcharMatch[0], tcharSecond);
    const firstEnd = useTcharScheme ? tcharEnd : bareEnd;
    if (firstEnd <= firstStart) {
      bm = bareAuthAnchorRe.exec(text);
      continue;
    }
    const firstTok = text.slice(firstStart, firstEnd);
    const secondStart = useTcharScheme ? tcharSecond : bareSecond;
    if (isRedactedSecondToken(secondStart)) {
      bareAuthAnchorRe.lastIndex = Math.max(bareAuthAnchorRe.lastIndex, secondStart);
      bm = bareAuthAnchorRe.exec(text);
      continue;
    }
    const validSecondAfterScheme = useTcharScheme ? true : checkSecond(firstTok, secondStart);

    const singleTokenScheme = /^(?:Bearer|Basic|Token|ApiKey|Negotiate|NTLM|DPoP|HOBA|Vapid)$/i.test(
      firstTok,
    );
    if (rfcTokenRe.test(firstTok) && validSecondAfterScheme) {
      let curEnd = firstEnd;
      let tokPos = secondStart;
      while (tokPos !== -1) {
        const preview = text.slice(tokPos, tokPos + 40);
        if (tokPos > secondStart && (generalStopTokRe.test(preview) || AUTH_LOG_FIELD_STOP_RE.test(preview)))
          break;
        const nextEnd = scanBareToken(text, tokPos);
        if (nextEnd <= tokPos) break;
        curEnd = nextEnd;
        const afterTok = advanceBareAuthSep(text, curEnd, headerIndent);
        if (afterTok === -1) break;
        // Single-token HTTP schemes (`Basic YTpi`, `Bearer tok`) never span horizontal same-line prose (`NPU out of memory`).
        if (singleTokenScheme) {
          const gap = text.slice(curEnd, afterTok);
          if (!gap.includes("\n") && !gap.includes("\r")) break;
        }
        const nextPreview = text.slice(afterTok, afterTok + 40);
        if (generalStopTokRe.test(nextPreview) || AUTH_LOG_FIELD_STOP_RE.test(nextPreview)) break;
        tokPos = afterTok;
      }
      if (text[curEnd] === "\\") {
        const trailingNl = consumeNewline(text, curEnd + 1);
        const escNext = text[curEnd + 1];
        if (
          trailingNl === -1 &&
          escNext !== "r" &&
          escNext !== "n" &&
          escNext !== "t" &&
          escNext !== '"' &&
          escNext !== "'"
        ) {
          curEnd += 1;
        }
      }
      bareEdits.push({
        start,
        end: curEnd,
        replacement: `${prefix}${firstTok} ${maskToken}`,
      });
      count += 1;
      bareAuthAnchorRe.lastIndex = Math.max(bareAuthAnchorRe.lastIndex, curEnd);
    } else if (!firstTok.startsWith("--") && !ALREADY_REDACTED_RE.test(firstTok)) {
      let curEnd = firstEnd;
      let tokPos = secondStart;
      // Consume `\\\n` / folded continuations of single broken token if contiguous
      while (tokPos !== -1) {
        const between = text.slice(curEnd, tokPos);
        if (!between.includes("\n") && !between.includes("\r")) break;
        const preview = text.slice(tokPos, tokPos + 40);
        if (generalStopTokRe.test(preview)) break;
        const nextEnd = scanBareToken(text, tokPos);
        if (nextEnd <= tokPos) break;
        curEnd = nextEnd;
        tokPos = advanceBareAuthSep(text, curEnd, headerIndent);
      }
      bareEdits.push({
        start,
        end: curEnd,
        replacement: `${prefix}${maskToken}`,
      });
      count += 1;
      bareAuthAnchorRe.lastIndex = Math.max(bareAuthAnchorRe.lastIndex, curEnd);
    }
    bm = bareAuthAnchorRe.exec(text);
  }
  text = replaceMatchedSpans(text, bareEdits);

  return { text, count };
}

function trimYamlRangeEnd(slice: string, start: number, rawEnd: number): number {
  let end = rawEnd;
  while (
    end > start &&
    (slice[end - 1] === "\n" || slice[end - 1] === "\r" || slice[end - 1] === " " || slice[end - 1] === "\t")
  ) {
    end -= 1;
  }
  return end;
}

function resolveYamlScalarString(
  doc: unknown,
  node: unknown,
  visited = new Set<unknown>(),
  externalAnchorValues?: ReadonlyMap<string, string>,
  slice?: string,
  aliasTargetMap?: ReadonlyMap<unknown, unknown>,
): string | null {
  if (!node || typeof node !== "object" || visited.has(node)) return null;
  visited.add(node);
  if (isScalar(node)) {
    const val = (node as { value?: unknown }).value;
    return typeof val === "string" || typeof val === "number" ? String(val) : null;
  }
  if (isAlias(node)) {
    const target = aliasTargetMap
      ? aliasTargetMap.get(node)
      : (node as { resolve?: (d: unknown) => unknown }).resolve?.(doc);
    if (target) {
      return resolveYamlScalarString(doc, target, visited, externalAnchorValues, slice, aliasTargetMap);
    }
    if (externalAnchorValues && slice !== undefined) {
      const aName = extractAliasName(slice, node);
      if (aName && externalAnchorValues.has(aName)) {
        return externalAnchorValues.get(aName) ?? null;
      }
    }
    return null;
  }
  return null;
}

/** True when a weak-key YAML value is purely numeric/boolean/null (not a string secret). */
function isNonSecretLiteralNode(
  node: unknown,
  aliasTargetMap?: ReadonlyMap<unknown, unknown>,
  visited = new Set<unknown>(),
): boolean {
  if (!node || typeof node !== "object" || visited.has(node)) return false;
  visited.add(node);
  if (isAlias(node)) {
    const target = aliasTargetMap?.get(node);
    return target ? isNonSecretLiteralNode(target, aliasTargetMap, visited) : false;
  }
  if (isScalar(node)) {
    return typeof (node as { value?: unknown }).value !== "string";
  }
  if (isSeq(node)) {
    const items = (node as { items?: unknown[] }).items;
    return (
      Array.isArray(items) &&
      items.length > 0 &&
      items.every((it) => isNonSecretLiteralNode(it, aliasTargetMap, visited))
    );
  }
  return false;
}

function extractAliasName(slice: string, node: unknown): string | null {
  if (!node || typeof node !== "object") return null;
  const src = (node as { source?: unknown }).source;
  if (typeof src === "string" && src.length > 0) return src;
  const range = (node as { range?: [number, number, number] | null }).range;
  if (range) {
    const m = /^\*([A-Za-z0-9_-]+)/.exec(slice.slice(range[0], range[1]).trim());
    if (m?.[1]) return m[1];
  }
  return null;
}

const AUTHS_CONTAINER_KEY_RE = /^(?:registry[-_]?)?auths$/i;
const AUTHS_CREDENTIAL_KEY_RE = /^(?:auth|identitytoken|registrytoken|password|token|secret)$/i;
const MAX_YAML_FLOW_NESTING = 512;

function hasExcessiveFlowNesting(slice: string): boolean {
  if (!slice.includes("{") && !slice.includes("[")) return false;
  let depth = 0;
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < slice.length; i += 1) {
    const ch = slice[i]!;
    if (quote) {
      if (quote === '"' && ch === "\\" && i + 1 < slice.length) {
        i += 1;
      } else if (quote === "'" && ch === "'" && slice[i + 1] === "'") {
        i += 1;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === "#" && (i === 0 || slice[i - 1] === " " || slice[i - 1] === "\t" || slice[i - 1] === "\n")) {
      while (i < slice.length && slice[i] !== "\n") i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === "{" || ch === "[") {
      depth += 1;
      if (depth > MAX_YAML_FLOW_NESTING) return true;
    } else if ((ch === "}" || ch === "]") && depth > 0) {
      depth -= 1;
    }
  }
  return false;
}

function tryRedactValidYamlSlice(
  slice: string,
  isSecretKey: (key: string) => boolean,
  maskToken: string,
  depth = 0,
  defaultQuote: '"' | "'" = '"',
  options?: {
    externalSecretAnchors?: ReadonlySet<string> | undefined;
    outReferencedAliases?: Set<string> | undefined;
    externalAnchorValues?: ReadonlyMap<string, string> | undefined;
    outDefinedAnchorValues?: Map<string, string> | undefined;
  },
): RedactCountResult | null {
  const hasPossibleArgvSeq =
    slice.includes("-") && (slice.includes("[") || /(?:^|\n)[ \t]*-[ \t]/.test(slice));
  if ((!slice.includes(":") && !hasPossibleArgvSeq) || hasExcessiveFlowNesting(slice)) return null;
  let docs: ReturnType<typeof parseAllDocuments>;
  try {
    docs = parseAllDocuments(slice, { strict: false, uniqueKeys: false });
  } catch {
    return null;
  }
  if (
    docs.length === 0 ||
    docs.some((d) => d.errors.length > 0) ||
    !docs.some((d) => isCollection(d.contents))
  ) {
    return null;
  }

  const incomingSecretAnchors = options?.externalSecretAnchors
    ? new Set(options.externalSecretAnchors)
    : undefined;
  const outReferencedAliases = options?.outReferencedAliases;
  const incomingAnchorValues = options?.externalAnchorValues
    ? new Map(options.externalAnchorValues)
    : undefined;
  const outDefinedAnchorValues = options?.outDefinedAnchorValues;
  const rawEdits: Array<[number, number]> = [];
  const blockReplacements: Array<{ start: number; end: number; replacement: string; count: number }> = [];
  const aliasEdges: Array<{ aliasRange: [number, number]; targetRange: [number, number] }> = [];
  const startsWithExplicitDoc = /^[ \t]*(?:---|\.\.\.)(?:[ \t\r\n]|$)/.test(slice);

  for (let docIdx = 0; docIdx < docs.length; docIdx += 1) {
    const doc = docs[docIdx]!;
    if (docIdx > 0 || startsWithExplicitDoc) {
      // YAML 1.2 document boundaries (`---` / `...`) start a fresh anchor namespace.
      outReferencedAliases?.clear();
      outDefinedAnchorValues?.clear();
    }
    const docSecretAnchors = docIdx === 0 && !startsWithExplicitDoc ? incomingSecretAnchors : undefined;
    const docAnchorValues = docIdx === 0 && !startsWithExplicitDoc ? incomingAnchorValues : undefined;

    // Build an O(N) per-document alias-to-target index in source order so repeated alias checks never rescan the AST.
    const aliasTargetMap = new Map<unknown, unknown>();
    const latestAnchorNode = new Map<string, unknown>();
    visit(doc, {
      Node(_, node) {
        if (!node || typeof node !== "object") return;
        const anchorName = (node as { anchor?: unknown }).anchor;
        if (typeof anchorName === "string" && anchorName.length > 0) {
          latestAnchorNode.set(anchorName, node);
        }
        if (isAlias(node)) {
          const aName = extractAliasName(slice, node);
          const target = aName ? latestAnchorNode.get(aName) : undefined;
          if (target) {
            aliasTargetMap.set(node, target);
            const aRange = (node as { range?: [number, number, number] | null }).range;
            const tRange = (target as { range?: [number, number, number] | null }).range;
            if (aRange && tRange) {
              const aEnd = trimYamlRangeEnd(slice, aRange[0], aRange[1]);
              const tEnd = trimYamlRangeEnd(slice, tRange[0], tRange[1]);
              if (aEnd > aRange[0] && tEnd > tRange[0]) {
                aliasEdges.push({ aliasRange: [aRange[0], aEnd], targetRange: [tRange[0], tEnd] });
              }
            }
          }
        }
      },
    });

    const collectAliasTargets = (root: unknown, visited = new Set<unknown>()) => {
      if (!root || typeof root !== "object" || visited.has(root)) return;
      visited.add(root);
      visit(root as Parameters<typeof visit>[0], {
        Alias(_, aliasNode) {
          const aliasName = extractAliasName(slice, aliasNode);
          if (aliasName && outReferencedAliases) {
            outReferencedAliases.add(aliasName);
          }
          const target = aliasTargetMap.get(aliasNode) as
            | { range?: [number, number, number] | null }
            | undefined;
          if (target?.range) {
            rawEdits.push([target.range[0], target.range[1]]);
            collectAliasTargets(target, visited);
          }
        },
      });
    };

    const redactTargetValue = (keyName: string, rawVal: unknown, preserveYamlLeaf = false): boolean => {
      const valNode = rawVal as {
        range?: [number, number, number] | null;
        value?: unknown;
        items?: unknown[];
        anchor?: string;
      } | null;
      if (!valNode || !valNode.range) return false;

      if (isAlias(valNode)) {
        const aliasName = extractAliasName(slice, valNode);
        if (aliasName && outReferencedAliases) {
          outReferencedAliases.add(aliasName);
        }
        collectAliasTargets(valNode);
        rawEdits.push([valNode.range[0], valNode.range[1]]);
        return true;
      }

      if (isScalar(valNode)) {
        if (valNode.value === null || valNode.value === undefined) return true;
        const trimEnd = trimYamlRangeEnd(slice, valNode.range[0], valNode.range[1]);
        const rawScalar = slice.slice(valNode.range[0], trimEnd);
        if ((rawScalar.startsWith('"') || rawScalar.startsWith("'")) && /[\r\n]/.test(rawScalar)) {
          const contLines = rawScalar.split(/\r\n|\r|\n/).slice(1);
          if (contLines.some((cl) => DIAG_COL0_LINE_RE.test(cl))) {
            return true;
          }
        }
        if (
          !preserveYamlLeaf &&
          !rawScalar.startsWith('"') &&
          !rawScalar.startsWith("'") &&
          !rawScalar.startsWith("|") &&
          !rawScalar.startsWith(">") &&
          /(?:^|[^\\])\\$/.test(rawScalar)
        ) {
          const afterNl = consumeNewline(slice, trimEnd);
          if (afterNl !== -1 && afterNl < slice.length && !isDiagCol0At(slice, afterNl)) {
            const nextEol = findLineEnd(slice, afterNl);
            const nextLine = slice.slice(afterNl, nextEol);
            const isYamlCont = /^[ \t]*(?:-[ \t]|(?:"[^"]+"|'[^']+'|[A-Za-z0-9_.-]+)[ \t]*:(?:[ \t]|$))/.test(
              nextLine,
            );
            const isShellCont = /^[ \t]+(?:--?[A-Za-z0-9]|&&|\|\||[|;]|\$[A-Za-z_])/.test(nextLine);
            if (!isYamlCont && isShellCont) {
              return true;
            }
          }
        }
        const strVal = String(valNode.value);
        const trimmedScalar = strVal.trim();
        const isUnquotedHttpAuthWithScheme =
          !preserveYamlLeaf &&
          /^(?:proxy-)?authorization$/i.test(keyName) &&
          !rawScalar.startsWith('"') &&
          !rawScalar.startsWith("'") &&
          !rawScalar.startsWith("|") &&
          !rawScalar.startsWith(">") &&
          (AUTH_SCHEME_PREFIX_RE.test(trimmedScalar) || ALREADY_REDACTED_AUTH_PREFIX_RE.test(trimmedScalar));
        if (
          strVal === "" ||
          trimmedScalar === maskToken ||
          /^\[REDACTED(?:_[A-Z]+)?\]$/.test(trimmedScalar) ||
          isUnquotedHttpAuthWithScheme ||
          (!preserveYamlLeaf &&
            /^(?:proxy-)?authorization$/i.test(keyName) &&
            ALREADY_REDACTED_AUTH_RE.test(trimmedScalar))
        ) {
          return true;
        }
      } else if (isCollection(valNode)) {
        if (valNode.items.length === 0) return true;
        collectAliasTargets(valNode);
      }

      rawEdits.push([valNode.range[0], valNode.range[1]]);
      return true;
    };

    const redactExternalAnchor = (node: unknown): boolean => {
      if (!docSecretAnchors || docSecretAnchors.size === 0 || !node || typeof node !== "object") {
        return false;
      }
      const anchorName = (node as { anchor?: unknown }).anchor;
      if (typeof anchorName === "string" && docSecretAnchors.has(anchorName)) {
        return redactTargetValue("", node);
      }
      return false;
    };

    const canonicalSeedCmd = (seed: ArgvSecretState): string =>
      seed.profile === "container-login" ||
      (seed.cmd !== null && !seed.cmdLocked && CONTAINER_LOGIN_CMDS.has(seed.cmd))
        ? (seed.cmd ?? "")
        : seed.cmd === null
          ? ""
          : "*";
    const argvSeedSig = (seed: ArgvSecretState): string => {
      const pKey = seed.pendingNext
        ? `${seed.pendingNext.multi ? "M" : "S"}:${seed.pendingNext.requiresOperand ? "R" : "O"}:${seed.pendingNext.weakFlag ?? ""}`
        : "";
      return `${canonicalSeedCmd(seed)}|${seed.profile}|${seed.cmdLocked ? 1 : 0}|${seed.wrapper ?? ""}|${seed.wrapperPositional ?? ""}|${seed.wrapperOptionsEnded ? 1 : 0}|${seed.expectingDuration ? 1 : 0}|${seed.expectingFlagValue ? 1 : 0}|${pKey}|${seed.pendingTaken ?? 0}`;
    };
    const forcedSecretMaps = new WeakSet<object>();
    const seqSeedsMap = new WeakMap<object, { seeds: ArgvSecretState[]; keys: Set<string> }>();
    const scalarSeedsMap = new WeakMap<object, { seeds: ArgvSecretState[]; keys: Set<string> }>();
    const addSeedToMap = (
      targetMap: WeakMap<object, { seeds: ArgvSecretState[]; keys: Set<string> }>,
      target: object,
      seed: ArgvSecretState,
    ) => {
      const sig = argvSeedSig(seed);
      let entry = targetMap.get(target);
      if (!entry) {
        entry = { seeds: [], keys: new Set<string>() };
        targetMap.set(target, entry);
      }
      if (!entry.keys.has(sig)) {
        entry.keys.add(sig);
        entry.seeds.push(seed);
      }
    };
    const RELEVANT_CONTAINER_KEYS = new Set([
      "kind",
      "items",
      "command",
      "entrypoint",
      "args",
      "data",
      "stringdata",
      "name",
      "key",
      "env_name",
      "var",
      "value",
      "val",
      "secret",
      "default",
    ]);
    const effectivePairsCache = new WeakMap<object, Map<string, { key?: unknown; value?: unknown }>>();
    const collectMapEffectivePairs = (
      mapNode: unknown,
      activeStack = new Set<unknown>(),
    ): Map<string, { key?: unknown; value?: unknown }> => {
      const empty = new Map<string, { key?: unknown; value?: unknown }>();
      if (!mapNode || typeof mapNode !== "object" || !isMap(mapNode)) return empty;
      const cached = effectivePairsCache.get(mapNode);
      if (cached) return cached;
      if (activeStack.has(mapNode)) return empty;
      activeStack.add(mapNode);
      const effectiveByKey = new Map<string, { key?: unknown; value?: unknown }>();
      const keyOf = (p: { key?: unknown }): string =>
        (resolveYamlScalarString(doc, p.key, new Set(), docAnchorValues, slice, aliasTargetMap) ?? "").trim();
      const mPairs = (mapNode as { items?: Array<{ key?: unknown; value?: unknown }> }).items;
      if (Array.isArray(mPairs)) {
        for (const p of mPairs) {
          const kStr = keyOf(p).toLowerCase();
          if (kStr && kStr !== "<<" && RELEVANT_CONTAINER_KEYS.has(kStr) && !effectiveByKey.has(kStr)) {
            effectiveByKey.set(kStr, p);
          }
        }
        for (const p of mPairs) {
          if (keyOf(p) !== "<<") continue;
          const sources = isSeq(p.value) ? ((p.value as { items?: unknown[] }).items ?? []) : [p.value];
          for (const src of sources) {
            const resolved = isAlias(src) ? aliasTargetMap.get(src) : src;
            const mergedChild = collectMapEffectivePairs(resolved, activeStack);
            for (const [mk, mv] of mergedChild) {
              if (!effectiveByKey.has(mk)) effectiveByKey.set(mk, mv);
            }
          }
        }
      }
      activeStack.delete(mapNode);
      effectivePairsCache.set(mapNode, effectiveByKey);
      return effectiveByKey;
    };

    const seqTokensCache = new WeakMap<object, string[]>();
    const seqSeedFromEmptyCache = new WeakMap<object, ArgvSecretState>();
    const seqSeedTransitionCache = new WeakMap<object, Map<string, ArgvSecretState>>();
    const advanceCachedSeqSeed = (
      baseSeed: ArgvSecretState | null,
      target: unknown,
      tokens: string[],
    ): ArgvSecretState => {
      const initial = baseSeed ?? createArgvSecretState();
      if (tokens.length === 0) return initial;
      if (target && typeof target === "object" && isSeq(target)) {
        if (!baseSeed) {
          const cached = seqSeedFromEmptyCache.get(target);
          if (cached) return cached;
          const computed = seedArgvSecretState(tokens);
          seqSeedFromEmptyCache.set(target, computed);
          return computed;
        }
        const sig = argvSeedSig(baseSeed);
        let bySig = seqSeedTransitionCache.get(target);
        const hit = bySig?.get(sig);
        if (hit) return hit;
        const canonCmd = canonicalSeedCmd(baseSeed);
        const seedForCache: ArgvSecretState = canonCmd === "*" ? { ...baseSeed, cmd: "*" } : baseSeed;
        const computed = advanceArgvSeedFromState(seedForCache, tokens);
        if (!bySig) {
          bySig = new Map<string, ArgvSecretState>();
          seqSeedTransitionCache.set(target, bySig);
        }
        bySig.set(sig, computed);
        return computed;
      }
      return advanceArgvSeedFromState(initial, tokens);
    };
    const resolveContainerArgvTokens = (
      pair: { key?: unknown; value?: unknown } | undefined,
    ): { target: unknown; tokens: string[] } => {
      if (!pair) return { target: null, tokens: [] };
      const target = isAlias(pair.value) ? aliasTargetMap.get(pair.value) : pair.value;
      if (!target || typeof target !== "object") return { target: null, tokens: [] };
      if (isSeq(target)) {
        const cachedSeq = seqTokensCache.get(target);
        if (cachedSeq) return { target, tokens: cachedSeq };
        const items = (target as { items?: unknown[] }).items ?? [];
        const tokens: string[] = [];
        for (const cn of items) {
          const txt = resolveYamlScalarString(doc, cn, new Set(), docAnchorValues, slice, aliasTargetMap);
          if (typeof txt === "string") tokens.push(txt);
        }
        seqTokensCache.set(target, tokens);
        return { target, tokens };
      }
      if (isScalar(target)) {
        const txt = resolveYamlScalarString(doc, target, new Set(), docAnchorValues, slice, aliasTargetMap);
        return { target, tokens: typeof txt === "string" ? splitArgvTokensForSeed(txt) : [] };
      }
      return { target, tokens: [] };
    };

    // Pass A: pre-collect `SecretList` -> `items` maps and `entrypoint` -> `command` -> `args` seeds across
    // the entire document BEFORE Pass B visits nodes, so earlier YAML anchors (`&entries`, `&args`)
    // receive context supplied by later `*entries` / `*args` consumers.
    visit(doc, {
      Map(_, mapNode) {
        const effectiveByKey = collectMapEffectivePairs(mapNode);
        const kindPair = effectiveByKey.get("kind");
        const kindVal = kindPair
          ? resolveYamlScalarString(doc, kindPair.value, new Set(), docAnchorValues, slice, aliasTargetMap)
          : null;
        if ((kindVal?.trim() ?? "") === "SecretList") {
          const itemsPair = effectiveByKey.get("items");
          const itemsNode =
            itemsPair && isAlias(itemsPair.value) ? aliasTargetMap.get(itemsPair.value) : itemsPair?.value;
          const seqItems = isSeq(itemsNode) ? (itemsNode as { items?: unknown[] }).items : undefined;
          if (Array.isArray(seqItems)) {
            for (const entry of seqItems) {
              const targetMap = isAlias(entry) ? aliasTargetMap.get(entry) : entry;
              if (targetMap && typeof targetMap === "object" && isMap(targetMap)) {
                forcedSecretMaps.add(targetMap);
              }
            }
          }
        }
        const epPair = effectiveByKey.get("entrypoint");
        const cmdPair = effectiveByKey.get("command");
        const argsPair = effectiveByKey.get("args");
        const epRes = resolveContainerArgvTokens(epPair);
        const cmdRes = resolveContainerArgvTokens(cmdPair);
        const epSeed =
          epRes.target && epRes.tokens.length > 0
            ? advanceCachedSeqSeed(null, epRes.target, epRes.tokens)
            : null;
        if (epSeed && cmdRes.target) {
          if (isSeq(cmdRes.target)) addSeedToMap(seqSeedsMap, cmdRes.target, epSeed);
          else if (isScalar(cmdRes.target)) addSeedToMap(scalarSeedsMap, cmdRes.target, epSeed);
        }
        if (argsPair && (epSeed !== null || cmdRes.tokens.length > 0)) {
          const argsTarget = isAlias(argsPair.value) ? aliasTargetMap.get(argsPair.value) : argsPair.value;
          if (argsTarget && typeof argsTarget === "object") {
            const argsSeed = advanceCachedSeqSeed(epSeed, cmdRes.target, cmdRes.tokens);
            if (isSeq(argsTarget)) addSeedToMap(seqSeedsMap, argsTarget, argsSeed);
            else if (isScalar(argsTarget)) addSeedToMap(scalarSeedsMap, argsTarget, argsSeed);
          }
        }
      },
    });

    visit(doc, {
      Pair(_, pair) {
        const keyName = resolveYamlScalarString(
          doc,
          pair.key,
          new Set(),
          docAnchorValues,
          slice,
          aliasTargetMap,
        );
        if (!keyName) return;
        if (AUTHS_CONTAINER_KEY_RE.test(keyName.trim())) {
          let authsTarget: unknown = pair.value;
          if (isAlias(authsTarget)) {
            authsTarget = aliasTargetMap.get(authsTarget);
          }
          const registries = (authsTarget as { items?: Array<{ key?: unknown; value?: unknown }> } | null)
            ?.items;
          if (Array.isArray(registries)) {
            for (const regPair of registries) {
              let regTarget: unknown = regPair?.value;
              if (isAlias(regTarget)) {
                regTarget = aliasTargetMap.get(regTarget);
              }
              const credPairs = (regTarget as { items?: Array<{ key?: unknown; value?: unknown }> } | null)
                ?.items;
              if (!Array.isArray(credPairs)) continue;
              for (const credPair of credPairs) {
                const cKey = resolveYamlScalarString(
                  doc,
                  credPair?.key,
                  new Set(),
                  docAnchorValues,
                  slice,
                  aliasTargetMap,
                );
                if (cKey && AUTHS_CREDENTIAL_KEY_RE.test(cKey.trim())) {
                  redactTargetValue(cKey, credPair.value);
                }
              }
            }
          }
        }
        if (isSecretKey(keyName)) {
          if (isWeakCredentialKey(keyName) && isNonSecretLiteralNode(pair.value, aliasTargetMap)) return;
          if (redactTargetValue(keyName, pair.value)) return visit.SKIP;
        }
      },
      Map(_, mapNode) {
        if (redactExternalAnchor(mapNode)) return visit.SKIP;
        const effectiveByKey = collectMapEffectivePairs(mapNode);
        const keyOf = (p: { key?: unknown }): string =>
          (
            resolveYamlScalarString(doc, p.key, new Set(), docAnchorValues, slice, aliasTargetMap) ?? ""
          ).trim();

        // Kubernetes `kind: Secret` (including via `<<` merge) & `kind: SecretList` items: redact `data`/`stringData`.
        const kindPair = effectiveByKey.get("kind");
        const kindVal = kindPair
          ? resolveYamlScalarString(doc, kindPair.value, new Set(), docAnchorValues, slice, aliasTargetMap)
          : null;
        const trimmedKind = kindVal?.trim() ?? "";
        if (
          trimmedKind === "Secret" ||
          (typeof mapNode === "object" && mapNode !== null && forcedSecretMaps.has(mapNode))
        ) {
          for (const secretSectionKey of ["data", "stringdata"] as const) {
            const p = effectiveByKey.get(secretSectionKey);
            if (!p) continue;
            let container: unknown = p.value;
            if (isAlias(container)) {
              container = aliasTargetMap.get(container);
            }
            const entries = isMap(container)
              ? (container as { items?: Array<{ key?: unknown; value?: unknown }> }).items
              : undefined;
            if (Array.isArray(entries)) {
              for (const entry of entries) {
                redactTargetValue(keyOf(entry) || secretSectionKey, entry.value, true);
              }
            } else if (p.value !== null && p.value !== undefined) {
              redactTargetValue(secretSectionKey, p.value, true);
            }
          }
        }

        const hasSecretDescriptor = ["name", "key", "env_name", "var"].some((dk) => {
          const descPair = effectiveByKey.get(dk);
          if (!descPair) return false;
          const vStr = resolveYamlScalarString(
            doc,
            descPair.value,
            new Set(),
            docAnchorValues,
            slice,
            aliasTargetMap,
          );
          return vStr !== null && isSecretKey(vStr);
        });
        if (!hasSecretDescriptor) return;
        for (const vk of ["value", "val", "secret", "default"]) {
          const valPair = effectiveByKey.get(vk);
          if (valPair) redactTargetValue(vk, valPair.value);
        }
      },
      Seq(_, seqNode) {
        if (redactExternalAnchor(seqNode)) return visit.SKIP;
        // Kubernetes / Compose / JSON argv arrays: `["--api-key", "SECRET"]`, `- --hf-token\n- SECRET`,
        // `["docker", "login", "-p", "SECRET"]`, `["--api-key=SECRET"]`, aliased flags `[*opt, SECRET]`,
        // plus sibling `command` pending operand flags carried into `args`.
        const items = (seqNode as { items?: unknown[] }).items;
        if (!Array.isArray(items) || items.length === 0) return;
        const seeds = (typeof seqNode === "object" && seqNode !== null
          ? seqSeedsMap.get(seqNode)?.seeds
          : undefined) ?? [createArgvSecretState()];
        for (const baseSeed of seeds) {
          const argvState: ArgvSecretState = { ...baseSeed };
          let pendingNext: Extract<ArgvFlagAction, { kind: "next" }> | null = baseSeed.pendingNext ?? null;
          let pendingTaken = baseSeed.pendingTaken ?? 0;
          for (let i = 0; i < items.length; i += 1) {
            const it = items[i] as { value?: unknown; range?: [number, number, number] | null } | null;
            const resolvedText =
              isScalar(it) && typeof it.value === "string"
                ? it.value
                : resolveYamlScalarString(doc, it, new Set(), docAnchorValues, slice, aliasTargetMap);
            if (typeof resolvedText !== "string") {
              pendingNext = null;
              pendingTaken = 0;
              continue;
            }
            const tokenText = resolvedText.trim();
            if (pendingNext) {
              const isBoundary = isMandatoryOperandFlagBoundary(
                tokenText,
                pendingNext.requiresOperand && pendingTaken === 0,
              );
              const skipWeak = pendingNext.weakFlag && isNonSecretLiteralNode(it, aliasTargetMap);
              if (!isBoundary && !skipWeak) {
                redactTargetValue("argv", it);
                pendingTaken += 1;
                if (!pendingNext.multi) {
                  pendingNext = null;
                  pendingTaken = 0;
                }
                continue;
              }
              pendingNext = null;
              pendingTaken = 0;
            }
            const action = classifyArgvSecretToken(argvState, tokenText);
            if (action.kind === "none") continue;
            if (action.kind === "inline") {
              const secretPart = tokenText.slice(action.valueOffset);
              if (secretPart === "" || ALREADY_REDACTED_RE.test(secretPart) || secretPart === maskToken)
                continue;
              if (!isScalar(it) || !it.range) {
                redactTargetValue("argv", it);
                continue;
              }
              const end = trimYamlRangeEnd(slice, it.range[0], it.range[1]);
              const rawItem = slice.slice(it.range[0], end);
              const anchorPrefix = /^((?:&[^\s]+|![^\s]+)[ \t]+)*/.exec(rawItem)?.[0] ?? "";
              const bodyRaw = rawItem.slice(anchorPrefix.length);
              const q: '"' | "'" = bodyRaw.startsWith("'")
                ? "'"
                : bodyRaw.startsWith('"')
                  ? '"'
                  : defaultQuote;
              const rendered = `${tokenText.slice(0, action.valueOffset)}${maskToken}`;
              const encoded = q === '"' ? JSON.stringify(rendered) : `'${rendered.replace(/'/g, "''")}'`;
              blockReplacements.push({
                start: it.range[0],
                end,
                replacement: `${anchorPrefix}${encoded}`,
                count: 1,
              });
              continue;
            }
            pendingNext = action;
            pendingTaken = 0;
          }
        }
      },
      Scalar(key, node) {
        if (key === "key") return;
        if (outDefinedAnchorValues) {
          const anchorName = (node as { anchor?: unknown }).anchor;
          if (
            typeof anchorName === "string" &&
            (typeof node.value === "string" || typeof node.value === "number")
          ) {
            outDefinedAnchorValues.set(anchorName, String(node.value));
          }
        }
        if (redactExternalAnchor(node)) return;
        if (typeof node.value !== "string" || !node.range) return;
        const end = trimYamlRangeEnd(slice, node.range[0], node.range[1]);
        if (end <= node.range[0]) return;
        const rawBlock = slice.slice(node.range[0], end);
        const scalarSeedEntry = scalarSeedsMap.get(node);
        if (scalarSeedEntry && scalarSeedEntry.seeds.length > 0) {
          let curFrag = node.value;
          for (const scalarSeed of scalarSeedEntry.seeds) {
            curFrag = redactCommandFragmentWithSeed(curFrag, scalarSeed, maskToken);
          }
          if (curFrag !== node.value) {
            const anchorPrefix = /^((?:&[^\s]+|![^\s]+)[ \t]+)*/.exec(rawBlock)?.[0] ?? "";
            const bodyRaw = rawBlock.slice(anchorPrefix.length);
            const encoded =
              bodyRaw.startsWith("'") && !/[\r\n]/.test(bodyRaw)
                ? `'${curFrag.replace(/'/g, "''")}'`
                : !/[\r\n]/.test(bodyRaw) && !bodyRaw.startsWith('"') && /^[^\s#&*!|>%@`[{'"?-]/.test(curFrag)
                  ? curFrag
                  : JSON.stringify(curFrag);
            blockReplacements.push({
              start: node.range[0],
              end,
              replacement: `${anchorPrefix}${encoded}`,
              count: 1,
            });
            return;
          }
        }
        if (/^(?:(?:&[^\s]+|![^\s]+)[ \t]*)*[|>]/.test(rawBlock)) {
          const nlIdx = rawBlock.indexOf("\n");
          if (nlIdx < 0) return;
          if (depth >= 256) {
            rawEdits.push([node.range[0], end]);
            return;
          }
          const hasBlockCandidate =
            node.value.includes(":") || (node.value.includes("[") && node.value.includes("-"));
          if (!hasBlockCandidate) return;
          const headerLine = rawBlock.slice(0, nlIdx);
          const bodyLines = rawBlock.slice(nlIdx + 1).split("\n");
          let minIndent = Number.POSITIVE_INFINITY;
          for (const ln of bodyLines) {
            const clean = ln.endsWith("\r") ? ln.slice(0, -1) : ln;
            if (clean.trim() === "") continue;
            const ind = /^ */.exec(clean)?.[0].length ?? 0;
            if (ind < minIndent) minIndent = ind;
          }
          if (!Number.isFinite(minIndent) || minIndent <= 0) return;
          const dedented = bodyLines
            .map((ln) => {
              const lead = /^ */.exec(ln)?.[0].length ?? 0;
              return ln.slice(Math.min(minIndent, lead));
            })
            .join("\n");
          if (dedented.length >= slice.length) return;
          let inner = redactYamlCredentials(dedented, isSecretKey, maskToken, depth + 1);
          if (
            inner.count === 0 &&
            depth < 16 &&
            ((dedented.includes("{") && dedented.includes(":")) ||
              (dedented.includes("[") && dedented.includes("-")))
          ) {
            inner = redactInlineYamlFlowObjects(dedented, isSecretKey, maskToken, depth + 1);
          }
          if (inner.count > 0) {
            const pad = " ".repeat(minIndent);
            const reindented = inner.text
              .split("\n")
              .map((ln) => (ln === "" || ln === "\r" ? ln : `${pad}${ln}`))
              .join("\n");
            blockReplacements.push({
              start: node.range[0],
              end,
              replacement: `${headerLine}\n${reindented}`,
              count: inner.count,
            });
          }
          return;
        }
        // Inspect single-line & wrapped multiline scalars containing `{...}` / `[...]` or broken CLI/URL tokens
        const hasInlineCandidate =
          (node.value.includes("{") && node.value.includes(":")) ||
          (node.value.includes("[") && node.value.includes("-"));
        const isWrappedMultilineScalar =
          /[\r\n]/.test(rawBlock) &&
          !/[\r\n]/.test(node.value) &&
          !rawBlock
            .split(/\r\n|\r|\n/)
            .slice(1)
            .some((cl) => DIAG_COL0_LINE_RE.test(cl));
        if (depth < 16 && (hasInlineCandidate || isWrappedMultilineScalar)) {
          let inner = hasInlineCandidate
            ? redactInlineYamlFlowObjects(node.value, isSecretKey, maskToken, depth + 1)
            : { text: node.value, count: 0 };
          if (isWrappedMultilineScalar && node.value.length <= 8192) {
            const credRes = redactDiagnosticCredentials(inner.text, {
              keyMask: maskToken,
              tokenMask: maskToken,
              flagMask: maskToken,
              privateKeyMask: "[REDACTED_PRIVATE_KEY]",
              authMask: "[REDACTED_AUTH]",
              ipMask: "<REDACTED_IP>",
              bracketedIpMask: "[<REDACTED_IP>]",
            });
            if (credRes.count > 0 && credRes.text !== inner.text) {
              inner = { text: credRes.text, count: inner.count + credRes.count };
            }
          }
          if (inner.count > 0) {
            const anchorPrefix = /^((?:&[^\s]+|![^\s]+)[ \t]+)*/.exec(rawBlock)?.[0] ?? "";
            const bodyRaw = rawBlock.slice(anchorPrefix.length);
            let encoded: string;
            if (bodyRaw.startsWith("'") && !/[\r\n]/.test(bodyRaw)) {
              encoded = `'${inner.text.replace(/'/g, "''")}'`;
            } else if (!bodyRaw.startsWith('"') && !bodyRaw.startsWith("'") && !/[\r\n]/.test(bodyRaw)) {
              encoded = inner.text;
            } else {
              encoded = JSON.stringify(inner.text);
            }
            blockReplacements.push({
              start: node.range[0],
              end,
              replacement: `${anchorPrefix}${encoded}`,
              count: inner.count,
            });
          }
        }
      },
    });
  }

  const mergeRanges = (ranges: Array<[number, number]>): Array<[number, number]> => {
    ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
    const res: Array<[number, number]> = [];
    for (const [s, e] of ranges) {
      const prev = res[res.length - 1];
      if (prev && s <= prev[1]) {
        prev[1] = Math.max(prev[1], e);
      } else {
        res.push([s, e]);
      }
    }
    return res;
  };

  // Deduplicate and merge any overlapping mask ranges (e.g. anchor + alias)
  let merged = mergeRanges(
    rawEdits
      .map(([s, rawEnd]): [number, number] => [s, trimYamlRangeEnd(slice, s, rawEnd)])
      .filter(([s, e]) => e > s),
  );

  // O(log M) binary-search checks against sorted disjoint `merged` intervals.
  const isCoveredByMerged = (intervals: ReadonlyArray<[number, number]>, s: number, e: number): boolean => {
    let lo = 0;
    let hi = intervals.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      const [ms, me] = intervals[mid]!;
      if (me < s) lo = mid + 1;
      else if (ms > s) hi = mid - 1;
      else return e <= me;
    }
    return false;
  };
  const overlapsMerged = (intervals: ReadonlyArray<[number, number]>, s: number, e: number): boolean => {
    let lo = 0;
    let hi = intervals.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (intervals[mid]![1] <= s) lo = mid + 1;
      else hi = mid;
    }
    return lo < intervals.length && intervals[lo]![0] < e;
  };

  // If a masked range destroys an `&anchor` inside a collection, rewrite any surviving `*anchor` aliases
  // referencing that destroyed declaration so the output never fails with `Unresolved alias`.
  if (aliasEdges.length > 0 && merged.length > 0) {
    let pendingEdges = aliasEdges;
    for (let pass = 0; pass < 16 && pendingEdges.length > 0; pass += 1) {
      const nextPending: typeof aliasEdges = [];
      const additions: Array<[number, number]> = [];
      for (const edge of pendingEdges) {
        const [ts, te] = edge.targetRange;
        const [as, ae] = edge.aliasRange;
        if (isCoveredByMerged(merged, as, ae)) continue;
        if (isCoveredByMerged(merged, ts, te)) {
          additions.push([as, ae]);
        } else {
          nextPending.push(edge);
        }
      }
      if (additions.length === 0) break;
      merged = mergeRanges([...merged, ...additions]);
      pendingEdges = nextPending;
    }
  }

  const validBlocks = blockReplacements.filter((b) => !overlapsMerged(merged, b.start, b.end));

  if (merged.length === 0 && validBlocks.length === 0) {
    return { text: slice, count: 0 };
  }

  type PatchOp =
    | { kind: "mask"; start: number; end: number; count: number }
    | { kind: "block"; start: number; end: number; replacement: string; count: number };

  const ops: PatchOp[] = [
    ...merged.map(([start, end]): PatchOp => ({ kind: "mask", start, end, count: 1 })),
    ...validBlocks.map(
      (b): PatchOp => ({
        kind: "block",
        start: b.start,
        end: b.end,
        replacement: b.replacement,
        count: b.count,
      }),
    ),
  ].sort((a, b) => a.start - b.start);

  // Precompute physical line offsets once (O(1) on single-line compact JSON arrays, O(N) on multi-line docs)
  // and assemble edits forward in a single O(N) pass instead of rebuilding strings in reverse.
  const lineStarts: number[] = [0];
  if (slice.includes("\n") || slice.includes("\r")) {
    for (let p = 0; p < slice.length; p += 1) {
      const ch = slice[p]!;
      if (ch === "\r") {
        if (slice[p + 1] === "\n") p += 1;
        lineStarts.push(p + 1);
      } else if (ch === "\n") {
        lineStarts.push(p + 1);
      }
    }
  }
  const findLineIndexAt = (offset: number): number => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >>> 1;
      if (lineStarts[mid]! <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };
  // Track previous non-empty, non-comment line index incrementally in O(L) across ascending ops.
  let lastScannedLineIdx = -1;
  let lastNonCommentLine = "";
  const prevNonCommentLineBefore = (lineIdx: number): string => {
    for (let li = lastScannedLineIdx + 1; li < lineIdx; li += 1) {
      const ls = lineStarts[li]!;
      let le = li + 1 < lineStarts.length ? lineStarts[li + 1]! : slice.length;
      while (le > ls && (slice[le - 1] === "\n" || slice[le - 1] === "\r")) le -= 1;
      const ln = slice.slice(ls, le);
      const trimmed = ln.trim();
      if (trimmed !== "" && !trimmed.startsWith("#")) {
        lastNonCommentLine = ln;
      }
    }
    lastScannedLineIdx = Math.max(lastScannedLineIdx, lineIdx - 1);
    return lineIdx > 0 ? lastNonCommentLine : "";
  };

  const chunks: string[] = [];
  let cursor = 0;
  let totalCount = 0;
  for (const op of ops) {
    if (op.start < cursor) continue;
    chunks.push(slice.slice(cursor, op.start));
    totalCount += op.count;
    if (op.kind === "block") {
      const origBlock = slice.slice(op.start, op.end);
      chunks.push(padRemovedLineBreaks(origBlock, op.replacement));
    } else {
      const orig = slice.slice(op.start, op.end);
      const anchorPrefix = /^(&[^\s]+[ \t]+)/.exec(orig)?.[1] ?? "";
      const body = anchorPrefix ? orig.slice(anchorPrefix.length) : orig;
      const q =
        body.startsWith('"') && body.endsWith('"')
          ? '"'
          : body.startsWith("'") && body.endsWith("'")
            ? "'"
            : defaultQuote;
      const lineIdx = findLineIndexAt(op.start);
      const lineStart = lineStarts[lineIdx]!;
      let extraIndent = "";
      if (lineStarts.length > 1 && slice.slice(lineStart, op.start).trim() === "") {
        const curIndent = op.start - lineStart;
        const prevLine = prevNonCommentLineBefore(lineIdx);
        const prevSeqM = /^( *)-[ \t]+/.exec(prevLine);
        const prevLead = /^ */.exec(prevLine)?.[0].length ?? 0;
        const effectiveKeyCol = prevSeqM ? prevSeqM[0].length : prevLead;
        if (
          prevLine !== "" &&
          effectiveKeyCol >= curIndent &&
          /^(?: *-[ \t]+)? *(?:"[^"]+"|'[^']+'|[A-Za-z0-9_.-]+)[ \t]*:(?:[ \t]*(?:&[^\s]+|![^\s]+|[ \t]*))*(?:#.*)?$/.test(
            prevLine,
          )
        ) {
          extraIndent = " ".repeat(effectiveKeyCol + 2 - curIndent);
        }
      }
      chunks.push(padRemovedLineBreaks(orig, `${extraIndent}${anchorPrefix}${q}${maskToken}${q}`));
    }
    cursor = op.end;
  }
  chunks.push(slice.slice(cursor));
  return { text: chunks.join(""), count: totalCount };
}

function redactInlineYamlFlowObjects(
  raw: string,
  isSecretKey: (key: string) => boolean,
  maskToken: string,
  depth = 0,
  options?: {
    externalSecretAnchors?: ReadonlySet<string> | undefined;
    outReferencedAliases?: Set<string> | undefined;
    externalAnchorValues?: ReadonlyMap<string, string> | undefined;
    outDefinedAnchorValues?: Map<string, string> | undefined;
  },
): RedactCountResult {
  const hasFlowObj = raw.includes("{") && raw.includes("}") && raw.includes(":");
  const hasArgvHint =
    raw.includes("[") &&
    raw.includes("]") &&
    (raw.includes("-") ||
      /\b(?:docker|podman|nerdctl|helm|crictl|curl|mysql|mariadb|mysqldump|mysqladmin|mysqlsh|sshpass|obsutil)\b/i.test(
        raw,
      ));
  if (!hasFlowObj && !hasArgvHint) return { text: raw, count: 0 };
  let count = 0;
  let out = "";
  const isFlowQuoteStart = (quoteIdx: number): boolean => {
    let q = quoteIdx - 1;
    while (q >= 0 && (raw[q] === " " || raw[q] === "\t")) q -= 1;
    if (q < 0) return true;
    const prev = raw[q]!;
    if (prev === "{" || prev === "[" || prev === "," || prev === ":" || prev === "\r" || prev === "\n") {
      return true;
    }
    // Also allow YAML `&anchor` / `!tag` immediately preceding a quoted value inside `{...}` / `[...]`
    let w = q;
    while (w >= 0 && /[A-Za-z0-9_.-]/.test(raw[w]!)) w -= 1;
    if (w >= 0 && (raw[w] === "&" || raw[w] === "!") && w < q) {
      let bw = w - 1;
      while (bw >= 0 && (raw[bw] === " " || raw[bw] === "\t")) bw -= 1;
      return (
        bw < 0 ||
        raw[bw] === "{" ||
        raw[bw] === "[" ||
        raw[bw] === "," ||
        raw[bw] === ":" ||
        raw[bw] === "\r" ||
        raw[bw] === "\n"
      );
    }
    return false;
  };

  const tryFlowCandidate = (
    startIdx: number,
    endIdx: number,
    openChar: "{" | "[",
  ): RedactCountResult | null => {
    const candidate = raw.slice(startIdx, endIdx);
    if (openChar === "{") {
      if (!candidate.includes(":")) return null;
    } else {
      if (candidate.startsWith("[REDACTED") || candidate.startsWith("[<REDACTED")) return null;
      if (
        !(
          candidate.includes('"') ||
          candidate.includes("'") ||
          candidate.includes(",") ||
          candidate.includes(":")
        )
      ) {
        return null;
      }
      if (
        !(
          candidate.includes("-") ||
          /\b(?:docker|podman|nerdctl|helm|crictl|curl|mysql|mariadb|mysqldump|mysqladmin|mysqlsh|sshpass|obsutil)\b/i.test(
            candidate,
          )
        )
      ) {
        return null;
      }
    }
    const flowQuote: '"' | "'" = raw[startIdx - 1] === '"' ? "'" : '"';
    return tryRedactValidYamlSlice(candidate, isSecretKey, maskToken, depth, flowQuote, options);
  };

  // Single O(N) stack pass matching `{...}` and `[...]` pairs; prevents O(N^2) EOF rescans on unmatched `{` runs.
  // Outer shell wrapper quotes (`openStack.length === 0`, e.g. `--config '{...}'`) never suppress `{...}` / `[...]`.
  const matchedPairs = new Map<number, { end: number; kind: "{" | "[" }>();
  const openStack: Array<{ pos: number; kind: "{" | "[" }> = [];
  let scanQuote: '"' | "'" | null = null;
  let scanQuoteStart = -1;
  let unclosedQuoteCloseBraces: number[] = [];
  let unclosedQuoteRetryCount = 0;
  for (let p = 0; p < raw.length; p += 1) {
    const ch = raw[p]!;
    if (scanQuote) {
      if (scanQuote === '"' && ch === "\\" && p + 1 < raw.length) {
        p += 1;
      } else if (scanQuote === "'" && ch === "'" && raw[p + 1] === "'") {
        p += 1;
      } else if (ch === scanQuote) {
        scanQuote = null;
        unclosedQuoteCloseBraces = [];
      } else if (ch === "}") {
        unclosedQuoteCloseBraces.push(p);
      }
      if (p === raw.length - 1 && scanQuote !== null && unclosedQuoteRetryCount < 4) {
        // Recover cleanly in O(1) state when an unclosed quote inside bad `{` precedes a valid `{...}` later
        unclosedQuoteRetryCount += 1;
        p = scanQuoteStart;
        scanQuote = null;
        unclosedQuoteCloseBraces = [];
      }
      continue;
    }
    if (openStack.length > 0 && (ch === '"' || ch === "'") && isFlowQuoteStart(p)) {
      scanQuote = ch;
      scanQuoteStart = p;
      unclosedQuoteCloseBraces = [];
    } else if (ch === "{" || ch === "[") {
      openStack.push({ pos: p, kind: ch });
    } else if (
      (ch === "}" || ch === "]") &&
      openStack.length > 0 &&
      openStack[openStack.length - 1]!.kind === (ch === "}" ? "{" : "[")
    ) {
      const top = openStack.pop()!;
      matchedPairs.set(top.pos, { end: p + 1, kind: top.kind });
    }
  }

  const unclosedFallbackStarts = new Set<number>();
  if (scanQuote !== null && openStack.length > 0 && unclosedQuoteCloseBraces.length > 0) {
    const startFrom = Math.max(0, openStack.length - Math.min(unclosedQuoteCloseBraces.length, 8));
    for (let k = startFrom; k < openStack.length; k += 1) {
      if (openStack[k]!.kind === "{") unclosedFallbackStarts.add(openStack[k]!.pos);
    }
  }

  let fallbackBudget = 16;
  const activeFailedEnds: number[] = [];
  let i = 0;
  while (i < raw.length) {
    while (activeFailedEnds.length > 0 && activeFailedEnds[activeFailedEnds.length - 1]! <= i) {
      activeFailedEnds.pop();
    }
    const cur = raw[i]!;
    if (cur !== "{" && cur !== "[") {
      out += cur;
      i += 1;
      continue;
    }
    const matched = matchedPairs.get(i);
    if (matched !== undefined && matched.end > i + 2) {
      const redundantBareWrapper = activeFailedEnds.length >= 6 && raw[i + 1] === cur;
      if (activeFailedEnds.length < 16 && !redundantBareWrapper) {
        const res = tryFlowCandidate(i, matched.end, matched.kind);
        if (res !== null) {
          out += res.text;
          count += res.count;
          i = matched.end;
          continue;
        }
        activeFailedEnds.push(matched.end);
      }
    } else if (cur === "{" && unclosedFallbackStarts.has(i) && fallbackBudget > 0) {
      let matchedFallback = false;
      for (let b = 0; b < unclosedQuoteCloseBraces.length && fallbackBudget > 0; b += 1) {
        const probe = unclosedQuoteCloseBraces[b]!;
        if (probe <= i + 1 || probe + 1 - i > 16384) continue;
        fallbackBudget -= 1;
        const res = tryFlowCandidate(i, probe + 1, "{");
        if (res !== null) {
          out += res.text;
          count += res.count;
          i = probe + 1;
          matchedFallback = true;
          break;
        }
      }
      if (matchedFallback) continue;
    }
    out += cur;
    i += 1;
  }
  return { text: out, count };
}

const SHELL_CMD_LINE_RE =
  /^[ \t]*(?:export[ \t]+|vllm[ \t]+serve\b|python3?[ \t]+-m\b|docker[ \t]+run\b|(?:curl|nohup|setsid|cat|tee|kubectl|helm|bash|sh|echo|env|sudo)(?=[ \t]+(?!:)|<<)|#!|[A-Za-z_][A-Za-z0-9_]*=)/;

const HEREDOC_OPENER_RE = /<<-?[ \t]*(?:'([^']+)'|"([^"]+)"|\\?([A-Za-z0-9_-]+))/;

/**
 * Redact YAML 1.2 block, plain, folded, literal, and flow-mapping credentials using `yaml`'s
 * official YAML 1.2 AST parser (both on full YAML documents and on YAML chunks / `{...}` flow
 * objects embedded inside mixed shell scripts), plus cross-fragment anchor resolution and a
 * YAML-1.2-compliant line fallback.
 */
export function redactYamlCredentials(
  raw: string,
  isSecretKey: (key: string) => boolean,
  maskToken: string,
  depth = 0,
  externalSecretAnchors?: ReadonlySet<string>,
  externalAnchorValues?: ReadonlyMap<string, string>,
): RedactCountResult {
  const normalizedRaw = raw.replace(/\r\n?/g, "\n");
  const lines = normalizedRaw.split("\n");
  const hasTopLevelShell = lines.some((ln) => {
    return (/^ */.exec(ln)?.[0].length ?? 0) === 0 && SHELL_CMD_LINE_RE.test(ln);
  });

  const sharedSecretAnchors = new Set<string>(externalSecretAnchors);
  const sharedAnchorValues = new Map<string, string>(externalAnchorValues);
  if (normalizedRaw.includes("&") && normalizedRaw.includes("*")) {
    const anchorDefRe = /(?:^|[:[{,\s])&([A-Za-z0-9_-]+)[ \t]+(?:"([^"\n]*)"|'([^'\n]*)'|([^#\s,\]}]+))/g;
    for (const am of normalizedRaw.matchAll(anchorDefRe)) {
      const aName = am[1];
      const aVal = am[2] ?? am[3] ?? am[4];
      if (aName && aVal !== undefined && !sharedAnchorValues.has(aName)) {
        sharedAnchorValues.set(aName, aVal);
      }
    }
  }

  // 1. Fast path: entire payload is valid YAML 1.2 document(s) without top-level shell commands
  let failedWholeText: string | null = null;
  if (!hasTopLevelShell) {
    const whole = tryRedactValidYamlSlice(normalizedRaw, isSecretKey, maskToken, depth, '"', {
      externalSecretAnchors: sharedSecretAnchors,
      outReferencedAliases: sharedSecretAnchors,
      externalAnchorValues: sharedAnchorValues,
      outDefinedAnchorValues: sharedAnchorValues,
    });
    if (whole !== null) {
      return whole;
    }
    failedWholeText = normalizedRaw;
  }

  let totalCount = 0;

  // 2. Mixed shell + YAML: partition contiguous non-shell segments & sub-blocks (e.g. sequence vs mapping without `---`)
  const rebuiltLines: string[] = [];
  let segStart = 0;

  const flushYamlCandidateLines = (segLines: string[]) => {
    if (segLines.length === 0) return;
    const joined = segLines.join("\n");
    if (joined !== failedWholeText) {
      const wholeSeg = tryRedactValidYamlSlice(joined, isSecretKey, maskToken, depth, '"', {
        externalSecretAnchors: sharedSecretAnchors,
        outReferencedAliases: sharedSecretAnchors,
        externalAnchorValues: sharedAnchorValues,
        outDefinedAnchorValues: sharedAnchorValues,
      });
      if (wholeSeg !== null) {
        totalCount += wholeSeg.count;
        rebuiltLines.push(wholeSeg.text);
        return;
      }
    }
    // Sub-split when top-level sequence `- ...`, mapping `key: ...`, or plain log line transitions without `---`
    const subChunks: string[][] = [];
    let curKind: "seq" | "map" | "plain" | null = null;
    for (const ln of segLines) {
      const clean = ln.endsWith("\r") ? ln.slice(0, -1) : ln;
      const trimmed = clean.trim();
      if (trimmed !== "" && !trimmed.startsWith("#") && /^ */.exec(clean)?.[0].length === 0) {
        const lineKind: "seq" | "map" | "plain" = /^-(?:[ \t]|$)/.test(clean)
          ? "seq"
          : /^(?:"[^"]+"|'[^']+'|[A-Za-z0-9_.-]+)[ \t]*:(?:[ \t]|$)/.test(clean)
            ? "map"
            : DIAG_COL0_LINE_RE.test(clean)
              ? "plain"
              : (curKind ?? "plain");
        if (curKind !== null && lineKind !== curKind && subChunks.length > 0) {
          subChunks.push([ln]);
          curKind = lineKind;
          continue;
        }
        curKind = lineKind;
      }
      if (subChunks.length === 0) subChunks.push([ln]);
      else subChunks[subChunks.length - 1]!.push(ln);
    }
    const findBrokenLineForRecovery = (sub: string[]): number => {
      const subText = sub.join("\n");
      let firstErrPos = subText.length;
      if (!hasExcessiveFlowNesting(subText)) {
        try {
          const docs = parseAllDocuments(subText, { strict: false, uniqueKeys: false });
          for (const d of docs) {
            const p = d.errors[0]?.pos?.[0];
            if (typeof p === "number" && p < firstErrPos) firstErrPos = p;
          }
        } catch {
          // Ignore parse throw and fall back to unbalanced-delimiter scan
        }
      }
      if (firstErrPos < subText.length - 1) {
        let acc = 0;
        for (let k = 0; k < sub.length; k += 1) {
          acc += sub[k]!.length + 1;
          if (firstErrPos < acc) return k;
        }
      }
      for (let k = sub.length - 1; k >= 0; k -= 1) {
        const ln = sub[k]!;
        let brace = 0;
        let bracket = 0;
        let quote: '"' | "'" | null = null;
        for (let p = 0; p < ln.length; p += 1) {
          const c = ln[p]!;
          if (quote) {
            if (quote === '"' && c === "\\" && p + 1 < ln.length) {
              p += 1;
              continue;
            }
            if (quote === "'" && c === "'" && ln[p + 1] === "'") {
              p += 1;
              continue;
            }
            if (c === quote) quote = null;
            continue;
          }
          if (c === '"' || c === "'") quote = c;
          else if (c === "{") brace += 1;
          else if (c === "}" && brace > 0) brace -= 1;
          else if (c === "[") bracket += 1;
          else if (c === "]" && bracket > 0) bracket -= 1;
        }
        if (brace > 0 || bracket > 0 || quote !== null) return k;
      }
      return sub.length - 1;
    };

    const flushValidOrRecover = (sub: string[], recoverDepth = 0, skipDuplicateJoined = false) => {
      if (sub.length === 0) return;
      const subText = sub.join("\n");
      if (!skipDuplicateJoined) {
        const subRes = tryRedactValidYamlSlice(subText, isSecretKey, maskToken, depth, '"', {
          externalSecretAnchors: sharedSecretAnchors,
          outReferencedAliases: sharedSecretAnchors,
          externalAnchorValues: sharedAnchorValues,
          outDefinedAnchorValues: sharedAnchorValues,
        });
        if (subRes !== null) {
          totalCount += subRes.count;
          rebuiltLines.push(subRes.text);
          return;
        }
      }
      if (sub.length > 1 && recoverDepth < 4) {
        const brokenIdx = findBrokenLineForRecovery(sub);
        const joinsBackslashCont =
          brokenIdx > 0 &&
          /(?:^|[^\\])\\$/.test(sub[brokenIdx - 1]!.trimEnd()) &&
          !DIAG_COL0_LINE_RE.test(sub[brokenIdx]!);
        if (!joinsBackslashCont && brokenIdx >= 0 && brokenIdx < sub.length) {
          flushValidOrRecover(sub.slice(0, brokenIdx), recoverDepth + 1);
          rebuiltLines.push(sub[brokenIdx]!);
          flushValidOrRecover(sub.slice(brokenIdx + 1), recoverDepth + 1);
          return;
        }
      }
      rebuiltLines.push(subText);
    };

    for (const sub of subChunks) {
      flushValidOrRecover(sub, 0, subChunks.length === 1);
    }
  };

  for (let i = 0; i < lines.length; i += 1) {
    const clean = lines[i]!;
    if (SHELL_CMD_LINE_RE.test(clean)) {
      flushYamlCandidateLines(lines.slice(segStart, i));
      rebuiltLines.push(lines[i]!);
      const heredocMatch = HEREDOC_OPENER_RE.exec(clean);
      const delim = heredocMatch ? (heredocMatch[1] ?? heredocMatch[2] ?? heredocMatch[3]) : undefined;
      if (delim) {
        let closeIdx = -1;
        for (let k = i + 1; k < lines.length; k += 1) {
          if (lines[k]!.trim() === delim) {
            closeIdx = k;
            break;
          }
        }
        if (closeIdx > i) {
          const bodyLines = lines.slice(i + 1, closeIdx);
          if (bodyLines.length > 0) {
            if (depth >= 256) {
              rebuiltLines.push(`"${maskToken}"`);
              for (let p = 1; p < bodyLines.length; p += 1) rebuiltLines.push("");
              totalCount += 1;
            } else {
              let minIndent = Number.POSITIVE_INFINITY;
              for (const ln of bodyLines) {
                if (ln.trim() === "") continue;
                const ind = /^[ \t]*/.exec(ln)?.[0].length ?? 0;
                if (ind < minIndent) minIndent = ind;
              }
              const prefix =
                Number.isFinite(minIndent) && minIndent > 0
                  ? (bodyLines.find((l) => l.trim() !== "")?.slice(0, minIndent) ?? "")
                  : "";
              const dedented = prefix
                ? bodyLines.map((ln) => (ln.startsWith(prefix) ? ln.slice(prefix.length) : ln)).join("\n")
                : bodyLines.join("\n");
              const inner = redactYamlCredentials(dedented, isSecretKey, maskToken, depth + 1);
              totalCount += inner.count;
              const restored = prefix
                ? inner.text
                    .split("\n")
                    .map((ln) => (ln === "" ? ln : `${prefix}${ln}`))
                    .join("\n")
                : inner.text;
              rebuiltLines.push(restored);
            }
          }
          rebuiltLines.push(lines[closeIdx]!);
          i = closeIdx;
          segStart = closeIdx + 1;
          continue;
        }
      }
      segStart = i + 1;
    }
  }
  flushYamlCandidateLines(lines.slice(segStart));

  // 3. Inline `{ key: val }` YAML flow objects inside shell lines or comments
  const afterFlow = redactInlineYamlFlowObjects(rebuiltLines.join("\n"), isSecretKey, maskToken, depth, {
    externalSecretAnchors: sharedSecretAnchors,
    outReferencedAliases: sharedSecretAnchors,
    externalAnchorValues: sharedAnchorValues,
    outDefinedAnchorValues: sharedAnchorValues,
  });
  totalCount += afterFlow.count;

  // 4. Fallback line-scanner for malformed/partial YAML snippets with unclosed syntax on other lines
  const fallbackLines = afterFlow.text.split("\n");
  const outLines: string[] = [];
  const yamlMapLineRe =
    /^( *)(-[ \t]+)?(?:"((?:\\.|[^"\\])+)"|'((?:\\.|[^'\\])+)'|([A-Za-z0-9_.-]+))([ \t]*:[ \t]*)(.*)$/;
  let idx = 0;
  let pendingStructuredSecretCol: number | null = null;
  let authsIndent: number | null = null;
  let authsRegistryIndent: number | null = null;
  let secretDocIndent: number | null = null;
  let secretListIndent: number | null = null;
  let secretDataIndent: number | null = null;
  const pushRemovedBlankLines = (consumedLines: number) => {
    for (let p = 1; p < consumedLines; p += 1) outLines.push("");
  };
  while (idx < fallbackLines.length) {
    const cleanLine = fallbackLines[idx]!;
    if (/^(?:---|\.\.\.)(?:[ \t]|$)/.test(cleanLine)) {
      sharedSecretAnchors.clear();
      sharedAnchorValues.clear();
      pendingStructuredSecretCol = null;
      authsIndent = null;
      authsRegistryIndent = null;
      secretDocIndent = null;
      secretListIndent = null;
      secretDataIndent = null;
      outLines.push(cleanLine);
      idx += 1;
      continue;
    }
    const m = yamlMapLineRe.exec(cleanLine);
    if (!m) {
      if (cleanLine.trim() !== "" && !cleanLine.trim().startsWith("#")) {
        const ind = /^ */.exec(cleanLine)?.[0].length ?? 0;
        if (pendingStructuredSecretCol !== null && ind <= pendingStructuredSecretCol) {
          pendingStructuredSecretCol = null;
        }
        if (authsIndent !== null && ind <= authsIndent) {
          authsIndent = null;
          authsRegistryIndent = null;
        } else if (authsRegistryIndent !== null && ind <= authsRegistryIndent) {
          authsRegistryIndent = null;
        }
        if (secretDocIndent !== null && ind < secretDocIndent) {
          secretDocIndent = null;
          secretDataIndent = null;
        }
        if (secretListIndent !== null && ind < secretListIndent) {
          secretListIndent = null;
          secretDataIndent = null;
        }
        if (secretDataIndent !== null && ind <= secretDataIndent) {
          secretDataIndent = null;
        }
      }
      outLines.push(cleanLine);
      idx += 1;
      continue;
    }
    const leadIndent = m[1] ?? "";
    const seqDash = m[2] ?? "";
    const keyName = m[3] ?? m[4] ?? m[5] ?? "";
    const colonSep = m[6] ?? ": ";
    const restRaw = m[7] ?? "";
    const rest = restRaw.trim();
    const minBlockIndent = leadIndent.length;
    const keyCol = leadIndent.length + seqDash.length;
    const lowerKey = keyName.trim().toLowerCase();

    if (seqDash.length > 0 || (pendingStructuredSecretCol !== null && keyCol < pendingStructuredSecretCol)) {
      pendingStructuredSecretCol = null;
    }
    if (AUTHS_CONTAINER_KEY_RE.test(lowerKey)) {
      authsIndent = keyCol;
      authsRegistryIndent = null;
    } else if (authsIndent !== null) {
      if (keyCol <= authsIndent) {
        authsIndent = null;
        authsRegistryIndent = null;
      } else if (authsRegistryIndent === null || keyCol <= authsRegistryIndent) {
        authsRegistryIndent = keyCol;
      }
    }
    const trimmedKindVal = rest.replace(/^["']|["']$/g, "").trim();
    if (lowerKey === "kind" && trimmedKindVal === "Secret") {
      secretDocIndent = keyCol;
      secretListIndent = null;
      secretDataIndent = null;
    } else if (lowerKey === "kind" && trimmedKindVal === "SecretList") {
      secretListIndent = keyCol;
      secretDocIndent = null;
      secretDataIndent = null;
    } else {
      if (secretDocIndent !== null && keyCol < secretDocIndent) {
        secretDocIndent = null;
        secretDataIndent = null;
      }
      if (secretListIndent !== null && keyCol < secretListIndent) {
        secretListIndent = null;
        secretDataIndent = null;
      }
      if (
        (secretDocIndent !== null &&
          keyCol === secretDocIndent &&
          (lowerKey === "data" || lowerKey === "stringdata")) ||
        (secretListIndent !== null &&
          keyCol > secretListIndent &&
          (lowerKey === "data" || lowerKey === "stringdata"))
      ) {
        secretDataIndent = keyCol;
      } else if (secretDataIndent !== null && keyCol <= secretDataIndent) {
        secretDataIndent = null;
      }
    }
    const isAuthsCredentialField =
      authsIndent !== null &&
      authsRegistryIndent !== null &&
      keyCol > authsRegistryIndent &&
      AUTHS_CREDENTIAL_KEY_RE.test(lowerKey);
    const isSecretDataField = secretDataIndent !== null && keyCol > secretDataIndent;

    if (lowerKey === "name" || lowerKey === "key" || lowerKey === "env_name" || lowerKey === "var") {
      const rawNameVal = rest.replace(/^["']|["']$/g, "");
      const aliasNameMatch = /^\*([A-Za-z0-9_-]+)/.exec(rawNameVal);
      const resolvedNameVal =
        aliasNameMatch?.[1] && sharedAnchorValues.has(aliasNameMatch[1])
          ? sharedAnchorValues.get(aliasNameMatch[1])!
          : rawNameVal;
      pendingStructuredSecretCol = isSecretKey(resolvedNameVal) ? keyCol : null;
    }
    const isDirectSecretKey = isSecretKey(keyName);
    const effectiveSecretKey =
      isDirectSecretKey ||
      isAuthsCredentialField ||
      isSecretDataField ||
      (pendingStructuredSecretCol !== null &&
        keyCol >= pendingStructuredSecretCol &&
        (lowerKey === "value" || lowerKey === "val" || lowerKey === "secret" || lowerKey === "default"));

    const restAfterProps = rest.replace(/^(?:(?:&[A-Za-z0-9_-]+|![^\s]+)[ \t]*)+/, "");
    const skipWeakLiteral =
      !isAuthsCredentialField &&
      !isSecretDataField &&
      isDirectSecretKey &&
      isNonSecretLiteralText(keyName, restAfterProps);
    const skipUnquotedHttpAuth =
      (lowerKey === "authorization" || lowerKey === "proxy-authorization") &&
      (AUTH_SCHEME_PREFIX_RE.test(restAfterProps) || ALREADY_REDACTED_AUTH_PREFIX_RE.test(restAfterProps));
    if (
      !effectiveSecretKey ||
      skipWeakLiteral ||
      skipUnquotedHttpAuth ||
      (!isAuthsCredentialField && !isSecretDataField && (rest.startsWith('"') || rest.startsWith("'")))
    ) {
      outLines.push(cleanLine);
      idx += 1;
      continue;
    }
    for (const am of rest.matchAll(/\*([A-Za-z0-9_-]+)/g)) {
      if (am[1]) sharedSecretAnchors.add(am[1]);
    }
    const blockHeaderMatch = /^([|>])([-+\d]*)(?:[ \t]+#.*)?$/.exec(restAfterProps);
    const isBlockHeader = blockHeaderMatch !== null;
    const isEmptyRest = restAfterProps === "" || restAfterProps.startsWith("#");
    const renderedKey = m[3] !== undefined ? `"${m[3]}"` : m[4] !== undefined ? `'${m[4]}'` : keyName;

    if (
      (isAuthsCredentialField || isSecretDataField) &&
      (restAfterProps.startsWith('"') || restAfterProps.startsWith("'"))
    ) {
      const qChar = restAfterProps[0] as '"' | "'";
      const normSep = colonSep.includes(" ") || colonSep.includes("\t") ? colonSep : `${colonSep} `;
      const trimmedInner = restAfterProps.slice(
        1,
        restAfterProps.endsWith(qChar) && restAfterProps.length > 1 ? -1 : undefined,
      );
      if (trimmedInner !== "" && !ALREADY_REDACTED_RE.test(trimmedInner)) {
        outLines.push(`${leadIndent}${seqDash}${renderedKey}${normSep}${qChar}${maskToken}${qChar}`);
        totalCount += 1;
        idx += 1;
        continue;
      }
    }

    if (isBlockHeader) {
      const digitMatch = /[1-9]/.exec(blockHeaderMatch[2] ?? "");
      let blockIndent: number | null = digitMatch ? minBlockIndent + Number(digitMatch[0]) : null;
      let j = idx + 1;
      let lastContentEnd = idx + 1;
      while (j < fallbackLines.length) {
        const nextClean = fallbackLines[j]!;
        const trimmedNext = nextClean.trim();
        if (trimmedNext === "") {
          j += 1;
          continue;
        }
        // YAML 1.2.2 §8.1.1.1: ONLY spaces (`^ *`) count toward indentation, never `\t`!
        const nextIndent = /^ */.exec(nextClean)?.[0].length ?? 0;
        if (blockIndent === null) {
          if (nextIndent <= minBlockIndent) break;
          if (trimmedNext.startsWith("#") && nextIndent <= keyCol) break;
          if (
            seqDash.length > 0 &&
            nextIndent === keyCol &&
            /^ *(?:"[^"]+"|'[^']+'|[A-Za-z0-9_.-]+)[ \t]*:(?:[ \t]|$)/.test(nextClean)
          ) {
            break;
          }
          if (trimmedNext.startsWith("#")) {
            j += 1;
            continue;
          }
          blockIndent = nextIndent;
        }
        if (nextIndent >= blockIndent) {
          lastContentEnd = j + 1;
          j += 1;
          continue;
        }
        break;
      }
      if (lastContentEnd > idx + 1) {
        const normSep = colonSep.includes(" ") || colonSep.includes("\t") ? colonSep : `${colonSep} `;
        outLines.push(`${leadIndent}${seqDash}${renderedKey}${normSep}"${maskToken}"`);
        pushRemovedBlankLines(lastContentEnd - idx);
        totalCount += 1;
        idx = lastContentEnd;
        continue;
      }
    } else if (isEmptyRest) {
      let j = idx + 1;
      let lastContentEnd = idx + 1;
      while (j < fallbackLines.length) {
        const nextClean = fallbackLines[j]!;
        const trimmedNext = nextClean.trim();
        if (trimmedNext === "" || trimmedNext.startsWith("#")) {
          j += 1;
          continue;
        }
        const nextIndent = /^ */.exec(nextClean)?.[0].length ?? 0;
        if (nextIndent > keyCol) {
          lastContentEnd = j + 1;
          j += 1;
          continue;
        }
        break;
      }
      if (lastContentEnd > idx + 1) {
        const normSep = colonSep.includes(" ") || colonSep.includes("\t") ? colonSep : `${colonSep} `;
        outLines.push(`${leadIndent}${seqDash}${renderedKey}${normSep}"${maskToken}"`);
        pushRemovedBlankLines(lastContentEnd - idx);
        totalCount += 1;
        idx = lastContentEnd;
        continue;
      }
    } else if (!rest.startsWith("[REDACTED") && !rest.includes(maskToken)) {
      if (rest.startsWith("{") || rest.startsWith("[")) {
        const emptyFlow =
          rest === "{}" || rest === "[]" || /^\{\}[ \t]*#/.test(rest) || /^\[\][ \t]*#/.test(rest);
        if (!emptyFlow) {
          const openChar = rest[0] as "{" | "[";
          const closeChar = openChar === "{" ? "}" : "]";
          let depthFlow = 0;
          let quoteFlow: '"' | "'" | null = null;
          let endLineIdx = idx;
          let foundClose = false;
          for (let j = idx; j < fallbackLines.length; j += 1) {
            const curClean = fallbackLines[j]!;
            if (j > idx && DIAG_COL0_LINE_RE.test(curClean)) break;
            const scanFrom = j === idx ? curClean.indexOf(openChar, leadIndent.length + seqDash.length) : 0;
            for (let k = Math.max(0, scanFrom); k < curClean.length; k += 1) {
              const ch = curClean[k]!;
              if (quoteFlow) {
                if (quoteFlow === '"' && ch === "\\" && k + 1 < curClean.length) {
                  k += 1;
                  continue;
                }
                if (quoteFlow === "'" && ch === "'" && curClean[k + 1] === "'") {
                  k += 1;
                  continue;
                }
                if (ch === quoteFlow) quoteFlow = null;
                continue;
              }
              if (ch === '"' || ch === "'") quoteFlow = ch;
              else if (ch === openChar) depthFlow += 1;
              else if (ch === closeChar) {
                depthFlow -= 1;
                if (depthFlow === 0) {
                  foundClose = true;
                  break;
                }
              }
            }
            endLineIdx = j;
            if (foundClose) break;
          }
          const normSep = colonSep.includes(" ") || colonSep.includes("\t") ? colonSep : `${colonSep} `;
          outLines.push(`${leadIndent}${seqDash}${renderedKey}${normSep}"${maskToken}"`);
          pushRemovedBlankLines(endLineIdx + 1 - idx);
          totalCount += 1;
          idx = endLineIdx + 1;
          continue;
        }
      } else {
        const inlineCommentMatch = /([ \t]+#.*)$/.exec(restRaw);
        const inlineComment = inlineCommentMatch ? inlineCommentMatch[1] : "";
        let prevEndedWithBackslash = /(?:^|[^\\])\\$/.test(cleanLine.trimEnd());
        let j = idx + 1;
        let lastContentEnd = idx + 1;
        while (j < fallbackLines.length) {
          const nextClean = fallbackLines[j]!;
          const trimmedNext = nextClean.trim();
          if (trimmedNext === "" || trimmedNext.startsWith("#")) {
            if (prevEndedWithBackslash) break;
            j += 1;
            continue;
          }
          if (DIAG_COL0_LINE_RE.test(nextClean)) break;
          const nextIndent = /^ */.exec(nextClean)?.[0].length ?? 0;
          if (nextIndent > keyCol || prevEndedWithBackslash) {
            lastContentEnd = j + 1;
            prevEndedWithBackslash = /(?:^|[^\\])\\$/.test(nextClean.trimEnd());
            j += 1;
            continue;
          }
          break;
        }
        const normSep = colonSep.includes(" ") || colonSep.includes("\t") ? colonSep : `${colonSep} `;
        outLines.push(`${leadIndent}${seqDash}${renderedKey}${normSep}"${maskToken}"${inlineComment}`);
        pushRemovedBlankLines(lastContentEnd - idx);
        totalCount += 1;
        idx = lastContentEnd;
        continue;
      }
    }
    outLines.push(cleanLine);
    idx += 1;
  }

  if (sharedSecretAnchors.size > 0) {
    for (let k = 0; k < outLines.length; k += 1) {
      const cleanLn = outLines[k]!;
      const lm = yamlMapLineRe.exec(cleanLn);
      if (!lm) continue;
      const anchorExec = /^(&([A-Za-z0-9_-]+))[ \t]+(.*)$/.exec((lm[7] ?? "").trim());
      if (anchorExec && sharedSecretAnchors.has(anchorExec[2]!) && !anchorExec[3]!.includes(maskToken)) {
        for (const am of anchorExec[3]!.matchAll(/\*([A-Za-z0-9_-]+)/g)) {
          if (am[1]) sharedSecretAnchors.add(am[1]);
        }
        const sep = lm[6] ?? ": ";
        const normSep = sep.includes(" ") || sep.includes("\t") ? sep : `${sep} `;
        const rKey = lm[3] !== undefined ? `"${lm[3]}"` : lm[4] !== undefined ? `'${lm[4]}'` : (lm[5] ?? "");
        outLines[k] = `${lm[1] ?? ""}${lm[2] ?? ""}${rKey}${normSep}${anchorExec[1]} "${maskToken}"`;
        totalCount += 1;
      }
    }
  }

  const outText = outLines.join("\n");
  if (sharedSecretAnchors.size > (externalSecretAnchors?.size ?? 0) && depth < 8 && outText.includes("&")) {
    const anchorSweep = redactYamlCredentials(
      outText,
      isSecretKey,
      maskToken,
      depth + 1,
      sharedSecretAnchors,
      sharedAnchorValues,
    );
    return { text: anchorSweep.text, count: totalCount + anchorSweep.count };
  }

  return { text: outText, count: totalCount };
}

export interface DiagnosticRedactionMasks {
  readonly keyMask: string;
  readonly tokenMask: string;
  readonly flagMask: string;
  readonly privateKeyMask: string;
  readonly authMask: string;
  readonly ipMask: string;
  readonly bracketedIpMask: string;
}

const INVISIBLE_CHAR_RE = /[\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff\u{e0000}-\u{e007f}]/gu;
const YAML_SECRET_KEY_SHAPE_RE =
  /^(?:[A-Za-z0-9_.-]+|(?:api|access|private|secret|auth|client|bearer|oauth|jwt|github|gitlab|git|pat|identity|registry|refresh|hf|huggingface|session|basic|proxy|docker|ssh|tls|ssl|signing|encryption|service|master|db|database|webhook) (?:key|token|secret|id|auth|auth[- ]config|password|passwd|pwd|credential|credentials))$/i;
const CONTINUATION_OPT_RE =
  /^--?(?:port|host|model|tp|pp|dp|dtype|max-|tensor-|pipeline-|gpu-|enable-|enforce-|trust-|kv-|served-|tokenizer|quantization|speculative|additional-|compilation-)/i;

interface FlowContextInfo {
  readonly inBraceOrBracket: boolean;
  readonly inParen: boolean;
  readonly outerQuote: '"' | "'" | null;
}

function createFlowContextScanner(text: string): { at: (idx: number) => FlowContextInfo } {
  let pos = 0;
  let brace = 0;
  let bracket = 0;
  let paren = 0;
  let quote: '"' | "'" | null = null;
  return {
    at(targetIdx: number): FlowContextInfo {
      while (pos < targetIdx && pos < text.length) {
        const ch = text[pos]!;
        if (ch === "\r" || ch === "\n") {
          brace = 0;
          bracket = 0;
          paren = 0;
          quote = null;
          pos += 1;
          continue;
        }
        if (quote) {
          if (quote === '"' && ch === "\\" && pos + 1 < targetIdx) {
            const next = text[pos + 1];
            if (next === "\r" || next === "\n") {
              pos += 1;
            } else {
              pos += 2;
            }
            continue;
          }
          if (quote === "'" && ch === "\\" && pos + 1 < targetIdx) {
            const next = text[pos + 1];
            if (next === "\r" || next === "\n") {
              pos += 1;
            } else if (next === "'") {
              if (isSglQuoteClosingAfterBackslash(text, pos + 2)) {
                quote = null;
              }
              pos += 2;
            } else {
              pos += 2;
            }
            continue;
          }
          if (quote === "'" && ch === "'" && pos + 1 < targetIdx && text[pos + 1] === "'") {
            pos += 2;
            continue;
          }
          if (ch === quote) quote = null;
          pos += 1;
          continue;
        }
        if (ch === "\\" && pos + 1 < targetIdx) {
          const next = text[pos + 1];
          if (next === "\r" || next === "\n") {
            pos += 1;
          } else {
            pos += 2;
          }
          continue;
        }
        if (ch === '"' || ch === "'") quote = ch;
        else if (ch === "{") brace += 1;
        else if (ch === "}" && brace > 0) brace -= 1;
        else if (ch === "[") bracket += 1;
        else if (ch === "]" && bracket > 0) bracket -= 1;
        else if (ch === "(") paren += 1;
        else if (ch === ")" && paren > 0) paren -= 1;
        pos += 1;
      }
      return { inBraceOrBracket: brace > 0 || bracket > 0, inParen: paren > 0, outerQuote: quote };
    },
  };
}

function isInsideFlowContext(text: string, valueStartIdx: number): FlowContextInfo {
  let lineStart = valueStartIdx - 1;
  while (lineStart >= 0 && text[lineStart] !== "\n" && text[lineStart] !== "\r") {
    lineStart -= 1;
  }
  lineStart += 1;
  let brace = 0;
  let bracket = 0;
  let paren = 0;
  let quote: '"' | "'" | null = null;
  for (let i = lineStart; i < valueStartIdx; i += 1) {
    const ch = text[i]!;
    if (quote) {
      if (quote === '"' && ch === "\\" && i + 1 < valueStartIdx) {
        i += 1;
        continue;
      }
      if (quote === "'" && ch === "'" && text[i + 1] === "'") {
        i += 1;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "\\" && i + 1 < valueStartIdx) {
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "{") brace += 1;
    else if (ch === "}" && brace > 0) brace -= 1;
    else if (ch === "[") bracket += 1;
    else if (ch === "]" && bracket > 0) bracket -= 1;
    else if (ch === "(") paren += 1;
    else if (ch === ")" && paren > 0) paren -= 1;
  }
  return { inBraceOrBracket: brace > 0 || bracket > 0, inParen: paren > 0, outerQuote: quote };
}

function isUnquotedValueTerminator(
  text: string,
  idx: number,
  options: {
    allowComma: boolean;
    allowQuoted: boolean;
    stopAtQuoteChar: '"' | "'" | "all" | "none";
    allowSemicolonWord: boolean;
    flowCtx: FlowContextInfo;
  },
): boolean {
  const ch = text[idx]!;
  if (
    ch === " " ||
    ch === "\t" ||
    ch === "\r" ||
    ch === "\n" ||
    ch === "&" ||
    ch === "|" ||
    ch === "<" ||
    ch === ">" ||
    ch === "(" ||
    ch === ")" ||
    (ch === "{" && options.flowCtx.inBraceOrBracket) ||
    (ch === "}" && options.flowCtx.inBraceOrBracket) ||
    (ch === "]" && options.flowCtx.inBraceOrBracket)
  ) {
    return true;
  }
  const code = ch.charCodeAt(0);
  if ((code >= 0x3000 && code <= 0x303f) || (code >= 0xff00 && code <= 0xffef)) {
    return true;
  }
  if (ch === ";") {
    if (!options.allowSemicolonWord) return true;
    const next = text[idx + 1];
    return next === undefined || next === " " || next === "\t" || next === "\r" || next === "\n";
  }
  if (ch === '"' || ch === "'") {
    if (!options.allowQuoted || options.stopAtQuoteChar === "all") return true;
    if (options.stopAtQuoteChar === ch) return true;
  }
  if (ch === ",") {
    if (!options.allowComma) return true;
    if (options.flowCtx.inBraceOrBracket) return true;
    if (
      options.flowCtx.inParen &&
      /^,[ \t]*(?:$|[\r\n)]|[A-Za-z_][A-Za-z0-9_.-]*[ \t]*[:=][ \t]*[^=,\s)\r\n])/.test(
        text.slice(idx, idx + 80),
      )
    ) {
      return true;
    }
  }
  return false;
}

function scanDiagnosticValue(
  text: string,
  startIdx: number,
  options: {
    allowComma: boolean;
    allowQuoted: boolean;
    allowShellConcat: boolean;
    allowSemicolonWord?: boolean;
    stopAtLeadingDash?: boolean;
    precomputedFlowCtx?: FlowContextInfo;
  },
): { end: number; openQuote: '"' | "'" | null } {
  if (startIdx >= text.length) return { end: startIdx, openQuote: null };
  const first = text[startIdx]!;
  if (options.stopAtLeadingDash && first === "-") return { end: startIdx, openQuote: null };
  const startsQuoted = first === '"' || first === "'";
  if (startsQuoted && !options.allowQuoted) return { end: startIdx, openQuote: null };

  const flowCtx = options.precomputedFlowCtx ?? isInsideFlowContext(text, startIdx);
  const stopAtQuoteChar: '"' | "'" | "all" | "none" = !options.allowQuoted
    ? "all"
    : flowCtx.outerQuote !== null
      ? flowCtx.outerQuote
      : !options.allowShellConcat
        ? "all"
        : "none";

  let k = startIdx;
  const openQuote: '"' | "'" | null = startsQuoted ? (first as '"' | "'") : null;

  if (startsQuoted) {
    const qRes = scanQuotedScalar(text, k, first as '"' | "'", true);
    k = qRes.end;
    if (!qRes.closed || !options.allowShellConcat) {
      return { end: k, openQuote };
    }
    if (flowCtx.inBraceOrBracket || flowCtx.outerQuote === first) {
      return { end: k, openQuote };
    }
  }

  while (k < text.length) {
    const ch = text[k]!;
    if (ch === '"' || ch === "'") {
      if (!options.allowShellConcat || stopAtQuoteChar === "all" || stopAtQuoteChar === ch) break;
      const qRes = scanQuotedScalar(text, k, ch, true);
      k = qRes.end;
      if (!qRes.closed) break;
      continue;
    }
    if (ch === "\\") {
      const afterNl = consumeNewline(text, k + 1);
      if (afterNl !== -1) {
        if (isDiagCol0At(text, afterNl)) {
          k += 1;
          break;
        }
        let wsEnd = afterNl;
        while (wsEnd < text.length && (text[wsEnd] === " " || text[wsEnd] === "\t")) wsEnd += 1;
        if (
          wsEnd >= text.length ||
          (wsEnd > afterNl && CONTINUATION_OPT_RE.test(text.slice(wsEnd, wsEnd + 32))) ||
          isUnquotedValueTerminator(text, wsEnd, {
            allowComma: options.allowComma,
            allowQuoted: options.allowQuoted,
            stopAtQuoteChar,
            allowSemicolonWord: Boolean(options.allowSemicolonWord),
            flowCtx,
          })
        ) {
          k += 1;
          break;
        }
        k = wsEnd;
        continue;
      }
      if (k + 1 < text.length && text[k + 1] !== "\r" && text[k + 1] !== "\n") {
        k += 2;
        continue;
      }
      k += 1;
      break;
    }
    if (
      isUnquotedValueTerminator(text, k, {
        allowComma: options.allowComma,
        allowQuoted: options.allowQuoted,
        stopAtQuoteChar,
        allowSemicolonWord: Boolean(options.allowSemicolonWord),
        flowCtx,
      })
    ) {
      break;
    }
    k += 1;
  }

  return { end: k, openQuote };
}

const EMPTY_FLOW_CTX: FlowContextInfo = { inBraceOrBracket: false, inParen: false, outerQuote: null };

function scanBalancedFlowCollectionEnd(src: string, openIdx: number): number {
  const openChar = src[openIdx] as "{" | "[" | "(";
  const closeChar = openChar === "{" ? "}" : openChar === "[" ? "]" : ")";
  let flowDepth = 0;
  let quote: '"' | "'" | null = null;
  let i = openIdx;
  while (i < src.length) {
    const ch = src[i]!;
    if (ch === "\r" || ch === "\n") {
      const nextLine = consumeNewline(src, i);
      if (isDiagCol0At(src, nextLine)) return i;
      i = nextLine;
      continue;
    }
    if (quote) {
      if (quote === '"' && ch === "\\" && i + 1 < src.length) {
        const afterNl = consumeNewline(src, i + 1);
        if (afterNl !== -1) {
          if (isDiagCol0At(src, afterNl)) return i + 1;
          i = afterNl;
          continue;
        }
        i += 2;
        continue;
      }
      if (quote === "'" && ch === "\\" && i + 1 < src.length) {
        const afterNl = consumeNewline(src, i + 1);
        if (afterNl !== -1) {
          if (isDiagCol0At(src, afterNl)) return i + 1;
          i = afterNl;
          continue;
        }
        if (src[i + 1] === "'") {
          if (isSglQuoteClosingAfterBackslash(src, i + 2)) {
            quote = null;
          }
          i += 2;
          continue;
        }
        i += 2;
        continue;
      }
      if (quote === "'" && ch === "'" && src[i + 1] === "'") {
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === openChar) flowDepth += 1;
    else if (ch === closeChar) {
      flowDepth -= 1;
      if (flowDepth === 0) return i + 1;
    }
    i += 1;
  }
  return src.length;
}

function redactKeyValueCredentials(text: string, keyMask: string): RedactCountResult {
  if (!text.includes(":") && !text.includes("=")) return { text, count: 0 };
  // Anchor strictly on `[:=]` (never leading `[ \t]*`) so long interior whitespace runs never backtrack quadratically.
  const sepCharRe = /[:=]/g;
  const hasCurlyBraces = text.includes("{");
  const hasFlowDelims =
    hasCurlyBraces || text.includes("[") || text.includes("(") || text.includes('"') || text.includes("'");
  const kvFlowScanner = hasFlowDelims ? createFlowContextScanner(text) : null;
  const kvEdits: Array<{ start: number; end: number; replacement: string }> = [];
  let count = 0;
  let authsLineActive = false;
  let authsBraceDepth: number | null = null;
  let kvBraceDepth = 0;
  let kvQuote: '"' | "'" | null = null;
  let kvScanPos = 0;
  let lastHandledEnd = 0;
  const canStartKvQuote = (quoteIdx: number): boolean => {
    if (kvBraceDepth <= 0) return false;
    let q = quoteIdx - 1;
    while (q >= 0 && (text[q] === " " || text[q] === "\t")) q -= 1;
    if (q < 0) return false;
    const prev = text[q]!;
    return prev === "{" || prev === "[" || prev === "," || prev === ":" || prev === "\n" || prev === "\r";
  };
  const isKeyIdentChar = (c: string): boolean =>
    (c >= "a" && c <= "z") ||
    (c >= "A" && c <= "Z") ||
    (c >= "0" && c <= "9") ||
    c === "_" ||
    c === "." ||
    c === "-";
  const isKeyStartChar = (c: string): boolean =>
    (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || (c >= "0" && c <= "9") || c === "_";

  let sm = sepCharRe.exec(text);
  while (sm !== null) {
    const sepCharIdx = sm.index;
    const isColon = text[sepCharIdx] === ":";
    let sepIdx = sepCharIdx;
    const wsBeforeLimit = Math.max(lastHandledEnd, sepCharIdx - 512);
    while (sepIdx > wsBeforeLimit && (text[sepIdx - 1] === " " || text[sepIdx - 1] === "\t")) {
      sepIdx -= 1;
    }
    let valStartPos = sepCharIdx + 1;
    while (valStartPos < text.length && (text[valStartPos] === " " || text[valStartPos] === "\t")) {
      valStartPos += 1;
    }
    const sep = text.slice(sepIdx, valStartPos);
    sepCharRe.lastIndex = Math.max(sepCharRe.lastIndex, valStartPos);

    let start = -1;
    let keyQuote = "";
    let key = "";

    if (sepIdx > lastHandledEnd && isColon && (text[sepIdx - 1] === '"' || text[sepIdx - 1] === "'")) {
      const qChar = text[sepIdx - 1]!;
      let qOpen = sepIdx - 2;
      const limit = Math.max(lastHandledEnd, sepIdx - 130);
      while (qOpen >= limit) {
        if (text[qOpen] === qChar) {
          let bs = 0;
          let b = qOpen - 1;
          while (b >= 0 && text[b] === "\\") {
            bs += 1;
            b -= 1;
          }
          if (bs % 2 === 0) break;
        }
        qOpen -= 1;
      }
      if (qOpen >= limit && text[qOpen] === qChar) {
        const cand = text.slice(qOpen + 1, sepIdx - 1);
        if (/^[A-Za-z0-9_][A-Za-z0-9_.-]*(?: [A-Za-z0-9_.-]+)*$/.test(cand)) {
          start = qOpen;
          keyQuote = qChar;
          key = cand;
        }
      }
    }
    if (start === -1 && sepIdx > lastHandledEnd) {
      let kStart = sepIdx;
      const limit = Math.max(lastHandledEnd, sepIdx - 130);
      while (kStart > limit && isKeyIdentChar(text[kStart - 1]!)) {
        kStart -= 1;
      }
      let skippedEscPrefix = false;
      if (
        kStart + 1 < sepIdx &&
        (text[kStart] === "r" || text[kStart] === "n" || text[kStart] === "t") &&
        kStart > 0 &&
        text[kStart - 1] === "\\"
      ) {
        let bs = 0;
        let b = kStart - 1;
        while (b >= 0 && text[b] === "\\") {
          bs += 1;
          b -= 1;
        }
        if (bs % 2 === 1) {
          kStart += 1;
          skippedEscPrefix = true;
        }
      }
      if (kStart < sepIdx && isKeyStartChar(text[kStart]!)) {
        const prevCh = kStart > 0 ? text[kStart - 1]! : "";
        if (kStart === 0 || !isKeyIdentChar(prevCh) || prevCh === "." || skippedEscPrefix) {
          start = kStart;
          key = text.slice(kStart, sepIdx);
          // Support two-word space-separated credential labels (`api key: SECRET`, `access key: SECRET`).
          if (
            !isCredentialKey(key) &&
            !AUTHS_CONTAINER_KEY_RE.test(key.trim()) &&
            !AUTHS_CREDENTIAL_KEY_RE.test(key.trim()) &&
            kStart >= lastHandledEnd + 2 &&
            text[kStart - 1] === " "
          ) {
            let pStart = kStart - 1;
            const pLimit = Math.max(lastHandledEnd, pStart - 48);
            while (pStart > pLimit && isKeyIdentChar(text[pStart - 1]!)) {
              pStart -= 1;
            }
            if (
              pStart < kStart - 1 &&
              isKeyStartChar(text[pStart]!) &&
              (pStart === 0 || !isKeyIdentChar(text[pStart - 1]!))
            ) {
              const twoWord = `${text.slice(pStart, kStart - 1)} ${key}`;
              if (isCredentialKey(twoWord)) {
                start = pStart;
                key = twoWord;
              }
            }
          }
        }
      }
    }
    if (start === -1) {
      sm = sepCharRe.exec(text);
      continue;
    }

    const trimKey = key.trim();
    const isAuthsContainer = AUTHS_CONTAINER_KEY_RE.test(trimKey);
    const maybeAuthsCred = hasCurlyBraces && AUTHS_CREDENTIAL_KEY_RE.test(trimKey);
    const isDirectCred = isCredentialKey(key);
    if (!isDirectCred && !isAuthsContainer && !maybeAuthsCred) {
      sm = sepCharRe.exec(text);
      continue;
    }

    if (hasCurlyBraces) {
      while (kvScanPos < start) {
        const c = text[kvScanPos]!;
        if (c === "\n" || c === "\r") {
          authsLineActive = false;
          kvQuote = null;
          const afterNl = c === "\r" && text[kvScanPos + 1] === "\n" ? kvScanPos + 2 : kvScanPos + 1;
          if (afterNl < text.length && isDiagCol0At(text, afterNl)) {
            kvBraceDepth = 0;
            authsBraceDepth = null;
          }
        } else if (kvQuote) {
          if (kvQuote === '"' && c === "\\" && kvScanPos + 1 < start) {
            kvScanPos += 2;
            continue;
          }
          if (kvQuote === "'" && c === "'" && kvScanPos + 1 < start && text[kvScanPos + 1] === "'") {
            kvScanPos += 2;
            continue;
          }
          if (c === kvQuote) kvQuote = null;
        } else if ((c === '"' || c === "'") && canStartKvQuote(kvScanPos)) {
          kvQuote = c;
        } else if (c === "{") {
          kvBraceDepth += 1;
        } else if (c === "}" && kvBraceDepth > 0) {
          kvBraceDepth -= 1;
          if (authsBraceDepth !== null && kvBraceDepth < authsBraceDepth) {
            authsBraceDepth = null;
            authsLineActive = false;
          }
        }
        kvScanPos += 1;
      }
    }

    const valStart = valStartPos;
    if (isAuthsContainer) {
      authsLineActive = true;
      if (text[valStart] === "{" && authsBraceDepth === null) {
        authsBraceDepth = kvBraceDepth + 1;
      }
    }
    const valFlowCtx = kvFlowScanner ? kvFlowScanner.at(valStart) : EMPTY_FLOW_CTX;
    const inMultilineAuths = authsBraceDepth !== null && kvBraceDepth > authsBraceDepth;
    const isScopedAuthsCred =
      maybeAuthsCred && (inMultilineAuths || (valFlowCtx.inBraceOrBracket && authsLineActive));
    if (!isDirectCred && !isScopedAuthsCred) {
      sm = sepCharRe.exec(text);
      continue;
    }

    const isAuthHeaderKey = /^(?:proxy-)?authorization$/i.test(key);
    if (isAuthHeaderKey && findAlreadyRedactedAuthPrefixEnd(text, valStart, true) !== -1) {
      sm = sepCharRe.exec(text);
      continue;
    }
    const valRedactedRe =
      isColon || valFlowCtx.inBraceOrBracket || valFlowCtx.inParen
        ? ALREADY_REDACTED_VAL_PREFIX_RE
        : ALREADY_REDACTED_SHELL_VAL_PREFIX_RE;
    if (valRedactedRe.test(text.slice(valStart, valStart + 64))) {
      sm = sepCharRe.exec(text);
      continue;
    }

    const advanceAfter = (endPos: number) => {
      lastHandledEnd = Math.max(lastHandledEnd, endPos);
      sepCharRe.lastIndex = Math.max(sepCharRe.lastIndex, endPos);
    };

    if (isColon) {
      const ch = text[valStart];
      if (
        ch === undefined ||
        ch === "\r" ||
        ch === "\n" ||
        ch === "#" ||
        ch === "&" ||
        ch === "*" ||
        ch === "|" ||
        ch === ">" ||
        ch === "!"
      ) {
        sm = sepCharRe.exec(text);
        continue;
      }
      if (ch === '"' || ch === "'") {
        const qRes = scanQuotedScalar(text, valStart, ch, true);
        const inner = text.slice(valStart + 1, qRes.closed ? qRes.end - 1 : qRes.end);
        if (
          inner !== "" &&
          !ALREADY_REDACTED_RE.test(inner) &&
          !(isAuthHeaderKey && ALREADY_REDACTED_AUTH_RE.test(inner.trim()))
        ) {
          kvEdits.push({
            start,
            end: qRes.end,
            replacement: `${keyQuote}${key}${keyQuote}${sep}${ch}${keyMask}${ch}`,
          });
          count += 1;
        }
        advanceAfter(qRes.end);
        sm = sepCharRe.exec(text);
        continue;
      }
      if (ch === "[" && ALREADY_REDACTED_VAL_PREFIX_RE.test(text.slice(valStart, valStart + 64))) {
        sm = sepCharRe.exec(text);
        continue;
      }
      if (
        (ch === "{" || ch === "[" || (ch === "(" && (valFlowCtx.inBraceOrBracket || valFlowCtx.inParen))) &&
        !/^\[REDACTED(?:_[A-Z]+)?\]/i.test(text.slice(valStart, valStart + 32))
      ) {
        const flowEnd = scanBalancedFlowCollectionEnd(text, valStart);
        const flowSlice = text.slice(valStart, flowEnd).trim();
        const skipWeak = isDirectCred && !isScopedAuthsCred && isNonSecretLiteralText(key, flowSlice);
        if (!skipWeak && !/^(?:\{\s*\}|\[\s*\]|\(\s*\))$/.test(flowSlice) && flowSlice.length > 0) {
          kvEdits.push({
            start,
            end: flowEnd,
            replacement: `${keyQuote}${key}${keyQuote}${sep}${keyMask}`,
          });
          count += 1;
          advanceAfter(flowEnd);
        }
        sm = sepCharRe.exec(text);
        continue;
      }
      const valRes = scanDiagnosticValue(text, valStart, {
        allowComma: false,
        allowQuoted: false,
        allowShellConcat: false,
        allowSemicolonWord: true,
        precomputedFlowCtx: valFlowCtx,
      });
      if (valRes.end > valStart) {
        const valText = text.slice(valStart, valRes.end);
        const isNullSentinel = /^(?:null|~)$/i.test(valText);
        const skipWeak = isDirectCred && !isScopedAuthsCred && isNonSecretLiteralText(key, valText);
        if (!isNullSentinel && !skipWeak && !ALREADY_REDACTED_RE.test(valText)) {
          kvEdits.push({
            start,
            end: valRes.end,
            replacement: `${keyQuote}${key}${keyQuote}${sep}${keyMask}`,
          });
          count += 1;
        }
        advanceAfter(valRes.end);
      }
      sm = sepCharRe.exec(text);
      continue;
    }

    const eqCh = text[valStart];
    if (
      (eqCh === "{" || eqCh === "[" || eqCh === "(") &&
      !/^\[REDACTED(?:_[A-Z]+)?\]/i.test(text.slice(valStart, valStart + 32))
    ) {
      const flowEnd = scanBalancedFlowCollectionEnd(text, valStart);
      const flowSlice = text.slice(valStart, flowEnd).trim();
      const skipWeak = isDirectCred && !isScopedAuthsCred && isNonSecretLiteralText(key, flowSlice);
      if (!skipWeak && !/^(?:\{\s*\}|\[\s*\]|\(\s*\))$/.test(flowSlice) && flowSlice.length > 0) {
        kvEdits.push({
          start,
          end: flowEnd,
          replacement: `${key}${sep}${keyMask}`,
        });
        count += 1;
        advanceAfter(flowEnd);
      }
      sm = sepCharRe.exec(text);
      continue;
    }

    const valRes = scanDiagnosticValue(text, valStart, {
      allowComma: true,
      allowQuoted: true,
      allowShellConcat: true,
      precomputedFlowCtx: valFlowCtx,
    });
    if (valRes.end > valStart) {
      const valText = text.slice(valStart, valRes.end);
      const innerEmpty = valText === '""' || valText === "''";
      const skipWeak =
        valRes.openQuote === null &&
        isDirectCred &&
        !isScopedAuthsCred &&
        isNonSecretLiteralText(key, valText);
      if (!innerEmpty && !skipWeak && !ALREADY_REDACTED_RE.test(valText)) {
        const rendered =
          valRes.openQuote === '"' ? `"${keyMask}"` : valRes.openQuote === "'" ? `'${keyMask}'` : keyMask;
        kvEdits.push({
          start,
          end: valRes.end,
          replacement: `${key}${sep}${rendered}`,
        });
        count += 1;
      }
      advanceAfter(valRes.end);
    }
    sm = sepCharRe.exec(text);
  }
  return { text: replaceMatchedSpans(text, kvEdits), count };
}

/**
 * Single source of truth for diagnostic credential, HTTP Authorization/Cookie header,
 * CLI secret flag, YAML/JSON AST, escaped shell JSON, shell assignment (multiline/partial/comma),
 * and IPv4/IPv6 redaction.
 */
export function redactDiagnosticCredentials(
  raw: string,
  masks: DiagnosticRedactionMasks,
  depth = 0,
): RedactCountResult {
  let count = 0;
  let text = stripTerminalControlSequences(raw).replace(INVISIBLE_CHAR_RE, "");
  if (depth === 0) {
    text = text.replace(/\r\n?/g, "\n");
  }

  const replaceCounted = (pattern: RegExp, replacer: string | ((...args: string[]) => string)) => {
    text = text.replace(pattern, (...args) => {
      count += 1;
      return typeof replacer === "function" ? replacer(...(args as string[])) : replacer;
    });
  };

  // 1. PEM private key blocks (raw multiline, escaped JSON `\n`/`\\n` multiline, nested BEGIN/END, armor headers, partial pastes)
  const pemBeginRe = /-----BEGIN [A-Z0-9 _-]*PRIVATE KEY(?: BLOCK)?-----/gi;
  const pemEndLineRe = /^[ \t]*(-----END [A-Z0-9 _-]*PRIVATE KEY(?: BLOCK)?-----)/i;
  const pemBeginLineRe = /^[ \t]*-----BEGIN [A-Z0-9 _-]*PRIVATE KEY(?: BLOCK)?-----/i;
  const pemArmorHeaderRe =
    /^[ \t]*(?:Proc-Type|DEK-Info|Comment|Version|Hash|Charset|MessageID|Originator-ID|Key-Info):[^\r\n]*$/i;
  const trimHorizontalWs = (ln: string): string => {
    let s = 0;
    let e = ln.length;
    while (s < e && (ln[s] === " " || ln[s] === "\t")) s += 1;
    while (e > s && (ln[e - 1] === " " || ln[e - 1] === "\t")) e -= 1;
    return ln.slice(s, e);
  };
  const isValidPemBodyLine = (ln: string): boolean => {
    if (pemArmorHeaderRe.test(ln)) return true;
    const t = trimHorizontalWs(ln);
    if (!t || t.startsWith("--")) return false;
    return /^[A-Za-z0-9+/_-]+={0,2}$/.test(t) && /[A-Za-z0-9+/]/.test(t);
  };
  const consumeEscapedPemNewline = (src: string, idx: number): number => {
    if (idx >= src.length || src[idx] !== "\\") return -1;
    if (src[idx + 1] === "\\") {
      if (src.startsWith("r\\\\n", idx + 2)) return idx + 6;
      if (src[idx + 2] === "n" || src[idx + 2] === "r") return idx + 3;
      return -1;
    }
    if (src.startsWith("r\\n", idx + 1)) return idx + 4;
    if (src[idx + 1] === "n" || src[idx + 1] === "r") return idx + 2;
    return -1;
  };
  const pemEdits: Array<{ start: number; end: number; replacement: string }> = [];
  let pm = pemBeginRe.exec(text);
  while (pm !== null) {
    const start = pm.index;
    let cursor = start + pm[0].length;
    while (cursor < text.length && (text[cursor] === " " || text[cursor] === "\t")) cursor += 1;
    const isEscapedInline =
      consumeNewline(text, cursor) === -1 && consumeEscapedPemNewline(text, cursor) !== -1;
    let closedEnd: number | null = null;
    let lastValidEnd = cursor;
    let allPemValidSoFar = true;
    let nesting = 1;

    if (isEscapedInline) {
      while (cursor < text.length) {
        const nextLineStart = consumeEscapedPemNewline(text, cursor);
        if (nextLineStart === -1) break;
        let lineEnd = nextLineStart;
        while (lineEnd < text.length) {
          const ch = text[lineEnd]!;
          if (ch === "\r" || ch === "\n" || ch === '"' || ch === "}") break;
          if (ch === "\\" && text[lineEnd + 1] === '"') break;
          if (consumeEscapedPemNewline(text, lineEnd) !== -1) break;
          lineEnd += 1;
        }
        const line = text.slice(nextLineStart, lineEnd);
        const endMatch = pemEndLineRe.exec(line);
        if (endMatch) {
          const endPos = nextLineStart + endMatch[0].length;
          nesting -= 1;
          if (allPemValidSoFar) lastValidEnd = endPos;
          if (nesting <= 0) {
            closedEnd = endPos;
            break;
          }
          let afterEnd = endPos;
          while (afterEnd < lineEnd && (text[afterEnd] === " " || text[afterEnd] === "\t")) {
            afterEnd += 1;
          }
          cursor = afterEnd;
          continue;
        }
        if (DIAG_COL0_LINE_RE.test(line)) break;
        if (pemBeginLineRe.test(line)) {
          if (!allPemValidSoFar) break;
          nesting += 1;
          lastValidEnd = lineEnd;
          cursor = lineEnd;
          continue;
        }
        if (allPemValidSoFar) {
          if (line.trim() === "") {
            // Wait for valid PEM continuation
          } else if (isValidPemBodyLine(line)) {
            lastValidEnd = lineEnd;
          } else {
            allPemValidSoFar = false;
          }
        }
        cursor = lineEnd;
      }
    } else {
      // Allow harmless trailing whitespace/comment on BEGIN line ONLY when followed by a raw newline on same line (never eat JSON sibling fields)
      let probeBeginEnd = cursor;
      while (
        probeBeginEnd < text.length &&
        text[probeBeginEnd] !== "\r" &&
        text[probeBeginEnd] !== "\n" &&
        text[probeBeginEnd] !== '"' &&
        text[probeBeginEnd] !== "}" &&
        !(text[probeBeginEnd] === "\\" && text[probeBeginEnd + 1] === '"')
      ) {
        probeBeginEnd += 1;
      }
      if (consumeNewline(text, probeBeginEnd) !== -1 || probeBeginEnd === text.length) {
        cursor = probeBeginEnd;
        lastValidEnd = cursor;
      }
      while (cursor < text.length) {
        const nextLineStart = consumeNewline(text, cursor);
        if (nextLineStart === -1) break;
        let lineEnd = nextLineStart;
        while (lineEnd < text.length && text[lineEnd] !== "\r" && text[lineEnd] !== "\n") {
          lineEnd += 1;
        }
        const line = text.slice(nextLineStart, lineEnd);
        const endMatch = pemEndLineRe.exec(line);
        if (endMatch) {
          const endPos = nextLineStart + endMatch[0].length;
          nesting -= 1;
          if (allPemValidSoFar) lastValidEnd = endPos;
          if (nesting <= 0) {
            closedEnd = endPos;
            break;
          }
          cursor = lineEnd;
          continue;
        }
        if (DIAG_COL0_LINE_RE.test(line)) {
          break;
        }
        if (pemBeginLineRe.test(line)) {
          if (!allPemValidSoFar) break;
          nesting += 1;
          lastValidEnd = lineEnd;
          cursor = lineEnd;
          continue;
        }
        if (allPemValidSoFar) {
          if (line.trim() === "") {
            // Blank line after Armor header / body only extends PEM if valid PEM content follows
          } else if (isValidPemBodyLine(line)) {
            lastValidEnd = lineEnd;
          } else {
            allPemValidSoFar = false;
          }
        }
        cursor = lineEnd;
      }
    }
    const end = closedEnd ?? lastValidEnd;
    pemEdits.push({ start, end, replacement: masks.privateKeyMask });
    count += 1;
    pemBeginRe.lastIndex = Math.max(pemBeginRe.lastIndex, end);
    pm = pemBeginRe.exec(text);
  }
  text = replaceMatchedSpans(text, pemEdits);

  // 2. URI userinfo credentials (WHATWG authority split at LAST `@`, scheme-relative `//u:p@registry/v2`, Unicode/percent-IDN hosts, RFC3986 `'` in userinfo)
  const uriHostRe =
    /^(\[[0-9a-fA-F:.]+(?:%[A-Za-z0-9_.-]+)?\]|(?:[\p{L}\p{M}\p{N}_]|%[0-9a-fA-F]{2})(?:[\p{L}\p{M}\p{N}_-]|%[0-9a-fA-F]{2}|(?:\.(?=[\p{L}\p{M}\p{N}_%])))*)(?::\d{1,5})?/u;
  const uriTrailPunctRe = /^[,;.)\]}\u3000-\u303f\uff00-\uffef]/;
  const redactUriAuth = (
    full: string,
    schemeOrPrefix: string,
    authority: string,
    offset: number,
    whole: string,
    requireNetPath: boolean,
  ): string => {
    let effAuthority = authority;
    if (offset > 0 && whole[offset - 1] === "'") {
      for (let i = 0; i < authority.length; i += 1) {
        if (authority[i] === "'") {
          if (authority[i + 1] === "'") {
            i += 1;
            continue;
          }
          effAuthority = authority.slice(0, i);
          break;
        }
      }
    }
    const sqSuffix = authority.slice(effAuthority.length);
    const lastAt = effAuthority.lastIndexOf("@");
    if (lastAt <= 0) return full;
    const userinfo = effAuthority.slice(0, lastAt);
    const hostTail = effAuthority.slice(lastAt + 1);
    if (/^\[REDACTED(?:_[A-Z]+)?\]$/i.test(userinfo)) return full;
    const hostM = uriHostRe.exec(hostTail);
    if (!hostM) return full;
    const tailRest = hostTail.slice(hostM[0].length);
    if (tailRest !== "" && !uriTrailPunctRe.test(tailRest)) return full;
    if (requireNetPath) {
      const hostCore = hostM[1]!;
      const looksLikeNetPath =
        userinfo.includes(":") ||
        hostCore.startsWith("[") ||
        hostCore.toLowerCase() === "localhost" ||
        hostCore.includes(".") ||
        /:\d{1,5}$/.test(hostM[0]) ||
        whole[offset + full.length] === "/";
      if (!looksLikeNetPath) return full;
    }
    count += 1;
    return `${schemeOrPrefix}${masks.authMask}@${hostTail}${sqSuffix}`;
  };
  text = text.replace(
    /(?<![A-Za-z0-9+.-])([a-z][a-z0-9+.-]*:\/\/)([^/?#\s"<>]+)/gi,
    (full, scheme: string, authority: string, offset: number, whole: string) =>
      redactUriAuth(full, scheme, authority, offset, whole, false),
  );
  text = text.replace(
    /(?<![A-Za-z0-9+.:/\\-])(\/\/)([^/?#\s"<>]+)/g,
    (full, prefix: string, authority: string, offset: number, whole: string) =>
      redactUriAuth(full, prefix, authority, offset, whole, true),
  );

  // 2.5. URL query-string credential parameters (anchored on `?` for strict O(N) performance + percent-encoded paths/keys + IPv6 `[...]` + legal `,` & `(...)` paths across absolute, root-relative, and path-relative URLs)
  if (text.includes("?")) {
    const queryAnchorRe = /\?([^\s"'<>#]+)/g;
    const queryEdits: Array<{ start: number; end: number; replacement: string }> = [];
    let qm = queryAnchorRe.exec(text);
    while (qm !== null) {
      const qIdx = qm.index;
      const rawQuery = qm[1]!;
      let p = qIdx - 1;
      const minP = Math.max(0, qIdx - 4096);
      let bracketDepth = 0;
      let parenDepth = 0;
      while (p >= minP) {
        const c = text[p]!;
        if (c === "]") {
          bracketDepth += 1;
          p -= 1;
          continue;
        }
        if (c === "[") {
          if (bracketDepth > 0) {
            bracketDepth -= 1;
            p -= 1;
            continue;
          }
          break;
        }
        if (c === ")") {
          parenDepth += 1;
          p -= 1;
          continue;
        }
        if (c === "(") {
          if (parenDepth > 0) {
            parenDepth -= 1;
            p -= 1;
            continue;
          }
          break;
        }
        if (c === "," || c === ";") {
          const segStart = Math.max(minP, p - 512);
          const beforeDelim = text.slice(segStart, p);
          const delimMatch = /(?:^|[\s"'<>;,|`=])([^\s"'<>;,|`=]*)$/.exec(beforeDelim);
          const delimChar =
            delimMatch && delimMatch[0].length > delimMatch[1]!.length ? delimMatch[0][0] : "";
          const tokenBeforeDelim = delimMatch ? delimMatch[1]! : beforeDelim;
          if (
            p < qIdx - 1 &&
            delimChar === "=" &&
            !tokenBeforeDelim.includes("/") &&
            !tokenBeforeDelim.includes("://")
          ) {
            break;
          }
          p -= 1;
          continue;
        }
        if (
          c === " " ||
          c === "\t" ||
          c === "\r" ||
          c === "\n" ||
          c === '"' ||
          c === "'" ||
          c === "<" ||
          c === ">" ||
          c === "{" ||
          c === "|" ||
          c === "`"
        ) {
          break;
        }
        p -= 1;
      }
      let urlPrefix = text.slice(p + 1, qIdx);
      const schemeInside = /[a-z][a-z0-9+.-]*:\/\//i.exec(urlPrefix);
      if (schemeInside && schemeInside.index > 0) {
        const beforeScheme = urlPrefix[schemeInside.index - 1]!;
        if (beforeScheme === "=" || beforeScheme === ":") {
          urlPrefix = urlPrefix.slice(schemeInside.index);
        }
      } else {
        const eqIdx = urlPrefix.indexOf("=");
        if (eqIdx > 0 && !/[\s"'<>?#]/.test(urlPrefix.slice(0, eqIdx))) {
          urlPrefix = urlPrefix.slice(eqIdx + 1);
        }
      }
      const isUrlPrefix =
        urlPrefix.length > 0 &&
        (/^[a-z][a-z0-9+.-]*:\/\/[^\s"'<>?#]*$/i.test(urlPrefix) ||
          /^\/[^\s"'<>?#]*$/.test(urlPrefix) ||
          /^(?:[A-Za-z0-9_.~:@+(),!$&*;-]|%[0-9A-Fa-f]{2}|\/)+$/.test(urlPrefix));
      if (isUrlPrefix) {
        let queryBody = rawQuery;
        let trailingOuter = "";
        while (queryBody.endsWith(",") || queryBody.endsWith(";")) {
          trailingOuter = queryBody.slice(-1) + trailingOuter;
          queryBody = queryBody.slice(0, -1);
        }
        if (queryBody.endsWith(")")) {
          let openP = 0;
          let closeP = 0;
          for (let i = 0; i < queryBody.length; i += 1) {
            if (queryBody[i] === "(") openP += 1;
            else if (queryBody[i] === ")") closeP += 1;
          }
          if (closeP > openP) {
            trailingOuter = `)${trailingOuter}`;
            queryBody = queryBody.slice(0, -1);
          }
        }
        if (queryBody.endsWith("]")) {
          let openB = 0;
          let closeB = 0;
          for (let i = 0; i < queryBody.length; i += 1) {
            if (queryBody[i] === "[") openB += 1;
            else if (queryBody[i] === "]") closeB += 1;
          }
          if (closeB > openB) {
            trailingOuter = `]${trailingOuter}`;
            queryBody = queryBody.slice(0, -1);
          }
        }
        if (queryBody.includes("=")) {
          let changed = false;
          const newParts = queryBody.split("&").map((seg) => {
            const eqIdx = seg.indexOf("=");
            if (eqIdx <= 0) return seg;
            const rawKey = seg.slice(0, eqIdx);
            const rawVal = seg.slice(eqIdx + 1);
            if (!rawVal || ALREADY_REDACTED_RE.test(rawVal)) return seg;
            let decodedKey = rawKey;
            try {
              decodedKey = decodeURIComponent(rawKey.replace(/\+/g, " "));
            } catch {
              decodedKey = rawKey;
            }
            if (!isCredentialKey(decodedKey)) return seg;
            if (isWeakCredentialKey(decodedKey) && isNonSecretLiteralText(decodedKey, rawVal)) return seg;
            count += 1;
            changed = true;
            return `${rawKey}=${masks.keyMask}`;
          });
          if (changed) {
            queryEdits.push({
              start: qIdx + 1,
              end: qIdx + 1 + rawQuery.length,
              replacement: `${newParts.join("&")}${trailingOuter}`,
            });
          }
        }
      }
      qm = queryAnchorRe.exec(text);
    }
    text = replaceMatchedSpans(text, queryEdits);
  }

  // 3. CLI credential flags (long flags, curl `-u`/`-U`/`-b`, command-aware `-p` for docker/mysql/sshpass, obsutil `-i`/`-k`)
  const cliFlagRe =
    /(?<![A-Za-z0-9_-])(--[A-Za-z][A-Za-z0-9_-]*(?![A-Za-z0-9_-])|-(?:[sSfkLiIvNg46ORZnGaq]*b[uU]|[sSfkLiIvNg46ORZnGaq]*[uUb]|p|[ik]))/g;
  const cliFlowScanner = createFlowContextScanner(text);
  const cliEqRe = /[ \t]*=[ \t]*/y;
  const cliSepRe = new RegExp(
    `(?:[ \\t]+(?:\\\\${NL_SRC}${DIAG_COL0_CONTINUATION_LOOKAHEAD_SRC}[ \\t]*)*|\\\\${NL_SRC}${DIAG_COL0_CONTINUATION_LOOKAHEAD_SRC}[ \\t]*)`,
    "y",
  );
  const scanStmtQuoteEnd = (openPos: number, qChar: '"' | "'"): number => {
    let p = openPos + 1;
    while (p < text.length) {
      const c = text[p]!;
      if (c === "\n" || c === "\r") {
        if (qChar === '"' && p > 0 && text[p - 1] === "\\") {
          p += 1;
          continue;
        }
        return text.length;
      }
      if (qChar === '"' && c === "\\" && p + 1 < text.length) {
        p += 2;
        continue;
      }
      if (qChar === "'" && c === "'" && text[p + 1] === "'") {
        p += 2;
        continue;
      }
      if (qChar === "'" && c === "\\" && p + 1 < text.length && text[p + 1] === "'") {
        if (!isSglQuoteClosingAfterBackslash(text, p + 2)) {
          p += 2;
          continue;
        }
      }
      if (c === qChar) return p + 1;
      p += 1;
    }
    return text.length;
  };

  let stmtState = createArgvSecretState();
  let stmtEnd = -1;
  let stmtCursor = 0;
  const getCliProfileAt = (flagIdx: number): CliCmdProfile => {
    if (flagIdx >= stmtEnd) {
      let s = flagIdx - 1;
      const minBound = Math.max(0, stmtEnd);
      while (s >= minBound) {
        const ch = text[s]!;
        if (ch === "\n" || ch === "\r") {
          if (s > 0 && text[s - 1] === "\\") {
            s -= 2;
            continue;
          }
          if (ch === "\n" && s >= 2 && text[s - 1] === "\r" && text[s - 2] === "\\") {
            s -= 3;
            continue;
          }
          break;
        }
        if (ch === ";" || ch === "|" || ch === "&" || ch === "(" || ch === "{" || ch === "[" || ch === "`") {
          if (s > 0 && text[s - 1] === "\\") {
            s -= 2;
            continue;
          }
          break;
        }
        s -= 1;
      }
      const stmtStart = s + 1;
      let e = flagIdx;
      while (e < text.length) {
        const ch = text[e]!;
        if (ch === "\n" || ch === "\r" || ch === ";" || ch === "|" || ch === "&" || ch === "`") {
          if (e > 0 && text[e - 1] === "\\") {
            e += 2;
            continue;
          }
          break;
        }
        e += 1;
      }
      stmtEnd = e;
      stmtCursor = stmtStart;
      stmtState = createArgvSecretState();
    }
    while (stmtCursor < flagIdx) {
      const ch = text[stmtCursor]!;
      if (ch === "\\" || /\s/.test(ch)) {
        stmtCursor += 1;
        continue;
      }
      if (ch === '"' || ch === "'") {
        const qEnd = scanStmtQuoteEnd(stmtCursor, ch);
        if (qEnd > flagIdx) {
          // Only reset if the quote wraps a nested command/phrase (whitespace/separator before flagIdx
          // or multi-token body), NEVER for a single quoted switch token like `"--password"` or `'-p'`.
          const beforeInQuote = text.slice(stmtCursor + 1, flagIdx);
          const bodyInQuote = text.slice(stmtCursor + 1, Math.min(qEnd - 1, text.length));
          if (
            /[\s;|&()`]/.test(beforeInQuote) ||
            (/[\s;|&()]/.test(bodyInQuote) && !/^-/.test(bodyInQuote))
          ) {
            stmtState = createArgvSecretState();
            stmtCursor += 1;
            continue;
          }
          break;
        }
        const tok = text.slice(stmtCursor, qEnd);
        stmtCursor = qEnd;
        advanceArgvCmdState(stmtState, tok);
        continue;
      }
      const wordStart = stmtCursor;
      while (stmtCursor < flagIdx && !/[\s\\"']/.test(text[stmtCursor]!)) {
        stmtCursor += 1;
      }
      if (stmtCursor < flagIdx && (text[stmtCursor] === '"' || text[stmtCursor] === "'")) {
        const qChar = text[stmtCursor] as '"' | "'";
        const qEnd = scanStmtQuoteEnd(stmtCursor, qChar);
        if (qEnd <= flagIdx) {
          stmtCursor = qEnd;
          advanceArgvCmdState(stmtState, text.slice(wordStart, stmtCursor));
          continue;
        }
        // Env assignment prefix before an open quoted command (`CMD="docker login -p X"`).
        if (text.slice(wordStart, stmtCursor).includes("=")) {
          stmtState = createArgvSecretState();
          stmtCursor += 1;
          continue;
        }
      }
      if (stmtCursor > wordStart) {
        const word = text.slice(wordStart, stmtCursor);
        if (word.endsWith(":") && word.length > 1) {
          stmtState = createArgvSecretState();
        } else {
          advanceArgvCmdState(stmtState, word);
        }
      }
    }
    return stmtState.profile;
  };

  const cliEdits: Array<{ start: number; end: number; replacement: string }> = [];
  let cm = cliFlagRe.exec(text);
  while (cm !== null) {
    const flag = cm[1]!;
    const flagEnd = cm.index + flag.length;
    const isShortCurlFlag = !flag.startsWith("--") && SHORT_CURL_FLAG_RE.test(flag);
    const isShortPwdFlag = flag === "-p";
    const isShortObsFlag = flag === "-i" || flag === "-k";
    const isLongUserFlag = /^--(?:proxy-)?user(?:name)?$/i.test(flag);
    if (!isShortCurlFlag && !isShortPwdFlag && !isShortObsFlag && !isLongUserFlag && !isCredentialKey(flag)) {
      cm = cliFlagRe.exec(text);
      continue;
    }
    const profile = getCliProfileAt(cm.index);
    if (isShortPwdFlag && profile !== "container-login" && profile !== "mysql" && profile !== "sshpass") {
      cm = cliFlagRe.exec(text);
      continue;
    }
    if (isShortObsFlag && profile !== "obsutil") {
      cm = cliFlagRe.exec(text);
      continue;
    }
    const isCurl = profile === "curl";
    const shortFlagKind = flag.endsWith("b") ? "b" : "u";
    const isCommandShortSecret =
      (isShortPwdFlag && (profile === "container-login" || profile === "mysql" || profile === "sshpass")) ||
      (isShortObsFlag && profile === "obsutil");

    const beforeCh = cm.index > 0 ? text[cm.index - 1] : "";
    const isSimpleWrapQuote =
      (beforeCh === '"' || beforeCh === "'") &&
      text[flagEnd] === beforeCh &&
      (cm.index === 1 || /[\s;|&({[,=`\\]/.test(text[cm.index - 2]!));
    const isEscapedWrapQuote =
      !isSimpleWrapQuote &&
      (beforeCh === '"' || beforeCh === "'") &&
      cm.index >= 2 &&
      text[cm.index - 2] === "\\" &&
      text[flagEnd] === "\\" &&
      text[flagEnd + 1] === beforeCh;
    const effectiveFlagEnd = isEscapedWrapQuote ? flagEnd + 2 : isSimpleWrapQuote ? flagEnd + 1 : flagEnd;
    const renderedFlagHead = isEscapedWrapQuote
      ? `${flag}\\${beforeCh}`
      : isSimpleWrapQuote
        ? `${flag}${beforeCh}`
        : flag;

    // Attached short flag value without whitespace/`=`: e.g. `curl -udemo:sample`, `mysql -pZQX`, `obsutil -iAK`
    if (
      !isSimpleWrapQuote &&
      !isEscapedWrapQuote &&
      (isShortCurlFlag || isCommandShortSecret) &&
      effectiveFlagEnd < text.length &&
      text[effectiveFlagEnd] !== "=" &&
      text[effectiveFlagEnd] !== " " &&
      text[effectiveFlagEnd] !== "\t" &&
      text[effectiveFlagEnd] !== "\r" &&
      text[effectiveFlagEnd] !== "\n"
    ) {
      const flowCtx = cliFlowScanner.at(effectiveFlagEnd);
      if (ALREADY_REDACTED_SHELL_VAL_PREFIX_RE.test(text.slice(effectiveFlagEnd, effectiveFlagEnd + 64))) {
        cm = cliFlagRe.exec(text);
        continue;
      }
      const attRes = scanDiagnosticValue(text, effectiveFlagEnd, {
        allowComma: true,
        allowQuoted: true,
        allowShellConcat: true,
        precomputedFlowCtx: flowCtx,
      });
      if (attRes.end > effectiveFlagEnd) {
        const valText = text.slice(effectiveFlagEnd, attRes.end);
        const allowAttached = isCommandShortSecret
          ? true
          : (shortFlagKind === "u" &&
              ((isCurl && (valText.includes(":") || valText.length > 0)) ||
                (valText.includes(":") && !/^\d+:\d+$/.test(valText)))) ||
            (shortFlagKind === "b" && (valText.includes("=") || isCurl));
        if (allowAttached && valText !== '""' && valText !== "''" && !ALREADY_REDACTED_RE.test(valText)) {
          cliEdits.push({
            start: cm.index,
            end: attRes.end,
            replacement: `${renderedFlagHead}${masks.flagMask}`,
          });
          count += 1;
          cliFlagRe.lastIndex = Math.max(cliFlagRe.lastIndex, attRes.end);
        }
      }
      cm = cliFlagRe.exec(text);
      continue;
    }

    cliEqRe.lastIndex = effectiveFlagEnd;
    const eqMatch = cliEqRe.exec(text);
    if (eqMatch) {
      const valStart = effectiveFlagEnd + eqMatch[0].length;
      const flowCtx = cliFlowScanner.at(valStart);
      const redPrefixRe =
        flowCtx.inBraceOrBracket || flowCtx.inParen
          ? ALREADY_REDACTED_VAL_PREFIX_RE
          : ALREADY_REDACTED_SHELL_VAL_PREFIX_RE;
      if (redPrefixRe.test(text.slice(valStart, valStart + 64))) {
        cm = cliFlagRe.exec(text);
        continue;
      }
      const valRes = scanDiagnosticValue(text, valStart, {
        allowComma: true,
        allowQuoted: true,
        allowShellConcat: true,
        precomputedFlowCtx: flowCtx,
      });
      if (valRes.end > valStart) {
        const valText = text.slice(valStart, valRes.end);
        const allowEqVal = isCommandShortSecret
          ? true
          : (!isShortCurlFlag && !isLongUserFlag) ||
            isCurl ||
            (isLongUserFlag && !/^\d+(?::\d+)?$/.test(valText)) ||
            (shortFlagKind === "u" && valText.includes(":") && !/^\d+:\d+$/.test(valText)) ||
            (shortFlagKind === "b" && valText.includes("="));
        const innerEmpty = valText === '""' || valText === "''";
        const skipWeak =
          !isCommandShortSecret &&
          valRes.openQuote === null &&
          isWeakCredentialKey(flag) &&
          isNonSecretLiteralText(flag, valText);
        if (allowEqVal && !innerEmpty && !skipWeak && !ALREADY_REDACTED_RE.test(valText)) {
          cliEdits.push({
            start: cm.index,
            end: valRes.end,
            replacement: `${renderedFlagHead}=${masks.flagMask}`,
          });
          count += 1;
        }
        cliFlagRe.lastIndex = Math.max(cliFlagRe.lastIndex, valRes.end);
      }
      cm = cliFlagRe.exec(text);
      continue;
    }

    // In MySQL CLI, space-separated `-p db` is a database name, not a password; only attached/-p= is password.
    if (isShortPwdFlag && profile === "mysql") {
      cm = cliFlagRe.exec(text);
      continue;
    }

    const maxArgs = MULTIVALUE_SECRET_FLAG_RE.test(flag) ? Number.POSITIVE_INFINITY : 1;
    let cursor = effectiveFlagEnd;
    let outChunk = renderedFlagHead;
    let anyMasked = false;
    let argCount = 0;
    while (cursor < text.length && argCount < maxArgs) {
      cliSepRe.lastIndex = cursor;
      const sepMatch = cliSepRe.exec(text);
      if (!sepMatch) break;
      const tokStart = cursor + sepMatch[0].length;
      const flowCtx = cliFlowScanner.at(tokStart);
      const redMatch = ALREADY_REDACTED_SHELL_VAL_PREFIX_RE.exec(text.slice(tokStart, tokStart + 64));
      if (redMatch) {
        const bracketEnd = tokStart + text.slice(tokStart).indexOf("]") + 1;
        outChunk += `${sepMatch[0]}${text.slice(tokStart, bracketEnd)}`;
        cursor = bracketEnd;
        argCount += 1;
        continue;
      }
      const tokRes = scanDiagnosticValue(text, tokStart, {
        allowComma: true,
        allowQuoted: true,
        allowShellConcat: true,
        stopAtLeadingDash: false,
        precomputedFlowCtx: flowCtx,
      });
      if (tokRes.end <= tokStart) break;
      const tokText = text.slice(tokStart, tokRes.end);
      if (
        tokRes.openQuote === null &&
        isMandatoryOperandFlagBoundary(
          tokText,
          argCount === 0 &&
            (isCommandShortSecret || isShortCurlFlag || /^--(?:password|passwd)$/i.test(flag)),
        )
      ) {
        break;
      }
      if (
        (!isCommandShortSecret &&
          isShortCurlFlag &&
          !isCurl &&
          !(shortFlagKind === "u" && tokText.includes(":") && !/^\d+:\d+$/.test(tokText)) &&
          !(shortFlagKind === "b" && tokText.includes("="))) ||
        (isLongUserFlag &&
          !isCurl &&
          (!tokText.includes(":") || /^\d+:\d+$/.test(tokText.replace(/^["']|["']$/g, ""))))
      ) {
        break;
      }
      if (
        !isCommandShortSecret &&
        tokRes.openQuote === null &&
        isWeakCredentialKey(flag) &&
        isNonSecretLiteralText(flag, tokText)
      ) {
        break;
      }
      if (tokText === '""' || tokText === "''" || ALREADY_REDACTED_RE.test(tokText)) {
        outChunk += `${sepMatch[0]}${tokText}`;
      } else {
        outChunk += `${sepMatch[0]}${masks.flagMask}`;
        count += 1;
        anyMasked = true;
      }
      cursor = tokRes.end;
      argCount += 1;
    }
    if (anyMasked) {
      cliEdits.push({ start: cm.index, end: cursor, replacement: outChunk });
      cliFlagRe.lastIndex = Math.max(cliFlagRe.lastIndex, cursor);
    }
    cm = cliFlagRe.exec(text);
  }
  text = replaceMatchedSpans(text, cliEdits);

  // 4. Sensitive YAML 1.2 AST + inline `{...}` flow objects + malformed YAML fallback
  const isYamlSecretKey = (rawKey: string): boolean =>
    YAML_SECRET_KEY_SHAPE_RE.test(rawKey) && isCredentialKey(rawKey);
  const yamlRes = redactYamlCredentials(text, isYamlSecretKey, masks.keyMask);
  text = yamlRes.text;
  count += yamlRes.count;

  // 5. Authorization / Proxy-Authorization headers (quoted multiline, unclosed, RFC 9110 unbounded scheme, Digest/AWS4)
  const authRes = redactAuthorizationHeaders(text, masks.tokenMask);
  text = authRes.text;
  count += authRes.count;

  // 6. Other quoted credential headers (`curl -H "X-Api-Key: s1 s2"`, `'X-Api-Key: one'\''two'`, `"Cookie: a=1; b=2"`) & folded Cookie lines
  const otherHeaderAnchorRe = /(["'])([A-Za-z][A-Za-z0-9_.-]{0,96})([ \t]*:[ \t]*)/g;
  const hdrFlowScanner = createFlowContextScanner(text);
  const headerEdits: Array<{ start: number; end: number; replacement: string }> = [];
  let hm = otherHeaderAnchorRe.exec(text);
  while (hm !== null) {
    const start = hm.index;
    const quote = hm[1] as '"' | "'";
    const headerName = hm[2]!;
    const sep = hm[3]!;
    if (/^(?:proxy-)?authorization$/i.test(headerName) || !isCredentialKey(headerName)) {
      hm = otherHeaderAnchorRe.exec(text);
      continue;
    }
    const qRes = scanShellQuotedArg(text, start, quote, true, hdrFlowScanner.at(start));
    const innerCloseOffset = qRes.closed && text[qRes.end - 1] === quote ? 1 : 0;
    const body = text.slice(start + 1 + headerName.length + sep.length, qRes.end - innerCloseOffset);
    if (body.trim() !== "" && !ALREADY_REDACTED_RE.test(body.trim())) {
      headerEdits.push({
        start,
        end: qRes.end,
        replacement: `${quote}${headerName}${sep}${masks.keyMask}${quote}`,
      });
      count += 1;
    }
    otherHeaderAnchorRe.lastIndex = Math.max(otherHeaderAnchorRe.lastIndex, qRes.end);
    hm = otherHeaderAnchorRe.exec(text);
  }
  text = replaceMatchedSpans(text, headerEdits);

  const cookiePairRe =
    /[A-Za-z0-9_.-]+=(?:"(?:\\[^\r\n]|[^"\\\r\n])*(?:"|(?=\r|\n|$))|'(?:\\[^\r\n]|[^'\\\r\n])*(?:'|(?=\r|\n|$))|[^\s;"'|\r\n]*)/y;
  const execCookiePair = (idx: number): RegExpExecArray | null => {
    cookiePairRe.lastIndex = idx;
    return cookiePairRe.exec(text);
  };
  const cookieAnchorRe = /(?:(?<![A-Za-z0-9_-])|(?<=\\[rnt]))((?:Set-)?Cookie[ \t]*:[ \t]*)/gi;
  const getCookieIndent = createMonotonicIndentLookup(text);
  const cookieEdits: Array<{ start: number; end: number; replacement: string }> = [];
  let ckm = cookieAnchorRe.exec(text);
  while (ckm !== null) {
    const start = ckm.index;
    const prefix = ckm[1]!;
    const valStart = start + prefix.length;
    if (ALREADY_REDACTED_VAL_PREFIX_RE.test(text.slice(valStart, valStart + 64))) {
      ckm = cookieAnchorRe.exec(text);
      continue;
    }
    const headerIndent = getCookieIndent(start);
    let cursor = valStart;
    while (cursor < text.length && text[cursor] === " ") cursor += 1;
    const firstPair = execCookiePair(cursor);
    if (!firstPair) {
      ckm = cookieAnchorRe.exec(text);
      continue;
    }
    cursor += firstPair[0].length;
    while (cursor < text.length) {
      let sepPos = cursor;
      while (sepPos < text.length && (text[sepPos] === " " || text[sepPos] === "\t")) sepPos += 1;
      if (text[sepPos] === "\\") {
        const nl = consumeNewline(text, sepPos + 1);
        if (nl !== -1 && !isDiagCol0At(text, nl)) {
          let ws = nl;
          while (ws < text.length && (text[ws] === " " || text[ws] === "\t")) ws += 1;
          if (text[ws] === ";") sepPos = ws;
        }
      } else if (text[sepPos] === "\r" || text[sepPos] === "\n") {
        const folded = isFoldedHeaderContinuation(text, sepPos, headerIndent, "cookie");
        if (folded !== -1 && text[folded] === ";") {
          sepPos = folded;
        }
      }
      if (text[sepPos] !== ";") break;
      let nextPos = sepPos + 1;
      while (nextPos < text.length && (text[nextPos] === " " || text[nextPos] === "\t")) nextPos += 1;
      if (text[nextPos] === "\\") {
        const nl = consumeNewline(text, nextPos + 1);
        if (nl !== -1 && !isDiagCol0At(text, nl)) {
          nextPos = nl;
          while (nextPos < text.length && (text[nextPos] === " " || text[nextPos] === "\t")) nextPos += 1;
        }
      } else if (text[nextPos] === "\r" || text[nextPos] === "\n") {
        const folded = isFoldedHeaderContinuation(text, nextPos, headerIndent, "cookie");
        if (folded === -1) break;
        nextPos = folded;
      }
      const nextPair = execCookiePair(nextPos);
      if (!nextPair) break;
      cursor = nextPos + nextPair[0].length;
    }
    cookieEdits.push({
      start,
      end: cursor,
      replacement: `${prefix}${masks.keyMask}`,
    });
    count += 1;
    cookieAnchorRe.lastIndex = Math.max(cookieAnchorRe.lastIndex, cursor);
    ckm = cookieAnchorRe.exec(text);
  }
  text = replaceMatchedSpans(text, cookieEdits);

  // 7. Standalone `Bearer <token>` outside Authorization headers (supports ` \\\n`, multiline tokens with line-count padding, quoted tokens, and `:` )
  const bearerContSrc = `\\\\${NL_SRC}${DIAG_COL0_CONTINUATION_LOOKAHEAD_SRC}[ \\t]*`;
  const bearerTokSrc = `(?:\\"(?:\\\\[^\\r\\n]|[^\\"\\\\\\r\\n])*(?:\\"|(?=\\r|\\n|$))|'(?:\\\\[^\\r\\n]|[^'\\\\\\r\\n])*(?:'|(?=\\r|\\n|$))|[A-Za-z0-9._~+/=:-]+(?:${bearerContSrc}[A-Za-z0-9._~+/=:-]+)*)`;
  text = text.replace(
    new RegExp(
      `(?:(?<![A-Za-z0-9_-])|(?<=\\\\[rnt]))\\b(Bearer)((?:[ \\t]*${bearerContSrc}|[ \\t]+))(?!\\[REDACTED(?:_[A-Z]+)?\\]${REDACTED_END_LOOKAHEAD_SRC})(?![A-Za-z_][A-Za-z0-9_]*=[^=\\r\\n\\t ])(${bearerTokSrc})`,
      "gi",
    ),
    (full, bearer: string, sep: string, rawTok: string) => {
      if (CONTINUATION_OPT_RE.test(rawTok) || ALREADY_REDACTED_RE.test(rawTok)) return full;
      const outSep = sep.includes("\n") || sep.includes("\r") ? " " : sep;
      if (rawTok.startsWith('"') || rawTok.startsWith("'")) {
        const q = rawTok[0]!;
        const inner = rawTok.slice(1, rawTok.endsWith(q) && rawTok.length > 1 ? -1 : undefined);
        if (inner === "" || ALREADY_REDACTED_RE.test(inner)) return full;
        count += 1;
        return padRemovedLineBreaks(full, `${bearer}${outSep}${q}${masks.tokenMask}${q}`);
      }
      if (BEARER_PROSE_STOP_RE.test(rawTok)) return full;
      count += 1;
      return padRemovedLineBreaks(full, `${bearer}${outSep}${masks.tokenMask}`);
    },
  );

  // 8. Left-to-right Key-Value assignments (`KEY=val`, `KEY: val`, `"KEY": val`, multiline, partial, shell `\\\n`, comma lists)
  const kvRes = redactKeyValueCredentials(text, masks.keyMask);
  text = kvRes.text;
  count += kvRes.count;

  // 8.5. Escaped JSON/commands inside double-quoted shell or JSON strings (e.g. `curl -d "{\"password\":\"demo\"}"`)
  if (depth < 4 && text.includes('\\"')) {
    const escapedEdits: Array<{ start: number; end: number; replacement: string }> = [];
    let si = 0;
    while (si < text.length) {
      const ch = text[si]!;
      if (ch === "#" && (si === 0 || /[\s;&|({[\n\r]/.test(text[si - 1]!))) {
        while (si < text.length && text[si] !== "\n" && text[si] !== "\r") si += 1;
        continue;
      }
      if (ch === "'" && (si === 0 || /[\s=:(,[{;&|\n\r]/.test(text[si - 1]!))) {
        const sqRes = scanQuotedScalar(text, si, "'", true);
        if (sqRes.closed && !text.slice(si, sqRes.end).includes("\n")) {
          si = sqRes.end;
          continue;
        }
      }
      if (ch !== '"') {
        si += 1;
        continue;
      }
      let bs = 0;
      let back = si - 1;
      while (back >= 0 && text[back] === "\\") {
        bs += 1;
        back -= 1;
      }
      if (bs % 2 === 1) {
        si += 1;
        continue;
      }
      const rawQRes = scanQuotedScalar(text, si, '"', true);
      const rawInnerFull = text.slice(si + 1, rawQRes.closed ? rawQRes.end - 1 : rawQRes.end);
      const fullNlPos = rawInnerFull.indexOf("\n");
      let splitBeforeNextLine = false;
      if (fullNlPos !== -1 && rawQRes.closed) {
        if (text[rawQRes.end] === "{") {
          splitBeforeNextLine = true;
        } else {
          const firstLine = rawInnerFull.slice(0, fullNlPos);
          if (firstLine.trim() !== "" && !firstLine.trimEnd().endsWith("\\")) {
            let tailEnd = rawQRes.end;
            while (
              tailEnd < text.length &&
              text[tailEnd] !== "\r" &&
              text[tailEnd] !== "\n" &&
              text[tailEnd] !== ";" &&
              text[tailEnd] !== "|" &&
              !(text[tailEnd] === "&" && text[tailEnd + 1] === "&")
            ) {
              tailEnd += 1;
            }
            if (text.slice(rawQRes.end, tailEnd).includes('\\"')) {
              splitBeforeNextLine = true;
            }
          }
        }
      }
      const line1RawEnd =
        fullNlPos !== -1
          ? si + 1 + (rawInnerFull[fullNlPos - 1] === "\r" ? fullNlPos - 1 : fullNlPos)
          : rawQRes.end;
      const effEnd = splitBeforeNextLine ? line1RawEnd : rawQRes.end;
      const effInnerEnd = splitBeforeNextLine ? line1RawEnd : rawQRes.closed ? rawQRes.end - 1 : rawQRes.end;
      const rawInner = text.slice(si + 1, effInnerEnd);
      const nlPos = rawInner.indexOf("\n");
      let emittedEdit = false;
      if (rawInner.includes('\\"') && (rawInner.includes(":") || rawInner.includes("="))) {
        let decoded: string | null = null;
        let usedJsonParse = false;
        if (!rawInner.includes("\n") && !rawInner.includes("\r")) {
          try {
            const parsed: unknown = JSON.parse(`"${rawInner}"`);
            if (typeof parsed === "string") {
              decoded = parsed;
              usedJsonParse = true;
            }
          } catch {
            decoded = null;
          }
        }
        if (decoded === null) {
          let buf = "";
          for (let p = 0; p < rawInner.length; p += 1) {
            const c = rawInner[p]!;
            if (
              c === "\\" &&
              p + 1 < rawInner.length &&
              (rawInner[p + 1] === '"' ||
                rawInner[p + 1] === "\\" ||
                rawInner[p + 1] === "$" ||
                rawInner[p + 1] === "`")
            ) {
              buf += rawInner[p + 1]!;
              p += 1;
            } else {
              buf += c;
            }
          }
          decoded = buf;
        }
        const innerRes = redactDiagnosticCredentials(decoded, masks, depth + 1);
        if (innerRes.count > 0) {
          const encodedInner = usedJsonParse
            ? JSON.stringify(innerRes.text).slice(1, -1)
            : innerRes.text.replace(/\\(?=["\\$`]|$)/g, "\\\\").replace(/"/g, '\\"');
          escapedEdits.push({
            start: si,
            end: effEnd,
            replacement: rawQRes.closed && !splitBeforeNextLine ? `"${encodedInner}"` : `"${encodedInner}`,
          });
          count += innerRes.count;
          emittedEdit = true;
        }
      }
      if (!emittedEdit) {
        if (nlPos !== -1) {
          si = si + 1 + nlPos + 1;
          continue;
        }
        if (rawQRes.closed && text[rawQRes.end] === "{") {
          si = rawQRes.end - 1;
          continue;
        }
      }
      si = Math.max(si + 1, splitBeforeNextLine ? si + 1 + fullNlPos + 1 : effEnd);
    }
    text = replaceMatchedSpans(text, escapedEdits);
  }

  // 8.7. `.netrc` blocks (token-grammar scanner: arbitrary field order, escaped-quote passwords, `default password`, no cross-record bleed) & XML credential tags (multiline attrs + CDATA)
  if (text.includes("password") && (text.includes("machine") || text.includes("default"))) {
    const NETRC_FIELDS = new Set(["login", "password", "account", "macdef"]);
    const readNetrcTok = (
      pos: number,
    ): { tok: string; quote: '"' | "'" | null; start: number; end: number } | null => {
      let p = pos;
      while (p < text.length) {
        const ch = text[p]!;
        if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n") {
          p += 1;
          continue;
        }
        if (ch === "#") {
          while (p < text.length && text[p] !== "\n" && text[p] !== "\r") p += 1;
          continue;
        }
        break;
      }
      if (p >= text.length) return null;
      const start = p;
      const ch = text[p]!;
      if (ch === '"' || ch === "'") {
        const q = ch;
        p += 1;
        while (p < text.length && text[p] !== "\n" && text[p] !== "\r") {
          if (text[p] === "\\" && p + 1 < text.length && text[p + 1] !== "\n" && text[p + 1] !== "\r") {
            p += 2;
            continue;
          }
          if (text[p] === q) {
            p += 1;
            return { tok: text.slice(start, p), quote: q, start, end: p };
          }
          p += 1;
        }
        return { tok: text.slice(start, p), quote: q, start, end: p };
      }
      while (p < text.length && text[p] !== " " && text[p] !== "\t" && text[p] !== "\r" && text[p] !== "\n") {
        p += 1;
      }
      return { tok: text.slice(start, p), quote: null, start, end: p };
    };
    const netrcHeadRe = /(?:^|[\s:;])(machine|default)\b/g;
    const netrcEdits: Array<{ start: number; end: number; replacement: string }> = [];
    let lastEntryEnd = -1;
    let nm = netrcHeadRe.exec(text);
    while (nm !== null) {
      const kwTokStr = nm[1]!;
      const kwStart = nm.index + (nm[0].length - kwTokStr.length);
      const isCleanDefaultStart =
        kwTokStr !== "default" ||
        kwStart === 0 ||
        (lastEntryEnd >= 0 && text.slice(lastEntryEnd, kwStart).trim() === "") ||
        /(?:^|[\r\n:;])[ \t]*$/.test(text.slice(Math.max(0, kwStart - 24), kwStart));
      if (!isCleanDefaultStart) {
        nm = netrcHeadRe.exec(text);
        continue;
      }
      let cursor = kwStart + kwTokStr.length;
      if (kwTokStr === "machine") {
        const hostTok = readNetrcTok(cursor);
        if (
          !hostTok ||
          (hostTok.quote === null &&
            (NETRC_FIELDS.has(hostTok.tok) || hostTok.tok === "machine" || hostTok.tok === "default")) ||
          (hostTok.quote !== null && stripMatchingArgvQuotes(hostTok.tok).trim() === "")
        ) {
          nm = netrcHeadRe.exec(text);
          continue;
        }
        cursor = hostTok.end;
      }
      let parsedAnyField = false;
      while (cursor < text.length) {
        const kw = readNetrcTok(cursor);
        if (!kw || kw.quote !== null || !NETRC_FIELDS.has(kw.tok)) break;
        if (kw.tok === "macdef") {
          const macName = readNetrcTok(kw.end);
          cursor = macName ? macName.end : kw.end;
          break;
        }
        const valTok = readNetrcTok(kw.end);
        if (!valTok) break;
        parsedAnyField = true;
        if (
          kw.tok === "password" &&
          valTok.tok !== '""' &&
          valTok.tok !== "''" &&
          !ALREADY_REDACTED_RE.test(valTok.tok)
        ) {
          netrcEdits.push({
            start: valTok.start,
            end: valTok.end,
            replacement: valTok.quote ? `${valTok.quote}${masks.keyMask}${valTok.quote}` : masks.keyMask,
          });
          count += 1;
        }
        cursor = valTok.end;
      }
      if (parsedAnyField) {
        lastEntryEnd = cursor;
        netrcHeadRe.lastIndex = Math.max(netrcHeadRe.lastIndex, cursor);
      }
      nm = netrcHeadRe.exec(text);
    }
    text = replaceMatchedSpans(text, netrcEdits);
  }
  if (text.includes("<")) {
    interface MonotonicNeedleCache {
      needle: string;
      searchFrom: number;
      foundPos: number;
    }
    const findMonotonicNext = (cache: MonotonicNeedleCache, from: number, maxEnd: number): number => {
      if (cache.searchFrom !== -1 && from >= cache.searchFrom) {
        if (cache.foundPos === -1 || cache.foundPos >= from) {
          return cache.foundPos !== -1 && cache.foundPos <= maxEnd ? cache.foundPos : -1;
        }
      }
      const hit = text.indexOf(cache.needle, from);
      cache.searchFrom = from;
      cache.foundPos = hit;
      return hit !== -1 && hit <= maxEnd ? hit : -1;
    };
    const isLineStartTag = (pos: number): boolean => {
      let i = pos - 1;
      while (i >= 0 && (text[i] === " " || text[i] === "\t")) i -= 1;
      return i < 0 || text[i] === "\n" || text[i] === "\r" || text[i] === ">";
    };
    const hasXmlHeader = text.includes("<?xml") || text.includes("</");
    const ltCache: MonotonicNeedleCache = { needle: "<", searchFrom: -1, foundPos: -1 };
    const cdataEndCache: MonotonicNeedleCache = { needle: "]]>", searchFrom: -1, foundPos: -1 };
    const commentEndCache: MonotonicNeedleCache = { needle: "-->", searchFrom: -1, foundPos: -1 };
    const piEndCache: MonotonicNeedleCache = { needle: "?>", searchFrom: -1, foundPos: -1 };
    const xmlCloseAtRe = /<\/([A-Za-z][A-Za-z0-9_.:-]*)[ \t\r\n]*>/y;
    const xmlOpenRe = /<((?:[A-Za-z][A-Za-z0-9_-]*:)?([A-Za-z][A-Za-z0-9_.-]*))(?:\s[^<>]{0,512})?>/g;
    const xmlEdits: Array<{ start: number; end: number; replacement: string }> = [];
    let xm = xmlOpenRe.exec(text);
    while (xm !== null) {
      const fullTag = xm[1]!;
      const localTag = xm[2]!;
      if (xm[0].endsWith("/>") || !isCredentialKey(localTag)) {
        xm = xmlOpenRe.exec(text);
        continue;
      }
      const openEnd = xm.index + xm[0].length;
      const bound = Math.min(text.length, openEnd + 65536);
      let scanPos = openEnd;
      let combined = "";
      let closeHit: { start: number; end: number } | null = null;
      let isValidLeaf = true;
      let unclosedAtEofEnd = -1;
      while (scanPos <= bound) {
        const lt = findMonotonicNext(ltCache, scanPos, bound);
        if (lt === -1) {
          if (text.length <= openEnd + 65536) {
            combined += text.slice(scanPos);
            unclosedAtEofEnd = text.length;
          }
          isValidLeaf = false;
          break;
        }
        if (lt > scanPos) combined += text.slice(scanPos, lt);
        if (text.startsWith("<![CDATA[", lt)) {
          const cdEnd = findMonotonicNext(cdataEndCache, lt + 9, bound);
          if (cdEnd === -1) {
            if (text.length <= openEnd + 65536 && findMonotonicNext(ltCache, lt + 9, text.length) === -1) {
              combined += text.slice(lt + 9);
              unclosedAtEofEnd = text.length;
            }
            isValidLeaf = false;
            break;
          }
          combined += text.slice(lt + 9, cdEnd);
          scanPos = cdEnd + 3;
        } else if (text.startsWith("<!--", lt)) {
          const cmEnd = findMonotonicNext(commentEndCache, lt + 4, bound);
          if (cmEnd === -1) {
            if (lt - openEnd <= 65536 && findMonotonicNext(ltCache, lt + 4, text.length) === -1) {
              unclosedAtEofEnd = lt;
            }
            isValidLeaf = false;
            break;
          }
          scanPos = cmEnd + 3;
        } else if (text.startsWith("<?", lt)) {
          const piEnd = findMonotonicNext(piEndCache, lt + 2, bound);
          if (piEnd === -1) {
            isValidLeaf = false;
            break;
          }
          scanPos = piEnd + 2;
        } else if (text[lt + 1] === "/") {
          xmlCloseAtRe.lastIndex = lt;
          const cm = xmlCloseAtRe.exec(text);
          if (cm && cm[1] === fullTag && lt - openEnd <= 65536) {
            closeHit = { start: lt, end: lt + cm[0].length };
          } else {
            // Handle diagnostic paste truncated mid-closing tag (`<password>SECRET</pass`) at EOF.
            const rest = text.slice(lt);
            if (/^<\/[A-Za-z0-9_.:-]*$/.test(rest) && lt - openEnd <= 65536) {
              unclosedAtEofEnd = lt;
            }
            isValidLeaf = false;
          }
          break;
        } else {
          isValidLeaf = false;
          break;
        }
      }
      const innerText = isValidLeaf && closeHit ? combined.trim() : "";
      if (
        isValidLeaf &&
        closeHit &&
        innerText !== "" &&
        !ALREADY_REDACTED_RE.test(innerText) &&
        !(isWeakCredentialKey(localTag) && isNonSecretLiteralText(localTag, innerText))
      ) {
        xmlEdits.push({
          start: openEnd,
          end: closeHit.start,
          replacement: masks.keyMask,
        });
        count += 1;
        xmlOpenRe.lastIndex = Math.max(xmlOpenRe.lastIndex, closeHit.end);
      } else if (unclosedAtEofEnd > openEnd) {
        const afterOpenRaw = text.slice(openEnd, unclosedAtEofEnd);
        const isPartialCloseTag = /^<\/[A-Za-z0-9_.:-]*$/.test(text.slice(unclosedAtEofEnd));
        let maskEnd = isPartialCloseTag ? text.length : unclosedAtEofEnd;
        if (!isPartialCloseTag && unclosedAtEofEnd === text.length) {
          if (!afterOpenRaw.includes("<![CDATA[")) {
            const firstNl = text.indexOf("\n", openEnd);
            const firstCr = text.indexOf("\r", openEnd);
            const firstBreak =
              firstNl === -1 ? firstCr : firstCr === -1 ? firstNl : Math.min(firstNl, firstCr);
            if (firstBreak !== -1) maskEnd = firstBreak;
          } else {
            const nextRec =
              /\r?\n(?:\s*(?:\[|\(\s*[A-Za-z_])|\s*(?:ERROR|WARN(?:ING)?|INFO|CRITICAL|FATAL|DEBUG|PANIC|TRACE)\b|\d{4}-\d{2}-\d{2}|Traceback\b)/i.exec(
                afterOpenRaw,
              );
            if (nextRec) maskEnd = openEnd + nextRec.index;
          }
        }
        const rawSliceForInner = maskEnd < unclosedAtEofEnd ? text.slice(openEnd, maskEnd) : combined;
        const partialInner = (
          rawSliceForInner.startsWith("<![CDATA[") ? rawSliceForInner.slice(9) : rawSliceForInner
        ).trim();
        const xmlContextLikely =
          hasXmlHeader ||
          isLineStartTag(xm.index) ||
          unclosedAtEofEnd < text.length ||
          afterOpenRaw.includes("<![CDATA[") ||
          xm[0].includes(" ") ||
          (xm.index > 0 && text[xm.index - 1] === "=") ||
          (!/^\s/.test(afterOpenRaw) && partialInner.length >= 2);
        const looksLikeCliPlaceholder =
          /^\s+--?[A-Za-z0-9]/.test(afterOpenRaw) ||
          (!hasXmlHeader &&
            !isLineStartTag(xm.index) &&
            /^\s+(?:to|and|or|in|on|at|for|from|with|then|before|after)\b/i.test(afterOpenRaw));
        if (
          maskEnd > openEnd &&
          xmlContextLikely &&
          !looksLikeCliPlaceholder &&
          partialInner !== "" &&
          !ALREADY_REDACTED_RE.test(partialInner) &&
          !(isWeakCredentialKey(localTag) && isNonSecretLiteralText(localTag, partialInner))
        ) {
          let newlineCount = 0;
          for (let k = openEnd; k < maskEnd; k += 1) {
            if (text[k] === "\n") newlineCount += 1;
          }
          xmlEdits.push({
            start: openEnd,
            end: maskEnd,
            replacement: `${masks.keyMask}${newlineCount > 0 ? "\n".repeat(newlineCount) : ""}`,
          });
          count += 1;
          xmlOpenRe.lastIndex = Math.max(xmlOpenRe.lastIndex, maskEnd);
          if (maskEnd >= text.length) break;
        }
      }
      xm = xmlOpenRe.exec(text);
    }
    text = replaceMatchedSpans(text, xmlEdits);
  }

  // 9. Standalone provider secret prefixes (`sk-...`, `hf_...`, `AKIA...`, `gh*_...`, `glpat-...`, `AIza...`, `xox?-...`, compact/pretty JWTs)
  replaceCounted(
    /\b(?:sk-[A-Za-z0-9_-]{10,}|hf_[A-Za-z0-9]{10,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|glpat-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{30,}|xox[baprs]-[0-9A-Za-z-]{10,})\b/g,
    masks.keyMask,
  );
  if (text.includes(".")) {
    const isJwtJsonSeg = (seg: string): boolean => {
      if (seg.startsWith("eyJ")) return true;
      if (seg.length % 4 === 1) return false;
      let seenBrace = false;
      for (let pos = 0; pos < seg.length; pos += 4096) {
        const chunk = seg.slice(pos, Math.min(seg.length, pos + 4096));
        const norm = chunk.replace(/-/g, "+").replace(/_/g, "/");
        const pad = norm.length % 4 === 0 ? "" : "=".repeat(4 - (norm.length % 4));
        let decoded: string;
        try {
          decoded = atob(`${norm}${pad}`);
        } catch {
          return false;
        }
        for (let k = 0; k < decoded.length; k += 1) {
          const c = decoded.charCodeAt(k);
          if (c === 32 || c === 9 || c === 10 || c === 13) continue;
          if (!seenBrace) {
            if (c !== 123) return false;
            seenBrace = true;
          } else {
            return c === 34 || c === 125;
          }
        }
      }
      return seenBrace;
    };
    text = text.replace(
      /\b((?:e[3wxyz]|[ICD][A-Za-z0-9_-])[A-Za-z0-9_-]{1,})\.((?:e[3wxyz]|[ICD][A-Za-z0-9_-])[A-Za-z0-9_-]{1,})(?:\.([A-Za-z0-9_-]+))?\b/g,
      (full, hdr: string, payload: string) => {
        if (!isJwtJsonSeg(hdr) || !isJwtJsonSeg(payload)) return full;
        count += 1;
        return masks.keyMask;
      },
    );
  }

  // 10. IPv4 + RFC-4291 IPv6 addresses
  const ipRes = redactIpAddresses(text, { mask: masks.ipMask, bracketedMask: masks.bracketedIpMask });
  text = ipRes.text;
  count += ipRes.count;

  return { text, count };
}
