/**
 * pnpm wiki:clone --seeds wiki/seeds/vllm-ascend.yaml
 * 按种子里的 repos 浅克隆到 tools/repos/<name> 并 checkout 钉住的 commit。已存在则只校验 HEAD。
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseSeeds } from "./wiki/ingest";

const i = process.argv.indexOf("--seeds");
const seedsPath = process.argv[i + 1];
if (i < 0 || !seedsPath) {
  console.error("用法：pnpm wiki:clone --seeds wiki/seeds/<name>.yaml");
  process.exit(2);
}
const git = (args: string[], cwd?: string) =>
  execFileSync("git", args, { cwd, stdio: ["ignore", "pipe", "inherit"] })
    .toString()
    .trim();
const seeds = parseSeeds(readFileSync(seedsPath, "utf8"));
for (const [name, r] of Object.entries(seeds.repos)) {
  const dir = resolve(process.cwd(), r.path);
  if (!existsSync(dir)) {
    mkdirSync(dirname(dir), { recursive: true });
    console.log(`克隆 ${name} ← ${r.url}（blob:none，只拉提交与目录树，checkout 时按需取文件）`);
    git(["clone", "--filter=blob:none", "--no-checkout", r.url, dir]);
  }
  let head = git(["rev-parse", "HEAD"], dir);
  if (!head.startsWith(r.commit)) {
    console.log(`${name} 切到 ${r.commit}`);
    git(["checkout", "--detach", r.commit], dir);
    head = git(["rev-parse", "HEAD"], dir);
  }
  if (!head.startsWith(r.commit)) {
    console.error(`x ${name} HEAD ${head.slice(0, 8)} ≠ 钉住的 ${r.commit}`);
    process.exit(1);
  }
  console.log(`ok ${name} @ ${head.slice(0, 8)} → ${dir}`);
}
