import { runLint, splitProblems } from "./wiki/lint";

const problems = runLint(process.cwd(), { terms: process.argv.includes("--terms") });
const { errors, warnings } = splitProblems(problems);

for (const p of errors) console.error(`x ${p.file} [${p.rule}] ${p.message}`);
if (warnings.length) {
  console.warn(`! 待留意 ${warnings.length} 处（不阻塞）：`);
  for (const p of warnings) console.warn(`  ${p.file} [${p.rule}] ${p.message}`);
}
if (errors.length) {
  console.error(`
wiki:lint 失败：${errors.length} 处`);
  process.exit(1);
}
console.log(`ok wiki:lint 通过${warnings.length ? `（另有 ${warnings.length} 处待留意）` : ""}`);
