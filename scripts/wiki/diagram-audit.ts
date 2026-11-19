import { existsSync } from "node:fs";
import { join } from "node:path";
import { parseRepoRef } from "../../src/content/wiki/schema";
import type { AuditDeps } from "./audit";
import { diagramRefs, type LoadedDiagram, specPins } from "./diagrams";
import type { PageProblem, WikiPage } from "./pages";
import { isGitRepoRoot } from "./repo-roots";

/**
 * AC11 的图符号来源检查：图上写的标识符必须在所引 commit 的源码里真实存在。
 *
 * 两条载体并存，是 2026-09-19 换图机制时的明知状态：
 * - `wiki-diagram` spec（新页用）：逐条声明 `source` + `symbols`（flow 版式写在方块上、
 *   poster 版式写在 `pins` 里），对钉住的 blob 逐个查，比下面那条严——错的那一条能指名道姓。
 *   两种版式都经 `specPins()` 这一个出口取，新增版式不会悄悄绕过检查。
 * - ```mermaid``` 围栏（旧 18 张图）：只能从图的文本里正则抠标识符，
 *   再拿整页 sources 合起来找。旧页迁完这一段就可以删。
 */

export function diagramSymbols(body: string) {
  const symbols = new Set<string>();
  for (const block of body.matchAll(/```mermaid\r?\n([\s\S]*?)```/g)) {
    const text = block[1]!;
    for (const call of text.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g))
      if (!["subgraph", "style", "classDef"].includes(call[1]!)) symbols.add(call[1]!);
    for (const cls of text.matchAll(/\b([A-Z][a-zA-Z0-9]*[a-z][A-Z][A-Za-z0-9_]*)\b/g)) symbols.add(cls[1]!);
  }
  return [...symbols].sort();
}

export interface DiagramAuditDeps extends Pick<AuditDeps, "repoRoots" | "readBlob"> {
  /** 由 loadDiagrams 提供；缺省表示这次运行不检查 spec 图 */
  diagrams?: Map<string, LoadedDiagram>;
  /** 开源无本地克隆模式：允许对未克隆仓库的既有图 pin 降级为跳过/警告而非阻塞 */
  allowUnclonedRepos?: boolean;
  /** 本次变更的图 id 集合；若提供，集合内的新增/修改图仍严格要求非空 pin 可验证 */
  touchedDiagrams?: ReadonlySet<string>;
  /** 可选回调：记录被降级跳过的未克隆仓库图 pin 警告 */
  onUnclonedWarning?: (warning: string) => void;
}

function isUnclonedConfiguredRepo(source: string, repoRoots: Record<string, string>): boolean {
  const ref = parseRepoRef(source);
  const root = ref && repoRoots[ref.repo];
  return Boolean(root && !isGitRepoRoot(root));
}

function readRef(source: string, deps: DiagramAuditDeps): string | null {
  const ref = parseRepoRef(source);
  if (!ref || !deps.repoRoots[ref.repo]) return null;
  const blob = deps.readBlob(deps.repoRoots[ref.repo]!, ref.commit, ref.path);
  return blob.kind === "ok" ? blob.text : null;
}

function auditMermaid(page: WikiPage, deps: DiagramAuditDeps) {
  const symbols = diagramSymbols(page.body);
  if (!symbols.length) return [];
  const repoSources = page.fm.sources.filter((s) => parseRepoRef(s) !== null);
  if (
    deps.allowUnclonedRepos &&
    repoSources.length > 0 &&
    repoSources.every((s) => isUnclonedConfiguredRepo(s, deps.repoRoots))
  ) {
    deps.onUnclonedWarning?.(`${page.file} [uncloned-repo] 跳过未克隆仓库的旧 Mermaid 符号核验`);
    return [];
  }
  const texts = page.fm.sources.flatMap((source) => {
    const text = readRef(source, deps);
    return text === null ? [] : [text];
  });
  return symbols
    .filter((symbol) => !texts.some((text) => new RegExp(`\\b${symbol}\\b`).test(text)))
    .map((symbol) => ({
      file: page.file,
      rule: "diagram-symbol",
      message: `图中标识符 ${symbol} 未在引用版本的源码文件中找到；不能用当前工作树或模型记忆补证`,
    }));
}

