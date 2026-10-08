import type { WikiPage } from "./pages";

/**
 * 站外链接的死链检查。
 *
 * `wiki:lint` 的 broken-link 只管站内链接；`wiki:audit` 每次都如实报一句「URL 未联网验证 N 条」
 * ——官方文档和论文的七十多条链接从来没人真的请求过。用户 2026-09-10 就问过「死链是否会有定期
 * 审查」，这里补上站外那一半。不调模型，只发 HTTP 请求。
 *
 * 只把 404 / 410 判成死链。403、5xx、超时、断网都可能是对方限流或这台机器此刻没网，判成
 * 「这次没验证到」，不进巡检的问题清单——否则夜里断一次网，第二天早上就是七十条假警报。
 */

export type UrlVerdict = "ok" | "dead" | "unknown";

export interface UrlResult {
  url: string;
  files: string[];
  verdict: UrlVerdict;
  detail: string;
}

export type UrlFetcher = (
  url: string,
  method: "HEAD" | "GET",
) => Promise<{ status?: number; error?: string }>;

const LINK_RE = /\]\((https?:\/\/[^)\s]+)\)/g;
const LOCAL_RE = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/;

/** URL（去掉锚点）→ 引用它的页。sources 里的 URL 与正文里的站外链接都算。 */
export function collectUrls(pages: WikiPage[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const page of pages) {
    const found = [
      ...page.fm.sources.filter((s) => /^https?:\/\//.test(s)),
      ...[...page.body.matchAll(LINK_RE)].map((m) => m[1] ?? ""),
    ];
    for (const raw of found) {
      const url = raw.split("#")[0] ?? "";
      if (!url || LOCAL_RE.test(url)) continue;
      const files = out.get(url) ?? [];
      if (!files.includes(page.file)) files.push(page.file);
      out.set(url, files);
    }
  }
  return new Map([...out.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

export function verdictOf(res: { status?: number; error?: string }): UrlVerdict {
  if (res.status === undefined) return "unknown";
  if (res.status >= 200 && res.status < 400) return "ok";
  return res.status === 404 || res.status === 410 ? "dead" : "unknown";
}

export async function checkUrls(
  urls: Map<string, string[]>,
  fetcher: UrlFetcher,
  opts: { concurrency?: number } = {},
): Promise<UrlResult[]> {
  const queue = [...urls.entries()];
  const results: UrlResult[] = [];
  const worker = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const [url, files] = next;
      let res = await fetcher(url, "HEAD");
      // 不少站点不认 HEAD，甚至返回 404（如 ModelScope API）；用 GET 确认。
      if (verdictOf(res) !== "ok" && res.status !== 410) res = await fetcher(url, "GET");
      results.push({
        url,
        files,
        verdict: verdictOf(res),
        detail: res.status === undefined ? (res.error ?? "无响应") : `HTTP ${res.status}`,
      });
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, opts.concurrency ?? 6) }, worker));
  return results.sort((a, b) => a.url.localeCompare(b.url));
}

/** 真正发请求的那个 fetcher：带超时，跟随重定向，不读响应体 */
export function httpFetcher(timeoutMs = 15000): UrlFetcher {
  return async (url, method) => {
    try {
      const res = await fetch(url, {
        method,
        redirect: "follow",
        signal: AbortSignal.timeout(timeoutMs),
        headers: { "user-agent": "llm-wiki-link-check" },
      });
      await res.body?.cancel();
      return { status: res.status };
    } catch (error) {
      return { error: error instanceof Error ? error.name : String(error) };
    }
  };
}

/** 巡检报告里的问题条目：只有死链进清单，每个引用它的页各一条 */
export function urlFindings(results: UrlResult[]): { file: string; rule: string; message: string }[] {
  return results
    .filter((r) => r.verdict === "dead")
    .flatMap((r) =>
      r.files.map((file) => ({ file, rule: "dead-url", message: `${r.url} 已失效（${r.detail}）` })),
    );
}
