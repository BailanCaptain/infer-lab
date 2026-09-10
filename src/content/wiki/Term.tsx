import { type ReactNode, useId, useState } from "react";
import { findByAlias, pageHref } from "./index";

const EVIDENCE_LABEL: Record<string, string> = {
  S: "官方文档",
  C: "钉住 commit 的源码",
  D: "推导",
  A: "教学假设",
  I: "推断",
  M: "实测",
  "!": "版本冲突",
};

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

export function EvidenceBadge({ level }: { level: string }) {
  return (
    <span className="wiki-evidence" data-level={level} title={EVIDENCE_LABEL[level] ?? level}>
      {level}
    </span>
  );
}
