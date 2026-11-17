import { useState } from "react";
import type { DropReceipt } from "../../content/wiki/drop";
import { ReviewMarkdownLink } from "./DropReviewPreview";

const kinds = {
  page: "页面",
  relation: "跨页关系",
  asset: "共享图",
  coordination: "页面分工",
  coverage: "原文处理",
};
const size = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;

export function DropReceiptView({ receipt }: { receipt: DropReceipt }) {
  const [shown, setShown] = useState(20);
  const provided = receipt.inputs.flatMap((i) => i.materials);
  const coverage = (id: string) => {
    let end = 0;
    let count = 0;
    for (const r of provided.filter((r) => r.id === id).sort((a, b) => a.start - b.start)) {
      count += Math.max(0, r.end - Math.max(end, r.start));
      end = Math.max(end, r.end);
    }
    return count;
  };
  const reads = receipt.resources.filter((r) => receipt.requiredReads.includes(r.id));
  const complete = reads.filter((r) => coverage(r.id) === r.length).length;
  return (
    <section className="wiki-drop-receipt" aria-label="原文与跨页复核记录">
      <p>
        原文与旧页覆盖 {complete}/{reads.length}；复核 {receipt.checks.length}/{receipt.requiredChecks.length}{" "}
        项。
      </p>
      {receipt.plans.map((plan) => (
        <details key={plan.path}>
          <summary>{plan.path} · 整合理由与比较依据</summary>
          <p>{plan.reason}</p>
          {plan.comparisons.map((comparison) => (
            <div key={`${comparison.page}-${comparison.quote}-${comparison.reason}`}>
              <p>
                <ReviewMarkdownLink href={`${comparison.page}.md`}>{comparison.page}</ReviewMarkdownLink>：
                {comparison.reason}
              </p>
              <blockquote>{comparison.quote}</blockquote>
            </div>
          ))}
          <ul>
            {plan.evidence.map((ref) => (
              <li key={ref}>
                <a href={`/api/wiki/raw?ref=${encodeURIComponent(ref)}`} target="_blank" rel="noreferrer">
                  {ref}
                </a>
              </li>
            ))}
          </ul>
        </details>
      ))}
      <details>
        <summary>展开原文覆盖与处理结果</summary>
        <p>覆盖表示宿主实际提供过相应文字；内容语义另由逐页及跨页复核检查。</p>
        <ul>
          {reads.map((r) => (
            <li key={r.id}>
              {r.origins.find((o) => o.name)?.name ?? r.path}：{coverage(r.id)}/{r.length} 字符已提供
              {r.kind === "source" && (
                <>
                  {" "}
                  ·{" "}
                  <a
                    href={`/api/wiki/raw?ref=${encodeURIComponent(`raw:${r.path.slice(4)}#L1`)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    查看原文
                  </a>
                </>
              )}
            </li>
          ))}
        </ul>
        <ul>
          {receipt.decisions.map((d) => (
            <li key={d.topic}>
              {d.outcome === "integrate" ? "纳入页面" : d.outcome === "covered" ? "已有知识覆盖" : "保留归档"}
              ：{d.reason}
            </li>
          ))}
        </ul>
      </details>
      <details>
        <summary>展开跨页与共享资产复核</summary>
        <ul>
          {receipt.checks.slice(0, shown).map((check) => (
            <li key={check.id}>
              <b>
                {kinds[check.kind]} · {check.pages.join(" ↔ ")}
                {check.asset ? ` · ${check.asset}` : ""}
              </b>
              <p>{check.report}</p>
              <small>已绑定 {check.bindings.length} 段原文与候选范围</small>
            </li>
          ))}
        </ul>
        {shown < receipt.checks.length && (
          <button type="button" onClick={() => setShown((n) => n + 20)}>
            继续查看（剩余 {receipt.checks.length - shown} 项）
          </button>
        )}
      </details>
      {receipt.protocol === 4 && receipt.factDispositions.length > 0 && (
        <details>
          <summary>展开旧页事实去向（{receipt.factDispositions.length} 条）</summary>
          <ul>
            {receipt.factDispositions.slice(0, shown).map((entry, idx) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: immutable receipt entries within fixed snapshot
              <li key={`${entry.pageId}-${entry.outlet}-${idx}`}>
                <b>{entry.pageId}</b> ·{" "}
                {entry.outlet === "retained" ? (
                  "本页保留"
                ) : entry.outlet === "superseded" ? (
                  "声明替代"
                ) : (
                  <>
                    迁入{" "}
                    <ReviewMarkdownLink
                      href={`${entry.targetPage}.md${entry.targetAnchor ? `#${entry.targetAnchor}` : ""}`}
                    >
                      {entry.targetPage}
                      {entry.targetAnchor ? `#${entry.targetAnchor}` : ""}
                    </ReviewMarkdownLink>
                  </>
                )}
                ：{entry.fact}
              </li>
            ))}
          </ul>
        </details>
      )}
      <details>
        <summary>查看本批上下文用量</summary>
        <p>
          材料与任务输入 {receipt.inputs.length} 次；峰值{" "}
          {size(Math.max(0, ...receipt.inputs.map((i) => i.bytes)))}
          ；累计 {size(receipt.inputs.reduce((n, i) => n + i.bytes, 0))}；同次重叠材料去重{" "}
          {size(receipt.inputs.reduce((n, i) => n + i.savedBytes, 0))}。
        </p>
        <p>
          以上字节不含系统规则；预算检查另计规则、输出和框架预留。字节不是 token
          或费用估计，补读可能增加调用量。
        </p>
      </details>
    </section>
  );
}
