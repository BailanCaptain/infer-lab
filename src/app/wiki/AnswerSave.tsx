import { useState } from "react";
import { wikiRequest } from "./api";

export function AnswerSave({ answerId, onReview }: { answerId: string; onReview: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [budget, setBudget] = useState("");
  const [started, setStarted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reviewId, setReviewId] = useState<string>();
  if (reviewId)
    return (
      <button type="button" onClick={() => onReview(reviewId)}>
        查看保存结果
      </button>
    );
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)}>
        存进 Wiki
      </button>
    );
  return (
    <form
      className="wiki-save"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setError("");
        setStarted(true);
        try {
          const result = await wikiRequest<{ reviewId: string }>(`answers/${answerId}/save`, {
            budgetUsd: Number(budget),
            retry: started,
          });
          setReviewId(result.reviewId);
          onReview(result.reviewId);
        } catch (error) {
          setError(String(error));
        } finally {
          setBusy(false);
        }
      }}
    >
      <p>把这条回答和引用快照编译成问答来源页，审阅后才入库。</p>
      <label>
        本次编译总预算（美元）
        <input
          type="number"
          min="0.01"
          step="0.01"
          required
          value={budget}
          disabled={started}
          onChange={(e) => setBudget(e.target.value)}
        />
      </label>
      <small>最多尝试两次，每次上限为总预算的一半；重试沿用预算，可能产生费用。</small>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={busy || !budget}>
        {busy ? "编译中…" : started ? "查看状态 / 重试" : "生成待审草稿"}
      </button>
    </form>
  );
}
