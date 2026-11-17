import { createHash } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import type { ServerResponse } from "node:http";
import { join } from "node:path";
import remarkCjkFriendly from "remark-cjk-friendly";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { collectResolvedMarkdownLinkUrls, type MarkdownLinkAstNode } from "../../src/content/wiki/markdown";
import { parseInlineRawLinkTarget, parseRawRef } from "../../src/content/wiki/schema";
import { sourceLines } from "./audit";
import { loadPages, parsePage } from "./pages";
import { readRawSnapshot } from "./raw";

export const STATIC_RAW_ROUTE_RE = /^\/wiki-raw\/sha256-([a-f0-9]{64})\.html$/;
const RAW_FILE_PATH_RE = /^raw\/sha256-([a-f0-9]{64})\.md$/;

const rawLinkParser = unified().use(remarkParse).use(remarkGfm).use(remarkMath).use(remarkCjkFriendly);

function collectBodyLinkedRawPaths(body: string, out: Set<string>): void {
  const tree = rawLinkParser.parse(body) as MarkdownLinkAstNode;
  for (const rawUrl of collectResolvedMarkdownLinkUrls(tree)) {
    const parsed = parseInlineRawLinkTarget(rawUrl);
    if (parsed && RAW_FILE_PATH_RE.test(parsed.path)) out.add(parsed.path);
  }
}

const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

/**
 * Constant, data-free script authorized solely by its exact SHA-256 CSP digest so pure static
 * `dist/wiki-raw/sha256-<hash>.html` pages can highlight `?lines=start-end` offline without `/api/wiki/raw`.
 */
const RAW_RANGE_SCRIPT =
  '(()=>{const q=new URLSearchParams(location.search).get("lines");if(!q)return;const m=/^([1-9]\\d*)(?:-([1-9]\\d*))?$/.exec(q);const pre=document.getElementById("raw-body");const info=document.getElementById("raw-range");if(!pre||!info)return;const total=pre.children.length;const s=m?Number(m[1]):0;const e=m?Number(m[2]??m[1]):0;if(!m||!Number.isSafeInteger(s)||!Number.isSafeInteger(e)||e<s||e>total){pre.replaceChildren();info.setAttribute("role","alert");info.textContent="原文缺失、完整性校验失败或引用行号越界，请重新核对来源。";return;}for(const el of pre.querySelectorAll(".selected"))el.classList.remove("selected");for(let i=s;i<=e;i++)document.getElementById("L"+i)?.classList.add("selected");info.textContent="引用第 "+s+"–"+e+" 行 · 文件完整性已核对，内容与结论仍需审阅。";if(/^#L[1-9]\\d*$/.test(location.hash))document.getElementById(location.hash.slice(1))?.scrollIntoView({block:"center"});})();';

const RAW_RANGE_SCRIPT_HASH = createHash("sha256").update(RAW_RANGE_SCRIPT, "utf8").digest("base64");

export function collectPublishedRawPathsFromPages(
  pages: Iterable<{ fm: { sources: string[]; rawSources?: string[] }; body: string }>,
): Set<string> {
  const paths = new Set<string>();
  for (const page of pages) {
    for (const rawPath of page.fm.rawSources ?? []) {
      if (RAW_FILE_PATH_RE.test(rawPath)) paths.add(rawPath);
    }
    for (const ref of page.fm.sources) {
      const parsed = parseRawRef(ref);
      if (parsed && RAW_FILE_PATH_RE.test(parsed.path)) paths.add(parsed.path);
    }
    collectBodyLinkedRawPaths(page.body, paths);
  }
  return paths;
}

/** Collect raw snapshot paths referenced by valid formal pages in `PAGE_DIRS`. */
export function collectPublishedRawPaths(wikiRoot: string): Set<string> {
  const { pages, problems } = loadPages(wikiRoot);
  const badFiles = new Set(problems.map((p) => p.file));
  return collectPublishedRawPathsFromPages(pages.filter((p) => !badFiles.has(p.file)));
}

/** Collect published raw snapshot paths from an already-locked reader snapshot. */
export function collectSnapshotPublishedRawPaths(snapshot: {
  pageTexts: { file: string; text: string }[];
}): Set<string> {
  const parsedPages: { fm: { sources: string[]; rawSources?: string[] }; body: string }[] = [];
  for (const entry of snapshot.pageTexts) {
    const parsed = parsePage(entry.file, entry.text);
    if (parsed.page && !parsed.problems.length) parsedPages.push(parsed.page);
  }
  return collectPublishedRawPathsFromPages(parsedPages);
}

export function parseRawLinesParam(
  param: string | null,
): { lineStart: number; lineEnd: number } | "invalid" | null {
  if (param === null || param === "") return null;
  const m = /^([1-9]\d*)(?:-([1-9]\d*))?$/.exec(param);
  if (!m) return "invalid";
  const lineStart = Number(m[1]);
  const lineEnd = Number(m[2] ?? m[1]);
  if (!Number.isSafeInteger(lineStart) || !Number.isSafeInteger(lineEnd) || lineEnd < lineStart) {
    return "invalid";
  }
  return { lineStart, lineEnd };
}

