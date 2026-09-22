/** Export verified RFork source into immutable materials included in chat snapshots. */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { parseRepoRef } from "../src/content/wiki/schema";
import { sourceLines } from "./wiki/audit";
import { loadPages } from "./wiki/pages";
import { saveRawSnapshot, withRawSources } from "./wiki/raw";

const root = process.cwd();
const wiki = join(root, "wiki");
execFileSync(process.execPath, [join(root, "rfork/verify.mjs")], { stdio: "inherit" });
const manifest = JSON.parse(readFileSync(join(root, "rfork/manifest.json"), "utf8"));
const seeds = parse(readFileSync(join(root, manifest.seedFile), "utf8"));
const pin: string = seeds.repos[manifest.repo].refs[manifest.ref];
const { pages, problems } = loadPages(wiki);
if (problems.some((p) => /concepts\/rfork(?:-|\.)/.test(p.file))) {
  throw new Error("RFork 页面格式不合法，未导出材料");
}
const changes = pages
  // Source review pages have their own mixed-source snapshots; only regenerate mechanism pages.
  .filter((p) => p.file.startsWith("concepts/") && (p.fm.id === "rfork" || p.fm.id.startsWith("rfork-")))
  .map((page) => {
    // Only working-version sources become materials. Community refs and URLs (e.g. the table of
    // which community versions carry which patches) are checked by wiki:audit / wiki:urls instead.
    const own = page.fm.sources.filter((source) => parseRepoRef(source)?.repo === manifest.repo);
    const materials = own.map((source) => {
      const ref = parseRepoRef(source);
      if (!ref || !pin.startsWith(ref.commit)) {
        throw new Error(`来源不是当前 RFork pin：${source}`);
      }
      if (!Object.hasOwn(manifest.sourceFiles, ref.path)) {
        throw new Error(`来源未进入核验过的 RFork 快照：${ref.path}`);
      }
      const code = readFileSync(join(root, "rfork/source", ref.path), "utf8");
      const lines = sourceLines(code).length;
      if ((ref.lineEnd ?? ref.lineStart ?? 1) > lines) throw new Error(`来源行号越界：${source}`);
      const language = ref.path.endsWith(".py") ? "python" : "text";
      return `# RFork 固定版本源码材料\n\n来源：${ref.repo}@${ref.commit}:${ref.path}#L1-L${lines}\n\n本材料从已通过 manifest 哈希核验的 source 快照生成，不独立编辑；行号指代码块中的原文件。\n\n\`\`\`\`${language}\n${code}\n\`\`\`\`\n`;
    });
    return { page, materials: [...new Set(materials)] };
  });
const snapshots = new Set<string>();
for (const { page, materials } of changes) {
  const paths = materials.map((text) => saveRawSnapshot(wiki, text));
  for (const path of paths) snapshots.add(path);
  const file = join(wiki, page.file);
  writeFileSync(file, withRawSources(readFileSync(file, "utf8"), paths), "utf8");
}
console.log(`OK RFork evidence: ${snapshots.size} immutable source files linked to ${changes.length} pages`);
