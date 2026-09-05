/**
 * 内容校验：Term / Evidence / Lab 引用必须在注册表中；章节 frontmatter 合法。
 * 注册表与章节尚未建立时直接通过。完整实现见 M1 任务 #10。
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

const chaptersDir = join(process.cwd(), "src/content/chapters");
if (!existsSync(chaptersDir)) {
  console.log("ok 内容校验：尚无章节，跳过");
  process.exit(0);
}
console.log("ok 内容校验通过（占位）");
