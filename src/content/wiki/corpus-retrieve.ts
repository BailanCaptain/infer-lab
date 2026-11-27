/** Stable traceback fragments only. A lexical match is never evidence that a fix applies. */
export interface CorpusDocument {
  id: string;
  title: string;
  url: string;
  text: string;
  unavailable?: boolean;
}
const PRESERVED_CODE_PATTERNS: readonly RegExp[] = [
  /\b(?:retCode|errCode|error_code)\s*=\s*0x[0-9a-fA-F]{1,8}\b/gi,
  /\b(?:error\s*code(?:\s+is)?|errno|exit\s*code|exitcode|returncode)\s*[=:]?\s*-?\d+\b/gi,
  /\b(?:107\d{3}|161\d{3}|207\d{3}|307\d{3}|507\d{3})\b/g,
];

function normalizeErrorMessage(rawMessage: string): string {
  const preserved: string[] = [];
  let text = rawMessage;
  for (const re of PRESERVED_CODE_PATTERNS) {
    text = text.replace(re, (m) => {
      const idx = preserved.length;
      preserved.push(m.replace(/\s+/g, " ").toLowerCase());
      return `__ERRCODE_${idx}__`;
    });
  }
  text = text
    .replace(/\b0x[0-9a-f]+\b/gi, "<address>")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\d+\b/g, "<n>");
  return text.replace(/__ERRCODE_(\d+)__/g, (_, i) => preserved[Number(i)] ?? "");
}

export function errorFragments(text: string) {
  const withoutLocations = text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/File\s+["'][^"']+["'],?\s*line\s+\d+[^\n]*/g, "")
    .replace(/(?:[A-Za-z]:)?[/\\][\w./\\-]+\.py(?::\d+)?/g, "");
  return [
    ...new Set(
      withoutLocations.split(/\r?\n/).flatMap((line) => {
        const match =
          /\b([A-Za-z_][\w.]*(?:Error|Exception|Fault))\s*:\s*(.{6,})/.exec(line) ??
          /\b((?:EI|EJ|EH|EZ|EL)\d{4})\s*:\s*(.{6,})/i.exec(line);
        if (!match) return [];
        const head = /^[A-Za-z]{2}\d{4}$/.test(match[1]!) ? match[1]!.toUpperCase() : match[1]!;
        const message = normalizeErrorMessage(match[2]!);
        return [`${head}: ${message}`];
      }),
    ),
  ];
}
export function retrieveCorpus(query: string, documents: CorpusDocument[], limit: number) {
  const fragments = errorFragments(query);
  if (!fragments.length) return [];
  return documents
    .filter((d) => !d.unavailable)
    .flatMap((d) => {
      const actual = errorFragments(d.text);
      const matched = fragments.filter((f) => actual.some((a) => a === f));
      return matched.length
        ? [
            {
              id: d.id,
              title: d.title,
              summary: matched.join("\n"),
              evidence: "I",
              score: 1100 + matched.length,
              how: "corpus-exact" as const,
              url: d.url,
              excerpt: matched.join("\n"),
              qualification: "报错文本匹配，修复适用性尚未确认",
            },
          ]
        : [];
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, limit);
}
