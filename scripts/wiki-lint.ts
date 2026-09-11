import { runLint } from "./wiki/lint";

/**
 * 只警告不阻塞的规则：报出来、计数，但不让退出码变红。
 *
 * `legacy-format` 曾经在这里——2026-09-11 页面格式改版后，11 页旧格式页等着
 * AC5 重跑，豁免是为了不阻塞与它们无关的工作。当天 AC5 跑完，11 页全部变成
 * 新七节格式，清单归零，豁免随即删除：从此再出现旧格式就是倒退，该报错。
 */
const WARN_ONLY = new Set([
  // 白名单外的来源配低等级证据是合法的，只是值得人审时扫一眼
  "source-unlisted",
  // 迁移期：无类型 related 待重跑成 relations，归零后删掉这条
  "legacy-relations",
  // 标记密度是质量提示不是硬错，人审时看一眼就行
  "mark-flood",
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
