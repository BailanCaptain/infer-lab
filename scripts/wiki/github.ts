import { z } from "zod";

export const githubCommentSchema = z
  .object({
    id: z.number().int(),
    body: z.string().nullable(),
    html_url: z.string().url(),
    updated_at: z.string(),
    user: z.object({ login: z.string() }).nullable(),
    path: z.string().optional(),
    line: z.number().nullable().optional(),
  })
  .passthrough();
export const githubItemSchema = z
  .object({
    number: z.number().int().positive(),
    title: z.string(),
    body: z.string().nullable(),
    state: z.string(),
    html_url: z.string().url(),
    user: z.object({ login: z.string() }).nullable(),
    labels: z.array(z.union([z.string(), z.object({ name: z.string() }).passthrough()])),
    created_at: z.string(),
    updated_at: z.string(),
    closed_at: z.string().nullable(),
    pull_request: z.unknown().optional(),
  })
  .passthrough();
export type GithubItem = z.infer<typeof githubItemSchema>;
export type GithubComment = z.infer<typeof githubCommentSchema>;
export type GithubFailure = "auth" | "rate-limit" | "network" | "not-found" | "api";
export class GithubError extends Error {
  constructor(
    public kind: GithubFailure,
    public status?: number,
    public retryAfter?: string,
  ) {
    super(`GitHub ${kind}${status ? ` (${status})` : ""}${retryAfter ? `；重试时间 ${retryAfter}` : ""}`);
  }
}

/** Only relative API paths; never follows a community-supplied URL with credentials. */
export class GithubClient {
  constructor(
    private token?: string,
    private fetcher: typeof fetch = fetch,
  ) {}
  searchIssues(query: string, perPage = 10): Promise<unknown> {
    if (!query.trim() || !Number.isInteger(perPage) || perPage < 1 || perPage > 100)
      throw new Error("无效的 GitHub 搜索参数");
    return this.request(`/search/issues?q=${encodeURIComponent(query)}&per_page=${perPage}`);
  }
  compareCommits(repo: string, base: string, head: string): Promise<unknown> {
    if (![base, head].every((sha) => /^[a-f\d]{40}$/i.test(sha))) throw new Error("比较提交需要两个完整 SHA");
    return this.request(`${repoPath(repo)}/compare/${base}...${head}`);
  }
  async get(path: string): Promise<unknown> {
    if (!path.startsWith("/repos/") || path.includes("..") || path.includes("\\"))
      throw new Error("非法 GitHub API 路径");
    return this.request(path);
  }
  private async request(path: string): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetcher(`https://api.github.com${path}`, {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2026-03-10",
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new GithubError("network");
    }
    if (!response.ok) {
      const kind =
        response.status === 401
          ? "auth"
          : response.status === 429 ||
              (response.status === 403 &&
                (response.headers.get("x-ratelimit-remaining") === "0" ||
                  response.headers.has("retry-after")))
            ? "rate-limit"
            : response.status === 403
              ? "auth"
              : response.status === 404
                ? "not-found"
                : "api";
      throw new GithubError(
        kind,
        response.status,
        response.headers.get("retry-after") ?? response.headers.get("x-ratelimit-reset") ?? undefined,
      );
    }
    try {
      return await response.json();
    } catch {
      throw new GithubError("api", response.status);
    }
  }
  async *pages<T extends z.ZodTypeAny>(path: string, schema: T, start = 1) {
    for (let page = start; ; page++) {
      const value = await this.get(`${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
      const items = z.array(schema).parse(value);
      yield { page, items };
      if (items.length < 100) return;
    }
  }
  async all<T extends z.ZodTypeAny>(path: string, schema: T) {
    const rows: z.output<T>[] = [];
    for await (const page of this.pages(path, schema)) rows.push(...page.items);
    return rows;
  }
}

export const repoPath = (repo: string) => {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo) || repo.includes(".."))
    throw new Error("GitHub repo 必须是 owner/name");
  return `/repos/${repo}`;
};
