/**
 * 参数页展示名纯函数派生（浏览器与构建/服务端共用，零 Node 依赖）。
 * 仅从受保护的 `## 参数定义（自动生成）` 节提取已确认参数身份；无确认身份时原样保留 frontmatter `title`。
 */

export const PARAM_SECTION = "## 参数定义（自动生成）";

const IDENT_TOKEN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export interface PinnedParamIdentity {
  kind: "json_path" | "field_identity";
  raw: string;
  name: string;
  jsonPath?: string;
  className?: string;
  hasExplicitClass?: boolean;
  commit?: string;
  definition?: {
    file: string;
    line: number;
    citationIndex: number;
  };
}

/** 精确截取指定 H2 小节字节范围，忽略围栏代码块内的同名标题示例；供 lineage 与参数保护共用。 */
export function generatedSection(text: string, heading: string): string | undefined {
  let fence = "";
  let start: number | undefined;
  let offset = 0;
  for (const line of text.split(/(?<=\n)/)) {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length) fence = "";
    } else if (marker) {
      fence = marker;
    } else if (/^##\s/.test(line)) {
      if (start !== undefined) return text.slice(start, offset).trimEnd();
      if (line.trimEnd() === heading) start = offset;
    }
    offset += line.length;
  }
  return start === undefined ? undefined : text.slice(start).trimEnd();
}

export const protectedParamSection = (text: string): string | undefined =>
  generatedSection(text, PARAM_SECTION);

function leafNameFromJsonPath(jsonPath: string): string | undefined {
  const bracket = /\[\s*["']([A-Za-z_][A-Za-z0-9_]*)["']\s*\]\s*$/.exec(jsonPath);
  if (bracket?.[1]) return bracket[1];
  const dotted = /(?:^|\.)([A-Za-z_][A-Za-z0-9_]*)$/.exec(jsonPath.trim());
  return dotted?.[1];
}

function classRootFromJsonPath(jsonPath: string): string | undefined {
  return /^([A-Z][A-Za-z0-9_]*)\[\s*["'][A-Za-z_][A-Za-z0-9_]*["']\s*\]/.exec(jsonPath)?.[1];
}

/** 与 scripts/wiki/params/pages.ts 的受保护身份解析语义保持严格等价。 */
export function parsePinnedParamIdentity(text: string): PinnedParamIdentity | undefined {
  const section = protectedParamSection(text);
  if (!section) return undefined;
  const citation = /^\| 定义 \| `([^`]+):(\d+)` \[C(\d+)\] \|$/m.exec(section);
  const definition = citation
    ? { file: citation[1]!, line: Number(citation[2]), citationIndex: Number(citation[3]) }
    : undefined;
  const commit = /^\| 版本 \| .+ · ([a-f0-9]{7,40}) \|$/m.exec(section)?.[1];
  const classRow = /^\| 所属类 \| `([^`]+)` \|$/m.exec(section)?.[1];
  const fieldRow = /^\| 字段身份（不代表用户输入入口） \| `([^`]+)` \|$/m.exec(section);
  if (fieldRow?.[1]) {
    const raw = fieldRow[1];
    const dot = raw.lastIndexOf(".");
    const className = dot >= 0 ? raw.slice(0, dot) : "";
    const name = dot >= 0 ? raw.slice(dot + 1) : raw;
    if (!IDENT_TOKEN.test(name)) return undefined;
    if (classRow !== undefined && classRow !== className) return undefined;
    return {
      kind: "field_identity",
      raw,
      name,
      className,
      hasExplicitClass: true,
      ...(commit ? { commit } : {}),
      ...(definition ? { definition } : {}),
    };
  }
  const pathRow = /^\| 标识 \| `([^`]+)` \|$/m.exec(section);
  if (pathRow?.[1]) {
    const raw = pathRow[1];
    const name = leafNameFromJsonPath(raw);
    if (!name) return undefined;
    const rootedClass = classRootFromJsonPath(raw);
    if (classRow !== undefined && rootedClass !== undefined && classRow !== rootedClass) return undefined;
    const className = classRow ?? rootedClass;
    return {
      kind: "json_path",
      raw,
      name,
      jsonPath: raw,
      ...(className !== undefined ? { className, hasExplicitClass: true } : {}),
      ...(commit ? { commit } : {}),
      ...(definition ? { definition } : {}),
    };
  }
  return undefined;
}

/**
 * 统一派生参数展示名：
 * - `field_identity`：展示显式类字段身份（如 `KVPPConfig.size`），绝不伪装成用户输入路径；
 * - `json_path` 且至少含两级键：展示 `parent.leaf`（如 `ascend_compilation_config.enable_super_kernel`）；
 * - 其余（顶层单键、手写参数页、非参数页或身份未确认）：原样保留 `title`。
 */
export function deriveParamDisplayTitle(
  page: { readonly type: string; readonly title: string },
  rawOrBodyText: string,
): string {
  if (page.type !== "param") return page.title;
  const identity = parsePinnedParamIdentity(rawOrBodyText);
  if (identity?.kind === "field_identity") return identity.raw;
  if (identity?.kind === "json_path") {
    const parts = [...identity.raw.matchAll(/\[\s*["']([A-Za-z_][A-Za-z0-9_]*)["']\s*\]/g)].map((m) => m[1]!);
    if (parts.length >= 2) return parts.slice(-2).join(".");
  }
  return page.title;
}

export function pageDisplayTitle(entry: {
  readonly title: string;
  readonly displayTitle?: string | undefined;
}): string {
  return entry.displayTitle ?? entry.title;
}
