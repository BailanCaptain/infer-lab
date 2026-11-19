import { join } from "node:path";
import { auditPage, warmPageSources } from "./audit";
import { auditDiagram } from "./diagram-audit";
import { loadDiagrams } from "./diagrams";
import { createBlobReader } from "./git";
import { runLint, splitProblems } from "./lint";
import { loadPages } from "./pages";
import { readPageRaw, readRawSnapshot } from "./raw";

export interface ValidateIntegrationOptions {
  /** 静态插画目录（默认 `<root>/public`）；staging 校验可直接指回主仓 `public/` 或使用镜像目录 */
  publicRoot?: string;
  /** 本次新增/修改的页面路径（相对 `wiki/` 或含 `wiki/` 前缀）；提供时未改动存量页的未克隆外部仓降级为非阻塞警告 */
  touchedPages?: readonly string[];
  /** 本次新增/修改的图 id 集合 */
  touchedDiagrams?: readonly string[];
  /** 本次修改的旧页在改前已有的源码引用，用于在未克隆上游仓时只允许保留旧引用而仍拦截新编造引用 */
  preservedRefs?: ReadonlyMap<string, ReadonlySet<string>>;
}

export function validateIntegrationDetailed(
  root: string,
  repoRoots: Record<string, string>,
  options: ValidateIntegrationOptions = {},
): { errors: string[]; warnings: string[] } {
  const { errors } = splitProblems(
    runLint(root, { terms: false, repoRoots, publicRoot: options.publicRoot }),
  );
  const wiki = join(root, "wiki");
  const { diagrams } = loadDiagrams(wiki);
  const readBlob = createBlobReader();
  const baseDeps = {
    repoRoots,
    readBlob,
    diagrams,
    readRaw: (id: string, paths?: string[]) => readPageRaw(wiki, id, paths),
    readSnapshot: (path: string) => readRawSnapshot(wiki, path),
  };
  const { pages } = loadPages(wiki);
  warmPageSources(pages, repoRoots, diagrams);

  const touchedSet = options.touchedPages
    ? new Set(options.touchedPages.map((p) => p.replace(/^wiki\//, "")))
    : undefined;
  const touchedDiagramSet = options.touchedDiagrams ? new Set(options.touchedDiagrams) : undefined;
  const normalizedPreserved = options.preservedRefs
    ? new Map([...options.preservedRefs].map(([k, v]) => [k.replace(/^wiki\//, ""), v]))
    : undefined;

  const warnings: string[] = [];
  const seenWarnings = new Set<string>();
  const addWarning = (msg: string) => {
    if (seenWarnings.has(msg)) return;
    seenWarnings.add(msg);
    warnings.push(msg);
  };

  const seenDiagramProblems = new Set<string>();
  const diagramErrors: string[] = [];
  const pageErrors: string[] = [];

  for (const page of pages) {
    const isUnchanged = touchedSet !== undefined && !touchedSet.has(page.file);
    const preservedForPage = normalizedPreserved?.get(page.file);

    const dProblems = auditDiagram(page, {
      ...baseDeps,
      allowUnclonedRepos: isUnchanged,
      touchedDiagrams: touchedDiagramSet,
      onUnclonedWarning: addWarning,
    }).filter((p) => p.rule !== "diagram-missing");
    for (const p of dProblems) {
      const key = `${p.file}\0${p.rule}\0${p.message}`;
      if (seenDiagramProblems.has(key)) continue;
      seenDiagramProblems.add(key);
      diagramErrors.push(`${p.file} [${p.rule}] ${p.message}`);
    }

    const audits = auditPage(page, {
      ...baseDeps,
      allowUnclonedRepos: isUnchanged || Boolean(preservedForPage?.size),
    });
    for (const a of audits) {
      if (a.verdict === "ok" || a.verdict === "url") continue;
      if (a.verdict === "uncloned-repo") {
        if (isUnchanged || preservedForPage?.has(a.ref)) {
          addWarning(`${a.file} [uncloned-repo] ${a.ref}`);
          continue;
        }
      }
      pageErrors.push(`${a.file} [${a.verdict}] ${a.ref}`);
    }
  }

  return {
    errors: [...errors.map((p) => `${p.file} [${p.rule}] ${p.message}`), ...diagramErrors, ...pageErrors],
    warnings,
  };
}

export function validateIntegration(
  root: string,
  repoRoots: Record<string, string>,
  options: ValidateIntegrationOptions = {},
): string[] {
  return validateIntegrationDetailed(root, repoRoots, options).errors;
}
