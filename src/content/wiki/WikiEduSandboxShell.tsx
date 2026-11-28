import type { KeyboardEvent, ReactNode, Ref } from "react";
import { useMemo } from "react";

export type EduSandboxMode = "sandbox" | "svg";
export type EduBadgeTone = "default" | "accent" | "warn" | "danger";

export interface WikiEduSandboxShellProps {
  readonly id: string;
  readonly caption: string;
  readonly safeSvg: string;
  readonly mode: EduSandboxMode;
  readonly onToggleMode: (next: EduSandboxMode) => void;
  readonly scrollRef: Ref<HTMLDivElement>;
  readonly scrollable: boolean;
  readonly onScroll: () => void;
  readonly kickerTag: string;
  readonly kickerTitle: string;
  readonly question: ReactNode;
  readonly toolbarLabel: string;
  readonly onToolbarKeyDown?: ((event: KeyboardEvent<HTMLElement>) => void) | undefined;
  readonly toolbar: ReactNode;
  readonly children: ReactNode;
  readonly takeawayBadge: string;
  readonly takeawayTone?: EduBadgeTone | undefined;
  readonly takeaway: ReactNode;
  readonly kpi: string;
  readonly detailsSummary: string;
  readonly detailsContent: ReactNode;
  readonly extraRootAttrs?: Readonly<Record<string, string | number | undefined>> | undefined;
  readonly useTokenVariables?: boolean | undefined;
}

const STATIC_BTN_IDLE_STYLE = {
  background: "#ffffff",
  borderColor: "#d8d8cf",
  color: "#17211f",
} as const;

const STATIC_BTN_ACTIVE_STYLE = {
  background: "#17211f",
  borderColor: "#17211f",
  color: "#ffffff",
} as const;

const STATIC_BTN_IDLE_TOKEN_STYLE = {
  background: "var(--color-surface-elevated)",
  borderColor: "var(--color-line)",
  color: "var(--color-ink)",
} as const;

const STATIC_BTN_ACTIVE_TOKEN_STYLE = {
  background: "var(--color-ink)",
  borderColor: "var(--color-ink)",
  color: "var(--color-ink-inverse)",
} as const;

export function eduBtnStyle(active: boolean, kind: "dark" | "teal" | "accent" = "teal") {
  if (!active) {
    return { background: "#ffffff", borderColor: "#d8d8cf", color: "#17211f" } as const;
  }
  const bg = kind === "dark" ? "#17211f" : kind === "accent" ? "#e85b32" : "#087f73";
  return { background: bg, borderColor: bg, color: "#ffffff" } as const;
}

const NON_TEXT_INPUT_TYPES = new Set(["range", "button", "checkbox", "radio", "reset", "submit"]);

export function isTextEntryTarget(target: unknown): boolean {
  if (typeof target !== "object" || target === null) return false;
  const el = target as { tagName?: string; type?: string; isContentEditable?: boolean };
  if (el.isContentEditable === true) return true;
  const tag = typeof el.tagName === "string" ? el.tagName.toUpperCase() : "";
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const inputType = typeof el.type === "string" ? el.type.toLowerCase() : "text";
    return !NON_TEXT_INPUT_TYPES.has(inputType);
  }
  return false;
}

export function WikiEduSandboxShell({
  id,
  caption,
  safeSvg,
  mode,
  onToggleMode,
  scrollRef,
  scrollable,
  onScroll,
  kickerTag,
  kickerTitle,
  question,
  toolbarLabel,
  onToolbarKeyDown,
  toolbar,
  children,
  takeawayBadge,
  takeawayTone = "default",
  takeaway,
  kpi,
  detailsSummary,
  detailsContent,
  extraRootAttrs,
  useTokenVariables = false,
}: WikiEduSandboxShellProps) {
  const html = useMemo(() => ({ __html: safeSvg }), [safeSvg]);
  const isSvg = mode === "svg";
  const idleBtnStyle = useTokenVariables ? STATIC_BTN_IDLE_TOKEN_STYLE : STATIC_BTN_IDLE_STYLE;
  const activeBtnStyle = useTokenVariables ? STATIC_BTN_ACTIVE_TOKEN_STYLE : STATIC_BTN_ACTIVE_STYLE;

  const handleRootKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    if (isTextEntryTarget(event.target)) return;
    if (event.key === "0" || event.key === "Escape") {
      event.preventDefault();
      onToggleMode("svg");
    }
  };

  return (
    <section
      aria-label={kickerTitle}
      className="wiki-diagram-interactive wiki-edu-card"
      data-testid="interactive-diagram-root"
      data-diagram-id={id}
      data-mode={mode}
      onKeyDown={handleRootKeyDown}
      {...extraRootAttrs}
    >
      <div className="wiki-edu-head">
        <div className="wiki-edu-head-left">
          <div className="wiki-edu-kicker">
            <span className="wiki-edu-pill-tag">{kickerTag}</span>
            <span>{kickerTitle}</span>
          </div>
          <p className="wiki-edu-question">{question}</p>
        </div>
        <div className="wiki-edu-mode-actions">
          {isSvg && (
            <button
              type="button"
              className="wiki-edu-static-toggle"
              data-testid="diagram-mode-sandbox"
              aria-pressed={!isSvg}
              style={idleBtnStyle}
              onClick={() => onToggleMode("sandbox")}
            >
              返回交互版
            </button>
          )}
          <button
            type="button"
            className="wiki-edu-static-toggle"
            data-testid="diagram-mode-svg"
            aria-pressed={isSvg}
            style={isSvg ? activeBtnStyle : idleBtnStyle}
            onClick={() => onToggleMode(isSvg ? "sandbox" : "svg")}
          >
            {isSvg ? "正在看原静态图（点此回交互版）" : "查看原静态图"}
          </button>
        </div>
      </div>

      <div
        className="wiki-diagram-toolbar wiki-edu-controls"
        role="toolbar"
        aria-label={toolbarLabel}
        onKeyDown={onToolbarKeyDown}
      >
        {toolbar}
      </div>

      <div className="wiki-edu-stage">
        {isSvg ? (
          <div
            key="svg"
            className="wiki-diagram-svg"
            ref={scrollRef}
            onScroll={onScroll}
            {...(scrollable ? { tabIndex: 0, role: "group", "aria-label": caption || id } : {})}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: safeSvg 已由共用 sanitizeDiagram 白名单清洗并按实例隔离内部 id
            dangerouslySetInnerHTML={html}
          />
        ) : (
          <div key="sandbox" className="wiki-edu-sandbox-body">
            {children}
          </div>
        )}
      </div>

      <output className="wiki-edu-footer" data-testid="diagram-step-readout" aria-live="polite">
        <div className="wiki-edu-takeaway">
          <div className="wiki-edu-takeaway-main">
            <span className={`wiki-edu-takeaway-badge tone-${takeawayTone}`}>{takeawayBadge}</span>
            <span className="wiki-edu-takeaway-text">{takeaway}</span>
          </div>
          <span className="wiki-edu-kpi">{kpi}</span>
        </div>
        <details className="wiki-edu-details">
          <summary>{detailsSummary}</summary>
          <div className="wiki-edu-details-body">{detailsContent}</div>
        </details>
      </output>
    </section>
  );
}
