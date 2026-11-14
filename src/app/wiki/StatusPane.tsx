import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { CHAT_MODELS } from "../../content/wiki/chat-models";
import { wikiRequest } from "./api";

/** 与 server/status.ts 的 readStatus 返回值同形；前端不 import 服务端模块 */
interface WikiStatus {
  mode?: "test" | "production";
  budget?: {
    limitUsd: number | null;
    chargedUsd: number;
    calls: number;
    maxCalls: number | null;
    paused: boolean;
    pauseReason?: string;
  };
  models: {
    chatModel?: string;
    chatProvider?: "claude" | "codex";
    codexCalls?: number;
    workModel: string;
    recorded: number;
    switched: number;
    last?: { at: string; purpose: string; event?: string; from: string; to: string; reason?: string };
  };
  nightly?: {
    lastRun?: { startedAt?: string; finishedAt?: string; status?: string };
    maxNewParamPages: number | null;
    heldBack: number;
    fetch: boolean;
    github: boolean;
    spendsMoney: boolean;
    paidWork: { tasks: number | null; reconcile: number | null; drift: number | null };
  };
  pages: { concepts: number; params: number; sources: number };
  todo: {
    pendingReviews: number;
    missingTerms: string[];
    totalTerms: number;
    termEntries?: { term: string; id?: string; title?: string }[];
    closedGaps?: number;
    gapEntries?: {
      key: string;
      question: string;
      state: string;
      count: number;
      pendingCount: number;
      threshold: number;
    }[];
    gaps: number;
    mergedGaps: number;
    queuedTasks: number;
  };
}

