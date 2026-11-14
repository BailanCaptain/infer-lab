/**
 * 主章节直接使用知识库正文，主题目录与文件必须一一对应。
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { registrySchema } from "../src/content/wiki/schema";
import { buildToc } from "../src/content/wiki/toc";

const registryPath = join(process.cwd(), "src/content/wiki/registry.json");
if (existsSync(registryPath)) {
  const r = registrySchema.safeParse(JSON.parse(readFileSync(registryPath, "utf8")));
  if (!r.success) {
    console.error(`x registry.json 不合法：${r.error.issues[0]?.message}`);
    process.exit(1);
  }
  console.log(`ok 内容校验：registry ${r.data.pages.length} 页`);
  const toc = buildToc(r.data.pages);
  const ordered = toc.flatMap((part) => part.sections.flatMap((section) => section.pages));
  if (
    ordered.length !== r.data.pages.length ||
    new Set(ordered.map((page) => page.id)).size !== ordered.length
  ) {
    throw new Error("主题目录必须完整收录各篇正文，且每页只出现一次");
  }
  for (const page of ordered) {
    if (!existsSync(join(process.cwd(), "wiki", page.file))) {
      throw new Error(`主章节正文不存在：${page.file}`);
    }
  }
  console.log(`ok 主章节：${toc.length} 个主题，${ordered.length} 篇正文完整且无重复`);
} else {
  throw new Error("缺少知识库 registry，请先运行 pnpm wiki:build");
}
