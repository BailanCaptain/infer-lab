import { gitText } from "./git";
import { prOf } from "./lineage";
import { scanSources } from "./params/scan";

const lines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
export function containingRefs(repo: string, commit: string) {
  if (!/^[a-f0-9]{7,40}$/.test(commit)) throw new Error("修复提交必须是钉定 SHA");
  gitText(repo, ["rev-parse", "--verify", `${commit}^{commit}`]);
  return {
    tags: lines(gitText(repo, ["tag", "--contains", commit, "--sort=version:refname"])),
    branches: lines(
      gitText(repo, [
        "for-each-ref",
        "--format=%(if)%(symref)%(then)%(else)%(refname:short)%(end)",
        `--contains=${commit}`,
        "refs/heads/",
        "refs/remotes/",
      ]),
    ),
  };
}

function resolveLineageRef(repo: string, ref: string) {
  if (!ref || ref.startsWith("-") || /[\s~^:{}]/.test(ref)) throw new Error("谱系 ref 无效");
  if (/^[a-f0-9]{7,40}$/.test(ref) || ref.startsWith("refs/"))
    return gitText(repo, ["rev-parse", "--verify", `${ref}^{commit}`]).trim();
  try {
    return gitText(repo, ["rev-parse", "--verify", `refs/remotes/origin/${ref}^{commit}`]).trim();
  } catch {
    return gitText(repo, ["rev-parse", "--verify", `${ref}^{commit}`]).trim();
  }
}

/**
 * 版本谱系的展示范围：发布分支（本地或 origin 的 releases/v*）按版本号排序，再带上 extra 里
 * 解析得出的 ref；一个都解析不出来才退回 fallback。CLI 与夜间参数刷新共用这一个来源——
 * 夜间刷新曾只拿同步前后两个提交当「版本」，把 wiki:lineage 写好的逐发布分支表整节顶掉（2026-09-24 修复）。
 */
