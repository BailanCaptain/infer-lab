/**
 * 本页目录（2026-09-27 定稿，方案 A）：长页（H2 ≥ 4）跳着看，短页不渲染。
 *
 * 宽屏：正文右侧 sticky 导航；放不下时（容器查询，见 wiki.css）退成右下角「本页目录」按钮 + 浮层。
 *
 * 标题和 id 从渲染好的正文里读：id 只由 anchors.ts 生成一次，这里不再算第二遍。
 * 跳转走和正文锚点链接同一条路：改 hash，由阅读页的 hash 副作用滚过去。
 */
import { ListTree } from "lucide-react";
import { type KeyboardEvent, type RefObject, useCallback, useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { fragmentId } from "../../content/wiki/anchors";

export type PageHeading = { id: string; text: string; level: 2 | 3 };

/** H2 不到这个数的短页不显示导航 */
export const TOC_MIN_H2 = 4;

/**
 * 当前小节：标题顶边到了它的 scroll-margin-top（点目录跳过去时停的位置，wiki.css 定）再往下
 * 这么多像素以内，就算进入了这一节。以前是固定的 96px：点「对照源码」跳过去后，紧跟在下面的
 * H3「版本差异」也在 96px 以内，高亮落到了 H3 上。
 */
const ACTIVE_SLACK = 8;

/** 从渲染好的正文里取带 id 的 H2/H3；证据角标不算标题文字 */
export function readHeadings(body: HTMLElement): PageHeading[] {
  return [...body.querySelectorAll<HTMLHeadingElement>("h2[id], h3[id]")].map((h) => {
    const copy = h.cloneNode(true) as HTMLElement;
    for (const mark of copy.querySelectorAll(".wiki-evidence, .wiki-mark-link, abbr")) mark.remove();
    return { id: h.id, text: (copy.textContent ?? "").trim(), level: h.tagName === "H2" ? 2 : 3 };
  });
}

export function hasPageToc(headings: PageHeading[]): boolean {
  return headings.filter((h) => h.level === 2).length >= TOC_MIN_H2;
}

/**
 * 滚动时当前所在的小节。滚到页底时，末尾几节挤在最后一屏、顶不到视口上方：刚从目录点过去的那一节
 * 还在视口里就算它，否则算最后一节。
 */
function useActiveHeading(headings: PageHeading[]): string | null {
  const [active, setActive] = useState<string | null>(null);
  const { hash } = useLocation();
  const jumped = fragmentId(hash);
  useEffect(() => {
    if (headings.length === 0) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const doc = document.documentElement;
      const atBottom = window.innerHeight + window.scrollY >= doc.scrollHeight - 2;
      let current: string | null = null;
      for (const h of headings) {
        const el = document.getElementById(h.id);
        if (!el) continue;
        const line = Number.parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
        if (el.getBoundingClientRect().top <= line + ACTIVE_SLACK) current = h.id;
      }
      if (atBottom && current) {
        const target = headings.some((h) => h.id === jumped) ? document.getElementById(jumped) : null;
        const top = target?.getBoundingClientRect().top ?? -1;
        current =
          top >= 0 && top < window.innerHeight ? jumped : (headings[headings.length - 1]?.id ?? current);
      }
      setActive(current);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [headings, jumped]);
  return active;
}

type ListProps = {
  pageId: string;
  headings: PageHeading[];
  active: string | null;
  scrollTo: (hash: string) => void;
  onPick?: () => void;
};

function TocList({ pageId, headings, active, scrollTo, onPick }: ListProps) {
  const { search, hash } = useLocation();
  return (
    <ol className="wiki-pagetoc-list">
      {headings.map((h) => (
        <li key={h.id} className={`is-h${h.level}`}>
          <Link
            to={{ pathname: `/wiki/${pageId}`, search, hash: `#${h.id}` }}
            className={h.id === active ? "wiki-pagetoc-link is-active" : "wiki-pagetoc-link"}
            aria-current={h.id === active ? "location" : undefined}
            onClick={() => {
              // hash 没变时路由不更新，阅读页的滚动副作用不会再跑：自己滚回去
              if (fragmentId(hash) === h.id) scrollTo(`#${h.id}`);
              onPick?.();
            }}
          >
            {h.text}
          </Link>
        </li>
      ))}
    </ol>
  );
}

/** 浮层的开关：Esc 关并把焦点还给按钮，点外面关，打开时焦点落到当前小节 */
function usePopover(button: RefObject<HTMLButtonElement | null>, pop: RefObject<HTMLElement | null>) {
  const [open, setOpen] = useState(false);
  const close = useCallback(
    (restoreFocus: boolean) => {
      setOpen(false);
      if (restoreFocus) button.current?.focus();
    },
    [button],
  );
  useEffect(() => {
    if (!open) return;
    const target =
      pop.current?.querySelector<HTMLElement>("[aria-current]") ?? pop.current?.querySelector("a");
    target?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!pop.current?.contains(t) && !button.current?.contains(t)) close(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, close, pop, button]);
  return { open, setOpen, close };
}

/** 浮层里上下方向键在条目间移动，Home/End 到头尾 */
function onListKeys(e: KeyboardEvent<HTMLElement>) {
  const links = [...e.currentTarget.querySelectorAll<HTMLElement>("a")];
  const i = links.indexOf(document.activeElement as HTMLElement);
  const next =
    e.key === "ArrowDown"
      ? links[Math.min(i + 1, links.length - 1)]
      : e.key === "ArrowUp"
        ? links[Math.max(i - 1, 0)]
        : e.key === "Home"
          ? links[0]
          : e.key === "End"
            ? links[links.length - 1]
            : undefined;
  if (!next) return;
  e.preventDefault();
  next.focus();
}

type Props = {
  pageId: string;
  headings: PageHeading[];
  scrollTo: (hash: string) => void;
};

function Popover({
  id,
  popRef,
  list,
  onClose,
  className,
}: {
  id: string;
  popRef: RefObject<HTMLElement | null>;
  list: Omit<ListProps, "onPick">;
  onClose: () => void;
  className: string;
}) {
  const count = list.headings.filter((h) => h.level === 2).length;
  return (
    <nav
      id={id}
      ref={popRef}
      className={`wiki-pagetoc-pop ${className}`}
      aria-label="本页目录"
      data-testid="pagetoc-pop"
      onKeyDown={onListKeys}
    >
      <div className="wiki-pagetoc-title">
        本页目录 <small className="wiki-pagetoc-count">{count} 节</small>
      </div>
      <TocList {...list} onPick={onClose} />
    </nav>
  );
}

/** 放不下右侧导航时：右下角按钮，叠在「问知识库」上方（桌面上是按钮道里的圆形图标，见 wiki.css） */
export function PageTocFab(props: Props) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLElement>(null);
  const { open, setOpen, close } = usePopover(button, pop);
  const active = useActiveHeading(props.headings);
  return (
    <div className="wiki-pagetoc-float" data-testid="pagetoc-fab">
      <button
        ref={button}
        type="button"
        className="wiki-pagetoc-fab"
        aria-expanded={open}
        aria-controls={id}
        title="本页目录"
        onClick={() => setOpen((o) => !o)}
      >
        <ListTree size={14} /> <span className="wiki-fab-label">本页目录</span>
      </button>
      {open && (
        <Popover
          id={id}
          popRef={pop}
          className="is-float"
          list={{ ...props, active }}
          onClose={() => close(false)}
        />
      )}
    </div>
  );
}

/** 宽屏：正文右侧 sticky 导航 */
export function PageTocSide(props: Props) {
  const active = useActiveHeading(props.headings);
  return (
    <nav className="wiki-pagetoc-side" aria-label="本页目录" data-testid="pagetoc-side">
      <div className="wiki-pagetoc-title">本页目录</div>
      <TocList {...props} active={active} />
    </nav>
  );
}
