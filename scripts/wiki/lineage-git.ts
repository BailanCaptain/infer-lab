import { gitText } from "./git";
import { prOf } from "./lineage";

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

export function gitLineage(repo: string, term: string, refs: string[], paths: string[]) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(term) || !refs.length || !paths.length)
    throw new Error("谱系标识符或范围无效");
  const resolveRef = (ref: string) => {
    if (!ref || ref.startsWith("-") || /[\s~^:{}]/.test(ref)) throw new Error("谱系 ref 无效");
    if (/^[a-f0-9]{7,40}$/.test(ref) || ref.startsWith("refs/"))
      return gitText(repo, ["rev-parse", "--verify", `${ref}^{commit}`]).trim();
    try {
      return gitText(repo, ["rev-parse", "--verify", `refs/remotes/origin/${ref}^{commit}`]).trim();
    } catch {
      return gitText(repo, ["rev-parse", "--verify", `${ref}^{commit}`]).trim();
    }
  };
  const counts = new Map<string, number>();
  const count = (sha: string) => {
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
    presence.flatMap((p) =>
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
  const tags = lines(gitText(repo, ["tag", "--sort=version:refname"]));
  return {
    schemaVersion: 1,
    term,
    paths: [...paths],
    interpretation: "textual-presence-not-runtime-behavior",
    presence,
    events,
    tagsWithTerm: tags.filter((tag) => count(resolveRef(tag)) > 0),
  };
}

export function renderVerifiedLineage(value: ReturnType<typeof gitLineage>) {
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
