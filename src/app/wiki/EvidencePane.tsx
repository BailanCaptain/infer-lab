import { AlertCircle, ExternalLink, FileCode2, FileText, RefreshCw } from "lucide-react";
import { useSyncExternalStore } from "react";
import {
  type createEvidenceViewController,
  type EvidenceEntry,
  resolveActiveEvidence,
} from "../../content/wiki/evidence-schema";

export type EvidenceViewController = ReturnType<typeof createEvidenceViewController>;

const UNAVAILABLE_REASON_TEXT: Record<string, string> = {
  "out-of-range": "引用行号超出该固定版本文件的有效行范围，离线摘录未展示越界内容。",
  "missing-file": "该固定提交下未找到目标路径对应的源码文件。",
  "invalid-commit": "本地受配置仓库中未找到该钉住提交的对象记录。",
  "unknown-repo": "该仓库未在本地 seeds 配置中登记，无法读取离线源码且不猜测外部仓库地址。",
  "missing-raw": "本地原文快照文件缺失。",
  "tampered-raw": "本地原文快照 SHA-256 完整性校验未通过，已拦截展示。",
  "unpublished-raw": "该原文快照未被已发布正式页引用，按公开边界不予展示。",
  "invalid-raw-ref": "原文快照引用格式或行号不合法。",
};

function formatRangeSummary(entry: EvidenceEntry): string | null {
  if (entry.kind === "repo" && entry.status === "ok") {
    const hasExplicitRange = entry.ref.includes("#L");
    if (!hasExplicitRange && entry.totalLines > entry.lines.length) {
      return `显示前 1–${entry.lineEnd} 行（共 ${entry.totalLines} 行 · 未指定行号范围，仅截取前 ${entry.lineEnd} 行预览）`;
    }
    if (!hasExplicitRange) {
      return `第 1–${entry.lineEnd} 行（共 ${entry.totalLines} 行 · 整文件引用）`;
    }
    return entry.lineStart === entry.lineEnd
      ? `第 ${entry.lineStart} 行（共 ${entry.totalLines} 行）`
      : `第 ${entry.lineStart}–${entry.lineEnd} 行（共 ${entry.totalLines} 行）`;
  }
  if (entry.kind === "raw" && entry.status === "ok") {
    return entry.lineStart === entry.lineEnd
      ? `第 ${entry.lineStart} 行（共 ${entry.totalLines} 行 · SHA-256 已核验）`
      : `第 ${entry.lineStart}–${entry.lineEnd} 行（共 ${entry.totalLines} 行 · SHA-256 已核验）`;
  }
  if (entry.status === "unavailable") {
    const parts: string[] = [];
    if (entry.lineStart !== undefined && entry.lineEnd !== undefined) {
      parts.push(
        entry.lineStart === entry.lineEnd
          ? `请求第 ${entry.lineStart} 行`
          : `请求第 ${entry.lineStart}–${entry.lineEnd} 行`,
      );
    }
    if (entry.totalLines !== undefined) parts.push(`文件共 ${entry.totalLines} 行`);
    return parts.length > 0 ? parts.join(" · ") : null;
  }
  return null;
}

function kindLabelOf(entry: EvidenceEntry): string {
  if (entry.kind === "repo") return "固定提交源码";
  if (entry.kind === "raw") return "已核对原文快照";
  return "外部参考链接";
}

