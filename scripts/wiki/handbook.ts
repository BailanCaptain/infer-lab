/**
 * 把 wiki/HANDBOOK.md 按 H2 切成六片，分别注入不同角色的 agent。
 * 2026-09-25 「人类须知」搬去 HANDOFF-LLM-WIKI.md：HANDBOOK 只留给 agent 的规则，给人看的说明不再占切片。
 * 程序只做索引（切片），不做语义判断；H3 及以下归属当前 H2；前言与未知 H2 丢弃。
 * 思路借自 Multi-Agent packages/api/src/wiki/handbook-slicer.ts。
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const HANDBOOK_H2 = {
  pageFormat: "页面格式",
  extract: "提取",
  integrate: "整合",
  query: "查询",
  coverage: "覆盖判定",
  lint: "Lint",
} as const;
export type HandbookSliceKey = keyof typeof HANDBOOK_H2;

/**
 * 「页面格式」下另切两个 H3，给只读页、不写页的角色：问答拿「读页约定 + 可引来源 + 查询」，
 * 覆盖判定拿「读页约定 + 覆盖判定」。这两节仍留在「页面格式」里，写页的 agent 照样读到——
 * 记号的含义只写一处。2026-09-23 前问答整片拿「页面格式」，约 1.55 万字里大半是写页规则。
 */
export const HANDBOOK_H3 = {
  reading: "读页约定",
  citable: "可引来源",
} as const;
export type HandbookSubsliceKey = keyof typeof HANDBOOK_H3;
export type HandbookSlices = Record<HandbookSliceKey | HandbookSubsliceKey, string>;

export class HandbookSliceMissingError extends Error {
  constructor(readonly key: HandbookSliceKey | HandbookSubsliceKey) {
    super(
      key in HANDBOOK_H3
        ? `HANDBOOK 缺少 H3 切片「${HANDBOOK_H2.pageFormat} › ${HANDBOOK_H3[key as HandbookSubsliceKey]}」（${key}）`
        : `HANDBOOK 缺少 H2 切片「${HANDBOOK_H2[key as HandbookSliceKey]}」（${key}）`,
    );
    this.name = "HandbookSliceMissingError";
  }
}

const H2_TO_KEY = new Map<string, HandbookSliceKey>(
  (Object.entries(HANDBOOK_H2) as [HandbookSliceKey, string][]).map(([k, h]) => [h, k]),
);
const H3_TO_KEY = new Map<string, HandbookSubsliceKey>(
  (Object.entries(HANDBOOK_H3) as [HandbookSubsliceKey, string][]).map(([k, h]) => [h, k]),
);

export function sliceHandbook(content: string): HandbookSlices {
  const slices: HandbookSlices = {
    pageFormat: "",
    extract: "",
    integrate: "",
    query: "",
    coverage: "",
    lint: "",
    reading: "",
    citable: "",
  };
  let current: HandbookSliceKey | null = null;
  let sub: HandbookSubsliceKey | null = null;
  for (const line of content.split(/\r?\n/)) {
    const h2 = /^##\s+(.+?)\s*$/.exec(line);
    if (h2) {
      current = H2_TO_KEY.get((h2[1] ?? "").trim()) ?? null;
      sub = null;
      if (current) slices[current] += `${line}\n`;
      continue;
    }
    const h3 = /^###\s+(.+?)\s*$/.exec(line);
    if (h3) {
      sub = current === "pageFormat" ? (H3_TO_KEY.get((h3[1] ?? "").trim()) ?? null) : null;
      // 写两遍就不再是「只写一处」；拼起来喂给模型会把两份不同的说法当成一条规则
      if (sub && slices[sub]) throw new Error(`HANDBOOK 的「${HANDBOOK_H3[sub]}」出现了不止一次`);
    }
    if (current) slices[current] += `${line}\n`;
    if (sub) slices[sub] += `${line}\n`;
  }
  for (const key of [...Object.keys(HANDBOOK_H2), ...Object.keys(HANDBOOK_H3)] as (keyof HandbookSlices)[]) {
    if (!slices[key].trim()) throw new HandbookSliceMissingError(key);
  }
  return slices;
}

