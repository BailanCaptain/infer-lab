import { runLint } from "./wiki/lint";

/**
 * 只警告不阻塞的规则：报出来、计数，但不让退出码变红。
 *
 * `legacy-format` 标的是 2026-09-11 页面格式改版前产出的页。它们要 AC5 重跑才会
 * 变成新格式，在那之前既不该被静默放过（否则迁移会被忘掉），也不该阻塞与它无关
 * 的工作。等 AC5 跑完这份清单应该归零，届时删掉这个豁免。
 */
const WARN_ONLY = new Set([
  "legacy-format",
  // 白名单外的来源配低等级证据是合法的，只是值得人审时扫一眼
  "source-unlisted",
]);

const problems = runLint(process.cwd(), { terms: process.argv.includes("--terms") });
const errors = problems.filter((p) => !WARN_ONLY.has(p.rule));
const warnings = problems.filter((p) => WARN_ONLY.has(p.rule));

for (const p of errors) console.error(`x ${p.file} [${p.rule}] ${p.message}`);
if (warnings.length) {
  console.warn(`! 待留意 ${warnings.length} 处（不阻塞）：`);
  for (const p of warnings) console.warn(`  ${p.file} [${p.rule}] ${p.message}`);
}
if (errors.length) {
  console.error(`\nwiki:lint 失败：${errors.length} 处`);
  process.exit(1);
}
console.log(`ok wiki:lint 通过${warnings.length ? `（另有 ${warnings.length} 处待留意）` : ""}`);