export function EvidencePane({
  id,
  hidden,
  controller,
}: {
  id: string;
  hidden: boolean;
  controller: EvidenceViewController;
}) {
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  const active = resolveActiveEvidence(state);
  const entry = active.entry;
  const sourceNumber = state.target?.kind === "source" ? state.target.sourceIndex + 1 : undefined;
  const totalSources = state.pack?.pageSources.length ?? 0;
  const rangeSummary = entry ? formatRangeSummary(entry) : null;

  return (
    <div
      id={id}
      className="wiki-evpane"
      role="tabpanel"
      aria-label="证据"
      data-testid="evidence-pane"
      hidden={hidden}
    >
      <div className="wiki-evpane-bar">
        <span className="wiki-evpane-title">
          <FileCode2 size={16} aria-hidden="true" /> 离线源码与原文证据
        </span>
        {sourceNumber !== undefined && totalSources > 0 && (
          <span className="wiki-evpane-counter" data-testid="evidence-source-index">
            来源 #{sourceNumber} / {totalSources}
          </span>
        )}
        {state.target?.kind === "diagram" && active.diagramGroup && active.diagramGroup.pins.length > 0 && (
          <span className="wiki-evpane-counter" data-testid="evidence-pin-index">
            图符号 #{(active.selectedPin?.pinIndex ?? 0) + 1} / {active.diagramGroup.pins.length}
          </span>
        )}
      </div>

      <div className="wiki-evpane-scroll">
        {(state.status === "idle" || !state.target) && (
          <div className="wiki-evpane-empty" data-testid="evidence-empty">
            <span className="eyebrow">OFFLINE EVIDENCE</span>
            <strong className="wiki-evpane-empty-title">点按角标或来源列表，就地核对固定源码</strong>
            <p className="wiki-evpane-empty-hint">
              点击正文中的编号角标（如
              [C1]、[S1]）或文末「查看来源」条目，在此查看对应固定版本的真实行号摘录或已存原文快照。
            </p>
          </div>
        )}

        {state.status === "loading" && state.target && (
          <p className="wiki-evpane-loading" role="status" data-testid="evidence-loading">
            正在读取当前页面的离线证据摘录…
          </p>
        )}

        {state.status === "error" && (
          <div className="wiki-evpane-error" role="alert" data-testid="evidence-error">
            <p className="wiki-panel-error">
              <AlertCircle size={15} aria-hidden="true" />
              <span>{state.error || "证据资料加载失败，请检查连接后重试。"}</span>
            </p>
            <button
              type="button"
              className="wiki-evpane-retry"
              data-testid="evidence-retry"
              onClick={() => void controller.retry()}
            >
              <RefreshCw size={13} aria-hidden="true" /> 重试读取
            </button>
          </div>
        )}

        {state.status === "ready" &&
          state.target?.kind === "diagram" &&
          (!active.diagramGroup || active.diagramGroup.pins.length === 0) && (
            <div className="wiki-evpane-card" data-testid="evidence-diagram-empty">
              <strong className="wiki-evpane-card-title">该示意图未绑定源码符号定位（pins）</strong>
              <p className="wiki-evpane-card-desc">
                这张教学图用于表达结构或运算关系，未声明独立的源码行锚点；如需核对本页事实出处，可点击正文角标或文末「查看来源」列表。
              </p>
              {active.diagramGroup?.caption && (
                <span className="wiki-evpane-muted">{active.diagramGroup.caption}</span>
              )}
            </div>
          )}

        {state.status === "ready" && state.target && state.target.kind !== "diagram" && !entry && (
          <div className="wiki-evpane-card" data-testid="evidence-unavailable">
            <strong className="wiki-evpane-card-title">未找到对应来源记录</strong>
            <p className="wiki-evpane-card-desc">当前页面证据包中不存在该编号的来源条目。</p>
          </div>
        )}

        {state.status === "ready" && entry && (
          <div className="wiki-evpane-detail">
            {active.diagramGroup && active.diagramGroup.pins.length > 0 && (
              <div className="wiki-evpane-pins" data-testid="evidence-pins">
                <span className="wiki-evpane-pins-label">图来源（{active.diagramGroup.caption}）</span>
                <div className="wiki-evpane-pins-list">
                  {active.diagramGroup.pins.map((pin) => {
                    const selected = active.selectedPin?.pinIndex === pin.pinIndex;
                    const afterColon = pin.ref.includes(":")
                      ? pin.ref.slice(pin.ref.indexOf(":") + 1)
                      : pin.ref;
                    const fileAndRange = afterColon.split("/").slice(-1)[0] ?? afterColon;
                    return (
                      <button
                        key={pin.pinIndex}
                        type="button"
                        data-testid={`evidence-pin-${pin.pinIndex}`}
                        title={pin.ref}
                        className={`wiki-evpane-pin${selected ? " is-selected" : ""}`}
                        aria-pressed={selected}
                        onClick={() => controller.selectPin(pin.pinIndex)}
                      >
                        {pin.symbols.join(" / ")} · {fileAndRange}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="wiki-evpane-meta">
              <div className="wiki-evpane-badges">
                <span className="wiki-evpane-kind">{kindLabelOf(entry)}</span>
                {entry.kind === "repo" && (
                  <span className="wiki-evpane-commit">
                    {entry.repo}@{entry.commit.slice(0, 8)}
                  </span>
                )}
                {entry.kind === "repo" &&
                  (entry.versionRefs.length > 0 ? (
                    entry.versionRefs.map((ver) => (
                      <span key={ver} className="wiki-evpane-ver" data-testid="evidence-version">
                        {ver}
                      </span>
                    ))
                  ) : (
                    <span className="wiki-evpane-ver is-muted">固定提交</span>
                  ))}
              </div>
              {active.selectedPin && (
                <span className="wiki-evpane-symbols" data-testid="evidence-pin-symbols">
                  定位符号：{active.selectedPin.symbols.join("、")}
                </span>
              )}
              <code className="wiki-evpane-path">
                {entry.kind === "repo"
                  ? entry.path
                  : entry.kind === "raw"
                    ? (entry.path ?? entry.ref)
                    : entry.externalHref}
              </code>
              {rangeSummary && (
                <span className="wiki-evpane-range" data-testid="evidence-range">
                  {rangeSummary}
                </span>
              )}
            </div>

            {(entry.kind === "repo" || entry.kind === "raw") && entry.status === "ok" && (
              <div className="wiki-evpane-codebox" data-testid="evidence-lines">
                {entry.lines.map((line) => (
                  <div key={line.number} className="wiki-evpane-row" data-line={line.number}>
                    <span className="wiki-evpane-ln">{line.number}</span>
                    <span className="wiki-evpane-code">{line.text}</span>
                  </div>
                ))}
              </div>
            )}

            {entry.kind === "url" && (
              <div className="wiki-evpane-card" data-testid="evidence-external">
                <strong className="wiki-evpane-card-title">
                  <FileText size={15} aria-hidden="true" /> 外部参考网页（无本地离线快照）
                </strong>
                <p className="wiki-evpane-card-desc">
                  该来源为外部网页链接，知识库未保存其本地离线快照，也不会在阅读时自动联网抓取未知网页内容。
                </p>
                <a className="wiki-evpane-extbtn" href={entry.externalHref} target="_blank" rel="noreferrer">
                  打开外部来源 <ExternalLink size={13} aria-hidden="true" />
                </a>
              </div>
            )}

            {entry.status === "unavailable" && (
              <div className="wiki-evpane-card is-unavailable" data-testid="evidence-unavailable">
                <strong className="wiki-evpane-card-title">离线摘录暂不可用</strong>
                <p className="wiki-evpane-card-desc">
                  {UNAVAILABLE_REASON_TEXT[entry.reason] ?? "该来源当前无法在本地核对。"}
                </p>
                <code className="wiki-evpane-rawref">{entry.ref}</code>
              </div>
            )}

            <div className="wiki-evpane-foot">
              {entry.kind === "repo" &&
                (entry.externalHref ? (
                  <a
                    className="wiki-evpane-extlink"
                    href={entry.externalHref}
                    target="_blank"
                    rel="noreferrer"
                  >
                    在 GitHub 查看固定提交 <ExternalLink size={13} aria-hidden="true" />
                  </a>
                ) : (
                  <span className="wiki-evpane-muted">未配置外部代码仓库地址</span>
                ))}
              {entry.kind === "raw" && entry.rawViewerHref && (
                <a
                  className="wiki-evpane-extlink"
                  href={entry.rawViewerHref}
                  target="_blank"
                  rel="noreferrer"
                >
                  打开独立原文快照页 <ExternalLink size={13} aria-hidden="true" />
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
