/**
 * wiki 页面 frontmatter 的 schema。脚本（wiki-build / wiki-lint / wiki-ingest）与前端读取器共用。
 * 字段含义见 wiki/HANDBOOK.md「页面格式」，那里是人读的真相源，这里是机器读的。
 */
import { z } from "zod";

/** Static discoveries are not runtime guarantees; suspect rows require explicit review. */
export const paramEntrySchema = z.object({
  name: z.string().min(1),
  type: z.string(),
  default: z.string(),
  class: z.string(),
  json_path: z.string(),
  file: z.string(),
  line: z.number().int().positive(),
  comment: z.string(),
  constraints: z.array(z.string()),
  confidence: z.enum(["certain", "suspect"]),
  form: z.enum(["field", "dict-key", "string-lookup"]),
  /** 前几处出现位置（审阅线索）；全库一共出现几次看 occurrenceCount。2026-09-23 前的旧记录是全量清单、没有总数 */
  occurrences: z.array(z.object({ file: z.string(), line: z.number().int().positive() })).optional(),
  occurrenceCount: z.number().int().nonnegative().optional(),
  review: z
    .object({ verdict: z.enum(["param", "not-param", "undetermined"]), reason: z.string().min(1) })
    .optional(),
});
export type ParamEntry = z.infer<typeof paramEntrySchema>;

export const PAGE_TYPES = ["concept", "feature", "param", "source", "pr"] as const;
/**
 * 页面的生产入口。direct = agent 直接撰写、没有 raw 快照（rawSources）的页：如实标注，不事后补 raw
 *（用户 2026-10-03 决定）。direct 与 rawSources 互斥，由 wiki:lint 的 origin-direct-raw 检查。
 */
export const PAGE_ORIGINS = ["seed", "drop", "chat", "pr", "gap", "direct"] as const;
export type PageType = (typeof PAGE_TYPES)[number];

/** 证据等级，沿用 PLAN.md §1.4 七档 */
export const EVIDENCE_LEVELS = ["S", "C", "D", "A", "I", "M", "!"] as const;
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];

