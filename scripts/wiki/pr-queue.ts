import { existsSync, readFileSync } from "node:fs";
import type { CorpusRecord } from "./corpus";
import { parseSeeds } from "./ingest";
import { enqueueInLock, listTasks } from "./queue";
import { localFile } from "./review-files";
import { atomicText, digest, WorkflowStore } from "./workflow";

export async function queueImportantPr(
  root: string,
  pr: CorpusRecord,
  seedsPath = "wiki/seeds/vllm-ascend.yaml",
) {
  if (pr.kind !== "pr" || pr.unavailable) return undefined;
  const path = localFile(root, seedsPath);
  const entries = existsSync(path)
    ? parseSeeds(readFileSync(path, "utf8")).features.flatMap((f) => f.entry)
    : [];
  const important = pr.files.some(
    (p) =>
      entries.some((entry) => entry === p || (entry.endsWith("/") && p.startsWith(entry))) ||
      /^vllm_ascend\/(?:.*\/)?(?:[A-Za-z0-9_]*_)?config(?:uration)?[^/]*\.py$/.test(p) ||
      p.startsWith("vllm_ascend/config/"),
  );
  return important
    ? new WorkflowStore(root).locked(() => {
        const sourceHash = digest(JSON.stringify(pr));
        for (const old of listTasks(root)) {
          if (
            old.input.kind !== "pr" ||
            old.input.repo !== pr.repo ||
            old.input.number !== pr.number ||
            old.input.sourceHash === sourceHash ||
            !["queued", "failed", "needs-material"].includes(old.state)
          )
            continue;
          old.state = "closed";
          old.result = {
            ...old.result,
            closureBasis: "superseded-source",
            supersededBySourceHash: sourceHash,
          };
          atomicText(localFile(root, `wiki/_jobs/queue/${old.id}.json`), JSON.stringify(old, null, 2));
        }
        return enqueueInLock(root, {
          kind: "pr",
          repo: pr.repo,
          number: pr.number,
          sourceHash,
        });
      })
    : undefined;
}
