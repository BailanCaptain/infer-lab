import { MessageSquare, RefreshCw, X } from "lucide-react";
import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { wikiRequest } from "./api";
import { ChatPane, useChat } from "./ChatDrawer";
import { ReviewPane, type ReviewSummary } from "./ReviewPane";
import { StatusPane } from "./StatusPane";

type Tab = "chat" | "review" | "status";
const TABS: { id: Tab; label: string }[] = [
  { id: "chat", label: "问答" },
  { id: "review", label: "审阅" },
  { id: "status", label: "状态" },
];

/**
 * 知识库的全部操作收在一个侧栏里：问答、审阅、刷新，外加一页只读的运行状态。
 * 两个页签常驻渲染、只切显隐——对话记录、滚动位置和读到一半的 diff 都不因切换而丢。
 */
export function WikiPanel({
  revision,
  mode,
  onRefresh,
  onLayout,
}: {
  revision: string;
  mode: "build" | "local";
  /** 返回 true 表示读者快照已更新到最新发布版本 */
  onRefresh: () => Promise<boolean>;
  /** 面板是实打实占一列的，外层网格要知道它现在多宽 */
  onLayout: (layout: "closed" | Tab) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("chat");
  const [reviews, setReviews] = useState<ReviewSummary[]>([]);
  const [listError, setListError] = useState("");
  const [selected, setSelected] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);
  const chat = useChat();
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});

  const loadReviews = useCallback(async () => {
    try {
      setReviews((await wikiRequest<{ reviews: ReviewSummary[] }>("reviews")).reviews);
      setListError("");
    } catch (e) {
      setListError((e as Error).message);
    }
  }, []);

  // 待审数要挂在入口上，所以面板没打开也要先取一次
  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);
  useEffect(() => {
    if (open && tab === "review") void loadReviews();
  }, [open, tab, loadReviews]);
  useEffect(() => {
    onLayout(!open ? "closed" : tab);
  }, [open, tab, onLayout]);

  const pending = reviews.filter((r) => r.state === "pending" || r.state === "publishing").length;

  const openReview = useCallback(
    (id: string) => {
      void loadReviews();
      setSelected(id);
      setTab("review");
      setOpen(true);
    },
    [loadReviews],
  );

  function onTabKey(e: KeyboardEvent) {
    const i = TABS.findIndex((t) => t.id === tab);
    const next =
      e.key === "ArrowRight"
        ? TABS[(i + 1) % TABS.length]
        : e.key === "ArrowLeft"
          ? TABS[(i + TABS.length - 1) % TABS.length]
          : undefined;
    if (!next) return;
    e.preventDefault();
    setTab(next.id);
    tabRefs.current[next.id]?.focus();
  }

  if (!open) {
    return (
      <button type="button" className="wiki-chat-fab" data-testid="chat-open" onClick={() => setOpen(true)}>
        <MessageSquare size={14} /> 问知识库
        {pending > 0 && (
          <span className="wiki-panel-badge" title={`${pending} 份变更待审`}>
            {pending}
          </span>
        )}
      </button>
    );
  }

  return (
    <aside className={`wiki-panel is-${tab}`} data-testid="chat-drawer" aria-label="知识库助手">
      <header className="wiki-panel-head">
        <div className="wiki-panel-tabs" role="tablist" aria-label="知识库助手" onKeyDown={onTabKey}>
          {TABS.map((t) => (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[t.id] = el;
              }}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              tabIndex={tab === t.id ? 0 : -1}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.id === "review" && pending > 0 && <span className="wiki-panel-badge">{pending}</span>}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="wiki-panel-icon"
          aria-label="关闭"
          data-testid="chat-close"
          onClick={() => {
            chat.stop();
            setOpen(false);
          }}
        >
          <X size={15} />
        </button>
      </header>

      <div className="wiki-panel-status">
        <span title={revision}>
          {mode === "build" ? "构建版本" : "知识版本"} <code>{revision.slice(0, 12)}</code>
        </span>
        <button
          type="button"
          disabled={refreshing}
          onClick={() => {
            setRefreshing(true);
            void onRefresh()
              .catch(() => false)
              .finally(() => setRefreshing(false));
            void loadReviews();
          }}
        >
          <RefreshCw size={12} className={refreshing ? "is-spinning" : undefined} />
          刷新知识库
        </button>
      </div>

      <ChatPane chat={chat} hidden={tab !== "chat"} onReview={openReview} />
      <ReviewPane
        hidden={tab !== "review"}
        reviews={reviews}
        listError={listError}
        selected={selected}
        onSelect={setSelected}
        onChanged={(r) => setReviews((items) => items.map((x) => (x.id === r.id ? { ...x, ...r } : x)))}
        onPublished={async () => {
          if (!(await onRefresh())) throw new Error("发布成功；读取新页面失败，请点「刷新知识库」重试。");
        }}
      />
      <StatusPane hidden={tab !== "status"} onOpenReview={() => setTab("review")} />
    </aside>
  );
}
