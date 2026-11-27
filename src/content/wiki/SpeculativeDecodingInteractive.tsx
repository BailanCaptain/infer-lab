import { type KeyboardEvent, useEffect, useId, useMemo, useState } from "react";
import type { InteractiveDiagramProps } from "./QuantizationIntuitionInteractive";
import { eduBtnStyle, WikiEduSandboxShell } from "./WikiEduSandboxShell";

export const SPECULATIVE_DECODING_APPROVED_SHA256 =
  "5d8d6e36ca97828a56cf52f1d1a364e7c95187e0f8e85bf58b9067ba9bb92058";

export type SpecDecodeStep = 1 | 2 | 3 | 4;
export type SpecDecodeMode = "sandbox" | "svg";
export const SPEC_CANDIDATE_KS = [3, 5] as const;
export type SpecCandidateK = (typeof SPEC_CANDIDATE_KS)[number];
export const SPEC_VERDICT_BRANCHES = ["first-wrong", "mismatch-3", "all-hit"] as const;
export type SpecVerdictBranch = (typeof SPEC_VERDICT_BRANCHES)[number];
export const SPEC_VERIFY_MODES = ["greedy", "rejection"] as const;
export type SpecVerifyMode = (typeof SPEC_VERIFY_MODES)[number];
export const SPEC_ACCEPT_RATES = [0.25, 0.5, 0.75, 0.9] as const;

export interface SpecVerifySlot {
  readonly pos: number;
  readonly inputWord: string;
  readonly inputRole: string;
  readonly mainPred: string;
  readonly greedyPred?: string | undefined;
  readonly predTargetPos: number;
  readonly verdict: "hit" | "mismatch" | "discard" | "bonus";
  readonly verdictLabel: string;
  readonly finalCommitted: string | null;
  readonly kvValidAfterVerify: boolean;
  readonly acceptProb?: number | undefined;
  readonly uAccept?: number | undefined;
  readonly uResidual?: number | undefined;
  readonly slotResidualProbs?: readonly [number, number, number] | undefined;
}

export const SPEC_VERIFY_SLOTS: readonly SpecVerifySlot[] = [
  {
    pos: 5,
    inputWord: "猫",
    inputRole: "已确定末词",
    mainPred: "坐",
    predTargetPos: 6,
    verdict: "hit",
    verdictLabel: "✓ 坐 = 候选1「坐」",
    finalCommitted: "坐（位置 6）",
    kvValidAfterVerify: true,
  },
  {
    pos: 6,
    inputWord: "坐",
    inputRole: "草稿候选 1",
    mainPred: "在",
    predTargetPos: 7,
    verdict: "hit",
    verdictLabel: "✓ 在 = 候选2「在」",
    finalCommitted: "在（位置 7）",
    kvValidAfterVerify: true,
  },
  {
    pos: 7,
    inputWord: "在",
    inputRole: "草稿候选 2",
    mainPred: "垫子",
    predTargetPos: 8,
    verdict: "mismatch",
    verdictLabel: "✗ 垫子 ≠ 候选3「床」",
    finalCommitted: "垫子（位置 8 · 主模型改写）",
    kvValidAfterVerify: true,
  },
  {
    pos: 8,
    inputWord: "床",
    inputRole: "草稿候选 3",
    mainPred: "上",
    predTargetPos: 9,
    verdict: "discard",
    verdictLabel: "作废（读过错词「床」）",
    finalCommitted: null,
    kvValidAfterVerify: false,
  },
];

export interface SpecDecodeStepSpec {
  readonly step: SpecDecodeStep;
  readonly shortBtn: string;
  readonly badgeText: string;
  readonly title: string;
  readonly takeaway: string;
  readonly kpi: string;
  readonly detail: string;
}

export const SPEC_DECODE_STEPS: readonly SpecDecodeStepSpec[] = [
  {
    step: 1,
    shortBtn: "① 草稿连猜 3 词",
    badgeText: "步骤 1 / 4 · 便宜草拟",
    title: "动作 ① · 接在已确定「猫」后面，轻量草稿层快速连猜「坐、在、床」",
    takeaway: "大模型每步搬一遍权重太贵：先让超轻草稿层（如 MTP / EAGLE）顺着「猫」飞快往后猜出 3 个候选词。",
    kpi: "拼成 1 + 3 = 4 格待验",
    detail:
      "设已确定末词「猫」位于位置 5，草稿数 K = 3（猜位置 6「坐」、位置 7「在」、位置 8「床」）。单层 MTP 通过把同一预测层串行跑 3 遍产出 3 个候选。",
  },
  {
    step: 2,
    shortBtn: "② 主模型一次并验",
    badgeText: "步骤 2 / 4 · 单次前向",
    title: "动作 ② · 主模型只搬一次权重，把 [猫, 坐, 在, 床] 4 格并行算完",
    takeaway:
      "4 格一起送进主模型做 1 次并行前向！主模型在每一格都给出它认为的「下一格标准答案」：[坐, 在, 垫子, 上]。",
    kpi: "1 次前向产出 4 个预测",
    detail:
      "利用批内复用同一份权重的机会，1 次前向并行算出 4 个位置的预测：读「猫」预测位置 6 为「坐」，读「猫 坐」预测位置 7 为「在」，读「猫 坐 在」预测位置 8 为「垫子」。",
  },
  {
    step: 3,
    shortBtn: "③ 错开一格批改",
    badgeText: "步骤 3 / 4 · 逐位核对",
    title: "动作 ③ · 错位比对：前两词命中，第 3 格「垫子 ≠ 床」停笔，末格作废",
    takeaway:
      "前两格「坐」「在」全对！第 3 格主模型说「垫子」而草稿猜「床」——立刻在此停下，第 4 格因读过错词作废。",
    kpi: "命中 2 词 · 分歧停在位置 8",
    detail:
      "Greedy 下直接比相等；随机采样（T>0）则走拒绝采样 min(1, p(x)/q(x)) 与残差分布 norm(max(0, p-q)) 补抽，严格保持与主模型直接采样完全一致的输出分布（默认关闭有损的 block/entropy verify）。",
  },
  {
    step: 4,
    shortBtn: "④ 命中全收保底进 1",
    badgeText: "步骤 4 / 4 · 零损多进",
    title: "动作 ④ · 收下「坐、在」并在分歧点写主模型的「垫子」，一轮净出 3 词！",
    takeaway:
      "1 次主模型前向直接写下「坐、在、垫子」3 个词！就算第 1 词猜错也保底进 1 词；若 3 词全对更能白赚第 4 个奖励词！",
    kpi: "1 轮净写 3 词（保底 ≥1，封顶 4）",
    detail:
      "被拒位置 8 原先写下的「床」KV 无需擦除：调度器将已算计数从 9 退回 8，下一轮送入「垫子 + 新草稿（上 打 盹）」时直接在位置 8 原地覆写（KDA 等递推层则靠 K+1 份状态槽选回位置 7 状态）。",
  },
];

