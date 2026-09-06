/**
 * 内容校验：wiki registry 结构合法；章节出现后再校验 Term / Evidence / Lab 引用（PLAN M1 任务 10）。
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { registrySchema } from "../src/content/wiki/schema";

const registryPath = join(process.cwd(), "src/content/wiki/registry.json");
if (existsSync(registryPath)) {
  const r = registrySchema.safeParse(JSON.parse(readFileSync(registryPath, "utf8")));
  if (!r.success) {
    console.error(`x registry.json 不合法：${r.error.issues[0]?.message}`);
    process.exit(1);
  }
  console.log(`ok 内容校验：registry ${r.data.pages.length} 页`);
}
const chaptersDir = join(process.cwd(), "src/content/chapters");
if (!existsSync(chaptersDir)) {
  console.log("ok 内容校验：尚无章节，Term 引用检查跳过");
  process.exit(0);
}
console.log("ok 内容校验通过（占位）");
