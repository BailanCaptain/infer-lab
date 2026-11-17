import { useMemo, useRef, useSyncExternalStore } from "react";
import { wikiRequest } from "./api";
import type { ReviewState } from "./ReviewPane";

export interface AnswerSaveState {
  open: boolean;
  provider?: "claude" | "codex";
  budget: string;
  lockedBudget?: number;
  started: boolean;
  canNewAttempt: boolean;
  busy: boolean;
  error: string;
  activeReviewId?: string;
  rejectedReviewId?: string;
}

export interface AnswerSaveActions {
  openForm: () => Promise<void>;
  setBudget: (value: string) => void;
  submit: () => Promise<void>;
  viewReview: () => void;
}

export function createAnswerSaveController({
  answerId,
  onReview,
  request = wikiRequest,
}: {
  answerId: string;
  onReview: (id: string) => void;
  request?: <T>(path: string, body?: unknown) => Promise<T>;
}) {
  let disposed = false;
  let open = false;
  let provider: "claude" | "codex" | undefined;
  let budget = "";
  let lockedBudget: number | undefined;
  let started = false;
  let canNewAttempt = false;
  let busy = false;
  let error = "";
  let activeReviewId: string | undefined;
  let rejectedReviewId: string | undefined;
  let loadingStatus = false;

  const listeners = new Set<() => void>();

  let snapshot: AnswerSaveState = {
    open,
    budget,
    started,
    canNewAttempt,
    busy,
    error,
  };

  const sync = () => {
    snapshot = {
      open,
      ...(provider !== undefined ? { provider } : {}),
      budget,
      ...(lockedBudget !== undefined ? { lockedBudget } : {}),
      started,
      canNewAttempt,
      busy,
      error,
      ...(activeReviewId !== undefined ? { activeReviewId } : {}),
      ...(rejectedReviewId !== undefined ? { rejectedReviewId } : {}),
    };
  };

  const notify = () => {
    if (disposed) return;
    for (const listener of listeners) listener();
  };

  async function ensureProvider(): Promise<void> {
    if (provider || loadingStatus) return;
    loadingStatus = true;
    try {
      const value = await request<{ models: { chatProvider: "claude" | "codex" } }>("status");
      if (disposed) return;
      provider = value.models.chatProvider;
      sync();
      notify();
    } catch (err) {
      if (disposed) return;
      error = String(err);
      sync();
      notify();
    } finally {
      loadingStatus = false;
    }
  }

  async function openForm(): Promise<void> {
    if (!open) {
      open = true;
      sync();
      notify();
    }
    await ensureProvider();
  }

  function setBudget(value: string): void {
    if (budget === value) return;
    budget = value;
    sync();
    notify();
  }

  function viewReview(): void {
    const target = activeReviewId ?? rejectedReviewId;
    if (target) onReview(target);
  }

  async function submit(): Promise<void> {
    if (busy) return;
    busy = true;
    error = "";
    const payload = canNewAttempt
      ? { newAttempt: true }
      : {
          ...(provider === "claude" && lockedBudget === undefined && budget
            ? { budgetUsd: Number(budget) }
            : {}),
          retry: started,
        };
    started = true;
    sync();
    notify();
    try {
      const result = await request<{ jobId?: string; reviewId: string; state?: ReviewState }>(
        `answers/${answerId}/save`,
        payload,
      );
      if (disposed) return;
      if (result.state === "rejected") {
        rejectedReviewId = result.reviewId;
        activeReviewId = undefined;
        canNewAttempt = true;
        open = true;
      } else {
        activeReviewId = result.reviewId;
        canNewAttempt = false;
        onReview(result.reviewId);
      }
    } catch (err) {
      if (disposed) return;
      const apiErr = err as Error & {
        canNewAttempt?: boolean;
        budgetUsd?: number;
        rejectedReviewId?: string;
      };
      const message = String(err);
      error = message;
      if (typeof apiErr.budgetUsd === "number") {
        lockedBudget = apiErr.budgetUsd;
        budget = String(apiErr.budgetUsd);
      }
      if (typeof apiErr.rejectedReviewId === "string") {
        rejectedReviewId = apiErr.rejectedReviewId;
      }
      const eligibleByMessage = /已达到尝试次数上限|剩余预算不足|模型上下文窗口不足|newAttempt/.test(message);
      canNewAttempt = typeof apiErr.canNewAttempt === "boolean" ? apiErr.canNewAttempt : eligibleByMessage;
    } finally {
      if (!disposed) {
        busy = false;
        sync();
        notify();
      }
    }
  }

  const actions: AnswerSaveActions = {
    openForm,
    setBudget,
    submit,
    viewReview,
  };

  return {
    getState: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    actions,
    dispose: () => {
      disposed = true;
      listeners.clear();
    },
  };
}

