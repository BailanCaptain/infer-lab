/**
 * pnpm wiki:stage --ids a,b[,c] [--touch concepts/x.md,concepts/y.md]
 *
 * 把**已经写好**的草稿（`wiki/_drafts/<id>.md`）原样送进审阅，不调用任何模型、不花钱。
 * 用在「agent 或人直接读源码写好了页，只差走审批」的场景。没有它，手写的页只能绕过审阅
 * 直接放进 concepts/——2026-09-19 那 24 页就是这么进去的，不该再发生。
 *
 * 产出的是待审包，正式库不变；之后照常 `pnpm wiki:review show|approve|reject <revision>`，
 * 或在阅读页右侧面板的「审阅」页签里处理。
 *
 * `--touch`：同一份待审包里顺带要改的既有页。先在工作区里把它们改好（例如给邻居页补一条
 * relations），这里列出相对 wiki/ 的路径。命令成功后这些文件会回到已提交的样子——改动只
 * 存在于待审包里，批准才落地；命令失败则保留你的改动。
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { configuredRepoRoots } from "./wiki/repo-roots";
import { stageDrafts } from "./wiki/stage";

const list = (text: string | undefined) =>
  (text ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const { values } = parseArgs({
  options: { ids: { type: "string" }, touch: { type: "string" }, help: { type: "boolean" } },
});
const root = process.cwd();
const edits = new Map<string, string>();
let staged = false;
try {
  if (values.help || !values.ids) {
    console.log(
      "wiki:stage --ids a,b [--touch concepts/x.md,…]：把 wiki/_drafts/ 里写好的草稿原样送审，不调用模型。产出待审包，正式库不变。",
    );
    if (!values.help) process.exitCode = 1;
  } else {
    for (const file of list(values.touch)) {
      const edited = readFileSync(join(root, "wiki", file), "utf8");
      const committed = execFileSync("git", ["-C", root, "show", `HEAD:wiki/${file}`], { encoding: "utf8" });
      if (edited === committed) throw new Error(`${file} 相对已提交版本没有改动，不需要 --touch`);
      edits.set(file, edited);
    }
    // 待审包的「改前」取自工作区，所以建包期间既有页要是已提交的样子
    for (const file of edits.keys())
      writeFileSync(
        join(root, "wiki", file),
        execFileSync("git", ["-C", root, "show", `HEAD:wiki/${file}`], { encoding: "utf8" }),
      );
    const result = await stageDrafts(root, list(values.ids), edits, configuredRepoRoots(root));
    staged = true;
    console.log(
      JSON.stringify({ reviewId: result.reviewId, pageCount: result.pageCount, costUsd: 0 }, null, 2),
    );
    console.log(`\n待审包已生成。查看：pnpm wiki:review show ${result.reviewId}`);
  }
} catch (error) {
  console.error(String(error));
  process.exitCode = 1;
} finally {
  // 没建成包就把顺带的改动放回工作区，不能让人白改
  if (!staged) for (const [file, text] of edits) writeFileSync(join(root, "wiki", file), text);
}
