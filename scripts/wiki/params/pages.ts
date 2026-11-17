import matter from "gray-matter";
import {
  PARAM_SECTION,
  type PinnedParamIdentity,
  parsePinnedParamIdentity,
  protectedParamSection,
} from "../../../src/content/wiki/param-display";
import { ID_RE, type ParamEntry, paramEntrySchema } from "../../../src/content/wiki/schema";
import { gitText } from "../git";
import { replaceSection } from "../lineage";
import { configuredRepoRoots, isGitRepoRoot } from "../repo-roots";
import { sanitizeRawInput } from "../sanitize";
import { digest } from "../workflow";
import { scanSources } from "./scan";

export {
  PARAM_SECTION,
  type PinnedParamIdentity,
  parsePinnedParamIdentity,
  protectedParamSection,
} from "../../../src/content/wiki/param-display";

export const paramId = (row: ParamEntry) =>
  `${row.name.toLowerCase().replace(/_/g, "-")}-${digest(`${row.file}:${row.class}:${row.json_path}`).slice(0, 12)}`;
const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ");

export function isCompatibleParamJsonPath(
  pinnedJsonPath: string,
  entry: Pick<ParamEntry, "class" | "json_path">,
): boolean {
  if (pinnedJsonPath === entry.json_path) return true;
  if (!entry.class) return false;
  if (entry.json_path.startsWith("additional_config[")) {
    const suffix = entry.json_path.slice("additional_config".length);
    if (pinnedJsonPath === `${entry.class}${suffix}`) return true;
  }
  if (pinnedJsonPath.startsWith(`${entry.class}[`)) {
    const suffix = pinnedJsonPath.slice(entry.class.length);
    if (entry.json_path === `additional_config${suffix}`) return true;
  }
  return false;
}

const scannedBlobCache = new Map<string, ParamEntry[]>();

function scanPinnedGitBlob(repoDir: string, commit: string, file: string): ParamEntry[] | undefined {
  const key = `${repoDir}\0${commit}\0${file}`;
  const cached = scannedBlobCache.get(key);
  if (cached) return cached;
  try {
    const entries = scanSources({ [file]: gitText(repoDir, ["show", `${commit}:${file}`]) });
    scannedBlobCache.set(key, entries);
    return entries;
  } catch {
    return undefined;
  }
}

export function resolveConfiguredRepoDir(root: string, repo: string): string | undefined {
  try {
    const configured = configuredRepoRoots(root)[repo];
    return configured && isGitRepoRoot(configured) ? configured : undefined;
  } catch {
    return undefined;
  }
}

