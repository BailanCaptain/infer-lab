import { runBuild } from "./wiki/build";

const r = runBuild(process.cwd());
console.log(`ok wiki:build ${r.pageCount} 页 → wiki/index.md, src/content/wiki/registry.json`);
if (r.problems) {
  console.error(`wiki:build 有 ${r.problems} 个页面未通过解析，已跳过；运行 pnpm wiki:lint 查看`);
  process.exit(1);
}
