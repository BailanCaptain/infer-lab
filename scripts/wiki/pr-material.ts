import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CorpusRecord } from "./corpus";
import { gitText } from "./git";
import { parseSeeds } from "./ingest";
import { localFile } from "./review-files";

export function prMaterial(root: string, record: CorpusRecord, selected?: string[]) {
  const seedsPath = localFile(root, "wiki/seeds/vllm-ascend.yaml");
  const seeds = existsSync(seedsPath) ? parseSeeds(readFileSync(seedsPath, "utf8")) : undefined;
  const repo = seeds?.repos[record.repo.split("/")[1]!];
  let patches = record.patches;
  let basis = "GitHub API 当前差异；未在本地核对合并提交，不能声称这就是已发布改动。";
  if (record.merged && record.mergeCommit && repo) {
    const dir = resolve(root, repo.path);
    try {
      gitText(dir, ["rev-parse", "--verify", `${record.mergeCommit}^{commit}`]);
      const parent = gitText(dir, ["rev-parse", "--verify", `${record.mergeCommit}^1`]).trim();
      const files = gitText(dir, ["diff", "--name-only", parent, record.mergeCommit, "--"])
        .split(/\r?\n/)
        .filter(Boolean);
      patches = files.map((file) => ({
        file,
        status: "git-diff",
        patch: gitText(dir, [
          "diff",
          "--no-ext-diff",
          "--no-textconv",
          "--unified=3",
          parent,
          record.mergeCommit!,
          "--",
          file,
        ]),
      }));
      basis = `钉定提交 ${parent} → ${record.mergeCommit} 的 Git diff（第一父提交差异）。`;
    } catch {
      basis = "本地不能读取完整合并提交差异；以下保留 API 当前差异，修复与发布范围尚未验证。";
    }
  }
  const entries = seeds?.features.flatMap((f) => f.entry) ?? [];
  const important = patches.filter(
    (p) =>
      /config/.test(p.file) ||
      entries.some((entry) => p.file === entry || (entry.endsWith("/") && p.file.startsWith(entry))),
  );
  const chosen = selected
    ? patches.filter((p) => selected.includes(p.file))
    : (important.length ? important : patches).slice(0, 5);
  if (selected && (!selected.length || selected.length > 5 || chosen.length !== new Set(selected).size))
    throw new Error("PR --file 必须选择 1–5 个实际变动文件");
  const omitted = patches.filter((p) => !chosen.includes(p)).map((p) => p.file);
  return [
    `# ${record.title}`,
    `来源：${record.url}`,
    `合并提交：${record.mergeCommit ?? (record.merged ? "已合并，提交尚未取得" : "未合并")}`,
    `差异依据：${basis}`,
    `所选文件：${chosen.map((p) => p.file).join("、")}`,
    `未提供差异正文的文件：${omitted.join("、") || "无"}。不得将所选片段当作全 PR 或完整运行时行为。`,
    "",
    record.body,
    ...chosen.flatMap((p) => [
      "",
      `变更片段：${p.file} (${p.status})`,
      p.patch ?? "API 未提供 patch，不能从文件名猜改动内容。",
    ]),
    ...record.comments.flatMap((c) => ["", `评论：${c.url}`, c.body]),
  ].join("\n");
}
