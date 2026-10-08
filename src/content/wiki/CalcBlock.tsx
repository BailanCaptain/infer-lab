import { Fragment } from "react";
import { type CalcRow, isNumericResult, splitExpr } from "./calc";

/**
 * 算式块（2026-09-27 定稿）。外框和图框同一套（wiki.css 的 .wiki-calc），框里一项一行、三栏：
 * 标签 ｜ 算式 ｜ = 结果。多步推导的中间步骤都在算式栏里用等号串起来，只有最终的数进结果栏；
 * 结果栏右对齐、加粗，所有行的等号和结果上下对齐。说明跟在它那一行下面，缩进和算式栏对齐。
 * 行来自 calc.ts（```calc 围栏或认得出的 ```text 块）；title 只在 ```calc 围栏里写了才有。
 */
/**
 * 同一页的算式块标签栏一样宽，各块算式栏的起点上下对齐（P3 验收：two-node 相邻三块的算式栏起点各不相同）。
 * 每块先按自己最长的标签定宽（wiki.css 的 fit-content(34%)），量出最宽的一块，再把整页的标签栏
 * 统一成这个宽度（--wiki-calc-label）。正文宽度变了（窗口、问答栏开合）或字体换好后要重新量。
 */
export function alignCalcLabels(root: HTMLElement): void {
  root.style.removeProperty("--wiki-calc-label");
  let widest = 0;
  for (const label of root.querySelectorAll<HTMLElement>(".wiki-calc-row > .wiki-calc-label")) {
    widest = Math.max(widest, label.getBoundingClientRect().width);
  }
  if (widest > 0) root.style.setProperty("--wiki-calc-label", `${Math.ceil(widest)}px`);
}

export function CalcBlock({ rows, title = "" }: { rows: CalcRow[]; title?: string }) {
  return (
    <figure className="wiki-calc" aria-label={title || "计算过程"}>
      <div className="wiki-calc-grid">
        {rows.map((row, i) => (
          // 算式是静态文本，不会重排，行号就是稳定的 key
          // biome-ignore lint/suspicious/noArrayIndexKey: 同上
          <Row key={i} row={row} />
        ))}
      </div>
      {title && <figcaption className="wiki-calc-caption">{title}</figcaption>}
    </figure>
  );
}

function Expr({ text }: { text: string }) {
  return (
    <>
      {splitExpr(text).map((part, i) =>
        part.kind === "text" ? (
          part.text
        ) : part.kind === "op" ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: 静态文本的零件
          <span key={i}>
            {" "}
            <span className="wiki-calc-op">{part.text}</span>{" "}
          </span>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: 同上
          <span key={i} className="wiki-calc-gloss">
            {part.text}
          </span>
        ),
      )}
    </>
  );
}

function Row({ row }: { row: CalcRow }) {
  if (row.kind === "gap") return <div className="wiki-calc-gap" aria-hidden="true" />;
  if (row.kind === "text") return <p className="wiki-calc-text">{row.text}</p>;
  // 结果是一个数才进结果栏；`input_ids [4] → [4, 4096]` 这种文字结果留在算式栏里，
  // 它前面的符号（可能是 ≈）和后面的比较也跟着留在算式栏，不能因为不进结果栏就丢掉
  const numeric = isNumericResult(row.result);
  const chain = numeric ? row.steps : [...row.steps, row.result];
  return (
    <div className={numeric ? "wiki-calc-row" : "wiki-calc-row is-text"}>
      <span className="wiki-calc-label">{row.label}</span>
      <span className="wiki-calc-expr">
        {chain.map((step, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 步骤按顺序、不重排
          <Fragment key={i}>
            {i > 0 && (
              <>
                {" "}
                <span className="wiki-calc-op">
                  {!numeric && i === chain.length - 1 ? row.resultOp : "="}
                </span>{" "}
              </>
            )}
            <Expr text={step} />
          </Fragment>
        ))}
        {!numeric && row.rel && <Expr text={` ${row.rel}`} />}
      </span>
      {numeric && (
        <>
          <span className="wiki-calc-eq">{row.resultOp}</span>
          <span className="wiki-calc-result">
            <strong>{row.result}</strong>
            {row.rel && (
              <span className="wiki-calc-rel">
                <Expr text={row.rel} />
              </span>
            )}
          </span>
        </>
      )}
      {row.note && <span className="wiki-calc-note">{row.note}</span>}
    </div>
  );
}
