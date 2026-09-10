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

export const pageFrontmatterSchema = z.object({
  id: idField,
  title: z.string().min(1),
  type: z.enum(PAGE_TYPES),
  summary: z.string().min(1).max(200, "summary 是一句话，不超过 200 字"),
  aliases: z.array(z.string().min(1)).default([]),
  chapters: z.array(z.string().regex(/^\d{2}$/)).default([]),
  /** 读这页前该先懂什么，其它页的 id */
  prerequisites: z.array(idField).default([]),
  sources: z
    .array(z.string().refine(isSourceRef, "sources 每项必须是 repo@commit:path#L起-L止 或 https URL"))
    .min(1, "sources 不得为空"),
  evidence: z.enum(EVIDENCE_LEVELS),
  related: z.array(idField).default([]),
  contradicts: z.array(z.string()).default([]),
  updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "updated 必须是 YYYY-MM-DD"),
});
export type PageFrontmatter = z.infer<typeof pageFrontmatterSchema>;

export const registryEntrySchema = pageFrontmatterSchema.extend({
  /** 相对 wiki/ 的 posix 路径，如 concepts/kv-cache.md */
  file: z.string(),
});
export type RegistryEntry = z.infer<typeof registryEntrySchema>;

export const registrySchema = z.object({
  version: z.literal(1),
  pages: z.array(registryEntrySchema),
});
export type Registry = z.infer<typeof registrySchema>;