const RUN_LABEL: Record<string, string> = {
  succeeded: "成功",
  deferred: "整批暂缓（没产出）",
  failed: "失败",
  running: "正在跑",
  findings: "已完成，发现待处理提示",
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

type ModelSelection = { chatProvider: "claude" | "codex"; chatModel: string };

function ModelPicker({
  models,
  onSaved,
}: {
  models: WikiStatus["models"];
  onSaved: (selection: ModelSelection) => void;
}) {
  const [provider, setProvider] = useState<ModelSelection["chatProvider"]>("claude");
  const [model, setModel] = useState("");
  const [custom, setCustom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const savedProvider = models.chatProvider ?? "claude";
    const savedModel = models.chatModel ?? "";
    setProvider(savedProvider);
    setModel(savedModel);
    setCustom(!!savedModel && !CHAT_MODELS[savedProvider].includes(savedModel));
  }, [models.chatProvider, models.chatModel]);
  const changed = () => {
    setNotice("");
    setError("");
  };
  return (
    <form
      className="wiki-model-settings"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setError("");
        setNotice("");
        try {
          const saved = await wikiRequest<ModelSelection>("status/model", {
            chatProvider: provider,
            chatModel: model.trim(),
          });
          onSaved(saved);
          setNotice("已保存，后续所有模型任务生效。");
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        接入方式
        <select
          value={provider}
          disabled={busy}
          onChange={(event) => {
            const next = event.target.value as ModelSelection["chatProvider"];
            setProvider(next);
            const nextModel =
              next === (models.chatProvider ?? "claude") ? (models.chatModel ?? "") : CHAT_MODELS[next][0]!;
            setModel(nextModel);
            setCustom(!!nextModel && !CHAT_MODELS[next].includes(nextModel));
            changed();
          }}
        >
          <option value="codex">Codex（GPT）</option>
          <option value="claude">Claude Code</option>
        </select>
      </label>
      <label>
        模型
        <select
          value={custom ? "custom" : model}
          disabled={busy}
          onChange={(event) => {
            setCustom(event.target.value === "custom");
            setModel(event.target.value === "custom" ? "" : event.target.value);
            changed();
          }}
        >
          <option value="" disabled>
            请选择模型
          </option>
          {CHAT_MODELS[provider].map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
          <option value="custom">自定义模型…</option>
        </select>
      </label>
      {custom && (
        <label>
          自定义模型名
          <input
            value={model}
            maxLength={200}
            required
            disabled={busy}
            placeholder="输入当前账户可用的模型 ID"
            onChange={(event) => {
              setModel(event.target.value);
              changed();
            }}
          />
        </label>
      )}
      <p className="wiki-status-note">
        {provider === "codex"
          ? "使用本机 Codex 的 ChatGPT 登录与账户额度。"
          : "使用本机 Claude Code 登录；当前账户须有模型访问权限。"}
        列表为常用选项，实际可用性取决于你的账户。保存不调用模型，正在运行的任务不受影响。问答、存入
        Wiki、导入整合、缺口判定与夜间模型任务都使用此选择。
      </p>
      <button
        className="wiki-model-save"
        type="submit"
        disabled={
          busy ||
          !model.trim() ||
          (provider === (models.chatProvider ?? "claude") && model.trim() === models.chatModel)
        }
      >
        {busy ? "保存中…" : "保存选择"}
      </button>
      {notice && <p role="status">{notice}</p>}
      {error && (
        <p role="alert" className="wiki-chat-error">
          保存失败：{error}
        </p>
      )}
    </form>
  );
}

/** Status plus explicit chat model selection; selection never starts a model or changes nightly quotas. */
export function StatusPane({
  id,
  hidden,
  onOpenReview,
}: {
  id: string;
  hidden: boolean;
  onOpenReview: () => void;
}) {
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
    <div id={id} className="wiki-status" data-testid="status-pane" role="tabpanel" hidden={hidden}>
      {error && (
        <p role="alert" className="wiki-chat-error">
          {error}
        </p>
      )}
      {status && (
        <>
          <section>
            <h3>全局模型设置</h3>
            <ModelPicker
              models={status.models}
              onSaved={(selection) =>
                setStatus((current) =>
                  current ? { ...current, models: { ...current.models, ...selection } } : current,
                )
              }
            />
          </section>
          <section>
            <h3>运行方式</h3>
            <p
              className={`wiki-status-verdict ${n?.spendsMoney ? "is-warn" : "is-ok"}`}
              data-testid="status-spend"
            >
              {status.mode === "production"
                ? "正式运行：每晚自动处理待办、检查知识关系和内容变化，生成的知识变更等你审批。"
                : n?.spendsMoney
                  ? "会：夜间任务已被授权调用模型。"
                  : "不会自动调用。提问、保存回答、启动网页 Drop 或手动运行知识生产命令时才调用模型；夜间任务不调模型。"}
            </p>
          </section>

          <section>
            <h3>{status.mode === "production" ? "模型用量" : "模型预算"}</h3>
            {status.models.chatProvider === "codex" && (
              <p className="wiki-status-note">
                GPT 调用使用本机 Codex 的 ChatGPT 账户额度，已调用 {status.models.codexCalls ?? 0}{" "}
                次；下方美元账目仅统计 Claude，不代表 GPT 免费。
              </p>
            )}
            <p className="wiki-status-note">
              {status.mode === "production"
                ? "测试额度已取消：本项目不再限制金额、调用次数或每晚处理数量，仍记录模型用量。模型服务商的账户额度和限流仍然适用。缺少来源或实测数据时，会保留缺口等补证据。"
                : "共享预算用于问答、保存回答等调用。Drop 需你主动启动，单独记账，不受这里的暂停、调用次数或金额上限约束。"}
            </p>
            {b ? (
              <dl>
                <Row label="状态" tone={b.paused ? "warn" : "ok"}>
                  {b.paused ? `已暂停，问答用不了${b.pauseReason ? `（${b.pauseReason}）` : ""}` : "可用"}
                </Row>
                <Row label={status.mode === "production" ? "已记录 Claude 费用" : "已用 / 上限"}>
                  ${b.chargedUsd.toFixed(2)}
                  {b.limitUsd === null ? " · 无项目上限" : ` / $${b.limitUsd}`}
                </Row>
                <Row label="调用次数">
                  {b.calls}
                  {b.maxCalls === null ? " · 无项目上限" : ` / ${b.maxCalls}`}
                </Row>
              </dl>
            ) : (
              <p className="wiki-status-note">还没有建账本，问答用不了。</p>
            )}
          </section>

          <section>
            <h3>作答模型</h3>
            <dl>
              <Row label="全局模型">{status.models.chatModel ?? "CLI 默认（没有固定）"}</Row>
              <Row label="接入方式">
                {status.models.chatProvider === "codex" ? "Codex · ChatGPT 账户额度" : "Claude Code"}
              </Row>
              <Row label="生效范围">问答、编译、导入整合、后台模型任务</Row>
              <Row label="换过模型的调用" tone={status.models.switched ? "warn" : undefined}>
                {status.models.switched} / {status.models.recorded} 次
              </Row>
              {status.models.last && (
                <Row label="最近一次换模型">
                  {when(status.models.last.at)} · {status.models.last.purpose} · {status.models.last.from} →{" "}
                  {status.models.last.to}
                  {status.models.last.reason ? `（${status.models.last.reason}）` : ""}
                </Row>
              )}
            </dl>
            <p className="wiki-status-note">
              Claude 的美元费用和 Codex 的 token 用量分别记账；实际作答模型从 9 月 23
              日晚这次改动起才记，更早的调用不计入上面的次数。模型不可用时会报错，不自动切换接入方式。
            </p>
          </section>

          <section>
            <h3>夜间维护</h3>
            {n ? (
              <dl>
                <Row label="上次运行" tone={n.lastRun?.status === "succeeded" ? "ok" : "warn"}>
                  {when(n.lastRun?.finishedAt ?? n.lastRun?.startedAt)} ·{" "}
                  {RUN_LABEL[n.lastRun?.status ?? ""] ?? n.lastRun?.status ?? "没有记录"}
                </Row>
                <Row label="每晚新增参数页">{n.maxNewParamPages ?? "不限数量"}</Row>
                <Row label="留到下一晚的">{n.heldBack} 个</Row>
                <Row label="拉上游代码">{n.fetch ? "开" : "关"}</Row>
                <Row label="拉 GitHub 新讨论">{n.github ? "开（只增量，不做全库首拉）" : "关"}</Row>
                <Row label="处理待办">
                  {n.paidWork.tasks === null ? "本轮全部待办" : `${n.paidWork.tasks} 项 / 晚`}
                </Row>
                <Row label="检查知识关系">
                  {n.paidWork.reconcile === null ? "每晚完整一轮" : `${n.paidWork.reconcile} 批 / 晚`}
                </Row>
                <Row label="复核内容变化">
                  {n.paidWork.drift === null ? "每晚检查全部页面" : `${n.paidWork.drift} 页 / 晚`}
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
              <Row label="课程术语缺少入口">
                {t?.missingTerms.length} / {t?.totalTerms}
              </Row>
              <Row label="待处理的问答缺口">
                {t?.gaps}
                {t?.mergedGaps ? `（其中 ${t.mergedGaps} 条合并了不同说法）` : ""}
              </Row>
              <Row label="已关闭的历史缺口">{t?.closedGaps ?? 0}</Row>
              <Row label="排队中的任务">{t?.queuedTasks}</Row>
            </dl>
            {!!t?.missingTerms.length && (
              <details>
                <summary>缺哪些术语入口</summary>
                <p className="wiki-status-terms">{t.missingTerms.join("、")}</p>
              </details>
            )}
            {!!t?.termEntries?.length && (
              <details>
                <summary>课程术语对应页面</summary>
                <ul>
                  {t.termEntries.map((entry) => (
                    <li key={entry.term}>
                      {entry.term}：
                      {entry.id ? (
                        <Link to={`/wiki/${entry.id}`}>{entry.title}</Link>
                      ) : (
                        "缺少入口，待核对正文"
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {!!t?.gapEntries?.length && (
              <details>
                <summary>查看缺口与关闭记录</summary>
                <ul>
                  {t.gapEntries.map((gap) => (
                    <li key={gap.key}>
                      {gap.question} —{" "}
                      {gap.state === "closed"
                        ? "已关闭（保留历史）"
                        : gap.state === "collecting"
                          ? `收集中 ${gap.pendingCount}/${gap.threshold}`
                          : `待评估 ${gap.pendingCount} 次`}
                      ；累计 {gap.count} 次
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          <p className="wiki-status-note">
            上方模型选择对整个 Wiki 生效。
            {status.mode === "production"
              ? "正式运行已取消测试额度；资料投喂仍由你主动启动，待审知识变更在审阅页确认。"
              : "要改上限、恢复预算或开批量导入，在对话里说，改动会留下依据。"}
            「哪些页引用的上游代码变了」要跑 git，这里不算：<code>pnpm wiki:stale</code>。
          </p>
        </>
      )}
    </div>
  );
}
