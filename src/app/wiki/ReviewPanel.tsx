import { useEffect, useRef, useState } from "react";
import { wikiRequest } from "./api";

type ReviewState = "pending" | "publishing" | "published" | "rejected";
interface Summary {
  id: string;
  state: ReviewState;
  files: string[];
  reason?: string;
}
interface Detail {
  review: { id: string; state: ReviewState; reason?: string };
  diff: string;
}
const labels: Record<ReviewState, string> = {
  pending: "待审",
  publishing: "发布待恢复",
  published: "已发布",
  rejected: "已驳回",
};

export function ReviewPanel({
  initialId,
  onClose,
  onPublished,
}: {
  initialId?: string | undefined;
  onClose: () => void;
  onPublished: () => Promise<void>;
}) {
  const [reviews, setReviews] = useState<Summary[]>([]);
  const [selected, setSelected] = useState(initialId);
  const [detail, setDetail] = useState<Detail>();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    let active = true;
    wikiRequest<{ reviews: Summary[] }>("reviews")
      .then((data) => {
        if (active) setReviews(data.reviews);
      })
      .catch((e) => {
        if (active) setError(String(e));
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    setDetail(undefined);
    setReason("");
    setError("");
    if (selected)
      wikiRequest<Detail>(`reviews/${selected}`)
        .then((data) => {
          if (active) setDetail(data);
        })
        .catch((e) => {
          if (active) setError(String(e));
        });
    return () => {
      active = false;
    };
  }, [selected]);
  async function decide(action: "approve" | "reject") {
    if (!detail || busy) return;
    const id = detail.review.id;
    setBusy(true);
    setError("");
    try {
      const result = await wikiRequest<Detail["review"]>(`reviews/${id}/${action}`, {
        revision: id,
        ...(action === "reject" ? { reason } : {}),
      });
      setDetail({ ...detail, review: result });
      setReviews((items) => items.map((r) => (r.id === id ? { ...r, ...result } : r)));
      if (action === "approve") await onPublished();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="wiki-review"
      aria-label="审阅 Wiki 变更"
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
    >
      <header>
        <h2>审阅 Wiki 变更</h2>
        <button type="button" disabled={busy} onClick={onClose}>
          关闭审阅
        </button>
      </header>
      <p>核对正文、引用和历史差异。批准所选版本后，新请求将使用发布后的知识库。</p>
      <label>
        选择变更
        <select
          value={selected ?? ""}
          disabled={busy}
          onChange={(e) => setSelected(e.target.value || undefined)}
        >
          <option value="">选择一份审阅包</option>
          {reviews.map((r) => (
            <option key={r.id} value={r.id}>
              {labels[r.state]} · {r.id.slice(0, 10)} ·{" "}
              {r.files.find((f) => /^wiki\/(concepts|sources|params)\//.test(f)) ?? "知识库变更"}
            </option>
          ))}
        </select>
      </label>
      {error && <p role="alert">{error}</p>}
      {detail && (
        <>
          <p data-testid="review-state">
            {labels[detail.review.state]} · {detail.review.id}
          </p>
          {detail.review.reason && <p>驳回原因：{detail.review.reason}</p>}
          <pre className="wiki-review-diff" data-testid="review-diff">
            {detail.diff || "没有文本差异"}
          </pre>
          {detail.review.state === "pending" && (
            <footer>
              <button type="button" disabled={busy} onClick={() => void decide("approve")}>
                {busy ? "处理中…" : "批准此版本并发布"}
              </button>
              <label>
                驳回原因
                <textarea
                  maxLength={2000}
                  value={reason}
                  disabled={busy}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <button type="button" disabled={busy || !reason.trim()} onClick={() => void decide("reject")}>
                驳回此版本
              </button>
            </footer>
          )}
          {detail.review.state === "publishing" && <p>发布中断，需维护者执行恢复；恢复前暂停新问答。</p>}
        </>
      )}
      {!selected && !reviews.length && !error && <p>暂无审阅包。</p>}
    </dialog>
  );
}
