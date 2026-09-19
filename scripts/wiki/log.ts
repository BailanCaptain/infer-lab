import { existsSync, readFileSync } from "node:fs";
import { localFile } from "./review-files";
import { atomicText } from "./workflow";

/** Call under the publication lock. Keep the HANDBOOK log contract in one writer. */
export function appendWikiLog(
  root: string,
  action: "ingest" | "build" | "review",
  title: string,
  body: string,
  date = new Date().toISOString().slice(0, 10),
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || /[\r\n]/.test(title)) throw new Error("日志标题无效");
  const path = localFile(root, "wiki/log.md");
  const old = existsSync(path) ? readFileSync(path, "utf8") : "# Wiki log\n";
  atomicText(path, `${old.trimEnd()}\n\n## [${date}] ${action} | ${title}\n\n${body.trim()}\n`);
}
