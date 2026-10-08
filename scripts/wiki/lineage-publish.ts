import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runBuild } from "./build";
import { appendWikiLog } from "./log";
import { loadPages } from "./pages";
import { localFile } from "./review-files";
import { atomicText, WorkflowStore } from "./workflow";

export async function publishLineage(
  root: string,
  updates: { path: string; before: string; after: string }[],
) {
  return new WorkflowStore(root).locked(() => {
    for (const update of updates) {
      if (!/^wiki\/(?:params|_drafts)\/[a-z0-9][a-z0-9-]*\.md$/.test(update.path))
        throw new Error("非法谱系更新路径");
      if (readFileSync(localFile(root, update.path), "utf8") !== update.before)
        throw new Error(`谱系计算期间页面发生变化：${update.path}，整批未覆盖`);
    }
    if (loadPages(join(root, "wiki")).problems.length) throw new Error("正式页面解析失败，未更新谱系");
    for (const update of updates) atomicText(localFile(root, update.path), update.after);
    if (updates.some((u) => u.path.startsWith("wiki/params/")) && runBuild(root).problems)
      throw new Error("谱系派生失败");
    if (updates.length)
      appendWikiLog(root, "build", "版本谱系刷新", `确定性更新 ${updates.length} 页；教学正文保留。`);
    return updates.length;
  });
}
