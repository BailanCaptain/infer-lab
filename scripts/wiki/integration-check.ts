import { join } from "node:path";
import { auditPage } from "./audit";
import { createBlobReader } from "./git";
import { runLint, splitProblems } from "./lint";
import { loadPages } from "./pages";
import { readPageRaw, readRawSnapshot } from "./raw";

export function validateIntegration(root: string, repoRoots: Record<string, string>): string[] {
  const { errors } = splitProblems(runLint(root, { terms: false, repoRoots }));
  const wiki = join(root, "wiki");
  const deps = {
    repoRoots,
    readBlob: createBlobReader(),
    readRaw: (id: string, paths?: string[]) => readPageRaw(wiki, id, paths),
    readSnapshot: (path: string) => readRawSnapshot(wiki, path),
  };
  return [
    ...errors.map((p) => `${p.file} [${p.rule}] ${p.message}`),
    ...loadPages(wiki)
      .pages.flatMap((page) => auditPage(page, deps))
      .filter((a) => a.verdict !== "ok" && a.verdict !== "url")
      .map((a) => `${a.file} [${a.verdict}] ${a.ref}`),
  ];
}