export interface SpecSlotProbTable {
  readonly vocab: readonly [string, string, string];
  readonly p: readonly [number, number, number];
  readonly q: readonly [number, number, number];
  readonly uAccept: number;
  readonly uResidual: number;
}

export interface SpecBonusProbTable {
  readonly vocab: readonly [string, string, string];
  readonly p: readonly [number, number, number];
  readonly uBonus: number;
}

export interface RejectionStepEval {
  readonly vocab: readonly [string, string, string];
  readonly p: readonly [number, number, number];
  readonly q: readonly [number, number, number];
  readonly draftWord: string;
  readonly greedyWord: string;
  readonly pDraft: number;
  readonly qDraft: number;
  readonly acceptProb: number;
  readonly uAccept: number;
  readonly acceptedInGreedy: boolean;
  readonly acceptedInRejection: boolean;
  readonly residualProbs: readonly [number, number, number];
  readonly uResidual: number;
  readonly residualWord: string;
}

export interface SpecSandboxComputedState {
  readonly k: SpecCandidateK;
  readonly branch: SpecVerdictBranch;
  readonly verifyMode: SpecVerifyMode;
  readonly acceptRate: number;
  readonly slots: readonly SpecVerifySlot[];
  readonly acceptedDrafts: number;
  readonly committedCount: number;
  readonly committedWords: readonly string[];
  readonly totalComputedBeforeRollback: number;
  readonly nextOverwritePos: number;
  readonly discardedKvCount: number;
  readonly expectedTokens: number;
  readonly expectedFormulaText: string;
  readonly acceptThreshold: number;
  readonly residualProbs: readonly [number, number, number];
  readonly focusSlotPos: number;
  readonly focusVocab: readonly [string, string, string];
  readonly focusTargetProbs: readonly [number, number, number];
  readonly focusDraftProbs: readonly [number, number, number];
  readonly focusDraftWord: string;
  readonly focusGreedyWord: string;
  readonly focusResidualWord: string;
  readonly focusUAccept: number;
  readonly focusUResidual: number;
}

export function sampleCategorical(
  vocab: readonly [string, string, string],
  probs: readonly [number, number, number],
  u: number,
): string {
  let cum = 0;
  let fallback = vocab[0]!;
  for (let i = 0; i < vocab.length; i++) {
    const prob = probs[i]!;
    if (prob <= 0) continue;
    fallback = vocab[i]!;
    cum += prob;
    if (u <= cum + 1e-9) return vocab[i]!;
  }
  return fallback;
}

export function evaluateRejectionStep(table: SpecSlotProbTable, draftWord: string): RejectionStepEval {
  const { vocab, p, q, uAccept, uResidual } = table;
  const maxIdx = p[1] > p[0] ? (p[2] > p[1] ? 2 : 1) : p[2] > p[0] ? 2 : 0;
  const greedyWord = vocab[maxIdx]!;
  const draftIdx = Math.max(0, vocab.indexOf(draftWord));
  const pDraft = p[draftIdx]!;
  const qDraft = q[draftIdx]!;
  const rawAcceptProb = qDraft <= 0 ? 1 : Math.min(1, pDraft / qDraft);
  const acceptProb = Number(rawAcceptProb.toFixed(4));
  const rawRes = [Math.max(0, p[0] - q[0]), Math.max(0, p[1] - q[1]), Math.max(0, p[2] - q[2])];
  const resSum = rawRes[0]! + rawRes[1]! + rawRes[2]!;
  const residualProbs: readonly [number, number, number] =
    resSum > 0
      ? [
          Number((rawRes[0]! / resSum).toFixed(4)),
          Number((rawRes[1]! / resSum).toFixed(4)),
          Number((rawRes[2]! / resSum).toFixed(4)),
        ]
      : [0, 0, 0];
  const residualWord = resSum > 0 ? sampleCategorical(vocab, residualProbs, uResidual) : greedyWord;
  return {
    vocab,
    p,
    q,
    draftWord,
    greedyWord,
    pDraft,
    qDraft,
    acceptProb,
    uAccept,
    acceptedInGreedy: draftWord === greedyWord,
    acceptedInRejection: uAccept <= rawAcceptProb,
    residualProbs,
    uResidual,
    residualWord,
  };
}