export function lineageRefs(repo: string, extra: string[], fallback: string[]): string[] {
  const branches = [
    ...new Set(
      lines(
        gitText(repo, [
          "for-each-ref",
          "--format=%(refname:short)",
          "refs/heads/releases/*",
          "refs/remotes/origin/releases/*",
        ]),
      )
        .map((l) => l.replace(/^origin\//, ""))
        .filter((l) => /^releases\/v\d+\.\d+/.test(l)),
    ),
  ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const refs = [...new Set([...branches, ...extra])].filter((ref) => {
    try {
      resolveLineageRef(repo, ref);
      return true;
    } catch {
      return false;
    }
  });
  return refs.length ? refs : [...fallback];
}

export function gitLineage(
  repo: string,
  term: string,
  refs: string[],
  paths: string[],
  definitionClass?: string,
) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(term) || !refs.length || !paths.length)
    throw new Error("谱系标识符或范围无效");
  if (
    definitionClass &&
    (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(definitionClass) || paths.length !== 1 || !paths[0]!.endsWith(".py"))
  )
    throw new Error("字段谱系必须限定配置类与一个 Python 文件");
  const resolveRef = (ref: string) => resolveLineageRef(repo, ref);
  const counts = new Map<string, number>();
  const count = (sha: string) => {
    if (definitionClass && !counts.has(sha)) {
      const files = lines(gitText(repo, ["ls-tree", "-r", "--name-only", sha, "--", ...paths]));
      const source = Object.fromEntries(
        files.map((file) => [file, gitText(repo, ["show", `${sha}:${file}`])]),
      );
      counts.set(
        sha,
        new Set(
          scanSources(source)
            .filter((row) => row.form === "field" && row.class === definitionClass && row.name === term)
            .map((row) => row.file),
        ).size,
      );
    }
    if (!counts.has(sha))
      counts.set(
        sha,
        lines(gitText(repo, ["grep", "-l", "--fixed-strings", "-e", term, sha, "--", ...paths], true)).length,
      );
    return counts.get(sha)!;
  };
  const presence = refs.map((ref) => {
    const commit = resolveRef(ref);
    return { ref, commit, files: count(commit) };
  });
  const commits = new Set(
    (definitionClass ? [] : presence).flatMap((p) =>
      lines(gitText(repo, ["log", "--format=%H", "-S", term, p.commit, "--", ...paths])),
    ),
  );
  const events = [...commits]
    .flatMap((commit) => {
      const parents = gitText(repo, ["rev-list", "--parents", "-n", "1", commit]).trim().split(" ").slice(1);
      const alive = count(commit) > 0;
      const before = parents.map((p) => count(p) > 0);
      // A merge is a boundary only if every parent agrees on the previous state.
      if (parents.length && (before.some((b) => b === alive) || new Set(before).size > 1)) return [];
      if (!parents.length && !alive) return [];
      const [date, subject = ""] = gitText(repo, ["show", "-s", "--format=%cs%n%s", commit])
        .trim()
        .split("\n");
      const stat = parents.length
        ? gitText(repo, ["diff", "--numstat", parents[0]!, commit, "--", ...paths])
        : gitText(repo, ["show", "--format=", "--numstat", commit, "--", ...paths]);
      const topFiles = stat
        .split(/\r?\n/)
        .flatMap((line) => {
          const match = /^(\d+)\t(\d+)\t(.+)$/.exec(line);
          return match ? [{ path: match[3]!, added: Number(match[1]), removed: Number(match[2]) }] : [];
        })
        .sort((a, b) => b.removed - a.removed || a.path.localeCompare(b.path))
        .slice(0, 5);
      return [
        {
          commit,
          date,
          subject,
          kind: alive ? ("introduced" as const) : ("removed" as const),
          topFiles,
          pr: prOf(subject),
          containedIn: containingRefs(repo, commit),
        },
      ];
    })
    .sort((a, b) => a.date!.localeCompare(b.date!) || a.commit.localeCompare(b.commit));
  const tags = definitionClass ? [] : lines(gitText(repo, ["tag", "--sort=version:refname"]));
  return {
    schemaVersion: 1,
    term,
    definitionClass,
    paths: [...paths],
    interpretation: definitionClass
      ? "field-presence-at-selected-commits"
      : "textual-presence-not-runtime-behavior",
    presence,
    events,
    tagsWithTerm: tags.filter((tag) => count(resolveRef(tag)) > 0),
  };
}

export function renderVerifiedLineage(value: ReturnType<typeof gitLineage>) {
  if (value.definitionClass)
    return [
      "## 版本谱系",
      "",
      `范围限定为 \`${value.paths[0]}\` 中的 \`${value.definitionClass}.${value.term}\` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。`,
      "",
      "| 版本 | 定义是否存在 | 固定提交 |",
      "| --- | --- | --- |",
      ...value.presence.map((p) => `| ${p.ref} | ${p.files ? "有" : "无"} | \`${p.commit.slice(0, 8)}\` |`),
      "",
    ].join("\n");
  return [
    "## 版本谱系",
    "",
    "> 本节由 `pnpm wiki:lineage` 从 git 历史算出。标识符的文本存在不等同于运行时功能可用；引入／移除均比较提交与父提交。",
    "",
    "| 版本 | 是否存在 |",
    "| --- | --- |",
    ...value.presence.map((p) => `| ${p.ref} | ${p.files ? `有（${p.files} 个文件）` : "无"} |`),
    "",
    ...value.events.flatMap((e) => [
      `- **${e.kind === "introduced" ? "引入" : "移除"}**：${e.date} · ${e.commit}${e.pr ? ` · PR [#${e.pr}](https://github.com/vllm-project/vllm-ascend/pull/${e.pr})` : ""} —— ${e.subject}`,
      `  包含该提交的 tag：${e.containedIn.tags.join("、") || "未找到"}；分支：${e.containedIn.branches.join("、") || "未找到"}`,
      ...e.topFiles.map((f) => `  - \`${f.path}\` +${f.added} / −${f.removed}（文本行变化）`),
    ]),
    "",
    `当前含该标识符的 tag：${value.tagsWithTerm.join("、") || "未找到"}`,
    "",
  ].join("\n");
}
