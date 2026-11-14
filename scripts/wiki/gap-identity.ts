/**
 * 说法不同、问的是同一件事也算同一个缺口（用户 2026-09-23 定）。逐字比较认不出换了说法的同一问，
 * 零花费的相似度又分不清版本与对象的差别，所以只在缺口信号要新建一条、库里又有别的缺口时问一次模型。
 * 判定走结构化判定：记进共享账本、回执存档；判为同一题的问法作为那条缺口的别名记下，判错了用 splitGapAlias 拆开。
 */
import { z } from "zod";
import type { RunAgent } from "./batch";
import { gapIdentity, gapKey, listGaps } from "./gap-ledger";
import { runStructured } from "./structured";

const RULES =
  '判断「新问题」（new）是否和「已记录的缺口」（recorded）中的某一条问的是同一件事。同一件事是指问的对象（参数、组件、页面）、版本或分支范围、想知道的方面都相同；只是换了说法、语序、详略、中英文或标点，算同一件事。对象、版本、分支或想知道的方面有任何不同，或者只是话题相关，都不算。context 是提问时的会话前文，只用来理解指代。拿不准就判不同。只返回 JSON：{"same":"候选的 id 或 null","reason":"一句话理由"}。';

export async function judgeGapIdentity(
  root: string,
  input: { question: string; contextQuestions: string[]; signal?: AbortSignal },
  deps: { runAgent?: RunAgent } = {},
): Promise<{ entryKey: string; decision: string } | undefined> {
  input.signal?.throwIfAborted();
  const key = gapKey(input.question, input.contextQuestions);
  const gaps = listGaps(root);
  if (!gaps.length || gaps.some((g) => g.key === key || g.aliases?.some((a) => a.key === key)))
    return undefined;
  const recorded = gaps.map((g, i) => {
    const first = g.occurrences[0]!;
    return { id: `g${i + 1}`, key: g.key, ...gapIdentity(first.question, first.contextQuestions) };
  });
  const ids = recorded.map((r) => r.id);
  const { jobId, value } = await runStructured(
    root,
    {
      kind: "gap-identity-v1",
      origin: "gap",
      data: {
        new: gapIdentity(input.question, input.contextQuestions),
        recorded: recorded.map(({ id, question, context }) => ({ id, question, context })),
      },
      rules: RULES,
      schema: z
        .object({ same: z.string().nullable(), reason: z.string().trim().min(1).max(2000) })
        .strict()
        .refine((v) => v.same === null || ids.includes(v.same), "判定指向了候选以外的缺口"),
      policy: { maxAttempts: 1, maxCostUsd: 0.3, reserveUsd: 0.3 },
      signal: input.signal,
    },
    deps,
  );
  const same = recorded.find((r) => r.id === value.same);
  return same ? { entryKey: same.key, decision: jobId } : undefined;
}