/**
 * 术语叫法表（2026-09-25）：全库同一个东西用同一个叫法，第一次出现时用表里的白话解释。
 * 它单独放在 wiki/TERMS.md，会越加越长、改得勤，和写作规则分开维护；
 * 写页的 agent 没有读文件的工具，只看得到注入的规则，所以拼到「页面格式」末尾一起给它。
 * 问答、覆盖判定只读页不写页，它们的切片不带这张表。
 */
export const TERMS_FILE = "TERMS.md";

function stripMarkdownSection(text: string, level: "##" | "###", heading: string): string {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${level} ${escaped}\\r?\\n[\\s\\S]*?(?=^${level} |$(?![\\s\\S]))`, "m");
  return text.replace(pattern, "");
}

const COMPACT_VISUAL_SPEC_BULLET =
  '   - **2D 纯矢量视觉与配色铁律（Edition-A 暖纸矿物色板）**：自动化 Drop / 纯文本模型严禁输出 `<image href="./wiki-illustrations/...">` 虚构位图，空间剖面与机制图一律用纯矢量 `mode: "native-svg"`（等距/分层多边形几何）或 `layout: "figure"`；主色 `#087f73`/`#c78300`/`#4c65b6`/`#9a4b86`/`#b54237`/`#66716d`/`#fbfaf6`（浅底 `#ddf4ef`/`#fff4cf`/`#e8edff`/`#f5e6f0`/`#fbe5e2`），字号 `>=13.5px`，画布宽 `<=900`，不画外层边框或仪表盘黑条。\n';

export function stripNonAuthoringStandard(
  standard: string,
  options: { keepVisualSpec?: boolean } = {},
): string {
  let out = standard;
  for (const nonAuthoringHeading of ["审查与修订流程", "样板页", "自动检查", "整理依据"]) {
    out = stripMarkdownSection(out, "##", nonAuthoringHeading);
  }
  let replacedVisual = false;
  out = out
    .replace(/^[ \t]*-\s+\*\*层[一二]\s*·[^\r\n]*\r?\n?/gm, () => {
      if (options.keepVisualSpec && !replacedVisual) {
        replacedVisual = true;
        return COMPACT_VISUAL_SPEC_BULLET;
      }
      return "";
    })
    .replace(/^\*\*(?:TP|EP) 直觉图示例：\*\*[^\r\n]*\r?\n?/gm, "");
  if (options.keepVisualSpec && !replacedVisual) {
    out = `${out.trimEnd()}\n\n${COMPACT_VISUAL_SPEC_BULLET}`;
  }
  out = out.replace(/\n{3,}/g, "\n\n");
  return out;
}

const GENERIC_REPO_NAMES = new Set(["pytorch", "docs", "vllm", "vllm-ascend"]);
const GENERIC_FILE_STEMS = new Set(["readme", "_index", "__init__", "index", "pyproject"]);

function citableRowMatchesContext(domainCell: string, contextLower: string): boolean {
  const rawUrl = (domainCell.match(/`([^`]+)`/)?.[1] ?? domainCell).trim().replace(/（精确）$/u, "");
  const segments = rawUrl.replace(/\/+$/, "").split("/").filter(Boolean);
  // Keep general official/community/ecosystem domain prefixes (<= 2 segments) unconditionally;
  // filter long single-file/article pins (> 2 segments) unless referenced by the current task context.
  if (segments.length <= 2) return true;
  const candidates = new Set<string>([rawUrl.toLowerCase()]);
  const host = segments[0]!.toLowerCase().replace(/^www\./, "");
  if (host === "github.com") {
    const orgRepo = `${segments[1]}/${segments[2]}`.toLowerCase();
    candidates.add(orgRepo);
    const repo = segments[2]!.toLowerCase();
    if (repo.length >= 4 && !GENERIC_REPO_NAMES.has(repo)) candidates.add(repo);
    const stem = segments
      .at(-1)!
      .replace(/\.[a-z0-9]+$/i, "")
      .toLowerCase();
    if (stem.length >= 5 && !GENERIC_FILE_STEMS.has(stem)) candidates.add(stem);
  } else {
    candidates.add(host);
    for (const seg of segments.slice(1)) {
      const clean = seg.replace(/\.[a-z0-9]+$/i, "").toLowerCase();
      if (clean.length >= 5 && !/^\d+$/.test(clean) && !/^v\d/.test(clean)) candidates.add(clean);
    }
  }
  return [...candidates].some((token) => token && contextLower.includes(token));
}

export function filterCitableDomainsInFormat(pageFormat: string, termsContext: string): string {
  const contextLower = termsContext.toLowerCase();
  const pattern = /^### 可引来源\r?\n[\s\S]*?(?=^### |^## |$(?![\s\S]))/m;
  return pageFormat.replace(pattern, (section) =>
    section
      .split("\n")
      .filter((line) => {
        if (!line.startsWith("|") || /^\|\s*(域名|---)/.test(line)) return true;
        const cells = line.split("|").map((cell) => cell.trim());
        return citableRowMatchesContext(cells[1] ?? "", contextLower);
      })
      .join("\n"),
  );
}

export function loadHandbook(wikiRoot: string, termsContext?: string, textOnly = false): HandbookSlices {
  const slices = sliceHandbook(readFileSync(join(wikiRoot, "HANDBOOK.md"), "utf8"));
  // Tool-free text writers/revisers cannot emit diagram YAML or alter toc.ts structure. Their geometry
  // authoring guide, human/CLI audit appendices, and unrelated single-file URL pins are trimmed while
  // retaining 100% of evidence, source, citation, version, revision, and writing rules.
  if (textOnly) {
    slices.pageFormat = stripMarkdownSection(slices.pageFormat, "###", "图");
    slices.pageFormat = stripMarkdownSection(slices.pageFormat, "###", "目录的章法、章号、阅读顺序");
    if (termsContext !== undefined) {
      slices.pageFormat = filterCitableDomainsInFormat(slices.pageFormat, termsContext);
    }
    slices.pageFormat +=
      "\n本次只输出页面 Markdown 正文（修订现有页时保留既有图围栏、公式及自动生成区）；不要生成或改写独立图规格文件。\n";
  }
  // Writers have no file tools, and integration copies contain only wiki/. Resolve
  // the canonical standard beside the code so every writing path receives it.
  let standard = readFileSync(new URL("../../docs/wiki-writing-standard.md", import.meta.url), "utf8");
  if (textOnly) {
    standard = stripNonAuthoringStandard(standard);
  }
  slices.pageFormat += `\n以下是正式写作标准全文；适用范围按标准执行，与手册摘要冲突时以此为准。\n${standard}`;
  const terms = join(wikiRoot, TERMS_FILE);
  if (existsSync(terms)) {
    const text = readFileSync(terms, "utf8");
    const context = termsContext?.toLowerCase();
    const selected =
      context === undefined
        ? text
        : text
            .split("\n")
            .filter((line) => {
              if (!line.startsWith("|") || /^\|\s*(统一叫法|---)/.test(line)) return true;
              const cells = line.split("|").map((cell) => cell.trim());
              return [cells[1], cells[2], cells[4]].some((cell) =>
                cell
                  ?.split(/[、,，;；（）()]/)
                  .some((name) => name.trim() && context.includes(name.trim().toLowerCase())),
              );
            })
            .join("\n");
    slices.pageFormat += `\n${selected}`;
  }
  return slices;
}
