import { MessageSquare, RefreshCw, X } from "lucide-react";
import {
  type KeyboardEvent,
  lazy,
  type RefObject,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createEvidenceViewController } from "../../content/wiki/evidence-schema";
import {
  type BackendAvailability,
  getBackendAvailability,
  isStaticOfflineError,
  probeBackendHealth,
  subscribeBackendAvailability,
  wikiRequest,
} from "./api";
import { type ChatState, useChat } from "./chat-controller";
import type { EvidenceViewController } from "./EvidencePane";
import { ReaderResizeHandle } from "./ReaderResizeHandle";
import type { ReviewSummary } from "./ReviewPane";
import { tabIndexAfterKey } from "./tablist";

const ChatPane = lazy(async () => ({ default: (await import("./ChatDrawer")).ChatPane }));
const EvidencePane = lazy(async () => ({ default: (await import("./EvidencePane")).EvidencePane }));
const DropPane = lazy(async () => ({ default: (await import("./DropPane")).DropPane }));
const ReviewPane = lazy(async () => ({ default: (await import("./ReviewPane")).ReviewPane }));
const StatusPane = lazy(async () => ({ default: (await import("./StatusPane")).StatusPane }));

export type WikiPanelTab = "chat" | "evidence" | "drop" | "review" | "status";
const TABS: { id: WikiPanelTab; label: string; backendOnly?: boolean }[] = [
  { id: "chat", label: "问答" },
  { id: "evidence", label: "证据" },
  { id: "drop", label: "Drop", backendOnly: true },
  { id: "review", label: "审阅", backendOnly: true },
  { id: "status", label: "状态", backendOnly: true },
];
const tabIdOf = (tab: WikiPanelTab) => `wiki-panel-tab-${tab}`;
const panelIdOf = (tab: WikiPanelTab) => `wiki-panel-${tab}`;

export function shouldStopChatOnPanelClose(tab: WikiPanelTab): boolean {
  return tab === "chat";
}

/**
 * 知识库的全部操作收在一个侧栏里：问答、审阅、刷新，外加一页只读的运行状态。
 * 两个页签常驻渲染、只切显隐——对话记录、滚动位置和读到一半的 diff 都不因切换而丢。
 */
export interface WikiPanelProps {
  revision: string;
  mode: "build" | "local";
  backendAvailable?: BackendAvailability | undefined;
  currentId?: string | undefined;
  chat?: ChatState | undefined;
  evidenceController?: EvidenceViewController | undefined;
  layout?: "closed" | WikiPanelTab | undefined;
  lastTriggerRef?: RefObject<HTMLElement | null> | undefined;
  /** 返回 true 表示读者快照已更新到最新发布版本 */
  onRefresh: () => Promise<boolean>;
  /** 外层要知道面板开没开、在哪个页签（浮层开着时「本页目录」按钮要挪到它左边） */
  onLayout: (layout: "closed" | WikiPanelTab) => void;
}

export function WikiPanel(props: WikiPanelProps) {
  if (props.chat) {
    return <WikiPanelView {...props} chat={props.chat} />;
  }
  return <WikiPanelStandalone {...props} />;
}

function WikiPanelStandalone(props: WikiPanelProps) {
  const chat = useChat();
  return <WikiPanelView {...props} chat={chat} />;
}

