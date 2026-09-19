/**
 * 可引来源的分级白名单。
 *
 * 「能读什么」与「能引什么」是两回事：读得广理解才准，所以 agent 的联网不设限；
 * 而引用是「你可以去核对」的承诺，必须限。此前把限制加在「能读」上是错的——
 * 既挡住了昇腾官方文档，又没解决真问题。
 *
 * 分级依据（2026-09-11 调研，三路取证）：
 *   1. 项目 README 导航栏自列的官方资源（`README.md:19`）
 *   2. 官方文档的外链统计：github 2902、docs.vllm.ai 209、modelscope 97、
 *      huggingface 31、gitcode 30、hiascend 25、modelers 11
 *   3. 源码注释的外链：gitee 33（全是 `ascend/*`）、gitcode 13（`Ascend|cann/*`）
 *
 * 关键发现：`gitee.com/ascend/*` 与 `gitcode.com/Ascend|cann/*` **不是镜像站**，
 * 是昇腾自己的一手仓库（ATB 算子库、msmodelslim、ops-transformer）。
 *
 * 这份表与 `wiki/HANDBOOK.md`「可引来源」一节必须逐条一致，有测试锁住。
 */

import { parseRawRef, parseRepoRef } from "../../src/content/wiki/schema";

export type SourceKind = "repo" | "raw" | "official" | "paper" | "ecosystem" | "community" | "unlisted";

export interface CitableDomain {
  domain: string;
  /** 限定组织时给出路径前缀，如 github.com 只认 vllm-project */
  prefix?: string;
  kind: Exclude<SourceKind, "repo" | "raw" | "unlisted">;
}

export const CITABLE_DOMAINS: CitableDomain[] = [
  { domain: "docs.vllm.ai", kind: "official" },
  { domain: "www.hiascend.com", kind: "official" },
  { domain: "blog.vllm.ai", kind: "official" },
  { domain: "discuss.vllm.ai", kind: "community" },
  { domain: "github.com", prefix: "/vllm-project/", kind: "official" },
  { domain: "gitee.com", prefix: "/ascend/", kind: "official" },
  { domain: "gitcode.com", prefix: "/Ascend/", kind: "official" },
  { domain: "gitcode.com", prefix: "/cann/", kind: "official" },
  { domain: "arxiv.org", kind: "paper" },
  { domain: "pytorch.org", kind: "ecosystem" },
  { domain: "triton-lang.org", kind: "ecosystem" },
  { domain: "huggingface.co", kind: "ecosystem" },
  { domain: "modelscope.cn", kind: "ecosystem" },
  { domain: "modelers.cn", kind: "ecosystem" },
];

/** 把一条 `sources` 归类。仓库引用与三档 URL 之外一律 `unlisted`。 */
export function classifySource(ref: string): SourceKind {
  if (parseRawRef(ref)) return "raw";
  if (parseRepoRef(ref)) return "repo";
  if (!/^https?:\/\//i.test(ref)) return "unlisted";
  let url: URL;
  try {
    url = new URL(ref);
  } catch {
    return "unlisted";
  }
  // 用 host 全等而不是后缀匹配：`arxiv.org.evil.com` 不能蒙混过关
  const host = url.hostname.toLowerCase();
  if (
    host === "github.com" &&
    /^\/vllm-project\/[^/]+\/(?:issues|pull|discussions)(?:\/|$)/.test(url.pathname)
  )
    return "community";
  for (const d of CITABLE_DOMAINS) {
    if (host !== d.domain) continue;
    if (d.prefix && !url.pathname.startsWith(d.prefix)) continue;
    return d.kind;
  }
  return "unlisted";
}

/** `evidence: S` 需要一手来源撑着；生态站（PyTorch、HF 等）撑不起。 */
export function supportsOfficialEvidence(kind: SourceKind): boolean {
  return kind === "official" || kind === "paper";
}

const ROW_RE = /^\|\s*`([^`]+)`\s*\|\s*([^|]*?)\s*\|\s*(官方|论文|生态|社区)\s*\|/;

/**
 * 从 HANDBOOK 的「可引来源」表里解析域名清单，用于与代码常量比对。
 * 表格形状：`| \`域名[路径前缀]\` | 说明 | 官方/论文/生态 |`
 */
export function handbookDomains(markdown: string): CitableDomain[] {
  const kindOf: Record<string, CitableDomain["kind"]> = {
    官方: "official",
    论文: "paper",
    生态: "ecosystem",
    社区: "community",
  };
  const out: CitableDomain[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const m = ROW_RE.exec(line.trim());
    if (!m) continue;
    const [, spec, , kindText] = m;
    const kind = kindOf[kindText ?? ""];
    if (!spec || !kind) continue;
    const slash = spec.indexOf("/");
    out.push(
      slash < 0 ? { domain: spec, kind } : { domain: spec.slice(0, slash), prefix: spec.slice(slash), kind },
    );
  }
  return out;
}
