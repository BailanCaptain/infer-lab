import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildIndex, type PageIndex, retrieve } from "../../src/content/wiki/retrieve";
import { analyzeTroubleshootInput } from "../../src/sim/troubleshoot/logAnalyzer";
import { localFixVersions } from "./chat-trace";

interface DistilledIssueItem {
  key: string;
  repo: string;
  number: number;
  url: string;
  title: string;
  closed_at: string | null;
  comments_complete: boolean;
  raw_sha256: string;
  candidate_prs: Array<number | string>;
  verbatim_root_line: string;
  verbatim_root_verified: boolean;
  verbatim_cascade_lines: string[];
  distilled: {
    error_codes?: string[];
    subsystem?: string;
    hardware_soc?: string;
    topology?: string;
    root_cause_confirmed?: boolean;
    root_cause_zh?: string;
    fix_or_workaround_zh?: string;
    fix_pr_numbers?: number[];
    colloquial_queries_zh?: string[];
    same_code_trap_zh?: string;
  };
}

interface DistilledPayload {
  schemaVersion: number;
  generatedAt: string;
  teacherModel: string;
  dtype?: string;
  gpu: string;
  vramGiB: number;
  elapsedSec: number;
  totalIssues: number;
  verbatimVerifiedCount: number;
  items: DistilledIssueItem[];
}

interface AuditedPrLineage {
  pr: number;
  commit: string;
  inBaselines: Record<string, boolean>;
  backportCommits?: Record<string, string>;
}

