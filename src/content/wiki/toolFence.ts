/**
 * Pure TypeScript parser & registry for ```wiki-tool fences.
 * Shared between runtime WikiFence (app) and static wiki:lint (scripts) with zero yaml/app imports.
 */

export const KNOWN_WIKI_TOOLS = {
  "deploy-calculator": {
    title: "部署算账台",
    defaultTab: "calculator",
    allowedModes: ["minimal", "full", "quick-screen"] as const,
  },
  "config-doctor": {
    title: "vllm serve 配置体检器",
    defaultTab: "doctor",
    allowedModes: ["minimal", "full"] as const,
  },
  "troubleshoot-workbench": {
    title: "交互式排障工作台",
    defaultTab: "troubleshoot",
    allowedModes: ["logs", "timeline", "full"] as const,
  },
  "aicore-lab": {
    title: "昇腾 AI Core 算子实验室",
    defaultTab: "aicore",
    allowedModes: ["single", "full"] as const,
  },
  "formula-ruler": {
    title: "随文活体算例标尺",
    defaultTab: "calculator",
    allowedModes: [
      "kv-token-bytes",
      "gqa-ratio",
      "mla-compression",
      "tp-shard-comm",
      "moe-ep-dispatch",
      "cold-start-budget",
    ] as const,
  },
  "knob-radar": {
    title: "昇腾调优旋钮雷达",
    defaultTab: "knobs",
    allowedModes: ["minimal", "full"] as const,
  },
} as const;

export type WikiToolId = keyof typeof KNOWN_WIKI_TOOLS;
export type FormulaRulerMode = (typeof KNOWN_WIKI_TOOLS)["formula-ruler"]["allowedModes"][number];

export interface WikiToolSpec {
  tool: WikiToolId;
  mode?: string | undefined;
  title?: string | undefined;
  summary?: string | undefined;
  tab?: string | undefined;
  preset?: string | undefined;
  model?: string | undefined;
}

const ALLOWED_KEYS = new Set(["tool", "mode", "title", "summary", "tab", "preset", "model"]);
const KEY_VALUE_RE = /^([a-z][a-z0-9_-]*)\s*:\s*(.+)$/;

function stripQuotes(raw: string): string {
  const trimmed = raw.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function isKnownWikiToolId(id: string): id is WikiToolId {
  return Object.hasOwn(KNOWN_WIKI_TOOLS, id);
}

export function parseWikiToolFence(
  source: string,
): { ok: true; spec: WikiToolSpec } | { ok: false; errors: string[] } {
  const lines = source.split(/\r?\n/);
  const fields = new Map<string, string>();
  const errors: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line || line.startsWith("#")) continue;
    const match = KEY_VALUE_RE.exec(line);
    if (!match) {
      errors.push(`第 ${i + 1} 行格式非法：「${line}」（应为 key: value）`);
      continue;
    }
    const key = match[1]!;
    const value = stripQuotes(match[2]!);
    if (!ALLOWED_KEYS.has(key)) {
      errors.push(`第 ${i + 1} 行存在未知字段「${key}」`);
      continue;
    }
    if (!value) {
      errors.push(`第 ${i + 1} 行字段「${key}」的值不能为空`);
      continue;
    }
    if (fields.has(key)) {
      errors.push(`第 ${i + 1} 行字段「${key}」重复定义`);
      continue;
    }
    fields.set(key, value);
  }

  if (fields.size === 0 && errors.length === 0) {
    return { ok: false, errors: ["wiki-tool 围栏内容为空，缺少 tool: 字段"] };
  }

  const toolRaw = fields.get("tool");
  if (!toolRaw) {
    errors.push("缺少必需的 tool: 字段");
  } else if (!isKnownWikiToolId(toolRaw)) {
    errors.push(`未知工具「${toolRaw}」（允许：${Object.keys(KNOWN_WIKI_TOOLS).join("、")}）`);
  } else {
    const mode = fields.get("mode");
    const allowed: readonly string[] = KNOWN_WIKI_TOOLS[toolRaw].allowedModes;
    if (mode && !allowed.includes(mode)) {
      errors.push(`工具「${toolRaw}」不支持 mode「${mode}」（允许：${allowed.join("、")}）`);
    }
  }

  if (errors.length > 0 || !toolRaw || !isKnownWikiToolId(toolRaw)) {
    return { ok: false, errors };
  }

  const spec: WikiToolSpec = { tool: toolRaw };
  const mode = fields.get("mode");
  const title = fields.get("title");
  const summary = fields.get("summary");
  const tab = fields.get("tab");
  const preset = fields.get("preset");
  const model = fields.get("model");
  if (mode !== undefined) spec.mode = mode;
  if (title !== undefined) spec.title = title;
  if (summary !== undefined) spec.summary = summary;
  if (tab !== undefined) spec.tab = tab;
  if (preset !== undefined) spec.preset = preset;
  if (model !== undefined) spec.model = model;

  return { ok: true, spec };
}

/**
 * Fence-aware scanner that extracts top-level ```wiki-tool / ~~~wiki-tool blocks from Markdown.
 * Line numbers are 1-based relative to the start of `markdownBody` (pointing at the opening fence line).
 */
export function extractWikiToolFences(markdownBody: string): Array<{ line: number; source: string }> {
  const lines = markdownBody.split(/\r?\n/);
  const blocks: Array<{ line: number; source: string }> = [];
  let fenceChar = "";
  let fenceLen = 0;
  let capturingTool = false;
  let startLine = 0;
  let buffer: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    if (!fenceChar) {
      const open = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(raw);
      if (!open) continue;
      const marker = open[1]!;
      const info = open[2]!.trim();
      if (marker[0] === "`" && info.includes("`")) continue;
      fenceChar = marker[0]!;
      fenceLen = marker.length;
      const lang = info.split(/\s+/)[0] ?? "";
      capturingTool = lang === "wiki-tool";
      startLine = i + 1;
      buffer = [];
      continue;
    }

    const close = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(raw);
    if (close && close[1]![0] === fenceChar && close[1]!.length >= fenceLen) {
      if (capturingTool) {
        blocks.push({ line: startLine, source: buffer.join("\n") });
      }
      fenceChar = "";
      fenceLen = 0;
      capturingTool = false;
      buffer = [];
      continue;
    }

    if (capturingTool) buffer.push(raw);
  }

  if (capturingTool) {
    blocks.push({ line: startLine, source: buffer.join("\n") });
  }

  return blocks;
}