export function AnswerSaveView({ state, actions }: { state: AnswerSaveState; actions: AnswerSaveActions }) {
  if (state.activeReviewId) {
    return (
      <button type="button" onClick={actions.viewReview}>
        查看保存结果
      </button>
    );
  }
  if (!state.open && !state.rejectedReviewId) {
    return (
      <button type="button" onClick={() => void actions.openForm()}>
        存进 Wiki
      </button>
    );
  }
  return (
    <form
      className="wiki-save"
      onSubmit={(event) => {
        event.preventDefault();
        void actions.submit();
      }}
    >
      <p>
        {state.rejectedReviewId && state.canNewAttempt
          ? "上次保存草稿已在审阅中退回，退回记录仍可查看；如需恢复可重新生成待审稿。"
          : state.canNewAttempt
            ? "当前保存尝试已无法在原任务继续重试（原记录已保留），可重新生成待审稿。"
            : "使用「状态」中选择的模型编译回答和引用快照，审阅后才入库。"}
      </p>
      {state.provider === "claude" && !state.canNewAttempt && (
        <label>
          本次编译总预算（美元）
          <input
            type="number"
            min="0.01"
            step="0.01"
            required
            value={state.budget}
            disabled={state.started || state.lockedBudget !== undefined}
            onChange={(e) => actions.setBudget(e.target.value)}
          />
        </label>
      )}
      <small>
        {state.canNewAttempt
          ? state.provider === "codex"
            ? "重新生成待审稿会消耗 Codex 的 ChatGPT 账户额度（最多尝试两次）；仅查看或刷新不会自动重跑。"
            : state.lockedBudget !== undefined
              ? `重新生成待审稿会沿用原总预算（${state.lockedBudget} 美元，最多尝试两次）并可能产生费用；仅查看或刷新不会自动重跑。`
              : "重新生成待审稿会沿用原预算（最多尝试两次）并可能产生费用；仅查看或刷新不会自动重跑。"
          : state.provider === "codex"
            ? "使用 Codex 的 ChatGPT 账户额度，最多尝试两次；重试也会消耗额度。"
            : "最多尝试两次，每次上限为总预算的一半；重试沿用预算，可能产生费用。"}
      </small>
      {state.error && <p role="alert">{state.error}</p>}
      <div className="wiki-save-actions">
        {state.rejectedReviewId && (
          <button type="button" onClick={actions.viewReview}>
            查看保存结果
          </button>
        )}
        <button
          type="submit"
          disabled={
            state.busy ||
            !state.provider ||
            (!state.canNewAttempt &&
              state.provider === "claude" &&
              state.lockedBudget === undefined &&
              !state.budget)
          }
        >
          {state.busy
            ? "编译中…"
            : state.canNewAttempt
              ? "重新生成待审稿"
              : state.started
                ? "查看状态 / 重试"
                : "生成待审草稿"}
        </button>
      </div>
    </form>
  );
}

export function AnswerSave({ answerId, onReview }: { answerId: string; onReview: (id: string) => void }) {
  const onReviewRef = useRef(onReview);
  onReviewRef.current = onReview;
  const controller = useMemo(
    () =>
      createAnswerSaveController({
        answerId,
        onReview: (id) => onReviewRef.current(id),
      }),
    [answerId],
  );
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  return <AnswerSaveView state={state} actions={controller.actions} />;
}
