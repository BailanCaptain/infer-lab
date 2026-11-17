import type { ReactNode } from "react";
import { Link, useInRouterContext } from "react-router";
import { fragmentId } from "../../content/wiki/anchors";
import { findByAlias, resolvePageId, rewriteRelativeLink, routePathOf } from "../../content/wiki/index";
import { pageDisplayTitle } from "../../content/wiki/param-display";

export function expandAncestorDetails(target: Element): void {
  for (let el: Element | null = target; el; el = el.parentElement) {
    if (el instanceof HTMLDetailsElement) el.open = true;
  }
}

/** 滚到 `#锚点` 对应的标题（id 由 anchors.ts 生成）；命中收起的折叠区时先自动展开 */
export function scrollToWikiFragment(hash: string): boolean {
  const id = fragmentId(hash);
  if (!id) return false;
  const target = document.getElementById(id);
  if (!target) return false;
  expandAncestorDetails(target);
  target.scrollIntoView({ block: "start" });
  return true;
}

/** 仅当路由 ID 命中旧 ID 且与规范 ID 不同时生成 replace 跳转目标，原样保留 query 与中文/编码锚点 */
export function canonicalWikiRedirectTarget(
  routeId: string | undefined,
  canonicalId: string | undefined,
  location: { search: string; hash: string },
): { pathname: string; search: string; hash: string } | null {
  if (!routeId || !canonicalId || canonicalId === routeId) return null;
  return {
    pathname: `/wiki/${canonicalId}`,
    search: location.search,
    hash: location.hash,
  };
}

export interface LinkClickLike {
  defaultPrevented: boolean;
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/** 仅未阻止的普通主键激活（含键盘 Enter 合成的 button===0 无修饰点击）允许在当前窗口滚动或展开折叠区 */
export function isPlainPrimaryLinkClick(event: LinkClickLike): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

export function WikiContentLink({
  href,
  currentId,
  title,
  children,
}: {
  href?: string | undefined;
  currentId?: string | undefined;
  title?: string | undefined;
  children?: ReactNode;
}) {
  const inRouter = useInRouterContext();
  const to = rewriteRelativeLink(href ?? "", currentId);
  const route = routePathOf(to);
  const routePageRawId = route?.startsWith("/wiki/")
    ? route.slice("/wiki/".length).split(/[?#]/)[0]
    : undefined;
  const resolvedTarget = routePageRawId
    ? findByAlias(resolvePageId(routePageRawId) ?? routePageRawId)
    : undefined;
  const effectiveTitle = title ?? (resolvedTarget ? pageDisplayTitle(resolvedTarget) : undefined);
  const fragmentIndex = to.startsWith("#/") ? to.indexOf("#", 1) : -1;
  const targetFragment = fragmentIndex > 0 ? to.slice(fragmentIndex) : "";
  if (route && inRouter) {
    return (
      <Link
        to={route}
        title={effectiveTitle}
        onClick={(event) => {
          if (!isPlainPrimaryLinkClick(event)) return;
          if (!targetFragment) {
            requestAnimationFrame(() => {
              document.getElementById("main-content")?.scrollTo?.({ top: 0 });
              window.scrollTo?.({ top: 0 });
            });
            return;
          }
          // 同页重复点击同一锚点（或已在该锚点地址）时浏览器不发 hash 变更，手动补展开与滚动
          requestAnimationFrame(() => {
            scrollToWikiFragment(targetFragment);
          });
        }}
      >
        {children}
      </Link>
    );
  }
  const external = /^https?:/i.test(to) || to.startsWith("./wiki-raw/");
  return (
    <a href={to} title={effectiveTitle} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
      {children}
    </a>
  );
}
