import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { localDate } from "./ingest";
import { validateIntegration } from "./integration-check";
import { runStagedIntegration } from "./integration-run";
import { PAGE_DIRS } from "./pages";

const DIR_OF_TYPE: Record<string, string> = { param: "params", source: "sources", pr: "sources" };

/**
 * 把已经写好的草稿原样送进审阅：整合那一步不是模型，而是「草稿原样晋升」。
 * 临时副本、越界检查、schema / lint / 来源行号核对、build、待审包都是同一套生产代码，
 * 所以手写的页和 agent 提取的页过的是同一道关，正式库在人批准之前不变。
 *
 * `edits` 是同一份待审包里顺带要改的既有页（相对 wiki/ 的路径 → 改后的全文），
 * 典型用途是给邻居页补一条指向新页的 relations。改写既有页的正文不走这里——那需要
 * 带 revisions 的整合流程留下「改了什么、为什么」。
 */
export async function stageDrafts(
  root: string,
  ids: string[],
  edits: Map<string, string>,
  repoRoots: Record<string, string>,
  validate: (stage: string) => string[] = (stage) => validateIntegration(stage, repoRoots),
) {
  const wiki = join(root, "wiki");
  if (!ids.length) throw new Error("至少指定一个草稿 id");
  for (const id of ids) {
    if (!existsSync(join(wiki, "_drafts", `${id}.md`))) throw new Error(`没有草稿：wiki/_drafts/${id}.md`);
    const existing = PAGE_DIRS.find((dir) => existsSync(join(wiki, dir, `${id}.md`)));
    if (existing) throw new Error(`${existing}/${id}.md 已存在；改写既有页要走带 revisions 的整合流程`);
  }
  for (const file of edits.keys())
    if (!PAGE_DIRS.some((dir) => file.startsWith(`${dir}/`)) || !existsSync(join(wiki, file)))
      throw new Error(`只能顺带修改已存在的正式页（相对 wiki/）：${file}`);

  return runStagedIntegration(
    root,
    {
      id: "_integrate",
      cwd: "",
      args: [],
      stdin: "",
      timeoutMs: 60_000,
      allowedWrites: [...PAGE_DIRS.map((dir) => `${dir}/**`), "_drafts/_integration.json"],
    },
    ids,
    localDate(),
    {
      repoRoots,
      validate,
      runAgent: async (req) => {
        for (const id of ids) {
          const text = readFileSync(join(req.cwd, "_drafts", `${id}.md`), "utf8");
          const type = /^type:\s*(\S+)/m.exec(text)?.[1] ?? "";
          writeFileSync(join(req.cwd, DIR_OF_TYPE[type] ?? "concepts", `${id}.md`), text);
        }
        for (const [file, text] of edits) writeFileSync(join(req.cwd, file), text);
        writeFileSync(
          join(req.cwd, "_drafts/_integration.json"),
          JSON.stringify({ promoted: ids, merged: [], rejected: [], contradictions: [] }),
        );
        return { id: req.id, ok: true, exitCode: 0, stderrTail: "", costUsd: 0 };
      },
    },
  );
}
