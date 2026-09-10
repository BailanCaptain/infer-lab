import { type ReactNode, useId, useState } from "react";
import { findByAlias, pageHref } from "./index";

/**
 * 七档证据等级，定义抄自 PLAN.md §1.4，是全站唯一来源。
 *
 * `short` 用在有横向空间的地方（页面头部、图例）——学习者第一眼就该知道
 * 这页的结论可信到什么程度；只有空间紧的地方（悬停卡、聊天回答）才退化成
 * 单个字母 + tooltip。孤零零一个 "C" 对没读过规则的人等于没有信息。
 */
export const EVIDENCE_LEVELS_INFO = [
  { level: "S", short: "官方文档", long: "官方文档或论文直接支持" },
  { level: "C", short: "源码实证", long: "钉住 commit 的源码行为，可点来源角标核对" },
  { level: "D", short: "推导", long: "由公式、张量形状或并行规则推导得出" },
  { level: "A", short: "教学假设", long: "为讲清楚而作的简化假设，不是上游事实" },
  { level: "I", short: "推断", long: "未被一手来源直接证实，谨慎采信" },
  { level: "M", short: "实测", long: "离线可复现脚本的实测结果" },
  { level: "!", short: "有冲突", long: "版本冲突、实验状态或当前禁配" },
] as const;

const EVIDENCE_LABEL: Record<string, string> = Object.fromEntries(
  EVIDENCE_LEVELS_INFO.map((e) => [e.level, e.long]),
);
const EVIDENCE_SHORT: Record<string, string> = Object.fromEntries(
  EVIDENCE_LEVELS_INFO.map((e) => [e.level, e.short]),
);

/**
 * 术语悬停卡。id 命中 registry 才渲染成可交互元素；命中不到就退化成纯文本，
 * 不给学习者一个点了没反应的链接。
 */
export function Term({ id, children }: { id: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const cardId = useId();
  const page = findByAlias(id);

  if (!page) {
    if (import.meta.env.DEV) console.warn(`<Term> 未知 id：${id}`);
    return <>{children ?? id}</>;
  }

  return (
    <span className="wiki-term-wrap">
      <a
        className="wiki-term"
        href={pageHref(page.id)}
        aria-describedby={open ? cardId : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {children ?? page.title}
      </a>
      {open && (
        <span className="wiki-term-card" role="tooltip" id={cardId}>
          <span className="wiki-term-card-head">
            <strong>{page.title}</strong>
            <EvidenceBadge level={page.evidence} />
          </span>
          <span className="wiki-term-card-summary">{page.summary}</span>
        </span>
      )}
    </span>
  );
}

/**
 * 证据角标。`variant="full"` 在字母后带中文短语，用于有空间的地方；
 * 默认只有字母，靠 tooltip 补全（触屏上看不到 tooltip，所以能用 full 就用 full）。
 */
export function EvidenceBadge({ level, variant = "letter" }: { level: string; variant?: "letter" | "full" }) {
  const long = EVIDENCE_LABEL[level] ?? level;
  if (variant === "full") {
    return (
      <span className="wiki-evidence-full" data-level={level} title={long}>
        <span className="wiki-evidence" data-level={level}>
          {level}
        </span>
        {EVIDENCE_SHORT[level] ?? level}
      </span>
    );
  }
  return (
    <span className="wiki-evidence" data-level={level} title={long}>
      {level}
    </span>
  );
}

/** 七档图例。放在知识库首页，让学习者进门先建立这套认知。 */
export function EvidenceLegend() {
  return (
    <dl className="wiki-evidence-legend" data-testid="evidence-legend">
      {EVIDENCE_LEVELS_INFO.map((e) => (
        <div key={e.level}>
          <dt>
            <span className="wiki-evidence" data-level={e.level}>
              {e.level}
            </span>
            {e.short}
          </dt>
          <dd>{e.long}</dd>
        </div>
      ))}
    </dl>
  );
}