function WikiPanelView({
  revision,
  mode,
  backendAvailable: backendAvailableProp,
  currentId,
  chat,
  evidenceController,
  layout,
  lastTriggerRef,
  onRefresh,
  onLayout,
}: Omit<WikiPanelProps, "chat"> & { chat: ChatState }) {
  const storeBackendAvailable = useSyncExternalStore(
    subscribeBackendAvailability,
    getBackendAvailability,
    getBackendAvailability,
  );
  const effectiveBackend = backendAvailableProp ?? storeBackendAvailable;
  const isOffline = effectiveBackend === "offline";
  const isServiceDown = effectiveBackend === "service-down";
  const isBackendUnavailable = isOffline || isServiceDown;
  const visibleTabs = isBackendUnavailable ? TABS.filter((t) => !t.backendOnly) : TABS;

  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [lastTab, setLastTab] = useState<WikiPanelTab>("chat");
  const controlled = layout !== undefined;
  const open = controlled ? layout !== "closed" : uncontrolledOpen;
  const rawTab = controlled && layout !== "closed" ? layout : lastTab;
  const tab: WikiPanelTab =
    isBackendUnavailable && (rawTab === "drop" || rawTab === "review" || rawTab === "status")
      ? "chat"
      : rawTab;

  const [openedTabs, setOpenedTabs] = useState<ReadonlySet<WikiPanelTab>>(() =>
    open ? new Set([tab]) : new Set(),
  );
  if (!open && openedTabs.size > 0) {
    setOpenedTabs(new Set());
  } else if (open && !openedTabs.has(tab)) {
    const next = new Set(openedTabs);
    next.add(tab);
    setOpenedTabs(next);
  }
  const [reviews, setReviews] = useState<ReviewSummary[]>([]);
  const [listError, setListError] = useState("");
  const [selected, setSelected] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const reconnectingRef = useRef(false);
  const [fallbackEvidence] = useState(() =>
    createEvidenceViewController({
      loadPageEvidence: () => Promise.reject(new Error("当前环境未接入证据读取入口。")),
    }),
  );
  const activeEvidence = evidenceController ?? fallbackEvidence;
  const tabRefs = useRef<Partial<Record<WikiPanelTab, HTMLButtonElement | null>>>({});
  const fabRef = useRef<HTMLButtonElement>(null);
  const currentTab = useRef(tab);
  currentTab.current = tab;
  const wasOpen = useRef(open);

  const loadReviews = useCallback(
    async (force = false) => {
      if (!force && isBackendUnavailable) {
        setReviews([]);
        setListError("");
        return;
      }
      try {
        setReviews((await wikiRequest<{ reviews: ReviewSummary[] }>("reviews")).reviews);
        setListError("");
      } catch (e) {
        if (isStaticOfflineError(e) || getBackendAvailability() === "service-down") {
          setReviews([]);
          setListError("");
          return;
        }
        setListError((e as Error).message);
      }
    },
    [isBackendUnavailable],
  );

  const handleReconnect = useCallback(async () => {
    if (reconnectingRef.current) return;
    reconnectingRef.current = true;
    setReconnecting(true);
    try {
      const status = await probeBackendHealth();
      if (status === "online") {
        await Promise.all([onRefresh().catch(() => false), loadReviews(true)]);
      }
    } finally {
      reconnectingRef.current = false;
      setReconnecting(false);
    }
  }, [loadReviews, onRefresh]);

  // 待审数要挂在入口上，所以面板没打开也要先取一次
  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);
  useEffect(() => {
    if (open && tab === "review" && !isBackendUnavailable) void loadReviews();
  }, [open, tab, isBackendUnavailable, loadReviews]);
  useEffect(() => {
    if (layout && layout !== "closed") setLastTab(layout);
  }, [layout]);
  useEffect(() => {
    if (!controlled) onLayout(!open ? "closed" : tab);
  }, [controlled, open, tab, onLayout]);
  // 打开时焦点到当前页签，关上时优先回到触发来源，否则回到「问知识库」按钮；首次渲染不抢焦点
  useEffect(() => {
    if (open === wasOpen.current) return;
    wasOpen.current = open;
    if (open) {
      tabRefs.current[currentTab.current]?.focus({ preventScroll: true });
      return;
    }
    const trigger = lastTriggerRef?.current;
    if (trigger?.isConnected) {
      lastTriggerRef!.current = null;
      trigger.focus({ preventScroll: true });
    } else {
      fabRef.current?.focus({ preventScroll: true });
    }
  }, [open, lastTriggerRef]);

  const pending = isBackendUnavailable
    ? 0
    : reviews.filter((r) => r.state === "pending" || r.state === "publishing").length;

  const openPanel = useCallback(
    (nextTab?: WikiPanelTab) => {
      const candidate = nextTab ?? currentTab.current;
      const target: WikiPanelTab =
        isBackendUnavailable && (candidate === "drop" || candidate === "review" || candidate === "status")
          ? "chat"
          : candidate;
      setLastTab(target);
      if (controlled) onLayout(target);
      else setUncontrolledOpen(true);
    },
    [controlled, isBackendUnavailable, onLayout],
  );

  const closePanel = useCallback(() => {
    if (controlled) onLayout("closed");
    else setUncontrolledOpen(false);
  }, [controlled, onLayout]);

  const openReview = useCallback(
    (id: string) => {
      if (isBackendUnavailable) return;
      void loadReviews();
      setSelected(id);
      openPanel("review");
    },
    [isBackendUnavailable, loadReviews, openPanel],
  );

  function onTabKey(e: KeyboardEvent) {
    const index = tabIndexAfterKey(
      e.key,
      visibleTabs.findIndex((t) => t.id === tab),
      visibleTabs.length,
    );
    const next = index === undefined ? undefined : visibleTabs[index];
    if (!next) return;
    e.preventDefault();
    openPanel(next.id);
    tabRefs.current[next.id]?.focus();
  }

  if (!open) {
    return (
      <button
        ref={fabRef}
        type="button"
        className="wiki-chat-fab"
        data-testid="chat-open"
        title="问知识库"
        onClick={() => openPanel()}
      >
        {/* 桌面上缩成图标时字只给读屏（wiki.css 的按钮道），按钮的名字始终是「问知识库」 */}
        <MessageSquare size={14} /> <span className="wiki-fab-label">问知识库</span>
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
      <ReaderResizeHandle side="assistant" />
      <header className="wiki-panel-head">
        <div className="wiki-panel-tabs" role="tablist" aria-label="知识库助手" onKeyDown={onTabKey}>
          {visibleTabs.map((t) => (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[t.id] = el;
              }}
              type="button"
              role="tab"
              id={tabIdOf(t.id)}
              aria-controls={panelIdOf(t.id)}
              aria-selected={tab === t.id}
              tabIndex={tab === t.id ? 0 : -1}
              onClick={() => openPanel(t.id)}
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
            if (shouldStopChatOnPanelClose(tab)) chat.stop();
            if (tab === "evidence") activeEvidence.close();
            closePanel();
          }}
        >
          <X size={15} />
        </button>
      </header>

      <div className="wiki-panel-status">
        <span title={revision}>
          {mode === "build" ? "构建版本" : "知识版本"} <code>{revision.slice(0, 12)}</code>
        </span>
        {isOffline ? (
          <span className="wiki-static-mode-pill" data-testid="wiki-static-mode-pill">
            纯静态离线浏览
          </span>
        ) : isServiceDown ? (
          <span className="wiki-service-down-actions" data-testid="wiki-service-down-banner">
            <span className="wiki-static-mode-pill" data-testid="wiki-service-down-pill">
              问答服务未启动
            </span>
            <button
              type="button"
              data-testid="wiki-reconnect-btn"
              disabled={reconnecting}
              onClick={() => void handleReconnect()}
            >
              <RefreshCw size={12} className={reconnecting ? "is-spinning" : undefined} />
              重新连接
            </button>
          </span>
        ) : (
          <button
            type="button"
            disabled={refreshing}
            onClick={() => {
              setRefreshing(true);
              void onRefresh()
                .catch(() => false)
                .finally(() => setRefreshing(false));
              void loadReviews(true);
            }}
          >
            <RefreshCw size={12} className={refreshing ? "is-spinning" : undefined} />
            刷新知识库
          </button>
        )}
      </div>

      {openedTabs.has("chat") ? (
        <Suspense fallback={<div id={panelIdOf("chat")} role="tabpanel" hidden={tab !== "chat"} />}>
          <ChatPane
            id={panelIdOf("chat")}
            chat={chat}
            backendAvailable={effectiveBackend}
            currentId={currentId}
            hidden={tab !== "chat"}
            onReview={openReview}
          />
        </Suspense>
      ) : (
        <div id={panelIdOf("chat")} role="tabpanel" hidden />
      )}
      {openedTabs.has("evidence") ? (
        <Suspense fallback={<div id={panelIdOf("evidence")} role="tabpanel" hidden={tab !== "evidence"} />}>
          <EvidencePane id={panelIdOf("evidence")} hidden={tab !== "evidence"} controller={activeEvidence} />
        </Suspense>
      ) : (
        <div id={panelIdOf("evidence")} role="tabpanel" hidden />
      )}
      {!isBackendUnavailable &&
        (openedTabs.has("drop") ? (
          <Suspense fallback={<div id={panelIdOf("drop")} role="tabpanel" hidden={tab !== "drop"} />}>
            <DropPane
              id={panelIdOf("drop")}
              backendAvailable={effectiveBackend}
              hidden={tab !== "drop"}
              onReview={openReview}
            />
          </Suspense>
        ) : (
          <div id={panelIdOf("drop")} role="tabpanel" hidden />
        ))}
      {!isBackendUnavailable &&
        (openedTabs.has("review") ? (
          <Suspense fallback={<div id={panelIdOf("review")} role="tabpanel" hidden={tab !== "review"} />}>
            <ReviewPane
              id={panelIdOf("review")}
              hidden={tab !== "review"}
              reviews={reviews}
              listError={listError}
              selected={selected}
              onSelect={setSelected}
              onChanged={(r) => setReviews((items) => items.map((x) => (x.id === r.id ? { ...x, ...r } : x)))}
              onPublished={async () => {
                // false means a newer refresh superseded this one; actual read failures reject.
                // Reload the list too: a batch publishes its parent receipt as well as its children.
                await Promise.all([onRefresh(), loadReviews(true)]);
              }}
            />
          </Suspense>
        ) : (
          <div id={panelIdOf("review")} role="tabpanel" hidden />
        ))}
      {!isBackendUnavailable &&
        (openedTabs.has("status") ? (
          <Suspense fallback={<div id={panelIdOf("status")} role="tabpanel" hidden={tab !== "status"} />}>
            <StatusPane
              id={panelIdOf("status")}
              hidden={tab !== "status"}
              onOpenReview={() => openPanel("review")}
            />
          </Suspense>
        ) : (
          <div id={panelIdOf("status")} role="tabpanel" hidden />
        ))}
    </aside>
  );
}