export const SPEC_SLOT_PROB_TABLES: Record<SpecVerdictBranch, readonly SpecSlotProbTable[]> = {
  "first-wrong": [
    { vocab: ["坐", "趴", "跳"], p: [0.52, 0.38, 0.1], q: [0.4, 0.1, 0.5], uAccept: 0.6, uResidual: 0.55 },
    { vocab: ["下", "在", "稳"], p: [0.6, 0.25, 0.15], q: [0.2, 0.65, 0.15], uAccept: 0.5, uResidual: 0.3 },
    { vocab: ["垫子", "地毯", "床"], p: [0.5, 0.4, 0.1], q: [0.4, 0.35, 0.25], uAccept: 0.7, uResidual: 0.6 },
    { vocab: ["上", "里", "旁"], p: [0.68, 0.22, 0.1], q: [0.8, 0.1, 0.1], uAccept: 0.6, uResidual: 0.5 },
    { vocab: ["打", "睡", "趴"], p: [0.6, 0.25, 0.15], q: [0.2, 0.65, 0.15], uAccept: 0.7, uResidual: 0.4 },
  ],
  "mismatch-3": [
    { vocab: ["坐", "趴", "跳"], p: [0.72, 0.18, 0.1], q: [0.8, 0.1, 0.1], uAccept: 0.45, uResidual: 0.4 },
    { vocab: ["在", "向", "往"], p: [0.8, 0.12, 0.08], q: [0.64, 0.2, 0.16], uAccept: 0.85, uResidual: 0.3 },
    {
      vocab: ["垫子", "地毯", "床"],
      p: [0.5, 0.4, 0.1],
      q: [0.15, 0.05, 0.8],
      uAccept: 0.5,
      uResidual: 0.75,
    },
    { vocab: ["上", "里", "旁"], p: [0.68, 0.22, 0.1], q: [0.8, 0.1, 0.1], uAccept: 0.6, uResidual: 0.5 },
    { vocab: ["打", "睡", "趴"], p: [0.6, 0.25, 0.15], q: [0.2, 0.65, 0.15], uAccept: 0.7, uResidual: 0.4 },
  ],
  "all-hit": [
    { vocab: ["坐", "趴", "跳"], p: [0.72, 0.18, 0.1], q: [0.8, 0.1, 0.1], uAccept: 0.45, uResidual: 0.4 },
    { vocab: ["在", "向", "往"], p: [0.8, 0.12, 0.08], q: [0.64, 0.2, 0.16], uAccept: 0.85, uResidual: 0.3 },
    { vocab: ["垫子", "地毯", "床"], p: [0.5, 0.4, 0.1], q: [0.4, 0.35, 0.25], uAccept: 0.7, uResidual: 0.6 },
    { vocab: ["上", "里", "旁"], p: [0.68, 0.22, 0.1], q: [0.8, 0.1, 0.1], uAccept: 0.6, uResidual: 0.5 },
    { vocab: ["打", "睡", "趴"], p: [0.6, 0.25, 0.15], q: [0.75, 0.15, 0.1], uAccept: 0.55, uResidual: 0.5 },
  ],
};

export const SPEC_BONUS_PROB_TABLES: Record<SpecCandidateK, SpecBonusProbTable> = {
  3: { vocab: ["上", "里", "旁"], p: [0.68, 0.22, 0.1], uBonus: 0.78 },
  5: { vocab: ["盹", "呼", "欠"], p: [0.7, 0.2, 0.1], uBonus: 0.82 },
};