export function recoverPinnedGitEntry(
  repoDir: string | undefined,
  sources: unknown,
  pinned: PinnedParamIdentity,
): { status: "matched"; entry: ParamEntry } | { status: "not_found_in_blob" } | { status: "unavailable" } {
  if (!repoDir || !pinned.definition) return { status: "unavailable" };
  const list = Array.isArray(sources) ? sources : [];
  const source = list[pinned.definition.citationIndex - 1];
  const ref = typeof source === "string" && /^[^@]+@([a-f0-9]{7,40}):([^#]+)#L(\d+)(?:-L\d+)?$/.exec(source);
  if (!ref || ref[2] !== pinned.definition.file || Number(ref[3]) !== pinned.definition.line) {
    return { status: "not_found_in_blob" };
  }
  const entries = scanPinnedGitBlob(repoDir, ref[1]!, ref[2]!);
  if (!entries) return { status: "unavailable" };
  const matches = entries.filter((e) => e.line === pinned.definition!.line && e.name === pinned.name);
  if (matches.length === 1) return { status: "matched", entry: matches[0]! };
  return { status: "not_found_in_blob" };
}

export function matchesConfirmedParamDefinition(
  context: {
    repo: string;
    commit?: string;
    repoDir?: string;
    sources: unknown;
    pinned: PinnedParamIdentity;
  },
  entry: ParamEntry,
): boolean {
  const { repo, commit, repoDir, sources, pinned } = context;
  if (pinned.name !== entry.name || !pinned.definition || pinned.definition.file !== entry.file) {
    return false;
  }
  const sourceList = Array.isArray(sources) ? sources : [];
  const cited = sourceList[pinned.definition.citationIndex - 1];
  const ref = typeof cited === "string" && /^([^@]+)@([a-f0-9]{7,40}):([^#]+)#L(\d+)(?:-L\d+)?$/.exec(cited);
  if (!ref || ref[1] !== repo || ref[3] !== entry.file || Number(ref[4]) !== pinned.definition.line) {
    return false;
  }
  if (commit && pinned.commit && pinned.commit === commit && pinned.definition.line !== entry.line) {
    return false;
  }
  if (pinned.kind === "field_identity") {
    return pinned.className === entry.class;
  }
  if (!pinned.jsonPath) return false;
  if (pinned.hasExplicitClass) {
    return pinned.className === entry.class && isCompatibleParamJsonPath(pinned.jsonPath, entry);
  }
  if (!isCompatibleParamJsonPath(pinned.jsonPath, entry)) {
    return false;
  }
  const recovered = recoverPinnedGitEntry(repoDir, sources, pinned);
  if (recovered.status === "matched") {
    return (
      recovered.entry.file === entry.file &&
      recovered.entry.class === entry.class &&
      (isCompatibleParamJsonPath(recovered.entry.json_path, entry) ||
        isCompatibleParamJsonPath(pinned.jsonPath, entry))
    );
  }
  if (recovered.status === "not_found_in_blob") {
    return entry.class === "" && pinned.jsonPath === entry.json_path;
  }
  return Boolean(commit && pinned.commit === commit && pinned.definition.line === entry.line);
}

function isConfirmedExistingPage(
  previous: string | undefined,
  old: matter.GrayMatterFile<string> | undefined,
  input: { repo: string; commit: string; pageId?: string; repoDir?: string },
  entry: ParamEntry,
): boolean {
  const { pageId, commit, repo } = input;
  if (!previous || !old || !pageId || old.data.id !== pageId || old.data.type !== "param") return false;
  if (!protectedParamSection(previous)) return old.data.title === entry.name;
  const pinned = parsePinnedParamIdentity(previous);
  if (!pinned) return false;
  const repoDir = input.repoDir ?? resolveConfiguredRepoDir(process.cwd(), repo);
  return matchesConfirmedParamDefinition({ repo, commit, repoDir, sources: old.data.sources, pinned }, entry);
}

export function buildParamPage(
  input: {
    repo: string;
    ref: string;
    commit: string;
    entry: ParamEntry;
    date: string;
    pageId?: string;
    repoDir?: string;
  },
  previous?: string,
) {
  const p = paramEntrySchema.parse(input.entry);
  const old = previous ? matter(previous) : undefined;
  if (
    p.review?.verdict === "not-param" ||
    (p.confidence === "suspect" &&
      p.review?.verdict !== "param" &&
      !isConfirmedExistingPage(previous, old, input, p))
  )
    throw new Error("疑似项尚未确认，先复核再生成骨架");
  if (!/^[a-f0-9]{40}$/.test(input.commit)) throw new Error("骨架需要完整 commit SHA");
  for (const text of [p.name, p.type, p.default, p.class, p.json_path, p.file, p.comment, ...p.constraints]) {
    if (!text.trim()) continue;
    const screened = sanitizeRawInput(text);
    if (screened.blocked || screened.text !== text) throw new Error("参数定义清洗阻塞，保留原扫描记录待复核");
  }
  const id = input.pageId ?? paramId(p);
  if (!ID_RE.test(id)) throw new Error("参数页 id 无效");
  if (old && old.data.id !== id) throw new Error("现有页面 id 不匹配，拒绝覆盖");
  const source = `${input.repo}@${input.commit}:${p.file}#L${p.line}`;
  const sources = [...new Set([...(old?.data.sources ?? []), source])];
  const priorSection = previous ? protectedParamSection(previous) : undefined;
  const priorPinned = previous ? parsePinnedParamIdentity(previous) : undefined;
  const preserveSameSnapshotLegacySection = Boolean(
    priorSection && !/^\| 所属类 \|/m.test(priorSection) && priorPinned?.commit === input.commit,
  );
  const section = [
    PARAM_SECTION,
    "",
    "> 此节由参数扫描结果生成；静态定义不保证运行时最终值。",
    "",
    "| 项 | 静态记录 |",
    "| --- | --- |",
    ...(p.confidence === "suspect" && p.form === "field"
      ? [`| 字段身份（不代表用户输入入口） | \`${cell(p.class)}.${cell(p.name)}\` |`]
      : [
          `| 标识 | \`${cell(p.json_path)}\` |`,
          ...(p.class && !preserveSameSnapshotLegacySection ? [`| 所属类 | \`${cell(p.class)}\` |`] : []),
        ]),
    `| 类型 | \`${cell(p.type)}\` |`,
    `| 默认表达式 | \`${cell(p.default)}\` |`,
    `| 定义 | \`${cell(p.file)}:${p.line}\` [C${sources.indexOf(source) + 1}] |`,
    `| 版本 | ${cell(input.ref)} · ${input.commit} |`,
    "",
    "字段注释：",
    "",
    cell(p.comment) || "源码未提供字段注释。",
    "",
    "约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：",
    "",
    ...p.constraints.flatMap((constraint) => ["````python", constraint, "````", ""]),
  ]
    .join("\n")
    .trimEnd();
  const body = old
    ? replaceSection(old.content, PARAM_SECTION, section)
    : `## 一句话\n\n骨架，待补：${p.name} 的静态参数定义。\n\n${section}\n\n## 事实表\n\n静态事实见上方自动生成区；行为与版本差异待核对。\n\n## 为什么存在\n\n骨架，待补：为什么存在。\n\n## 开了的代价\n\n骨架，待补：开了的代价与互斥关系。\n`;
  return matter.stringify(body, {
    ...(old?.data ?? {
      id,
      title: p.name,
      type: "param",
      summary: `${p.name} 的静态定义，正文待补。`,
      origin: "seed",
      evidence: "C",
      updated: input.date,
    }),
    sources,
  });
}
