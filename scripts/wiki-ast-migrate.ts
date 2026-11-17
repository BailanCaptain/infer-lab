/**
 * AST 迁移 CLI：默认执行只读 dry-run 计划生成（绝不改写任何正式 Markdown）；
 * 仅在显式传入 `--apply <plan.json>` 且目标 `--wiki-root` 通过隔离副本防护校验时，执行全或无原子预检与写入。
 *
 * 用法：
 *   node --import tsx scripts/wiki-ast-migrate.ts [--wiki-root wiki] [--file concepts/foo.md] [--select-moves moves.json] [--out plan.json] [--json]
 *   node --import tsx scripts/wiki-ast-migrate.ts --apply <plan.json> --wiki-root <isolated-wiki-dir> [--out apply-report.json] [--json]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  applyWikiAstMigrationPlan,
  assertSafeApplyReportOutputPath,
  assertSafeIsolatedApplyRoot,
  assertSafePlanOutputPath,
  buildWikiAstMigrationPlan,
  normalizeWikiRelativeFile,
  type VersionParagraphMoveSelection,
  writeSafeApplyReportOutputFile,
  writeSafePlanOutputFile,
} from "./wiki/ast-migrate";

function parseCliArgs(argv: readonly string[]) {
  let wikiRoot = resolve(process.cwd(), "wiki");
  let outPath: string | undefined;
  let selectMovesPath: string | undefined;
  let applyPlanPath: string | undefined;
  let explicitDryRun = false;
  let jsonStdout = false;
  const files: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--wiki-root") {
      wikiRoot = resolve(process.cwd(), argv[++i] ?? "wiki");
    } else if (a === "--out") {
      const next = argv[++i];
      if (!next) throw new Error("--out 需要提供输出 JSON 路径");
      outPath = resolve(process.cwd(), next);
    } else if (a === "--file") {
      const next = argv[++i];
      if (!next) throw new Error("--file 需要提供相对 wiki/ 的文件路径");
      files.push(next);
    } else if (a === "--select-moves") {
      const next = argv[++i];
      if (!next) throw new Error("--select-moves 需要提供显式搬移选择 JSON 路径");
      selectMovesPath = resolve(process.cwd(), next);
    } else if (a === "--apply") {
      const next = argv[++i];
      if (!next || next.startsWith("--")) {
        throw new Error("--apply 需要提供只读迁移计划 JSON 路径（例如 --apply plan.json）");
      }
      applyPlanPath = resolve(process.cwd(), next);
    } else if (a === "--json") {
      jsonStdout = true;
    } else if (a === "--dry-run") {
      explicitDryRun = true;
    } else {
      throw new Error(`未知或未启用的参数：${a}`);
    }
  }

  if (applyPlanPath) {
    if (explicitDryRun || files.length > 0 || selectMovesPath) {
      throw new Error("--apply 不能与 --dry-run、--file 或 --select-moves 同时使用");
    }
    assertSafeIsolatedApplyRoot(wikiRoot);
    if (outPath) {
      assertSafeApplyReportOutputPath(wikiRoot, outPath, { applyPlanPath });
    }
    return { mode: "apply" as const, wikiRoot, outPath, applyPlanPath, jsonStdout };
  }

  for (const f of files) {
    normalizeWikiRelativeFile(wikiRoot, f);
  }
  if (outPath) {
    assertSafePlanOutputPath(wikiRoot, outPath, files);
  }

  const selectedMoves: VersionParagraphMoveSelection[] | undefined = selectMovesPath
    ? (JSON.parse(readFileSync(selectMovesPath, "utf8")) as VersionParagraphMoveSelection[])
    : undefined;

  return { mode: "dry-run" as const, wikiRoot, outPath, files, selectedMoves, jsonStdout };
}

const opts = parseCliArgs(process.argv.slice(2));

if (opts.mode === "apply") {
  const applyReport = applyWikiAstMigrationPlan(opts.wikiRoot, opts.applyPlanPath, {
    planPath: opts.applyPlanPath,
  });
  if (opts.outPath) {
    writeSafeApplyReportOutputFile(opts.wikiRoot, opts.outPath, `${JSON.stringify(applyReport, null, 2)}\n`, {
      applyPlanPath: opts.applyPlanPath,
    });
  }
  if (opts.jsonStdout) {
    process.stdout.write(`${JSON.stringify(applyReport, null, 2)}\n`);
  } else {
    console.log(
      JSON.stringify(
        {
          mode: applyReport.mode,
          status: applyReport.status,
          alreadyApplied: applyReport.alreadyApplied,
          wikiRoot: applyReport.wikiRoot,
          pageCount: applyReport.pageCount,
          writtenPageCount: applyReport.writtenPageCount,
          writtenPages: applyReport.writtenPages,
          unchangedPageCount: applyReport.unchangedPageCount,
          totalAppliedEdits: applyReport.totalAppliedEdits,
          ...(opts.outPath ? { outPath: opts.outPath } : {}),
        },
        null,
        2,
      ),
    );
  }
} else {
  const report = buildWikiAstMigrationPlan(opts.wikiRoot, {
    files: opts.files.length ? opts.files : undefined,
    selectedMoves: opts.selectedMoves,
  });

  if (opts.outPath) {
    writeSafePlanOutputFile(opts.wikiRoot, opts.outPath, `${JSON.stringify(report, null, 2)}\n`, opts.files);
  }

  if (opts.jsonStdout) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    console.log(
      JSON.stringify(
        {
          mode: report.mode,
          wikiRoot: report.wikiRoot,
          pageCount: report.pageCount,
          summary: report.summary,
          ...(opts.outPath ? { outPath: opts.outPath } : {}),
        },
        null,
        2,
      ),
    );
  }
}
