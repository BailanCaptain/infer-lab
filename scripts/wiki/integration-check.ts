import { join } from "node:path";
import { auditPage, warmPageSources } from "./audit";
import { auditDiagrams } from "./diagram-audit";
import { loadDiagrams } from "./diagrams";
import { createBlobReader } from "./git";
import { runLint, splitProblems } from "./lint";
import { loadPages } from "./pages";
import { readPageRaw, readRawSnapshot } from "./raw";

export function validateIntegration(root: string, repoRoots: Record<string, string>): string[] {
  const { errors } = splitProblems(runLint(root, { terms: false, repoRoots }));
  const wiki = join(root, "wiki");
  const { diagrams } = loadDiagrams(wiki);
  const deps = {
    repoRoots,
    readBlob: createBlobReader(),
    diagrams,
    readRaw: (id: string, paths?: string[]) => readPageRaw(wiki, id, paths),
    readSnapshot: (path: string) => readRawSnapshot(wiki, path),
  };
  const { pages } = loadPages(wiki);
  warmPageSources(pages, repoRoots, diagrams);
  const diagramErrors = auditDiagrams(pages, deps).filter((p) => p.rule !== "diagram-missing");
  return [
    ...errors.map((p) => `${p.file} [${p.rule}] ${p.message}`),
    ...diagramErrors.map((p) => `${p.file} [${p.rule}] ${p.message}`),
    ...pages
      .flatMap((page) => auditPage(page, deps))
      .filter((a) => a.verdict !== "ok" && a.verdict !== "url")
      .map((a) => `${a.file} [${a.verdict}] ${a.ref}`),
  ];
}
