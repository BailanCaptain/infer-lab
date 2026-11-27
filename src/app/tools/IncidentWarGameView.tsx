import "../../design/tools.css";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { sourceUrl } from "../../content/wiki/index";
import { parseRepoRef } from "../../content/wiki/schema";
import { judgeWarGameSubmission, type WarGameJudgeResult } from "../../sim/wargame/judge";
import {
  DEFAULT_WARGAME_SCENARIO_ID,
  getWarGameScenario,
  isWarGameScenarioId,
  WARGAME_SCENARIOS,
  type WarGameOptionId,
  type WarGameScenario,
  type WarGameScenarioId,
} from "../../sim/wargame/scenarios";
import { useOptionalWikiAssistant } from "../wiki/assistant-context";
import { ToolDeepLinkById } from "./ToolDeepLinkChip";
import { copyTextToClipboard, preserveWikiBackParams, sanitizeDiagnosticText } from "./workbenchHandoff";

export const WARGAME_PROGRESS_STORAGE_KEY = "infer-lab:wargame:v1";

export interface WarGameStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface IncidentWarGameViewProps {
  title?: string | undefined;
  summary?: string | undefined;
  embedded?: boolean | undefined;
  isActive?: boolean | undefined;
  searchParams?: URLSearchParams | undefined;
  locationKey?: string | undefined;
  onUpdateSearchParams?: ((nextParams: URLSearchParams, opts?: { replace?: boolean }) => void) | undefined;
}

