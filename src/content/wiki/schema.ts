/**
 * wiki 页面 frontmatter 的 schema。脚本（wiki-build / wiki-lint / wiki-ingest）与前端读取器共用。
 * 字段含义见 wiki/HANDBOOK.md「页面格式」，那里是人读的真相源，这里是机器读的。
 */
import { z } from "zod";

export const PAGE_TYPES = ["concept", "feature", "param", "source", "pr"] as const;
export type PageType = (typeof PAGE_TYPES)[number];

/** 证据等级，沿用 PLAN.md §1.4 七档 */
export const EVIDENCE_LEVELS = ["S", "C", "D", "A", "I", "M", "!"] as const;
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];

export const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** repo@commit:path#L起-L止（行号可省略） */
export const REPO_REF_RE = /^([a-z0-9][a-z0-9-]*)@([0-9a-f]{7,40}):([^\s#]+)(?:#L(\d+)(?:-L(\d+))?)?$/;
export const URL_RE = /^https?:\/\/\S+$/;

export function isSourceRef(s: string): boolean {
  return REPO_REF_RE.test(s) || URL_RE.test(s);
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
  id: idField,
  title: z.string().min(1),
  type: z.enum(PAGE_TYPES),
  summary: z.string().min(1).max(200, "summary 是一句话，不超过 200 字"),
  aliases: z.array(z.string().min(1)).default([]),
  chapters: z.array(z.string().regex(/^\d{2}$/)).default([]),
  /** @deprecated 已并入 relations 的 builds-on；只为读旧页保留 */
  prerequisites: z.array(idField).default([]),
  sources: z
    .array(z.string().refine(isSourceRef, "sources 每项必须是 repo@commit:path#L起-L止 或 https URL"))
    .min(1, "sources 不得为空"),
  evidence: z.enum(EVIDENCE_LEVELS),
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