export function computeSpecDecodeState(
  k: SpecCandidateK = 3,
  branch: SpecVerdictBranch = "mismatch-3",
  verifyMode: SpecVerifyMode = "greedy",
  acceptRate = 0.75,
): SpecSandboxComputedState {
  const clampedAlpha = Math.max(0.05, Math.min(0.99, Number(acceptRate.toFixed(2))));
  const draftAll =
    branch === "first-wrong"
      ? (["跳", "在", "垫子", "上", "睡"] as const)
      : branch === "mismatch-3"
        ? (["坐", "在", "床", "上", "睡"] as const)
        : (["坐", "在", "垫子", "上", "打"] as const);
  const drafts = draftAll.slice(0, k);
  const inputWords = ["猫", ...drafts];
  const branchTables = SPEC_SLOT_PROB_TABLES[branch];
  const stepEvals = drafts.map((dw, idx) => evaluateRejectionStep(branchTables[idx]!, dw));

  let divergeDraftIdx = -1; // 0..k-1
  for (let i = 0; i < k; i++) {
    const ev = stepEvals[i]!;
    const accepted = verifyMode === "rejection" ? ev.acceptedInRejection : ev.acceptedInGreedy;
    if (!accepted) {
      divergeDraftIdx = i;
      break;
    }
  }
  const acceptedDrafts = divergeDraftIdx === -1 ? k : divergeDraftIdx;
  const committedWords: string[] = [];
  const slots: SpecVerifySlot[] = [];

  const bonusTable = SPEC_BONUS_PROB_TABLES[k];
  const bonusMaxIdx =
    bonusTable.p[1] > bonusTable.p[0]
      ? bonusTable.p[2] > bonusTable.p[1]
        ? 2
        : 1
      : bonusTable.p[2] > bonusTable.p[0]
        ? 2
        : 0;
  const greedyBonus = bonusTable.vocab[bonusMaxIdx]!;
  const sampledBonus = sampleCategorical(bonusTable.vocab, bonusTable.p, bonusTable.uBonus);

  for (let idx = 0; idx <= k; idx++) {
    const pos = 5 + idx;
    const predTargetPos = pos + 1;
    const inputWord = inputWords[idx]!;
    const inputRole = idx === 0 ? "已确定末词" : `草稿候选 ${idx}`;
    const kvValidAfterVerify = idx <= acceptedDrafts;

    if (idx < k) {
      const ev = stepEvals[idx]!;
      if (divergeDraftIdx === -1 || idx < divergeDraftIdx) {
        const resolvedWord = verifyMode === "rejection" ? ev.draftWord : ev.greedyWord;
        committedWords.push(resolvedWord);
        slots.push({
          pos,
          inputWord,
          inputRole,
          mainPred: resolvedWord,
          greedyPred: ev.greedyWord,
          predTargetPos,
          verdict: "hit",
          verdictLabel:
            verifyMode === "rejection"
              ? `✓ u=${ev.uAccept} ≤ min(1,${ev.pDraft}/${ev.qDraft})=${ev.acceptProb} 留「${ev.draftWord}」`
              : `✓ ${ev.greedyWord} = 候选${idx + 1}「${ev.draftWord}」`,
          finalCommitted:
            verifyMode === "rejection"
              ? `${resolvedWord}（位置 ${predTargetPos} · p/q 留存）`
              : `${resolvedWord}（位置 ${predTargetPos}）`,
          kvValidAfterVerify,
          acceptProb: ev.acceptProb,
          uAccept: ev.uAccept,
          uResidual: ev.uResidual,
          slotResidualProbs: ev.residualProbs,
        });
      } else if (idx === divergeDraftIdx) {
        const resolvedWord = verifyMode === "rejection" ? ev.residualWord : ev.greedyWord;
        committedWords.push(resolvedWord);
        slots.push({
          pos,
          inputWord,
          inputRole,
          mainPred: resolvedWord,
          greedyPred: ev.greedyWord,
          predTargetPos,
          verdict: "mismatch",
          verdictLabel:
            verifyMode === "rejection"
              ? `✗ u=${ev.uAccept} > p/q=${ev.acceptProb} 拒「${ev.draftWord}」· 残差抽「${resolvedWord}」`
              : `✗ ${ev.greedyWord} ≠ 候选${idx + 1}「${ev.draftWord}」`,
          finalCommitted:
            verifyMode === "rejection"
              ? `${resolvedWord}（位置 ${predTargetPos} · 残差补抽）`
              : `${resolvedWord}（位置 ${predTargetPos} · 主模型改写）`,
          kvValidAfterVerify,
          acceptProb: ev.acceptProb,
          uAccept: ev.uAccept,
          uResidual: ev.uResidual,
          slotResidualProbs: ev.residualProbs,
        });
      } else {
        slots.push({
          pos,
          inputWord,
          inputRole,
          mainPred: ev.greedyWord,
          greedyPred: ev.greedyWord,
          predTargetPos,
          verdict: "discard",
          verdictLabel: `作废（读过错词「${drafts[divergeDraftIdx]!}」）`,
          finalCommitted: null,
          kvValidAfterVerify,
        });
      }
    } else if (divergeDraftIdx === -1) {
      const bonusWord = verifyMode === "rejection" ? sampledBonus : greedyBonus;
      committedWords.push(bonusWord);
      slots.push({
        pos,
        inputWord,
        inputRole,
        mainPred: bonusWord,
        greedyPred: greedyBonus,
        predTargetPos,
        verdict: "bonus",
        verdictLabel:
          verifyMode === "rejection"
            ? `★ 全中按 p 采样奖励词「${bonusWord}」(u=${bonusTable.uBonus})`
            : `★ 全中直收奖励词「${bonusWord}」`,
        finalCommitted:
          verifyMode === "rejection"
            ? `${bonusWord}（位置 ${predTargetPos} · p 采样奖励词）`
            : `${bonusWord}（位置 ${predTargetPos} · 奖励词）`,
        kvValidAfterVerify: true,
      });
    } else {
      slots.push({
        pos,
        inputWord,
        inputRole,
        mainPred: greedyBonus,
        greedyPred: greedyBonus,
        predTargetPos,
        verdict: "discard",
        verdictLabel: `作废（读过错词「${drafts[divergeDraftIdx]!}」）`,
        finalCommitted: null,
        kvValidAfterVerify: false,
      });
    }
  }

  let expSum = 0;
  const terms: string[] = ["1"];
  for (let m = 1; m <= k; m++) {
    expSum += clampedAlpha ** m;
    terms.push(m === 1 ? `${clampedAlpha}` : `${clampedAlpha}^${m}`);
  }
  const expectedTokens = Number((1 + expSum).toFixed(6));
  const focusIdx = divergeDraftIdx !== -1 ? divergeDraftIdx : 0;
  const focusEv = stepEvals[focusIdx]!;

  return {
    k,
    branch,
    verifyMode,
    acceptRate: clampedAlpha,
    slots,
    acceptedDrafts,
    committedCount: committedWords.length,
    committedWords,
    totalComputedBeforeRollback: 5 + k + 1,
    nextOverwritePos: 5 + acceptedDrafts + 1,
    discardedKvCount: k - acceptedDrafts,
    expectedTokens,
    expectedFormulaText: terms.join(" + "),
    acceptThreshold: focusEv.acceptProb,
    residualProbs: focusEv.residualProbs,
    focusSlotPos: 6 + focusIdx,
    focusVocab: focusEv.vocab,
    focusTargetProbs: focusEv.p,
    focusDraftProbs: focusEv.q,
    focusDraftWord: focusEv.draftWord,
    focusGreedyWord: focusEv.greedyWord,
    focusResidualWord: focusEv.residualWord,
    focusUAccept: focusEv.uAccept,
    focusUResidual: focusEv.uResidual,
  };
}

export interface SpeculativeDecodingInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: SpecDecodeMode | undefined;
  readonly initialStep?: SpecDecodeStep | undefined;
  readonly initialK?: SpecCandidateK | undefined;
  readonly initialBranch?: SpecVerdictBranch | undefined;
  readonly initialVerifyMode?: SpecVerifyMode | undefined;
  readonly initialAcceptRate?: number | undefined;
}

