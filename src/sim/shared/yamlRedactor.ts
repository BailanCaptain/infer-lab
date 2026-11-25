import { isAlias, isCollection, isScalar, parseAllDocuments, parseDocument, visit } from "yaml";

export interface RedactCountResult {
  readonly text: string;
  readonly count: number;
}

/**
 * Redact HTTP Authorization / Proxy-Authorization headers across single-quoted, double-quoted,
 * RFC 7616 multi-parameter Digest (including RFC 5987 `username*=UTF-8''...`), and bare tokens.
 */
export function redactAuthorizationHeaders(raw: string, maskToken: string): RedactCountResult {
  let count = 0;
  let text = raw;

  const replaceCounted = (pattern: RegExp, replacer: (...args: string[]) => string) => {
    text = text.replace(pattern, (...args) => {
      count += 1;
      return replacer(...(args as string[]));
    });
  };

  replaceCounted(
    /"((?:Proxy-)?Authorization[ \t]*:[ \t]*(?:(?:Bearer|Basic|Token|ApiKey|Digest)[ \t]+)?)(?!(?:Bearer|Basic|Token|ApiKey|Digest)[ \t]+\[REDACTED)(?!\[REDACTED)(?:\\[\s\S]|[^"\\\r\n])+"/gi,
    (_m, p1: string) => `"${p1}${maskToken}"`,
  );
  replaceCounted(
    /'((?:Proxy-)?Authorization[ \t]*:[ \t]*(?:(?:Bearer|Basic|Token|ApiKey|Digest)[ \t]+)?)(?!(?:Bearer|Basic|Token|ApiKey|Digest)[ \t]+\[REDACTED)(?!\[REDACTED)(?:\\[\s\S]|[^'\\\r\n])+'/gi,
    (_m, p1: string) => `'${p1}${maskToken}'`,
  );
  // Quoted YAML/JSON header values: `Authorization: 'Basic ...'` / `Proxy-Authorization: "Digest ..."`
  replaceCounted(
    /\b((?:Proxy-)?Authorization[ \t]*:[ \t]*)"(?:(?:Bearer|Basic|Token|ApiKey|Digest)[ \t]+)?(?!(?:Bearer|Basic|Token|ApiKey|Digest)[ \t]+\[REDACTED)(?!\[REDACTED)(?:\\[\s\S]|[^"\\\r\n])+"/gi,
    (_m, p1: string) => `${p1}"${maskToken}"`,
  );
  replaceCounted(
    /\b((?:Proxy-)?Authorization[ \t]*:[ \t]*)'(?:(?:Bearer|Basic|Token|ApiKey|Digest)[ \t]+)?(?!(?:Bearer|Basic|Token|ApiKey|Digest)[ \t]+\[REDACTED)(?!\[REDACTED)(?:\\[\s\S]|[^'\\\r\n])+'/gi,
    (_m, p1: string) => `${p1}'${maskToken}'`,
  );
  // Bare RFC 7616 Digest header with horizontal-only comma/space-separated parameters (never crossing \r/\n)
  replaceCounted(
    /\b((?:Proxy-)?Authorization[ \t]*:[ \t]*Digest[ \t]+)(?!\[REDACTED)(?:[A-Za-z0-9_.*!#$%&'+^~`-]+[ \t]*=[ \t]*(?:"(?:\\[\s\S]|[^"\\\r\n])*"|[^\s",;\r\n]+)(?:[ \t]*,[ \t]*|[ \t]+(?=[A-Za-z0-9_.*!#$%&'+^~`-]+[ \t]*=))?)+/gi,
    (_m, p1: string) => `${p1}${maskToken}`,
  );
  replaceCounted(
    /\b((?:Proxy-)?Authorization[ \t]*:[ \t]*(?:(?:Bearer|Basic|Token|ApiKey|Digest)[ \t]+)?)(?!(?:Bearer|Basic|Token|ApiKey|Digest)[ \t]+\[REDACTED)(?!\[REDACTED)(?!--)[^\s"';|&<>(){}\r\n]+/gi,
    (_m, p1: string) => `${p1}${maskToken}`,
  );

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

function tryRedactValidYamlSlice(
  slice: string,
  isSecretKey: (key: string) => boolean,
  maskToken: string,
  depth = 0,
  defaultQuote: '"' | "'" = '"',
): RedactCountResult | null {
  if (!slice.includes(":")) return null;
  let docs: ReturnType<typeof parseAllDocuments>;
  try {
    docs = parseAllDocuments(slice, { strict: false });
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

  const rawEdits: Array<[number, number]> = [];
  const blockReplacements: Array<{ start: number; end: number; replacement: string; count: number }> = [];

  for (const doc of docs) {
    const collectAliasTargets = (root: unknown, visited = new Set<unknown>()) => {
      if (!root || typeof root !== "object" || visited.has(root)) return;
      visited.add(root);
      visit(root as Parameters<typeof visit>[0], {
        Alias(_, aliasNode) {
          const target = (
            aliasNode as {
              resolve?: (d: unknown) => { range?: [number, number, number] | null } | undefined;
            }
          ).resolve?.(doc);
          if (target?.range) {
            rawEdits.push([target.range[0], target.range[1]]);
            collectAliasTargets(target, visited);
          }
        },
      });
    };

    visit(doc, {
      Pair(_, pair) {
        const keyNode = pair.key as { value?: unknown } | null;
        const keyName =
          keyNode && (typeof keyNode.value === "string" || typeof keyNode.value === "number")
            ? String(keyNode.value)
            : null;
        if (!keyName || !isSecretKey(keyName)) return;
        const valNode = pair.value as {
          range?: [number, number, number] | null;
          value?: unknown;
          items?: unknown[];
          resolve?: (d: unknown) => { range?: [number, number, number] | null; value?: unknown } | undefined;
        } | null;
        if (!valNode || !valNode.range) return;

        if (isAlias(valNode)) {
          collectAliasTargets(valNode);
          rawEdits.push([valNode.range[0], valNode.range[1]]);
          return visit.SKIP;
        }

        if (isScalar(valNode)) {
          if (valNode.value === null || valNode.value === undefined) return visit.SKIP;
          const strVal = String(valNode.value);
          if (strVal === "" || strVal === maskToken || strVal.startsWith("[REDACTED")) return visit.SKIP;
        } else if (isCollection(valNode)) {
          if (valNode.items.length === 0) return visit.SKIP;
          collectAliasTargets(valNode);
        }

        rawEdits.push([valNode.range[0], valNode.range[1]]);
        return visit.SKIP;
      },
      Scalar(key, node) {
        if (key === "key") return;
        if (typeof node.value !== "string" || !node.range) return;
        const end = trimYamlRangeEnd(slice, node.range[0], node.range[1]);
        if (end <= node.range[0]) return;
        const rawBlock = slice.slice(node.range[0], end);
        if (!/^(?:(?:&[^\s]+|![^\s]+)[ \t]*)*[|>]/.test(rawBlock)) return;
        const nlIdx = rawBlock.indexOf("\n");
        if (nlIdx < 0) return;
        if (depth >= 256) {
          rawEdits.push([node.range[0], end]);
          return;
        }
        if (!node.value.includes(":")) return;
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
        const inner = redactYamlCredentials(dedented, isSecretKey, maskToken, depth + 1);
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
      },
    });
  }

  // Deduplicate and merge any overlapping mask ranges (e.g. anchor + alias)
  const trimmedEdits: Array<[number, number]> = rawEdits
    .map(([s, rawEnd]): [number, number] => [s, trimYamlRangeEnd(slice, s, rawEnd)])
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0] || b[1] - a[1]);

  const merged: Array<[number, number]> = [];
  for (const [s, e] of trimmedEdits) {
    const prev = merged[merged.length - 1];
    if (prev && s <= prev[1]) {
      prev[1] = Math.max(prev[1], e);
    } else {
      merged.push([s, e]);
    }
  }

  const validBlocks = blockReplacements.filter((b) => !merged.some(([ms, me]) => b.start < me && b.end > ms));

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

  let out = slice;
  let totalCount = 0;
  for (let i = ops.length - 1; i >= 0; i -= 1) {
    const op = ops[i]!;
    totalCount += op.count;
    if (op.kind === "block") {
      out = `${out.slice(0, op.start)}${op.replacement}${out.slice(op.end)}`;
    } else {
      const orig = out.slice(op.start, op.end);
      const anchorPrefix = /^(&[^\s]+[ \t]+)/.exec(orig)?.[1] ?? "";
      const body = anchorPrefix ? orig.slice(anchorPrefix.length) : orig;
      const q =
        body.startsWith('"') && body.endsWith('"')
          ? '"'
          : body.startsWith("'") && body.endsWith("'")
            ? "'"
            : defaultQuote;
      out = `${out.slice(0, op.start)}${anchorPrefix}${q}${maskToken}${q}${out.slice(op.end)}`;
    }
  }
  return { text: out, count: totalCount };
}

function redactInlineYamlFlowObjects(
  raw: string,
  isSecretKey: (key: string) => boolean,
  maskToken: string,
): RedactCountResult {
  if (!raw.includes("{") || !raw.includes(":")) return { text: raw, count: 0 };
  let count = 0;
  let out = "";
  let i = 0;
  const canStartFlowQuote = (prev: string | undefined) =>
    prev === undefined ||
    prev === "{" ||
    prev === "[" ||
    prev === "," ||
    prev === ":" ||
    prev === " " ||
    prev === "\t" ||
    prev === "\r" ||
    prev === "\n";

  const tryFlowCandidate = (startIdx: number, endIdx: number): RedactCountResult | null => {
    const candidate = raw.slice(startIdx, endIdx);
    const flowQuote: '"' | "'" = raw[startIdx - 1] === '"' ? "'" : '"';
    try {
      const doc = parseDocument(candidate, { strict: false });
      if (doc.errors.length === 0 && isCollection(doc.contents)) {
        const res = tryRedactValidYamlSlice(candidate, isSecretKey, maskToken, 0, flowQuote);
        if (res && res.count > 0) return res;
      }
    } catch {
      // Ignore non-YAML brace expression
    }
    return null;
  };

  while (i < raw.length) {
    if (raw[i] !== "{") {
      out += raw[i];
      i += 1;
      continue;
    }
    // Find matching closing `}` respecting YAML 1.2 flow quoting (never opening quotes mid-word like `team's`)
    let depth = 0;
    let quote: '"' | "'" | null = null;
    let j = i;
    while (j < raw.length) {
      const ch = raw[j]!;
      if (quote) {
        if (quote === '"' && ch === "\\" && j + 1 < raw.length) {
          j += 2;
          continue;
        }
        if (quote === "'" && ch === "'" && raw[j + 1] === "'") {
          j += 2;
          continue;
        }
        if (ch === quote) quote = null;
        j += 1;
        continue;
      }
      if ((ch === '"' || ch === "'") && canStartFlowQuote(raw[j - 1])) {
        quote = ch;
      } else if (ch === "{") {
        depth += 1;
      } else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          j += 1;
          break;
        }
      }
      j += 1;
    }
    if (depth === 0 && j > i + 2) {
      const res = tryFlowCandidate(i, j);
      if (res) {
        out += res.text;
        count += res.count;
        i = j;
        continue;
      }
    } else {
      // Fallback if an unmatched quote inside a plain scalar kept `quote` open: probe closing `}` via YAML parser
      let matchedFallback = false;
      let probe = raw.indexOf("}", i + 2);
      let attempts = 0;
      while (probe !== -1 && attempts < 32) {
        attempts += 1;
        const res = tryFlowCandidate(i, probe + 1);
        if (res) {
          out += res.text;
          count += res.count;
          i = probe + 1;
          matchedFallback = true;
          break;
        }
        probe = raw.indexOf("}", probe + 1);
      }
      if (matchedFallback) continue;
    }
    out += raw[i];
    i += 1;
  }
  return { text: out, count };
}

const SHELL_CMD_LINE_RE =
  /^[ \t]*(?:export\s+|vllm\s+serve\b|python3?\s+-m\b|curl\b|docker\s+run\b|nohup\b|setsid\b|cat\b|tee\b|kubectl\b|helm\b|bash\b|sh\b|echo\b|env\b|sudo\b|#!|[A-Za-z_][A-Za-z0-9_]*=)/;

const HEREDOC_OPENER_RE = /<<-?[ \t]*(?:'([^']+)'|"([^"]+)"|\\?([A-Za-z0-9_-]+))/;

/**
 * Redact YAML 1.2 block, plain, folded, literal, and flow-mapping credentials using `yaml`'s
 * official YAML 1.2 AST parser (both on full YAML documents and on YAML chunks / `{...}` flow
 * objects embedded inside mixed shell scripts), plus a YAML-1.2-compliant line fallback.
 */
export function redactYamlCredentials(
  raw: string,
  isSecretKey: (key: string) => boolean,
  maskToken: string,
  depth = 0,
): RedactCountResult {
  const lines = raw.split("\n");
  const hasTopLevelShell = lines.some((ln) => {
    const clean = ln.endsWith("\r") ? ln.slice(0, -1) : ln;
    return (/^ */.exec(clean)?.[0].length ?? 0) === 0 && SHELL_CMD_LINE_RE.test(clean);
  });

  // 1. Fast path: entire payload is valid YAML 1.2 document(s) without top-level shell commands
  if (!hasTopLevelShell) {
    const whole = tryRedactValidYamlSlice(raw, isSecretKey, maskToken, depth);
    if (whole !== null) {
      const flowInWhole = redactInlineYamlFlowObjects(whole.text, isSecretKey, maskToken);
      return {
        text: flowInWhole.text,
        count: whole.count + flowInWhole.count,
      };
    }
  }

  let totalCount = 0;

  // 2. Mixed shell + YAML: partition contiguous non-shell segments & sub-blocks (e.g. sequence vs mapping without `---`)
  const rebuiltLines: string[] = [];
  let segStart = 0;

  const flushYamlCandidateLines = (segLines: string[]) => {
    if (segLines.length === 0) return;
    const joined = segLines.join("\n");
    const wholeSeg = tryRedactValidYamlSlice(joined, isSecretKey, maskToken, depth);
    if (wholeSeg !== null) {
      totalCount += wholeSeg.count;
      rebuiltLines.push(wholeSeg.text);
      return;
    }
    // Sub-split when top-level sequence `- ...` transitions to top-level mapping `key: ...` (or vice versa) without `---`
    const subChunks: string[][] = [];
    let curKind: "seq" | "map" | null = null;
    for (const ln of segLines) {
      const clean = ln.endsWith("\r") ? ln.slice(0, -1) : ln;
      const trimmed = clean.trim();
      if (trimmed !== "" && !trimmed.startsWith("#") && /^ */.exec(clean)?.[0].length === 0) {
        const lineKind: "seq" | "map" | null = /^-(?:[ \t]|$)/.test(clean)
          ? "seq"
          : /^(?:"[^"]+"|'[^']+'|[A-Za-z0-9_.-]+)[ \t]*:(?:[ \t]|$)/.test(clean)
            ? "map"
            : null;
        if (lineKind !== null && curKind !== null && lineKind !== curKind && subChunks.length > 0) {
          subChunks.push([ln]);
          curKind = lineKind;
          continue;
        }
        if (lineKind !== null) curKind = lineKind;
      }
      if (subChunks.length === 0) subChunks.push([ln]);
      else subChunks[subChunks.length - 1]!.push(ln);
    }
    for (const sub of subChunks) {
      const subText = sub.join("\n");
      const subRes = tryRedactValidYamlSlice(subText, isSecretKey, maskToken, depth);
      if (subRes !== null) {
        totalCount += subRes.count;
        rebuiltLines.push(subRes.text);
      } else {
        rebuiltLines.push(subText);
      }
    }
  };

  for (let i = 0; i < lines.length; i += 1) {
    const clean = lines[i]!.endsWith("\r") ? lines[i]!.slice(0, -1) : lines[i]!;
    if (SHELL_CMD_LINE_RE.test(clean)) {
      flushYamlCandidateLines(lines.slice(segStart, i));
      rebuiltLines.push(lines[i]!);
      const heredocMatch = HEREDOC_OPENER_RE.exec(clean);
      const delim = heredocMatch ? (heredocMatch[1] ?? heredocMatch[2] ?? heredocMatch[3]) : undefined;
      if (delim) {
        let closeIdx = -1;
        for (let k = i + 1; k < lines.length; k += 1) {
          const cand = lines[k]!.endsWith("\r") ? lines[k]!.slice(0, -1) : lines[k]!;
          if (cand.trim() === delim) {
            closeIdx = k;
            break;
          }
        }
        if (closeIdx > i) {
          const bodyLines = lines.slice(i + 1, closeIdx);
          if (bodyLines.length > 0) {
            if (depth >= 256) {
              rebuiltLines.push(`"${maskToken}"`);
              totalCount += 1;
            } else {
              let minIndent = Number.POSITIVE_INFINITY;
              for (const ln of bodyLines) {
                const c = ln.endsWith("\r") ? ln.slice(0, -1) : ln;
                if (c.trim() === "") continue;
                const ind = /^[ \t]*/.exec(c)?.[0].length ?? 0;
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
                    .map((ln) => (ln === "" || ln === "\r" ? ln : `${prefix}${ln}`))
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
  const afterFlow = redactInlineYamlFlowObjects(rebuiltLines.join("\n"), isSecretKey, maskToken);
  totalCount += afterFlow.count;

  // 4. Fallback line-scanner for malformed/partial YAML snippets with unclosed syntax on other lines
  const fallbackLines = afterFlow.text.split("\n");
  const outLines: string[] = [];
  const yamlMapLineRe =
    /^( *)(-[ \t]+)?(?:"((?:\\.|[^"\\])+)"|'((?:\\.|[^'\\])+)'|([A-Za-z0-9_.-]+))([ \t]*:[ \t]*)(.*)$/;
  let idx = 0;
  while (idx < fallbackLines.length) {
    const rawLine = fallbackLines[idx]!;
    const cr = rawLine.endsWith("\r") ? "\r" : "";
    const cleanLine = cr ? rawLine.slice(0, -1) : rawLine;
    const m = yamlMapLineRe.exec(cleanLine);
    if (!m) {
      outLines.push(rawLine);
      idx += 1;
      continue;
    }
    const leadIndent = m[1] ?? "";
    const seqDash = m[2] ?? "";
    const keyName = m[3] ?? m[4] ?? m[5] ?? "";
    const colonSep = m[6] ?? ": ";
    const restRaw = m[7] ?? "";
    const rest = restRaw.trim();
    if (!isSecretKey(keyName) || rest.startsWith('"') || rest.startsWith("'")) {
      outLines.push(rawLine);
      idx += 1;
      continue;
    }
    const restAfterProps = rest.replace(/^(?:(?:&[A-Za-z0-9_-]+|![^\s]+)[ \t]*)+/, "");
    const blockHeaderMatch = /^([|>])([-+\d]*)(?:[ \t]+#.*)?$/.exec(restAfterProps);
    const isBlockHeader = blockHeaderMatch !== null;
    const isEmptyRest = restAfterProps === "" || restAfterProps.startsWith("#");
    const minBlockIndent = leadIndent.length;
    const keyCol = leadIndent.length + seqDash.length;
    const renderedKey = m[3] !== undefined ? `"${m[3]}"` : m[4] !== undefined ? `'${m[4]}'` : keyName;

    if (isBlockHeader) {
      const digitMatch = /[1-9]/.exec(blockHeaderMatch[2] ?? "");
      let blockIndent: number | null = digitMatch ? minBlockIndent + Number(digitMatch[0]) : null;
      let j = idx + 1;
      let lastContentEnd = idx + 1;
      while (j < fallbackLines.length) {
        const nextRaw = fallbackLines[j]!;
        const nextClean = nextRaw.endsWith("\r") ? nextRaw.slice(0, -1) : nextRaw;
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
        outLines.push(`${leadIndent}${seqDash}${renderedKey}${normSep}"${maskToken}"${cr}`);
        totalCount += 1;
        idx = lastContentEnd;
        continue;
      }
    } else if (isEmptyRest) {
      let j = idx + 1;
      let lastContentEnd = idx + 1;
      while (j < fallbackLines.length) {
        const nextRaw = fallbackLines[j]!;
        const nextClean = nextRaw.endsWith("\r") ? nextRaw.slice(0, -1) : nextRaw;
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
        outLines.push(`${leadIndent}${seqDash}${renderedKey}${normSep}"${maskToken}"${cr}`);
        totalCount += 1;
        idx = lastContentEnd;
        continue;
      }
    } else if (!rest.startsWith("[REDACTED") && !rest.startsWith("{") && !rest.startsWith("[")) {
      const inlineCommentMatch = /([ \t]+#.*)$/.exec(restRaw);
      const inlineComment = inlineCommentMatch ? inlineCommentMatch[1] : "";
      let j = idx + 1;
      let lastContentEnd = idx + 1;
      while (j < fallbackLines.length) {
        const nextRaw = fallbackLines[j]!;
        const nextClean = nextRaw.endsWith("\r") ? nextRaw.slice(0, -1) : nextRaw;
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
      const normSep = colonSep.includes(" ") || colonSep.includes("\t") ? colonSep : `${colonSep} `;
      outLines.push(`${leadIndent}${seqDash}${renderedKey}${normSep}"${maskToken}"${inlineComment}${cr}`);
      totalCount += 1;
      idx = lastContentEnd;
      continue;
    }
    outLines.push(rawLine);
    idx += 1;
  }

  return { text: outLines.join("\n"), count: totalCount };
}