export function renderRawSnapshotHtml(
  path: string,
  content: string,
  options?: { range?: { lineStart: number; lineEnd: number }; interactiveRange?: boolean },
): { html: string; csp: string } {
  const lines = sourceLines(content);
  const range = options?.range;
  if (range && range.lineEnd > lines.length) throw new Error("引用行号超出原文范围");
  const interactive = options?.interactiveRange === true;
  const scriptDirective = interactive ? ` script-src 'sha256-${RAW_RANGE_SCRIPT_HASH}';` : "";
  const metaCsp = `default-src 'none'; style-src 'unsafe-inline';${scriptDirective} base-uri 'none'`;
  const csp = `${metaCsp}; frame-ancestors 'none'`;
  const summary = range
    ? `引用第 ${range.lineStart}–${range.lineEnd} 行 · 文件完整性已核对，内容与结论仍需审阅。`
    : `全文共 ${lines.length} 行 · 文件完整性已核对，内容与结论仍需审阅。`;
  const body = lines
    .map(
      (text, i) =>
        `<span class="line${range && i + 1 >= range.lineStart && i + 1 <= range.lineEnd ? " selected" : ""}" id="L${i + 1}"><a href="#L${i + 1}" aria-label="第 ${i + 1} 行">${i + 1}</a> ${escapeHtml(text)}</span>`,
    )
    .join("\n");
  const tailScript = interactive ? `<script>${RAW_RANGE_SCRIPT}</script>` : "";
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="${metaCsp}"><title>本地原文</title><style>body{margin:2rem;background:#fafafa;color:#222;font:16px system-ui}h1{font-size:1.5rem}pre{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6}.line{display:block}.line a{display:inline-block;min-width:3ch;color:#626262;text-decoration:none}.selected{background:#fff1bd}.line:target{outline:2px solid #b26a00}code{overflow-wrap:anywhere}</style></head><body><h1>本地原文</h1><p id="raw-range">${summary}</p><details><summary>来源标识</summary><code>${escapeHtml(path)}</code></details><pre id="raw-body">${body}</pre>${tailScript}</body></html>`;
  return { html, csp };
}

export function serveWikiRawPage(
  method: string | undefined,
  url: URL,
  res: ServerResponse,
  wikiRoot: string,
  publishedPaths?: ReadonlySet<string>,
): boolean {
  if (!url.pathname.startsWith("/wiki-raw/")) return false;
  res.setHeader("cache-control", "no-store");
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader(
    "content-security-policy",
    "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
  );
  if (method !== "GET") {
    res.writeHead(405, { "content-type": "text/plain; charset=utf-8" });
    res.end("需要合法的本地原文引用与行号。");
    return true;
  }
  const match = STATIC_RAW_ROUTE_RE.exec(url.pathname);
  const linesParam = parseRawLinesParam(url.searchParams.get("lines"));
  if (!match || linesParam === "invalid") {
    res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
    res.end("需要合法的本地原文引用与行号。");
    return true;
  }
  const relPath = `raw/sha256-${match[1]}.md`;
  const allowed = publishedPaths ?? collectPublishedRawPaths(wikiRoot);
  if (!allowed.has(relPath)) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("该本地原文尚未由正式知识页公开引用。");
    return true;
  }
  try {
    const content = readRawSnapshot(wikiRoot, relPath);
    const { html, csp } = renderRawSnapshotHtml(
      relPath,
      content,
      linesParam ? { range: linesParam } : { interactiveRange: true },
    );
    res.setHeader("content-security-policy", csp);
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  } catch {
    res.writeHead(422, { "content-type": "text/plain; charset=utf-8" });
    res.end("原文缺失、完整性校验失败或引用行号越界，请重新核对来源。");
  }
  return true;
}

export function emitStaticRawSnapshots(
  wikiRoot: string,
  outDir: string,
  publishedPaths?: ReadonlySet<string>,
): void {
  const targetDir = join(outDir, "wiki-raw");
  rmSync(targetDir, { recursive: true, force: true });
  const allowed = [...(publishedPaths ?? collectPublishedRawPaths(wikiRoot))].sort();
  if (!allowed.length) return;
  mkdirSync(targetDir, { recursive: true });
  for (const relPath of allowed) {
    const match = RAW_FILE_PATH_RE.exec(relPath);
    if (!match) continue;
    const content = readRawSnapshot(wikiRoot, relPath);
    const { html } = renderRawSnapshotHtml(relPath, content, { interactiveRange: true });
    writeFileSync(join(targetDir, `sha256-${match[1]}.html`), html, "utf8");
  }
}
