import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { paramEntrySchema } from "../../../src/content/wiki/schema";
import { gitText } from "../git";

export function scanSources(files: Record<string, string>, python = process.env.WIKI_PYTHON ?? "python") {
  const result = spawnSync(python, [fileURLToPath(new URL("./scan.py", import.meta.url))], {
    input: JSON.stringify(files),
    encoding: "utf8",
    windowsHide: true,
    timeout: 60_000,
    maxBuffer: 64 << 20,
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
  });
  if (result.error || result.status !== 0)
    throw new Error(
      `Python AST 扫描失败（解释器 ${python}；当前上游需要 Python 3.11+，可用 WIKI_PYTHON 或同步配置 python 指定）：${result.error?.message ?? result.stderr}`,
    );
  const rows = paramEntrySchema.array().parse(JSON.parse(result.stdout));
  const occurrences = new Map<string, { file: string; line: number }[]>();
  for (const [file, text] of Object.entries(files)) {
    for (const [i, line] of text.split(/\r?\n/).entries()) {
      for (const name of new Set(line.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [])) {
        const found = occurrences.get(name) ?? [];
        found.push({ file, line: i + 1 });
        occurrences.set(name, found);
      }
    }
  }
  return rows.map((row) => ({ ...row, occurrences: occurrences.get(row.name) ?? [] }));
}

export function scanRepo(repo: string, revision: string, python?: string) {
  if (!/^[a-f0-9]{7,40}$/.test(revision)) throw new Error("扫描必须指定钉定 commit");
  const commit = gitText(repo, ["rev-parse", "--verify", `${revision}^{commit}`]).trim();
  const paths = gitText(repo, ["ls-tree", "-r", "--name-only", commit, "--", "vllm_ascend/"])
    .split(/\r?\n/)
    .filter((p) => p.endsWith(".py"));
  if (!paths.length) throw new Error("钉定源码没有 Python 文件");
  const files = Object.fromEntries(paths.map((path) => [path, gitText(repo, ["show", `${commit}:${path}`])]));
  return { commit, entries: scanSources(files, python) };
}