function getDefaultBrowserStorage(): WarGameStorageLike | null {
  try {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") return null;
    if (
      typeof window.localStorage.getItem !== "function" ||
      typeof window.localStorage.setItem !== "function"
    ) {
      return null;
    }
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readWarGamePassedIds(
  storage: WarGameStorageLike | null = getDefaultBrowserStorage(),
): Set<WarGameScenarioId> {
  if (!storage) return new Set();
  try {
    const raw = storage.getItem(WARGAME_PROGRESS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    const list = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray((parsed as { passedIds?: unknown }).passedIds)
        ? (parsed as { passedIds: unknown[] }).passedIds
        : [];
    return new Set(list.filter((item): item is WarGameScenarioId => isWarGameScenarioId(item)));
  } catch {
    return new Set();
  }
}

export function writeWarGamePassedIds(
  ids: Iterable<WarGameScenarioId>,
  storage: WarGameStorageLike | null = getDefaultBrowserStorage(),
): boolean {
  if (!storage) return false;
  try {
    const existing = readWarGamePassedIds(storage);
    const merged = new Set<WarGameScenarioId>([...existing, ...ids]);
    const clean = [...merged].filter((id) => isWarGameScenarioId(id));
    storage.setItem(WARGAME_PROGRESS_STORAGE_KEY, JSON.stringify({ version: 1, passedIds: clean }));
    return true;
  } catch {
    return false;
  }
}

export function parseWarGameCaseParam(params?: URLSearchParams): WarGameScenarioId {
  const raw = params?.get("case")?.trim();
  return isWarGameScenarioId(raw) ? raw : DEFAULT_WARGAME_SCENARIO_ID;
}

export function buildWarGameQueryParams(
  caseId: WarGameScenarioId,
  preserve?: URLSearchParams,
): URLSearchParams {
  const next = new URLSearchParams();
  next.set("tab", "wargame");
  preserveWikiBackParams(next, preserve);
  next.set("case", caseId);
  return next;
}

interface CaseDraftState {
  selectedOptionId: WarGameOptionId | null;
  commandText: string;
  decodeCommandText: string;
  revealedHints: number;
  lastResult: WarGameJudgeResult | null;
  judgedSig: string | null;
}

function buildDraftJudgeSignature(
  selectedOptionId: WarGameOptionId | null,
  commandText: string,
  decodeCommandText: string,
): string {
  return `${selectedOptionId ?? ""}::${commandText}::${decodeCommandText}`;
}

function createInitialDrafts(): Record<WarGameScenarioId, CaseDraftState> {
  const out = {} as Record<WarGameScenarioId, CaseDraftState>;
  for (const s of WARGAME_SCENARIOS) {
    out[s.id] = {
      selectedOptionId: null,
      commandText: s.initialCommand,
      decodeCommandText: s.initialDecodeCommand ?? "",
      revealedHints: 0,
      lastResult: null,
      judgedSig: null,
    };
  }
  return out;
}

function SourceAnchorLink({ rawRef }: { rawRef: string }) {
  const parsed = parseRepoRef(rawRef);
  const href = parsed ? sourceUrl(parsed) : null;
  if (href) {
    return (
      <a className="wt-source-link" href={href} target="_blank" rel="noreferrer">
        {rawRef}
      </a>
    );
  }
  return <code className="wt-code-inline">{rawRef}</code>;
}

function buildWarGameAssistantPrompt(scenario: WarGameScenario, draft: CaseDraftState): string {
  const safeCmd = sanitizeDiagnosticText(draft.commandText).sanitized;
  const safeDecodeCmd = sanitizeDiagnosticText(draft.decodeCommandText).sanitized;
  return [
    `我正在「生产故障实战通关场」演练关卡 ${scenario.code}（${scenario.title}，硬件：${scenario.cardLabel}）：`,
    `- 现场日志/指标摘要：${scenario.telemetryTitle}`,
    `- 当前草稿命令：\n${safeCmd}`,
    ...(scenario.topology === "pd" ? [`- 当前 Decode 命令：\n${safeDecodeCmd}`] : []),
    "",
    "请在不直接剧透选择题字母的前提下，结合本仓库知识库帮我梳理这条故障的排查思路与参数机制边界。",
  ].join("\n");
}

export function IncidentWarGameView({
  title,
  summary,
  embedded = false,
  isActive,
  searchParams,
  locationKey,
  onUpdateSearchParams,
}: IncidentWarGameViewProps) {
  const idPrefix = useId();
  const assistant = useOptionalWikiAssistant();
  const isRouteActive =
    !embedded && (isActive !== undefined ? isActive : searchParams?.get("tab") === "wargame");

  const initialCaseId = useMemo(
    () => (isRouteActive && searchParams ? parseWarGameCaseParam(searchParams) : DEFAULT_WARGAME_SCENARIO_ID),
    [isRouteActive, searchParams],
  );

  const [activeCaseId, setActiveCaseId] = useState<WarGameScenarioId>(initialCaseId);
  const [drafts, setDrafts] = useState<Record<WarGameScenarioId, CaseDraftState>>(createInitialDrafts);
  const [passedIds, setPassedIds] = useState<ReadonlySet<WarGameScenarioId>>(() => readWarGamePassedIds());
  const [linkCopied, setLinkCopied] = useState<boolean>(false);
  const [shareFallbackNotice, setShareFallbackNotice] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === WARGAME_PROGRESS_STORAGE_KEY || e.key === null) {
        const latest = readWarGamePassedIds();
        setPassedIds((prev) => new Set([...prev, ...latest]));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const activeCaseRef = useRef<WarGameScenarioId>(activeCaseId);
  activeCaseRef.current = activeCaseId;
  const wasActiveRef = useRef<boolean>(isRouteActive);
  const prevLocationKeyRef = useRef<string | undefined>(locationKey);
  const lastSelfSyncedQueryRef = useRef<string | null>(null);
  const restoringFromUrlRef = useRef<boolean>(false);
  restoringFromUrlRef.current = false;

  // URL -> State 同步（仅当 wargame 标签页激活或外部 URL 变化时响应 ?case=<scenarioId>，严禁把 activeCaseId 放进依赖导致用户点击被旧 URL 覆盖）
  useEffect(() => {
    const wasActive = wasActiveRef.current;
    const prevKey = prevLocationKeyRef.current;
    wasActiveRef.current = isRouteActive;
    prevLocationKeyRef.current = locationKey;
    if (!isRouteActive || !searchParams) return;
    const serialized = searchParams.toString();
    if (serialized === lastSelfSyncedQueryRef.current) {
      lastSelfSyncedQueryRef.current = null;
      return;
    }
    const hasExplicitCase = isWarGameScenarioId(searchParams.get("case")?.trim());
    if (!wasActive && !hasExplicitCase) return;
    if (wasActive && prevKey === locationKey && !hasExplicitCase) return;
    const nextId = parseWarGameCaseParam(searchParams);
    if (nextId !== activeCaseRef.current) {
      restoringFromUrlRef.current = true;
      setActiveCaseId(nextId);
    }
  }, [isRouteActive, searchParams, locationKey]);

  // State -> URL 同步（严格仅在 isRouteActive 时写 URL）
  useEffect(() => {
    if (!isRouteActive || !searchParams || !onUpdateSearchParams) return;
    if (restoringFromUrlRef.current) return;
    const nextParams = buildWarGameQueryParams(activeCaseId, searchParams);
    const nextStr = nextParams.toString();
    if (nextStr !== searchParams.toString()) {
      lastSelfSyncedQueryRef.current = nextStr;
      onUpdateSearchParams(nextParams, { replace: true });
    }
  }, [isRouteActive, activeCaseId, searchParams, onUpdateSearchParams]);

  const scenario = getWarGameScenario(activeCaseId);
  const currentDraft = drafts[scenario.id];
  const currentSig = buildDraftJudgeSignature(
    currentDraft.selectedOptionId,
    currentDraft.commandText,
    scenario.topology === "pd" ? currentDraft.decodeCommandText : "",
  );
  const isVerdictStale =
    currentDraft.lastResult !== null &&
    currentDraft.judgedSig !== null &&
    currentSig !== currentDraft.judgedSig;
  const isCasePassed =
    passedIds.has(scenario.id) || Boolean(currentDraft.lastResult?.passed && !isVerdictStale);
  const unlockedDebrief = isCasePassed ? scenario.debrief : null;

  const caseTabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const updateCurrentDraft = (patch: Partial<CaseDraftState>) => {
    setDrafts((prev) => ({
      ...prev,
      [scenario.id]: { ...prev[scenario.id], ...patch },
    }));
  };

  const handleSubmitJudge = () => {
    const decodeCmd = scenario.topology === "pd" ? currentDraft.decodeCommandText : "";
    const sig = buildDraftJudgeSignature(currentDraft.selectedOptionId, currentDraft.commandText, decodeCmd);
    const res = judgeWarGameSubmission({
      scenarioId: scenario.id,
      selectedOptionId: currentDraft.selectedOptionId,
      commandText: currentDraft.commandText,
      decodeCommandText: scenario.topology === "pd" ? decodeCmd : undefined,
    });
    updateCurrentDraft({ lastResult: res, judgedSig: sig });
    if (res.passed) {
      const storage = getDefaultBrowserStorage();
      const merged = new Set<WarGameScenarioId>([
        ...readWarGamePassedIds(storage),
        ...passedIds,
        scenario.id,
      ]);
      setPassedIds(merged);
      writeWarGamePassedIds(merged, storage);
    }
  };

  const handleResetCase = () => {
    updateCurrentDraft({
      selectedOptionId: null,
      commandText: scenario.initialCommand,
      decodeCommandText: scenario.initialDecodeCommand ?? "",
      revealedHints: 0,
      lastResult: null,
      judgedSig: null,
    });
  };

  const handleCopyShareLink = async () => {
    if (typeof window === "undefined") return;
    const shareParams = buildWarGameQueryParams(scenario.id, searchParams);
    const shareUrl = `${window.location.origin}${window.location.pathname}#/tools?${shareParams.toString()}`;
    const ok = await copyTextToClipboard(shareUrl);
    if (ok) {
      setShareFallbackNotice(null);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 1800);
    } else {
      setLinkCopied(false);
      setShareFallbackNotice(`剪贴板不可用，请手动复制链接：${shareUrl}`);
    }
  };

  return (
    <section
      className={`wt-root ${embedded ? "wt-root-embedded" : "wt-root-full"}`}
      data-testid="wargame-view"
      data-active-case={scenario.id}
      data-topology={scenario.topology}
    >
      <header className="wt-header">
        <div className="wt-header-main">
          <div className="wt-title-row">
            <h2 className="wt-title">{title ?? "生产故障实战通关场"}</h2>
            <span className="wt-baseline-pill">
              {WARGAME_SCENARIOS.length} 关真凭实据演练 · [C] 源码 / [M] 实测
            </span>
            <span
              className={`wt-stat-pill ${passedIds.size === WARGAME_SCENARIOS.length ? "is-known" : ""}`}
              data-testid="wargame-progress-badge"
              style={{
                borderColor: "color-mix(in srgb, var(--color-token) 42%, var(--color-line))",
                background: "var(--color-token-soft)",
                color: "var(--color-token)",
              }}
            >
              已通关 {passedIds.size} / {WARGAME_SCENARIOS.length} 关
            </span>
          </div>
          <p className="wt-subtitle">
            {summary ??
              "先看真实故障日志或 /metrics 指标 → 选出首错卡与根因 → 亲手改对启动命令并通过确定性防逃课判卷，通关后解锁源码行号与知识库复盘卡。"}
          </p>
        </div>
        <div className="wt-header-actions">
          <button
            type="button"
            className="wt-preset-btn"
            data-testid="wargame-copy-share-link"
            onClick={handleCopyShareLink}
          >
            {linkCopied ? "已复制关卡链接" : "复制当前关卡链接"}
          </button>
          <button
            type="button"
            className="wt-preset-btn"
            data-testid="wargame-reset-case"
            onClick={handleResetCase}
          >
            重置本关草稿
          </button>
          {assistant && (
            <button
              type="button"
              className="wt-assistant-btn"
              data-testid="wargame-ask-assistant"
              onClick={(e) =>
                assistant.openChat({
                  prompt: buildWarGameAssistantPrompt(scenario, currentDraft),
                  trigger: e.currentTarget,
                })
              }
            >
              向知识库助手请教思路
            </button>
          )}
        </div>
      </header>

      {shareFallbackNotice && (
        <div className="wt-demo-banner" data-testid="wargame-share-fallback" role="status">
          <span>{shareFallbackNotice}</span>
        </div>
      )}

      {/* 6 关切换栏 */}
      <div className="wt-presets" role="tablist" aria-label="选择生产故障关卡">
        {WARGAME_SCENARIOS.map((item, idx) => {
          const selected = item.id === scenario.id;
          const cleared = passedIds.has(item.id);
          return (
            <button
              key={item.id}
              ref={(el) => {
                caseTabRefs.current[idx] = el;
              }}
              type="button"
              role="tab"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              className={`wt-preset-btn${selected ? " is-active" : ""}`}
              data-testid={`wargame-case-tab-${item.id}`}
              onClick={() => setActiveCaseId(item.id)}
              onKeyDown={(e) => {
                let targetIdx: number | null = null;
                if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                  targetIdx = (idx + 1) % WARGAME_SCENARIOS.length;
                } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                  targetIdx = (idx - 1 + WARGAME_SCENARIOS.length) % WARGAME_SCENARIOS.length;
                } else if (e.key === "Home") {
                  targetIdx = 0;
                } else if (e.key === "End") {
                  targetIdx = WARGAME_SCENARIOS.length - 1;
                }
                if (targetIdx === null || !WARGAME_SCENARIOS[targetIdx]) return;
                e.preventDefault();
                setActiveCaseId(WARGAME_SCENARIOS[targetIdx]!.id);
                caseTabRefs.current[targetIdx]?.focus();
              }}
            >
              <span className={`wt-preset-dot ${cleared ? "is-healthy" : "is-pitfall"}`} />
              <span>
                {item.order}. {item.code} [{item.evidenceBadge}]
              </span>
              {cleared && (
                <span style={{ color: "var(--color-token)", fontWeight: 700 }} title="已通关">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 关卡态势与必守防逃课边界 */}
      <div
        className="wt-card"
        data-testid="wargame-mission-card"
        style={{ display: "flex", flexDirection: "column", gap: 8 }}
      >
        <div className="wt-section-head">
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <span className="wt-baseline-pill">{scenario.code}</span>
            <h3 className="wt-section-title">{scenario.title}</h3>
            <span className="wt-baseline-pill">[{scenario.evidenceBadge}] 证据链</span>
            {scenario.provenanceLabel && (
              <span className="wt-baseline-pill" data-testid="wargame-provenance-pill">
                {scenario.provenanceLabel}
              </span>
            )}
            <span className="wt-baseline-pill">{scenario.cardLabel}</span>
          </div>
          <span className="wt-section-meta">{scenario.subtitle}</span>
        </div>
        <div style={{ fontSize: 13.5, color: "var(--color-ink-muted)" }}>
          <strong style={{ color: "var(--color-ink)" }}>通关必守约束：</strong>
          <ul style={{ margin: "4px 0 0", paddingLeft: 20 }}>
            {scenario.missionConstraints.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* 第一步：现场日志 / /metrics 快照 */}
      <div className="wt-section">
        <div className="wt-section-head">
          <h3 className="wt-section-title">第一步 · 研判现场日志与指标（{scenario.telemetryTitle}）</h3>
          <span className="wt-section-meta">基线：{scenario.version}</span>
        </div>
        <pre
          className="wt-card"
          data-testid="wargame-telemetry"
          style={{
            margin: 0,
            overflowX: "auto",
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            lineHeight: 1.55,
            background: "var(--color-canvas)",
            color: "var(--color-ink)",
            whiteSpace: "pre-wrap",
          }}
        >
          {scenario.telemetryText}
        </pre>
      </div>

      {/* 第二步：4 选 1 根因/首错单选题 */}
      <div className="wt-section">
        <div className="wt-section-head">
          <h3 className="wt-section-title">第二步 · 锁定真正首错与根因（4 选 1 单选）</h3>
        </div>
        <div className="wt-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontWeight: 600, color: "var(--color-ink)" }}>{scenario.question.prompt}</div>
          <div
            role="radiogroup"
            aria-label={scenario.question.prompt}
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
          >
            {scenario.question.options.map((opt) => {
              const checked = currentDraft.selectedOptionId === opt.id;
              return (
                <label
                  key={opt.id}
                  data-testid={`wargame-option-${opt.id}`}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: "var(--radius-field)",
                    border: `1px solid ${checked ? "var(--color-accent)" : "var(--color-line)"}`,
                    background: checked ? "var(--color-accent-soft)" : "var(--color-surface)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name={`${idPrefix}-quiz-${scenario.id}`}
                    checked={checked}
                    onChange={() => updateCurrentDraft({ selectedOptionId: opt.id })}
                    style={{ marginTop: 4, accentColor: "var(--color-accent)" }}
                  />
                  <span>
                    <strong style={{ marginRight: 6 }}>{opt.id}.</strong>
                    {opt.label}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {/* 第三步：修复启动命令编辑器（单实例 / P/D 双实例） */}
      <div className="wt-section">
        <div className="wt-section-head">
          <h3 className="wt-section-title">
            第三步 · 动手修复启动命令（{scenario.topology === "pd" ? "P/D 分离双命令" : "单实例命令"}）
          </h3>
          <span className="wt-section-meta">严防拼错参数（unknownFlags 必须为 0）</span>
        </div>
        <div className={`wt-editor-grid${scenario.topology === "pd" ? " wt-editor-grid-pd" : ""}`}>
          <div className="wt-editor-card">
            <div className="wt-editor-head">
              <label className="wt-editor-title" htmlFor={`${idPrefix}-cmd-primary`}>
                {scenario.topology === "pd" ? "Prefill 实例启动命令" : "vllm serve 启动命令"}
              </label>
              <span className={`wt-editor-role${scenario.topology === "pd" ? " is-prefill" : ""}`}>
                {scenario.topology === "pd"
                  ? `Prefill · ${scenario.hardwareFamily}`
                  : scenario.hardwareFamily}
              </span>
            </div>
            <textarea
              id={`${idPrefix}-cmd-primary`}
              className="wt-textarea"
              data-testid="wargame-cmd-input"
              spellCheck={false}
              value={currentDraft.commandText}
              onChange={(e) => updateCurrentDraft({ commandText: e.target.value })}
            />
          </div>

          {scenario.topology === "pd" && (
            <div className="wt-editor-card">
              <div className="wt-editor-head">
                <label className="wt-editor-title" htmlFor={`${idPrefix}-cmd-decode`}>
                  Decode 实例启动命令
                </label>
                <span className="wt-editor-role is-decode">
                  Decode · {scenario.decodeHardwareFamily ?? scenario.hardwareFamily}
                </span>
              </div>
              <textarea
                id={`${idPrefix}-cmd-decode`}
                className="wt-textarea"
                data-testid="wargame-decode-cmd-input"
                spellCheck={false}
                value={currentDraft.decodeCommandText}
                onChange={(e) => updateCurrentDraft({ decodeCommandText: e.target.value })}
              />
            </div>
          )}
        </div>
      </div>

      {/* 按需点开的 3 级渐进提示（默认全部折叠，不提前剧透） */}
      <div className="wt-section" data-testid="wargame-hints-section">
        <div className="wt-section-head">
          <h3 className="wt-section-title">
            卡壳了？按需点开 3 级渐进提示（{currentDraft.revealedHints} / 3 已展开）
          </h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {[1, 2, 3].map((lvl) => {
              const unlocked = currentDraft.revealedHints >= lvl;
              const canClick = currentDraft.revealedHints + 1 >= lvl;
              return (
                <button
                  key={lvl}
                  type="button"
                  className={`wt-filter-btn${unlocked ? " is-active" : ""}`}
                  data-testid={`wargame-hint-btn-${lvl}`}
                  disabled={!canClick}
                  onClick={() => {
                    if (currentDraft.revealedHints < lvl) {
                      updateCurrentDraft({ revealedHints: lvl });
                    }
                  }}
                >
                  {unlocked ? `提示 ${lvl} ✓` : `点开提示 ${lvl}`}
                </button>
              );
            })}
          </div>
        </div>
        {currentDraft.revealedHints > 0 && (
          <div
            className="wt-card"
            data-testid="wargame-hints-list"
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
          >
            {scenario.hints.slice(0, currentDraft.revealedHints).map((hintText, idx) => (
              <div
                key={hintText}
                data-testid={`wargame-hint-item-${idx + 1}`}
                style={{
                  padding: "8px 12px",
                  borderRadius: "var(--radius-field)",
                  border: "1px solid var(--color-line)",
                  background: "var(--color-canvas)",
                  fontSize: 13.5,
                }}
              >
                {hintText}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 提交确定性判卷与逐项 checks 清单 */}
      <div
        className={`wt-summary-bar${
          currentDraft.lastResult && !isVerdictStale
            ? currentDraft.lastResult.passed
              ? " is-pass"
              : " is-blocked"
            : ""
        }`}
        data-testid="wargame-judge-bar"
      >
        <div className="wt-summary-left">
          {currentDraft.lastResult ? (
            isVerdictStale ? (
              <span
                style={{ fontWeight: 600, color: "var(--color-warning)" }}
                data-testid="wargame-verdict-stale"
              >
                ⚠️ 草稿已修改（下方仍为上一版提交记录），请点击右侧「提交判卷」重新验证当前命令
              </span>
            ) : currentDraft.lastResult.passed ? (
              <span className="wt-pass-banner" data-testid="wargame-verdict-pass">
                ✓ 恭喜通关！6 项确定性防逃课校验全部通过（oomStatus={currentDraft.lastResult.oomStatus}）
              </span>
            ) : (
              <span className="wt-blocked-banner" data-testid="wargame-verdict-fail">
                ✗ 尚未通关：通过 {currentDraft.lastResult.checks.filter((c) => c.passed).length} /{" "}
                {currentDraft.lastResult.checks.length} 项校验（请对照下方逐项清单修正）
              </span>
            )
          ) : (
            <span style={{ fontWeight: 600, color: "var(--color-ink-muted)" }}>
              完成上方根因单选与命令修改后，点击右侧按钮执行确定性联合判卷
            </span>
          )}
        </div>
        <button
          type="button"
          className="wt-assistant-btn"
          data-testid="wargame-submit-btn"
          onClick={handleSubmitJudge}
        >
          提交判卷（验证根因 + 命令）
        </button>
      </div>

      {currentDraft.lastResult && (
        <div
          className="wt-card"
          data-testid="wargame-checks-list"
          style={{ display: "flex", flexDirection: "column", gap: 8 }}
        >
          <strong style={{ fontSize: 14, color: "var(--color-ink)" }}>逐项防逃课判卷清单（6 维门禁）</strong>
          {currentDraft.lastResult.checks.map((chk) => (
            <div
              key={chk.id}
              data-testid={`wargame-check-${chk.id}`}
              data-passed={chk.passed ? "true" : "false"}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                padding: "8px 12px",
                borderRadius: "var(--radius-field)",
                border: `1px solid ${chk.passed ? "color-mix(in srgb, var(--color-token) 42%, var(--color-line))" : "color-mix(in srgb, var(--color-danger) 42%, var(--color-line))"}`,
                background: chk.passed
                  ? "color-mix(in srgb, var(--color-token-soft) 45%, var(--color-surface-elevated))"
                  : "color-mix(in srgb, var(--color-danger) 7%, var(--color-surface-elevated))",
              }}
            >
              <strong
                style={{ color: chk.passed ? "var(--color-token)" : "var(--color-danger)", fontSize: 13.5 }}
              >
                {chk.passed ? "✓" : "✗"} {chk.label}
              </strong>
              <span style={{ fontSize: 13, color: "var(--color-ink-muted)" }}>{chk.detail}</span>
            </div>
          ))}
        </div>
      )}

      {/* 通关后解锁的源码锚点与 Wiki 章节复盘卡 */}
      {unlockedDebrief ? (
        <div
          className="wt-card"
          data-testid="wargame-debrief-card"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            borderColor: "color-mix(in srgb, var(--color-token) 45%, var(--color-line))",
            background: "color-mix(in srgb, var(--color-token-soft) 32%, var(--color-surface-elevated))",
          }}
        >
          <strong style={{ fontSize: 15, color: "var(--color-token)" }}>
            通关复盘卡 · 上游源码锚点与知识库深潜
          </strong>
          <p style={{ margin: 0, fontSize: 14, color: "var(--color-ink)" }}>
            <strong>核心铁律：</strong>
            {unlockedDebrief.takeaway}
          </p>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--color-ink-muted)" }}>
            <strong style={{ color: "var(--color-ink)" }}>故障因果链：</strong>
            {unlockedDebrief.rootCauseChain}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <strong style={{ fontSize: 13.5, color: "var(--color-ink)" }}>核验源码位置：</strong>
            {unlockedDebrief.sourceAnchors.map((a) => (
              <div key={a.ref} style={{ fontSize: 13, color: "var(--color-ink-muted)" }}>
                <SourceAnchorLink rawRef={a.ref} /> — {a.note}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <strong style={{ fontSize: 13.5, color: "var(--color-ink)" }}>关联章节：</strong>
            {unlockedDebrief.wikiRefs.map((w) => (
              <ToolDeepLinkById key={w.pageId} pageId={w.pageId} anchor={w.anchor} label={w.label} />
            ))}
          </div>
        </div>
      ) : (
        <div
          className="wt-card"
          data-testid="wargame-debrief-locked"
          style={{ background: "var(--color-canvas)", color: "var(--color-ink-muted)", fontSize: 13.5 }}
        >
          🔒 源码锚点与知识库复盘卡暂未解锁：同时答对根因单选并通过全部命令防逃课校验后自动展开。
        </div>
      )}
    </section>
  );
}
