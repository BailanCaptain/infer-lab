import { BookOpen } from "lucide-react";
import type { CSSProperties } from "react";
import { Link, Outlet, ScrollRestoration, useLocation } from "react-router";
import city from "./intro/city.json";
import { SiteNav } from "./SiteNav";
import "../design/site.css";
import "../design/knowledge-reader.css";

export function AppShell() {
  const { pathname } = useLocation();
  const reader = pathname.startsWith("/wiki") || ["/chapters", "/model", "/hardware"].includes(pathname);
  const showHeader =
    !reader &&
    pathname !== "/" &&
    pathname !== "/home" &&
    pathname !== "/chapters" &&
    pathname !== "/archive/home" &&
    !pathname.startsWith("/wiki") &&
    !pathname.startsWith("/dev/");
  return (
    <div
      className={`min-h-full bg-canvas text-ink${reader ? " knowledge-reader" : showHeader && pathname !== "/chapters/03" ? " journey-shell" : ""}`}
      style={{ "--journey-paper": city.palette.sky, "--journey-ink": city.palette.ink } as CSSProperties}
    >
      {/*
       * 换页时重置滚动位置。react-router 的 hash 路由不会自己做这件事：从一页的底部点链接
       * 跳到另一页，新页面沿用上一页的 scrollY，读者落在文章末尾。ScrollRestoration 在前进
       * （PUSH）时回到顶部，在后退（POP）时恢复原来的位置。
       * 带 `#锚点` 的链接由 WikiPage 的 useLocation 效果接着滚到对应标题。
       */}
      <ScrollRestoration />
      {reader && (
        <>
          <button
            type="button"
            className="reader-skip"
            onClick={() => document.getElementById("main-content")?.focus()}
          >
            跳到正文
          </button>
          <header className="reader-header">
            <Link className="reader-brand" to="/" aria-label="大模型推理首页">
              <BookOpen size={22} strokeWidth={1.6} aria-hidden="true" />
              <span>
                AI Infra<small>大模型推理</small>
              </span>
            </Link>
            <SiteNav />
          </header>
        </>
      )}
      {showHeader && (
        <>
          <button
            type="button"
            className="site-skip"
            onClick={(event) => {
              event.preventDefault();
              const main = document.getElementById("main-content");
              main?.setAttribute("tabindex", "-1");
              main?.focus();
            }}
          >
            跳到正文
          </button>
          <header className="site-header">
            <Link className="site-brand" to="/">
              <span>
                大模型推理之旅<small>A JOURNEY INTO AI INFRA</small>
              </span>
            </Link>
            <span className="site-header-note">从模型计算，到系统执行</span>
          </header>
        </>
      )}
      <Outlet />
    </div>
  );
}
