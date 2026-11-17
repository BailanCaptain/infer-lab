import { z } from "zod";
import type { FactDispositionEntry } from "../../src/content/wiki/drop";
import type { RunAgent } from "./batch";
import { inputByteLimit } from "./context-window";
import {
  FACT_DISPOSITION_CHECK_RULES,
  factDispositionVerdictItemSchema,
  planPageFactDispositions,
  type SiblingWrite,
  verifyFactDispositions,
} from "./fact-disposition";
import { parsePage } from "./pages";
import type { Revision } from "./revisions";
import { PAGE_TEXT_TIMEOUT_MS, runStructured } from "./structured";
import type { WorkInput } from "./workflow";
import type { WorkflowPolicy } from "./workflow-policy";

export async function auditPageFactDispositionsWithAgent(
  root: string,
  input: {
    path: string;
    before: string;
    after: string;
    revision: Revision;
    siblingWrites?: SiblingWrite[];
    origin: WorkInput["origin"];
    policy: WorkflowPolicy;
    checkId?: string;
  },
  deps: { runAgent?: RunAgent; retry?: boolean } = {},
): Promise<FactDispositionEntry[]> {
  const oldParsed = parsePage(input.path, input.before);
  const newParsed = parsePage(input.path, input.after);
  if (!oldParsed.page || !newParsed.page) throw new Error(`修订页面不合法：${input.path}`);
  const plan = planPageFactDispositions(
    input.path,
    oldParsed.page,
    newParsed.page,
    input.revision,
    input.siblingWrites,
  );
  if (!plan.pendingUnits.length) {
    return verifyFactDispositions(
      input.path,
      oldParsed.page,
      newParsed.page,
      input.revision,
      input.siblingWrites,
    );
  }
  const siblingTargets = [...plan.siblings.entries()]
    .filter(([id]) => plan.outgoingLinks.some((l) => l.targetId === id))
    .map(([id, target]) => ({ id, active: target.active }));
  const schema = z.object({ verdicts: z.array(factDispositionVerdictItemSchema) }).strict();
  const budget = inputByteLimit(root, FACT_DISPOSITION_CHECK_RULES);
  const decision = await runStructured(
    root,
    {
      kind: "fact-disposition-check-v1",
      origin: input.origin,
      policy: input.policy,
      rules: FACT_DISPOSITION_CHECK_RULES,
      data: {
        mode: "fact-disposition-check",
        pageId: plan.pageId,
        path: input.path,
        oldActive: plan.oldActive,
        candidateActive: plan.nextActive,
        pendingFacts: plan.pendingUnits,
        siblingTargets,
      },
      schema,
      maxInputChars: budget,
      timeoutMs: PAGE_TEXT_TIMEOUT_MS,
    },
    deps,
  );
  const failures: string[] = [];
  const sealed: FactDispositionEntry[] = [];
  for (const pending of plan.pendingUnits) {
    const v = decision.value.verdicts.find((item) => item.index === pending.index);
    if (!v?.preserved || !v.outlet || !v.targetQuote) {
      failures.push(`${pending.fact}（${v?.reason ?? "未提供复核结论"}）`);
      continue;
    }
    const targetHash =
      v.outlet === "migrated" && v.targetPage ? plan.siblings.get(v.targetPage)?.hash : undefined;
    sealed.push({
      pageId: plan.pageId,
      baseHash: plan.baseHash,
      candidateHash: plan.candidateHash,
      fact: pending.fact,
      ...(pending.context ? { context: pending.context } : {}),
      outlet: v.outlet,
      verification: "semantic-check",
      targetQuote: v.targetQuote,
      ...(v.targetPage ? { targetPage: v.targetPage } : {}),
      ...(v.targetAnchor ? { targetAnchor: v.targetAnchor } : {}),
      ...(targetHash ? { targetCandidateHash: targetHash } : {}),
      reason: v.reason,
      ...(input.checkId ? { checkId: input.checkId } : {}),
    });
  }
  if (failures.length > 0) {
    throw new Error(`旧页修订事实去向未闭合（${input.path}）：${failures.slice(0, 3).join(" ｜ ")}`);
  }
  return verifyFactDispositions(
    input.path,
    oldParsed.page,
    newParsed.page,
    input.revision,
    input.siblingWrites,
    sealed,
  );
}