function auditSpecs(page: WikiPage, deps: DiagramAuditDeps) {
  if (!deps.diagrams) return [];
  const problems: { file: string; rule: string; message: string }[] = [];
  for (const id of new Set(diagramRefs(page.body))) {
    const diagram = deps.diagrams.get(id);
    if (!diagram) {
      problems.push({
        file: page.file,
        rule: "diagram-missing",
        message: `正文引用了 wiki/diagrams/${id}.yaml，但这个 spec 不存在`,
      });
      continue;
    }
    const diagramUntouched = deps.touchedDiagrams !== undefined && !deps.touchedDiagrams.has(id);
    // 证据面板已能按图独立读取精确 pins，不再要求在页面 sources 重复登记；固定 Git blob 与符号 AC11 继续严格核验
    for (const pin of specPins(diagram.spec)) {
      if (!pin.source) {
        problems.push({
          file: diagram.specFile,
          rule: "diagram-symbol",
          message: `${pin.where} 声明了 symbols 却没有 source，无处可查`,
        });
        continue;
      }
      if (
        (deps.allowUnclonedRepos || diagramUntouched) &&
        !deps.touchedDiagrams?.has(id) &&
        isUnclonedConfiguredRepo(pin.source, deps.repoRoots)
      ) {
        deps.onUnclonedWarning?.(
          `${diagram.specFile} [uncloned-repo] 跳过未克隆仓库的既有图 pin：${pin.source}`,
        );
        continue;
      }
      const text = readRef(pin.source, deps);
      if (text === null) {
        problems.push({
          file: diagram.specFile,
          rule: "diagram-symbol",
          message: `${pin.where} 的 source ${pin.source} 读不出源码 blob`,
        });
        continue;
      }
      for (const symbol of pin.symbols)
        if (!new RegExp(`\\b${symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text))
          problems.push({
            file: diagram.specFile,
            rule: "diagram-symbol",
            message: `${pin.where} 的标识符 ${symbol} 不在 ${pin.source} 里；不能用当前工作树或模型记忆补证`,
          });
    }
  }
  return problems;
}

export function auditDiagram(page: WikiPage, deps: DiagramAuditDeps): PageProblem[] {
  return [...auditMermaid(page, deps), ...auditSpecs(page, deps)];
}

/** 纯静态缺图检查：不依赖外部源码仓，供 wiki:lint 在干净克隆/CI 下直接执行 */
export function missingDiagramProblems(
  pages: WikiPage[],
  diagrams: Map<string, LoadedDiagram>,
  wikiRoot?: string,
): PageProblem[] {
  const problems: PageProblem[] = [];
  for (const page of pages) {
    for (const id of new Set(diagramRefs(page.body))) {
      if (!diagrams.has(id)) {
        problems.push({
          file: page.file,
          rule: "diagram-missing",
          message: `正文引用了 wiki/diagrams/${id}.yaml，但这个 spec 不存在`,
        });
      }
    }
  }
  if (wikiRoot) {
    // spec 在但 SVG 没生成，页面上就是一个空框——渲染层读的是 SVG，不是 spec
    for (const diagram of diagrams.values()) {
      if (!existsSync(join(wikiRoot, diagram.svgFile))) {
        problems.push({
          file: diagram.specFile,
          rule: "diagram-missing",
          message: `缺 ${diagram.svgFile}，跑 pnpm wiki:diagrams 生成`,
        });
      }
    }
  }
  return problems;
}

/** 批量审计页面与共用 spec 图符号，并对同一 spec 文件的重复符号报错去重 */
export function auditDiagrams(pages: WikiPage[], deps: DiagramAuditDeps): PageProblem[] {
  const seen = new Set<string>();
  const out: PageProblem[] = [];
  for (const page of pages) {
    for (const p of auditDiagram(page, deps)) {
      const key = `${p.file}\0${p.rule}\0${p.message}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
  }
  return out;
}
