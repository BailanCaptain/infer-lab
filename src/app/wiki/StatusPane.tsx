import { useCallback, useEffect, useState } from "react";
import { wikiRequest } from "./api";

/** 与 server/status.ts 的 readStatus 返回值同形；前端不 import 服务端模块 */
interface WikiStatus {
  budget?: {
    limitUsd: number;
    chargedUsd: number;
    calls: number;
    maxCalls: number;
    paused: boolean;
    pauseReason?: string;
  };
  nightly?: {
    lastRun?: { startedAt?: string; finishedAt?: string; status?: string };
    maxNewParamPages: number;
    heldBack: number;
    fetch: boolean;
    github: boolean;
    spendsMoney: boolean;
    paidWork: { tasks: number; reconcile: number; drift: number };
  };
  pages: { concepts: number; params: number; sources: number };
  todo: {
    pendingReviews: number;
    missingTerms: string[];
    totalTerms: number;
    gaps: number;
    queuedTasks: number;
  };
}

const RUN_LABEL: Record<string, string> = {
  succeeded: "成功",
  deferred: "整批暂缓（没产出）",
  failed: "失败",
  running: "正在跑",
};
const when = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString("zh-CN", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

function Row({
  label,
  children,
  tone,
}: {
  label: string;
  children: React.ReactNode;
  tone?: "ok" | "warn" | undefined;
}) {
  return (
    <div className="wiki-status-row">
      <dt>{label}</dt>
      <dd className={tone ? `is-${tone}` : undefined}>{children}</dd>
    </div>
  );
}

/**
 * 只读的运行状态。存在的理由：预算暂停、夜间任务空转这类事，以前只有翻 JSON 文件才知道。
 * 这里不放任何会花钱或改变夜间行为的按钮——那些改动在对话里做，留得下批准依据。
 */
export function StatusPane({ hidden, onOpenReview }: { hidden: boolean; onOpenReview: () => void }) {
  const [status, setStatus] = useState<WikiStatus>();
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setStatus(await wikiRequest<WikiStatus>("status"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    if (!hidden) void load();
  }, [hidden, load]);

  const b = status?.budget;
  const n = status?.nightly;
  const t = status?.todo;
  return (
    <div className="wiki-status" data-testid="status-pane" role="tabpanel" hidden={hidden}>
      {error && (
        <p role="alert" className="wiki-chat-error">
          {error}
        </p>
      )}
      {status && (
        <>
          <section>
            <h3>会不会自己花钱</h3>
            <p
              className={`wiki-status-verdict ${n?.spendsMoney ? "is-warn" : "is-ok"}`}
              data-testid="status-spend"
            >
              {n?.spendsMoney
                ? "会：夜间任务已被授权调用模型。"
                : "不会。只有你在这里提问、或点「存进 Wiki」时才调用模型；夜间任务不调模型，大批量导入只能手动执行命令。"}
            </p>
          </section>

          <section>
            <h3>模型预算</h3>
            {b ? (
              <dl>
                <Row label="状态" tone={b.paused ? "warn" : "ok"}>
                  {b.paused ? `已暂停，问答用不了${b.pauseReason ? `（${b.pauseReason}）` : ""}` : "可用"}
                </Row>
                <Row label="已用 / 上限">
                  ${b.chargedUsd.toFixed(2)} / ${b.limitUsd}
                </Row>
                <Row label="调用次数">
                  {b.calls} / {b.maxCalls}
                </Row>
              </dl>
            ) : (
              <p className="wiki-status-note">还没有建账本，问答用不了。</p>
            )}
          </section>

          <section>
            <h3>夜间维护</h3>
            {n ? (
              <dl>
                <Row label="上次运行" tone={n.lastRun?.status === "succeeded" ? "ok" : "warn"}>
                  {when(n.lastRun?.finishedAt ?? n.lastRun?.startedAt)} ·{" "}
                  {RUN_LABEL[n.lastRun?.status ?? ""] ?? n.lastRun?.status ?? "没有记录"}
                </Row>
                <Row label="每晚最多新增参数页">{n.maxNewParamPages}</Row>
                <Row label="留到下一晚的">{n.heldBack} 个</Row>
                <Row label="拉上游代码">{n.fetch ? "开" : "关"}</Row>
                <Row label="拉 GitHub 新讨论">{n.github ? "开（只增量，不做全库首拉）" : "关"}</Row>
                <Row label="付费项配额">
                  任务 {n.paidWork.tasks} · 交叉审视 {n.paidWork.reconcile} · 过期抽检 {n.paidWork.drift}
                </Row>
              </dl>
            ) : (
              <p className="wiki-status-note">没有夜间维护配置。</p>
            )}
          </section>

          <section>
            <h3>内容</h3>
            <dl>
              <Row label="页数">
                概念 {status.pages.concepts} · 参数 {status.pages.params} · 来源摘要 {status.pages.sources}
              </Row>
              <Row label="等你审的变更" tone={t?.pendingReviews ? "warn" : undefined}>
                {t?.pendingReviews ? (
                  <button type="button" className="wiki-status-link" onClick={onOpenReview}>
                    {t.pendingReviews} 份，去审阅
                  </button>
                ) : (
                  "没有"
                )}
              </Row>
              <Row label="课程术语还没页的">
                {t?.missingTerms.length} / {t?.totalTerms}
              </Row>
              <Row label="问答记下的知识缺口">{t?.gaps}</Row>
              <Row label="排队中的任务">{t?.queuedTasks}</Row>
            </dl>
            {!!t?.missingTerms.length && (
              <details>
                <summary>缺哪些术语</summary>
                <p className="wiki-status-terms">{t.missingTerms.join("、")}</p>
              </details>
            )}
          </section>

          <p className="wiki-status-note">
            这一页只读。要改上限、恢复预算或开批量导入，在对话里说，改动会留下依据。「哪些页引用的上游代码变了」要跑
            git，这里不算：<code>pnpm wiki:stale</code>。
          </p>
        </>
      )}
    </div>
  );
}
