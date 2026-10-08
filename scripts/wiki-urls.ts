/**
 * pnpm wiki:urls [--out <file>]
 *
 * 把全库页面里的站外链接（sources 里的 URL + 正文里的站外链接）真的请求一遍。
 * 404 / 410 判成死链、退出码 1；403 / 5xx / 超时只列为「这次没验证到」，不算失败。
 * 同一件事每晚的 `wiki:sync` 也会做（共享配置里 `checkUrls: true`），结果写进巡检报告。
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadPages } from "./wiki/pages";
import { checkUrls, collectUrls, httpFetcher } from "./wiki/urls";

const argv = process.argv.slice(2);
const out = argv.includes("--out") ? argv[argv.indexOf("--out") + 1] : undefined;
const { pages } = loadPages(join(process.cwd(), "wiki"));
const urls = collectUrls(pages);
const results = await checkUrls(urls, httpFetcher());
const dead = results.filter((r) => r.verdict === "dead");
const unknown = results.filter((r) => r.verdict === "unknown");
const lines = [
  `站外链接 ${results.length} 条：可达 ${results.length - dead.length - unknown.length}，死链 ${dead.length}，这次没验证到 ${unknown.length}`,
  ...dead.map((r) => `x ${r.url}（${r.detail}）← ${r.files.join("、")}`),
  ...unknown.map((r) => `? ${r.url}（${r.detail}）← ${r.files.join("、")}`),
];
if (out) writeFileSync(out, `${lines.join("\n")}\n`);
console.log(out ? lines[0] : lines.join("\n"));
if (dead.length) process.exitCode = 1;
