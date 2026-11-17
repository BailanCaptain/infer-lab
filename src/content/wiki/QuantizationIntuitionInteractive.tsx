import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { type KeyboardEvent, type Ref, useMemo, useState } from "react";

export interface InteractiveDiagramProps {
  readonly id: string;
  readonly safeSvg: string;
  readonly caption: string;
  readonly scrollRef: Ref<HTMLDivElement>;
  readonly scrollable: boolean;
  readonly onScroll: () => void;
}

type StepNumber = 1 | 2 | 3 | 4;
type DiagramStep = 0 | StepNumber;

interface FocusRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly rx: number;
}

interface StepSpec {
  readonly step: StepNumber;
  readonly shortLabel: string;
  readonly title: string;
  readonly detail: string;
  readonly badge: { readonly cx: number; readonly cy: number };
  readonly rects: readonly FocusRect[];
  readonly paths?: readonly string[];
}

const STEPS: readonly StepSpec[] = [
  {
    step: 1,
    shortLabel: "1 压权重",
    title: "第 1 步 · 离线做一次：权重压成 INT8",
    detail:
      "离线阶段把 BF16 权重（每个数 2 字节）按输出通道每列除以自己的系数，舍入后截到 −128…127 存成 INT8（每个数 1 字节），下方细条留下每个输出通道的缩放系数。",
    badge: { cx: 244, cy: 80 },
    rects: [{ x: 104, y: 46, w: 430, h: 158, rx: 16 }],
  },
  {
    step: 2,
    shortLabel: "2 压激活",
    title: "第 2 步 · 每次前向：激活当场压成 INT8",
    detail:
      "每次前向把 BF16 输入激活（一行是一个 token）每行除以按本次输入现算的系数压成 INT8，右边细条留下每行的缩放系数；同一份权重每次配新的激活系数。",
    badge: { cx: 244, cy: 274 },
    rects: [{ x: 104, y: 240, w: 430, h: 158, rx: 16 }],
  },
  {
    step: 3,
    shortLabel: "3 整数乘加",
    title: "第 3 步 · 整数乘加（结果先是整数）",
    detail:
      "整数乘加只吃离线压好的 INT8 权重和当场压好的 INT8 激活，算出的结果先是整数；两路缩放系数绕开这一步，不进整数乘加。",
    badge: { cx: 564, cy: 190 },
    rects: [
      { x: 414, y: 56, w: 96, h: 84, rx: 10 },
      { x: 414, y: 250, w: 96, h: 72, rx: 10 },
      { x: 554, y: 180, w: 116, h: 76, rx: 12 },
    ],
    paths: ["M504 118 L532 118 L532 205 L560 205", "M520 286 L540 286 L540 231 L560 231"],
  },
  {
    step: 4,
    shortLabel: "4 乘回系数",
    title: "第 4 步 · 乘回两个系数，恢复输出 BF16",
    detail:
      "整数乘加的结果最后乘回每个输出通道的权重系数和每行的激活系数，输出恢复成 BF16。图示为逻辑步骤，提前量化和融合可以改变实际算子调用次数。",
    badge: { cx: 680, cy: 190 },
    rects: [
      { x: 416, y: 140, w: 92, h: 18, rx: 6 },
      { x: 506, y: 252, w: 18, h: 68, rx: 6 },
      { x: 670, y: 180, w: 108, h: 76, rx: 12 },
      { x: 784, y: 184, w: 84, h: 90, rx: 10 },
    ],
    paths: [
      "M504 149 L548 149 L548 168 L700 168 L700 186",
      "M520 316 L548 316 L548 268 L730 268 L730 250",
      "M664 218 L676 218",
      "M772 218 L790 218",
    ],
  },
];