function normalizeAscendPrNumbers(defaultRepo: string, entries: ReadonlyArray<number | string>): number[] {
  const nums = new Set<number>();
  for (const raw of entries) {
    if (typeof raw === "number") {
      if (defaultRepo === "vllm-project/vllm-ascend" && Number.isInteger(raw) && raw > 0) {
        nums.add(raw);
      }
      continue;
    }
    const trimmed = raw.trim();
    const qualified = /^([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)#(\d+)$/.exec(trimmed);
    if (qualified) {
      if (qualified[1]?.toLowerCase() === "vllm-project/vllm-ascend") {
        nums.add(Number.parseInt(qualified[2]!, 10));
      }
      continue;
    }
    if (defaultRepo === "vllm-project/vllm-ascend" && /^\d+$/.test(trimmed)) {
      nums.add(Number.parseInt(trimmed, 10));
    }
  }
  return [...nums].slice(0, 6);
}

function checkPrLineageViaCanonicalSeeds(root: string, prNumbers: readonly number[]): AuditedPrLineage[] {
  const out: AuditedPrLineage[] = [];
  for (const pr of prNumbers) {
    const check = localFixVersions(root, "vllm-project/vllm-ascend", pr);
    if (check.status !== "found") continue;
    const inBaselines: Record<string, boolean> = {};
    const backportCommits: Record<string, string> = {};
    for (const pin of check.pins) {
      inBaselines[pin.ref] = Boolean(pin.contains || pin.sameNumberCommit);
      if (pin.sameNumberCommit) {
        backportCommits[pin.ref] = pin.sameNumberCommit.slice(0, 8);
      }
    }
    out.push({
      pr,
      commit: check.commit.slice(0, 8),
      inBaselines,
      ...(Object.keys(backportCommits).length > 0 ? { backportCommits } : {}),
    });
  }
  return out;
}

function loadLiveWikiIndex() {
  const regRaw = JSON.parse(readFileSync(resolve("src/content/wiki/registry.json"), "utf8")) as {
    pages: Array<{
      id: string;
      file: string;
      title: string;
      displayTitle?: string;
      aliases: string[];
      summary: string;
      chapters: string[];
      evidence: string;
      relations?: Array<{ to: string; kind: string; note: string }>;
    }>;
  };
  const pageIndexes: PageIndex[] = regRaw.pages.map((p) => {
    const mdPath = resolve("wiki", p.file);
    const text = existsSync(mdPath) ? readFileSync(mdPath, "utf8") : p.summary;
    return {
      id: p.id,
      file: p.file,
      title: p.title,
      displayTitle: p.displayTitle,
      aliases: p.aliases ?? [],
      summary: p.summary,
      chapters: p.chapters ?? [],
      evidence: p.evidence ?? "C",
      relations: (p.relations ?? []) as PageIndex["relations"],
      text,
    };
  });
  return buildIndex(pageIndexes);
}

function main() {
  const root = resolve(".");
  const inPath = resolve(root, "tools/wiki-runtime/colab-distill/distilled_ascend_github.json");
  if (!existsSync(inPath)) {
    throw new Error(`Missing distilled artifact at ${inPath}`);
  }
  const payload = JSON.parse(readFileSync(inPath, "utf8")) as DistilledPayload;
  const index = loadLiveWikiIndex();

  let verifiedDiagnoseHitCount = 0;
  let unverifiedGeneratedRuleHits = 0;
  let colloquialTotal = 0;
  let colloquialNonEmptyHits = 0;

  const audited = payload.items.map((item) => {
    const verifiedLines = [
      item.verbatim_root_verified ? item.verbatim_root_line : "",
      ...item.verbatim_cascade_lines,
    ].filter(Boolean);
    const verifiedSampleLog = verifiedLines.join("\n");
    const verifiedDiag = verifiedSampleLog ? analyzeTroubleshootInput(verifiedSampleLog) : null;
    const matchedRuleIds = verifiedDiag ? verifiedDiag.findings.map((f) => f.ruleId) : [];

    if (item.verbatim_root_verified && matchedRuleIds.length > 0) {
      verifiedDiagnoseHitCount += 1;
    } else if (!item.verbatim_root_verified && item.verbatim_root_line.trim()) {
      const unverifiedDiag = analyzeTroubleshootInput(item.verbatim_root_line);
      if (unverifiedDiag.findings.length > 0) {
        unverifiedGeneratedRuleHits += 1;
      }
    }

    const confirmedFixPrNums = item.distilled.root_cause_confirmed
      ? normalizeAscendPrNumbers(item.repo, item.distilled.fix_pr_numbers ?? [])
      : [];
    const referencedPrNums = normalizeAscendPrNumbers(item.repo, item.candidate_prs ?? []).filter(
      (n) => !confirmedFixPrNums.includes(n),
    );

    const confirmedFixPrLineage = checkPrLineageViaCanonicalSeeds(root, confirmedFixPrNums);
    const referencedPrLineage = checkPrLineageViaCanonicalSeeds(root, referencedPrNums);

    const colloquialEval = (item.distilled.colloquial_queries_zh ?? []).slice(0, 3).map((q) => {
      colloquialTotal += 1;
      const hits = retrieve(q, index, { limit: 3 });
      if (hits.length > 0) colloquialNonEmptyHits += 1;
      return { query: q, top3: hits.map((h) => h.id) };
    });

    return {
      key: item.key,
      url: item.url,
      title: item.title,
      rawSha256: item.raw_sha256,
      commentsComplete: item.comments_complete,
      verbatimRootVerified: item.verbatim_root_verified,
      verbatimRootLine: item.verbatim_root_line,
      subsystem: item.distilled.subsystem ?? "other",
      errorCodes: item.distilled.error_codes ?? [],
      rootCauseConfirmed: Boolean(item.distilled.root_cause_confirmed),
      rootCauseZh: item.distilled.root_cause_zh ?? "",
      sameCodeTrapZh: item.distilled.same_code_trap_zh ?? "",
      matchedLocalRuleIds: matchedRuleIds,
      confirmedFixPrLineage,
      referencedPrLineage,
      colloquialEval,
    };
  });

  const report = {
    verifiedAt: new Date().toISOString(),
    gpuUsed: payload.gpu,
    vramGiB: payload.vramGiB,
    teacherModel: payload.teacherModel,
    totalMinedAndDistilled: payload.totalIssues,
    verbatimRootSubstringVerified: payload.verbatimVerifiedCount,
    withVerbatimDiagnosticRuleHit: verifiedDiagnoseHitCount,
    unverifiedGeneratedRuleHits,
    colloquialQueriesTested: colloquialTotal,
    colloquialQueriesWithWikiTop3: colloquialNonEmptyHits,
    withConfirmedFixPrLineageVerified: audited.filter((a) => a.confirmedFixPrLineage.length > 0).length,
    withReferencedPrLineageVerified: audited.filter(
      (a) => a.confirmedFixPrLineage.length > 0 || a.referencedPrLineage.length > 0,
    ).length,
    auditedItems: audited,
  };

  const outPath = resolve(root, "tools/wiki-runtime/colab-distill/verified_audit_report.json");
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify(
      {
        gpuUsed: report.gpuUsed,
        teacherModel: report.teacherModel,
        totalMinedAndDistilled: report.totalMinedAndDistilled,
        verbatimRootSubstringVerified: report.verbatimRootSubstringVerified,
        withVerbatimDiagnosticRuleHit: report.withVerbatimDiagnosticRuleHit,
        unverifiedGeneratedRuleHits: report.unverifiedGeneratedRuleHits,
        colloquialQueriesTested: report.colloquialQueriesTested,
        colloquialQueriesWithWikiTop3: report.colloquialQueriesWithWikiTop3,
        withConfirmedFixPrLineageVerified: report.withConfirmedFixPrLineageVerified,
        withReferencedPrLineageVerified: report.withReferencedPrLineageVerified,
      },
      null,
      2,
    ),
  );
}

main();
