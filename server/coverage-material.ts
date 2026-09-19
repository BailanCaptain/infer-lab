import { join } from "node:path";
import { z } from "zod";
import { parsePage } from "../scripts/wiki/pages";
import { prepareRawInput } from "../scripts/wiki/prepare-input";
import { sanitizeRawInput } from "../scripts/wiki/sanitize";
import { digest } from "../scripts/wiki/workflow";
import type { KnowledgeSnapshot } from "./snapshot";

/** Offline review packet limits, not limits for a paid model request. Never silently truncate evidence. */
export const COVERAGE_MATERIAL_LIMITS = { maxSources: 3, maxPages: 12, maxChars: 160_000 } as const;
const optionsSchema = z
  .object({
    sources: z.array(z.string().min(1)).min(1).max(COVERAGE_MATERIAL_LIMITS.maxSources),
    pages: z.array(z.string().min(1)).max(COVERAGE_MATERIAL_LIMITS.maxPages).optional(),
  })
  .strict();
export type CoverageMaterialOptions = z.infer<typeof optionsSchema>;

/** Caller holds the knowledge/workflow lock. This prepares evidence for review, not for compilation. */
export function prepareCoverageMaterial(
  root: string,
  snapshot: KnowledgeSnapshot,
  requiredPageIds: string[],
  input: CoverageMaterialOptions,
) {
  const options = optionsSchema.parse(input);
  const ids = [...new Set([...requiredPageIds, ...(options.pages ?? [])])].sort();
  if (ids.length > COVERAGE_MATERIAL_LIMITS.maxPages) throw new Error("补料核对页面超过上限");
  const screen = (text: string) => {
    const result = sanitizeRawInput(text);
    if (result.blocked)
      throw new Error(`补料核对清洗阻塞：${result.findings.map((f) => f.reason).join("、")}`);
    return result;
  };
  const sources = [...new Set(options.sources)].sort().map((source) => {
    const prepared = prepareRawInput(join(root, "wiki"), source);
    if (prepared.receipt.blocked || !prepared.compilerData) throw new Error("补料来源清洗阻塞");
    return {
      screening: prepared.receipt,
      content: JSON.parse(prepared.compilerData) as {
        source: string;
        lines: { line: number; text: string }[];
      },
    };
  });
  const pages = ids.map((id) => {
    const entry = snapshot.registry.pages.find((p) => p.id === id);
    if (!entry) throw new Error(`补料核对页面不存在：${id}`);
    const original = snapshot.pageTexts.find((p) => p.file === entry.file)!.text;
    const parsed = parsePage(entry.file, original).page;
    if (!parsed) throw new Error("补料核对正文解析失败");
    const cleaned = screen(parsed.body);
    return {
      id,
      file: entry.file,
      originalHash: digest(original),
      text: cleaned.text,
      bodyTruncated: false as const,
      screening: { version: cleaned.version, findings: cleaned.findings, cleanHash: digest(cleaned.text) },
    };
  });
  const inventory = [...snapshot.registry.pages]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((p) => ({
      id: p.id,
      file: p.file,
      title: screen(p.title).text,
      summary: screen(p.summary).text,
    }));
  const content = {
    knowledgeRevision: snapshot.revision,
    sources,
    pages,
    inventory,
    // An inventory is a navigation aid, not evidence that the other bodies were reviewed.
    unprovidedPageIds: inventory.filter((p) => !ids.includes(p.id)).map((p) => p.id),
  };
  const serialized = JSON.stringify(content);
  if (serialized.length > COVERAGE_MATERIAL_LIMITS.maxChars)
    throw new Error("补料核对材料超过上限，不截断证据");
  return {
    ...content,
    contentHash: digest(serialized),
    status: "needs-evidence-review" as const,
    upstreamVerification: "not-performed" as const,
    semanticCoverage: "unverified" as const,
  };
}