export const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** repo@commit:path#L起-L止（行号可省略） */
export const REPO_REF_RE = /^([a-z0-9][a-z0-9-]*)@([0-9a-f]{7,40}):([^\s#]+)(?:#L(\d+)(?:-L(\d+))?)?$/;
export const URL_RE = /^https?:\/\/\S+$/;
/** Engine-owned immutable excerpt files, relative to wiki/. */
export const RAW_SNAPSHOT_RE = /^raw\/sha256-([a-f0-9]{64})\.md$/;

export interface RawRef {
  path: string;
  lineStart: number;
  lineEnd: number;
}

/** Only content-addressed wiki files, never arbitrary local paths. */
export function parseRawRef(ref: string): RawRef | null {
  const match = /^raw:([^#]+)#L([1-9]\d*)(?:-L([1-9]\d*))?$/.exec(ref);
  if (!match || !RAW_SNAPSHOT_RE.test(`raw/${match[1]}`)) return null;
  const lineStart = Number(match[2]);
  const lineEnd = Number(match[3] ?? match[2]);
  if (!Number.isSafeInteger(lineStart) || !Number.isSafeInteger(lineEnd) || lineEnd < lineStart) return null;
  return { path: `raw/${match[1]}`, lineStart, lineEnd };
}

export function rawSourceHref(ref: string): string | null {
  const parsed = parseRawRef(ref);
  return parsed ? `/api/wiki/raw?ref=${encodeURIComponent(ref)}#L${parsed.lineStart}` : null;
}

export function isSourceRef(s: string): boolean {
  return REPO_REF_RE.test(s) || URL_RE.test(s) || parseRawRef(s) !== null;
}

export interface RepoRef {
  repo: string;
  commit: string;
  path: string;
  lineStart?: number;
  lineEnd?: number;
}

export function parseRepoRef(ref: string): RepoRef | null {
  const m = REPO_REF_RE.exec(ref);
  if (!m) return null;
  const out: RepoRef = { repo: m[1] ?? "", commit: m[2] ?? "", path: m[3] ?? "" };
  if (m[4] !== undefined) out.lineStart = Number(m[4]);
  if (m[5] !== undefined) out.lineEnd = Number(m[5]);
  return out;
}

const idField = z.string().regex(ID_RE, "id 必须是 kebab-case");
export const tocPlacementSchema = z
  .object({
    part: z.enum([
      "guide",
      "models",
      "inference",
      "architecture",
      "hardware",
      "distributed",
      "performance",
      "serving",
      "rfork",
      "params",
      "references",
    ]),
    section: z.string().trim().min(1).max(80),
  })
  .strict();

/**
 * 页与页之间的边有类型、有方向。
 *
 * 旧的 `related: [id]` 只说「有关」，说不出是哪种关。2026-09-11 实测问
 * 「什么是 Block Table」，agent 读一页就回答了——因为 `related` 里那十个
 * 光秃秃的 id 既没告诉它该去哪一页、也没告诉它去了之后怎么把两页接起来。
 * 无类型的边撑不起「把知识点串起来」。
 *
 * 只存一个方向，反向边由 wiki:build 派生：谁依赖谁，由**依赖方**声明。
 * 这样既不用两边各写一次，也不会再出现单边 related 的不对称问题。
 */
export const RELATION_KINDS = ["builds-on", "variant-of", "conflicts-with", "alternative-to"] as const;
export type RelationKind = (typeof RELATION_KINDS)[number];

/** 有向边的反向名。对称边（互斥、替代）的反向是它自己。 */
export const INVERSE_KIND: Record<RelationKind, string> = {
  "builds-on": "enables",
  "variant-of": "has-variant",
  "conflicts-with": "conflicts-with",
  "alternative-to": "alternative-to",
};

export const SYMMETRIC_KINDS: readonly RelationKind[] = ["conflicts-with", "alternative-to"];

/** 对称边两头等价：反向名就是自己，所以只需要存一条 */
export function isSymmetric(kind: string): boolean {
  return (SYMMETRIC_KINDS as readonly string[]).includes(kind);
}

export const relationSchema = z.object({
  to: idField,
  kind: z.enum(RELATION_KINDS),
  /** 半句话说清这条边是什么关系；它同时是「接着看」里给读者的理由 */
  note: z.string().min(1, "relations 每条都要写 note，说清这是哪种关系"),
});
export type Relation = z.infer<typeof relationSchema>;

export const pageFrontmatterSchema = z.object({
  toc: tocPlacementSchema.optional(),
  id: idField,
  title: z.string().min(1),
  type: z.enum(PAGE_TYPES),
  origin: z.enum(PAGE_ORIGINS).default("seed"),
  summary: z.string().min(1).max(200, "summary 是一句话，不超过 200 字"),
  aliases: z.array(z.string().min(1)).default([]),
  chapters: z.array(z.string().regex(/^\d{2}$/)).default([]),
  /**
   * 同一章里的阅读顺序，小的排前面。不写就是 500，落在写了顺序的页中间。
   *
   * 为什么需要：目录原本按 registry 顺序列，等于按文件名排——「vLLM 的形状」
   * 这种入门页会排在「NPUPlatform」后面，读者第一眼看不出从哪进。章号只说
   * 「这页属于哪个主题」，不说「先读哪一页」，这两件事得分开记。
   */
  order: z.number().int().min(1).max(999).default(500),
  /** @deprecated 已并入 relations 的 builds-on；只为读旧页保留 */
  prerequisites: z.array(idField).default([]),
  sources: z
    .array(
      z
        .string()
        .refine(
          isSourceRef,
          "sources 每项必须是 repo@commit:path#L起-L止、HTTP(S) URL 或带行号的 raw 快照引用",
        ),
    )
    .min(1, "sources 不得为空"),
  /**
   * 这页已经对过哪几个版本（seeds 里 vllm-ascend 的 ref 名）。页头照它显示版本标记。
   *
   * 2026-09-21 起 v0.23 与 v0.26 长期并存。没有这个字段，读者分不清一页是「在 v0.26 上也成立」
   * 还是「还没人对过 v0.26」。记进来的条件：有人对着该版本的源码核过，差异已写进正文
   * （`pnpm wiki:versions` 先筛出所引源码变了的条目，看完用 `--mark` 记）。
   */
  verified: z.array(z.string().min(1)).default([]),
  evidence: z.enum(EVIDENCE_LEVELS),
  rawSources: z.array(z.string().regex(RAW_SNAPSHOT_RE)).min(1).optional(),
  /** 有类型、有方向的边。新页用这个。 */
  relations: z.array(relationSchema).default([]),
  /** @deprecated 旧的无类型边；重跑后归零，届时删掉 */
  related: z.array(idField).default([]),
  contradicts: z.array(z.string()).default([]),
  updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "updated 必须是 YYYY-MM-DD"),
});
export type PageFrontmatter = z.infer<typeof pageFrontmatterSchema>;

/** 派生的反向边：不写在页面里，由 wiki:build 从对方页的 relations 算出来 */
export const backlinkSchema = z.object({
  from: idField,
  /** 反向关系名，见 INVERSE_KIND */
  kind: z.string(),
  note: z.string(),
});
export type Backlink = z.infer<typeof backlinkSchema>;

export const registryEntrySchema = pageFrontmatterSchema.extend({
  /** 相对 wiki/ 的 posix 路径，如 concepts/kv-cache.md */
  file: z.string(),
  /** 谁声明了指向本页的边。回答问题时「谁建在它之上」就靠它。 */
  backlinks: z.array(backlinkSchema).default([]),
});
export type RegistryEntry = z.infer<typeof registryEntrySchema>;

export const registrySchema = z.object({
  version: z.literal(1),
  pages: z.array(registryEntrySchema),
});
export type Registry = z.infer<typeof registrySchema>;

/**
 * 读者快照里被跳过的坏页：id 取自文件名，供路由给出「暂不可用」；reason 只给写手看（console），不上页面。
 */
export const skippedPageSchema = z.object({ id: z.string(), file: z.string(), reason: z.string() });
export type SkippedPage = z.infer<typeof skippedPageSchema>;

/** The build and local API deliver the same complete reader payload. */
export const readerSnapshotSchema = z
  .object({
    revision: z.string().regex(/^[a-f0-9]{64}$/),
    registry: registrySchema,
    pageTexts: z.array(z.object({ file: z.string(), text: z.string() })),
    /** 正文 ```wiki-diagram 围栏引用的图，渲染层直接内联这段 SVG */
    diagrams: z.array(z.object({ id: z.string().regex(ID_RE), svg: z.string().min(1) })).default([]),
    /** 不合法、没进快照的页；其余页照常显示 */
    skipped: z.array(skippedPageSchema).default([]),
  })
  .superRefine(({ registry, pageTexts }, ctx) => {
    const paths = new Set(pageTexts.map((p) => p.file));
    const pages = registry.pages;
    if (
      paths.size !== pageTexts.length ||
      pages.length !== pageTexts.length ||
      new Set(pages.map((p) => p.id)).size !== pages.length ||
      new Set(pages.map((p) => p.file)).size !== pages.length ||
      pages.some((p) => !paths.has(p.file))
    )
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "知识库快照目录与正文不完整或重复" });
  });
export type ReaderSnapshot = z.infer<typeof readerSnapshotSchema>;