export function QuantizationIntuitionInteractive({
  id,
  safeSvg,
  caption,
  scrollRef,
  scrollable,
  onScroll,
}: InteractiveDiagramProps) {
  const [step, setStep] = useState<DiagramStep>(0);
  const html = useMemo(() => ({ __html: safeSvg }), [safeSvg]);
  const currentSpec = step === 0 ? undefined : STEPS[step - 1];

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
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
        setStep((prev) => (prev === 0 ? 1 : (Math.min(4, prev + 1) as StepNumber)));
        break;
      case "ArrowLeft":
        event.preventDefault();
        setStep((prev) => (prev > 1 ? ((prev - 1) as StepNumber) : prev));
        break;
      case "1":
      case "2":
      case "3":
      case "4":
        event.preventDefault();
        setStep(Number(event.key) as StepNumber);
        break;
      case "0":
      case "Home":
      case "Escape":
        event.preventDefault();
        setStep(0);
        break;
      case "End":
        event.preventDefault();
        setStep(4);
        break;
    }
  };

  return (
    <div
      className="wiki-diagram-interactive"
      data-testid="interactive-diagram-root"
      data-mode={step === 0 ? "overview" : "step"}
      data-step={step}
    >
      <div
        className="wiki-diagram-toolbar"
        role="toolbar"
        aria-label="图解分步阅读控制"
        onKeyDown={handleKeyDown}
      >
        <fieldset className="wiki-diagram-mode-switch" aria-label="视图模式">
          <button
            type="button"
            className="wiki-diagram-ctrl-btn"
            data-testid="diagram-mode-overview"
            aria-pressed={step === 0}
            onClick={() => setStep(0)}
          >
            静态总览
          </button>
          <button
            type="button"
            className="wiki-diagram-ctrl-btn"
            data-testid="diagram-mode-step"
            aria-pressed={step > 0}
            onClick={() => setStep((prev) => (prev === 0 ? 1 : prev))}
          >
            手动分步
          </button>
        </fieldset>

        <fieldset className="wiki-diagram-step-group" aria-label="四步切换">
          <button
            type="button"
            className="wiki-diagram-ctrl-btn"
            data-testid="diagram-step-prev"
            disabled={step <= 1}
            onClick={() => setStep((prev) => (prev > 1 ? ((prev - 1) as StepNumber) : prev))}
          >
            <ChevronLeft size={14} aria-hidden="true" />
            上一步
          </button>
          {STEPS.map((item) => {
            const active = step === item.step;
            return (
              <button
                key={item.step}
                type="button"
                className="wiki-diagram-step-btn"
                data-testid={`diagram-step-${item.step}`}
                aria-pressed={active}
                aria-current={active ? "step" : undefined}
                onClick={() => setStep(item.step)}
              >
                {item.shortLabel}
              </button>
            );
          })}
          <button
            type="button"
            className="wiki-diagram-ctrl-btn"
            data-testid="diagram-step-next"
            disabled={step === 4}
            onClick={() => setStep((prev) => (prev === 0 ? 1 : (Math.min(4, prev + 1) as StepNumber)))}
          >
            下一步
            <ChevronRight size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="wiki-diagram-ctrl-btn"
            data-testid="diagram-step-reset"
            disabled={step === 0}
            onClick={() => setStep(0)}
          >
            <RotateCcw size={13} aria-hidden="true" />
            重置
          </button>
        </fieldset>
      </div>

      <div className="wiki-diagram-canvas">
        <div
          className="wiki-diagram-svg"
          ref={scrollRef}
          onScroll={onScroll}
          {...(scrollable ? { tabIndex: 0, role: "group", "aria-label": caption || id } : {})}
        >
          <div className="wiki-diagram-stage">
            <div
              className="wiki-diagram-base"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: safeSvg 已由共用 sanitizeDiagram 白名单清洗并按实例隔离内部 id
              dangerouslySetInnerHTML={html}
            />
            <svg
              className="wiki-diagram-overlay"
              viewBox="0 0 880 440"
              width="880"
              height="440"
              aria-hidden="true"
            >
              {currentSpec?.rects.map((r) => (
                <rect
                  key={`${r.x}-${r.y}-${r.w}-${r.h}`}
                  x={r.x}
                  y={r.y}
                  width={r.w}
                  height={r.h}
                  rx={r.rx}
                  className="wiki-diagram-focus-rect"
                />
              ))}
              {currentSpec?.paths?.map((d) => (
                <path key={d} d={d} className="wiki-diagram-focus-path" />
              ))}
              {currentSpec && (
                <circle
                  cx={currentSpec.badge.cx}
                  cy={currentSpec.badge.cy}
                  r={14}
                  className="wiki-diagram-focus-badge"
                />
              )}
            </svg>
            {STEPS.map((item) => (
              <button
                key={item.step}
                type="button"
                className="wiki-diagram-badge-hit"
                data-testid={`diagram-canvas-badge-${item.step}`}
                aria-label={`切换到第 ${item.step} 步`}
                aria-pressed={step === item.step}
                style={{ left: `${item.badge.cx - 14}px`, top: `${item.badge.cy - 14}px` }}
                onClick={() => setStep(item.step)}
                onKeyDown={handleKeyDown}
              />
            ))}
          </div>
        </div>
      </div>

      <output className="wiki-diagram-step-readout" data-testid="diagram-step-readout" aria-live="polite">
        {currentSpec ? (
          <>
            <span className="wiki-diagram-step-tag">步 {currentSpec.step} / 4</span>
            <strong className="wiki-diagram-step-title">{currentSpec.title}</strong>
            <span className="wiki-diagram-step-detail">{currentSpec.detail}</span>
          </>
        ) : (
          <span className="wiki-diagram-step-overview-hint">
            静态总览：展示普通动态 W8A8 Linear 的完整四步路径；点击「手动分步」或 1 至 4 逐步对照。
          </span>
        )}
      </output>
    </div>
  );
}
