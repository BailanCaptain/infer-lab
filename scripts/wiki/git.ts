import { spawnSync } from "node:child_process";

export class GitError extends Error {
  constructor(
    public readonly status: number | null,
    message: string,
  ) {
    super(message);
  }
}

/** Only git grep's documented no-match result is an empty successful query. */
export function gitText(root: string, args: string[], allowNoMatch = false): string {
  const result = spawnSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    maxBuffer: 64 << 20,
    env: { ...process.env, GIT_NO_LAZY_FETCH: "1" },
  });
  if (result.status === 0) return result.stdout;
  if (allowNoMatch && args[0] === "grep" && result.status === 1 && !result.stderr.trim()) return "";
  throw new GitError(
    result.status,
    `git ${args.join(" ")} 失败：${result.error?.message ?? result.stderr.trim()}`,
  );
}

export type BlobRead = { kind: "ok"; text: string } | { kind: "invalid-commit" | "missing-file" };

/** Cache by immutable object identity, never by current checkout. */
export function createBlobReader(): (root: string, commit: string, path: string) => BlobRead {
  const commits = new Map<string, boolean>();
  const blobs = new Map<string, BlobRead>();
  return (root, commit, path) => {
    const key = `${root}\0${commit}\0${path}`;
    const cached = blobs.get(key);
    if (cached) return cached;
    const commitKey = `${root}\0${commit}`;
    if (!commits.has(commitKey)) {
      // An unreadable repository must fail, rather than masquerading as missing evidence.
      gitText(root, ["rev-parse", "--git-dir"]);
      try {
        commits.set(commitKey, gitText(root, ["cat-file", "-t", commit]).trim() === "commit");
      } catch (error) {
        if (!(error instanceof GitError) || error.status !== 128) throw error;
        commits.set(commitKey, false);
      }
    }
    if (!commits.get(commitKey)) return { kind: "invalid-commit" };
    // ls-tree distinguishes a genuinely absent path from an object-reading failure.
    const tree = gitText(root, ["ls-tree", "-z", commit, "--", `:(literal)${path}`]);
    const entry = tree.split("\0").find((line) => line.slice(line.indexOf("\t") + 1) === path);
    const result: BlobRead = entry?.startsWith("100")
      ? { kind: "ok", text: gitText(root, ["show", `${commit}:${path}`]) }
      : { kind: "missing-file" };
    blobs.set(key, result);
    return result;
  };
}
