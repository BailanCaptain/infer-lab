import { Outlet, ScrollRestoration } from "react-router";

export function AppShell() {
  return (
    <div className="min-h-full bg-canvas text-ink">
      {/*
       * 换页时重置滚动位置。react-router 的 hash 路由不会自己做这件事：从一页的底部点链接
       * 跳到另一页，新页面沿用上一页的 scrollY，读者落在文章末尾。ScrollRestoration 在前进
       * （PUSH）时回到顶部，在后退（POP）时恢复原来的位置。
       * 带 `#锚点` 的链接由 WikiPage 的 useLocation 效果接着滚到对应标题。
       */}
      <ScrollRestoration />
      <Outlet />
    </div>
  );
}
