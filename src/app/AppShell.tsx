import { BookOpen } from "lucide-react";
import { type CSSProperties, useState, useSyncExternalStore } from "react";
import { Link, Outlet, ScrollRestoration, useLocation } from "react-router";
import { getReaderState, subscribeReader } from "../content/wiki/index";
import city from "./intro/city.json";
import { SiteNav } from "./SiteNav";
import { useWikiAssistant, WikiAssistantProvider } from "./wiki/assistant-context";
import { WikiQuickSearch } from "./wiki/QuickSearch";
import { WikiPanel } from "./wiki/WikiPanel";
import "../design/site.css";
import "../design/knowledge-reader.css";
import "../design/wiki.css";

function AppShellView({ reader }: { reader: boolean }) {
  const { pathname } = useLocation();
  const { pages, revision, mode } = useSyncExternalStore(subscribeReader, getReaderState);
  const assistant = useWikiAssistant();
  const [quickSearchSlot, setQuickSearchSlot] = useState<HTMLDivElement | null>(null);
  const showHeader =
    !reader &&
    pathname !== "/" &&
    pathname !== "/home" &&
    pathname !== "/chapters" &&
    pathname !== "/archive/home" &&
    !pathname.startsWith("/wiki") &&
    !pathname.startsWith("/dev/");
  const panelClass =
    reader && assistant.panel !== "closed" ? ` is-panel-open is-panel-${assistant.panel}` : "";
  return (
    <div
      className={`min-h-full bg-canvas text-ink${reader ? ` knowledge-reader${panelClass}` : showHeader && pathname !== "/chapters/03" ? " journey-shell" : ""}`}
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
            <div className="reader-header-end">
              <div
                ref={setQuickSearchSlot}
                id="reader-quick-search-slot"
                className="reader-quick-search-slot"
              />
              <SiteNav />
            </div>
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
      {reader && (
        <>
          <WikiQuickSearch
            pages={pages}
            revision={revision}
            slot={quickSearchSlot}
            onAfterNavigate={() => assistant.wikiHost?.onQuickSearchNavigate?.()}
          />
          <WikiPanel
            revision={revision}
            mode={mode}
            chat={assistant.chat}
            currentId={assistant.wikiHost?.currentId}
            evidenceController={assistant.wikiHost?.evidenceController}
            evidenceOpenSeq={assistant.evidenceOpenSeq}
            panelCommand={assistant.panelCommand}
            lastTriggerRef={assistant.lastTriggerRef}
            onLayout={assistant.setPanel}
            onRefresh={() => assistant.refresh()}
          />
        </>
      )}
    </div>
  );
}

export function AppShell() {
  const { pathname } = useLocation();
  const reader =
    pathname.startsWith("/wiki") ||
    pathname.startsWith("/tools") ||
    ["/chapters", "/model", "/hardware"].includes(pathname);
  return (
    <WikiAssistantProvider active={reader}>
      <AppShellView reader={reader} />
    </WikiAssistantProvider>
  );
}
