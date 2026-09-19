import { parseRepoRef } from "../../src/content/wiki/schema";
import type { AuditDeps } from "./audit";
import { diagramRefs, type LoadedDiagram, specPins } from "./diagrams";
import type { WikiPage } from "./pages";

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
  const covered = page.fm.sources.map((x) => x.split("#")[0] ?? "");
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
    // 两种版式共用一个出口，新增版式不会悄悄绕过 AC11 的检查
    for (const pin of specPins(diagram.spec)) {
      if (!pin.source) {
        problems.push({
          file: diagram.specFile,
          rule: "diagram-symbol",
          message: `${pin.where} 声明了 symbols 却没有 source，无处可查`,
        });
        continue;
      }
      // 图引的文件必须也在这一页的 sources 里，读者才点得到
      if (!covered.some((c) => c === (pin.source!.split("#")[0] ?? "")))
        problems.push({
          file: page.file,
          rule: "diagram-identifier",
          message: `${diagram.specFile} 的 ${pin.where} 引用 ${pin.source}，不在本页 sources 里`,
        });
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

export function auditDiagram(page: WikiPage, deps: DiagramAuditDeps) {
  return [...auditMermaid(page, deps), ...auditSpecs(page, deps)];
}