export function SpeculativeDecodingInteractive({
  id,
  safeSvg,
  caption,
  scrollRef,
  scrollable,
  onScroll,
  initialMode = "sandbox",
  initialStep = 3,
  initialK = 3,
  initialBranch = "mismatch-3",
  initialVerifyMode = "greedy",
  initialAcceptRate = 0.75,
}: SpeculativeDecodingInteractiveProps) {
  const [mode, setMode] = useState<SpecDecodeMode>(initialMode);
  const [step, setStep] = useState<SpecDecodeStep>(initialStep);
  const [k, setK] = useState<SpecCandidateK>(initialK);
  const [branch, setBranch] = useState<SpecVerdictBranch>(initialBranch);
  const [verifyMode, setVerifyMode] = useState<SpecVerifyMode>(initialVerifyMode);
  const [acceptRate, setAcceptRate] = useState<number>(initialAcceptRate);
  const [playing, setPlaying] = useState(false);

  const spec = SPEC_DECODE_STEPS[step - 1]!;
  const state = useMemo(
    () => computeSpecDecodeState(k, branch, verifyMode, acceptRate),
    [k, branch, verifyMode, acceptRate],
  );
  const isDefaultScenario = k === 3 && branch === "mismatch-3" && verifyMode === "greedy";
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const mTeal = `${id}-${uid}-sd-teal`;
  const mRed = `${id}-${uid}-sd-red`;
  const mMuted = `${id}-${uid}-sd-muted`;

  useEffect(() => {
    if (!playing || mode !== "sandbox") return;
    const timer = setInterval(() => {
      setStep((prev) => {
        if (prev >= 4) {
          setPlaying(false);
          return 4;
        }
        return (prev + 1) as SpecDecodeStep;
      });
    }, 1800);
    return () => clearInterval(timer);
  }, [playing, mode]);

  const selectStep = (next: SpecDecodeStep) => {
    setPlaying(false);
    setMode("sandbox");
    setStep(next);
  };

  const togglePlay = () => {
    setMode("sandbox");
    if (playing) {
      setPlaying(false);
      return;
    }
    if (step >= 4) setStep(1);
    setPlaying(true);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const targetTag = (event.target as { tagName?: string } | null)?.tagName?.toUpperCase();
    if (targetTag === "INPUT" && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      return;
    }
    if (
      scrollable &&
      typeof Element !== "undefined" &&
      event.target instanceof Element &&
      event.target.classList.contains("wiki-diagram-svg") &&
      (event.key === "ArrowLeft" || event.key === "ArrowRight")
    ) {
      return;
    }
    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        selectStep(Math.min(4, step + 1) as SpecDecodeStep);
        break;
      case "ArrowLeft":
        event.preventDefault();
        selectStep(Math.max(1, step - 1) as SpecDecodeStep);
        break;
      case "1":
      case "2":
      case "3":
      case "4":
        event.preventDefault();
        selectStep(Number(event.key) as SpecDecodeStep);
        break;
      case "0":
      case "Escape":
        event.preventDefault();
        setPlaying(false);
        setMode("svg");
        break;
    }
  };

  const dynamicTakeaway = isDefaultScenario
    ? spec.takeaway
    : step === 1
      ? `接在位置 5「猫」后面，轻量草稿连猜 K=${k} 个候选词，拼成 1+${k}=${k + 1} 格待主模型一次验完。`
      : step === 2
        ? `主模型只读一次权重，把 ${k + 1} 格并行前向算完，每格同时吐出下一位置的预测分布。`
        : branch === "first-wrong"
          ? verifyMode === "rejection"
            ? `首格候选「${state.focusDraftWord}」因 u=${state.focusUAccept} > min(1,p/q)=${state.acceptThreshold} 被拒！按残差分布补抽「${state.committedWords[0]!}」停笔，后 ${state.discardedKvCount} 格作废，保底净进 1 词！`
            : `首格候选即不符！当场采用主模型第 1 格预测「${state.committedWords[0]!}」停笔，后 ${state.discardedKvCount} 格作废，保底仍净进 1 词！`
          : branch === "all-hit"
            ? verifyMode === "rejection"
              ? `全部 K=${k} 个草稿候选均满足 u ≤ min(1,p/q) 留存！第 ${k + 1} 格按主模型分布 p 采样奖励词「${state.committedWords[k]!}」，一轮净进 ${state.committedCount} 词！`
              : `全部 K=${k} 个草稿候选全中！第 ${k + 1} 格预测也顺势成立，白赚奖励词「${state.committedWords[k]!}」，一轮净进 ${state.committedCount} 词！`
            : verifyMode === "rejection"
              ? `前 2 词通过 u ≤ min(1,p/q) 留存，第 3 格「${state.focusDraftWord}」因 u=${state.focusUAccept} > p/q=${state.acceptThreshold} 被拒并从残差分布补抽「${state.committedWords[2]!}」，一轮净收「${state.committedWords.join("、")}」共 ${state.committedCount} 词！`
              : `前 2 词命中、第 3 格分歧停笔，后 ${state.discardedKvCount} 格因读过错词作废，一轮稳收「${state.committedWords.join("、")}」共 ${state.committedCount} 词！`;

  const dynamicKpi = isDefaultScenario
    ? spec.kpi
    : verifyMode === "rejection"
      ? `本轮净写 ${state.committedCount} 词 · E[词数]=${state.expectedTokens}`
      : step <= 2
        ? `1 + ${k} = ${k + 1} 格单次并验`
        : `净写 ${state.committedCount} 词 · 下轮覆写位 ${state.nextOverwritePos}`;

  return (
    <WikiEduSandboxShell
      id={id}
      caption={caption}
      safeSvg={safeSvg}
      mode={mode}
      onToggleMode={(next) => {
        setPlaying(false);
        setMode(next);
      }}
      scrollRef={scrollRef}
      scrollable={scrollable}
      onScroll={onScroll}
      kickerTag="母版 A · 分步机制演化"
      kickerTitle="Speculative Decoding（轻量连猜 K 词 + 主模型一次批改）"
      question="先让小草稿瞎猜后面几个词，万一猜错了会不会把最终回答带跑偏？"
      toolbarLabel="投机解码草拟与并行验证四步控制"
      onToolbarKeyDown={handleKeyDown}
      extraRootAttrs={{
        "data-step": step,
        "data-k": k,
        "data-branch": branch,
        "data-verify-mode": verifyMode,
      }}
      toolbar={
        <>
          <div className="wiki-edu-btn-row">
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="spec-decode-autoplay"
              aria-pressed={playing}
              style={eduBtnStyle(playing, "dark")}
              onClick={togglePlay}
            >
              {playing ? "⏸ 暂停演示" : "▶ 自动演示"}
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              disabled={step <= 1}
              style={eduBtnStyle(false)}
              onClick={() => selectStep(Math.max(1, step - 1) as SpecDecodeStep)}
            >
              ‹ 上一步
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              disabled={step >= 4}
              style={eduBtnStyle(false)}
              onClick={() => selectStep(Math.min(4, step + 1) as SpecDecodeStep)}
            >
              下一步 ›
            </button>
            {SPEC_DECODE_STEPS.map((item) => {
              const active = mode === "sandbox" && step === item.step;
              return (
                <button
                  key={item.step}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`spec-decode-step-${item.step}`}
                  aria-pressed={active}
                  aria-current={active ? "step" : undefined}
                  style={eduBtnStyle(active, "teal")}
                  onClick={() => selectStep(item.step)}
                >
                  {item.shortBtn}
                </button>
              );
            })}
          </div>

          <fieldset className="wiki-edu-btn-row" aria-label="候选长度、核对分支与采样模式">
            {SPEC_CANDIDATE_KS.map((kv) => {
              const active = mode === "sandbox" && k === kv;
              return (
                <button
                  key={kv}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`spec-decode-k-${kv}`}
                  aria-pressed={active}
                  style={eduBtnStyle(active, "dark")}
                  onClick={() => {
                    setPlaying(false);
                    setMode("sandbox");
                    setK(kv);
                  }}
                >
                  {`K=${kv}`}
                </button>
              );
            })}
            {(
              [
                ["first-wrong", "首词错进1"],
                ["mismatch-3", "第3词错(默认)"],
                ["all-hit", "全中+奖励词"],
              ] as const
            ).map(([br, label]) => {
              const active = mode === "sandbox" && branch === br;
              return (
                <button
                  key={br}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`spec-decode-branch-${br}`}
                  aria-pressed={active}
                  style={eduBtnStyle(active, "teal")}
                  onClick={() => {
                    setPlaying(false);
                    setMode("sandbox");
                    setBranch(br);
                  }}
                >
                  {label}
                </button>
              );
            })}
            {(
              [
                ["greedy", "Greedy"],
                ["rejection", "拒绝采样(p,q)"],
              ] as const
            ).map(([vm, label]) => {
              const active = mode === "sandbox" && verifyMode === vm;
              return (
                <button
                  key={vm}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`spec-decode-mode-${vm}`}
                  aria-pressed={active}
                  style={eduBtnStyle(active, "dark")}
                  onClick={() => {
                    setPlaying(false);
                    setMode("sandbox");
                    setVerifyMode(vm);
                  }}
                >
                  {label}
                </button>
              );
            })}
            {verifyMode === "rejection" && (
              <label className="wiki-edu-slider-chip">
                <span>{`α=${state.acceptRate.toFixed(2)}`}</span>
                <input
                  type="range"
                  min="0.25"
                  max="0.90"
                  step="0.05"
                  value={acceptRate}
                  data-testid="spec-decode-alpha-slider"
                  onChange={(e) => {
                    setPlaying(false);
                    setMode("sandbox");
                    setAcceptRate(Number(e.target.value));
                  }}
                />
              </label>
            )}
          </fieldset>
        </>
      }
      takeawayBadge={spec.badgeText}
      takeawayTone={step === 4 ? "accent" : branch === "first-wrong" && step >= 3 ? "warn" : "default"}
      takeaway={dynamicTakeaway}
      kpi={dynamicKpi}
      detailsSummary="查看工程与源码细节（拒绝采样保分布证明 / 被拒 KV 原地覆写 / 加速盈亏比）"
      detailsContent={
        <>
          <strong>
            {isDefaultScenario
              ? spec.title
              : `动作 ${step} · ${verifyMode === "rejection" ? "拒绝采样 min(1, p/q) 核对与残差补抽" : "Greedy 逐位核对"}（K=${k}，净收 [${state.committedWords.join("、")}]）`}
          </strong>
          ：
          {step === 4
            ? state.discardedKvCount > 0
              ? `被拒位置 ${state.nextOverwritePos} 原先写下的草稿 KV 无需擦除：调度器将已算计数从 ${state.totalComputedBeforeRollback} 退回 ${state.nextOverwritePos}，下一轮送入「${state.committedWords[state.committedWords.length - 1]} + 新草稿」时直接在位置 ${state.nextOverwritePos} 原地覆写（KDA 等递推层则靠 K+1 份状态槽选回位置 ${state.nextOverwritePos - 1} 状态）。`
              : `全部 ${k} 个草稿候选均通过核对并额外收下位置 ${state.nextOverwritePos - 1} 的奖励词「${state.committedWords[state.committedWords.length - 1]}」，无废 KV 回退，下一轮从位置 ${state.nextOverwritePos} 继续推进。`
            : spec.detail}
          （当前设定：<code>K={k}</code>，模式{" "}
          <code>{verifyMode === "rejection" ? "rejection(p,q)" : "greedy"}</code>，本轮净提交{" "}
          <code>{state.committedCount}</code> 词 <code>[{state.committedWords.join("、")}]</code>，焦点位置{" "}
          <code>{state.focusSlotPos}</code> 阈值 <code>{`min(1,p/q)=${state.acceptThreshold}`}</code>、残差{" "}
          <code>{`[${state.residualProbs.join(", ")}]`}</code>，KV 已算计数{" "}
          <code>
            {state.totalComputedBeforeRollback} → {state.nextOverwritePos}
          </code>
          ；按条件接受率 <code>α={state.acceptRate}</code> 计，单步期望提交词数{" "}
          <code>
            E = {state.expectedFormulaText} = {state.expectedTokens}
          </code>
          ）
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div className="wiki-edu-panel">
          <div className="wiki-edu-panel-head">
            <span className="wiki-edu-panel-title">
              {`① 错开一格并排批改与 KV 覆写起点（K=${k} · ${verifyMode === "rejection" ? "拒绝采样 p/q" : "Greedy"}）`}
            </span>
            <span className="wiki-edu-badge is-good">
              {step >= 4 ? `本轮净写 ${state.committedCount} 词` : `单次并验 ${k + 1} 格`}
            </span>
          </div>

          <svg
            viewBox="0 0 840 250"
            width="840"
            height="250"
            style={{ width: "100%", height: "auto", display: "block" }}
            role="img"
            aria-label={`投机解码错位核对：K=${k}，净提交 ${state.committedCount} 词`}
          >
            <defs>
              <marker
                id={mTeal}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path d="M0,1 L9,5 L0,9 z" fill="#087f73" />
              </marker>
              <marker
                id={mRed}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path d="M0,1 L9,5 L0,9 z" fill="#b54237" />
              </marker>
              <marker
                id={mMuted}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path d="M0,1 L9,5 L0,9 z" fill="#66716d" />
              </marker>
            </defs>

            <text x="420" y="22" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17211f">
              {`上排输入 1+${k}=${k + 1} 格 · 中间错位一格核对 · 下排 KV 槽位与覆写起点`}
            </text>

            {state.slots.map((slot, idx) => {
              const colStep = k === 3 ? 198 : 132;
              const startX = k === 3 ? 123 : 90;
              const boxW = k === 3 ? 148 : 112;
              const cx = startX + idx * colStep;
              const isConfirmed = idx === 0;
              const invalidInput = step >= 3 && !slot.kvValidAfterVerify;
              const isDiscardPred = step >= 3 && slot.verdict === "discard";
              const isMismatchPred = step >= 3 && slot.verdict === "mismatch";
              const isBonusPred = step >= 3 && slot.verdict === "bonus";

              return (
                <g key={slot.pos}>
                  <rect
                    x={cx - boxW / 2}
                    y="36"
                    width={boxW}
                    height="36"
                    rx="6"
                    fill={invalidInput ? "#ece9df" : isConfirmed ? "#ddf4ef" : "#fbfaf6"}
                    stroke={invalidInput ? "#d8d8cf" : "#087f73"}
                    strokeWidth="1.4"
                    strokeDasharray={isConfirmed ? undefined : "4 3"}
                  />
                  <text
                    x={cx}
                    y="59"
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="700"
                    fill={invalidInput ? "#66716d" : "#17211f"}
                  >
                    {`${slot.pos}:${slot.inputWord}${isConfirmed ? "(定)" : ""}`}
                  </text>

                  <rect
                    x={cx - boxW / 2}
                    y="122"
                    width={boxW}
                    height="36"
                    rx="6"
                    fill={
                      step < 2
                        ? "#fbfaf6"
                        : isDiscardPred
                          ? "#ece9df"
                          : isMismatchPred
                            ? "#fff0e9"
                            : isBonusPred
                              ? "#ddf4ef"
                              : "#fff4cf"
                    }
                    stroke={
                      step < 2
                        ? "#d8d8cf"
                        : isDiscardPred
                          ? "#d8d8cf"
                          : isMismatchPred
                            ? "#b54237"
                            : isBonusPred
                              ? "#087f73"
                              : "#c78300"
                    }
                    strokeWidth="1.5"
                  />
                  <text
                    x={cx}
                    y="145"
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="700"
                    fill={isDiscardPred ? "#66716d" : "#17211f"}
                  >
                    {step < 2
                      ? "待前向"
                      : step === 2
                        ? verifyMode === "rejection"
                          ? `p${slot.predTargetPos}:峰=${slot.greedyPred ?? slot.mainPred}`
                          : `预${slot.predTargetPos}:${slot.greedyPred ?? slot.mainPred}`
                        : isDiscardPred
                          ? `预${slot.predTargetPos}:作废`
                          : isMismatchPred
                            ? verifyMode === "rejection"
                              ? `拒→补${slot.predTargetPos}:${slot.mainPred}`
                              : `改${slot.predTargetPos}:${slot.mainPred}`
                            : isBonusPred
                              ? verifyMode === "rejection"
                                ? `奖${slot.predTargetPos}:${slot.mainPred}(p)`
                                : `奖${slot.predTargetPos}:${slot.mainPred}`
                              : verifyMode === "rejection"
                                ? `留${slot.predTargetPos}:${slot.mainPred}(≤${slot.acceptProb ?? 1})`
                                : `预${slot.predTargetPos}:${slot.mainPred}`}
                  </text>

                  <rect
                    x={cx - boxW / 2}
                    y="180"
                    width={boxW}
                    height="32"
                    rx="6"
                    fill={invalidInput ? "#fff0e9" : "#ddf4ef"}
                    stroke={invalidInput ? "#b54237" : "#087f73"}
                    strokeWidth="1.3"
                    strokeDasharray={invalidInput ? "4 2" : undefined}
                  />
                  <text
                    x={cx}
                    y="201"
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="700"
                    fill={invalidInput ? "#b54237" : "#087f73"}
                  >
                    {invalidInput ? `KV${slot.pos} 失效` : `KV${slot.pos} 保留`}
                  </text>
                </g>
              );
            })}

            {step >= 3 &&
              state.slots.slice(0, k).map((slot, idx) => {
                const colStep = k === 3 ? 198 : 132;
                const startX = k === 3 ? 123 : 90;
                const xCand = startX + (idx + 1) * colStep;
                const xPred = startX + idx * colStep;
                const stroke =
                  slot.verdict === "hit" ? "#087f73" : slot.verdict === "mismatch" ? "#b54237" : "#66716d";
                const marker = slot.verdict === "hit" ? mTeal : slot.verdict === "mismatch" ? mRed : mMuted;
                return (
                  <path
                    key={`wire-${slot.pos}`}
                    className={`wiki-edu-wire${slot.verdict === "hit" ? " is-flow" : ""}`}
                    d={`M ${xCand} 72 L ${xPred + 8} 120`}
                    stroke={stroke}
                    strokeDasharray={slot.verdict === "discard" ? "4 3" : undefined}
                    markerEnd={`url(#${marker})`}
                  />
                );
              })}

            {step >= 3 && branch === "all-hit" && (
              <path
                className="wiki-edu-wire is-flow"
                d={`M ${(k === 3 ? 123 : 90) + k * (k === 3 ? 198 : 132)} 158 L ${(k === 3 ? 123 : 90) + k * (k === 3 ? 198 : 132)} 178`}
                stroke="#087f73"
                markerEnd={`url(#${mTeal})`}
              />
            )}

            <text
              x="420"
              y="236"
              textAnchor="middle"
              fontSize="12"
              fontWeight="700"
              fill={state.discardedKvCount > 0 ? "#b54237" : "#087f73"}
            >
              {state.discardedKvCount > 0
                ? `净收[${state.committedWords.join("、")}] · 进度 ${state.totalComputedBeforeRollback}→退回 ${state.nextOverwritePos} 原地覆写（免擦 ${state.discardedKvCount} 格旧 KV）`
                : `✓ K=${k} 候选全中零回滚 · 净收[${state.committedWords.join("、")}]共 ${state.committedCount} 词，下轮从位置 ${state.nextOverwritePos} 续猜`}
            </text>
          </svg>
        </div>

        <div className="wiki-edu-dual-grid">
          <div className="wiki-edu-panel">
            <div className="wiki-edu-panel-head">
              <span className="wiki-edu-panel-title">② 本轮批改结论与最终落盘</span>
              <span className="wiki-edu-badge is-mid">
                {step >= 4 ? `净写 ${state.committedCount} 词` : "逐格核对"}
              </span>
            </div>

            <div className="wiki-edu-tok-list">
              {state.slots.map((slot) => {
                const tone =
                  step < 3
                    ? "is-sys"
                    : slot.verdict === "hit" || slot.verdict === "bonus"
                      ? "is-priv"
                      : slot.verdict === "mismatch"
                        ? "is-sys is-hit"
                        : "is-empty";
                const rightTag =
                  step < 3
                    ? slot.inputRole
                    : step === 3
                      ? slot.verdictLabel
                      : (slot.finalCommitted ?? "✗ 作废不写");
                return (
                  <div key={slot.pos} className={`wiki-edu-tok-pill ${tone}`}>
                    <span>{`输入 ${slot.pos}「${slot.inputWord}」→ 预测 ${slot.predTargetPos}`}</span>
                    <span className="wiki-edu-ptr-tag">{rightTag}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="wiki-edu-panel">
            <div className="wiki-edu-panel-head">
              <span className="wiki-edu-panel-title">③ 零损保分布与期望步进词数</span>
              <span className="wiki-edu-badge is-good">{`E[词数] = ${state.expectedTokens}`}</span>
            </div>

            <div className="wiki-edu-tok-list">
              <div className="wiki-edu-tok-pill is-priv">
                <span>{`期望公式 (K=${k}, α=${state.acceptRate})`}</span>
                <span className="wiki-edu-ptr-tag">{`${state.expectedFormulaText} = ${state.expectedTokens}`}</span>
              </div>
              <div className="wiki-edu-tok-pill is-sys">
                <span>
                  {`位置${state.focusSlotPos} [${state.focusVocab.join("/")}] · p=[${state.focusTargetProbs.join(",")}] · q=[${state.focusDraftProbs.join(",")}]`}
                </span>
                <span className="wiki-edu-ptr-tag">
                  {state.focusUAccept <= state.acceptThreshold
                    ? `「${state.focusDraftWord}」u=${state.focusUAccept} ≤ min(1,p/q)=${state.acceptThreshold}`
                    : `「${state.focusDraftWord}」u=${state.focusUAccept} > min(1,p/q)=${state.acceptThreshold}`}
                </span>
              </div>
              <div className="wiki-edu-tok-pill is-cow">
                <span>拒绝后残差 norm(max(0, p−q))</span>
                <span className="wiki-edu-ptr-tag">
                  {verifyMode === "greedy"
                    ? `[${state.residualProbs.join(", ")}] · Greedy 取 argmax「${state.focusGreedyWord}」`
                    : state.focusUAccept <= state.acceptThreshold
                      ? `[${state.residualProbs.join(", ")}] · 已留存免补抽`
                      : `[${state.residualProbs.join(", ")}] · u_res=${state.focusUResidual} → 抽「${state.focusResidualWord}」`}
                </span>
              </div>
            </div>

            <div className="wiki-edu-note-card">
              <strong>主模型拍板保分布</strong>：位置 {state.focusSlotPos} 上 Greedy 直取最高分词「
              {state.focusGreedyWord}」；拒绝采样按 <code>{`min(1, p/q)=${state.acceptThreshold}`}</code>{" "}
              判定候选「{state.focusDraftWord}」，被拒从残差{" "}
              <code>{`[${state.residualProbs.join(", ")}]`}</code> 按{" "}
              <code>{`u_res=${state.focusUResidual}`}</code> 补抽「{state.focusResidualWord}
              」，边际概率严格等于 <code>{state.focusTargetProbs.join(" / ")}</code>。
            </div>
          </div>
        </div>
      </div>
    </WikiEduSandboxShell>
  );
}
