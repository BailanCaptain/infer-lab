import { runLint } from "./wiki/lint";

const problems = runLint(process.cwd(), { terms: process.argv.includes("--terms") });
for (const p of problems) console.error(`x ${p.file} [${p.rule}] ${p.message}`);
if (problems.length) {
  console.error(`\nwiki:lint 失败：${problems.length} 处`);
  process.exit(1);
}
console.log("ok wiki:lint 通过");
