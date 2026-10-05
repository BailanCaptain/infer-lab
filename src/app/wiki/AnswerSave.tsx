import { useEffect, useState } from "react";
import { wikiRequest } from "./api";

export function AnswerSave({ answerId, onReview }: { answerId: string; onReview: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<"claude" | "codex">();
  useEffect(() => {
    if (!open) return;
    let active = true;
    wikiRequest<{ models: { chatProvider: "claude" | "codex" } }>("status")
      .then((value) => {
        if (active) setProvider(value.models.chatProvider);
      })
      .catch((error) => {
        if (active) setError(String(error));
      });
    return () => {
      active = false;
    };
  }, [open]);
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
            ...(provider === "claude" ? { budgetUsd: Number(budget) } : {}),
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
      <p>使用「状态」中选择的模型编译回答和引用快照，审阅后才入库。</p>
      {provider === "claude" && (
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
      )}
      <small>
        {provider === "codex"
          ? "使用 Codex 的 ChatGPT 账户额度，最多尝试两次；重试也会消耗额度。"
          : "最多尝试两次，每次上限为总预算的一半；重试沿用预算，可能产生费用。"}
      </small>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={busy || !provider || (provider === "claude" && !budget)}>
        {busy ? "编译中…" : started ? "查看状态 / 重试" : "生成待审草稿"}
      </button>
    </form>
  );
}
